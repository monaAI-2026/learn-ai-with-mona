import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { GoogleAIFileManager } from '@google/generative-ai/server';

// 加载环境变量
dotenv.config();

const execAsync = promisify(exec);
const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// 确保 temp 目录存在
const tempDir = path.join(process.cwd(), 'temp');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
  console.log('✅ 已创建 temp 目录');
}

// ========== 数据库配置 ==========
const dbDir = path.join(process.cwd(), 'db');
const dbPath = path.join(dbDir, 'articles.json');

// 确保 db 目录存在
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
  console.log('✅ 已创建 db 目录');
}

// 初始化数据库文件
if (!fs.existsSync(dbPath)) {
  fs.writeFileSync(dbPath, JSON.stringify([], null, 2));
  console.log('✅ 已创建 articles.json 数据库');
}

// 数据库辅助函数
function readDb() {
  try {
    const data = fs.readFileSync(dbPath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('❌ 读取数据库失败:', error.message);
    return [];
  }
}

function writeDb(data) {
  try {
    fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error('❌ 写入数据库失败:', error.message);
    return false;
  }
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
      const metaCommand = `yt-dlp --dump-json --cookies-from-browser chrome "${url}"`;
      const { stdout: metaStdout } = await execAsync(metaCommand);
      const videoInfo = JSON.parse(metaStdout);

      metadata = {
        id: videoInfo.id,
        title: videoInfo.title,
        thumbnail: videoInfo.thumbnail,
        duration: videoInfo.duration,
        upload_date: videoInfo.upload_date,
      };

      console.log('✅ 元数据获取成功:', metadata.title);
    } catch (metaError) {
      console.warn('⚠️ 获取元数据失败，继续处理:', metaError.message);
    }

    // ========== 第二步：下载音频 ==========
    console.log('📥 Step 2: 下载音频...');

    const ytDlpCommand = `yt-dlp -f "ba" -x --audio-format mp3 --cookies-from-browser chrome -o "${tempDir}/%(id)s.%(ext)s" "${url}"`;
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

segments: 将逐字稿按逻辑分段（不要太长，每段 2-4 句话）。
  - "en": 英文原文。
  - "cn": 对应地道的中文翻译。

red_list (高价值英语表达 - 严选):
  - 筛选标准: 提取高价值的英语表达，必须同时包含以下两类：
    1. 高级单词 (Advanced Vocabulary): C1/C2 难度、GRE/TOEFL 级别、学术性或极具表现力的单个单词。
    2. 地道短语 (Idioms/Phrases): 母语者常用的习语、搭配或口语化隐喻。
  - 正确示例: "nuance", "mitigate", "scrutinize", "leverage", "counterintuitive", "flesh out", "move the needle", "low hanging fruit"
  - 错误示例 (绝对不要选): 简单词汇如 "use", "good", "make", "problem", "task", "example"
  - 字段: word, pronunciation, definition_cn, example
  - 解释风格: "definition_cn" 必须解释它在当前语境下的言外之意或微妙语气，而不仅仅是字典定义。

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

      // 使用正则表达式移除所有可能的 markdown 代码块标记
      // 匹配 ```json 或 ``` 开头和结尾
      cleaned = cleaned.replace(/^```(?:json)?\s*\n?/i, '');
      cleaned = cleaned.replace(/\n?```\s*$/i, '');

      // 移除首尾的所有空白字符（包括换行、制表符等）
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

    // 返回结果（包含元数据）
    res.json({
      success: true,
      data: analysisResult,
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
    });
  }
});

// ========== 文章 API ==========

// 获取所有文章
app.get('/api/articles', (req, res) => {
  try {
    const articles = readDb();
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

// 保存文章
app.post('/api/articles', (req, res) => {
  try {
    // 📥 收到请求时打印
    console.log('📥 收到保存请求，数据大小:', JSON.stringify(req.body).length);

    const articleData = req.body;

    if (!articleData) {
      return res.status(400).json({
        success: false,
        error: '请提供文章数据',
      });
    }

    // 生成唯一 ID
    const newArticle = {
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
      ...articleData,
    };

    // 使用绝对路径读取数据库
    const dbFilePath = path.join(process.cwd(), 'db', 'articles.json');
    let currentData = [];

    try {
      const fileContent = fs.readFileSync(dbFilePath, 'utf-8');
      currentData = JSON.parse(fileContent);
    } catch (readError) {
      console.warn('⚠️ 读取数据库文件失败，将创建新文件:', readError.message);
      currentData = [];
    }

    // 📖 读取数据库后打印
    console.log('📖 读取数据库成功，现有文章数:', currentData.length);

    // 将新文章追加到头部
    currentData.unshift(newArticle);

    // 💾 准备写入时打印
    console.log('💾 正在写入文件...');

    // 使用绝对路径写入数据库
    fs.writeFileSync(dbFilePath, JSON.stringify(currentData, null, 2));

    // ✅ 写入完成后打印
    console.log('✅ 写入完成！');

    // 返回成功响应
    res.json({ success: true, message: '保存成功' });

  } catch (error) {
    // ❌ 错误捕获
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

app.listen(PORT, () => {
  console.log(`\n🚀 后端服务器运行在 http://localhost:${PORT}`);
  console.log(`📁 临时文件目录: ${tempDir}`);
  console.log('✨ 音频多模态分析服务已就绪\n');
});
