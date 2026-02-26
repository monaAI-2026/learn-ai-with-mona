import React from 'react';
import { Play } from 'lucide-react';
import { Video } from '../types';

interface VideoCardProps {
  video: Video;
  onClick: (id: string) => void;
  style?: React.CSSProperties;
}

const TAG_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  'Product':           { bg: '#E6F4EAB3', text: '#137333B3', border: '#CEEAD6B3' },
  'Founder Interview': { bg: '#F3E8FDB3', text: '#7B1FA2B3', border: '#E9D5F7B3' },
  'Tutorial':          { bg: '#E3F5FBB3', text: '#007B7AB3', border: '#C1E9F3B3' },
  'Vibe Coding':       { bg: '#FCE8F0B3', text: '#C2185BB3', border: '#F7C5D8B3' },
  'Marketing':         { bg: '#FEF0E6B3', text: '#C35100B3', border: '#FCD3A8B3' },
  'AI Fundamentals':   { bg: '#E8F0FEB3', text: '#1A73E8B3', border: '#AECBFAB3' },
};

const VideoCard: React.FC<VideoCardProps> = ({ video, onClick, style }) => {
  return (
    <div
      className="group cursor-pointer bg-white rounded-2xl overflow-hidden border border-warm-200 transition-all duration-200 shadow-card hover:shadow-card-hover hover:-translate-y-0.5"
      onClick={() => onClick(video.id)}
      style={style}
    >
      {/* Thumbnail */}
      <div className="aspect-video bg-warm-100 overflow-hidden relative">
        <img
          src={video.thumbnail}
          alt={video.title}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
        />
        {/* Play overlay */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-black/15">
          <div className="w-10 h-10 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center shadow-md">
            <Play size={16} className="text-warm-900 ml-0.5" fill="currentColor" />
          </div>
        </div>
        {/* Duration */}
        <div className="absolute bottom-2 right-2 px-1.5 py-0.5 bg-black/70 text-white text-[11px] font-medium rounded-md backdrop-blur-sm tracking-wide">
          {typeof video.duration === 'number'
            ? `${Math.floor((video.duration as number) / 60)}:${String(Math.floor((video.duration as number) % 60)).padStart(2, '0')}`
            : video.duration}
        </div>
      </div>

      {/* Info */}
      <div className="px-3.5 pt-3 pb-3.5 space-y-2">
        {/* Category */}
        {video.categories?.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {video.categories.slice(0, 2).map((cat) => {
              const colors = TAG_COLORS[cat];
              return (
                <span
                  key={cat}
                  className="text-[11px] font-medium rounded-full px-2 py-0.5 border"
                  style={colors
                    ? { background: colors.bg, color: colors.text, borderColor: colors.border }
                    : { background: '#F3F4F6', color: '#6B7280', borderColor: '#E5E7EB' }
                  }
                >
                  {cat}
                </span>
              );
            })}
          </div>
        )}
        {/* Title */}
        <h3 className="w-full text-[17px] font-medium text-warm-900 leading-snug line-clamp-2 break-words group-hover:text-accent transition-colors">
          {video.title}
        </h3>
      </div>
    </div>
  );
};

export default VideoCard;
