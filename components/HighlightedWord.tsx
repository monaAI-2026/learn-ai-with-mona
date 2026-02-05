import React, { useState, useRef, useEffect } from 'react';
import { Bookmark } from 'lucide-react';

interface Highlight {
  text: string;
  type: 'language' | 'technical';
  definition: string;
  translation?: string;
  phonetic?: string;
  pos?: string;
  example?: string;
  example_cn?: string;
}

interface HighlightedWordProps {
  text: string;
  highlight: Highlight;
  isBookmarked: boolean;
  onToggleBookmark: () => void;
}

const HighlightedWord: React.FC<HighlightedWordProps> = ({
  text,
  highlight,
  isBookmarked,
  onToggleBookmark,
}) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const wordRef = useRef<HTMLSpanElement>(null);

  // Close tooltip when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        tooltipRef.current &&
        wordRef.current &&
        !tooltipRef.current.contains(event.target as Node) &&
        !wordRef.current.contains(event.target as Node)
      ) {
        setShowTooltip(false);
      }
    };

    if (showTooltip) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showTooltip]);

  const isLanguage = highlight.type === 'language';
  const colorClass = isLanguage ? 'text-[#C5221F]' : 'text-[#1A73E8]';
  const bgClass = isLanguage ? 'bg-[#FCE8E6]' : 'bg-[#E8F0FE]';
  const borderClass = isLanguage ? 'border-[#F28B82]/30' : 'border-[#A8C7FA]/30';

  return (
    <span className="relative inline-block">
      <span
        ref={wordRef}
        className={`${colorClass} font-medium cursor-pointer hover:opacity-80 transition-opacity underline decoration-dotted decoration-1 underline-offset-2`}
        onClick={() => setShowTooltip(!showTooltip)}
      >
        {text}
      </span>

      {showTooltip && (
        <div
          ref={tooltipRef}
          className={`absolute left-1/2 -translate-x-1/2 mt-2 z-50 w-72 ${bgClass} border ${borderClass} rounded-xl shadow-lg p-4 animate-scale-in`}
          style={{ top: '100%' }}
        >
          {/* Arrow */}
          <div className={`absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 ${bgClass} border-t border-l ${borderClass} rotate-45`} />

          {/* Content */}
          <div className="relative space-y-2">
            {/* Word and phonetic */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <div className={`font-semibold text-sm ${colorClass}`}>
                  {highlight.text}
                  {highlight.pos && (
                    <span className="ml-2 text-[10px] font-normal text-warm-400 uppercase">
                      {highlight.pos}
                    </span>
                  )}
                </div>
                {highlight.phonetic && (
                  <div className="text-xs text-warm-500 mt-0.5">{highlight.phonetic}</div>
                )}
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleBookmark();
                }}
                className={`flex-shrink-0 transition-colors ${
                  isBookmarked ? colorClass : 'text-warm-300 hover:text-warm-400'
                }`}
              >
                <Bookmark size={14} className={isBookmarked ? 'fill-current' : ''} />
              </button>
            </div>

            {/* Definition */}
            <p className="text-xs text-warm-700 leading-relaxed">
              {highlight.definition || highlight.translation}
            </p>

            {/* Example */}
            {highlight.example && (
              <div className="pt-2 border-t border-warm-200/50 space-y-1">
                <p className="text-xs text-warm-600 italic leading-relaxed">
                  &ldquo;{highlight.example}&rdquo;
                </p>
                {highlight.example_cn && (
                  <p className="text-xs text-warm-500 leading-relaxed">
                    {highlight.example_cn}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </span>
  );
};

export default HighlightedWord;
