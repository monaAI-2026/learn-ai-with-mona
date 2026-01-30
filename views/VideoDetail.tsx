
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate } from 'react-router-dom';
import YouTube, { YouTubePlayer, YouTubeEvent } from 'react-youtube';
import { Bookmark as BookmarkIcon, Volume2, Check, Loader2, Maximize, Minimize } from 'lucide-react';
import screenfull from 'screenfull';
import Header from '../components/Header';
import { Video, Highlight, Bookmark, Segment } from '../types';

// API Base URL - 支持环境变量配置
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// Extended TranscriptPart with time information for sync
interface TranscriptPartWithTime {
  en: string;
  zh: string;
  highlights: Highlight[];
  startTime: number;
  endTime: number;
}

// Extended Video type for internal use
interface VideoWithTimedTranscript extends Omit<Video, 'transcriptParts'> {
  transcriptParts?: TranscriptPartWithTime[];
}

// ==================== HighlightedWord Component (Portal-based) ====================
interface HighlightedWordProps {
  text: string;
  highlight: Highlight;
  isBookmarked: boolean;
  onToggleBookmark: () => void;
}

interface PopoverCoords {
  top: number;
  left: number;
  align: 'left' | 'center' | 'right';
  position: 'top' | 'bottom';
}

const HighlightedWord: React.FC<HighlightedWordProps> = ({
  text,
  highlight,
  isBookmarked,
  onToggleBookmark,
}) => {
  // coords 不为 null 时表示弹窗显示
  const [coords, setCoords] = useState<PopoverCoords | null>(null);
  const closeTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Helper function: render example sentence with bold target word
  const renderExampleWithBold = (sentence: string, word: string): React.ReactNode => {
    const regex = new RegExp(`(${word})`, 'gi');
    const parts = sentence.split(regex);

    return parts.map((part, index) => {
      if (part.toLowerCase() === word.toLowerCase()) {
        return (
          <span key={index} className="font-bold text-gray-800 not-italic">
            {part}
          </span>
        );
      }
      return part;
    });
  };

  // Clear timer helper
  const clearCloseTimer = () => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  // Delayed close with hover tunneling
  const startCloseTimer = () => {
    clearCloseTimer();
    closeTimerRef.current = setTimeout(() => {
      setCoords(null);
    }, 200);
  };

  // Mouse enter word - calculate position and open popover
  const handleWordMouseEnter = (e: React.MouseEvent<HTMLSpanElement>) => {
    clearCloseTimer();

    const rect = e.currentTarget.getBoundingClientRect();

    // 垂直空间判断
    const spaceBelow = window.innerHeight - rect.bottom;
    const showOnTop = spaceBelow < 300; // 如果下方空间不足 300px，就显示在上方

    // 计算弹窗位置
    const top = showOnTop
      ? rect.top + window.scrollY - 8
      : rect.bottom + window.scrollY + 8;
    const left = rect.left + rect.width / 2;

    // 边缘检测
    let align: 'left' | 'center' | 'right' = 'center';
    if (rect.left < 150) {
      align = 'left';
    } else if (rect.right > window.innerWidth - 150) {
      align = 'right';
    }

    setCoords({ top, left, align, position: showOnTop ? 'top' : 'bottom' });
  };

  // Mouse leave word - start delayed close
  const handleWordMouseLeave = () => {
    startCloseTimer();
  };

  // Mouse enter popover - keep open
  const handlePopoverMouseEnter = () => {
    clearCloseTimer();
  };

  // Mouse leave popover - start delayed close
  const handlePopoverMouseLeave = () => {
    startCloseTimer();
  };

  // Close on scroll - capture phase to detect scrolling in any container
  useEffect(() => {
    if (!coords) return;

    const handleScroll = () => {
      setCoords(null);
    };

    window.addEventListener('scroll', handleScroll, { capture: true });
    return () => {
      window.removeEventListener('scroll', handleScroll, { capture: true });
    };
  }, [coords]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => clearCloseTimer();
  }, []);

  const isLanguage = highlight.type === 'language';
  const colorClass = isLanguage
    ? 'text-[#F77979] border-[#F77979]/30 hover:border-[#F77979] hover:bg-[#F77979]/5'
    : 'text-[#68AAFF] border-[#68AAFF]/30 hover:border-[#68AAFF] hover:bg-[#68AAFF]/5';
  const titleColor = isLanguage ? 'text-[#F14B4B]' : 'text-[#4A90E2]';

  // 计算弹窗的 style
  const getPopoverStyle = (): React.CSSProperties => {
    if (!coords) return {};

    const baseStyle: React.CSSProperties = {
      position: 'fixed',
      top: coords.top,
      zIndex: 9999,
    };

    // 根据 position 和 align 动态组合 transform
    const translateY = coords.position === 'top' ? '-100%' : '0';
    let translateX = '0';
    let left = coords.left;

    switch (coords.align) {
      case 'left':
        left = coords.left - 20;
        translateX = '0';
        break;
      case 'right':
        left = coords.left + 20;
        translateX = '-100%';
        break;
      case 'center':
      default:
        translateX = '-50%';
        break;
    }

    return {
      ...baseStyle,
      left,
      transform: `translate(${translateX}, ${translateY})`,
    };
  };

  // 计算三角箭头的水平位置
  const getArrowHorizontalClass = () => {
    switch (coords?.align) {
      case 'left':
        return 'left-4';
      case 'right':
        return 'right-4';
      case 'center':
      default:
        return 'left-1/2 -translate-x-1/2';
    }
  };

  // 计算三角箭头的垂直位置和样式
  const getArrowVerticalStyle = () => {
    if (coords?.position === 'top') {
      // 卡片在上方时，三角形在底部，箭头朝下
      return '-bottom-[6px] border-b border-r';
    } else {
      // 卡片在下方时，三角形在顶部，箭头朝上
      return '-top-[6px] border-t border-l';
    }
  };

  return (
    <>
      {/* Highlighted word */}
      <span
        className={`cursor-help font-black border-b-2 transition-all duration-200 decoration-dotted underline-offset-4 ${colorClass}`}
        onMouseEnter={handleWordMouseEnter}
        onMouseLeave={handleWordMouseLeave}
      >
        {text}
      </span>

      {/* Popover - rendered via Portal to document.body */}
      {coords && createPortal(
        <div
          style={getPopoverStyle()}
          className={`relative w-[280px] bg-white shadow-[0_12px_40px_rgba(0,0,0,0.15)] border border-gray-100 rounded-xl overflow-visible pointer-events-auto animate-in fade-in duration-200 ease-out ${
            coords.position === 'top' ? 'slide-in-from-bottom-2' : 'slide-in-from-top-2'
          }`}
          onMouseEnter={handlePopoverMouseEnter}
          onMouseLeave={handlePopoverMouseLeave}
        >
          {/* Bookmark button - top right corner */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleBookmark();
            }}
            className={`absolute top-4 right-4 z-10 transition-colors duration-300 ${
              isBookmarked
                ? 'text-[#F77979] fill-current'
                : 'text-gray-300 hover:text-gray-500'
            }`}
          >
            <BookmarkIcon size={18} className={isBookmarked ? 'fill-current' : ''} />
          </button>
          {/* Arrow - adjusts based on position */}
          <div
            className={`absolute w-3 h-3 bg-white border-gray-100 rotate-45 ${getArrowVerticalStyle()} ${getArrowHorizontalClass()}`}
          />

          {/* Header - Word + Phonetic */}
          <div className="px-5 py-4 bg-[#FAFAFA] border-b border-gray-100 rounded-t-xl">
            <h4 className={`text-lg font-bold tracking-tight ${titleColor}`}>
              {highlight.text}
            </h4>
            {isLanguage && !(highlight.word || highlight.text).trim().includes(' ') && (
              <div className="flex items-center gap-2 mt-1">
                <Volume2 size={14} className="text-gray-400 cursor-pointer hover:text-gray-600 transition-colors" />
                <span className="text-xs text-gray-400 font-mono tracking-wider">
                  {highlight.phonetic || '/.../' }
                </span>
                {highlight.pos && (
                  <span className="text-[10px] uppercase font-bold tracking-widest text-[#F14B4B]/60 bg-[#F14B4B]/5 px-2 py-0.5 rounded-full">
                    {highlight.pos}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Body - Definition + Example */}
          <div className="px-5 py-4 space-y-3">
            {/* Definition - Chinese only */}
            <p className="text-sm text-gray-700 leading-relaxed">
              {highlight.definition || highlight.translation}
            </p>

            {/* Example sentence */}
            {highlight.example && (
              <div className="bg-gray-50 rounded-lg px-3 py-2">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">
                  例句
                </span>
                <p className="mb-1 text-[13px] text-gray-600 italic leading-relaxed">
                  {renderExampleWithBold(highlight.example, highlight.word || highlight.text)}
                </p>
                {highlight.example_cn && (
                  <p className="mt-1 text-[12px] text-gray-500 font-normal not-italic leading-relaxed">
                    {highlight.example_cn}
                  </p>
                )}
              </div>
            )}
          </div>

        </div>,
        document.body
      )}
    </>
  );
};

// ==================== VideoDetail Component ====================
const VideoDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [video, setVideo] = useState<VideoWithTimedTranscript | null>(null);
  const [showCn, setShowCn] = useState(true);
  const [activeTab, setActiveTab] = useState<'learning' | 'bookmark'>('learning');
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [hoveredLabelIndex, setHoveredLabelIndex] = useState<number | null>(null);

  // Progress & Time Sync State
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const progressBarRef = useRef<HTMLDivElement>(null);

  // YouTube Player State
  const playerRef = useRef<YouTubePlayer | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-scroll refs
  const transcriptRefs = useRef<(HTMLDivElement | null)[]>([]);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Fullscreen refs and state
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Helper function: parse "MM:SS" to seconds
  const parseTime = useCallback((timeStr: string): number => {
    if (!timeStr || typeof timeStr !== 'string') return 0;
    const parts = timeStr.split(':');
    if (parts.length !== 2) return 0;
    const minutes = parseInt(parts[0], 10) || 0;
    const seconds = parseInt(parts[1], 10) || 0;
    return minutes * 60 + seconds;
  }, []);

  useEffect(() => {
    const fetchArticle = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/articles`);
        const responseData = await response.json();
        const articles = responseData.data || [];
        const article = articles.find((a: any) => a.id === id);

        if (!article) {
          navigate('/');
          return;
        }

        // Data Adapter: Progress bar segments
        // Priority: article.chapters > article.segments
        let progressSegments: Segment[] = [];

        if (article.chapters && Array.isArray(article.chapters) && article.chapters.length > 0) {
          // Use chapters for progress bar (sparse segments)
          progressSegments = article.chapters.map((ch: any, index: number) => ({
            id: index,
            title: ch.title || `Chapter ${index + 1}`,
            startTime: parseTime(ch.start),
            endTime: parseTime(ch.end),
          }));
        } else if (article.segments && Array.isArray(article.segments)) {
          // Fallback: use segments
          progressSegments = article.segments.map((seg: any, index: number) => ({
            id: index,
            title: (seg.en || seg.cn || `Segment ${index + 1}`).slice(0, 20),
            startTime: parseTime(seg.start),
            endTime: parseTime(seg.end),
          }));
        }

        // Calculate video total duration
        const duration = article.metadata?.duration
          || (progressSegments.length > 0
              ? progressSegments[progressSegments.length - 1].endTime
              : 0);

        // Data Adapter: Transcript parts with time info
        const transcriptParts: TranscriptPartWithTime[] = article.segments?.map((seg: any) => {
          // Dynamically generate highlights
          const highlights: Highlight[] = [];

          // Process red_list (language type)
          if (article.red_list && Array.isArray(article.red_list)) {
            article.red_list.forEach((item: any) => {
              const word = item.word || item.term;
              if (word && seg.en && seg.en.toLowerCase().includes(word.toLowerCase())) {
                highlights.push({
                  text: word,
                  type: 'language',
                  definition: item.definition_cn || item.definition || '',
                  translation: item.definition_cn || '',
                  phonetic: item.pronunciation || '',
                  pos: item.pos || '',
                  example: item.example || '',
                  example_cn: item.example_cn || '',
                });
              }
            });
          }

          // Process blue_list (technical type)
          if (article.blue_list && Array.isArray(article.blue_list)) {
            article.blue_list.forEach((item: any) => {
              const term = item.term || item.word;
              if (term && seg.en && seg.en.toLowerCase().includes(term.toLowerCase())) {
                highlights.push({
                  text: term,
                  type: 'technical',
                  definition: item.definition_cn || item.definition || '',
                  translation: item.definition_cn || '',
                  example: item.example || '',
                });
              }
            });
          }

          return {
            en: seg.en || '',
            zh: seg.cn || '',
            highlights,
            startTime: parseTime(seg.start),
            endTime: parseTime(seg.end),
          };
        }) || [];

        // Transform to Video format
        const transformedVideo: VideoWithTimedTranscript = {
          id: article.id,
          youtubeId: article.metadata?.id || '',
          title: article.metadata?.title || '',
          description: article.metadata?.description || '',
          categories: [],
          thumbnail: article.metadata?.thumbnail || '',
          duration: String(duration),
          segments: progressSegments,
          transcriptParts,
        };

        setVideo(transformedVideo);
      } catch (error) {
        console.error('Failed to fetch article:', error);
        navigate('/');
      }
    };

    fetchArticle();
  }, [id, navigate, parseTime]);

  // YouTube Player ready handler
  const onPlayerReady = (event: YouTubeEvent) => {
    playerRef.current = event.target;

    // Start interval to sync current time every 500ms
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    intervalRef.current = setInterval(async () => {
      if (playerRef.current && !isDragging) {
        try {
          const playerState = await playerRef.current.getPlayerState();
          // Only update time when playing (state === 1)
          if (playerState === 1) {
            const time = await playerRef.current.getCurrentTime();
            const totalDuration = await playerRef.current.getDuration();

            if (typeof time === 'number' && typeof totalDuration === 'number' && totalDuration > 0) {
              setCurrentTime(time);
              setProgress((time / totalDuration) * 100);
            }
          }
        } catch (e) {
          // Player may not be ready yet
        }
      }
    }, 200);
  };

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  // Fullscreen change listener
  useEffect(() => {
    if (screenfull.isEnabled) {
      const handleChange = () => {
        setIsFullscreen(screenfull.isFullscreen);
      };
      screenfull.on('change', handleChange);
      return () => {
        screenfull.off('change', handleChange);
      };
    }
  }, []);

  // Toggle fullscreen function
  const toggleFullscreen = useCallback(() => {
    if (screenfull.isEnabled && playerContainerRef.current) {
      screenfull.toggle(playerContainerRef.current);
    }
  }, []);

  // Calculate active segment index based on currentTime
  const activeSegmentIndex = video?.transcriptParts?.findIndex((part, idx, arr) => {
    const nextPart = arr[idx + 1];
    // Current time is within this part's time range
    if (currentTime >= part.startTime && currentTime < part.endTime) {
      return true;
    }
    // Handle edge case: if between segments, use the earlier one
    if (nextPart && currentTime >= part.endTime && currentTime < nextPart.startTime) {
      return true;
    }
    return false;
  }) ?? -1;

  // Find current subtitle based on currentTime
  const currentSubtitle = video?.transcriptParts?.find(
    (part) => part.startTime <= currentTime && part.endTime >= currentTime
  );

  // Auto-scroll when activeSegmentIndex changes
  useEffect(() => {
    if (activeSegmentIndex >= 0 && transcriptRefs.current[activeSegmentIndex]) {
      transcriptRefs.current[activeSegmentIndex]?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }
  }, [activeSegmentIndex]);

  // Progress bar interaction handlers
  const handleProgressMove = useCallback(async (e: MouseEvent | React.MouseEvent) => {
    if (!progressBarRef.current || !video) return;

    const rect = progressBarRef.current.getBoundingClientRect();
    const x = (e as MouseEvent).clientX - rect.left;
    const newProgress = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setProgress(newProgress);

    // Calculate new time and seek
    const duration = Number(video.duration) || 0;
    const newTime = (newProgress / 100) * duration;
    setCurrentTime(newTime);

    if (playerRef.current) {
      try {
        await playerRef.current.seekTo(newTime, true);
      } catch (e) {
        // Player may not be ready
      }
    }
  }, [video]);

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
  }, [isDragging, handleProgressMove]);

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

  const isHighlightBookmarked = (h: Highlight) => {
    return bookmarks.some(b => b.term === h.text);
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
          <HighlightedWord
            key={i}
            text={h.text}
            highlight={h}
            isBookmarked={isHighlightBookmarked(h)}
            onToggleBookmark={() => toggleBookmark(h)}
          />
        );
        lastIndex = index + h.text.length;
      }
    });
    parts.push(text.substring(lastIndex));
    return parts;
  };

  // Click on transcript to seek
  const handleTranscriptClick = async (startTime: number) => {
    if (playerRef.current) {
      try {
        await playerRef.current.seekTo(startTime, true);
        setCurrentTime(startTime);
      } catch (e) {
        // Player may not be ready
      }
    }
  };

  if (!video) return null;

  // Calculate segment widths based on video.segments
  const segments = video.segments || [];
  const totalDuration = Number(video.duration) || (segments.length > 0 ? segments[segments.length - 1].endTime : 1800);

  // YouTube player options
  const youtubeOpts = {
    width: '100%',
    height: '100%',
    playerVars: {
      modestbranding: 1,
      rel: 0,
      autoplay: 0,
      fs: 0, // Hide native fullscreen button to guide users to our custom button
    },
  };

  return (
    <div className="min-h-screen bg-[#FDFDFD]">
      <Header />

      <main className="max-w-[1440px] mx-auto px-6 py-8">
        <div className="flex flex-col lg:flex-row gap-10">

          {/* Left Column: Video Area */}
          <div className="flex-1 flex flex-col space-y-4">
            {/* Player Container - wraps YouTube and subtitles for true fullscreen */}
            <div
              ref={playerContainerRef}
              className={`group relative bg-black rounded-sm overflow-hidden shadow-sm ${
                isFullscreen ? 'w-screen h-screen' : 'aspect-video'
              }`}
            >
              <YouTube
                videoId={video.youtubeId}
                opts={youtubeOpts}
                onReady={onPlayerReady}
                className="w-full h-full"
                iframeClassName="w-full h-full"
              />

              {/* 字幕容器：宽 80%，底部固定，YouTube 风格纯中文字幕 */}
              <div className={`absolute left-1/2 -translate-x-1/2 w-[80%] text-center z-30 pointer-events-none flex flex-col justify-end min-h-[4rem] ${
                isFullscreen ? 'bottom-20' : 'bottom-16'
              }`}>
                {/* 只在 showCn 为真且有内容时显示 */}
                {showCn && currentSubtitle && currentSubtitle.zh && (
                  <div className="relative overflow-hidden">
                    <p
                      key={currentSubtitle.startTime}
                      className={`font-medium text-white drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)] line-clamp-2 animate-slideUp ${
                        isFullscreen ? 'text-xl md:text-2xl' : 'text-xl md:text-2xl'
                      }`}
                    >
                      <span className="bg-black/50 px-2 py-1 rounded box-decoration-clone leading-relaxed">
                        {currentSubtitle.zh}
                      </span>
                    </p>
                  </div>
                )}
              </div>

              {/* Control Buttons - 中文字幕开关 & Fullscreen */}
              <div className="absolute bottom-4 right-4 flex space-x-2 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                <button
                  onClick={() => setShowCn(!showCn)}
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium border transition-all shadow-lg backdrop-blur-md ${
                    showCn ? 'bg-white/90 border-gray-200 text-gray-800' : 'bg-black/30 border-white/20 text-white/50'
                  }`}
                  title={showCn ? '关闭中文字幕' : '开启中文字幕'}
                >
                  中
                </button>
                {/* Fullscreen Toggle Button */}
                {screenfull.isEnabled && (
                  <button
                    onClick={toggleFullscreen}
                    className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium border transition-all shadow-lg backdrop-blur-md bg-black/30 border-white/20 text-white hover:bg-white/90 hover:text-gray-800 hover:border-gray-200"
                    title={isFullscreen ? '退出全屏' : '全屏'}
                  >
                    {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
                  </button>
                )}
              </div>
            </div>

            {/* Intelligent Segmented Progress Bar */}
            <div className="relative mt-2">
              <div
                ref={progressBarRef}
                className="w-full flex cursor-pointer"
                onMouseDown={onMouseDown}
              >
                {segments.map((seg, i) => {
                  const startPercent = (seg.startTime / totalDuration) * 100;
                  const endPercent = (seg.endTime / totalDuration) * 100;

                  // Determine segment state: past, active, or future
                  const isPast = progress >= endPercent;
                  const isActive = progress >= startPercent && progress < endPercent;
                  const isFuture = progress < startPercent;

                  // Calculate partial fill for active segment
                  const partialWidth = isActive
                    ? ((progress - startPercent) / (endPercent - startPercent)) * 100
                    : 0;

                  return (
                    <div
                      key={i}
                      className="flex flex-col group/seg min-w-0"
                      style={{ flex: seg.endTime - seg.startTime }}
                    >
                      {/* Progress bar with left border separator */}
                      <div className={`flex h-4 ${i > 0 ? 'border-l border-white' : ''}`}>
                        <div className="w-full h-full relative overflow-hidden transition-transform duration-200 origin-bottom group-hover/seg:scale-y-125 bg-gray-100">
                          {/* Filled portion */}
                          {isPast && (
                            <div className="h-full bg-[#A5CCFF] w-full" />
                          )}
                          {isActive && (
                            <div
                              className="h-full bg-[#A5CCFF]"
                              style={{ width: `${partialWidth}%` }}
                            />
                          )}
                        </div>
                      </div>

                      {/* Chapter title below the bar */}
                      <div
                        className={`relative flex items-start mt-2 min-w-0 ${i > 0 ? 'border-l border-gray-200 pl-2' : ''}`}
                        onMouseEnter={() => setHoveredLabelIndex(i)}
                        onMouseLeave={() => setHoveredLabelIndex(null)}
                      >
                        <span className={`
                          text-xs truncate transition-colors duration-200
                          ${isPast || isActive ? 'font-medium text-gray-900' : ''}
                          ${isFuture ? 'font-normal text-gray-400' : ''}
                        `}>
                          {seg.title}
                        </span>
                        {hoveredLabelIndex === i && (
                          <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 z-50 w-max max-w-[240px] px-4 py-2 bg-white rounded-lg shadow-[0_8px_30px_rgba(0,0,0,0.12)] border border-gray-100 text-sm font-medium text-gray-700 text-center leading-relaxed animate-in fade-in zoom-in-95 duration-100">
                            {seg.title}
                            {/* 顶部小三角 */}
                            <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-white border-t border-l border-gray-100 rotate-45"></div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
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

              <div
                ref={scrollContainerRef}
                className="flex-1 overflow-y-auto p-8 space-y-4 scroll-smooth font-source-han"
              >
                {activeTab === 'learning' ? (
                  video.transcriptParts ? (
                    video.transcriptParts.map((part, idx) => {
                      const isActive = idx === activeSegmentIndex;
                      return (
                        <div
                          key={idx}
                          ref={el => transcriptRefs.current[idx] = el}
                          className={`leading-relaxed group/part cursor-pointer transition-opacity duration-300 scroll-mt-6 ${
                            isActive ? 'opacity-100' : 'opacity-40 hover:opacity-70'
                          }`}
                          onClick={() => handleTranscriptClick(part.startTime)}
                        >
                          <div className={`leading-relaxed text-pretty ${
                            isActive ? 'text-[15px] text-[#222222] font-medium' : 'text-[13px] font-normal'
                          }`}>
                            {renderTextWithHighlights(part.en, part.highlights)}
                          </div>
                          {showCn && (
                            <div className={`leading-relaxed mt-1 ${
                              isActive ? 'text-[13px] text-[#717171] font-medium' : 'text-[13px] font-normal'
                            }`}>
                              {part.zh}
                            </div>
                          )}
                        </div>
                      );
                    })
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
    </div>
  );
};

export default VideoDetail;
