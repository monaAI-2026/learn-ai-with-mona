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
console.log('🔍 YOUTUBE_COOKIES 环境变量:', process.env.YOUTUBE_COOKIES ? `存在 (${process.env.YOUTUBE_COOKIES.length} 字符)` : '未设置');
console.log('🔍 cookies.txt 文件:', fs.existsSync(path.join(process.cwd(), 'cookies.txt')) ? '已存在' : '不存在');

if (!fs.existsSync(path.join(process.cwd(), 'cookies.txt')) && process.env.YOUTUBE_COOKIES) {
  fs.writeFileSync(path.join(process.cwd(), 'cookies.txt'), process.env.YOUTUBE_COOKIES);
  console.log('✅ 已从环境变量写入 cookies.txt');
} else if (!process.env.YOUTUBE_COOKIES) {
  console.warn('⚠️ 未检测到 YOUTUBE_COOKIES 环境变量，yt-dlp 将无 cookies 运行');
}

// ========== CORS 配置 ==========
app.use(cors({
  origin: (origin, callback) => {
    // 允许无 origin 的请求（curl、Postman、服务端调用等）
    if (!origin) return callback(null, true);

    const allowed =
      origin === 'http://localhost:5173' ||
      origin.startsWith('http://localhost:') ||
      origin.startsWith('http://192.168.') ||
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
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error('❌ 错误：请在 .env 文件中配置 GEMINI_API_KEY');
  process.exit(1);
}

const fileManager = new GoogleAIFileManager(apiKey);
const genAI = new GoogleGenerativeAI(apiKey);
const model = genAI.getGenerativeModel({ model: 'gemini-3-flash-preview' });

console.log('✅ Gemini API 初始化成功');

// 辅助函数：将秒数转换为 "MM:SS" 格式
function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// Mac Chrome User-Agent
const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// ========== 共用工具函数 ==========

function cleanJsonResponse(text) {
  let cleaned = text.trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*\n?/i, '');
  cleaned = cleaned.replace(/\n?```\s*$/i, '');
  return cleaned.trim();
}

// 将 VTT 时间戳（"HH:MM:SS.mmm"）转换为秒数
function vttTimeToSeconds(ts) {
  const clean = ts.trim().split(' ')[0];
  const match = clean.match(/(\d{2}):(\d{2}):(\d{2})[.,](\d{3})/);
  if (!match) return 0;
  return parseInt(match[1]) * 3600 + parseInt(match[2]) * 60 + parseInt(match[3]) + parseInt(match[4]) / 1000;
}

// 解析 VTT 内容，处理 YouTube 滚动窗口去重，输出句子级别条目
function parseVTT(vttContent) {
  const blocks = vttContent.split(/\n\n+/);
  const rawEntries = [];

  for (const block of blocks) {
    const lines = block.trim().split('\n');
    const tsLine = lines.find(l => /\d{2}:\d{2}:\d{2}[.,]\d{3}\s+-->\s+\d{2}:\d{2}:\d{2}[.,]\d{3}/.test(l));
    if (!tsLine) continue;

    const parts = tsLine.split('-->');
    const startTime = vttTimeToSeconds(parts[0].trim());
    const endTime = vttTimeToSeconds(parts[1].trim());

    const textLines = lines
      .filter(l => l !== tsLine && !/^\d+$/.test(l.trim()) && l.trim())
      .join(' ');

    const text = textLines
      .replace(/<\d{2}:\d{2}:\d{2}\.\d{3}>/g, '')
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/\s+/g, ' ')
      .trim();

    if (text) rawEntries.push({ startTime, endTime, text });
  }

  if (rawEntries.length === 0) return [];

  // 处理滚动窗口：提取每条 cue 相对上一条新增的文字
  const wordEntries = [];
  let prevText = '';

  for (const entry of rawEntries) {
    if (!prevText) {
      wordEntries.push(entry);
      prevText = entry.text;
      continue;
    }

    const prevWords = prevText.split(/\s+/);
    const currWords = entry.text.split(/\s+/);

    let overlapLen = 0;
    for (let len = Math.min(prevWords.length, currWords.length); len >= 1; len--) {
      const suffix = prevWords.slice(prevWords.length - len).join(' ').toLowerCase();
      const prefix = currWords.slice(0, len).join(' ').toLowerCase();
      if (suffix === prefix) { overlapLen = len; break; }
    }

    const newWords = currWords.slice(overlapLen).join(' ').trim();
    if (newWords) wordEntries.push({ ...entry, text: newWords });
    prevText = entry.text;
  }

  // 按句子边界（. ! ?）合并成完整句子
  const sentences = [];
  let buffer = '';
  let sentStart = null;
  let sentEnd = null;

  for (const entry of wordEntries) {
    if (sentStart === null) sentStart = entry.startTime;
    buffer = buffer ? buffer + ' ' + entry.text : entry.text;
    sentEnd = entry.endTime;

    if (/[.!?](\s|$)/.test(buffer)) {
      sentences.push({ en: buffer.trim(), start: formatTime(sentStart), end: formatTime(sentEnd) });
      buffer = '';
      sentStart = null;
      sentEnd = null;
    }
  }

  if (buffer.trim() && sentStart !== null) {
    sentences.push({ en: buffer.trim(), start: formatTime(sentStart), end: formatTime(sentEnd || sentStart) });
  }

  return sentences;
}

// 用 yt-dlp 下载字幕，返回 VTT 内容字符串；无字幕返回 null
async function downloadSubtitlesVTT(url, videoId) {
  const outputBase = path.join(tempDir, `sub_${videoId}`);
  const cmd = `${YT_DLP} --write-sub --write-auto-sub --sub-lang "en" --sub-format vtt --skip-download ${COOKIES_FLAG} --user-agent "${USER_AGENT}" --js-runtimes node -o "${outputBase}" "${url}"`;

  try {
    await execAsync(cmd);
  } catch (e) {
    // yt-dlp 无字幕时会非零退出，继续检查文件
  }

  const files = fs.readdirSync(tempDir);
  const vttFile = files.find(f => f.startsWith(`sub_${videoId}`) && f.endsWith('.vtt'));

  if (vttFile) {
    const content = fs.readFileSync(path.join(tempDir, vttFile), 'utf8');
    fs.unlinkSync(path.join(tempDir, vttFile));
    return content;
  }

  return null;
}

// 单批翻译：纠错英文 + 中文翻译（最多 50 句）
async function translateBatch(batch, videoTitle, signal) {
  // 只发英文原文，时间戳不需要 Gemini 处理
  const input = batch.map(s => s.en);

  const prompt = `输出要求：返回纯净的 JSON 数组，直接以 [ 开头、以 ] 结尾，不包含任何 Markdown 标记、前言或后记。

你是一个资深的翻译专家和 AI 技术专家。以下是从视频字幕提取的英文句子列表，请完成以下任务：

对每个输入句子进行翻译并纠正语音识别错误，返回与输入完全对应的列表。
  - 必须包含输入中的每一条（共 ${input.length} 条），顺序一致，不可遗漏、合并或拆分
  - "en"：纠正明显语音识别错误后的英文（仅改错词，保持句子结构）
  - "cn"：地道的中文翻译（见下方翻译规范）

翻译规范：
  - 面向中国 AI 从业者，语言简洁，符合科技媒体阅读习惯
  - AI、LLM 等已普及词汇直接使用
  - 其他 AI 术语保留英文并首次出现时加括号注释，例如：fine-tuning（微调）
  - 其余词汇翻译成地道中文

视频标题：${videoTitle}

输入数据（共 ${input.length} 条，必须全部输出）：
${JSON.stringify(input)}`;

  const textModel = genAI.getGenerativeModel({ model: 'gemini-3-flash-preview' });

  const result = await textModel.generateContent(prompt, { signal });
  return result.response.text();
}

// 生成章节、问题、测验（使用纠错后英文）
async function generateStructure(correctedSentences, videoTitle, signal) {
  // 只发 start/end/en，cn 对章节/测验生成无用
  const transcriptInput = correctedSentences.map(s => ({ start: s.start, end: s.end, en: s.en }));

  const prompt = `输出要求：返回纯净的 JSON 对象，直接以 { 开头、以 } 结尾，不包含任何 Markdown 标记、前言或后记。

你是一个资深的翻译专家和 AI 技术专家。以下是视频字幕文本（纠错后的英文），请完成以下任务：

chapters：基于字幕全文，按内容主题划分逻辑章节，用于显示在进度条上。
  - "title"：不超过 12 个字，直接描述核心内容，禁止冒号格式，禁止"第一部分"等标签
  - "start" / "end"：格式 "MM:SS"，必须与某个 segment 的时间对齐
  - 数量限制：5 到 8 个之间
  - 时长限制：任何单章不得超过视频总时长的 20%
  - 章节时间必须连续，不能有间隙

example_questions：生成 3 个启发性问题，帮助用户深入探索视频内容。
  - 中文，开放式，具体，不超过 25 字
  - 覆盖概念理解和延伸思考两种类型
  - 输出为字符串数组

quiz：生成 5 道选择题，测验用户对视频核心内容的理解。
  - "question"：题目（中文，不超过 30 字）
  - "options"：4 个选项（中文字符串数组，不含 A/B/C/D 前缀）
  - "answer"：正确答案的索引（0-3 的整数）
  - "explanation"：解析（中文，2-3 句话）

视频标题：${videoTitle}

输入字幕数据（共 ${correctedSentences.length} 条）：
${JSON.stringify(transcriptInput)}`;

  const textModel = genAI.getGenerativeModel({ model: 'gemini-3-flash-preview' });

  const result = await textModel.generateContent(prompt, { signal });
  return result.response.text();
}

// Gemini 文本分析：分批翻译 + 串行生成章节/问题/测验
async function geminiTextAnalysis(sentences, videoTitle, signal) {
  const BATCH_SIZE = 50;
  const CONCURRENCY = 3;
  const MAX_RETRIES = 3;

  // 拆批，每批记录起始全局索引 startIndex，发给 Gemini 的数据不含全局 i
  const batches = [];
  for (let i = 0; i < sentences.length; i += BATCH_SIZE) {
    batches.push({
      startIndex: i,
      items: sentences.slice(i, i + BATCH_SIZE).map(s => ({ start: s.start, end: s.end, en: s.en })),
    });
  }
  console.log(`📦 共 ${sentences.length} 句，分 ${batches.length} 批（每批最多 ${BATCH_SIZE} 句），并发数 ${CONCURRENCY}`);

  // 判断是否为限流错误
  const is429 = (err) =>
    err.status === 429 ||
    err.message?.includes('429') ||
    err.message?.includes('RESOURCE_EXHAUSTED') ||
    err.message?.includes('quota');

  // 单批翻译（带重试）
  async function runBatchWithRetry(batch, batchIndex) {
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const responseText = await translateBatch(batch.items, videoTitle, signal);
        const result = JSON.parse(cleanJsonResponse(responseText));

        if (!Array.isArray(result) || result.length !== batch.items.length) {
          throw new Error(`返回数量不符：期望 ${batch.items.length}，实际 ${result.length}`);
        }

        console.log(`✅ 批次 ${batchIndex + 1}/${batches.length} 完成`);
        return result;
      } catch (err) {
        const waitSecs = is429(err) ? Math.pow(2, attempt + 2) : Math.pow(2, attempt);
        if (attempt < MAX_RETRIES - 1) {
          console.warn(`⚠️ 批次 ${batchIndex + 1} 第 ${attempt + 1} 次失败${is429(err) ? '（限流）' : ''}，${waitSecs}s 后重试...`);
          await new Promise(r => setTimeout(r, waitSecs * 1000));
        } else {
          throw new Error(`批次 ${batchIndex + 1} 重试耗尽: ${err.message}`);
        }
      }
    }
  }

  // Step 1：分批翻译，每次最多 CONCURRENCY 批并发
  const allSegments = new Array(sentences.length);
  for (let i = 0; i < batches.length; i += CONCURRENCY) {
    const chunk = batches.slice(i, i + CONCURRENCY);
    const chunkResults = await Promise.all(
      chunk.map((batch, j) => runBatchWithRetry(batch, i + j))
    );
    // 用 Promise.all 保证的顺序 + 批次起始位置自己算全局索引
    // 时间戳强制用原始 VTT 数据，不信任 Gemini 返回的任何时间值
    chunkResults.forEach((batchResult, j) => {
      const batch = chunk[j];
      batchResult.forEach((item, k) => {
        allSegments[batch.startIndex + k] = {
          en: item.en,
          cn: item.cn,
          start: batch.items[k].start,
          end: batch.items[k].end,
        };
      });
    });
    console.log(`📊 翻译进度：${Math.min(i + CONCURRENCY, batches.length)}/${batches.length} 批完成`);
  }
  console.log(`✅ 全部翻译完成，共 ${allSegments.length} 句`);

  // Step 2：用纠错后英文串行生成章节/问题/测验
  console.log('🤖 开始生成章节、问题、测验...');
  let structureResult;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const responseText = await generateStructure(allSegments, videoTitle, signal);
      structureResult = JSON.parse(cleanJsonResponse(responseText));
      console.log('✅ 章节/测验生成完成');
      break;
    } catch (err) {
      const waitSecs = is429(err) ? Math.pow(2, attempt + 2) : Math.pow(2, attempt);
      if (attempt < MAX_RETRIES - 1) {
        console.warn(`⚠️ 章节/测验第 ${attempt + 1} 次失败${is429(err) ? '（限流）' : ''}，${waitSecs}s 后重试...`);
        await new Promise(r => setTimeout(r, waitSecs * 1000));
      } else {
        throw new Error(`章节/测验生成失败: ${err.message}`);
      }
    }
  }

  // 合并返回（保持与旧接口一致：返回 JSON 字符串）
  return JSON.stringify({
    segments: allSegments,
    chapters: structureResult.chapters,
    example_questions: structureResult.example_questions,
    quiz: structureResult.quiz,
  });
}

// ========== yt-dlp 路径与 cookies 配置 ==========
const YT_DLP = isProduction ? path.join(process.cwd(), 'bin', 'yt-dlp') : '/opt/homebrew/bin/yt-dlp';

// 优先使用浏览器 cookies（更新鲜），生产环境才用 cookies.txt
const cookiesPath = path.join(process.cwd(), 'cookies.txt');
const hasCookiesFile = fs.existsSync(cookiesPath);
const COOKIES_FLAG = isProduction && hasCookiesFile
  ? `--cookies "${cookiesPath}"`
  : '--cookies-from-browser chrome';

// 核心分析接口
app.post('/analyze', async (req, res) => {
  // 设置超长超时时间 (2 小时 = 7200000 ms)
  // 因为视频分析涉及下载、上传、AI 处理，可能需要很长时间
  req.setTimeout(7200000);  // 2 小时
  res.setTimeout(7200000);  // 2 小时

  // 设置 Keep-Alive 响应头，防止代理断开连接
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Keep-Alive', 'timeout=7200');

  const { url } = req.body;
  let localFilePath = null;
  let uploadedFile = null;

  // 创建取消控制器，客户端关闭窗口时中止所有 Gemini 请求
  const controller = new AbortController();
  const { signal } = controller;
  let responseSent = false;
  req.on('close', () => {
    if (!responseSent) {
      controller.abort();
      console.log('🚫 客户端断开连接，已取消所有进行中的 Gemini 请求');
    }
  });

  try {
    if (!url) {
      return res.status(400).json({ error: '请提供 YouTube 视频链接' });
    }

    console.log('\n🎵 ========== [1/6] 开始处理视频 ==========');
    console.log('📎 视频链接:', url);
    console.log('⏰ 开始时间:', new Date().toLocaleString('zh-CN'));

    // ========== 第一步：获取视频元数据 ==========
    console.log('\n📋 ========== [2/6] 获取视频元数据 ==========');
    console.log('⏳ 正在获取，预计需要 2-5 秒...');

    let metadata = {};
    try {
      const metaCommand = `${YT_DLP} --dump-json ${COOKIES_FLAG} --user-agent "${USER_AGENT}" --js-runtimes node "${url}"`;
      const { stdout: metaStdout } = await execAsync(metaCommand);
      const videoInfo = JSON.parse(metaStdout);

      metadata = {
        id: videoInfo.id,
        title: videoInfo.title,
        thumbnail: videoInfo.thumbnail,
        duration: videoInfo.duration,
        upload_date: videoInfo.upload_date,
      };


      console.log('✅ 元数据获取成功！');
      console.log('📺 标题:', metadata.title);
      console.log('⏱️  时长:', Math.floor(metadata.duration / 60), '分钟');
      console.log('🆔 视频ID:', metadata.id);
    } catch (metaError) {
      console.warn('⚠️ 获取元数据失败，继续处理:', metaError.message);
    }

    // ========== 第二步：尝试下载字幕（字幕优先路径）==========
    console.log('\n📝 ========== [2/4] 尝试下载字幕 ==========');

    let analysisResult = null;

    try {
      const vttContent = await downloadSubtitlesVTT(url, metadata.id || `tmp_${Date.now()}`);

      if (vttContent) {
        const sentences = parseVTT(vttContent);
        console.log(`✅ 字幕解析成功，共 ${sentences.length} 个句子`);

        if (sentences.length >= 5) {
          // ========== 第三步：Gemini 文本分析 ==========
          console.log('\n🤖 ========== [3/4] AI 文本分析（字幕路径）==========');
          console.log(`📄 输入：${sentences.length} 个句子`);
          console.log('⏳ 正在翻译并生成章节、问题、测验...');
          console.log('⏰ 开始时间:', new Date().toLocaleString('zh-CN'));

          const responseText = await geminiTextAnalysis(sentences, metadata.title || '', signal);
          console.log('\n✅ Gemini 文本分析完成！');
          console.log('⏰ 完成时间:', new Date().toLocaleString('zh-CN'));

          const jsonText = cleanJsonResponse(responseText);

          try {
            analysisResult = JSON.parse(jsonText);
            console.log('✅ JSON 解析成功！');
            console.log(`📊 字幕段数: ${analysisResult.segments?.length || 0}，章节数: ${analysisResult.chapters?.length || 0}`);
          } catch (parseError) {
            console.error('❌ JSON 解析失败:', parseError.message);
            console.error('原始响应前 500 字符:', responseText.substring(0, 500));
            throw new Error(`JSON 解析失败: ${parseError.message}`);
          }
        } else {
          console.log(`⚠️ 字幕句子数量不足（${sentences.length}）`);
          return res.status(400).json({ success: false, error: '该视频字幕内容过少，无法分析，请换一个视频试试。' });
        }
      } else {
        console.log('⚠️ 未找到英文字幕');
        return res.status(400).json({ success: false, error: '该视频没有英文字幕，暂不支持分析。' });
      }
    } catch (subtitleError) {
      console.log('❌ 字幕分析失败:', subtitleError.message);
      return res.status(503).json({ success: false, error: `分析失败，请稍后重试。（${subtitleError.message}）` });
    }

    // ========== 第六步：清理资源 ==========
    console.log('\n🧹 ========== [6/6] 清理资源 ==========');

    // 删除本地文件
    if (localFilePath && fs.existsSync(localFilePath)) {
      fs.unlinkSync(localFilePath);
      console.log('✅ 已删除本地文件:', localFilePath);
    }

    // 删除云端文件
    if (uploadedFile) {
      await fileManager.deleteFile(uploadedFile.file.name);
      console.log('✅ 已删除云端文件:', uploadedFile.file.name);
    }

    // 使用 AI 生成的章节，补全缺失的 end 字段
    const rawChapters = analysisResult.chapters || [];
    const finalChapters = rawChapters.map((ch, i) => ({
      ...ch,
      end: ch.end || rawChapters[i + 1]?.start || ch.start,
    }));
    console.log('📍 使用 AI 生成的章节:', finalChapters.length, '个');

    // 返回结果（包含元数据和章节）
    responseSent = true;
    res.json({
      success: true,
      data: {
        segments: analysisResult.segments,
        chapters: finalChapters,
        example_questions: analysisResult.example_questions || [],
        quiz: analysisResult.quiz || [],
      },
      metadata: metadata,
    });

    console.log('\n🎉 ========== 处理完成，返回结果 ==========');
    console.log('✅ 所有步骤已完成');
    console.log('📤 正在返回结果给前端...\n');

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

// ========== Chat API ==========
app.post('/chat', async (req, res) => {
  const { message, transcript, videoTitle, history } = req.body;

  if (!message) {
    return res.status(400).json({ success: false, error: '缺少消息内容' });
  }

  try {
    const chatModel = genAI.getGenerativeModel({
      model: 'gemini-3-flash-preview',
      systemInstruction: `你是一个专业的学习助手，帮助用户深入理解视频内容。当前视频标题："${videoTitle}"。

以下是视频的完整文字记录（英文原文）：

${transcript}

请基于以上视频内容回答用户的问题，帮助他们学习和理解视频中的知识点。回答要简洁清晰，用中文回复。如果问题超出视频内容范围，可适当补充背景知识并注明。`,
    });

    const chat = chatModel.startChat({ history: history || [] });
    const result = await chat.sendMessage(message);

    res.json({ success: true, response: result.response.text() });
  } catch (error) {
    console.error('❌ Chat 错误:', error);
    res.status(500).json({ success: false, error: error.message });
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

// 调试接口：检查 cookies.txt 状态
app.get('/debug/cookies', (req, res) => {
  const cPath = path.join(process.cwd(), 'cookies.txt');
  const exists = fs.existsSync(cPath);
  if (!exists) return res.json({ exists: false });
  const content = fs.readFileSync(cPath, 'utf-8');
  const lines = content.split('\n');
  res.json({
    exists: true,
    lineCount: lines.length,
    firstLine: lines[0],
    nonEmptyLines: lines.filter(l => l.trim() && !l.startsWith('#')).length,
    preview: lines.slice(0, 3).join('\n'),
  });
});

// 调试接口：检查 yt-dlp 版本和路径
app.get('/debug/yt-dlp', async (req, res) => {
  try {
    const { stdout: version } = await execAsync(`${YT_DLP} --version`);
    const { stdout: which } = await execAsync(`ls -la ${YT_DLP}`);
    res.json({ version: version.trim(), path: which.trim() });
  } catch (error) {
    res.json({ error: error.message });
  }
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

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 后端服务器运行在 0.0.0.0:${PORT}`);
    console.log(`📁 临时文件目录: ${tempDir}`);
    console.log('✨ 音频多模态分析服务已就绪\n');
  });

  // 设置服务器级别的超时时间为 2 小时
  // 这对于长时间运行的视频分析任务是必需的
  server.timeout = 7200000;           // 2 小时 (7200000ms)
  server.keepAliveTimeout = 7200000;  // 2 小时
  server.headersTimeout = 7210000;    // 稍长于 keepAliveTimeout

  console.log('⚙️  服务器超时配置:');
  console.log('   - timeout: 2 小时');
  console.log('   - keepAliveTimeout: 2 小时');
  console.log('   - 支持长时间视频分析\n');
};

startServer();
