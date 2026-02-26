
import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import { useParams, useNavigate } from 'react-router-dom';
import YouTube, { YouTubePlayer, YouTubeEvent } from 'react-youtube';
import { Maximize, Minimize, Send, Languages, MessageCircle, Copy, RotateCcw, Check, X } from 'lucide-react';
import screenfull from 'screenfull';
import Header from '../components/Header';
import HighlightedWord from '../components/HighlightedWord';
import { Video, Highlight, Segment, QuizQuestion } from '../types';

// API Base URL
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3099';

interface TranscriptPartWithTime {
  en: string;
  zh: string;
  highlights: Highlight[];
  startTime: number;
  endTime: number;
}

interface VideoWithTimedTranscript extends Omit<Video, 'transcriptParts'> {
  transcriptParts?: TranscriptPartWithTime[];
}

// 字幕分页：超过阈值时按中文标点拆成两页
const SUBTITLE_PAGE_LEN = 22;
function splitSubtitle(text: string): [string, string] | null {
  if (text.length <= SUBTITLE_PAGE_LEN) return null;
  const mid = Math.floor(text.length / 2);
  const puncts = ['，', '。', '；', '！', '？', '、', ',', '.', ';'];
  for (let r = 0; r <= 10; r++) {
    for (const sign of [1, -1]) {
      const pos = mid + sign * r;
      if (pos > 0 && pos < text.length - 1 && puncts.includes(text[pos])) {
        return [text.slice(0, pos + 1).trim(), text.slice(pos + 1).trim()];
      }
    }
  }
  return [text.slice(0, mid), text.slice(mid)];
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  suggestions?: string[];
}

