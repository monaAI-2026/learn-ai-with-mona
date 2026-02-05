import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import VideoCard from '../components/VideoCard';
import { SkeletonCard } from '../components/ui/Skeleton';
import { Video } from '../types';

// API Base URL - 支持环境变量配置
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const Home: React.FC = () => {
  const navigate = useNavigate();
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchVideos = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/articles`);
        const responseData = await response.json();

        // 从响应中提取数组（后端返回 { success: true, data: [...] }）
        const articles = responseData.data || [];

        // 数据格式转换：将后端嵌套结构转为前端扁平结构
        const mappedVideos: Video[] = articles.map((item: any) => ({
          id: item.id,
          title: item.metadata?.title || '',
          thumbnail: item.metadata?.thumbnail || '',
          duration: item.metadata?.duration || '',
          categories: item.categories || [],
          description: item.metadata?.title || '',
          youtubeId: item.metadata?.youtubeId || '',
        }));

        setVideos(mappedVideos);
      } catch (error) {
        console.error('Failed to fetch videos:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchVideos();
  }, []);

  return (
    <div className="min-h-screen bg-warm-50">
      <Header />

      <main className="container mx-auto px-4 sm:px-6 lg:px-8 animate-page-enter max-w-[95vw] 2xl:max-w-[1600px]">
        {/* Hero Section */}
        <div className="py-20 md:py-28 text-center space-y-5">
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-medium text-warm-800 tracking-tight leading-tight">
            Learn AI in the
            <br />
            <span className="text-accent">Native Context.</span>
          </h1>
        </div>

        {/* Video Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-4 gap-6 mb-20">
          {loading
            ? Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
            : videos.map((video, i) => (
                <VideoCard
                  key={video.id}
                  video={video}
                  onClick={(id) => navigate(`/video/${id}`)}
                  style={{ animationDelay: `${i * 80}ms` }}
                />
              ))}
        </div>
      </main>

      <footer className="border-t border-warm-200/60 py-10 px-6 text-center">
        <p className="text-warm-400 text-sm font-light">
          &copy; 2025 Learn AI with Mona. Curating the best for the global AI community.
        </p>
      </footer>
    </div>
  );
};

export default Home;
