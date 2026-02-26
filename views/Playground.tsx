import React, { useState, useEffect, useCallback, useRef, useMemo, forwardRef, useImperativeHandle } from 'react';
import { Check, X } from 'lucide-react';
import { motion, DynamicAnimationOptions } from 'framer-motion';
import type { Category } from '../types';

// ── cn utility ────────────────────────────────────────────────────────────────
const cn = (...classes: (string | undefined | false | null)[]) => classes.filter(Boolean).join(' ');

// ── VerticalCutReveal ─────────────────────────────────────────────────────────
interface TextProps {
  children: React.ReactNode;
  reverse?: boolean;
  transition?: DynamicAnimationOptions;
  splitBy?: 'words' | 'characters' | 'lines' | string;
  staggerDuration?: number;
  staggerFrom?: 'first' | 'last' | 'center' | 'random' | number;
  containerClassName?: string;
  wordLevelClassName?: string;
  elementLevelClassName?: string;
  onClick?: () => void;
  onStart?: () => void;
  onComplete?: () => void;
  autoStart?: boolean;
}
export interface VerticalCutRevealRef { startAnimation: () => void; reset: () => void; }
interface WordObject { characters: string[]; needsSpace: boolean; }

const VerticalCutReveal = forwardRef<VerticalCutRevealRef, TextProps>(({
  children, reverse = false,
  transition = { type: 'spring', stiffness: 190, damping: 22 },
  splitBy = 'words', staggerDuration = 0.2, staggerFrom = 'first',
  containerClassName, wordLevelClassName, elementLevelClassName,
  onClick, onStart, onComplete, autoStart = true, ...props
}, ref) => {
  const containerRef = useRef<HTMLSpanElement>(null);
  const text = typeof children === 'string' ? children : children?.toString() || '';
  const [isAnimating, setIsAnimating] = useState(false);

  const splitIntoCharacters = (t: string): string[] => {
    if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
      const segmenter = new Intl.Segmenter('en', { granularity: 'grapheme' });
      return Array.from(segmenter.segment(t), ({ segment }) => segment);
    }
    return Array.from(t);
  };

  const elements = useMemo(() => {
    const words = text.split(' ');
    if (splitBy === 'characters') {
      return words.map((word, i) => ({ characters: splitIntoCharacters(word), needsSpace: i !== words.length - 1 }));
    }
    return splitBy === 'words' ? text.split(' ') : splitBy === 'lines' ? text.split('\n') : text.split(splitBy);
  }, [text, splitBy]);

  const getStaggerDelay = useCallback((index: number) => {
    const total = splitBy === 'characters'
      ? (elements as WordObject[]).reduce((acc, word) => acc + word.characters.length + (word.needsSpace ? 1 : 0), 0)
      : elements.length;
    if (staggerFrom === 'first') return index * staggerDuration;
    if (staggerFrom === 'last') return (total - 1 - index) * staggerDuration;
    if (staggerFrom === 'center') return Math.abs(Math.floor(total / 2) - index) * staggerDuration;
    if (staggerFrom === 'random') return Math.abs(Math.floor(Math.random() * total) - index) * staggerDuration;
    return Math.abs((staggerFrom as number) - index) * staggerDuration;
  }, [elements.length, staggerFrom, staggerDuration]);

  const startAnimation = useCallback(() => { setIsAnimating(true); onStart?.(); }, [onStart]);

  useImperativeHandle(ref, () => ({ startAnimation, reset: () => setIsAnimating(false) }));
  useEffect(() => { if (autoStart) startAnimation(); }, [autoStart]);

  const variants = {
    hidden: { y: reverse ? '-100%' : '100%' },
    visible: (i: number) => ({
      y: 0,
      transition: { ...transition, delay: ((transition?.delay as number) || 0) + getStaggerDelay(i) },
    }),
  };

  return (
    <span className={cn(containerClassName, 'flex flex-wrap whitespace-pre-wrap', splitBy === 'lines' && 'flex-col')}
      onClick={onClick} ref={containerRef} {...props}>
      <span className="sr-only">{text}</span>
      {(splitBy === 'characters'
        ? (elements as WordObject[])
        : (elements as string[]).map((el, i) => ({ characters: [el], needsSpace: i !== elements.length - 1 }))
      ).map((wordObj, wordIndex, array) => {
        const previousCharsCount = array.slice(0, wordIndex).reduce((sum, word) => sum + word.characters.length, 0);
        return (
          <span key={wordIndex} aria-hidden="true" className={cn('inline-flex overflow-hidden', wordLevelClassName)}>
            {wordObj.characters.map((char, charIndex) => (
              <span className={cn(elementLevelClassName, 'whitespace-pre-wrap relative')} key={charIndex}>
                <motion.span
                  custom={previousCharsCount + charIndex}
                  initial="hidden" animate={isAnimating ? 'visible' : 'hidden'}
                  variants={variants}
                  onAnimationComplete={wordIndex === elements.length - 1 && charIndex === wordObj.characters.length - 1 ? onComplete : undefined}
                  className="inline-block">
                  {char}
                </motion.span>
              </span>
            ))}
            {wordObj.needsSpace && <span> </span>}
          </span>
        );
      })}
    </span>
  );
});
VerticalCutReveal.displayName = 'VerticalCutReveal';

