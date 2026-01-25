import React from 'react';
import { Video } from '../types';
import Tag from './Tag';

interface VideoCardProps {
  video: Video;
  onClick: (id: string) => void;
}

const VideoCard: React.FC<VideoCardProps> = ({ video, onClick }) => {
  return (
    <div 
      className="group cursor-pointer flex flex-col space-y-3 p-4 border-r border-b border-gray-100 last:border-r-0 transition-all duration-300 hover:scale-[1.02] hover:z-10 hover:shadow-lg bg-white relative"
      onClick={() => onClick(video.id)}
    >
      <div className="aspect-video bg-gray-100 overflow-hidden relative">
        <img 
          src={video.thumbnail} 
          alt={video.title}
          className="w-full h-full object-cover transition-all duration-300"
        />
        <div className="absolute bottom-2 right-2 px-1 py-0.5 bg-black/60 text-white text-[10px] rounded">
          {video.duration}
        </div>
      </div>
      
      <div className="flex flex-wrap gap-2">
        {video.categories.map((cat) => (
          <Tag key={cat} category={cat} />
        ))}
      </div>
      
      <h3 className="text-lg font-medium text-gray-800 leading-tight transition-colors group-hover:text-black">
        {video.title}
      </h3>
    </div>
  );
};

export default VideoCard;