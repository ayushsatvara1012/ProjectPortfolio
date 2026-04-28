'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';
import { fetchEventSource } from '@microsoft/fetch-event-source';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, X, MoreHorizontal } from 'lucide-react';
import ThinkingLogo from './ThinkingLogo';
import { leadCaptureSchema, handoffSchema, firstIssue } from '@/src/lib/validation/schemas';

const IS_DEV = process.env.NODE_ENV === 'development';
const ASSET_BASE = IS_DEV ? '' : 'https://www.Sapybase.com';
const BrandLogo = `${ASSET_BASE}/SB_loading.svg`;

// ── Shape / gradient catalogs ─────────────────────────────────────────────────

const SHAPE_CLASS_MAP: Record<string, string> = {
  circle: 'rounded-full',
  squircle: 'rounded-[2rem]',
  bento: 'rounded-2xl',
  sharp: 'rounded-lg',
};

export const AVATAR_GRADIENTS: Record<string, [string, string] | null> = {
  none: null,
  cosmic: ['#c026d3', '#3b82f6'],
  sunset: ['#f97316', '#eab308'],
  ocean: ['#06b6d4', '#3b82f6'],
  hacker: ['#22c55e', '#14b8a6'],
};

export const FAB_SHAPES: Record<string, { path: string; logoSize: string; x: number; y: number }> = {
  circle: {
    path: 'M 50 4 C 75.5 4 96 24.5 96 50 C 96 75.5 75.5 96 50 96 C 24.5 96 4 75.5 4 50 C 4 24.5 24.5 4 50 4 Z',
    logoSize: 'w-full h-full', x: 0, y: 0,
  },
  squircle: {
    path: 'M 22 4 H 78 Q 96 4 96 22 V 62 Q 96 80 78 80 H 36 L 18 96 L 22 80 H 22 Q 4 80 4 62 V 22 Q 4 4 22 4 Z',
    logoSize: 'w-full h-full', x: 0, y: -8,
  },
  bento: {
    path: 'M39.5 0H60.5A39.5 39.5 0 0160.5 79H46Q40 79 27 90 35 79 32 78A39.5 39.5 0 0139.5 0Z',
    logoSize: 'w-full h-full', x: 0, y: -10.5,
  },
  sharp: {
    path: 'M50 3C77 3 97 23 97 50 97 77 77 97 50 97 35 97 26 90 26 90L9 97 15 83C6 71 3 61 3 50 3 23 23 3 50 3Z',
    logoSize: 'w-full h-full', x: 0, y: 0,
  },
};

// ── SapybaseConfig window augmentation ───────────────────────────────────────

declare global {
  interface Window {
    SapybaseConfig?: {
      apiKey?: string;
      apiUrl?: string;
      themeColor?: string;
      botName?: string;
      logoUrl?: string;
      welcomeMessage?: string;
      quickQuestions?: (string | { label?: string; prompt?: string })[];
      logoShape?: string;
      customLogoUrl?: string;
      avatarBgStyle?: string;
    };
  }
}

// ── BotAvatar ─────────────────────────────────────────────────────────────────

type BotAvatarProps = {
  shapeId: string;
  logoUrl: string;
  botName: string;
  themeColor: string;
  sizeClass: string;
  hasShadow?: boolean;
  transparentBgImage?: boolean;
  isCustom?: boolean;
  bgStyle?: string;
};

function BotAvatar({ shapeId, logoUrl, botName, themeColor, sizeClass, hasShadow = true, transparentBgImage = false, isCustom = false, bgStyle = 'none' }: BotAvatarProps) {
  const [imgFailed, setImgFailed] = useState(false);
  const prevUrlRef = useRef(logoUrl);

  useEffect(() => {
    if (logoUrl !== prevUrlRef.current) {
      setImgFailed(false);
      prevUrlRef.current = logoUrl;
    }
  }, [logoUrl]);

  const initial = String(botName || 'S').charAt(0).toUpperCase();
  const showImage = logoUrl && logoUrl.trim() && !imgFailed;
  const activeShapeClass = SHAPE_CLASS_MAP[shapeId] || 'rounded-xl';
  const gradient = bgStyle && bgStyle !== 'none' ? AVATAR_GRADIENTS[bgStyle] : null;

  const bgProps: React.CSSProperties = gradient
    ? { backgroundImage: `linear-gradient(135deg, ${gradient[0]}, ${gradient[1]})`, backgroundColor: 'transparent' }
    : { backgroundColor: showImage ? (transparentBgImage ? 'transparent' : '#ffffff') : themeColor };

  return (
    <div
      className={`${sizeClass} ${activeShapeClass} overflow-hidden! flex! items-center! justify-center! shrink-0! dark:border-slate-700! ${hasShadow ? 'shadow-sm!' : ''} p-0! m-0! border-none!`}
      style={{ ...bgProps, boxSizing: 'border-box' }}
    >
      {showImage ? (
        <img
          src={logoUrl}
          alt={`${botName} logo`}
          className={`m-0! p-0! border-none! bg-transparent! max-w-none! max-h-none! ${isCustom ? 'w-full! h-full! object-contain!' : 'w-[75%]! h-[75%]! object-contain!'}`}
          onError={() => setImgFailed(true)}
          style={{ display: 'block', boxSizing: 'border-box' }}
        />
      ) : (
        <span className="font-bold! leading-none! select-none! text-white! m-0! p-0!" style={{ fontSize: sizeClass.includes('w-10') ? '1rem' : '0.7rem' }}>
          {initial}
        </span>
      )}
    </div>
  );
}

// ── FabWidgetPreview (exported — used by LogoCustomizer) ─────────────────────