// ── Hero Preview ──────────────────────────────────────────────────────────────
function HeroPreview() {
  return (
    <div
      className="w-full rounded-2xl overflow-hidden flex items-center justify-center py-10 px-10"
      style={{
        backgroundColor: '#ffffff',
        backgroundImage: 'radial-gradient(circle, #d1d5db 1px, transparent 1px)',
        backgroundSize: '24px 24px',
      }}
    >
      <img src="/hero.png" alt="hero" className="w-full max-w-3xl object-contain" />
    </div>
  );
}

// ── Tag colors ───────────────────────────────────────────────────────────────
const CATEGORIES: Category[] = ['Product', 'Founder Interview', 'Tutorial', 'Vibe Coding', 'Marketing', 'AI Fundamentals'];

const TAG_COLORS: Record<Category, { bg: string; text: string; border: string }> = {
  'Product':           { bg: '#E6F4EAB3', text: '#137333B3', border: '#CEEAD6B3' },
  'Founder Interview': { bg: '#F3E8FDB3', text: '#7B1FA2B3', border: '#E9D5F7B3' },
  'Tutorial':          { bg: '#E3F5FBB3', text: '#007B7AB3', border: '#C1E9F3B3' },
  'Vibe Coding':       { bg: '#FCE8F0B3', text: '#C2185BB3', border: '#F7C5D8B3' },
  'Marketing':         { bg: '#FEF0E6B3', text: '#C35100B3', border: '#FCD3A8B3' },
  'AI Fundamentals':   { bg: '#E8F0FEB3', text: '#1A73E8B3', border: '#AECBFAB3' },
};

const MOCK_VIDEOS = [
  { title: 'How Granola Built a Beloved AI Product', categories: ['Product', 'Founder Interview'] as Category[] },
  { title: 'Vibe Coding with Cursor: Full Workflow', categories: ['Vibe Coding', 'Tutorial'] as Category[] },
  { title: 'AI Go-to-Market Strategies in 2025', categories: ['Marketing', 'AI Fundamentals'] as Category[] },
  { title: 'Building RAG Systems from Scratch', categories: ['AI Fundamentals', 'Tutorial'] as Category[] },
];

// ── Mock data ────────────────────────────────────────────────────────────────
const EXAMPLE_QUESTIONS = [
  '视频中提到的核心概念是什么，能简单解释一下吗？',
  '这个技术和传统方法相比，最大的优势是什么？',
  '如果我想在自己的项目中应用这个方案，从哪里开始？',
];

const MOCK_AI_RESPONSE = 'Context Caching 将重复使用的内容（如系统提示、长文档）预存到服务器。普通调用每次都要处理并收费，而 Caching 只处理一次，后续直接复用，相关成本可降低约 75%。';

