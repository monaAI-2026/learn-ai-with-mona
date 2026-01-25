
import React from 'react';
import { Category } from '../types';

interface TagProps {
  category: Category;
}

const Tag: React.FC<TagProps> = ({ category }) => {
  const getColor = (cat: Category) => {
    switch (cat) {
      case 'Product': return 'bg-orange-500';
      case 'Founder Interview': return 'bg-blue-500';
      case 'Technical': return 'bg-purple-500';
      case 'AI News': return 'bg-green-500';
      case 'Tutorial': return 'bg-yellow-500';
      default: return 'bg-gray-400';
    }
  };

  return (
    <div className="inline-flex items-center px-2 py-0.5 border border-gray-200 rounded text-[10px] text-gray-500 space-x-1">
      <div className={`w-1.5 h-1.5 rounded-full ${getColor(category)}`} />
      <span>{category}</span>
    </div>
  );
};

export default Tag;
