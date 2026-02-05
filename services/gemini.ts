/**
 * ⚠️ NOTE: This file is currently NOT USED in the application.
 * The app uses backend API calls (server.js) instead of direct frontend Gemini calls.
 * Kept as reference/backup code for potential future frontend-direct implementation.
 *
 * If you want to use this, change VITE_GOOGLE_API_KEY to VITE_GEMINI_API_KEY
 * and add it to your .env file.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

const apiKey = import.meta.env.VITE_GOOGLE_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey);

const SYSTEM_PROMPT = `你是一个专业的 AI 领域英语学习助手。你的任务是分析视频字幕,帮助用户深入理解 AI 技术并积累地道表达。

请对输入的字幕文本进行分析,并严格以纯 JSON 格式返回结果(不要使用 Markdown 代码块)。

处理要求:

English (content_en): 对原始字幕进行标点校正和断句优化(不要篡改原意)。关键步骤:在文本中直接嵌入 XML 标签:

将"通用英语高频难词/地道表达"用 <red>...</red> 包裹。

将"AI 专业术语/产品/机构"用 <blue>...</blue> 包裹。

Chinese (content_cn): 提供地道、流畅的中文翻译,符合科技圈阅读习惯。

Red Words (red_list): 提取被 <red> 标记的词汇。筛选标准:排除简单词(A1-B1),只选高频动词搭配、习语、逻辑连接词。

字段: word (原词), phonetic (音标), pos (词性), explanation (轻松有趣的中文用法说明,如朋友间的提示,不包含"Mona"字样)。

Blue Words (blue_list): 提取被 <blue> 标记的术语。

字段: term (术语名), tag (如 [Concept], [Model], [Person]), explanation (通俗易懂的专业解释)。

JSON 结构定义: { "content_en": "string with <red> and <blue> tags", "content_cn": "string", "red_list": [ { "word": "...", "phonetic": "...", "pos": "...", "explanation": "..." } ], "blue_list": [ { "term": "...", "tag": "...", "explanation": "..." } ] }`;

export async function analyzeTranscript(text: string) {
  try {
    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      systemInstruction: SYSTEM_PROMPT
    });

    const result = await model.generateContent(text);
    const response = result.response;
    const rawText = response.text();

    console.log('Gemini 原始响应:', rawText);

    // 尝试解析 JSON
    let jsonText = rawText.trim();

    // 移除可能的 Markdown 代码块标记
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.replace(/```json\n?/, '').replace(/\n?```$/, '');
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/```\n?/, '').replace(/\n?```$/, '');
    }

    const parsedData = JSON.parse(jsonText);

    return parsedData;

  } catch (error) {
    console.error('Gemini 分析失败:', error);
    throw new Error(`分析字幕失败: ${error instanceof Error ? error.message : '未知错误'}`);
  }
}