const MOCK_QUIZ = [
  {
    question: 'Context Window 在大语言模型中指的是什么？',
    options: ['模型的参数数量', '模型一次能处理的最大文本长度', '模型的训练数据规模', '模型的推理速度'],
    answer: 1,
    explanation: 'Context Window 是指模型单次调用能处理的最大 token 数，决定了模型能「看到」多少内容。',
  },
  {
    question: 'Context Caching 最主要的优势是什么？',
    options: ['提升模型准确率', '加快推理速度', '降低重复内容的 API 成本', '支持更长的输出'],
    answer: 2,
    explanation: 'Context Caching 将高频重用内容预存服务器，避免每次重新处理，相关 token 成本可降低约 75%。',
  },
  {
    question: '相比传统 RAG，长上下文模型的优势是？',
    options: ['更低的使用成本', '无需切片即可理解全文档', '更快的响应速度', '更小的模型体积'],
    answer: 1,
    explanation: '长上下文让模型直接接收完整文档，省去 RAG 的检索切片步骤，减少信息丢失。',
  },
  {
    question: 'Gemini 1.5 Pro 最大支持多少 token 的上下文？',
    options: ['128K', '256K', '500K', '1M'],
    answer: 3,
    explanation: 'Gemini 1.5 Pro 支持最多 100 万（1M）token 的上下文窗口，是目前商用模型中最长的之一。',
  },
  {
    question: '以下哪种场景最适合使用 Context Caching？',
    options: [
      '每次提问都使用不同的文档',
      '对同一份长文档反复提问',
      '生成随机创意内容',
      '实时语音转录',
    ],
    answer: 1,
    explanation: '当同一份内容被多次引用时，Context Caching 能避免重复处理，节省成本效果最明显。',
  },
];

// ── Shared ───────────────────────────────────────────────────────────────────
function Tag({ cat }: { cat: Category }) {
  const c = TAG_COLORS[cat];
  return (
    <span className="text-[11px] font-medium rounded-full px-2.5 py-0.5 border"
      style={{ background: c.bg, color: c.text, borderColor: c.border }}>
      {cat}
    </span>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] uppercase tracking-widest text-gray-400 mb-3">{children}</p>;
}

