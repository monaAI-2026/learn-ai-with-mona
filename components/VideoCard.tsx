import React from 'react';
import { Play } from 'lucide-react';
import { Video } from '../types';
import Badge from './ui/Badge';

interface VideoCardProps {
  video: Video;
  onClick: (id: string) => void;
  style?: React.CSSProperties;
}

const VideoCard: React.FC<VideoCardProps> = ({ video, onClick, style }) => {
  return (
    <div
      className="group cursor-pointer bg-white rounded-2xl overflow-hidden border border-warm-200/60 transition-all duration-300 hover:shadow-lg hover:-translate-y-1"
      onClick={() => onClick(video.id)}
      style={style}
    >
      {/* Thumbnail */}
      <div className="aspect-video bg-warm-100 overflow-hidden relative">
        <img
          src={video.thumbnail}
          alt={video.title}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        {/* Play button overlay */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-black/20">
          <div className="w-12 h-12 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center shadow-lg">
            <Play size={20} className="text-warm-800 ml-0.5" fill="currentColor" />
          </div>
        </div>
        {/* Duration badge */}
        <div className="absolute bottom-2 right-2 px-2 py-0.5 bg-black/70 text-white text-[11px] font-medium rounded-md backdrop-blur-sm">
          {video.duration}
        </div>
      </div>

      {/* Content */}
      <div className="p-5 space-y-3">
        {/* Category badges */}
        <div className="flex flex-wrap gap-1.5">
          {video.categories.map((cat) => (
            <Badge key={cat} category={cat} />
          ))}
        </div>

        {/* Title */}
        <h3 className="text-base font-medium text-warm-800 leading-snug line-clamp-2 group-hover:text-warm-900 transition-colors">
          {video.title}
        </h3>
      </div>
    </div>
  );
};

export default VideoCard;
