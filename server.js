import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { GoogleAIFileManager } from '@google/generative-ai/server';
import Article from './models/Article.js';

// 加载环境变量
dotenv.config();

const execAsync = promisify(exec);
const app = express();
const PORT = process.env.PORT || 3001;
const isProduction = process.env.NODE_ENV === 'production';

// ========== MongoDB 连接 ==========
const connectDB = async () => {
  try {
    if (!process.env.MONGODB_URI) {
      console.error('❌ 错误：请在 .env 文件中配置 MONGODB_URI');
      process.exit(1);
    }
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB 连接成功');
  } catch (error) {
    console.error('❌ MongoDB 连接失败:', error.message);
    process.exit(1);
  }
};

// ========== Cookies 写入逻辑 ==========
// 如果 cookies.txt 不存在且环境变量中有 YOUTUBE_COOKIES，则写入到 cookies.txt
if (!fs.existsSync(path.join(process.cwd(), 'cookies.txt')) && process.env.YOUTUBE_COOKIES) {
  fs.writeFileSync(path.join(process.cwd(), 'cookies.txt'), process.env.YOUTUBE_COOKIES);
  console.log('✅ 已从环境变量写入 cookies.txt');
}

// ========== CORS 配置 ==========
app.use(cors({
  origin: (origin, callback) => {
    // 允许无 origin 的请求（curl、Postman、服务端调用等）
    if (!origin) return callback(null, true);

    const allowed =
      origin === 'http://localhost:5173' ||
      origin.endsWith('.vercel.app') ||
      (process.env.FRONTEND_URL && origin === process.env.FRONTEND_URL.replace(/\/$/, ''));

    callback(null, allowed || false);
  },
  credentials: true,
}));
// 增加请求体大小限制至 50MB，确保长视频字幕也能正常保存
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// ========== 生产环境：托管 Vite 构建产物 ==========
if (isProduction) {
  app.use(express.static(path.join(process.cwd(), 'dist')));
}

// 确保 temp 目录存在
const tempDir = path.join(process.cwd(), 'temp');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
  console.log('✅ 已创建 temp 目录');
}

// 初始化 Gemini
const apiKey = process.env.GOOGLE_API_KEY;
if (!apiKey) {
  console.error('❌ 错误：请在 .env 文件中配置 GOOGLE_API_KEY');
  process.exit(1);
}

const fileManager = new GoogleAIFileManager(apiKey);
const genAI = new GoogleGenerativeAI(apiKey);
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

console.log('✅ Gemini API 初始化成功');

// 辅助函数：将秒数转换为 "MM:SS" 格式
function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// Mac Chrome User-Agent
const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// ========== yt-dlp 路径与 cookies 配置 ==========
const YT_DLP = isProduction ? 'yt-dlp' : '/opt/homebrew/bin/yt-dlp';

const cookiesPath = path.join(process.cwd(), 'cookies.txt');
const hasCookiesFile = fs.existsSync(cookiesPath);
const COOKIES_FLAG = hasCookiesFile
  ? `--cookies "${cookiesPath}"`
  : (isProduction ? '' : '--cookies-from-browser chrome');