// ── Quiz Modal ───────────────────────────────────────────────────────────────
function QuizModal({ onClose }: { onClose: () => void }) {
  const [qIndex, setQIndex] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>(MOCK_QUIZ.map(() => null));

  const q = MOCK_QUIZ[qIndex];
  const selected = answers[qIndex];
  const isAnswered = selected !== null;
  const allAnswered = answers.every((a) => a !== null);

  const handleSelect = (i: number) => {
    if (isAnswered) return;
    setAnswers((prev) => prev.map((a, idx) => idx === qIndex ? i : a));
  };

  const score = answers.filter((a, i) => a === MOCK_QUIZ[i].answer).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 overflow-hidden animate-scaleIn">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <span className="text-[13px] font-medium text-gray-800">测验</span>
            <div className="flex gap-1">
              {MOCK_QUIZ.map((_, i) => (
                <button key={i} onClick={() => setQIndex(i)}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    i === qIndex ? 'w-4 bg-gray-800' :
                    answers[i] !== null ? 'w-1.5 bg-gray-400' : 'w-1.5 bg-gray-200'}`} />
              ))}
            </div>
          </div>
          <button onClick={onClose} className="text-gray-300 hover:text-gray-500 transition-colors text-lg leading-none">×</button>
        </div>

        {/* Content */}
        {!allAnswered || qIndex < MOCK_QUIZ.length - 1 || !isAnswered ? (
          <div className="px-6 py-5">
            <p className="text-[13px] text-gray-400 mb-3">{qIndex + 1} / {MOCK_QUIZ.length}</p>
            <p className="text-[15px] font-medium text-gray-800 mb-5 leading-relaxed">{q.question}</p>

            <div className="space-y-2 mb-4">
              {q.options.map((opt, i) => {
                let cls = 'border-gray-100 text-gray-600 hover:border-gray-300 hover:bg-gray-50 cursor-pointer';
                if (isAnswered) {
                  if (i === q.answer) cls = 'border-green-300 bg-green-50 text-green-800 cursor-default';
                  else if (i === selected) cls = 'border-red-200 bg-red-50 text-red-700 cursor-default';
                  else cls = 'border-gray-100 text-gray-300 cursor-default';
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
              <div className="bg-gray-50 rounded-xl px-4 py-3 chat-message-enter">
                <p className="text-[12px] text-gray-500 leading-relaxed">{q.explanation}</p>
              </div>
            )}
          </div>
        ) : (
          /* Result screen */
          <div className="px-6 py-10 text-center">
            <p className="text-4xl font-semibold text-gray-800 mb-2">{score} / {MOCK_QUIZ.length}</p>
            <p className="text-[13px] text-gray-400 mb-8">
              {score === MOCK_QUIZ.length ? '全部答对，掌握得很好！' :
               score >= MOCK_QUIZ.length * 0.6 ? '不错，继续加油！' : '建议再看一遍视频'}
            </p>
            {score < MOCK_QUIZ.length && (
              <button onClick={() => { setAnswers(MOCK_QUIZ.map(() => null)); setQIndex(0); }}
                className="text-[13px] px-5 py-2 bg-gray-800 text-white rounded-full hover:bg-gray-700 transition-colors">
                再试一次
              </button>
            )}
          </div>
        )}

        {/* Footer nav */}
        {!(allAnswered && qIndex === MOCK_QUIZ.length - 1 && isAnswered) && (
          <div className="flex justify-between items-center px-6 pb-5">
            <button onClick={() => setQIndex((i) => Math.max(0, i - 1))}
              className={`text-[12px] text-gray-400 hover:text-gray-600 transition-colors ${qIndex === 0 ? 'invisible' : ''}`}>
              上一题
            </button>
            {qIndex < MOCK_QUIZ.length - 1 ? (
              <button onClick={() => setQIndex((i) => i + 1)} disabled={!isAnswered}
                className={`text-[12px] px-4 py-1.5 rounded-full transition-all ${
                  isAnswered ? 'bg-gray-800 text-white hover:bg-gray-700' : 'bg-gray-100 text-gray-300 cursor-not-allowed'}`}>
                下一题
              </button>
            ) : (
              <button onClick={() => setQIndex(MOCK_QUIZ.length - 1)} disabled={!isAnswered}
                className={`text-[12px] px-4 py-1.5 rounded-full transition-all ${
                  isAnswered ? 'bg-gray-800 text-white hover:bg-gray-700' : 'bg-gray-100 text-gray-300 cursor-not-allowed'}`}>
                查看结果
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Chat demo ────────────────────────────────────────────────────────────────
type ChatPhase = 'welcome' | 'typing' | 'responded';

function ChatDemo() {
  const [phase, setPhase] = useState<ChatPhase>('welcome');
  const [selectedQ, setSelectedQ] = useState('');
  const [showQuiz, setShowQuiz] = useState(false);

  const handleSend = (q: string) => {
    setSelectedQ(q);
    setPhase('typing');
    setTimeout(() => setPhase('responded'), 2000);
  };

  const reset = () => { setPhase('welcome'); setSelectedQ(''); };

  return (
    <>
      {showQuiz && <QuizModal onClose={() => setShowQuiz(false)} />}

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm w-full max-w-md overflow-hidden">
        <div className="p-5 min-h-[300px] flex flex-col">
          {phase === 'welcome' && (
            <div className="flex-1 flex flex-col justify-end space-y-2">
              {EXAMPLE_QUESTIONS.map((q, i) => (
                <button key={i} onClick={() => handleSend(q)}
                  className="self-end text-right text-[13px] text-gray-700 px-4 py-2.5 rounded-2xl rounded-br-sm border border-gray-200 hover:border-gray-400 hover:bg-gray-50 transition-all max-w-[90%] leading-snug">
                  {q}
                </button>
              ))}
              <button onClick={() => setShowQuiz(true)}
                className="self-end text-[13px] text-gray-700 px-4 py-2.5 rounded-2xl rounded-br-sm border border-gray-200 hover:border-gray-400 hover:bg-gray-50 transition-all">
                测试一下 ✏️
              </button>
            </div>
          )}

          {(phase === 'typing' || phase === 'responded') && (
            <div className="flex-1 flex flex-col justify-end space-y-3">
              <div className="flex justify-end chat-message-enter">
                <div className="bg-gray-800 text-white text-[13px] px-4 py-2.5 rounded-2xl rounded-br-sm max-w-[85%] leading-relaxed">
                  {selectedQ}
                </div>
              </div>

              {phase === 'typing' && (
                <div className="flex justify-start chat-message-enter">
                  <div className="bg-gray-100 px-3.5 py-3 rounded-2xl rounded-bl-sm flex items-center gap-1.5">
                    <div className="typing-dot" />
                    <div className="typing-dot" />
                    <div className="typing-dot" />
                  </div>
                </div>
              )}

              {phase === 'responded' && (
                <div className="flex justify-start chat-message-enter">
                  <div className="bg-gray-100 text-gray-700 text-[13px] px-4 py-2.5 rounded-2xl rounded-bl-sm max-w-[85%] leading-relaxed">
                    {MOCK_AI_RESPONSE}
                  </div>
                </div>
              )}

              {phase === 'responded' && (
                <button onClick={reset} className="text-[11px] text-gray-400 hover:text-gray-600 self-center mt-1">
                  重置演示
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ── Tag / VideoCard sections ─────────────────────────────────────────────────
function MockVideoCard({ title, categories }: { title: string; categories: Category[] }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-2 w-64">
      <div className="w-full h-32 bg-gray-100 rounded-lg" />
      <div className="flex flex-wrap gap-1.5">
        {categories.map((cat) => <Tag key={cat} cat={cat} />)}
      </div>
      <p className="text-[13px] font-medium text-gray-800 leading-snug line-clamp-2">{title}</p>
    </div>
  );
}

function MultiSelectDemo() {
  const [selected, setSelected] = useState<Category[]>(['Product', 'Vibe Coding']);
  const toggle = (cat: Category) =>
    setSelected((prev) => prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]);
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 w-full max-w-md">
      <p className="text-[11px] text-gray-400 mb-3">分析完成后选择标签（多选）</p>
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((cat) => {
          const sel = selected.includes(cat);
          const c = TAG_COLORS[cat];
          return (
            <button key={cat} onClick={() => toggle(cat)}
              className="text-xs font-medium px-3 py-1.5 rounded-full border transition-all"
              style={sel ? { background: c.bg, color: c.text, borderColor: c.border }
                : { background: 'white', color: '#9CA3AF', borderColor: '#E5E7EB' }}>
              {cat}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Toast demos ──────────────────────────────────────────────────────────────

function useToast(duration = 2500) {
  const [visible, setVisible] = useState(false);
  const show = () => {
    setVisible(true);
    setTimeout(() => setVisible(false), duration);
  };
  return { visible, show };
}

// Style A: 底部居中，深色胶囊
function ToastA() {
  const { visible, show } = useToast();
  return (
    <div className="relative flex flex-col items-center gap-4">
      <button onClick={show}
        className="text-[12px] px-4 py-2 bg-gray-800 text-white rounded-full hover:bg-gray-700 transition-colors">
        触发
      </button>
      <div className={`flex items-center gap-2 px-4 py-2.5 bg-gray-900 text-white text-[13px] rounded-full shadow-lg transition-all duration-300 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'}`}>
        <Check size={13} className="text-green-400 shrink-0" />
        视频发布成功
      </div>
    </div>
  );
}

// Style B: 顶部右侧，白色卡片
function ToastB() {
  const { visible, show } = useToast();
  return (
    <div className="relative flex flex-col items-center gap-4">
      <button onClick={show}
        className="text-[12px] px-4 py-2 bg-gray-800 text-white rounded-full hover:bg-gray-700 transition-colors">
        触发
      </button>
      <div className={`flex items-center gap-3 px-4 py-3 bg-white border border-gray-100 text-gray-800 text-[13px] rounded-xl shadow-md transition-all duration-300 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2 pointer-events-none'}`}>
        <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center shrink-0">
          <Check size={11} className="text-green-600" />
        </div>
        视频发布成功
      </div>
    </div>
  );
}

// Style C: 顶部居中，细线条横幅
function ToastC() {
  const { visible, show } = useToast();
  return (
    <div className="relative flex flex-col items-center gap-4">
      <button onClick={show}
        className="text-[12px] px-4 py-2 bg-gray-800 text-white rounded-full hover:bg-gray-700 transition-colors">
        触发
      </button>
      <div className={`flex items-center gap-2 px-5 py-2.5 bg-white border-l-2 border-green-500 text-gray-700 text-[13px] rounded-r-xl shadow-sm transition-all duration-300 ${visible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-2 pointer-events-none'}`}>
        视频发布成功
      </div>
    </div>
  );
}

// ── Quiz entry demos ─────────────────────────────────────────────────────────

const MOCK_MESSAGES = [
  { role: 'user', text: '视频中提到的核心概念是什么？' },
  { role: 'assistant', text: 'Context Window 是指模型单次调用能处理的最大 token 数，决定了模型能「看到」多少内容。' },
];

// 方案 A：输入框上方常驻芯片
function QuizEntryA() {
  const [showQuiz, setShowQuiz] = useState(false);
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm w-full max-w-md overflow-hidden">
      {/* Messages */}
      <div className="p-5 space-y-3">
        {MOCK_MESSAGES.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`text-[13px] px-4 py-2.5 rounded-2xl max-w-[85%] leading-relaxed ${
              m.role === 'user' ? 'bg-gray-800 text-white rounded-tr-sm' : 'bg-gray-100 text-gray-700 rounded-tl-sm'}`}>
              {m.text}
            </div>
          </div>
        ))}
      </div>
      {/* Quiz chip + input */}
      <div className="border-t border-gray-100 px-4 pt-3 pb-4 space-y-2">
        <div className="flex justify-end">
          <button onClick={() => setShowQuiz(true)}
            className="text-[12px] text-gray-500 px-3 py-1 rounded-full border border-gray-200 hover:border-gray-400 hover:text-gray-700 transition-all">
            测验 ✏️
          </button>
        </div>
        <div className="flex gap-2 items-center">
          <div className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-[13px] text-gray-300">
            问关于这个视频的任何问题...
          </div>
          <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center shrink-0">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          </div>
        </div>
      </div>
      {showQuiz && (
        <div className="absolute inset-0 bg-black/20 rounded-xl flex items-center justify-center">
          <div className="bg-white rounded-xl px-6 py-4 text-[13px] text-gray-600 shadow-lg">
            Quiz Modal 弹出 <button onClick={() => setShowQuiz(false)} className="ml-3 text-gray-400">×</button>
          </div>
        </div>
      )}
    </div>
  );
}

