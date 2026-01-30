import React, { useState, useEffect } from 'react';
import { Trash2, Eye, EyeOff, Plus, X } from 'lucide-react';
import type { Category } from '../types';

interface HighlightItem {
  text: string;
  type?: 'word' | 'phrase';
}

interface Segment {
  en: string;
  cn: string;
  word?: string;  // 单个高亮词（兼容旧数据）
  highlights?: HighlightItem[];  // 多个高亮项
}

interface AnalysisResult {
  segments: Segment[];
  red_list: Array<{
    word: string;
    pronunciation: string;
    definition_cn: string;
    example: string;
  }>;
  blue_list: Array<{
    term: string;
    definition_cn: string;
  }>;
}

interface VideoMetadata {
  videoId: string;
  title: string;
  thumbnail: string;
  duration: string;
}

interface VideoItem {
  id: string;
  createdAt: string;
  isHidden?: boolean;
  metadata?: {
    id: string;
    title: string;
    thumbnail: string;
  };
}

type FilterType = 'all' | 'published' | 'hidden';

const CATEGORIES: Category[] = ['Product', 'Founder Interview', 'Technical', 'Tutorial', 'AI News'];

// API Base URL - 支持环境变量配置
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// 高亮渲染辅助函数
const renderSentence = (segment: Segment): React.ReactNode => {
  const { en, word, highlights } = segment;

  // 收集所有需要高亮的项
  const allHighlights: HighlightItem[] = [];

  if (highlights && highlights.length > 0) {
    allHighlights.push(...highlights);
  } else if (word) {
    // 兼容旧数据：单个 word 作为红色高亮
    allHighlights.push({ text: word, type: 'word' });
  }

  if (allHighlights.length === 0) {
    return en;
  }

  // 构建正则表达式匹配所有高亮词
  const escapedTexts = allHighlights.map(h =>
    h.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  );
  const regex = new RegExp(`(${escapedTexts.join('|')})`, 'gi');

  const parts = en.split(regex);

  return parts.map((part, index) => {
    // 查找匹配的高亮项
    const matchedHighlight = allHighlights.find(
      h => h.text.toLowerCase() === part.toLowerCase()
    );

    if (matchedHighlight) {
      const colorClass = matchedHighlight.type === 'phrase'
        ? 'text-blue-600 font-bold'
        : 'text-rose-600 font-bold';
      return (
        <span key={index} className={colorClass}>
          {part}
        </span>
      );
    }
    return part;
  });
};

// VideoInputModal 组件
interface VideoInputModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAnalyze: (url: string) => void;
  loading: boolean;
  error: string | null;
}