// 核心分析接口
app.post('/analyze', async (req, res) => {
  const { url } = req.body;
  let localFilePath = null;
  let uploadedFile = null;

  try {
    if (!url) {
      return res.status(400).json({ error: '请提供 YouTube 视频链接' });
    }

    console.log('\n🎵 开始处理视频:', url);

    // ========== 第一步：获取视频元数据 ==========
    console.log('📋 Step 1: 获取视频元数据...');

    let metadata = {};
    try {
      const metaCommand = `${YT_DLP} --dump-json ${COOKIES_FLAG} --user-agent "${USER_AGENT}" "${url}"`;
      const { stdout: metaStdout } = await execAsync(metaCommand);
      const videoInfo = JSON.parse(metaStdout);

      metadata = {
        id: videoInfo.id,
        title: videoInfo.title,
        thumbnail: videoInfo.thumbnail,
        duration: videoInfo.duration,
        upload_date: videoInfo.upload_date,
      };

      // 检查 YouTube 原生章节
      if (videoInfo.chapters && videoInfo.chapters.length > 0) {
        metadata.chapters = videoInfo.chapters.map((chapter, index, arr) => ({
          title: chapter.title,
          start: formatTime(chapter.start_time),
          end: formatTime(
            chapter.end_time ||
            (arr[index + 1]?.start_time) ||
            videoInfo.duration
          ),
        }));
        console.log(`✅ 检测到 YouTube 原生章节: ${metadata.chapters.length} 个`);
      } else {
        console.log('ℹ️  该视频没有 YouTube 原生章节，将由 AI 生成');
      }

      console.log('✅ 元数据获取成功:', metadata.title);
    } catch (metaError) {
      console.warn('⚠️ 获取元数据失败，继续处理:', metaError.message);
    }

    // ========== 第二步：下载音频 ==========
    console.log('📥 Step 2: 下载音频...');

    const ytDlpCommand = `${YT_DLP} -f "ba" -x --audio-format mp3 ${COOKIES_FLAG} --user-agent "${USER_AGENT}" -o "${tempDir}/%(id)s.%(ext)s" "${url}"`;
    const { stdout, stderr } = await execAsync(ytDlpCommand);

    console.log('yt-dlp 输出:', stdout);
    if (stderr) console.log('yt-dlp 错误信息:', stderr);

    // 查找下载的文件
    const files = fs.readdirSync(tempDir).filter(f => f.endsWith('.mp3'));
    if (files.length === 0) {
      throw new Error('音频下载失败，未找到 mp3 文件');
    }

    localFilePath = path.join(tempDir, files[0]);
    console.log('✅ 音频下载成功:', localFilePath);

    // 检查文件大小
    const stats = fs.statSync(localFilePath);
    console.log(`📊 文件大小: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);

    // ========== 第三步：上传到 Gemini ==========
    console.log('☁️  Step 3: 上传音频到 Gemini...');

    uploadedFile = await fileManager.uploadFile(localFilePath, {
      mimeType: 'audio/mpeg',
      displayName: path.basename(localFilePath),
    });

    console.log('✅ 上传成功，文件 URI:', uploadedFile.file.uri);

    // ========== 第四步：等待文件处理完成 ==========
    console.log('⏳ Step 4: 等待文件处理...');

    let file = await fileManager.getFile(uploadedFile.file.name);
    while (file.state === 'PROCESSING') {
      await new Promise(resolve => setTimeout(resolve, 2000));
      file = await fileManager.getFile(uploadedFile.file.name);
      console.log('   状态:', file.state);
    }

    if (file.state !== 'ACTIVE') {
      throw new Error(`文件处理失败，状态: ${file.state}`);
    }

    console.log('✅ 文件处理完成');

    // ========== 第五步：AI 分析 ==========
    console.log('🤖 Step 5: AI 分析中...');

    const systemPrompt = `你是一个资深的语言学家和 AI 技术专家。请分析这段音频，并严格按照 JSON 格式输出：

segments: 将逐字稿按逻辑分段（不要太长，每段 2-4 句话）。你必须根据音频内容，精准标记每一句话的起止时间。
  - "en": 英文原文。
  - "cn": 对应地道的中文翻译。
  - "start": 开始时间 (格式为 "MM:SS", 例如 "00:15")
  - "end": 结束时间 (格式为 "MM:SS", 例如 "00:25")

chapters: 将音频按内容主题划分为逻辑章节，用于显示在进度条上。
  - "title": 章节标题（简洁明了，3-8 个字）
  - "start": 开始时间 (格式为 "MM:SS")
  - "end": 结束时间 (格式为 "MM:SS")
  - 分段规则：
    - 基于内容主题进行逻辑分段，每章应该是一个完整的话题或论点
    - 如果音频较长（超过 15 分钟），每章建议 5-15 分钟
    - 如果音频较短（15 分钟以内），按自然段落划分，通常 3-6 个章节
    - 章节之间时间必须连续，不能有间隙

red_list (高价值英语表达 - 严选):
  - 筛选标准: 提取高价值的英语表达，必须同时包含以下两类：
    1. 高级单词 (Advanced Vocabulary): C1/C2 难度、GRE/TOEFL 级别、学术性或极具表现力的单个单词。
    2. 地道短语 (Idioms/Phrases): 母语者常用的习语、搭配或口语化隐喻。
  - 正确示例: "nuance", "mitigate", "scrutinize", "leverage", "counterintuitive", "flesh out", "move the needle", "low hanging fruit"
  - 错误示例 (绝对不要选): 简单词汇如 "use", "good", "make", "problem", "task", "example"
  - 字段说明 (必须严格遵守):
    - word: 单词或短语原文
    - pronunciation: 音标（使用 IPA 国际音标）
    - definition_cn: 中文释义（必须解释它在当前语境下的言外之意或微妙语气，而不仅仅是字典定义）
    - example: 必须造一个全新的的英文例句来展示该单词的用法。严禁直接复制视频字幕中的原句。例句应通俗易懂，有助于初学者理解。
    - example_cn: 将上述新造的英文例句翻译成地道的中文。

blue_list (行业术语):
  - 提取 AI/Tech 领域的专业术语（如 "Context Window", "RAG", "Inference"）。
  - 字段: term, definition_cn

注意：不要生成全文摘要。输出必须是纯净的 JSON，不要包含 Markdown 标记。

**CRITICAL: Output MUST be a single, valid JSON object. DO NOT include any markdown formatting (like \`\`\`json), preamble, or postscript. Start directly with { and end with }.**`;

    const result = await model.generateContent([
      {
        fileData: {
          mimeType: uploadedFile.file.mimeType,
          fileUri: uploadedFile.file.uri,
        },
      },
      { text: systemPrompt },
    ]);

    const responseText = result.response.text();
    console.log('✅ AI 分析完成');
    console.log('📄 原始响应:', responseText.substring(0, 500) + '...');

    // 强化 JSON 清洗函数
    function cleanJsonResponse(text) {
      let cleaned = text.trim();
      cleaned = cleaned.replace(/^```(?:json)?\s*\n?/i, '');
      cleaned = cleaned.replace(/\n?```\s*$/i, '');
      cleaned = cleaned.trim();
      return cleaned;
    }

    // 清洗响应文本
    const jsonText = cleanJsonResponse(responseText);

    // 尝试解析 JSON，增强错误处理
    let analysisResult;
    try {
      analysisResult = JSON.parse(jsonText);
      console.log('✅ JSON 解析成功');
    } catch (parseError) {
      console.error('❌ JSON 解析失败！');
      console.error('解析错误:', parseError.message);
      console.error('------- 原始返回内容 (前 1000 字符) -------');
      console.error(responseText.substring(0, 1000));
      console.error('------- 清洗后内容 (前 1000 字符) -------');
      console.error(jsonText.substring(0, 1000));
      console.error('------------------------------------------');
      throw new Error(`JSON 解析失败: ${parseError.message}`);
    }

    // ========== 第六步：清理资源 ==========
    console.log('🧹 Step 6: 清理资源...');

    // 删除本地文件
    if (localFilePath && fs.existsSync(localFilePath)) {
      fs.unlinkSync(localFilePath);
      console.log('✅ 已删除本地文件');
    }

    // 删除云端文件
    if (uploadedFile) {
      await fileManager.deleteFile(uploadedFile.file.name);
      console.log('✅ 已删除云端文件');
    }

    // 处理 chapters：优先使用 YouTube 原生章节，否则使用 AI 生成的
    let finalChapters;
    if (metadata.chapters && metadata.chapters.length > 0) {
      finalChapters = metadata.chapters;
      console.log('📍 使用 YouTube 原生章节');
    } else if (analysisResult.chapters && analysisResult.chapters.length > 0) {
      finalChapters = analysisResult.chapters;
      console.log('📍 使用 AI 生成的章节');
    } else {
      finalChapters = [];
      console.log('⚠️ 未获取到章节信息');
    }

    // 返回结果（包含元数据和章节）
    res.json({
      success: true,
      data: {
        segments: analysisResult.segments,
        chapters: finalChapters,
        red_list: analysisResult.red_list,
        blue_list: analysisResult.blue_list,
      },
      metadata: metadata,
    });

    console.log('🎉 分析完成！\n');

  } catch (error) {
    console.error('\n❌ 处理失败:', error);

    // 清理资源（即使失败也要清理）
    try {
      if (localFilePath && fs.existsSync(localFilePath)) {
        fs.unlinkSync(localFilePath);
        console.log('🧹 已清理本地文件');
      }
      if (uploadedFile) {
        await fileManager.deleteFile(uploadedFile.file.name);
        console.log('🧹 已清理云端文件');
      }
    } catch (cleanupError) {
      console.error('清理资源时出错:', cleanupError.message);
    }

    res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack,
      details: 'Backend Error Log',
    });
  }
});

