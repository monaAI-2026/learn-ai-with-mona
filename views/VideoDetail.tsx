
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Bookmark as BookmarkIcon, Info, Loader2, Play, Volume2, Plus, Check } from 'lucide-react';
import Header from '../components/Header';
import { MOCK_VIDEOS } from '../constants';
import { Video, Highlight, Bookmark, Segment } from '../types';

const VideoDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [video, setVideo] = useState<Video | null>(null);
  const [showChinese, setShowChinese] = useState(true);
  const [activeTab, setActiveTab] = useState<'learning' | 'bookmark'>('learning');
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [hoveredTerm, setHoveredTerm] = useState<Highlight | null>(null);
  const [popoverPos, setPopoverPos] = useState({ x: 0, y: 0 });
  const [isHoveringPopover, setIsHoveringPopover] = useState(false);
  
  // Progress Bar State
  const [progress, setProgress] = useState(15);
  const [isDragging, setIsDragging] = useState(false);
  const progressBarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const found = MOCK_VIDEOS.find(v => v.id === id);
    if (found) {
      setVideo(found);
    } else {
      navigate('/');
    }
  }, [id, navigate]);

  const handleProgressMove = (e: MouseEvent | React.MouseEvent) => {
    if (!progressBarRef.current) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const x = (e as MouseEvent).clientX - rect.left;
    const newProgress = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setProgress(newProgress);
  };

  const onMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    handleProgressMove(e);
  };

  useEffect(() => {
    if (isDragging) {
      const handleMouseMove = (e: MouseEvent) => handleProgressMove(e);
      const handleMouseUp = () => setIsDragging(false);
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging]);

  const toggleBookmark = (h: Highlight) => {
    const exists = bookmarks.find(b => b.term === h.text);
    if (exists) {
      setBookmarks(bookmarks.filter(b => b.term !== h.text));
    } else {
      setBookmarks([...bookmarks, { 
        id: Math.random().toString(36).substr(2, 9), 
        term: h.text, 
        definition: h.definition, 
        type: h.type 
      }]);
    }
  };

  const renderTextWithHighlights = (text: string, highlights: Highlight[]) => {
    let parts: React.ReactNode[] = [];
    let lastIndex = 0;
    const sortedHighlights = [...highlights].sort((a, b) => text.indexOf(a.text) - text.indexOf(b.text));
    sortedHighlights.forEach((h, i) => {
      const index = text.indexOf(h.text, lastIndex);
      if (index !== -1) {
        parts.push(text.substring(lastIndex, index));
        parts.push(
          <span
            key={i}
            className={`cursor-help font-medium border-b-2 transition-all duration-200 decoration-dotted underline-offset-4 ${
              h.type === 'language' 
                ? 'text-[#F14B4B] border-[#F14B4B]/30 hover:border-[#F14B4B] hover:bg-[#F14B4B]/5' 
                : 'text-[#4A90E2] border-[#4A90E2]/30 hover:border-[#4A90E2] hover:bg-[#4A90E2]/5'
            }`}
            onMouseEnter={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              setPopoverPos({ x: rect.left + rect.width / 2, y: rect.top });
              setHoveredTerm(h);
            }}
            onMouseLeave={() => {
              setTimeout(() => {
                if (!isHoveringPopover) setHoveredTerm(null);
              }, 150);
            }}
          >
            {h.text}
          </span>
        );
        lastIndex = index + h.text.length;
      }
    });
    parts.push(text.substring(lastIndex));
    return parts;
  };

  if (!video) return null;

  const showPopover = hoveredTerm !== null;
  const isBookmarked = hoveredTerm && bookmarks.some(b => b.term === hoveredTerm.text);

  // Calculate segment widths based on video.segments
  const segments = video.segments || [];
  const totalDuration = segments.length > 0 ? segments[segments.length - 1].endTime : 1800;

  return (
    <div className="min-h-screen bg-[#FDFDFD]">
      <Header />
      
      <main className="max-w-[1440px] mx-auto px-6 py-8">
        <div className="flex flex-col lg:flex-row gap-10">
          
          {/* Left Column: Video Area */}
          <div className="flex-1 flex flex-col space-y-4">
            <div className="group relative aspect-video bg-black rounded-sm overflow-hidden shadow-sm">
              <iframe
                width="100%"
                height="100%"
                src={`https://www.youtube.com/embed/${video.youtubeId}?modestbranding=1&rel=0&autoplay=0`}
                title={video.title}
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="w-full h-full pointer-events-auto"
              ></iframe>

              <div className="absolute bottom-4 right-4 flex space-x-2 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                <button 
                  onClick={() => setShowChinese(!showChinese)}
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium border transition-all shadow-lg backdrop-blur-md ${
                    showChinese ? 'bg-white/90 border-gray-200 text-gray-800' : 'bg-black/30 border-white/20 text-white/50'
                  }`}
                >
                  中
                </button>
                <button 
                  className="w-10 h-10 bg-white/90 backdrop-blur-md rounded-full flex items-center justify-center text-sm font-medium border border-gray-200 text-gray-800 shadow-lg"
                >
                  E
                </button>
              </div>
            </div>

            {/* Intelligent Segmented Progress Bar */}
            <div className="relative mt-2">
              <div 
                ref={progressBarRef}
                className="w-full h-8 flex items-center cursor-pointer group/bar relative"
                onMouseDown={onMouseDown}
              >
                {/* Segments Layer */}
                <div className="absolute inset-x-0 h-2 flex gap-[2px] items-center">
                  {segments.map((seg, i) => {
                    const width = ((seg.endTime - seg.startTime) / totalDuration) * 100;
                    const startPercent = (seg.startTime / totalDuration) * 100;
                    const endPercent = (seg.endTime / totalDuration) * 100;
                    
                    // Logic to see if this segment should be partially blue
                    const isFullyBefore = progress >= endPercent;
                    const isPartiallyBefore = progress > startPercent && progress < endPercent;
                    const partialWidth = isPartiallyBefore ? ((progress - startPercent) / (endPercent - startPercent)) * 100 : 0;

                    return (
                      <div 
                        key={i} 
                        className={`h-full relative group/seg transition-all duration-300 ease-out flex items-center ${
                          i === 0 ? 'rounded-l-full' : '' 
                        } ${i === segments.length - 1 ? 'rounded-r-full' : ''}`} 
                        style={{ flex: seg.endTime - seg.startTime }}
                      >
                        {/* Background segment */}
                        <div className={`
                          w-full h-2 bg-gray-100 transition-all duration-200
                          group-hover/seg:h-3 group-hover/seg:bg-gray-200
                          ${i === 0 ? 'rounded-l-full' : ''} 
                          ${i === segments.length - 1 ? 'rounded-r-full' : ''}
                        `}>
                          {/* Active part of this segment */}
                          {isFullyBefore && (
                            <div className={`h-full bg-[#9AC5FF] w-full ${i === 0 ? 'rounded-l-full' : ''}`} />
                          )}
                          {isPartiallyBefore && (
                            <div 
                              className={`h-full bg-[#9AC5FF] ${i === 0 ? 'rounded-l-full' : ''}`} 
                              style={{ width: `${partialWidth}%` }} 
                            />
                          )}
                        </div>

                        {/* Hover Content Label */}
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 opacity-0 group-hover/seg:opacity-100 transition-all duration-300 pointer-events-none z-50 transform translate-y-1 group-hover/seg:translate-y-0">
                          <div className="bg-white/95 backdrop-blur-sm px-3 py-2 rounded-lg shadow-xl border border-gray-100 flex flex-col items-center min-w-[120px]">
                            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-0.5">Segment {i + 1}</span>
                            <span className="text-[12px] font-medium text-gray-800 whitespace-nowrap">{seg.title}</span>
                          </div>
                          {/* Triangle */}
                          <div className="w-2 h-2 bg-white border-r border-b border-gray-100 rotate-45 mx-auto -mt-1 shadow-sm" />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Scrubber Pointer (Pointer with pointer-events-none to not interfere with segments hover) */}
                <div 
                  className="absolute h-8 w-[2.5px] bg-[#4A90E2] z-30 pointer-events-none transition-all duration-75 shadow-[0_0_10px_rgba(74,144,226,0.3)]"
                  style={{ left: `${progress}%`, transform: 'translateX(-50%)' }}
                >
                  {/* Decorative dot at top of pointer */}
                  <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-[#4A90E2] rounded-full shadow-sm" />
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Learning Interaction Area */}
          <div className="w-full lg:w-[480px] flex flex-col h-[calc(100vh-140px)] sticky top-24">
            <div className="bg-white border border-gray-200 rounded-sm flex flex-col h-full shadow-[0_4px_30px_rgba(0,0,0,0.03)] overflow-hidden">
              <div className="flex border-b border-gray-100 px-8">
                <button 
                  onClick={() => setActiveTab('learning')}
                  className={`flex-1 py-5 text-sm font-medium transition-colors relative ${
                    activeTab === 'learning' ? 'text-gray-900' : 'text-gray-400 hover:text-gray-600'
                  }`}
                >
                  Learning
                  {activeTab === 'learning' && <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gray-900" />}
                </button>
                <button 
                  onClick={() => setActiveTab('bookmark')}
                  className={`flex-1 py-5 text-sm font-medium transition-colors relative ${
                    activeTab === 'bookmark' ? 'text-gray-900' : 'text-gray-400 hover:text-gray-600'
                  }`}
                >
                  Bookmark
                  {activeTab === 'bookmark' && <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gray-900" />}
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8 space-y-10 scroll-smooth">
                {activeTab === 'learning' ? (
                  video.transcriptParts ? (
                    video.transcriptParts.map((part, idx) => (
                      <div key={idx} className="space-y-4 leading-relaxed group/part">
                        <div className="text-[#333333] font-normal text-[18px] tracking-tight">
                          {renderTextWithHighlights(part.en, part.highlights)}
                        </div>
                        {showChinese && (
                          <div className="text-[#999999] text-[15px] font-source-han leading-relaxed">
                            {part.zh}
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="flex flex-col items-center justify-center py-24 text-gray-300">
                      <Loader2 className="animate-spin mb-4" size={32} />
                      <p className="text-sm">Synthesizing insights...</p>
                    </div>
                  )
                ) : (
                  <div className="space-y-6">
                    {bookmarks.length > 0 ? (
                      bookmarks.map((b) => (
                        <div key={b.id} className="group border-b border-gray-100 pb-5 last:border-0">
                          <div className="flex justify-between items-center mb-2">
                            <span className={`font-bold text-sm ${b.type === 'language' ? 'text-[#F14B4B]' : 'text-[#4A90E2]'}`}>
                              {b.term}
                            </span>
                            <button 
                              onClick={() => setBookmarks(bookmarks.filter(item => item.id !== b.id))}
                              className="text-gray-300 hover:text-red-500 transition-colors"
                            >
                              <BookmarkIcon size={14} fill="currentColor" />
                            </button>
                          </div>
                          <p className="text-xs text-gray-600 leading-relaxed font-light">{b.definition}</p>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-24 text-gray-200">
                        <BookmarkIcon size={48} strokeWidth={1} className="mx-auto mb-4 opacity-50" />
                        <p className="text-sm font-light">Saved words appear here</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* High-end Minimalist Popover */}
      {showPopover && (
        <div 
          className="fixed z-[100] w-[320px] bg-white shadow-[0_20px_60px_rgba(0,0,0,0.12)] border border-gray-100/50 rounded-2xl overflow-hidden pointer-events-auto transform -translate-x-1/2 -translate-y-full mb-5 animate-in fade-in slide-in-from-bottom-3 duration-300 ease-out"
          style={{ left: popoverPos.x, top: popoverPos.y }}
          onMouseEnter={() => setIsHoveringPopover(true)}
          onMouseLeave={() => {
            setIsHoveringPopover(false);
            setHoveredTerm(null);
          }}
        >
          {/* Header Area */}
          <div className="px-6 py-5 bg-[#FAFAFA] border-b border-gray-50">
            <div className="flex items-center justify-between">
              <div className="flex flex-col gap-1.5">
                <h4 className={`text-xl font-bold tracking-tight ${hoveredTerm.type === 'language' ? 'text-[#F14B4B]' : 'text-[#4A90E2]'}`}>
                  {hoveredTerm.text}
                </h4>
                {hoveredTerm.type === 'language' && (
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5 text-gray-400">
                      <Volume2 size={14} className="cursor-pointer hover:text-gray-600 transition-colors" />
                      <span className="text-xs font-sf-mono tracking-wider">{hoveredTerm.phonetic || '/.../'}</span>
                    </div>
                    {hoveredTerm.pos && (
                      <span className="text-[10px] uppercase font-bold tracking-widest text-[#F14B4B]/60 bg-[#F14B4B]/5 px-2 py-0.5 rounded-full">
                        {hoveredTerm.pos}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
          
          {/* Body Area */}
          <div className="px-6 py-5 space-y-4">
            {hoveredTerm.type === 'language' ? (
              <>
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-gray-300 uppercase tracking-widest">Definition</span>
                  <p className="text-[14px] text-gray-700 leading-relaxed font-normal">
                    {hoveredTerm.definition}
                  </p>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-gray-300 uppercase tracking-widest">Translation</span>
                  <p className="text-[15px] text-gray-600 font-source-han leading-relaxed">
                    {hoveredTerm.translation}
                  </p>
                </div>
              </>
            ) : (
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-gray-300 uppercase tracking-widest">Technical Term</span>
                <p className="text-[15px] text-gray-700 font-source-han leading-relaxed">
                  {hoveredTerm.translation}
                </p>
                <p className="text-[13px] text-gray-500 mt-2 leading-relaxed">
                  {hoveredTerm.definition}
                </p>
              </div>
            )}
          </div>

          {/* Footer Area */}
          <div className="px-6 py-4 bg-[#FAFAFA] border-t border-gray-50 flex justify-end">
            <button 
              onClick={() => toggleBookmark(hoveredTerm)}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold tracking-wide transition-all duration-300 active:scale-95 ${
                isBookmarked 
                  ? 'bg-gray-100 text-gray-400 cursor-default' 
                  : 'bg-white border border-gray-200 text-gray-700 hover:border-gray-800 hover:shadow-sm'
              }`}
            >
              {isBookmarked ? (
                <>
                  <Check size={14} />
                  <span>Collected</span>
                </>
              ) : (
                <>
                  <Plus size={14} />
                  <span>Collect Word</span>
                </>
              )}
            </button>
          </div>

          {/* Triangle Pointer */}
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-white border-r border-b border-gray-50 rotate-45 shadow-[4px_4px_10px_rgba(0,0,0,0.02)]" />
        </div>
      )}
    </div>
  );
};

export default VideoDetail;
