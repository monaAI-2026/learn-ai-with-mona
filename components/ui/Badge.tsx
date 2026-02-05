import React from 'react';

interface BadgeProps {
  category: string;
}

const Badge: React.FC<BadgeProps> = ({ category }) => {
  // Define color schemes for different categories
  const getCategoryStyle = (cat: string) => {
    const lowerCat = cat.toLowerCase();

    if (lowerCat.includes('ai') || lowerCat.includes('ml')) {
      return 'bg-blue-50 text-blue-700 border-blue-200';
    }
    if (lowerCat.includes('tech') || lowerCat.includes('engineering')) {
      return 'bg-purple-50 text-purple-700 border-purple-200';
    }
    if (lowerCat.includes('design')) {
      return 'bg-pink-50 text-pink-700 border-pink-200';
    }
    if (lowerCat.includes('business')) {
      return 'bg-green-50 text-green-700 border-green-200';
    }

    // Default style
    return 'bg-warm-100 text-warm-700 border-warm-200';
  };

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${getCategoryStyle(category)}`}>
      {category}
    </span>
  );
};

export default Badge;
