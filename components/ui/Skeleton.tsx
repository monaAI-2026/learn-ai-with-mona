import React from 'react';

export const SkeletonCard: React.FC = () => {
  return (
    <div className="bg-white rounded-2xl overflow-hidden border border-warm-200/60 animate-pulse">
      {/* Thumbnail skeleton */}
      <div className="aspect-video bg-warm-100" />

      {/* Content skeleton */}
      <div className="p-5 space-y-3">
        {/* Category badges skeleton */}
        <div className="flex gap-1.5">
          <div className="h-5 w-16 bg-warm-100 rounded-full" />
          <div className="h-5 w-20 bg-warm-100 rounded-full" />
        </div>

        {/* Title skeleton */}
        <div className="space-y-2">
          <div className="h-4 bg-warm-100 rounded w-full" />
          <div className="h-4 bg-warm-100 rounded w-3/4" />
        </div>

        {/* Description skeleton */}
        <div className="space-y-1.5">
          <div className="h-3 bg-warm-100 rounded w-full" />
          <div className="h-3 bg-warm-100 rounded w-5/6" />
        </div>
      </div>
    </div>
  );
};
