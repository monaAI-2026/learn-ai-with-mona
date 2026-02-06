import React, { useState, useEffect } from 'react';
import { Trash2, Eye, EyeOff, Plus, X } from 'lucide-react';
import type { Category } from '../types';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import Tabs from '../components/ui/Tabs';

interface HighlightItem {
  text: string;
  type?: 'word' | 'phrase';
}

interface Segment {
  en: string;
  cn: string;
  word?: string;
  highlights?: HighlightItem[];
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
const API_BASE = import.meta.env.VITE_API_URL || `${window.location.protocol}//${window.location.hostname}:3001`;

// 高亮渲染辅助函数
const renderSentence = (segment: Segment): React.ReactNode => {
  const { en, word, highlights } = segment;

  const allHighlights: HighlightItem[] = [];

  if (highlights && highlights.length > 0) {
    allHighlights.push(...highlights);
  } else if (word) {
    allHighlights.push({ text: word, type: 'word' });
  }

  if (allHighlights.length === 0) {
    return en;
  }

  const escapedTexts = allHighlights.map(h =>
    h.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  );
  const regex = new RegExp(`(${escapedTexts.join('|')})`, 'gi');

  const parts = en.split(regex);

  return parts.map((part, index) => {
    const matchedHighlight = allHighlights.find(
      h => h.text.toLowerCase() === part.toLowerCase()
    );

    if (matchedHighlight) {
      const colorClass = matchedHighlight.type === 'phrase'
        ? 'text-[#1A73E8] font-bold'
        : 'text-[#C5221F] font-bold';
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

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="添加视频"
      footer={
        <Button
          variant="primary"
          onClick={handleSubmit}
          loading={loading}
          disabled={!url.trim()}
        >
          {loading ? '分析中...' : '开始分析'}
        </Button>
      }
    >
      <div className="px-6 py-8 space-y-4">
        <div>
          <label className="block text-sm font-medium text-warm-700 mb-2">
            YouTube 视频链接
          </label>
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="https://www.youtube.com/watch?v=..."
            className="w-full px-4 py-3 border border-warm-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent bg-warm-50 transition-colors"
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
    </Modal>
  );
};

// 视频卡片组件
interface AdminVideoCardProps {
  video: VideoItem;
  onToggleVisibility: (id: string) => void;
  onDelete: (id: string, title: string) => void;
  formatDate: (date: string) => string;
}

const AdminVideoCard: React.FC<AdminVideoCardProps> = ({
  video,
  onToggleVisibility,
  onDelete,
  formatDate,
}) => {
  return (
    <div
      className={`group flex flex-col bg-white rounded-2xl shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300 overflow-hidden border border-warm-200/60 ${
        video.isHidden ? 'opacity-60' : ''
      }`}
    >
      {/* Thumbnail */}
      <div className="relative h-40 bg-warm-100 overflow-hidden flex-shrink-0">
        {video.metadata?.thumbnail ? (
          <img
            src={video.metadata.thumbnail}
            alt={video.metadata?.title || '视频'}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-warm-400">
            <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </div>
        )}

        {video.isHidden && (
          <div className="absolute top-2 left-2 bg-warm-900/70 text-white text-xs px-2 py-1 rounded-lg">
            已隐藏
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex flex-col flex-1 p-4">
        <h3
          className="font-medium text-warm-800 line-clamp-2 overflow-hidden text-ellipsis leading-snug h-[3rem]"
          title={video.metadata?.title || '未知标题'}
        >
          {video.metadata?.title || '未知标题'}
        </h3>

        <div className="flex items-center justify-between mt-auto pt-3">
          <span className="text-sm text-warm-500">
            {formatDate(video.createdAt)}
          </span>

          <div className="flex items-center gap-1">
            <button
              onClick={() => onToggleVisibility(video.id)}
              className={`p-2 rounded-lg transition-colors ${
                video.isHidden
                  ? 'text-warm-400 hover:text-accent hover:bg-accent-light'
                  : 'text-accent hover:text-accent-hover hover:bg-accent-light'
              }`}
              title={video.isHidden ? '点击显示' : '点击隐藏'}
            >
              {video.isHidden ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
            <button
              onClick={() =>
                onDelete(video.id, video.metadata?.title || '未知视频')
              }
              className="p-2 rounded-lg text-warm-400 hover:text-red-500 hover:bg-red-50 transition-colors"
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
      className="group relative flex flex-col items-center justify-center h-full min-h-[240px] bg-white border-2 border-dashed border-warm-200 rounded-2xl cursor-pointer transition-all duration-300 hover:scale-[1.02] hover:shadow-lg hover:border-accent-muted"
    >
      <div className="w-16 h-16 rounded-full bg-accent-light flex items-center justify-center mb-4 group-hover:bg-accent-muted/20 transition-colors">
        <Plus className="w-8 h-8 text-accent" />
      </div>
      <span className="text-lg font-medium text-warm-800">添加视频</span>
    </div>
  );
};

// 分析结果面板组件
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
  const [activeTab, setActiveTab] = useState('transcript');

  const tabs = [
    { key: 'transcript', label: '字幕文本' },
    { key: 'vocabulary', label: '重点词汇' },
  ];

  return (
    <div className="fixed inset-0 z-50 overflow-auto bg-warm-900/40 backdrop-blur-sm animate-fade-in">
      <div className="min-h-screen flex items-start justify-center py-8 px-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden animate-scale-in">
          {/* Result Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-warm-200/60 bg-warm-50">
            <h2 className="text-xl font-medium text-warm-800">分析结果</h2>
            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-warm-200 transition-colors"
            >
              <X size={20} className="text-warm-500" />
            </button>
          </div>

          {/* Category + Publish */}
          <div className="px-6 py-3 border-b border-warm-200/60 bg-warm-50/50">
            <div className="flex items-center justify-between gap-4">
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as Category)}
                className="w-48 px-3 py-2 text-sm border border-warm-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent bg-white transition-colors"
                disabled={isSaving}
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
              <Button
                variant="primary"
                onClick={onSave}
                loading={isSaving}
              >
                {isSaving ? '发布中...' : '发布视频'}
              </Button>
            </div>
          </div>

          {/* Tabs */}
          <div className="px-6">
            <Tabs
              tabs={tabs}
              activeKey={activeTab}
              onChange={setActiveTab}
            />
          </div>

          {/* Tab content */}
          <div className="p-6 max-h-[60vh] overflow-y-auto scrollbar-thin">
            {activeTab === 'transcript' && (
              <div className="space-y-3">
                {result.segments.map((segment, idx) => (
                  <div key={idx}>
                    <p className="text-[15px] leading-snug text-warm-800 font-medium">
                      {renderSentence(segment)}
                    </p>
                    <p className="text-[13px] leading-snug text-warm-500 mt-0.5">
                      {segment.cn}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'vocabulary' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Red List */}
                <div className="bg-[#FCE8E6] rounded-xl p-5 border border-[#F28B82]/20">
                  <h4 className="text-lg font-medium text-[#C5221F] mb-4">
                    地道表达/习语
                  </h4>
                  <div className="space-y-3">
                    {result.red_list.map((item, idx) => (
                      <div
                        key={idx}
                        className="bg-white rounded-xl p-3 border border-[#F28B82]/10"
                      >
                        <div className="font-semibold text-warm-800">
                          {item.word}
                          <span className="text-sm text-warm-400 ml-2">
                            {item.pronunciation}
                          </span>
                        </div>
                        <div className="text-sm text-warm-600 mb-1">
                          {item.definition_cn}
                        </div>
                        {item.example && (
                          <div className="text-xs text-warm-500 italic">
                            例句: {item.example}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Blue List */}
                <div className="bg-[#E8F0FE] rounded-xl p-5 border border-[#A8C7FA]/20">
                  <h4 className="text-lg font-medium text-[#1A73E8] mb-4">
                    专业术语/行业黑话
                  </h4>
                  <div className="space-y-3">
                    {result.blue_list.map((item, idx) => (
                      <div
                        key={idx}
                        className="bg-white rounded-xl p-3 border border-[#A8C7FA]/10"
                      >
                        <div className="font-semibold text-warm-800">
                          {item.term}
                        </div>
                        <div className="text-sm text-warm-600 mt-1">
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

const SESSION_KEY = 'admin_authenticated';

const Admin: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(
    () => sessionStorage.getItem(SESSION_KEY) === 'true'
  );
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState(false);

  const handleLogin = () => {
    if (password === import.meta.env.VITE_ADMIN_PASSWORD) {
      setIsAuthenticated(true);
      sessionStorage.setItem(SESSION_KEY, 'true');
      setAuthError(false);
    } else {
      setAuthError(true);
    }
  };

  const handleLoginKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleLogin();
    }
  };

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [metadata, setMetadata] = useState<VideoMetadata | null>(null);
  const [category, setCategory] = useState<Category>('Technical');
  const [isSaving, setIsSaving] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [filter, setFilter] = useState<FilterType>('all');
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [videosLoading, setVideosLoading] = useState(false);

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

  useEffect(() => {
    if (isAuthenticated) {
      fetchVideos();
    }
  }, [isAuthenticated]);

  // 密码验证界面
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-warm-50 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-sm animate-scale-in">
          <div className="flex justify-center mb-6">
            <svg width="40" height="40" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
              {/* Blue circular background */}
              <circle cx="14" cy="14" r="14" fill="#4285F4" />
              {/* White solid triangle */}
              <path d="M14 7.5 L20.5 19 L7.5 19 Z" fill="white" />
            </svg>
          </div>
          <h2 className="text-xl font-medium text-warm-800 text-center mb-6">
            管理后台
          </h2>
          <input
            type="password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setAuthError(false);
            }}
            onKeyDown={handleLoginKeyDown}
            placeholder="请输入密码"
            className="w-full px-4 py-3 border border-warm-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent bg-warm-50 mb-4 transition-colors"
            autoFocus
          />
          {authError && (
            <p className="text-red-500 text-sm mb-4">密码错误，请重试</p>
          )}
          <Button
            variant="primary"
            size="lg"
            onClick={handleLogin}
            className="w-full"
          >
            确认
          </Button>
        </div>
      </div>
    );
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toISOString().split('T')[0];
  };

  const handleAnalyze = async (videoUrl: string) => {
    if (!videoUrl.trim()) {
      setError('请输入 YouTube 视频链接');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      console.log('\n🎬 ========== 开始视频分析 ==========');
      console.log('📎 视频链接:', videoUrl);
      console.log('⏰ 提交时间:', new Date().toLocaleString('zh-CN'));
      console.log('');
      console.log('⏳ 预计处理时间：');
      console.log('   - 短视频（<30分钟）：约 5-15 分钟');
      console.log('   - 中等视频（30-60分钟）：约 15-30 分钟');
      console.log('   - 长视频（1-3小时）：约 40-90 分钟');
      console.log('');
      console.log('💡 建议：');
      console.log('   1. 打开 Railway 日志查看详细进度');
      console.log('   2. 可以最小化浏览器窗口，去做其他事情');
      console.log('   3. 请勿刷新页面或关闭标签页');
      console.log('');
      console.log('🔄 正在发送请求...\n');

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
      console.log('\n✅ ========== 分析成功 ==========');
      console.log('⏰ 完成时间:', new Date().toLocaleString('zh-CN'));
      console.log('📊 结果统计：');
      console.log('   - 字幕段落:', responseData.data.segments?.length || 0);
      console.log('   - 重点词汇:', responseData.data.red_list?.length || 0);
      console.log('   - 专业术语:', responseData.data.blue_list?.length || 0);
      console.log('   - 章节数:', responseData.data.chapters?.length || 0);
      console.log('📺 视频标题:', responseData.metadata?.title || '未知');
      console.log('\n');

      if (!responseData.success || !responseData.data) {
        throw new Error('服务器返回数据格式错误');
      }

      setResult(responseData.data);
      setMetadata(responseData.metadata || null);
      setIsModalOpen(false);
    } catch (err) {
      console.error('\n❌ ========== 处理失败 ==========');
      console.error('⏰ 失败时间:', new Date().toLocaleString('zh-CN'));
      console.error('❌ 错误信息:', err);
      console.error('💡 可能的原因：');
      console.error('   1. 网络连接中断');
      console.error('   2. Railway 服务器超时');
      console.error('   3. Gemini API 出错');
      console.error('   4. 视频链接无效或无法访问');
      console.error('\n');
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
    <div className="min-h-screen bg-warm-50">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-md border-b border-warm-200/60 sticky top-0 z-40">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-5 max-w-[95vw] 2xl:max-w-[1600px]">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <h1 className="text-2xl font-medium text-warm-800">
              视频管理后台
            </h1>

            {/* Filter Tabs */}
            <div className="flex items-center gap-1 bg-warm-100 p-1 rounded-xl">
              {filterButtons.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setFilter(key)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                    filter === key
                      ? 'bg-white text-warm-800 shadow-sm'
                      : 'text-warm-500 hover:text-warm-700'
                  }`}
                >
                  {label}
                  {key === 'all' && (
                    <span className="ml-1.5 text-xs text-warm-400">
                      {videos.length}
                    </span>
                  )}
                  {key === 'published' && (
                    <span className="ml-1.5 text-xs text-warm-400">
                      {videos.filter((v) => !v.isHidden).length}
                    </span>
                  )}
                  {key === 'hidden' && (
                    <span className="ml-1.5 text-xs text-warm-400">
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
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-page-enter max-w-[95vw] 2xl:max-w-[1600px]">
        {videosLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-2 border-accent border-t-transparent"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            <AddCard onClick={() => setIsModalOpen(true)} />

            {filteredVideos.map((video) => (
              <AdminVideoCard
                key={video.id}
                video={video}
                onToggleVisibility={handleToggleVisibility}
                onDelete={handleDelete}
                formatDate={formatDate}
              />
            ))}
          </div>
        )}

        {!videosLoading && filteredVideos.length === 0 && (
          <div className="text-center py-12">
            <p className="text-warm-400">
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
