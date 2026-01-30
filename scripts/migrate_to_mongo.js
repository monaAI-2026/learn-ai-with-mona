/**
 * 数据迁移脚本：从本地 JSON 迁移到 MongoDB
 *
 * 使用方法：
 * 1. 确保 .env 文件中配置了 MONGODB_URI
 * 2. 运行: node scripts/migrate_to_mongo.js
 */

import dotenv from 'dotenv';
import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// 获取当前文件目录
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 加载环境变量
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// 导入 Article 模型
import Article from '../models/Article.js';

const migrate = async () => {
  console.log('🚀 开始数据迁移...\n');

  // 检查 MongoDB URI
  if (!process.env.MONGODB_URI) {
    console.error('❌ 错误：请在 .env 文件中配置 MONGODB_URI');
    process.exit(1);
  }

  // 连接 MongoDB
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB 连接成功');
  } catch (error) {
    console.error('❌ MongoDB 连接失败:', error.message);
    process.exit(1);
  }

  // 读取本地 JSON 文件
  const dbPath = path.join(__dirname, '..', 'db', 'articles.json');

  if (!fs.existsSync(dbPath)) {
    console.error('❌ 找不到本地数据库文件:', dbPath);
    await mongoose.disconnect();
    process.exit(1);
  }

  let articles;
  try {
    const data = fs.readFileSync(dbPath, 'utf-8');
    articles = JSON.parse(data);
    console.log(`📖 读取到 ${articles.length} 篇文章\n`);
  } catch (error) {
    console.error('❌ 读取本地数据库失败:', error.message);
    await mongoose.disconnect();
    process.exit(1);
  }

  // 迁移统计
  let successCount = 0;
  let skipCount = 0;
  let errorCount = 0;

  // 逐条迁移
  for (const article of articles) {
    try {
      // 检查是否已存在（通过 id 判断）
      const existing = await Article.findOne({ id: article.id });

      if (existing) {
        console.log(`⏭️  跳过 (已存在): ${article.metadata?.title || article.id}`);
        skipCount++;
        continue;
      }

      // 创建新文档
      const newArticle = new Article({
        id: article.id,
        createdAt: article.createdAt || new Date(),
        isHidden: article.isHidden || false,
        segments: article.segments || [],
        chapters: article.chapters || [],
        red_list: article.red_list || [],
        blue_list: article.blue_list || [],
        metadata: article.metadata || {},
        categories: article.categories || [],
      });

      await newArticle.save();
      console.log(`✅ 已迁移: ${article.metadata?.title || article.id}`);
      successCount++;

    } catch (error) {
      console.error(`❌ 迁移失败 (${article.id}):`, error.message);
      errorCount++;
    }
  }

  // 输出统计结果
  console.log('\n========== 迁移完成 ==========');
  console.log(`✅ 成功: ${successCount} 篇`);
  console.log(`⏭️  跳过: ${skipCount} 篇`);
  console.log(`❌ 失败: ${errorCount} 篇`);
  console.log('================================\n');

  // 断开连接
  await mongoose.disconnect();
  console.log('🔌 已断开 MongoDB 连接');
};

// 执行迁移
migrate().catch(error => {
  console.error('迁移过程出错:', error);
  process.exit(1);
});
