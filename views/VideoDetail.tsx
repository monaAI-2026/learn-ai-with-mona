
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import YouTube, { YouTubePlayer, YouTubeEvent } from 'react-youtube';
import { Bookmark as BookmarkIcon, Loader2, Maximize, Minimize } from 'lucide-react';
import screenfull from 'screenfull';
import Header from '../components/Header';
import HighlightedWord from '../components/HighlightedWord';
import Tabs from '../components/ui/Tabs';
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

// ==================== VocabSection Component ====================
interface VocabSectionProps {
  title: string;
  items: Highlight[];
  type: 'language' | 'technical';
  bookmarks: Bookmark[];
  onToggleBookmark: (h: Highlight) => void;
}

const VocabSection: React.FC<VocabSectionProps> = ({ title, items, type, bookmarks, onToggleBookmark }) => {
  const colorClass = type === 'language' ? 'text-[#C5221F]' : 'text-[#1A73E8]';
  const bgClass = type === 'language' ? 'bg-[#FCE8E6]' : 'bg-[#E8F0FE]';
  const borderClass = type === 'language' ? 'border-[#F28B82]/30' : 'border-[#A8C7FA]/30';

  if (items.length === 0) return null;

  return (
    <div>
      <h4 className={`text-sm font-semibold ${colorClass} mb-3 px-1`}>{title}</h4>
      <div className="space-y-2">
        {items.map((item, idx) => {
          const isBookmarked = bookmarks.some(b => b.term === item.text);
          return (
            <div
              key={idx}
              className={`${bgClass} border ${borderClass} rounded-xl p-3 flex items-start justify-between gap-2 transition-colors hover:border-opacity-40`}
            >
              <div className="flex-1 min-w-0">
                <div className={`font-semibold text-sm ${colorClass}`}>
                  {item.text}
                  {item.pos && (
                    <span className="ml-2 text-[10px] font-normal text-warm-400 uppercase">{item.pos}</span>
                  )}
                </div>
                <p className="text-xs text-warm-600 mt-0.5 leading-relaxed">
                  {item.definition || item.translation}
                </p>
              </div>
              <button
                onClick={() => onToggleBookmark(item)}
                className={`flex-shrink-0 mt-0.5 transition-colors ${
                  isBookmarked ? 'text-accent' : 'text-warm-300 hover:text-warm-400'
                }`}
              >
                <BookmarkIcon size={14} className={isBookmarked ? 'fill-current' : ''} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ==================== VideoDetail Component ====================
const VideoDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [video, setVideo] = useState<VideoWithTimedTranscript | null>(null);
  const [showCn, setShowCn] = useState(true);
  const [activeTab, setActiveTab] = useState('transcript');
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

  // Collect all vocabulary from transcript
  const allVocabulary = React.useMemo(() => {
    if (!video?.transcriptParts) return { language: [] as Highlight[], technical: [] as Highlight[] };
    const seen = new Set<string>();
    const language: Highlight[] = [];
    const technical: Highlight[] = [];

    video.transcriptParts.forEach((part) => {
      part.highlights.forEach((h) => {
        const key = `${h.type}-${h.text.toLowerCase()}`;
        if (!seen.has(key)) {
          seen.add(key);
          if (h.type === 'language') language.push(h);
          else technical.push(h);
        }
      });
    });

    return { language, technical };
  }, [video?.transcriptParts]);

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
        let progressSegments: Segment[] = [];

        if (article.chapters && Array.isArray(article.chapters) && article.chapters.length > 0) {
          progressSegments = article.chapters.map((ch: any, index: number) => ({
            id: index,
            title: ch.title || `Chapter ${index + 1}`,
            startTime: parseTime(ch.start),
            endTime: parseTime(ch.end),
          }));
        } else if (article.segments && Array.isArray(article.segments)) {
          progressSegments = article.segments.map((seg: any, index: number) => ({
            id: index,
            title: (seg.en || seg.cn || `Segment ${index + 1}`).slice(0, 20),
            startTime: parseTime(seg.start),
            endTime: parseTime(seg.end),
          }));
        }

        const duration = article.metadata?.duration
          || (progressSegments.length > 0
              ? progressSegments[progressSegments.length - 1].endTime
              : 0);

        // Data Adapter: Transcript parts with time info
        // Track highlighted words to ensure each word only appears once (first occurrence)
        const highlightedWords = new Set<string>();

        const transcriptParts: TranscriptPartWithTime[] = article.segments?.map((seg: any) => {
          const highlights: Highlight[] = [];

          if (article.red_list && Array.isArray(article.red_list)) {
            article.red_list.forEach((item: any) => {
              const word = item.word || item.term;
              if (word && seg.en && seg.en.toLowerCase().includes(word.toLowerCase())) {
                // Only highlight if this word hasn't been highlighted before
                const wordKey = word.toLowerCase();
                if (!highlightedWords.has(wordKey)) {
                  highlightedWords.add(wordKey);
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
              }
            });
          }

          if (article.blue_list && Array.isArray(article.blue_list)) {
            article.blue_list.forEach((item: any) => {
              const term = item.term || item.word;
              if (term && seg.en && seg.en.toLowerCase().includes(term.toLowerCase())) {
                // Only highlight if this term hasn't been highlighted before
                const termKey = term.toLowerCase();
                if (!highlightedWords.has(termKey)) {
                  highlightedWords.add(termKey);
                  highlights.push({
                    text: term,
                    type: 'technical',
                    definition: item.definition_cn || item.definition || '',
                    translation: item.definition_cn || '',
                    example: item.example || '',
                  });
                }
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

    if (intervalRef.current) clearInterval(intervalRef.current);

    intervalRef.current = setInterval(async () => {
      if (playerRef.current && !isDragging) {
        try {
          const playerState = await playerRef.current.getPlayerState();
          if (playerState === 1) {
            const time = await playerRef.current.getCurrentTime();
            const totalDuration = await playerRef.current.getDuration();
            if (typeof time === 'number' && typeof totalDuration === 'number' && totalDuration > 0) {
              setCurrentTime(time);
              setProgress((time / totalDuration) * 100);
            }
          }
        } catch (e) { /* Player may not be ready */ }
      }
    }, 200);
  };

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  // Fullscreen change listener
  useEffect(() => {
    if (screenfull.isEnabled) {
      const handleChange = () => setIsFullscreen(screenfull.isFullscreen);
      screenfull.on('change', handleChange);
      return () => { screenfull.off('change', handleChange); };
    }
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (screenfull.isEnabled && playerContainerRef.current) {
      screenfull.toggle(playerContainerRef.current);
    }
  }, []);

  // Calculate active segment index
  const activeSegmentIndex = video?.transcriptParts?.findIndex((part, idx, arr) => {
    const nextPart = arr[idx + 1];
    if (currentTime >= part.startTime && currentTime < part.endTime) return true;
    if (nextPart && currentTime >= part.endTime && currentTime < nextPart.startTime) return true;
    return false;
  }) ?? -1;

  // Find current subtitle
  const currentSubtitle = video?.transcriptParts?.find(
    (part) => part.startTime <= currentTime && part.endTime >= currentTime
  );

  // Auto-scroll
  useEffect(() => {
    if (activeSegmentIndex >= 0 && transcriptRefs.current[activeSegmentIndex]) {
      transcriptRefs.current[activeSegmentIndex]?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }
  }, [activeSegmentIndex]);

  // Progress bar interaction
  const handleProgressMove = useCallback(async (e: MouseEvent | React.MouseEvent) => {
    if (!progressBarRef.current || !video) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const x = (e as MouseEvent).clientX - rect.left;
    const newProgress = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setProgress(newProgress);

    const duration = Number(video.duration) || 0;
    const newTime = (newProgress / 100) * duration;
    setCurrentTime(newTime);

    if (playerRef.current) {
      try { await playerRef.current.seekTo(newTime, true); } catch (e) { /* */ }
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
        type: h.type,
      }]);
    }
  };

  const isHighlightBookmarked = (h: Highlight) => bookmarks.some(b => b.term === h.text);

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

  const handleTranscriptClick = async (startTime: number) => {
    if (playerRef.current) {
      try {
        await playerRef.current.seekTo(startTime, true);
        setCurrentTime(startTime);
      } catch (e) { /* */ }
    }
  };

  // Format time display
  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  if (!video) return null;

  const segments = video.segments || [];
  const totalDuration = Number(video.duration) || (segments.length > 0 ? segments[segments.length - 1].endTime : 1800);

  const youtubeOpts = {
    width: '100%',
    height: '100%',
    playerVars: {
      modestbranding: 1,
      rel: 0,
      autoplay: 0,
      fs: 0,
    },
  };

  const panelTabs = [
    { key: 'transcript', label: 'Transcript' },
    { key: 'bookmark', label: 'Bookmarks' },
  ];

  return (
    <div className="min-h-screen bg-warm-50">
      <Header />

      <main className="container mx-auto px-4 sm:px-6 py-8 animate-page-enter max-w-[95vw] 2xl:max-w-[1800px]">
        {/* Video Title */}
        <h1 className="text-xl md:text-2xl font-medium text-warm-800 mb-5 leading-snug">
          {video.title}
        </h1>

        <div className="flex flex-col lg:flex-row gap-6 xl:gap-10">

          {/* Left Column: Video Area */}
          <div className="flex-1 min-w-0 flex flex-col space-y-4">
            {/* Player Container */}
            <div
              ref={playerContainerRef}
              className={`group relative bg-black rounded-2xl overflow-hidden shadow-md ${
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

              {/* Subtitle overlay */}
              <div className={`absolute left-1/2 -translate-x-1/2 w-[80%] text-center z-30 pointer-events-none flex flex-col justify-end min-h-[4rem] ${
                isFullscreen ? 'bottom-20' : 'bottom-16'
              }`}>
                {showCn && currentSubtitle && currentSubtitle.zh && (
                  <div className="relative overflow-hidden">
                    <p
                      key={currentSubtitle.startTime}
                      className={`font-medium text-white drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)] line-clamp-2 animate-slideUp ${
                        isFullscreen ? 'text-xl md:text-2xl' : 'text-xl md:text-2xl'
                      }`}
                    >
                      <span className="bg-black/40 backdrop-blur-sm px-3 py-1.5 rounded-lg box-decoration-clone leading-relaxed">
                        {currentSubtitle.zh}
                      </span>
                    </p>
                  </div>
                )}
              </div>

              {/* Control Buttons */}
              <div className="absolute bottom-4 right-4 flex space-x-2 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                <button
                  onClick={() => setShowCn(!showCn)}
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium border transition-all shadow-lg backdrop-blur-md ${
                    showCn ? 'bg-white/90 border-warm-200 text-warm-800' : 'bg-black/30 border-white/20 text-white/50'
                  }`}
                  title={showCn ? '关闭中文字幕' : '开启中文字幕'}
                >
                  中
                </button>
                {screenfull.isEnabled && (
                  <button
                    onClick={toggleFullscreen}
                    className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium border transition-all shadow-lg backdrop-blur-md bg-black/30 border-white/20 text-white hover:bg-white/90 hover:text-warm-800 hover:border-warm-200"
                    title={isFullscreen ? '退出全屏' : '全屏'}
                  >
                    {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
                  </button>
                )}
              </div>
            </div>

            {/* Progress Bar */}
            <div className="relative mt-2">
              <div
                ref={progressBarRef}
                className="w-full flex cursor-pointer"
                onMouseDown={onMouseDown}
              >
                {segments.map((seg, i) => {
                  const startPercent = (seg.startTime / totalDuration) * 100;
                  const endPercent = (seg.endTime / totalDuration) * 100;
                  const isPast = progress >= endPercent;
                  const isActive = progress >= startPercent && progress < endPercent;
                  const isFuture = progress < startPercent;
                  const partialWidth = isActive
                    ? ((progress - startPercent) / (endPercent - startPercent)) * 100
                    : 0;

                  return (
                    <div
                      key={i}
                      className="flex flex-col group/seg min-w-0"
                      style={{ flex: seg.endTime - seg.startTime }}
                    >
                      <div className={`flex h-2 ${i > 0 ? 'border-l-2 border-white' : ''}`}>
                        <div className="w-full h-full relative overflow-hidden transition-transform duration-200 origin-bottom group-hover/seg:scale-y-150 bg-warm-200 rounded-full">
                          {isPast && (
                            <div className="h-full bg-accent w-full rounded-full" />
                          )}
                          {isActive && (
                            <div
                              className="h-full bg-accent rounded-full"
                              style={{ width: `${partialWidth}%` }}
                            />
                          )}
                        </div>
                      </div>

                      {/* Chapter title */}
                      <div
                        className={`relative flex items-start mt-2 min-w-0 ${i > 0 ? 'border-l border-warm-200 pl-2' : ''}`}
                        onMouseEnter={() => setHoveredLabelIndex(i)}
                        onMouseLeave={() => setHoveredLabelIndex(null)}
                      >
                        <span className={`text-xs truncate transition-colors duration-200 ${
                          isPast || isActive ? 'font-medium text-warm-800' : 'font-normal text-warm-400'
                        }`}>
                          {seg.title}
                        </span>
                        {hoveredLabelIndex === i && (
                          <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 z-50 w-max max-w-[240px] px-4 py-2 bg-white rounded-xl shadow-lg border border-warm-200/60 text-sm font-medium text-warm-700 text-center leading-relaxed animate-scale-in">
                            {seg.title}
                            <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-white border-t border-l border-warm-200/60 rotate-45" />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right Column: Learning Panel */}
          <div className="w-full lg:w-[420px] xl:w-[480px] 2xl:w-[520px] flex-shrink-0 flex flex-col h-[calc(100vh-140px)] sticky top-24">
            <div className="bg-white border border-warm-200/60 rounded-2xl flex flex-col h-full shadow-sm overflow-hidden">
              {/* Tabs */}
              <div className="px-6">
                <Tabs
                  tabs={panelTabs}
                  activeKey={activeTab}
                  onChange={setActiveTab}
                />
              </div>

              {/* Content */}
              <div
                ref={scrollContainerRef}
                className="flex-1 overflow-y-auto p-6 space-y-4 scroll-smooth font-source-han scrollbar-thin"
              >
                {/* Transcript Tab */}
                {activeTab === 'transcript' && (
                  video.transcriptParts ? (
                    video.transcriptParts.map((part, idx) => {
                      const isActive = idx === activeSegmentIndex;
                      return (
                        <div
                          key={idx}
                          ref={el => transcriptRefs.current[idx] = el}
                          className={`leading-relaxed cursor-pointer transition-all duration-300 scroll-mt-6 rounded-lg px-3 py-2 -mx-3 ${
                            isActive
                              ? 'border-l-2 border-accent bg-accent-light/50'
                              : 'border-l-2 border-transparent hover:bg-warm-50'
                          }`}
                          onClick={() => handleTranscriptClick(part.startTime)}
                        >
                          {/* Timestamp */}
                          <span className="text-[10px] text-warm-400 font-mono mb-1 block">
                            {formatTime(part.startTime)}
                          </span>
                          <div className={`leading-relaxed text-pretty transition-colors ${
                            isActive
                              ? 'text-[15px] text-warm-800 font-medium'
                              : 'text-[13px] font-normal text-warm-600'
                          }`}>
                            {renderTextWithHighlights(part.en, part.highlights)}
                          </div>
                          {showCn && (
                            <div className={`leading-relaxed mt-1 transition-colors ${
                              isActive
                                ? 'text-[13px] text-warm-500 font-medium'
                                : 'text-[13px] font-normal text-warm-400'
                            }`}>
                              {part.zh}
                            </div>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <div className="flex flex-col items-center justify-center py-24 text-warm-300">
                      <Loader2 className="animate-spin mb-4" size={32} />
                      <p className="text-sm">Synthesizing insights...</p>
                    </div>
                  )
                )}

                {/* Bookmarks Tab */}
                {activeTab === 'bookmark' && (
                  <div className="space-y-4">
                    {bookmarks.length > 0 ? (
                      bookmarks.map((b) => (
                        <div key={b.id} className="group border-b border-warm-200/60 pb-4 last:border-0">
                          <div className="flex justify-between items-center mb-2">
                            <span className={`font-bold text-sm ${b.type === 'language' ? 'text-[#C5221F]' : 'text-[#1A73E8]'}`}>
                              {b.term}
                            </span>
                            <button
                              onClick={() => setBookmarks(bookmarks.filter(item => item.id !== b.id))}
                              className="text-accent hover:text-accent-hover transition-colors"
                            >
                              <BookmarkIcon size={14} fill="currentColor" />
                            </button>
                          </div>
                          <p className="text-xs text-warm-600 leading-relaxed">{b.definition}</p>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-24 text-warm-300">
                        <BookmarkIcon size={48} strokeWidth={1} className="mx-auto mb-4 opacity-50" />
                        <p className="text-sm">Saved words appear here</p>
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
