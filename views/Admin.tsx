import React, { useState } from 'react';
import type { Category } from '../types';

interface AnalysisResult {
  segments: Array<{
    en: string;
    cn: string;
  }>;
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

const CATEGORIES: Category[] = ['Product', 'Founder Interview', 'Technical', 'Tutorial', 'AI News'];

const Admin: React.FC = () => {
  const [videoUrl, setVideoUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [metadata, setMetadata] = useState<VideoMetadata | null>(null);
  const [category, setCategory] = useState<Category>('Technical');
  const [isSaving, setIsSaving] = useState(false);

  // 提取 YouTube 视频 ID
  const extractVideoId = (url: string): string | null => {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/,
      /youtube\.com\/embed\/([^&\n?#]+)/,
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }
    return null;
  };

  const videoId = extractVideoId(videoUrl);
  const thumbnailUrl = videoId
    ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
    : null;

  const handleAnalyze = async () => {
    if (!videoUrl.trim()) {
      setError('请输入 YouTube 视频链接');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      console.log('🎵 开始音频多模态分析...');

      // 调用新的 /analyze 接口
      const response = await fetch('http://localhost:3001/analyze', {
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
      console.log('✅ 分析成功:', responseData);

      if (!responseData.success || !responseData.data) {
        throw new Error('服务器返回数据格式错误');
      }

      // 更新结果状态
      setResult(responseData.data);
      setMetadata(responseData.metadata || null);
    } catch (err) {
      console.error('❌ 处理失败:', err);
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

      const response = await fetch('http://localhost:3001/api/articles', {
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
    } catch (err) {
      window.alert(err instanceof Error ? err.message : '发布失败，请重试');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-source-han text-gray-800 mb-8 text-center">
          AI 音频多模态分析控制台
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 左侧：输入区 */}
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">
                输入视频链接
              </h2>

              <div className="space-y-4">
                <input
                  type="text"
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  placeholder="请输入 YouTube 视频链接"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={loading}
                />

                <button
                  onClick={handleAnalyze}
                  disabled={loading}
                  className={`w-full py-3 px-6 rounded-lg font-medium transition-colors duration-200 ${
                    loading
                      ? 'bg-gray-400 cursor-not-allowed'
                      : 'bg-blue-500 hover:bg-blue-600 text-white'
                  }`}
                >
                  {loading ? '分析中...' : '开始分析'}
                </button>

                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
                    ⚠️ {error}
                  </div>
                )}
              </div>
            </div>

            {/* 视频缩略图 */}
            {thumbnailUrl && (
              <div className="bg-white rounded-lg shadow-lg p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-3">
                  视频预览
                </h3>
                <img
                  src={thumbnailUrl}
                  alt="视频缩略图"
                  className="w-full rounded-lg"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              </div>
            )}
          </div>

          {/* 右侧：结果预览区 */}
          <div className="space-y-6">
            {result && (
              <>
                {/* 发布区 */}
                <div className="bg-white rounded-lg shadow-lg p-6">
                  <h2 className="text-xl font-semibold text-gray-800 mb-4">
                    发布文章
                  </h2>
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        选择分类
                      </label>
                      <select
                        value={category}
                        onChange={(e) => setCategory(e.target.value as Category)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        disabled={isSaving}
                      >
                        {CATEGORIES.map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex-shrink-0 self-end">
                      <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className={`py-2 px-6 rounded-lg font-medium transition-colors duration-200 ${
                          isSaving
                            ? 'bg-gray-400 cursor-not-allowed'
                            : 'bg-green-500 hover:bg-green-600 text-white'
                        }`}
                      >
                        {isSaving ? '发布中...' : '保存并发布'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* 双语逐字稿 */}
                <div className="bg-white rounded-lg shadow-lg p-6">
                  <h2 className="text-xl font-semibold text-gray-800 mb-4">
                    📝 双语逐字稿
                  </h2>
                  <div className="space-y-4 max-h-[500px] overflow-y-auto">
                    {result.segments.map((segment, idx) => (
                      <div
                        key={idx}
                        className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                      >
                        <p className="text-gray-900 leading-relaxed mb-2">
                          {segment.en}
                        </p>
                        <p className="text-gray-600 leading-relaxed">
                          {segment.cn}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 红色单词表和蓝色术语表 */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* 红色单词表 */}
                  <div className="bg-white rounded-lg shadow-lg p-6">
                    <h3 className="text-lg font-semibold text-red-600 mb-4">
                      🔴 地道表达/习语
                    </h3>
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {result.red_list.map((item, idx) => (
                        <div
                          key={idx}
                          className="border-b border-gray-100 pb-3 last:border-0"
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
                            <div className="text-xs text-gray-500 italic mt-1">
                              例句: {item.example}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 蓝色术语表 */}
                  <div className="bg-white rounded-lg shadow-lg p-6">
                    <h3 className="text-lg font-semibold text-blue-600 mb-4">
                      🔵 专业术语/行业黑话
                    </h3>
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {result.blue_list.map((item, idx) => (
                        <div
                          key={idx}
                          className="border-b border-gray-100 pb-3 last:border-0"
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
              </>
            )}

            {!result && !loading && (
              <div className="bg-white rounded-lg shadow-lg p-12 text-center text-gray-400">
                <p className="text-lg">输入视频链接并点击分析开始</p>
              </div>
            )}

            {loading && (
              <div className="bg-white rounded-lg shadow-lg p-12 text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                <p className="text-gray-600">正在分析中，请稍候...</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Admin;