// ========== 文章 API ==========

// 获取所有文章 (主页用 - 过滤隐藏内容)
app.get('/api/articles', async (req, res) => {
  try {
    const articles = await Article.find({ isHidden: { $ne: true } })
      .sort({ createdAt: -1 })
      .lean();
    res.json({
      success: true,
      data: articles,
    });
  } catch (error) {
    console.error('❌ 获取文章列表失败:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// ========== 管理员 API ==========

// 获取所有文章 (管理员用 - 包含隐藏内容)
app.get('/api/admin/list', async (req, res) => {
  try {
    const articles = await Article.find()
      .sort({ createdAt: -1 })
      .lean();
    res.json({
      success: true,
      data: articles,
    });
  } catch (error) {
    console.error('❌ 获取管理员文章列表失败:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// 切换文章可见性
app.post('/api/admin/toggle-visibility', async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) {
      return res.status(400).json({
        success: false,
        error: '请提供文章 ID',
      });
    }

    const article = await Article.findOne({ id });

    if (!article) {
      return res.status(404).json({
        success: false,
        error: '文章不存在',
      });
    }

    // 切换 isHidden 状态
    article.isHidden = !article.isHidden;
    await article.save();

    console.log(`✅ 文章 ${id} 可见性已切换为: ${article.isHidden ? '隐藏' : '可见'}`);
    res.json({
      success: true,
      isHidden: article.isHidden,
    });
  } catch (error) {
    console.error('❌ 切换可见性失败:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// 删除文章
app.post('/api/admin/delete', async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) {
      return res.status(400).json({
        success: false,
        error: '请提供文章 ID',
      });
    }

    const article = await Article.findOneAndDelete({ id });

    if (!article) {
      return res.status(404).json({
        success: false,
        error: '文章不存在',
      });
    }

    console.log(`✅ 文章 ${id} 已删除`);

    // 尝试清理 temp 目录下的相关缓存文件
    const videoId = article.metadata?.id;
    if (videoId) {
      try {
        const possibleFiles = [
          path.join(tempDir, `${videoId}.mp3`),
          path.join(tempDir, `${videoId}.jpg`),
          path.join(tempDir, `${videoId}.png`),
        ];

        possibleFiles.forEach(filePath => {
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            console.log(`🧹 已清理缓存文件: ${filePath}`);
          }
        });
      } catch (cleanupError) {
        console.warn('⚠️ 清理缓存文件时出错:', cleanupError.message);
      }
    }

    res.json({
      success: true,
      message: '删除成功',
    });
  } catch (error) {
    console.error('❌ 删除文章失败:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// 保存文章
app.post('/api/articles', async (req, res) => {
  try {
    console.log('📥 收到保存请求，数据大小:', JSON.stringify(req.body).length);

    const articleData = req.body;

    if (!articleData) {
      return res.status(400).json({
        success: false,
        error: '请提供文章数据',
      });
    }

    // 创建新文章
    const newArticle = new Article({
      id: Date.now().toString(),
      ...articleData,
    });

    await newArticle.save();

    console.log('✅ 文章已保存到 MongoDB');

    res.json({ success: true, message: '保存成功' });

  } catch (error) {
    console.error('❌ 保存出错:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// 健康检查接口
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ========== SPA 回退路由（生产环境） ==========
if (isProduction) {
  app.get(/.*/, (req, res) => {
    res.sendFile(path.join(process.cwd(), 'dist', 'index.html'));
  });
}

// 启动服务器
const startServer = async () => {
  await connectDB();

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 后端服务器运行在 0.0.0.0:${PORT}`);
    console.log(`📁 临时文件目录: ${tempDir}`);
    console.log('✨ 音频多模态分析服务已就绪\n');
  });
};

startServer();