export const FabWidgetPreview = ({ shapeId, logoUrl, botName, themeColor, bgStyle, isCustomUrl = false }: {
  shapeId: string; logoUrl: string; botName: string; themeColor: string; bgStyle: string; isCustomUrl?: boolean;
}) => {
  const fabShape = FAB_SHAPES[shapeId] || FAB_SHAPES.circle;
  const FAB_PATH = fabShape.path;
  const AVATAR_BG_STYLE = bgStyle || 'none';
  const THEME_COLOR = themeColor || '#5730F5';
  const BOT_NAME = botName || 'S';
  const gradient = AVATAR_BG_STYLE !== 'none' ? AVATAR_GRADIENTS[AVATAR_BG_STYLE] : null;
  const idPrefix = 'preview';

  return (
    <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" className="w-14 h-14 shrink-0 drop-shadow-sm" overflow="visible">
      <defs>
        <clipPath id={`${idPrefix}-fab-clip`}><path d={FAB_PATH} /></clipPath>
        <filter id={`${idPrefix}-neumorphic-3d-inset`} x="-20%" y="-20%" width="140%" height="140%">
          <feComponentTransfer in="SourceAlpha"><feFuncA type="table" tableValues="1 0" /></feComponentTransfer>
          <feGaussianBlur stdDeviation="3" /><feOffset dx="4" dy="4" result="offsetBlurDark" />
          <feComposite operator="in" in2="SourceAlpha" result="innerShadowDark" />
          <feFlood floodColor="rgba(0,0,0,0.14)" />
          <feComposite operator="in" in2="innerShadowDark" result="finalDark" />
          <feComponentTransfer in="SourceAlpha"><feFuncA type="table" tableValues="1 0" /></feComponentTransfer>
          <feGaussianBlur stdDeviation="3" /><feOffset dx="-3" dy="-3" result="offsetBlurLight" />
          <feComposite operator="in" in2="SourceAlpha" result="innerShadowLight" />
          <feFlood floodColor="rgba(255,255,255,0.8)" />
          <feComposite operator="in" in2="innerShadowLight" result="finalLight" />
          <feMerge><feMergeNode in="SourceGraphic" /><feMergeNode in="finalDark" /><feMergeNode in="finalLight" /></feMerge>
        </filter>
        <linearGradient id={`${idPrefix}-fab-gradient`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFFFFF" /><stop offset="100%" stopColor="#E2E8F0" />
        </linearGradient>
        <linearGradient id={`${idPrefix}-fab-gradient-dark`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#1E293B" /><stop offset="100%" stopColor="#0F172A" />
        </linearGradient>
        {gradient && (
          <linearGradient id={`${idPrefix}-Sapybase-avatar-grad`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={gradient[0]} /><stop offset="100%" stopColor={gradient[1]} />
          </linearGradient>
        )}
      </defs>
      <path d={FAB_PATH} fill={gradient ? `url(#${idPrefix}-Sapybase-avatar-grad)` : `url(#${idPrefix}-fab-gradient)`}
        className={!gradient ? `dark:fill-[url(#${idPrefix}-fab-gradient-dark)] transition-all duration-500` : 'transition-all duration-500'} />
      {logoUrl && (
        <g clipPath={`url(#${idPrefix}-fab-clip)`}>
          <image href={logoUrl} x={isCustomUrl ? (fabShape.x || 0) : (15 + (fabShape.x || 0))} y={isCustomUrl ? (fabShape.y || 0) : (15 + (fabShape.y || 0))}
            width={isCustomUrl ? 100 : 70} height={isCustomUrl ? 100 : 70} preserveAspectRatio="xMidYMid meet" />
        </g>
      )}
      {!logoUrl && (
        <text x={50 + (fabShape.x || 0)} y={52 + (fabShape.y || 0)} textAnchor="middle" dominantBaseline="middle"
          fill={gradient ? '#ffffff' : THEME_COLOR} className="font-bold select-none pointer-events-none"
          style={{ fontSize: '26px', fontFamily: 'var(--font-display, sans-serif)' }}>
          {(BOT_NAME || 'S').charAt(0).toUpperCase()}
        </text>
      )}
      <path d={FAB_PATH} fill="transparent" filter={`url(#${idPrefix}-neumorphic-3d-inset)`} className="pointer-events-none" />
    </svg>
  );
};

// ── LeadCaptureForm ───────────────────────────────────────────────────────────

function LeadCaptureForm({ onSubmit, onDismiss, themeColor, activeApiUrl, apiKey, contextString, error: externalError }: {
  onSubmit: (name: string) => void; onDismiss: () => void; themeColor: string;
  activeApiUrl: string; apiKey: string; contextString: string; error?: string;
}) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localError, setLocalError] = useState(externalError || '');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError('');
    const parsed = leadCaptureSchema.safeParse({ email, name });
    const issue = firstIssue(parsed);
    if (issue || !parsed.success) {
      setLocalError(issue || 'Invalid input.');
      return;
    }
    setIsSubmitting(true);
    try {
      const parentOrigin = (typeof window !== 'undefined'
        && (window as unknown as { __SapybaseParentOrigin?: string }).__SapybaseParentOrigin) || '';
      const res = await fetch(`${activeApiUrl}/api/leads/capture`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          ...(parentOrigin ? { 'x-Sapybase-parent-origin': parentOrigin } : {}),
        },
        body: JSON.stringify({ email: parsed.data.email, name: parsed.data.name ?? '', context: contextString }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to submit.');
      onSubmit(name);
    } catch {
      setLocalError('Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700/60 rounded-2xl p-4 shadow-sm space-y-3 w-full self-start text-left mt-2 relative">
      <h4 className="text-sm font-google font-bold text-gray-800 dark:text-slate-200 text-center uppercase tracking-widest text-[12px] mb-2 leading-tight">
        Leave your details<br />and we'll follow up!
      </h4>
      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        <input type="text" placeholder="Name (optional)" value={name} onChange={e => setName(e.target.value)}
          className="w-full bg-slate-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl px-3 py-2 text-base sm:text-sm font-regular font-google text-gray-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1" />
        <div className="flex flex-col gap-1">
          <input type="email" placeholder="Email address (required)" value={email} onChange={e => setEmail(e.target.value)} required
            className="w-full bg-slate-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl px-3 py-2 text-base sm:text-sm font-regular font-google text-gray-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1" />
          {localError && <span className="text-[11px] text-red-500 font-bold px-1">{localError}</span>}
        </div>
        <button type="submit" disabled={isSubmitting}
          className="w-full mt-1 rounded-xl py-2 text-sm font-regular font-google text-white transition-opacity hover:opacity-90 disabled:opacity-50 flex items-center justify-center min-h-[44px]"
          style={{ backgroundColor: themeColor }}>
          {isSubmitting ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Submit'}
        </button>
      </form>
      <div className="text-center mt-3">
        <button onClick={onDismiss} type="button"
          className="text-sm font-regular font-google text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 underline underline-offset-2 transition-colors cursor-pointer bg-transparent border-none py-3 px-2 w-full min-h-[44px]">
          No thanks
        </button>
      </div>
    </div>
  );
}

// ── HandoffContactForm ────────────────────────────────────────────────────────

function HandoffContactForm({ themeColor, onSubmit, onDismiss }: {
  themeColor: string; onSubmit: (email: string, name: string) => Promise<void>; onDismiss: () => void;
}) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const parsed = handoffSchema.safeParse({ email });
    const issue = firstIssue(parsed);
    if (issue || !parsed.success) {
      setError(issue || 'Invalid input.');
      return;
    }
    setIsSubmitting(true);
    await onSubmit(parsed.data.email.toLowerCase(), name.trim());
    setIsSubmitting(false);
  };

  return (
    <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700/60 rounded-2xl p-4 shadow-sm space-y-3 w-full self-start text-left mt-2 relative">
      <h4 className="text-sm font-google font-bold text-gray-800 dark:text-slate-200 text-center uppercase tracking-widest text-[12px] mb-2 leading-tight">
        Share your details<br />so our team can reach you
      </h4>
      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        <input type="text" placeholder="Name (optional)" value={name} onChange={e => setName(e.target.value)}
          className="w-full bg-slate-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl px-3 py-2 text-base sm:text-sm font-regular font-google text-gray-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1" />
        <div className="flex flex-col gap-1">
          <input type="email" placeholder="Email address (required)" value={email} onChange={e => setEmail(e.target.value)} required
            className="w-full bg-slate-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl px-3 py-2 text-base sm:text-sm font-regular font-google text-gray-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1" />
          {error && <span className="text-[11px] text-red-500 font-bold px-1">{error}</span>}
        </div>
        <button type="submit" disabled={isSubmitting}
          className="w-full mt-1 rounded-xl py-2 text-sm font-regular font-google text-white transition-opacity hover:opacity-90 disabled:opacity-50 flex items-center justify-center min-h-[44px]"
          style={{ backgroundColor: themeColor }}>
          {isSubmitting ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Notify the team'}
        </button>
      </form>
      <div className="text-center mt-3">
        <button onClick={onDismiss} type="button"
          className="text-sm font-regular font-google text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 underline underline-offset-2 transition-colors cursor-pointer bg-transparent border-none py-3 px-2 w-full min-h-[44px]">
          No thanks
        </button>
      </div>
    </div>
  );
}

// ── Types ─────────────────────────────────────────────────────────────────────

type Message = {
  role: 'user' | 'bot' | 'lead_capture' | 'handoff_form' | 'handoff_confirmed';
  content?: string;
  isStreaming?: boolean;
  isTyped?: boolean;
  id?: string;
  visitorEmail?: string;
  redirectUrl?: string;
};

type ConfigData = {
  theme_color: string;
  bot_name: string;
  logo_url: string;
  initial_message: string;
  quick_questions: (string | { label?: string; prompt?: string })[];
  logo_shape: string;
  custom_logo_url: string;
  avatar_bg_style: string;
  lead_capture_enabled?: boolean;
  white_label_enabled?: boolean;
};

// ── Stream-safe Markdown sanitizer ───────────────────────────────────────────

function sanitizeStreamMarkdown(text: string): string {
  if (!text) return '';
  let result = text;
  const fenceMatches = result.match(/```/g);
  if (fenceMatches && fenceMatches.length % 2 !== 0) result += '\n```';
  const withoutFences = result.replace(/```[\s\S]*?```/g, '');
  const boldMatches = withoutFences.match(/\*\*/g);
  if (boldMatches && boldMatches.length % 2 !== 0) result += '**';
  const withoutBold = withoutFences.replace(/\*\*/g, '');
  const italicMatches = withoutBold.match(/\*/g);
  if (italicMatches && italicMatches.length % 2 !== 0) result += '*';
  const inlineCodeMatches = withoutFences.match(/(?<!`)`(?!`)/g);
  if (inlineCodeMatches && inlineCodeMatches.length % 2 !== 0) result += '`';
  return result;
}

// ── Shared Markdown renderer config ──────────────────────────────────────────

const MD_COMPONENTS = {
  p: ({ children, ...props }: React.ComponentPropsWithoutRef<'p'>) => (
    <p {...props} className="first:mt-0 last:mb-0 mb-2">{children}</p>
  ),
  pre: ({ children, ...props }: React.ComponentPropsWithoutRef<'pre'>) => (
    <div className="overflow-x-auto rounded-lg my-2 scrollbar-thin">
      <pre {...props}>{children}</pre>
    </div>
  ),
};

const CROSSFADE_MS = 180;

// ── TypewriterContent ─────────────────────────────────────────────────────────

type StreamCallbacks = {
  push: (token: string) => void;
  flush: () => string;
  getContent: () => string;
};

type TypewriterContentProps = {
  content: string;
  isStreaming?: boolean;
  isTyped?: boolean;
  onComplete?: () => void;
  themeColor?: string;
  streamCallbackRef?: React.MutableRefObject<StreamCallbacks | null>;
  onStreamTick?: () => void;
};

function TypewriterContent({ content, isStreaming, isTyped, onComplete, themeColor = '#5730F5', streamCallbackRef, onStreamTick }: TypewriterContentProps) {
  const [segments, setSegments] = useState<string[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const lastContent = useRef('');
  const typewriterTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [displayedText, setDisplayedText] = useState('');
  const bufferRef = useRef('');
  const displayIdxRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const lastTickRef = useRef(0);
  const onStreamTickRef = useRef(onStreamTick);

  const [isFinalizing, setIsFinalizing] = useState(false);
  const frozenTextRef = useRef('');
  const finalizeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { onStreamTickRef.current = onStreamTick; }, [onStreamTick]);

  useEffect(() => {
    if (isStreaming && streamCallbackRef) {
      const drain = (timestamp: number) => {
        if (!lastTickRef.current) lastTickRef.current = timestamp;
        const delta = timestamp - lastTickRef.current;
        if (delta >= 26) {
          lastTickRef.current = timestamp;
          const buffer = bufferRef.current;
          const idx = displayIdxRef.current;
          if (idx < buffer.length) {
            const ahead = buffer.length - idx;
            const charsToAdd = ahead > 80 ? 3 : ahead > 30 ? 2 : 1;
            const newIdx = Math.min(idx + charsToAdd, buffer.length);
            displayIdxRef.current = newIdx;
            setDisplayedText(buffer.slice(0, newIdx));
            onStreamTickRef.current?.();
          }
        }
        rafRef.current = requestAnimationFrame(drain);
      };

      streamCallbackRef.current = {
        push: (token) => {
          bufferRef.current += token;
          if (!rafRef.current) {
            lastTickRef.current = 0;
            rafRef.current = requestAnimationFrame(drain);
          }
        },
        flush: () => {
          const full = bufferRef.current;
          if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
          displayIdxRef.current = full.length;
          return full;
        },
        getContent: () => bufferRef.current,
      };

      return () => {
        if (streamCallbackRef) streamCallbackRef.current = null;
        if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
      };
    }
  }, [isStreaming, streamCallbackRef]);

  useEffect(() => {
    if (isStreaming) {
      setDisplayedText('');
      setIsFinalizing(false);
      frozenTextRef.current = '';
      bufferRef.current = '';
      displayIdxRef.current = 0;
    }
  }, [isStreaming]);

  const prevIsStreamingRef = useRef(isStreaming);
  useEffect(() => {
    const wasStreaming = prevIsStreamingRef.current;
    prevIsStreamingRef.current = isStreaming;
    if (wasStreaming && !isStreaming && content && displayedText.length > 0) {
      frozenTextRef.current = content;
      setIsFinalizing(true);
      finalizeTimerRef.current = setTimeout(() => setIsFinalizing(false), CROSSFADE_MS);
    }
  }, [isStreaming, content, displayedText]);

  useEffect(() => {
    return () => {
      if (typewriterTimerRef.current) clearTimeout(typewriterTimerRef.current);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (finalizeTimerRef.current) clearTimeout(finalizeTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (isStreaming || isTyped || !content) { setIsTyping(false); return; }
    if (content !== lastContent.current) {
      lastContent.current = content;
      setSegments([]);
      setIsTyping(true);
      frozenTextRef.current = '';
      let currentIdx = 0;
      const words = content.split(/(\s+)/);
      const typeNextWord = () => {
        if (currentIdx < words.length) {
          const word = words[currentIdx];
          setSegments(prev => [...prev, word]);
          currentIdx++;
          const delay = /[.!?,;:]$/.test(word) ? 90 : 45;
          typewriterTimerRef.current = setTimeout(typeNextWord, delay + (Math.random() * 20 - 10));
        } else {
          setIsTyping(false);
          frozenTextRef.current = content;
          setIsFinalizing(true);
          finalizeTimerRef.current = setTimeout(() => {
            setIsFinalizing(false);
            if (onComplete) onComplete();
          }, CROSSFADE_MS);
        }
      };
      typeNextWord();
    }
  }, [content, isTyped, isStreaming, onComplete]);

  const markdownNode = (
    <ReactMarkdown rehypePlugins={[rehypeSanitize]} components={MD_COMPONENTS}>
      {frozenTextRef.current || content}
    </ReactMarkdown>
  );

  if (isFinalizing) {
    return (
      <div className="relative leading-relaxed text-sm">
        <div style={{ opacity: 0, animation: `sapy-fade-in ${CROSSFADE_MS}ms ease-out forwards` }}>{markdownNode}</div>
        <div aria-hidden="true" style={{ position: 'absolute', top: 0, left: 0, width: '100%', opacity: 1, animation: `sapy-fade-out ${CROSSFADE_MS}ms ease-out forwards`, pointerEvents: 'none' }}>
          <ReactMarkdown rehypePlugins={[rehypeSanitize]} components={MD_COMPONENTS}>
            {frozenTextRef.current || content}
          </ReactMarkdown>
          <span className="sapy-stream-cursor" style={{ backgroundColor: themeColor, animation: `sapy-fade-out ${CROSSFADE_MS}ms ease-out forwards` }} />
        </div>
      </div>
    );
  }

  if (isStreaming) {
    const hasContent = displayedText.length > 0;
    return (
      <div className="relative min-h-[28px]">
        <div style={{ opacity: hasContent ? 0 : 1, position: hasContent ? 'absolute' : 'relative', transition: 'opacity 0.2s ease-out', pointerEvents: hasContent ? 'none' : 'auto' }}>
          <ThinkingLogo size={40} className="origin-left" themeColor={themeColor} />
        </div>
        {hasContent && (
          <div className="leading-relaxed text-sm">
            <ReactMarkdown rehypePlugins={[rehypeSanitize]} components={MD_COMPONENTS}>
              {sanitizeStreamMarkdown(displayedText)}
            </ReactMarkdown>
            <span className="sapy-stream-cursor" style={{ backgroundColor: themeColor }} />
          </div>
        )}
      </div>
    );
  }

  if (isTyping && segments.length > 0) {
    return (
      <div className="relative leading-relaxed text-sm">
        <ReactMarkdown rehypePlugins={[rehypeSanitize]} components={MD_COMPONENTS}>
          {sanitizeStreamMarkdown(segments.join(''))}
        </ReactMarkdown>
      </div>
    );
  }

  if (content && !isTyped && !isTyping) {
    return <div className="relative min-h-[28px]" />;
  }

  return <div className="relative leading-relaxed text-sm">{markdownNode}</div>;
}

// ── ChatWidget ────────────────────────────────────────────────────────────────

type ChatWidgetProps = { apiKey?: string; isEmbed?: boolean };

export default function ChatWidget({ apiKey, isEmbed = false }: ChatWidgetProps) {
  // Resolve API key and base URL (supports both prop and window.SapybaseConfig)
  const activeApiKey = apiKey ?? (typeof window !== 'undefined' ? window.SapybaseConfig?.apiKey : undefined);
  const activeApiUrl = typeof window !== 'undefined'
    ? (window.SapybaseConfig?.apiUrl ?? (IS_DEV ? 'http://localhost:8000' : 'https://sapyai.onrender.com'))
    : (IS_DEV ? 'http://localhost:8000' : 'https://sapyai.onrender.com');

  const DEFAULT_CONFIG: ConfigData = {
    theme_color: (typeof window !== 'undefined' && window.SapybaseConfig?.themeColor) || '#5730F5',
    bot_name: (typeof window !== 'undefined' && window.SapybaseConfig?.botName) || 'Sapy AI',
    logo_url: (typeof window !== 'undefined' && window.SapybaseConfig?.logoUrl) || `${ASSET_BASE}/SB_loading.svg`,
    initial_message: (typeof window !== 'undefined' && window.SapybaseConfig?.welcomeMessage) || "Hi! I'm your AI assistant. How can I help you today?",
    quick_questions: (typeof window !== 'undefined' && window.SapybaseConfig?.quickQuestions) || [],
    logo_shape: (typeof window !== 'undefined' && window.SapybaseConfig?.logoShape) || 'circle',
    custom_logo_url: (typeof window !== 'undefined' && window.SapybaseConfig?.customLogoUrl) || '',
    avatar_bg_style: (typeof window !== 'undefined' && window.SapybaseConfig?.avatarBgStyle) || 'none',
  };

  const [configData, setConfigData] = useState<ConfigData>(DEFAULT_CONFIG);
  const [sessionId] = useState<string>(() =>
    typeof window !== 'undefined' && window.crypto?.randomUUID
      ? window.crypto.randomUUID()
      : Math.random().toString(36).substring(2, 15)
  );

  const leadCaptureEnabledRef = useRef(false);

  useEffect(() => {
    if (!activeApiKey) return;
    const fetchConfig = async () => {
      try {
        const parentOrigin = (window as unknown as { __SapybaseParentOrigin?: string }).__SapybaseParentOrigin || '';
        const res = await fetch(`${activeApiUrl}/api/config`, {
          headers: {
            'x-api-key': activeApiKey,
            ...(parentOrigin ? { 'x-Sapybase-parent-origin': parentOrigin } : {}),
          },
        });
        if (res.ok) {
          const data = await res.json();
          setConfigData({
            theme_color: data.theme_color || DEFAULT_CONFIG.theme_color,
            bot_name: data.bot_name || DEFAULT_CONFIG.bot_name,
            logo_url: data.logo_url || DEFAULT_CONFIG.logo_url,
            initial_message: data.initial_message || DEFAULT_CONFIG.initial_message,
            quick_questions: data.quick_questions || [],
            logo_shape: data.logo_shape || 'circle',
            custom_logo_url: data.custom_logo_url || '',
            avatar_bg_style: data.avatar_bg_style || 'none',
            lead_capture_enabled: data.lead_capture_enabled || false,
            white_label_enabled: data.white_label_enabled === true,
          });
          leadCaptureEnabledRef.current = data.lead_capture_enabled || false;
          setMessages(prev => {
            if (prev.length === 1 && prev[0].role === 'bot') {
              return [{ role: 'bot', content: data.initial_message || DEFAULT_CONFIG.initial_message }];
            }
            return prev;
          });
        }
      } catch (err) {
        console.warn('[Sapybase] Could not load bot config:', err);
      }
    };
    fetchConfig();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeApiKey]);

  const BOT_NAME = configData.bot_name || 'Sapybase';
  const THEME_COLOR = configData.theme_color || '#5730F5';
  const LOGO_URL = configData.custom_logo_url || configData.logo_url;
  const LOGO_SHAPE = configData.logo_shape || 'circle';
  const AVATAR_BG_STYLE = configData.avatar_bg_style || 'none';

  const leadCapturedRef = useRef(false);
  const leadFormShownRef = useRef(false);
  const userMessageCountRef = useRef(0);
  const [clearCount, setClearCount] = useState(0);

  const [isOpen, setIsOpen] = useState(isEmbed);
  const [showMenu, setShowMenu] = useState(false);
  const [handoffSent, setHandoffSent] = useState(false);
  const [messages, setMessages] = useState<Message[]>([{ role: 'bot', content: DEFAULT_CONFIG.initial_message }]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setIsMobile(window.innerWidth < 640);
    const handleResize = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Mobile keyboard fix: 100dvh excludes the URL bar but NOT the on-screen
  // keyboard, so the input row gets hidden behind it on iOS/Android. Track
  // visualViewport.height (which DOES shrink for the keyboard) and feed it
  // to the panel via a CSS variable.
  useEffect(() => {
    if (!isMobile || !isOpen) return;
    const vv = window.visualViewport;
    if (!vv) return;

    const sync = () => {
      document.documentElement.style.setProperty('--sapy-vh', `${vv.height}px`);
      const active = document.activeElement as HTMLElement | null;
      if (active && active.tagName === 'TEXTAREA') {
        active.scrollIntoView({ block: 'end' });
      }
    };
    sync();
    vv.addEventListener('resize', sync);
    vv.addEventListener('scroll', sync);
    return () => {
      vv.removeEventListener('resize', sync);
      vv.removeEventListener('scroll', sync);
      document.documentElement.style.removeProperty('--sapy-vh');
    };
  }, [isMobile, isOpen]);

  useEffect(() => {
    if (isEmbed && !isOpen) {
      window.parent.postMessage({ type: 'Sapybase:close' }, '*');
    }
  }, [isOpen, isEmbed]);

  // Typewriter promo label
  const [currentPhrase, setCurrentPhrase] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [loopNum, setLoopNum] = useState(0);
  const [typingSpeed, setTypingSpeed] = useState(100);
  const phrases = ['Chat with me !', 'Have questions ?', "I'm here to help!", 'Powered by Sapybase !'];

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const handleTyping = () => {
      const i = loopNum % phrases.length;
      const fullText = phrases[i];
      setCurrentPhrase(isDeleting ? fullText.substring(0, currentPhrase.length - 1) : fullText.substring(0, currentPhrase.length + 1));
      setTypingSpeed(isDeleting ? 40 : 100);
      if (!isDeleting && currentPhrase === fullText) {
        timer = setTimeout(() => setIsDeleting(true), 2500);
      } else if (isDeleting && currentPhrase === '') {
        setIsDeleting(false);
        setLoopNum(loopNum + 1);
      } else {
        timer = setTimeout(handleTyping, typingSpeed);
      }
    };
    timer = setTimeout(handleTyping, typingSpeed);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPhrase, isDeleting, loopNum, typingSpeed]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const userHasScrolledUpRef = useRef(false);
  const streamingCallbackRef = useRef<StreamCallbacks | null>(null);
  const animatedMsgIndices = useRef(new Set<number>());

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setShowMenu(false);
    };
    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showMenu]);

  const isNearBottom = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < 60;
  }, []);

  const scrollToBottom = useCallback((smooth = true) => {
    if (userHasScrolledUpRef.current) return;
    const el = scrollContainerRef.current;
    if (el && !smooth) { el.scrollTop = el.scrollHeight; }
    else { messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' }); }
  }, []);

  const forceScrollToBottom = useCallback((smooth = true) => {
    userHasScrolledUpRef.current = false;
    const el = scrollContainerRef.current;
    if (el && !smooth) { el.scrollTop = el.scrollHeight; }
    else { messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' }); }
  }, []);

  const handleScrollContainer = useCallback(() => {
    userHasScrolledUpRef.current = !isNearBottom();
  }, [isNearBottom]);

  const handleTypingComplete = useCallback((index: number) => {
    setMessages(prev => {
      const updated = [...prev];
      if (updated[index]) updated[index] = { ...updated[index], isTyped: true };
      return updated;
    });
    scrollToBottom(true);
  }, [scrollToBottom]);

  useEffect(() => {
    const lastMsg = messages[messages.length - 1];
    if (lastMsg?.role === 'user') { forceScrollToBottom(true); }
    else if (lastMsg?.role === 'bot' && lastMsg.isStreaming && lastMsg.content === '') { forceScrollToBottom(true); }
    else if (isLoading) { forceScrollToBottom(true); }
    else { scrollToBottom(true); }
  }, [messages.length, isLoading, forceScrollToBottom, scrollToBottom]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => { forceScrollToBottom(false); inputRef.current?.focus(); }, 10);
    }
  }, [isOpen, forceScrollToBottom]);

  useEffect(() => {
    if (!inputRef.current) return;
    inputRef.current.style.height = 'auto';
    inputRef.current.style.height = `${inputRef.current.scrollHeight}px`;
  }, [input]);

  const sendMessage = async (text: string) => {
    const userMessage = text.trim();
    if (!userMessage || isLoading) return;
    setInput('');
    await handleSend(null, userMessage);
  };

  const handleSend = async (e: React.FormEvent | null, overrideText?: string) => {
    if (e) e.preventDefault();
    if (!overrideText && !input.trim()) return;

    const userMessage = overrideText || input.trim();
    userMessageCountRef.current += 1;
    setMessages(prev => [
      ...prev,
      { role: 'user', content: userMessage },
      { role: 'bot', content: '', isStreaming: true, isTyped: false },
    ]);
    setInput('');
    setIsLoading(true);
    userHasScrolledUpRef.current = false;

    if (abortControllerRef.current) abortControllerRef.current.abort();
    const ctrl = new AbortController();
    abortControllerRef.current = ctrl;

    const resolvedApiKey = activeApiKey;
    if (!resolvedApiKey) {
      setMessages(prev => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last?.role === 'bot' && last.isStreaming) {
          updated[updated.length - 1] = { role: 'bot', content: 'Configure your API Key locally to start chatting with Sapy AI!', isStreaming: false, isTyped: false };
        }
        return updated;
      });
      setIsLoading(false);
      return;
    }

    const recentHistory = messages.slice(-4).map(m => ({ role: m.role, content: m.content }));
    let firstChunkReceived = false;
    let sseRetryCount = 0;
    const SSE_MAX_RETRIES = 1;

    try {
      const parentOriginChat = (typeof window !== 'undefined'
        && (window as unknown as { __SapybaseParentOrigin?: string }).__SapybaseParentOrigin) || '';
      await fetchEventSource(`${activeApiUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': resolvedApiKey,
          ...(parentOriginChat ? { 'x-Sapybase-parent-origin': parentOriginChat } : {}),
        },
        body: JSON.stringify({ message: userMessage, history: recentHistory, session_id: sessionId }),
        signal: ctrl.signal,
        openWhenHidden: true,

        async onopen(response) {
          if (response.ok && response.headers.get('content-type')?.includes('application/json')) {
            const data = await response.json();
            setMessages(prev => {
              const updated = [...prev];
              const last = updated[updated.length - 1];
              if (last?.role === 'bot' && last.isStreaming) {
                updated[updated.length - 1] = { role: 'bot', content: data.reply, isStreaming: false, isTyped: false };
              } else {
                updated.push({ role: 'bot', content: data.reply });
              }
              return updated;
            });
            setIsLoading(false);
            throw new Error('CACHE_HIT');
          }
          if (!response.ok) {
            if (response.status === 402) {
              let detail = null;
              try { detail = await response.json(); } catch { /* noop */ }
              const isMessageLimit = (detail as { detail?: { code?: string } })?.detail?.code === 'MESSAGE_LIMIT_EXCEEDED';
              const errorContent = isMessageLimit
                ? `I've reached my monthly message limit. Please contact the site owner to upgrade their plan at [Sapybase.com](https://www.Sapybase.com). I'll be back next billing cycle! 🚀`
                : "I'm temporarily unavailable. Please try again later.";
              setMessages(prev => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last?.role === 'bot' && last.isStreaming) {
                  updated[updated.length - 1] = { role: 'bot', content: errorContent, isStreaming: false, isTyped: false };
                } else {
                  updated.push({ role: 'bot', content: errorContent });
                }
                return updated;
              });
              setIsLoading(false);
              throw new Error('HANDLED_ERROR');
            }
            if (response.status === 429) {
              // Rate-limited by the technical per-minute cap. Distinct from the
              // 402 commercial cap above. The Phase 2 silent-retry must NOT
              // fire here — retrying a 429 makes it worse. We throw
              // HANDLED_ERROR so the onerror short-circuit skips the retry.
              let retryAfter = 60;
              try {
                const headerVal = response.headers.get('Retry-After');
                if (headerVal && /^\d+$/.test(headerVal)) retryAfter = parseInt(headerVal, 10);
                else {
                  const detail = await response.json();
                  const ra = (detail as { detail?: { retry_after?: number } })?.detail?.retry_after;
                  if (typeof ra === 'number') retryAfter = ra;
                }
              } catch { /* keep default */ }
              const waitLabel = retryAfter >= 60 ? `${Math.ceil(retryAfter / 60)} minute${retryAfter >= 120 ? 's' : ''}` : `${retryAfter} seconds`;
              const errorContent = `You're sending messages a bit fast! Please wait ${waitLabel} and try again.`;
              setMessages(prev => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last?.role === 'bot' && last.isStreaming) {
                  updated[updated.length - 1] = { role: 'bot', content: errorContent, isStreaming: false, isTyped: false };
                } else {
                  updated.push({ role: 'bot', content: errorContent });
                }
                return updated;
              });
              setIsLoading(false);
              throw new Error('HANDLED_ERROR');
            }
            throw new Error(`Server error: ${response.status}`);
          }
        },

        onmessage(msg) {
          if (msg.data === '[DONE]') {
            const fullContent = streamingCallbackRef.current?.flush?.() || '';
            setMessages(prev => {
              const updated = [...prev];
              const last = updated[updated.length - 1];
              if (last?.role === 'bot') {
                updated[updated.length - 1] = { ...last, content: fullContent, isStreaming: false, isTyped: true };
              }
              return updated;
            });
            setIsLoading(false);
            forceScrollToBottom(true);

            // Lead capture trigger
            if (leadCaptureEnabledRef.current && !leadCapturedRef.current && !leadFormShownRef.current) {
              const lowerReply = fullContent.toLowerCase();
              const lowerUserMsg = userMessage.toLowerCase();
              const intentWords = ['contact us', 'reach out', 'get in touch', 'schedule', 'book a', 'free trial', 'pricing', 'get started', 'sign up', 'demo', 'consultation', 'quote', 'let us know', 'our team will', 'speak with', 'talk to'];
              const userIntentWords = ['quote', 'price', 'pricing', 'cost', 'how much', 'rate', 'package', 'buy', 'purchase', 'hire', 'get started', 'book', 'order', 'interested', 'want to', 'i need', 'can you build', 'can you make', 'can you create', 'build me', 'make me', 'create me', 'help me build', 'looking for'];
              const fallbackPhrases = ['does not appear in my knowledge base', "don't have information on that", 'please reach out to', 'contact our support'];

              const isIntent = intentWords.some(w => lowerReply.includes(w));
              const isUserIntent = userIntentWords.some(w => lowerUserMsg.includes(w));
              const isFallback = fallbackPhrases.some(w => lowerReply.includes(w));
              const isThirdMessage = userMessageCountRef.current === 3;

              if (isIntent || isUserIntent || isFallback || isThirdMessage) {
                leadFormShownRef.current = true;
                setTimeout(() => {
                  setMessages(prev => {
                    if (prev.some(m => m.role === 'lead_capture')) return prev;
                    return [...prev, { role: 'lead_capture', id: 'lead-form' }];
                  });
                  setTimeout(() => forceScrollToBottom(true), 100);
                }, (isIntent || isUserIntent) ? 1500 : 2000);
              }
            }
            return;
          }

          let chunk = '';
          try {
            const parsed = JSON.parse(msg.data);
            chunk = parsed.token || parsed.content || parsed.text || '';
          } catch {
            chunk = msg.data;
          }
          if (!chunk) return;
          if (!firstChunkReceived) { firstChunkReceived = true; setIsLoading(false); }
          streamingCallbackRef.current?.push?.(chunk);
        },

        onerror(err: Error) {
          if (err.message === 'CACHE_HIT' || err.message === 'HANDLED_ERROR') throw err;
          if (err.name === 'AbortError') throw err;

          // Silent single retry on transient network failures (wifi blip,
          // proxy idle-kill). Returning a number tells fetch-event-source to
          // wait that many ms then reconnect — the existing partial stream
          // remains in streamingCallbackRef and continues accumulating.
          if (sseRetryCount < SSE_MAX_RETRIES) {
            sseRetryCount += 1;
            console.warn(`SSE Chat: transient error, retrying (${sseRetryCount}/${SSE_MAX_RETRIES})`, err);
            return 1500;
          }

          console.error('SSE Chat Error (giving up):', err);
          // Preserve whatever streamed so far instead of replacing the message.
          const partial = streamingCallbackRef.current?.flush?.() || '';
          setMessages(prev => {
            const updated = [...prev];
            const last = updated[updated.length - 1];
            const fallback = "I'm having trouble connecting to the Sapybase servers right now. Please try again later or use the contact form.";
            const content = partial.trim()
              ? partial + '\n\n_(Connection lost — message may be incomplete.)_'
              : fallback;
            if (last?.role === 'bot' && last.isStreaming) {
              updated[updated.length - 1] = { role: 'bot', content, isStreaming: false, isTyped: false };
            } else {
              updated.push({ role: 'bot', content });
            }
            return updated;
          });
          setIsLoading(false);
          throw err;
        },

        onclose() { setIsLoading(false); },
      });
    } catch (err) {
      if (err instanceof Error && (err.name === 'AbortError' || err.message === 'CACHE_HIT' || err.message === 'HANDLED_ERROR')) return;
      console.error('Chat Error (outer):', err);
      setIsLoading(false);
    }
  };

  const handleHandoff = () => {
    setShowMenu(false);
    if (handoffSent) return;
    setMessages(prev => [
      ...prev,
      { role: 'bot', content: "I'll connect you with our team! Share your email so they can reply to you directly. 👇", isTyped: false },
      { role: 'handoff_form', id: 'handoff-form' },
    ]);
  };

  const submitHandoff = async (visitorEmail: string, visitorName: string) => {
    setHandoffSent(true);
    const transcript = messages.filter(m => m.role === 'user' || m.role === 'bot').map(m => ({ role: m.role, content: m.content || '' }));
    try {
      const parentOriginHandoff = (typeof window !== 'undefined'
        && (window as unknown as { __SapybaseParentOrigin?: string }).__SapybaseParentOrigin) || '';
      const res = await fetch(`${activeApiUrl}/api/handoff`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': resolvedApiKey!,
          ...(parentOriginHandoff ? { 'x-Sapybase-parent-origin': parentOriginHandoff } : {}),
        },
        body: JSON.stringify({ transcript, visitor_email: visitorEmail, visitor_name: visitorName || null }),
      });
      const data = res.ok ? await res.json() : {};
      setMessages(prev => prev.map(m =>
        m.id === 'handoff-form'
          ? { role: 'handoff_confirmed', visitorEmail, redirectUrl: data.handoff_redirect_url, id: 'handoff-confirmed' }
          : m
      ));
    } catch (err) {
      console.warn('[Sapybase] Handoff request failed:', err);
      setMessages(prev => prev.map(m =>
        m.id === 'handoff-form' ? { role: 'bot', content: 'Something went wrong. Please try again.', isTyped: false } : m
      ));
      setHandoffSent(false);
    }
  };

  // resolvedApiKey alias used in submitHandoff closure
  const resolvedApiKey = activeApiKey;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!isLoading) handleSend(null);
    }
  };

  if (!activeApiKey) return null;

  const fabShape = FAB_SHAPES[LOGO_SHAPE] || FAB_SHAPES.circle;
  const FAB_PATH = fabShape.path;
  const fabGradient = AVATAR_BG_STYLE !== 'none' ? AVATAR_GRADIENTS[AVATAR_BG_STYLE] : null;

  return (
    <div className={`${isEmbed ? 'relative w-full h-full' : 'fixed bottom-0 right-0 sm:bottom-6 sm:right-6'} z-[2147483647] font-sans pointer-events-none`} style={{ isolation: 'isolate', width: isOpen ? '100%' : 'auto', height: isOpen ? '100%' : 'auto' }}>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            variants={{ hidden: { opacity: 0, scale: 0.8, y: 20, transformOrigin: 'bottom right' }, visible: { opacity: 1, scale: 1, y: 0, transition: { type: 'spring', stiffness: 350, damping: 25 } }, exit: { opacity: 0, scale: 0.8, y: 20, transition: { duration: 0.2 } } }}
            initial={isEmbed ? "visible" : "hidden"} animate="visible" exit="exit"
            className={`${isEmbed ? 'relative w-full h-full' : 'fixed inset-0 sm:inset-auto sm:bottom-26 sm:right-6 w-full h-dvh sm:w-[480px] sm:h-[600px]'} bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl sm:rounded-2xl shadow-lg shadow-blue-900/20 dark:shadow-black/40 flex flex-col sm:overflow-hidden border-t sm:border border-gray-200/50 dark:border-slate-800/50 z-[2147483647] pointer-events-auto origin-bottom-right`}
            style={isEmbed ? { height: '100%' } : (isMobile ? { height: 'var(--sapy-vh, 100dvh)' } : {})}
          >
            {/* Header */}
            <div className="relative shrink-0">
              <div className="absolute inset-0 animate-gradient-x opacity-20" style={{ background: `linear-gradient(90deg, ${THEME_COLOR}, #f97316, ${THEME_COLOR})`, backgroundSize: '200% 200%' }} />
              <div className="bg-white/40 dark:bg-slate-900/40 backdrop-blur-md text-slate-900 dark:text-slate-100 p-2 pt-[max(env(safe-area-inset-top),0.75rem)] sm:pt-2 flex justify-end items-center relative z-10 border-b border-gray-200/50 dark:border-slate-800/50">
                <div className="relative flex flex-row justify-between items-center w-full" ref={menuRef}>
                  <div className="relative flex items-center gap-3 pl-4">
                    <div className="relative">
                      <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-500 border-2 border-white animate-pulse z-10" />
                      <BotAvatar shapeId={LOGO_SHAPE} logoUrl={LOGO_URL} botName={BOT_NAME} themeColor={THEME_COLOR} sizeClass="w-10 h-10" isCustom={!!configData.custom_logo_url} />
                    </div>
                    <p className="text-lg font-display font-bold" style={{ color: THEME_COLOR }}>{BOT_NAME}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setShowMenu(!showMenu)} className="p-2.5 sm:p-2 hover:bg-black/5 dark:hover:bg-white/10 rounded-full transition-colors focus:outline-none min-w-[44px] min-h-[44px] flex items-center justify-center" aria-label="Chat menu">
                      <MoreHorizontal size={22} className="text-slate-500 dark:text-slate-400" />
                    </button>
                    <button onClick={() => {
                      if (isEmbed) {
                        window.parent.postMessage({ type: 'Sapybase:close' }, '*');
                      } else {
                        setIsOpen(false);
                      }
                    }} className="p-2.5 sm:p-2 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-full transition-colors group focus:outline-none min-w-[44px] min-h-[44px] flex items-center justify-center" aria-label="Close chat">
                      <X size={22} className="text-red-500 dark:text-red-400 transition-transform group-hover:rotate-90" />
                    </button>
                  </div>
                  <AnimatePresence>
                    {showMenu && (
                      <motion.div initial={{ opacity: 0, scale: 0.95, y: -10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: -10 }}
                        className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-slate-800 backdrop-blur-md rounded-xl shadow-2xl border border-gray-100 dark:border-slate-700 py-1 z-[2147483647] overflow-hidden">
                        {configData.lead_capture_enabled && (
                          <button onClick={handleHandoff} disabled={handoffSent}
                            className="w-full text-left px-4 py-2 text-sm font-medium font-google text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/10 transition-colors border-b border-gray-100 dark:border-slate-700 flex items-center justify-between disabled:opacity-50">
                            {handoffSent ? 'Team notified ✓' : 'Talk to a human'}
                            <span className="material-symbols-outlined text-[18px]">support_agent</span>
                          </button>
                        )}
                        <button onClick={() => {
                          setMessages([{ role: 'bot', content: configData.initial_message }]);
                          userMessageCountRef.current = 0;
                          leadCapturedRef.current = false;
                          leadFormShownRef.current = false;
                          animatedMsgIndices.current.clear();
                          setHandoffSent(false);
                          setShowMenu(false);
                          setClearCount(c => c + 1);
                        }} className="w-full text-left px-4 py-2 text-sm font-medium font-google text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors border-b border-gray-100 dark:border-slate-700 flex items-center justify-between">
                          Clear chat <span className="material-symbols-outlined">refresh</span>
                        </button>
                        <a href="https://www.Sapybase.com" target="_blank" rel="noopener noreferrer"
                          className="w-full text-left px-4 py-2 text-sm font-medium font-google hover:bg-slate-50 dark:hover:bg-white/5 transition-colors flex items-center justify-between group"
                          onClick={() => setShowMenu(false)} style={{ color: THEME_COLOR }}>
                          Add to your site
                          <span className="material-symbols-outlined text-sm font-medium font-google opacity-0 group-hover:opacity-100 transition-opacity">open_in_new</span>
                        </a>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>

            {/* Messages area */}
            <div className="flex-1 relative flex flex-col min-h-0 bg-gray-50/50 dark:bg-slate-950/50 text-slate-900 dark:text-slate-100">
              <div className={`absolute inset-0 pointer-events-none z-20 transition-opacity duration-200 ${isLoading ? 'opacity-100' : 'opacity-0'}`}>
                <div className="absolute inset-0 animate-pulse shadow-[inset_0px_0px_25px_rgba(59,130,246,0.50)] ring-1 ring-inset ring-blue-500/10 dark:ring-blue-400/20" />
              </div>
              <div ref={scrollContainerRef} onScroll={handleScrollContainer}
                className="flex-1 p-4 overflow-y-auto overscroll-contain touch-pan-y flex flex-col gap-5 pt-6 pb-2 relative custom-scrollbar">
                <div className="flex flex-col gap-5">
                  <AnimatePresence initial={false}>
                    {messages.map((msg, idx) => {
                      const isNew = !animatedMsgIndices.current.has(idx);
                      if (isNew) animatedMsgIndices.current.add(idx);
                      return (
                        <motion.div key={`${clearCount}-${idx}`} layout={msg.isStreaming ? false : 'position'}
                          initial={isNew ? { opacity: 0, y: 10, scale: 0.95 } : false}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                          className={`flex min-w-0 ${msg.role === 'lead_capture' || msg.role === 'handoff_form' || msg.role === 'handoff_confirmed' ? 'w-full' : `max-w-[85%] ${msg.role === 'user' ? 'self-end text-left' : 'self-start text-left'}`}`}>
                          {msg.role === 'handoff_form' ? (
                            <HandoffContactForm themeColor={THEME_COLOR} onSubmit={submitHandoff}
                              onDismiss={() => setMessages(prev => prev.filter(m => m.id !== 'handoff-form'))} />
                          ) : msg.role === 'handoff_confirmed' ? (
                            <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700/60 rounded-2xl p-4 shadow-sm w-full self-start text-left mt-2 space-y-3">
                              <p className="text-sm font-google font-bold text-emerald-600 dark:text-emerald-400 text-center">✅ Team notified!</p>
                              <p className="text-xs font-google text-slate-500 dark:text-slate-400 text-center">
                                {msg.visitorEmail
                                  ? <><b className="text-slate-700 dark:text-slate-300">Our team will reply to {msg.visitorEmail} shortly.</b></>
                                  : 'Our team has been notified and will follow up shortly.'}
                              </p>
                              {msg.redirectUrl && (
                                <a href={msg.redirectUrl} target="_blank" rel="noopener noreferrer"
                                  className="flex items-center justify-center gap-2 w-full py-2 rounded-xl text-sm font-google font-bold text-white transition-opacity hover:opacity-90"
                                  style={{ backgroundColor: THEME_COLOR }}>
                                  Connect instantly <span className="material-symbols-outlined text-[16px]">open_in_new</span>
                                </a>
                              )}
                            </div>
                          ) : msg.role === 'lead_capture' ? (
                            <LeadCaptureForm themeColor={THEME_COLOR} activeApiUrl={activeApiUrl} apiKey={activeApiKey ?? ''}
                              contextString={messages.slice(Math.max(0, idx - 4), idx).filter(m => m.role === 'user').map(m => m.content).join(' || ')}
                              onSubmit={(name) => {
                                leadCapturedRef.current = true;
                                setMessages(prev => prev.map(m =>
                                  m.id === 'lead-form' ? { role: 'bot', content: `Thanks${name ? ' ' + name : ''}! We've received your details and our team will be in touch shortly. 🎉` } : m
                                ));
                              }}
                              onDismiss={() => { leadCapturedRef.current = true; setMessages(prev => prev.filter(m => m.id !== 'lead-form')); }} />
                          ) : (
                            <div className={`flex flex-col max-w-full min-w-0 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                              {msg.role === 'bot'
                                ? <span className="text-sm uppercase tracking-widest font-bold text-slate-400 font-sans mb-1.5 ml-1 leading-none">{BOT_NAME}</span>
                                : <span className="text-sm uppercase tracking-widest font-bold text-slate-400 font-sans mb-1.5 mr-1 leading-none">YOU</span>}
                              <div
                                className={`px-4 py-2 min-h-[38px] w-fit max-w-full wrap-break-word overflow-wrap-anywhere ${msg.role === 'user' ? 'text-white rounded-2xl rounded-tr-none' : 'bg-slate-100 dark:bg-slate-800 text-gray-800 dark:text-slate-200 border border-gray-200/60 dark:border-slate-700/60 rounded-2xl rounded-tl-none overflow-hidden prose prose-compact dark:prose-invert max-w-none prose-p:leading-normal prose-pre:bg-gray-50 dark:prose-pre:bg-slate-900 prose-pre:text-gray-800 dark:prose-pre:text-slate-200 prose-pre:text-sm prose-code:text-sm prose-pre:max-w-full prose-pre:overflow-x-auto prose-pre:whitespace-pre-wrap prose-pre:break-words prose-table:block prose-table:overflow-x-auto prose-headings:text-gray-900 dark:prose-headings:text-slate-100 prose-strong:text-gray-900 dark:prose-strong:text-slate-100 prose-ul:my-1 prose-li:my-0 prose-p:font-regular prose-img:max-w-full prose-img:rounded-lg'}`}
                                style={msg.role === 'user' ? { backgroundColor: THEME_COLOR, overflowWrap: 'anywhere' } : {}}>
                                {msg.role === 'user' ? (
                                  <div className="min-w-0 max-w-full whitespace-pre-wrap wrap-break-word text-base font-google leading-relaxed" style={{ overflowWrap: 'anywhere' }}>{msg.content}</div>
                                ) : (
                                  <div className="min-w-0 max-w-full text-base font-google leading-relaxed">
                                    <TypewriterContent content={msg.content ?? ''} isStreaming={msg.isStreaming} isTyped={msg.isTyped}
                                      onComplete={() => handleTypingComplete(idx)} themeColor={THEME_COLOR}
                                      streamCallbackRef={msg.isStreaming ? streamingCallbackRef : undefined}
                                      onStreamTick={() => scrollToBottom(false)} />
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
                {messages.length === 1 && !input.trim() && (configData.quick_questions?.length ?? 0) > 0 && (
                  <div className="flex flex-col items-end gap-2 px-3 pb-2 pt-1">
                    {configData.quick_questions.map((q, qidx) => {
                      const label = typeof q === 'string' ? q : (q.label || q.prompt || '');
                      if (!label) return null;
                      return (
                        <button key={qidx} onClick={() => sendMessage(label)}
                          className="px-4 py-2.5 min-h-[44px] border rounded-md text-sm font-regular font-google transition-colors max-w-full text-left break-words bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-500">
                          {label}
                        </button>
                      );
                    })}
                  </div>
                )}
                <div ref={messagesEndRef} className="h-2 shrink-0" aria-hidden="true" />
              </div>
            </div>

            {/* Input area */}
            <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl border-t border-gray-200/50 dark:border-slate-800/50 shrink-0 z-10 flex flex-col">
              {!configData.white_label_enabled && (
                <div className="shrink-0 pt-2 flex justify-center items-center">
                  <a href="https://www.Sapybase.com" target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-[9px] font-sans font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors group">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={BrandLogo} alt="Sapybase" className="w-5 h-5 opacity-50 group-hover:opacity-100 transition-opacity" />
                    Powered by Sapybase
                  </a>
                </div>
              )}
              <div className="px-2 w-full shadow-xs" style={{ paddingBottom: 'env(safe-area-inset-bottom, 8px)' }}>
                <form onSubmit={handleSend} className="relative flex items-center gap-2 pb-1">
                  <textarea ref={inputRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKeyDown}
                    placeholder="Ask anything..."
                    className="flex-1 max-h-32 min-h-[40px] bg-transparent resize-none px-2.5 py-[9px] focus:outline-none leading-relaxed text-slate-900 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-500 disabled:opacity-50 appearance-none rounded-none text-base sm:text-sm font-medium font-google"
                    rows={1} disabled={isLoading} aria-label="Chat input" />
                  <button type="submit" disabled={isLoading || !input.trim()} aria-label="Send message"
                    className="p-2 shrink-0 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-w-[44px] min-h-[44px] flex items-center justify-center translate-y-px"
                    style={{ color: THEME_COLOR }}>
                    <Send size={15} />
                  </button>
                </form>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* FAB button */}
      {!isEmbed && (
        <div className={`fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-[2147483646] pointer-events-auto ${isOpen ? 'hidden sm:block' : 'block'}`}>
          <div className="relative flex items-center justify-end">
            <AnimatePresence>
              {!isOpen && (
                <motion.div initial={{ opacity: 0, scale: 0.9, x: 10 }} animate={{ opacity: 1, scale: 1, x: 0 }} exit={{ opacity: 0, scale: 0.9, x: 10 }}
                  className="absolute right-[calc(100%+12px)] hidden sm:flex items-center pointer-events-none">
                  <div className="bg-white dark:bg-slate-900 backdrop-blur-md px-4 py-2.5 rounded-2xl shadow-2xl border border-indigo-100/50 dark:border-slate-800 flex items-center gap-1.5 min-w-[150px] justify-center relative">
                    <span className="text-[10px] uppercase tracking-widest font-bold text-slate-700 dark:text-slate-200 font-sans whitespace-nowrap">{currentPhrase}</span>
                    <motion.span animate={{ opacity: [1, 0, 1] }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                      className="w-0.5 h-4 rounded-full" style={{ backgroundColor: THEME_COLOR }} />
                    <div className="absolute -right-[6px] top-[calc(50%-6px)] w-3 h-3 bg-white dark:bg-slate-900 border-r border-t border-indigo-100/50 dark:border-slate-800 rotate-45 rounded-sm" />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <motion.button whileTap={{ scale: 0.95 }} transition={{ type: 'spring', stiffness: 400, damping: 17 }}
              onClick={() => setIsOpen(prev => !prev)}
              aria-label={isOpen ? 'Collapse chat' : 'Open AI chat assistant'} aria-expanded={isOpen}
              style={{ touchAction: 'manipulation', background: 'transparent' }}
              className="relative flex flex-col items-center justify-center focus:outline-none sm:w-20 sm:h-20 w-15 h-15 shadow-none transition-all p-1">
              <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" className="absolute inset-0 w-full h-full z-0" overflow="visible">
                <defs>
                  <clipPath id="fab-clip"><path d={FAB_PATH} /></clipPath>
                  <filter id="neumorphic-3d-inset" x="-20%" y="-20%" width="140%" height="140%">
                    <feComponentTransfer in="SourceAlpha"><feFuncA type="table" tableValues="1 0" /></feComponentTransfer>
                    <feGaussianBlur stdDeviation="3" /><feOffset dx="4" dy="4" result="offsetBlurDark" />
                    <feComposite operator="in" in2="SourceAlpha" result="innerShadowDark" />
                    <feFlood floodColor="rgba(0,0,0,0.14)" />
                    <feComposite operator="in" in2="innerShadowDark" result="finalDark" />
                    <feComponentTransfer in="SourceAlpha"><feFuncA type="table" tableValues="1 0" /></feComponentTransfer>
                    <feGaussianBlur stdDeviation="3" /><feOffset dx="-3" dy="-3" result="offsetBlurLight" />
                    <feComposite operator="in" in2="SourceAlpha" result="innerShadowLight" />
                    <feFlood floodColor="rgba(255,255,255,0.8)" />
                    <feComposite operator="in" in2="innerShadowLight" result="finalLight" />
                    <feMerge><feMergeNode in="SourceGraphic" /><feMergeNode in="finalDark" /><feMergeNode in="finalLight" /></feMerge>
                  </filter>
                  <linearGradient id="fab-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#FFFFFF" /><stop offset="100%" stopColor="#E2E8F0" />
                  </linearGradient>
                  <linearGradient id="fab-gradient-dark" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#1E293B" /><stop offset="100%" stopColor="#0F172A" />
                  </linearGradient>
                  {fabGradient && (
                    <linearGradient id="Sapybase-avatar-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor={fabGradient[0]} /><stop offset="100%" stopColor={fabGradient[1]} />
                    </linearGradient>
                  )}
                </defs>
                <path d={FAB_PATH} fill={fabGradient ? 'url(#Sapybase-avatar-grad)' : 'url(#fab-gradient)'}
                  className={!fabGradient ? 'dark:fill-[url(#fab-gradient-dark)] transition-all duration-500' : 'transition-all duration-500'} />
                {LOGO_URL && (
                  <g clipPath="url(#fab-clip)">
                    <image href={LOGO_URL}
                      x={configData.custom_logo_url ? (fabShape.x || 0) : (15 + (fabShape.x || 0))}
                      y={configData.custom_logo_url ? (fabShape.y || 0) : (15 + (fabShape.y || 0))}
                      width={configData.custom_logo_url ? 100 : 70} height={configData.custom_logo_url ? 100 : 70}
                      preserveAspectRatio="xMidYMid meet" />
                  </g>
                )}
                {!LOGO_URL && (
                  <text x={50 + (fabShape.x || 0)} y={52 + (fabShape.y || 0)} textAnchor="middle" dominantBaseline="middle"
                    fill={fabGradient ? '#ffffff' : THEME_COLOR} className="font-bold select-none pointer-events-none"
                    style={{ fontSize: '26px', fontFamily: 'var(--font-display, sans-serif)' }}>
                    {(BOT_NAME || 'S').charAt(0).toUpperCase()}
                  </text>
                )}
                <path d={FAB_PATH} fill="transparent" filter="url(#neumorphic-3d-inset)" className="pointer-events-none" />
                <path d={FAB_PATH} fill="none" stroke="white" strokeWidth="0.8" className="aura-path opacity-30 dark:stroke-slate-500/30" />
                <path d={FAB_PATH} fill="none" stroke={THEME_COLOR} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" className="opacity-20" />
              </svg>
            </motion.button>
          </div>
        </div>
      )}
    </div>
  );
}
