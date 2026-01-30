import mongoose from 'mongoose';

// 字幕段落 Schema
const SegmentSchema = new mongoose.Schema({
  en: { type: String, required: true },
  cn: { type: String, required: true },
  start: { type: String, required: true },
  end: { type: String, required: true },
}, { _id: false });

// 章节 Schema
const ChapterSchema = new mongoose.Schema({
  title: { type: String, required: true },
  start: { type: String, required: true },
  end: { type: String, required: true },
}, { _id: false });

// 红色词汇表 (地道表达/高级词汇)
const RedListItemSchema = new mongoose.Schema({
  word: { type: String, required: true },
  pronunciation: String,
  definition_cn: String,
  example: String,
  example_cn: String,
}, { _id: false });

// 蓝色词汇表 (专业术语)
const BlueListItemSchema = new mongoose.Schema({
  term: { type: String, required: true },
  definition_cn: String,
}, { _id: false });

// 视频元数据 Schema
const MetadataSchema = new mongoose.Schema({
  id: { type: String, required: true }, // YouTube video ID
  title: String,
  thumbnail: String,
  duration: Number,
  upload_date: String,
  chapters: [ChapterSchema],
}, { _id: false });

// 主 Article Schema
const ArticleSchema = new mongoose.Schema({
  // 使用自定义 id 而非默认 _id（兼容旧数据）
  id: { type: String, required: true, unique: true, index: true },
  createdAt: { type: Date, default: Date.now },
  isHidden: { type: Boolean, default: false },

  // 内容数据
  segments: [SegmentSchema],
  chapters: [ChapterSchema],
  red_list: [RedListItemSchema],
  blue_list: [BlueListItemSchema],

  // 元数据
  metadata: MetadataSchema,

  // 分类标签
  categories: [{ type: String }],
}, {
  timestamps: true, // 自动添加 createdAt 和 updatedAt
  collection: 'articles',
});

// 创建索引
ArticleSchema.index({ createdAt: -1 });
ArticleSchema.index({ isHidden: 1 });

const Article = mongoose.model('Article', ArticleSchema);

export default Article;