// ==================== Quiz Modal ====================
const QuizModal: React.FC<{ questions: QuizQuestion[]; onClose: () => void }> = ({ questions, onClose }) => {
  const [qIndex, setQIndex] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>(questions.map(() => null));

  const q = questions[qIndex];
  const selected = answers[qIndex];
  const isAnswered = selected !== null;
  const allAnswered = answers.every((a) => a !== null);
  const onLast = qIndex === questions.length - 1;
  const showResult = allAnswered && onLast && isAnswered;
  const score = answers.filter((a, i) => a === questions[i].answer).length;

  const handleSelect = (i: number) => {
    if (isAnswered) return;
    setAnswers((prev) => prev.map((a, idx) => idx === qIndex ? i : a));
  };

  const reset = () => { setAnswers(questions.map(() => null)); setQIndex(0); };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 overflow-hidden animate-scaleIn">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-warm-100">
          <div className="flex items-center gap-3">
            <span className="text-[13px] font-medium text-warm-800">测验</span>
            <div className="flex gap-1.5">
              {questions.map((_, i) => (
                <button key={i} onClick={() => setQIndex(i)}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    i === qIndex ? 'w-4 bg-warm-800' :
                    answers[i] !== null ? 'w-1.5 bg-warm-400' : 'w-1.5 bg-warm-200'}`} />
              ))}
            </div>
          </div>
          <button onClick={onClose} className="text-warm-300 hover:text-warm-500 transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Quiz content */}
        {!showResult ? (
          <>
            <div className="px-6 py-5">
              <p className="text-[11px] text-warm-400 mb-3">{qIndex + 1} / {questions.length}</p>
              <p className="text-[15px] font-medium text-warm-800 mb-5 leading-relaxed">{q.question}</p>
              <div className="space-y-2 mb-4">
                {q.options.map((opt, i) => {
                  let cls = 'border-warm-100 text-warm-600 hover:border-warm-300 hover:bg-warm-50 cursor-pointer';
                  if (isAnswered) {
                    if (i === q.answer) cls = 'border-green-300 bg-green-50 text-green-800 cursor-default';
                    else if (i === selected) cls = 'border-red-200 bg-red-50 text-red-700 cursor-default';
                    else cls = 'border-warm-100 text-warm-300 cursor-default';
                  }
                  return (
                    <button key={i} onClick={() => handleSelect(i)}
                      className={`w-full text-left px-4 py-3 rounded-xl border text-[13px] transition-all flex items-center justify-between ${cls}`}>
                      <span>{opt}</span>
                      {isAnswered && i === q.answer && <Check size={13} className="text-green-600 shrink-0" />}
                      {isAnswered && i === selected && i !== q.answer && <X size={13} className="text-red-400 shrink-0" />}
                    </button>
                  );
                })}
              </div>
              {isAnswered && (
                <div className="bg-warm-50 rounded-xl px-4 py-3 chat-message-enter">
                  <p className="text-[12px] text-warm-500 leading-relaxed">{q.explanation}</p>
                </div>
              )}
            </div>
            <div className="flex justify-between items-center px-6 pb-5">
              <button onClick={() => setQIndex((i) => Math.max(0, i - 1))}
                className={`text-[12px] text-warm-400 hover:text-warm-600 transition-colors ${qIndex === 0 ? 'invisible' : ''}`}>
                上一题
              </button>
              <button onClick={() => onLast ? undefined : setQIndex((i) => i + 1)}
                disabled={!isAnswered || onLast}
                className={`text-[12px] px-4 py-1.5 rounded-full transition-all ${
                  isAnswered && !onLast ? 'bg-warm-800 text-white hover:bg-warm-700 cursor-pointer' :
                  'bg-warm-100 text-warm-300 cursor-not-allowed'}`}>
                {onLast ? '完成' : '下一题'}
              </button>
            </div>
          </>
        ) : (
          /* Result */
          <div className="px-6 py-10 text-center">
            <p className="text-4xl font-semibold text-warm-800 mb-2">{score} / {questions.length}</p>
            <p className="text-[13px] text-warm-400 mb-8">
              {score === questions.length ? '全部答对，掌握得很好！' :
               score >= questions.length * 0.6 ? '不错，继续加油！' : '建议再看一遍视频'}
            </p>
            {score < questions.length && (
              <button onClick={reset}
                className="text-[13px] px-5 py-2 bg-warm-800 text-white rounded-full hover:bg-warm-700 transition-colors">
                再试一次
              </button>
            )}
          </div>
        )}
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
  const [hoveredLabelIndex, setHoveredLabelIndex] = useState<number | null>(null);

  // Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [showQuiz, setShowQuiz] = useState(false);
  const [sentQuestions, setSentQuestions] = useState<Set<number>>(new Set());
  const chatEndRef = useRef<HTMLDivElement>(null);

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

        const rawSegments: any[] = article.segments || [];
        const transcriptParts: TranscriptPartWithTime[] = rawSegments.map((seg, i) => {
          const highlights: Highlight[] = [];
          const startTime = parseTime(seg.start);
          const rawEnd = parseTime(seg.end);
          // 用下一段的 startTime 补齐缺失或为 0 的 endTime
          const endTime = rawEnd > startTime
            ? rawEnd
            : rawSegments[i + 1]
              ? parseTime(rawSegments[i + 1].start)
              : startTime + 30; // 最后一段兜底给 30 秒
          return { en: seg.en || '', zh: seg.cn || '', highlights, startTime, endTime };
        });

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
          example_questions: article.example_questions || [],
          quiz: article.quiz || [],
        };

        setVideo(transformedVideo);
      } catch (error) {
        console.error('Failed to fetch article:', error);
        navigate('/');
      }
    };

    fetchArticle();
  }, [id, navigate, parseTime]);

  // Auto-scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const sendChatMessage = async (overrideMessage?: string) => {
    const userMessage = overrideMessage ?? chatInput.trim();
    if (!userMessage || isChatLoading || !video) return;

    if (!overrideMessage) setChatInput('');

    const newMessages: ChatMessage[] = [...chatMessages, { role: 'user', content: userMessage }];
    setChatMessages(newMessages);
    setIsChatLoading(true);

    const transcriptText = video.transcriptParts?.map(p => p.en).join(' ') || '';

    const geminiHistory = chatMessages.map(m => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.content }],
    }));

    try {
      const response = await fetch(`${API_BASE}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          transcript: transcriptText,
          videoTitle: video.title,
          history: geminiHistory,
        }),
      });
      const data = await response.json();
      if (data.success) {
        setChatMessages([...newMessages, { role: 'assistant', content: data.response }]);
      } else {
        setChatMessages([...newMessages, { role: 'assistant', content: '抱歉，人太多了，请稍后再试' }]);
      }
    } catch {
      setChatMessages([...newMessages, { role: 'assistant', content: '抱歉，人太多了，请稍后再试' }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const handleChatKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendChatMessage();
    }
  };

  const handleCopy = (content: string, index: number) => {
    navigator.clipboard.writeText(content);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 1500);
  };

  const handleRegenerate = async (aiMsgIndex: number) => {
    if (isChatLoading || !video) return;
    const messagesBeforeAI = chatMessages.slice(0, aiMsgIndex);
    const userMsg = messagesBeforeAI[messagesBeforeAI.length - 1];
    if (!userMsg || userMsg.role !== 'user') return;

    setChatMessages(messagesBeforeAI);
    setIsChatLoading(true);

    const transcriptText = video.transcriptParts?.map(p => p.en).join(' ') || '';
    const geminiHistory = messagesBeforeAI.slice(1, -1).map(m => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.content }],
    }));

    try {
      const response = await fetch(`${API_BASE}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMsg.content,
          transcript: transcriptText,
          videoTitle: video.title,
          history: geminiHistory,
        }),
      });
      const data = await response.json();
      const aiResponse = data.success ? data.response : '抱歉，人太多了，请稍后再试';
      setChatMessages([...messagesBeforeAI, { role: 'assistant', content: aiResponse }]);
    } catch {
      setChatMessages([...messagesBeforeAI, { role: 'assistant', content: '抱歉，人太多了，请稍后再试' }]);
    } finally {
      setIsChatLoading(false);
    }
  };

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

  const activeSegmentIndex = video?.transcriptParts?.findIndex((part, idx, arr) => {
    const nextPart = arr[idx + 1];
    if (currentTime >= part.startTime && currentTime < part.endTime) return true;
    if (nextPart && currentTime >= part.endTime && currentTime < nextPart.startTime) return true;
    return false;
  }) ?? -1;

  const currentSubtitle = video?.transcriptParts?.find(
    (part) => part.startTime <= currentTime && part.endTime >= currentTime
  );

  // 字幕分页：长句按时间比例分两页显示
  let subtitleText = currentSubtitle?.zh ?? '';
  let subtitlePageKey = 0;
  if (currentSubtitle?.zh) {
    const pages = splitSubtitle(currentSubtitle.zh);
    if (pages) {
      const duration = currentSubtitle.endTime - currentSubtitle.startTime;
      const splitRatio = pages[0].length / currentSubtitle.zh.length;
      const splitTime = currentSubtitle.startTime + duration * splitRatio;
      if (currentTime >= splitTime) {
        subtitleText = pages[1];
        subtitlePageKey = 1;
      } else {
        subtitleText = pages[0];
        subtitlePageKey = 0;
      }
    }
  }

  useEffect(() => {
    const el = transcriptRefs.current[activeSegmentIndex];
    const container = scrollContainerRef.current;
    if (activeSegmentIndex >= 0 && el && container) {
      const targetScrollTop = el.offsetTop - 80;
      container.scrollTo({ top: targetScrollTop, behavior: 'smooth' });
    }
  }, [activeSegmentIndex]);

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
            isBookmarked={false}
            onToggleBookmark={() => {}}
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


  return (
    <div className="min-h-screen bg-warm-50">
      {showQuiz && video?.quiz && video.quiz.length > 0 && (
        <QuizModal questions={video.quiz} onClose={() => setShowQuiz(false)} />
      )}
      <Header transparent back />

      <main className="container mx-auto px-4 sm:px-6 py-8 animate-page-enter max-w-[95vw] 2xl:max-w-[1800px]">
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
                {showCn && currentTime > 0 && currentSubtitle && subtitleText && (
                  <p
                    key={`${currentSubtitle.startTime}-${subtitlePageKey}`}
                    className="font-medium text-white drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)] animate-slideUp text-xl md:text-2xl"
                  >
                    <span className="bg-black/40 backdrop-blur-sm px-3 py-1.5 rounded-lg box-decoration-clone leading-relaxed">
                      {subtitleText}
                    </span>
                  </p>
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
                        <div className={`absolute top-full left-1/2 -translate-x-1/2 mt-2 z-50 w-max max-w-[240px] px-4 py-2 bg-white rounded-xl shadow-lg border border-warm-200/60 text-sm font-medium text-warm-700 text-center leading-relaxed pointer-events-none transition-opacity duration-150 ${hoveredLabelIndex === i ? 'opacity-100' : 'opacity-0'}`}>
                          {seg.title}
                          <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-white border-t border-l border-warm-200/60 rotate-45" />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right Column: Learning Panel */}
          <div className="w-full lg:w-[420px] xl:w-[480px] 2xl:w-[520px] flex-shrink-0 flex flex-col h-[calc(100vh-140px)] min-h-0 sticky top-24">
            <div className="bg-white border border-warm-200/60 rounded-2xl flex flex-col h-full min-h-0 shadow-sm overflow-hidden">

              {/* Tabs */}
              <div className="flex-shrink-0 flex items-center border-b border-warm-200">
                <button
                  onClick={() => setActiveTab('transcript')}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-3.5 text-[13px] transition-all duration-150 ${
                    activeTab === 'transcript' ? 'text-warm-900' : 'text-warm-400 hover:text-warm-600'
                  }`}
                >
                  <Languages size={14} />
                  Transcript
                </button>
                <button
                  onClick={() => setActiveTab('chat')}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-3.5 text-[13px] transition-all duration-150 ${
                    activeTab === 'chat' ? 'text-warm-900' : 'text-warm-400 hover:text-warm-600'
                  }`}
                >
                  <MessageCircle size={14} />
                  Chat
                </button>
              </div>

              {/* Transcript Tab */}
              {activeTab === 'transcript' && (
                <div
                  ref={scrollContainerRef}
                  className="flex-1 overflow-y-auto p-6 space-y-2 scroll-smooth font-source-han scrollbar-thin"
                >
                  {video.transcriptParts ? (
                    video.transcriptParts.map((part, idx) => {
                      const isActive = idx === activeSegmentIndex;
                      return (
                        <div
                          key={idx}
                          ref={el => transcriptRefs.current[idx] = el}
                          className={`leading-relaxed cursor-pointer transition-all duration-300 scroll-mt-6 rounded-lg px-3 py-2 -mx-3 ${
                            isActive
                              ? 'bg-warm-100'
                              : 'hover:bg-warm-50'
                          }`}
                          onClick={() => handleTranscriptClick(part.startTime)}
                        >
<div className={`leading-relaxed text-pretty transition-colors ${
                            isActive
                              ? 'text-[14px] text-warm-800'
                              : 'text-[13px] text-warm-600'
                          }`}>
                            {renderTextWithHighlights(part.en, part.highlights)}
                          </div>
                          <div className={`leading-relaxed mt-1 transition-colors ${
                            isActive
                              ? 'text-[13px] text-warm-500'
                              : 'text-[13px] text-warm-400'
                          }`}>
                            {part.zh}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="flex flex-col items-center justify-center py-24 text-warm-300">
                      <p className="text-sm">加载中…</p>
                    </div>
                  )}
                </div>
              )}

              {/* Chat Tab */}
              {activeTab === 'chat' && (
                <div className="flex-1 flex flex-col overflow-hidden min-h-0">
                  {/* Messages */}
                  <div className="flex-1 overflow-y-auto p-6 scrollbar-thin">
                    {/* Example questions - scrolls with messages */}
                    {((video?.example_questions ?? []).length > 0 || (video?.quiz && video.quiz.length > 0)) && (
                      <div className="flex flex-col items-end gap-2 pb-5">
                        {(video.example_questions ?? []).map((q, i) => (
                          !sentQuestions.has(i) && (
                            <button key={i}
                              onClick={() => { setSentQuestions(prev => new Set([...prev, i])); sendChatMessage(q); }}
                              className="chat-message-enter text-right text-[13px] text-warm-700 px-4 py-2.5 rounded-2xl rounded-br-sm border border-warm-200 hover:border-warm-400 hover:bg-warm-50 transition-all max-w-[90%] leading-snug"
                              style={{ animationDelay: `${i * 80}ms` }}>
                              {q}
                            </button>
                          )
                        ))}
                        {video?.quiz && video.quiz.length > 0 && (
                          <button onClick={() => setShowQuiz(true)}
                            className="chat-message-enter text-[13px] text-warm-700 px-4 py-2.5 rounded-2xl rounded-br-sm border border-warm-200 hover:border-warm-400 hover:bg-warm-50 transition-all"
                            style={{ animationDelay: `${(video.example_questions?.length ?? 0) * 80}ms` }}>
                            测试一下 ✏️
                          </button>
                        )}
                      </div>
                    )}
                    {/* Chat messages */}
                    <div className="space-y-5">
                      {chatMessages.map((msg, idx) => (
                        <div key={idx} className="flex flex-col gap-1.5 chat-message-enter">
                          {/* AI 回答 */}
                          {msg.role === 'assistant' && (
                            <>
                              <div className="text-[13px] leading-relaxed text-warm-700 prose-chat">
                                <ReactMarkdown>{msg.content}</ReactMarkdown>
                              </div>
                              <div className="flex items-center gap-0.5">
                                <button
                                  onClick={() => handleCopy(msg.content, idx)}
                                  className="p-1.5 rounded-md hover:bg-warm-100 transition-colors text-warm-500"
                                  title="复制"
                                >
                                  {copiedIndex === idx ? <Check size={13} /> : <Copy size={13} />}
                                </button>
                                <button
                                  onClick={() => handleRegenerate(idx)}
                                  className="p-1.5 rounded-md hover:bg-warm-100 transition-colors text-warm-500"
                                  title="重新生成"
                                >
                                  <RotateCcw size={13} />
                                </button>
                              </div>
                            </>
                          )}

                          {/* 用户气泡 */}
                          {msg.role === 'user' && (
                            <div className="flex justify-end">
                              <div className="max-w-[85%] rounded-2xl rounded-tr-sm px-4 py-2.5 text-[13px] leading-relaxed bg-warm-100 text-warm-900">
                                {msg.content}
                              </div>
                            </div>
                          )}

                          {/* AI 建议问句 */}
                          {msg.suggestions && msg.suggestions.length > 0 && (
                            <div className="flex flex-col items-end gap-1.5 mt-1">
                              {msg.suggestions.map((s, j) => (
                                <button key={j} onClick={() => { setChatInput(s); }}
                                  className="text-left text-[12px] px-3.5 py-1.5 rounded-full border border-warm-200 text-warm-500 hover:bg-warm-50 transition-colors">
                                  {s}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}

                      {/* Typing indicator */}
                      {isChatLoading && (
                        <div className="flex justify-start chat-message-enter">
                          <div className="bg-warm-100 px-3.5 py-3 rounded-2xl rounded-bl-sm flex items-center gap-1.5">
                            <div className="typing-dot" />
                            <div className="typing-dot" />
                            <div className="typing-dot" />
                          </div>
                        </div>
                      )}
                      <div ref={chatEndRef} />
                    </div>
                  </div>

                  {/* Input */}
                  <div className="flex-shrink-0 border-t border-warm-200/60 p-4">
                    <div className="flex gap-2 items-end">
                      <textarea
                        value={chatInput}
                        onChange={e => setChatInput(e.target.value)}
                        onKeyDown={handleChatKeyDown}
                        placeholder="你有什么想讨论的"
                        className="flex-1 resize-none rounded-xl border border-warm-200 px-3 py-2 text-sm text-warm-800 placeholder:text-warm-300 focus:outline-none focus:border-accent/50 min-h-[40px] max-h-[120px] font-source-han"
                        rows={1}
                      />
                      <button
                        onClick={() => sendChatMessage()}
                        disabled={!chatInput.trim() || isChatLoading}
                        className="flex-shrink-0 w-9 h-9 rounded-full bg-[#1C1B1F] text-white flex items-center justify-center disabled:opacity-40 hover:bg-[#3C4043] transition-colors"
                      >
                        <Send size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default VideoDetail;