// 方案 C：消息区右上角图标按钮
function QuizEntryC() {
  const [showQuiz, setShowQuiz] = useState(false);
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm w-full max-w-md overflow-hidden">
      {/* Header with quiz icon */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
        <span className="text-[13px] font-medium text-gray-700">AI 问答</span>
        <button onClick={() => setShowQuiz(true)}
          title="测验"
          className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-all text-[14px]">
          ✏️
        </button>
      </div>
      {/* Messages */}
      <div className="p-5 space-y-3">
        {MOCK_MESSAGES.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`text-[13px] px-4 py-2.5 rounded-2xl max-w-[85%] leading-relaxed ${
              m.role === 'user' ? 'bg-gray-800 text-white rounded-tr-sm' : 'bg-gray-100 text-gray-700 rounded-tl-sm'}`}>
              {m.text}
            </div>
          </div>
        ))}
      </div>
      {/* Input */}
      <div className="border-t border-gray-100 px-4 py-3 flex gap-2 items-center">
        <div className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-[13px] text-gray-300">
          问关于这个视频的任何问题...
        </div>
        <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center shrink-0">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
        </div>
      </div>
      {showQuiz && (
        <div className="absolute inset-0 bg-black/20 rounded-xl flex items-center justify-center">
          <div className="bg-white rounded-xl px-6 py-4 text-[13px] text-gray-600 shadow-lg">
            Quiz Modal 弹出 <button onClick={() => setShowQuiz(false)} className="ml-3 text-gray-400">×</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Logo options ─────────────────────────────────────────────────────────────
const LOGOS = [
  {
    label: '原版 A（参考）',
    svg: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="12" fill="#1C1B1F" />
        <path d="M12 4.5 C12.7 9.3 14.7 11.3 19.5 12 C14.7 12.7 12.7 14.7 12 19.5 C11.3 14.7 9.3 12.7 4.5 12 C9.3 11.3 11.3 9.3 12 4.5Z" fill="white" />
      </svg>
    ),
  },
  {
    label: 'A-1 · 旋转45°（斜向光芒）',
    svg: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="12" fill="#1C1B1F" />
        <path d="M12 4.5 C12.7 9.3 14.7 11.3 19.5 12 C14.7 12.7 12.7 14.7 12 19.5 C11.3 14.7 9.3 12.7 4.5 12 C9.3 11.3 11.3 9.3 12 4.5Z" fill="white" transform="rotate(45 12 12)" />
      </svg>
    ),
  },
  {
    label: 'A-2 · 更尖细（锐角臂膀）',
    svg: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="12" fill="#1C1B1F" />
        <path d="M12 4 C12.2 10 14 11.8 20 12 C14 12.2 12.2 14 12 20 C11.8 14 10 12.2 4 12 C10 11.8 11.8 10 12 4Z" fill="white" />
      </svg>
    ),
  },
  {
    label: 'A-3 · 竖向拉长（非对称）',
    svg: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="12" fill="#1C1B1F" />
        <path d="M12 3.5 C12.2 9.5 14 11.8 16.5 12 C14 12.2 12.2 14.5 12 20.5 C11.8 14.5 10 12.2 7.5 12 C10 11.8 11.8 9.5 12 3.5Z" fill="white" />
      </svg>
    ),
  },
  {
    label: 'A-4 · 中心加点（破除孔洞感）',
    svg: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="12" fill="#1C1B1F" />
        <path d="M12 4.5 C12.7 9.3 14.7 11.3 19.5 12 C14.7 12.7 12.7 14.7 12 19.5 C11.3 14.7 9.3 12.7 4.5 12 C9.3 11.3 11.3 9.3 12 4.5Z" fill="white" />
        <circle cx="12" cy="12" r="2.2" fill="#1C1B1F" />
      </svg>
    ),
  },
];