const VideoInputModal: React.FC<VideoInputModalProps> = ({
  isOpen,
  onClose,
  onAnalyze,
  loading,
  error,
}) => {
  const [url, setUrl] = useState('');

  // 每次弹窗打开时清空输入框和错误信息
  useEffect(() => {
    if (isOpen) {
      setUrl('');
    }
  }, [isOpen]);

  const handleSubmit = () => {
    if (url.trim()) {
      onAnalyze(url);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !loading) {
      handleSubmit();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
        {/* Header (无标题，仅关闭按钮) */}
        <div className="flex justify-end items-center px-4 py-2 border-b border-gray-100">
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-gray-100 transition-colors"
          >
            <X size={20} className="text-gray-400 hover:text-gray-600" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-10 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              YouTube 视频链接
            </label>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="https://www.youtube.com/watch?v=..."
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50"
              disabled={loading}
              autoFocus
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-600 text-sm">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end px-6 py-4 bg-gray-50">
          <button
            onClick={handleSubmit}
            disabled={loading || !url.trim()}
            className={`px-5 py-2.5 rounded-xl font-medium transition-all duration-200 ${
              loading || !url.trim()
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-blue-500 hover:bg-blue-600 text-white shadow-lg shadow-blue-500/25'
            }`}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                分析中...
              </span>
            ) : (
              '开始分析'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

// 视频卡片组件
interface VideoCardProps {
  video: VideoItem;
  onToggleVisibility: (id: string) => void;
  onDelete: (id: string, title: string) => void;
  formatDate: (date: string) => string;
}

const VideoCard: React.FC<VideoCardProps> = ({
  video,
  onToggleVisibility,
  onDelete,
  formatDate,
}) => {
  return (
    <div
      className={`group flex flex-col bg-white rounded-2xl shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden border border-gray-100 ${
        video.isHidden ? 'opacity-60' : ''
      }`}
    >
      {/* Thumbnail */}
      <div className="relative h-40 bg-gray-100 overflow-hidden flex-shrink-0">
        {video.metadata?.thumbnail ? (
          <img
            src={video.metadata.thumbnail}
            alt={video.metadata?.title || '视频'}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400">
            <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </div>
        )}

        {/* Hidden Badge */}
        {video.isHidden && (
          <div className="absolute top-2 left-2 bg-gray-900/70 text-white text-xs px-2 py-1 rounded-lg">
            已隐藏
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex flex-col flex-1 p-4">
        {/* Title - 固定高度，保证对齐 */}
        <h3
          className="font-medium text-gray-800 line-clamp-2 overflow-hidden text-ellipsis leading-snug h-[3rem]"
          title={video.metadata?.title || '未知标题'}
        >
          {video.metadata?.title || '未知标题'}
        </h3>

        {/* Info & Actions Row */}
        <div className="flex items-center justify-between mt-auto pt-3">
          <span className="text-sm text-gray-500 mb-0">
            {formatDate(video.createdAt)}
          </span>

          {/* Action Buttons */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => onToggleVisibility(video.id)}
              className={`p-2 rounded-lg transition-colors ${
                video.isHidden
                  ? 'text-gray-400 hover:text-blue-500 hover:bg-blue-50'
                  : 'text-blue-500 hover:text-blue-600 hover:bg-blue-50'
              }`}
              title={video.isHidden ? '点击显示' : '点击隐藏'}
            >
              {video.isHidden ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
            <button
              onClick={() =>
                onDelete(video.id, video.metadata?.title || '未知视频')
              }
              className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
              title="删除"
            >
              <Trash2 size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// 添加卡片组件
interface AddCardProps {
  onClick: () => void;
}

const AddCard: React.FC<AddCardProps> = ({ onClick }) => {
  return (
    <div
      onClick={onClick}
      className="group relative flex flex-col items-center justify-center h-full min-h-[240px] bg-white border border-gray-200 rounded-xl cursor-pointer transition-all duration-300 hover:scale-[1.02] hover:shadow-lg"
    >
      <div className="w-16 h-16 rounded-full bg-[#EEF2FF] flex items-center justify-center mb-4">
        <Plus className="w-8 h-8 text-[#4F46E5]" />
      </div>
      <span className="text-lg font-medium text-gray-900">添加视频</span>
    </div>
  );
};

// 分析结果面板组件（带Tab分页）
interface AnalysisResultPanelProps {
  result: AnalysisResult;
  category: Category;
  setCategory: (cat: Category) => void;
  isSaving: boolean;
  onSave: () => void;
  onClose: () => void;
}

const AnalysisResultPanel: React.FC<AnalysisResultPanelProps> = ({
  result,
  category,
  setCategory,
  isSaving,
  onSave,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'transcript' | 'vocabulary'>('transcript');

  return (
    <div className="fixed inset-0 z-50 overflow-auto bg-gray-900/50 backdrop-blur-sm">
      <div className="min-h-screen flex items-start justify-center py-8 px-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden">
          {/* Result Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50">
            <h2 className="text-xl font-semibold text-gray-800">分析结果</h2>
            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-gray-200 transition-colors"
            >
              <X size={20} className="text-gray-500" />
            </button>
          </div>

          {/* Compact Header - 分类选择器和发布按钮 */}
          <div className="px-6 py-3 border-b border-gray-100 bg-gray-50/50">
            <div className="flex items-center justify-between gap-4">
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as Category)}
                className="w-48 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                disabled={isSaving}
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
              {/* Google Blue Style 发布按钮 */}
              <button
                onClick={onSave}
                disabled={isSaving}
                className={`px-6 py-2.5 rounded-lg font-medium text-[15px] transition-all duration-200 shadow-sm ${
                  isSaving
                    ? 'bg-gray-300 cursor-not-allowed text-gray-500'
                    : 'bg-[#1A73E8] hover:bg-[#1557B0] text-white'
                }`}
              >
                {isSaving ? '发布中...' : '发布视频'}
              </button>
            </div>
          </div>

          {/* Tab 导航栏 - Google Material Design 风格 */}
          <div className="flex border-b border-gray-200 px-6">
            <button
              onClick={() => setActiveTab('transcript')}
              className={`px-4 py-3 cursor-pointer font-medium transition-colors ${
                activeTab === 'transcript'
                  ? 'border-b-2 border-[#1A73E8] text-[#1A73E8]'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              字幕文本
            </button>
            <button
              onClick={() => setActiveTab('vocabulary')}
              className={`px-4 py-3 cursor-pointer font-medium transition-colors ${
                activeTab === 'vocabulary'
                  ? 'border-b-2 border-[#1A73E8] text-[#1A73E8]'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              重点词汇
            </button>
          </div>

          {/* Tab 内容区域 */}
          <div className="p-6 max-h-[60vh] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent hover:scrollbar-thumb-gray-400">
            {/* Tab 1: 字幕文本 */}
            {activeTab === 'transcript' && (
              <div className="space-y-3">
                {result.segments.map((segment, idx) => (
                  <div key={idx}>
                    <p className="text-[15px] leading-snug text-gray-900 font-medium">
                      {renderSentence(segment)}
                    </p>
                    <p className="text-[13px] leading-snug text-gray-500 mt-0.5">
                      {segment.cn}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {/* Tab 2: 重点词汇 */}
            {activeTab === 'vocabulary' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Red List - 地道表达/习语 */}
                <div className="bg-red-50 rounded-xl p-5">
                  <h4 className="text-lg font-semibold text-red-600 mb-4">
                    地道表达/习语
                  </h4>
                  <div className="space-y-3">
                    {result.red_list.map((item, idx) => (
                      <div
                        key={idx}
                        className="bg-white rounded-lg p-3 border border-red-100"
                      >
                        <div className="font-semibold text-gray-800">
                          {item.word}
                          <span className="text-sm text-gray-500 ml-2">
                            {item.pronunciation}
                          </span>
                        </div>
                        <div className="text-sm text-gray-600 mb-1">
                          {item.definition_cn}
                        </div>
                        {item.example && (
                          <div className="text-xs text-gray-500 italic">
                            例句: {item.example}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Blue List - 专业术语/行业黑话 */}
                <div className="bg-blue-50 rounded-xl p-5">
                  <h4 className="text-lg font-semibold text-blue-600 mb-4">
                    专业术语/行业黑话
                  </h4>
                  <div className="space-y-3">
                    {result.blue_list.map((item, idx) => (
                      <div
                        key={idx}
                        className="bg-white rounded-lg p-3 border border-blue-100"
                      >
                        <div className="font-semibold text-gray-800">
                          {item.term}
                        </div>
                        <div className="text-sm text-gray-600 mt-1">
                          {item.definition_cn}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const Admin: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [metadata, setMetadata] = useState<VideoMetadata | null>(null);
  const [category, setCategory] = useState<Category>('Technical');
  const [isSaving, setIsSaving] = useState(false);

  // Modal 状态
  const [isModalOpen, setIsModalOpen] = useState(false);

  // 筛选状态
  const [filter, setFilter] = useState<FilterType>('all');

  // 视频管理状态
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [videosLoading, setVideosLoading] = useState(false);

  // 加载视频列表
  const fetchVideos = async () => {
    setVideosLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/admin/list`);
      const data = await response.json();
      if (data.success) {
        setVideos(data.data);
      }
    } catch (err) {
      console.error('Failed to fetch videos:', err);
    } finally {
      setVideosLoading(false);
    }
  };

  // 切换可见性
  const handleToggleVisibility = async (id: string) => {
    try {
      const response = await fetch(`${API_BASE}/api/admin/toggle-visibility`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const data = await response.json();
      if (data.success) {
        fetchVideos();
      }
    } catch (err) {
      console.error('Failed to toggle visibility:', err);
    }
  };

  // 删除视频
  const handleDelete = async (id: string, title: string) => {
    if (!window.confirm(`确定要删除「${title}」吗？此操作不可恢复。`)) {
      return;
    }
    try {
      const response = await fetch(`${API_BASE}/api/admin/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const data = await response.json();
      if (data.success) {
        fetchVideos();
      }
    } catch (err) {
      console.error('Failed to delete video:', err);
    }
  };

  // 页面加载时获取视频列表
  useEffect(() => {
    fetchVideos();
  }, []);

  // 格式化日期
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toISOString().split('T')[0];
  };

  // 分析视频
  const handleAnalyze = async (videoUrl: string) => {
    if (!videoUrl.trim()) {
      setError('请输入 YouTube 视频链接');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      console.log('开始音频多模态分析...');

      const response = await fetch(`${API_BASE}/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: videoUrl }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '分析失败');
      }

      const responseData = await response.json();
      console.log('分析成功:', responseData);

      if (!responseData.success || !responseData.data) {
        throw new Error('服务器返回数据格式错误');
      }

      setResult(responseData.data);
      setMetadata(responseData.metadata || null);
      setIsModalOpen(false);
    } catch (err) {
      console.error('处理失败:', err);
      setError(err instanceof Error ? err.message : '未知错误');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!result || !metadata) {
      window.alert('没有可发布的内容');
      return;
    }

    setIsSaving(true);

    try {
      const payload = {
        ...result,
        metadata,
        categories: [category],
      };

      const response = await fetch(`${API_BASE}/api/articles`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '发布失败');
      }

      window.alert('文章已发布到首页！');
      setResult(null);
      setMetadata(null);
      fetchVideos();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : '发布失败，请重试');
    } finally {
      setIsSaving(false);
    }
  };

  // 筛选视频
  const filteredVideos = videos.filter((video) => {
    if (filter === 'published') return !video.isHidden;
    if (filter === 'hidden') return video.isHidden;
    return true;
  });

  const filterButtons: { key: FilterType; label: string }[] = [
    { key: 'all', label: '全部' },
    { key: 'published', label: '已发布' },
    { key: 'hidden', label: '已隐藏' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <h1 className="text-2xl font-semibold text-gray-800">
              视频管理后台
            </h1>

            {/* Filter Tabs */}
            <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-xl">
              {filterButtons.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setFilter(key)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                    filter === key
                      ? 'bg-white text-gray-800 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {label}
                  {key === 'all' && (
                    <span className="ml-1.5 text-xs text-gray-400">
                      {videos.length}
                    </span>
                  )}
                  {key === 'published' && (
                    <span className="ml-1.5 text-xs text-gray-400">
                      {videos.filter((v) => !v.isHidden).length}
                    </span>
                  )}
                  {key === 'hidden' && (
                    <span className="ml-1.5 text-xs text-gray-400">
                      {videos.filter((v) => v.isHidden).length}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {videosLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-2 border-blue-500 border-t-transparent"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {/* Add Card - Always First */}
            <AddCard onClick={() => setIsModalOpen(true)} />

            {/* Video Cards */}
            {filteredVideos.map((video) => (
              <VideoCard
                key={video.id}
                video={video}
                onToggleVisibility={handleToggleVisibility}
                onDelete={handleDelete}
                formatDate={formatDate}
              />
            ))}
          </div>
        )}

        {/* Empty State */}
        {!videosLoading && filteredVideos.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-400">
              {filter === 'all'
                ? '暂无视频，点击上方卡片添加'
                : filter === 'published'
                ? '暂无已发布的视频'
                : '暂无已隐藏的视频'}
            </p>
          </div>
        )}
      </div>

      {/* Analysis Result Panel */}
      {result && (
        <AnalysisResultPanel
          result={result}
          category={category}
          setCategory={setCategory}
          isSaving={isSaving}
          onSave={handleSave}
          onClose={() => {
            setResult(null);
            setMetadata(null);
          }}
        />
      )}

      {/* Video Input Modal */}
      <VideoInputModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setError(null);
        }}
        onAnalyze={handleAnalyze}
        loading={loading}
        error={error}
      />
    </div>
  );
};

export default Admin;
