import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import VideoCard from '../components/VideoCard';
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

  if (loading) {
    return (
      <div className="min-h-screen bg-white">
        <Header />
        <div className="text-center py-20">加载中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <Header />

      <main className="max-w-7xl mx-auto px-6">
        {/* Hero Section */}
        <div className="py-24 md:py-32 text-center space-y-4">
          <h1 className="text-5xl md:text-7xl font-source-han font-normal text-gray-800 tracking-tight">
            Learn AI in the Native Context.
          </h1>
          <p className="text-gray-400 text-lg md:text-xl font-light">
            原生语境获取AI一手信息，学AI的同时学英语
          </p>
        </div>

        {/* Video Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 border-t border-l border-gray-100 mb-20">
          {videos.map((video) => (
            <VideoCard
              key={video.id}
              video={video}
              onClick={(id) => navigate(`/video/${id}`)}
            />
          ))}
        </div>
      </main>

      <footer className="border-t border-gray-100 py-10 px-6 text-center">
        <p className="text-gray-400 text-sm font-light">
          &copy; 2024 Mona AI Learning. Curating the best for the global AI community.
        </p>
      </footer>
    </div>
  );
};

export default Home;