function LogoPreview({ label, svg }: { label: string; svg: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-[11px] text-gray-400">{label}</p>
      {/* 在 header 里的效果 */}
      <div className="bg-white border border-gray-100 rounded-xl px-4 py-3 flex items-center gap-2.5 shadow-sm w-fit">
        {svg}
        <span className="text-sm font-medium text-gray-800">Learn AI with Mona</span>
      </div>
      {/* 单独放大看 */}
      <div className="flex items-center gap-4">
        <div className="scale-100">{svg}</div>
        <div className="scale-150 ml-2">{svg}</div>
        <div className="scale-[2] ml-4">{svg}</div>
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function Playground() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-10 space-y-14">
      <div>
        <h1 className="text-lg font-semibold text-gray-800 mb-1">UI Playground</h1>
        <p className="text-sm text-gray-400">预览所有组件样式和交互效果</p>
      </div>

      <section>
        <SectionLabel>Hero 文字动效</SectionLabel>
        <HeroPreview />
      </section>

      <section>
        <SectionLabel>Logo 方案</SectionLabel>
        <div className="flex flex-wrap gap-12 items-start">
          {LOGOS.map((l) => (
            <LogoPreview key={l.label} label={l.label} svg={l.svg} />
          ))}
        </div>
      </section>

      <section>
        <SectionLabel>Toast 通知样式</SectionLabel>
        <div className="flex flex-wrap gap-16 items-start">
          <div className="flex flex-col items-center gap-2">
            <p className="text-[11px] text-gray-400 mb-1">A · 深色胶囊</p>
            <ToastA />
          </div>
          <div className="flex flex-col items-center gap-2">
            <p className="text-[11px] text-gray-400 mb-1">B · 白色卡片</p>
            <ToastB />
          </div>
          <div className="flex flex-col items-center gap-2">
            <p className="text-[11px] text-gray-400 mb-1">C · 左边框横幅</p>
            <ToastC />
          </div>
        </div>
      </section>

      <section>
        <SectionLabel>Quiz 常驻入口</SectionLabel>
        <div className="flex flex-wrap gap-10 items-start">
          <div className="flex flex-col gap-2">
            <p className="text-[11px] text-gray-400">A · 输入框上方芯片</p>
            <div className="relative">
              <QuizEntryA />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <p className="text-[11px] text-gray-400">C · 顶部右角图标</p>
            <div className="relative">
              <QuizEntryC />
            </div>
          </div>
        </div>
      </section>

      <section>
        <SectionLabel>Chat 示例问题 & 测验入口</SectionLabel>
        <ChatDemo />
      </section>

      <section>
        <SectionLabel>标签色彩</SectionLabel>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((cat) => <Tag key={cat} cat={cat} />)}
        </div>
      </section>

      <section>
        <SectionLabel>多选 UI</SectionLabel>
        <MultiSelectDemo />
      </section>

      <section>
        <SectionLabel>VideoCard 效果</SectionLabel>
        <div className="flex flex-wrap gap-4">
          {MOCK_VIDEOS.map((v) => (
            <MockVideoCard key={v.title} title={v.title} categories={v.categories} />
          ))}
        </div>
      </section>
    </div>
  );
}
