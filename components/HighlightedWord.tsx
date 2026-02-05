import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
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
  const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({});
  const [arrowStyle, setArrowStyle] = useState<React.CSSProperties>({});
  const [isPositioned, setIsPositioned] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const wordRef = useRef<HTMLSpanElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Handle mouse leave with delay
  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => {
      setShowTooltip(false);
      setIsPositioned(false);
    }, 200);
  };

  // Handle mouse enter to cancel hide timeout
  const handleMouseEnter = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setShowTooltip(true);
  };

  // Smart positioning with flip logic and edge detection
  useEffect(() => {
    if (showTooltip && tooltipRef.current && wordRef.current && !isPositioned) {
      // Small delay to ensure DOM is ready
      requestAnimationFrame(() => {
        if (!tooltipRef.current || !wordRef.current) return;

        const tooltip = tooltipRef.current;
        const word = wordRef.current;
        const tooltipRect = tooltip.getBoundingClientRect();
        const wordRect = word.getBoundingClientRect();

        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const padding = 16;
        const tooltipWidth = tooltipRect.width || 288;
        const tooltipHeight = tooltipRect.height || 200;
        const gap = 8;

        // === VERTICAL POSITIONING (Flip Logic) ===
        const spaceBelow = viewportHeight - wordRect.bottom;
        const spaceAbove = wordRect.top;
        const showAbove = spaceBelow < 300 && spaceAbove > tooltipHeight + gap;

        let top: number;
        if (showAbove) {
          top = wordRect.top - tooltipHeight - gap;
        } else {
          top = wordRect.bottom + gap;
        }

        // === HORIZONTAL POSITIONING (Edge Detection) ===
        const wordCenterInViewport = wordRect.left + wordRect.width / 2;
        let left: number;
        let arrowLeft: number;

        // Calculate if centered tooltip would overflow
        const centeredLeft = wordCenterInViewport - tooltipWidth / 2;
        const centeredRight = centeredLeft + tooltipWidth;

        if (centeredLeft < padding) {
          // Too close to left edge - align to left
          left = padding;
          arrowLeft = wordCenterInViewport - padding;
          arrowLeft = Math.max(Math.min(arrowLeft, tooltipWidth - 20), 20);
        } else if (centeredRight > viewportWidth - padding) {
          // Too close to right edge - align to right
          left = viewportWidth - tooltipWidth - padding;
          arrowLeft = wordCenterInViewport - left;
          arrowLeft = Math.max(Math.min(arrowLeft, tooltipWidth - 20), 20);
        } else {
          // Enough space - center it
          left = centeredLeft;
          arrowLeft = tooltipWidth / 2;
        }

        // Apply styles (using fixed positioning with viewport coordinates)
        const newTooltipStyle: React.CSSProperties = {
          position: 'fixed',
          top: `${top}px`,
          left: `${left}px`,
          opacity: 1,
        };

        const newArrowStyle: React.CSSProperties = {
          top: showAbove ? 'auto' : '-8px',
          bottom: showAbove ? '-8px' : 'auto',
          left: `${arrowLeft}px`,
        };

        setTooltipStyle(newTooltipStyle);
        setArrowStyle(newArrowStyle);
        setIsPositioned(true);
      });
    }
  }, [showTooltip, isPositioned]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const isLanguage = highlight.type === 'language';
  const colorClass = isLanguage ? 'text-[#C5221F]' : 'text-[#1A73E8]';
  const bgClass = 'bg-white';
  const borderClass = 'border-warm-200';

  // Render tooltip using Portal to avoid overflow issues
  const tooltipElement = showTooltip ? (
    <div
      ref={tooltipRef}
      className={`z-50 w-72 ${bgClass} bg-opacity-100 border ${borderClass} rounded-xl shadow-xl p-4 transition-opacity duration-200`}
      style={{
        ...tooltipStyle,
        opacity: isPositioned ? 1 : 0,
        visibility: isPositioned ? 'visible' : 'hidden',
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Arrow */}
      <div
        className={`absolute w-4 h-4 ${bgClass} bg-opacity-100`}
        style={{
          ...arrowStyle,
          opacity: 1,
          // Arrow pointing down (when tooltip is above)
          ...(arrowStyle.bottom === '-8px' ? {
            borderBottom: '1px solid rgb(229, 229, 229)',
            borderRight: '1px solid rgb(229, 229, 229)',
            transform: 'rotate(45deg)',
          } : {
            // Arrow pointing up (when tooltip is below)
            borderTop: '1px solid rgb(229, 229, 229)',
            borderLeft: '1px solid rgb(229, 229, 229)',
            transform: 'rotate(45deg)',
          })
        }}
      />

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
            <p className="text-xs text-warm-400 font-medium mb-1">例句</p>
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
  ) : null;

  return (
    <>
      <span
        ref={wordRef}
        className={`${colorClass} font-medium cursor-pointer hover:opacity-80 transition-opacity underline decoration-dotted decoration-1 underline-offset-2`}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {text}
      </span>
      {tooltipElement && createPortal(tooltipElement, document.body)}
    </>
  );
};

export default HighlightedWord;
