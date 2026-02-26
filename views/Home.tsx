import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import VideoCard from '../components/VideoCard';
import { SkeletonCard } from '../components/ui/Skeleton';
import { Video } from '../types';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3099';

const Home: React.FC = () => {
  const navigate = useNavigate();
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchVideos = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/articles`);
        const responseData = await response.json();
        const articles = responseData.data || [];

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
    <div className="min-h-screen bg-white">
      {/* Dot grid hero section */}
      <div className="relative"
        style={{
          backgroundColor: '#ffffff',
          backgroundImage: 'radial-gradient(circle, #d1d5db 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      >
        <Header transparent />
        <div className="container mx-auto px-12 lg:px-16 max-w-[95vw] 2xl:max-w-[1800px] flex items-center justify-center pt-24 pb-44">
          <img src="/hero.png" alt="hero" className="w-full max-w-5xl object-contain translate-x-[52px]" />
        </div>
        {/* Gradient fade */}
        <div className="absolute bottom-0 left-0 right-0 h-32 pointer-events-none"
          style={{ background: 'linear-gradient(to bottom, transparent, #ffffff)' }} />
      </div>

      <main className="container mx-auto px-12 lg:px-16 animate-page-enter max-w-[95vw] 2xl:max-w-[1800px]">
        {/* Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-6 pb-16">
          {loading
            ? Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)
            : videos.map((video, i) => (
                <VideoCard
                  key={video.id}
                  video={video}
                  onClick={(id) => navigate(`/video/${id}`)}
                  style={{ animationDelay: `${i * 60}ms` }}
                />
              ))}
        </div>

        {/* Empty state */}
        {!loading && videos.length === 0 && (
          <div className="flex flex-col items-center justify-center py-32 text-warm-400">
            <p className="text-sm">No videos yet. Add your first video to get started.</p>
          </div>
        )}
      </main>

      <footer className="border-t border-warm-200 py-8 px-6 text-center">
        <p className="text-warm-400 text-xs">
          &copy; 2025 Learn AI with Mona
        </p>
      </footer>
    </div>
  );
};

export default Home;
