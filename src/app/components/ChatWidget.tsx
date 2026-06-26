'use client';

import { useState, useRef, useEffect, useCallback, useId, useMemo, memo } from 'react';
import Image from 'next/image';
import ReactMarkdown from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';
import { fetchEventSource } from '@microsoft/fetch-event-source';
import { motion, AnimatePresence } from 'framer-motion';
import { X, MoreHorizontal } from 'lucide-react';
import ThinkingLogo from './ThinkingLogo';
import { leadCaptureSchema, handoffSchema, firstIssue } from '@/src/lib/validation/schemas';
import { FAB_SHAPES, SHAPE_CLASS_MAP, AVATAR_GRADIENTS } from './avatar/AvatarShared';

const IS_DEV = process.env.NODE_ENV === 'development';
const ASSET_BASE = IS_DEV ? '' : 'https://www.sapybase.com';
const BrandLogo = `${ASSET_BASE}/vaayu_logo.svg`;

// Send a message to the host page only when we have a validated origin.
// `__SapybaseParentOrigin` is set by `EmbedBootstrapper` after it parses &
// validates `parentOrigin` from the URL hash via `new URL().origin`.
// If we don't have a trusted origin, we skip the post entirely — never use '*'.
function postToParent(message: unknown) {
  if (typeof window === 'undefined' || window.parent === window) return;
  const origin = (window as unknown as { __SapybaseParentOrigin?: string }).__SapybaseParentOrigin;
  if (!origin) return;
  try {
    window.parent.postMessage(message, origin);
  } catch {
    // Cross-origin failure or detached frame — drop silently.
  }
}

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

  const uid = useId().replace(/:/g, '');
  const shape = FAB_SHAPES[shapeId] || FAB_SHAPES.circle;
  const FAB_PATH = shape.path;
  const offsetX = shape.x || 0;
  const offsetY = shape.y || 0;

  const gradient = bgStyle && bgStyle !== 'none' ? AVATAR_GRADIENTS[bgStyle] : null;
  const showImage = logoUrl && logoUrl.trim() && !imgFailed;
  const useFallback = !showImage || !isCustom;
  const FallbackLogoUrl = `${ASSET_BASE}/logo2.svg`;

  // L1 fill: white backdrop when fallback logo is shown, otherwise themeColor or gradient or custom white
  const baseFill = useFallback
    ? '#ffffff'
    : (gradient ? `url(#${uid}-grad)` : (transparentBgImage ? 'transparent' : '#ffffff'));

  return (
    <div className={`${sizeClass} shrink-0 ${hasShadow ? 'shadow-sm' : ''} relative flex items-center justify-center`}>
      <svg
        viewBox="0 0 100 100"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full"
        overflow="visible"
      >
        <defs>
          <clipPath id={`${uid}-clip`}>
            <path d={FAB_PATH} />
          </clipPath>
          {gradient && (
            <linearGradient id={`${uid}-grad`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={gradient[0]} />
              <stop offset="100%" stopColor={gradient[1]} />
            </linearGradient>
          )}
        </defs>

        {/* L1: Backdrop/Fill */}
        <path d={FAB_PATH} fill={baseFill} />

        {/* L2: Image clipped precisely to shape */}
        {!useFallback ? (
          <g clipPath={`url(#${uid}-clip)`}>
            <image
              href={logoUrl}
              xlinkHref={logoUrl}
              x={offsetX}
              y={offsetY}
              width={100}
              height={100}
              preserveAspectRatio="xMidYMid slice"
              onError={() => setImgFailed(true)}
            />
          </g>
        ) : (
          <g clipPath={`url(#${uid}-clip)`}>
            <image
              href={FallbackLogoUrl}
              xlinkHref={FallbackLogoUrl}
              x={20 + offsetX}
              y={20 + offsetY}
              width={60}
              height={60}
              preserveAspectRatio="xMidYMid meet"
            />
          </g>
        )}

      </svg>
    </div>
  );
}

// ── FabButton (FAB with image-error fallback for Safari) ─────────────────────

type FabButtonProps = {
  fabPath: string;
  fabGradient: [string, string] | null;
  logoUrl: string;
  botName: string;
  themeColor: string;
  isCustomLogo: boolean;
  fabShapeX: number;
  fabShapeY: number;
  isOpen: boolean;
  onClick: () => void;
};

function FabButton({ fabPath, fabGradient, logoUrl, botName, themeColor, isCustomLogo, fabShapeX, fabShapeY, isOpen, onClick }: FabButtonProps) {
  const [imgFailed, setImgFailed] = useState(false);
  const prevUrlRef = useRef(logoUrl);

  useEffect(() => {
    if (logoUrl !== prevUrlRef.current) {
      setImgFailed(false);
      prevUrlRef.current = logoUrl;
    }
  }, [logoUrl]);

  const showImage = logoUrl && !imgFailed;
  const useFallback = !showImage || !isCustomLogo;
  const FallbackLogoUrl = `${ASSET_BASE}/logo2.svg`;

  return (
    <motion.button whileTap={{ scale: 0.95 }} transition={{ type: 'spring', stiffness: 400, damping: 17 }}
      onClick={onClick}
      aria-label={isOpen ? 'Collapse chat' : 'Open AI chat assistant'} aria-expanded={isOpen}
      style={{ touchAction: 'manipulation', background: 'transparent', WebkitTapHighlightColor: 'transparent', WebkitTouchCallout: 'none', userSelect: 'none', WebkitUserSelect: 'none', outlineColor: themeColor, position: 'relative', zIndex: 1 }}
      className="relative flex flex-col items-center justify-center focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 sm:w-14 sm:h-14 w-12 h-12 shadow-none transition-all p-1">
      <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" className="absolute inset-0 w-full h-full z-0" overflow="visible">
        <defs>
          <clipPath id="fab-clip"><path d={fabPath} /></clipPath>
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
        <path d={fabPath} fill={useFallback ? '#010521' : (fabGradient ? 'url(#Sapybase-avatar-grad)' : 'url(#fab-gradient)')}
          className={!useFallback && !fabGradient ? 'dark:fill-[url(#fab-gradient-dark)] transition-all duration-500' : 'transition-all duration-500'} />
        {!useFallback ? (
          <g clipPath="url(#fab-clip)">
            <image
              href={logoUrl}
              xlinkHref={logoUrl}
              x={fabShapeX || 0}
              y={fabShapeY || 0}
              width={100}
              height={100}
              preserveAspectRatio="xMidYMid meet"
              onError={() => setImgFailed(true)}
            />
          </g>
        ) : (
          <g clipPath="url(#fab-clip)">
            <image
              href={FallbackLogoUrl}
              xlinkHref={FallbackLogoUrl}
              x={20 + (fabShapeX || 0)}
              y={20 + (fabShapeY || 0)}
              width={60}
              height={60}
              preserveAspectRatio="xMidYMid meet"
            />
          </g>
        )}
        <path d={fabPath} fill="transparent" filter="url(#neumorphic-3d-inset)" className="pointer-events-none" />
        <path d={fabPath} fill="none" stroke={themeColor} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" className="opacity-20" />
      </svg>
    </motion.button>
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
  const FallbackLogoUrl = `${ASSET_BASE}/logo2.svg`;
  const useFallback = !logoUrl || !isCustomUrl;

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
      <path d={FAB_PATH} fill={useFallback ? '#004BC4' : (gradient ? `url(#${idPrefix}-Sapybase-avatar-grad)` : `url(#${idPrefix}-fab-gradient)`)}
        className={!useFallback && !gradient ? `dark:fill-[url(#${idPrefix}-fab-gradient-dark)] transition-all duration-500` : 'transition-all duration-500'} />
      {!useFallback ? (
        <g clipPath={`url(#${idPrefix}-fab-clip)`}>
          <image href={logoUrl} xlinkHref={logoUrl} x={fabShape.x || 0} y={fabShape.y || 0}
            width={100} height={100} preserveAspectRatio="xMidYMid slice" />
        </g>
      ) : (
        <g clipPath={`url(#${idPrefix}-fab-clip)`}>
          <image href={FallbackLogoUrl} xlinkHref={FallbackLogoUrl} x={20 + (fabShape.x || 0)} y={20 + (fabShape.y || 0)}
            width={60} height={60} preserveAspectRatio="xMidYMid meet" />
        </g>
      )}
      <path d={FAB_PATH} fill="transparent" filter={`url(#${idPrefix}-neumorphic-3d-inset)`} className="pointer-events-none" />
    </svg>
  );
};

// ── LeadCaptureForm ───────────────────────────────────────────────────────────

function LeadCaptureForm({ onSubmit, onDismiss, themeColor, activeApiUrl, apiKey, contextString, error: externalError }: {
  onSubmit: (name: string, bookingUrl?: string) => void; onDismiss: () => void; themeColor: string;
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
      const w = (typeof window !== 'undefined' ? (window as any) : {});
      const parentOrigin = w.__SapybaseParentOrigin || '';
      // Attribution (best-effort): the loader can expose the merchant page URL via
      // __SapybaseParentUrl; otherwise document.referrer is the next-best signal.
      // UTM is parsed here as a backup — the backend also backfills from page_url.
      const pageUrl = w.__SapybaseParentUrl || (typeof document !== 'undefined' ? document.referrer : '') || '';
      const referrer = (typeof document !== 'undefined' ? document.referrer : '') || '';
      let utmSource: string | undefined, utmMedium: string | undefined, utmCampaign: string | undefined;
      try {
        const q = new URL(pageUrl).searchParams;
        utmSource = q.get('utm_source') || undefined;
        utmMedium = q.get('utm_medium') || undefined;
        utmCampaign = q.get('utm_campaign') || undefined;
      } catch { /* pageUrl not a parseable URL — skip UTM */ }
      const res = await fetch(`${activeApiUrl}/api/leads/capture`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          ...(parentOrigin ? { 'x-Sapybase-parent-origin': parentOrigin } : {}),
        },
        body: JSON.stringify({
          email: parsed.data.email,
          name: parsed.data.name ?? '',
          context: contextString,
          page_url: pageUrl || undefined,
          referrer: referrer || undefined,
          utm_source: utmSource,
          utm_medium: utmMedium,
          utm_campaign: utmCampaign,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to submit.');
      // Speed-to-lead: the backend returns booking_url only for qualified leads
      // when the owner has set a scheduling link.
      onSubmit(name, typeof data.booking_url === 'string' ? data.booking_url : undefined);
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
          className="w-full bg-slate-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl px-3 py-2 text-[16px] font-regular font-google text-gray-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-[var(--sapy-theme)] focus:border-[var(--sapy-theme)]" />
        <div className="flex flex-col gap-1">
          <input type="email" placeholder="Email address (required)" value={email} onChange={e => setEmail(e.target.value)} required
            className="w-full bg-slate-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl px-3 py-2 text-[16px] font-regular font-google text-gray-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-[var(--sapy-theme)] focus:border-[var(--sapy-theme)]" />
          {localError && <span className="text-[11px] text-red-500 font-bold px-1">{localError}</span>}
        </div>
        <button type="submit" disabled={isSubmitting}
          className="w-full mt-1 rounded-full py-2 text-sm font-regular font-google text-white transition-opacity hover:opacity-90 disabled:opacity-50 flex items-center justify-center min-h-[44px]"
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
          className="w-full bg-slate-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl px-3 py-2 text-[16px] font-regular font-google text-gray-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-[var(--sapy-theme)] focus:border-[var(--sapy-theme)]" />
        <div className="flex flex-col gap-1">
          <input type="email" placeholder="Email address (required)" value={email} onChange={e => setEmail(e.target.value)} required
            className="w-full bg-slate-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl px-3 py-2 text-[16px] font-regular font-google text-gray-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-[var(--sapy-theme)] focus:border-[var(--sapy-theme)]" />
          {error && <span className="text-[11px] text-red-500 font-bold px-1">{error}</span>}
        </div>
        <button type="submit" disabled={isSubmitting}
          className="w-full mt-1 rounded-full py-2 text-sm font-regular font-google text-white transition-opacity hover:opacity-90 disabled:opacity-50 flex items-center justify-center min-h-[44px]"
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
  role: 'user' | 'bot' | 'lead_capture' | 'handoff_form' | 'handoff_confirmed' | 'lead_confirmed';
  content?: string;
  isStreaming?: boolean;
  id?: string;
  visitorEmail?: string;
  redirectUrl?: string;
  bookingUrl?: string;
  sds?: { url: string; product?: string; label?: string };
  quote?: {
    status: 'quoted' | 'price_on_request';
    product?: string; grade?: string; pack_size?: string; quantity?: number;
    unit_price?: number | null; subtotal?: number | null;
    gst_rate?: number | null; currency?: string; gst_note?: string | null;
  };
  sample?: {
    product?: string; grade?: string; packaging?: string; quantity?: number;
  };
  ts?: number;
};

// Phase 3 — pack-driven hub. A vertical pack ships these cards via /api/config;
// a generic bot returns none, so no hub renders. `action` decides the tap:
// "tool" opens a slot mini-form then sends `prompt_template` ({value} filled in);
// "chat" just drops the visitor into the chat input.
type HubCard = {
  id: string;
  label: string;
  icon: string;
  action: 'tool' | 'chat' | 'form';   // "form" opens a structured intake form
  subtitle?: string;
  input_label?: string;
  prompt_template?: string;
  input_source?: string;            // "products" => searchable catalog picker
  form_id?: string;                 // which form to open (action="form")
};

// One field in a pack-driven structured form (Phase 4b). type "product" renders a
// catalog picker; "grade" a dropdown derived from the chosen product's grades.
type FormField = {
  name: string;
  label: string;
  type: string;                     // text|email|tel|number|textarea|product|grade
  required?: boolean;
  placeholder?: string;
};

// Commercial catalog row shipped to the widget for the hub's product picker.
// Never includes the SDS url — that stays behind the get_sds agent tool. `grades`
// feeds the sample form's grade dropdown once a product is chosen.
type ProductOption = { name: string; cas_number?: string; grade?: string; packaging?: string; grades?: string[] };

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
  hub_cards?: HubCard[];
  products?: ProductOption[];
  sample_form?: FormField[];
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
  // Links in bot replies (e.g. a chemical agent's SDS document link) open in a
  // NEW tab so the visitor never loses their chat, with rel="noopener" to close
  // the tab-nabbing gap. Applies to every link the bot emits, not just SDS.
  a: ({ children, ...props }: React.ComponentPropsWithoutRef<'a'>) => (
    <a {...props} target="_blank" rel="noopener noreferrer"
       className="underline underline-offset-2">{children}</a>
  ),
};

// Phase 3 hub cards carry a semantic (Tabler-style) icon name from the pack; the
// widget renders with Material Symbols, so map the few we use. Unknown → "bolt".
const HUB_ICON: Record<string, string> = {
  'file-certificate': 'description',
  flask: 'science',
  'message-circle': 'forum',
  receipt: 'receipt_long',
  package: 'package_2',
};

// Format a deterministic quote figure (₹ for INR). Null/undefined -> em dash.
function fmtINR(n?: number | null, currency?: string): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  const sym = (currency || 'INR') === 'INR' ? '₹' : `${currency} `;
  return `${sym}${n.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

// Split markdown into top-level blocks (paragraphs / lists / headings / code),
// breaking on blank lines but never inside a fenced code block. This lets each
// COMPLETED block be memoized so it parses exactly once, instead of re-parsing
// the entire message on every streamed frame (the old O(n²) hot path).
function splitMarkdownBlocks(md: string): string[] {
  if (!md) return [];
  const lines = md.split('\n');
  const blocks: string[] = [];
  let cur: string[] = [];
  let inFence = false;
  for (const line of lines) {
    if (/^\s*```/.test(line)) inFence = !inFence;
    if (!inFence && line.trim() === '') {
      if (cur.length) { blocks.push(cur.join('\n')); cur = []; }
    } else {
      cur.push(line);
    }
  }
  if (cur.length) blocks.push(cur.join('\n'));
  return blocks;
}

// Advance `idx` forward by `n` WHOLE words within `buffer`, returning the new
// boundary index. Never reveals a partial trailing word (waits for its
// terminating whitespace) so the typewriter steps word-by-word, never mid-word.
function advanceWords(buffer: string, idx: number, n: number): number {
  let i = idx;
  for (let w = 0; w < n; w++) {
    while (i < buffer.length && /\s/.test(buffer[i])) i++;     // skip leading whitespace
    const wordStart = i;
    while (i < buffer.length && !/\s/.test(buffer[i])) i++;    // consume the word
    if (i >= buffer.length) return wordStart > idx ? wordStart : idx; // word unterminated → hold it
    while (i < buffer.length && (buffer[i] === ' ' || buffer[i] === '\t')) i++; // include trailing spaces
  }
  return i;
}

// One markdown block, memoized on its source. A finalized block never re-parses;
// only the still-growing `tail` block does. `tail` also closes any half-typed
// markers (incomplete **bold** / fences) so inline formatting stays live as it
// streams. The wrapper carries a one-shot fade-in (plays once per block — React
// preserves the element across re-renders, so growing the tail never replays it).
const MarkdownBlock = memo(function MarkdownBlock({ source, tail }: { source: string; tail?: boolean }) {
  return (
    <div className="sapy-md-block-in">
      <ReactMarkdown rehypePlugins={[rehypeSanitize]} components={MD_COMPONENTS}>
        {tail ? sanitizeStreamMarkdown(source) : source}
      </ReactMarkdown>
    </div>
  );
});

// ── StreamCallbacks ───────────────────────────────────────────────────────────

type StreamCallbacks = {
  push: (token: string) => void;
  flush: () => string;
  getContent: () => string;
};

// ── MessageContent ────────────────────────────────────────────────────────────

type MessageContentProps = {
  content: string;
  isStreaming?: boolean;
  themeColor?: string;
  streamCallbackRef?: React.MutableRefObject<StreamCallbacks | null>;
  onStreamTick?: () => void;
};

function MessageContent({ content, isStreaming, themeColor = '#5730F5', streamCallbackRef, onStreamTick }: MessageContentProps) {
  const [displayedText, setDisplayedText] = useState('');
  const bufferRef = useRef('');
  const displayIdxRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const lastTickRef = useRef(0);
  const onStreamTickRef = useRef(onStreamTick);

  useEffect(() => { onStreamTickRef.current = onStreamTick; }, [onStreamTick]);

  useEffect(() => {
    if (!isStreaming || !streamCallbackRef) return;

    const drain = (timestamp: number) => {
      if (!lastTickRef.current) lastTickRef.current = timestamp;
      const delta = timestamp - lastTickRef.current;
      // Reveal WHOLE words (not chars): far fewer re-renders, and each re-render
      // only re-parses the small tail block (not the whole message). Reveal more
      // words per step when the buffer is far ahead so we never lag the network.
      if (delta >= 38) {
        const buffer = bufferRef.current;
        const idx = displayIdxRef.current;
        if (idx < buffer.length) {
          const ahead = buffer.length - idx;
          const words = ahead > 220 ? 4 : ahead > 90 ? 2 : 1;
          const newIdx = advanceWords(buffer, idx, words);
          if (newIdx > idx) {
            // Only reset the clock when we actually advanced — if we're waiting
            // for a word boundary, re-check on the next frame instead of stalling.
            lastTickRef.current = timestamp;
            displayIdxRef.current = newIdx;
            setDisplayedText(buffer.slice(0, newIdx));
            onStreamTickRef.current?.();
          }
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
  }, [isStreaming, streamCallbackRef]);

  useEffect(() => {
    if (isStreaming) {
      setDisplayedText('');
      bufferRef.current = '';
      displayIdxRef.current = 0;
    }
  }, [isStreaming]);

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // Streaming and final share ONE structure so React preserves the block
  // instances when isStreaming flips off — no remount, no re-parse, no flash on
  // completion. Only the tail block re-parses while typing; completed blocks are
  // memoized. The ThinkingLogo still cross-fades out as the first content lands.
  const sourceText = isStreaming ? displayedText : content;
  const blocks = splitMarkdownBlocks(sourceText);
  const hasContent = blocks.length > 0;

  return (
    <div className="relative min-h-[28px]">
      {isStreaming && (
        <div style={{ opacity: hasContent ? 0 : 1, position: hasContent ? 'absolute' : 'relative', transition: 'opacity 0.2s ease-out', pointerEvents: hasContent ? 'none' : 'auto' }}>
          <ThinkingLogo size={40} className="origin-left" themeColor={themeColor} />
        </div>
      )}
      {hasContent && (
        <div className="leading-relaxed text-[14px] font-normal font-google">
          {blocks.map((b, i) => (
            <MarkdownBlock key={i} source={b} tail={isStreaming && i === blocks.length - 1} />
          ))}
          {isStreaming && <span className="sapy-stream-cursor" style={{ backgroundColor: themeColor }} />}
        </div>
      )}
    </div>
  );
}

// ── Theme-derived CSS variables ──────────────────────────────────────────────

/**
 * Derive theme-driven CSS variables from the tenant's themeColor so accents
 * (header text, focus rings, loading glow) adapt to ANY brand color and stay
 * readable. rgba is computed in JS rather than CSS color-mix() for universal
 * browser support inside embedded customer pages. Malformed hex falls back to
 * the default brand color, so a bad config can never render a broken accent.
 */
function themeVars(hex: string): Record<string, string> {
  const fallback = '5730F5';
  const match = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec((hex || '').trim());
  let c = match ? match[1] : fallback;
  if (c.length === 3) c = c.split('').map(x => x + x).join('');
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255; // perceived brightness
  // User bubble = theme tinted at low opacity over the chat surface, so the text
  // must follow the *blended* bubble lightness (not the raw theme). Luminance is
  // linear in RGB, so blended = A*themeLum + (1-A)*surfaceLum. The surface differs
  // by mode, so we compute a foreground for the light and the dark surface.
  const A_LIGHT = 0.15; // user-bubble tint, light mode
  const A_DARK = 0.20;  // user-bubble tint, dark mode (a touch stronger)
  const fgFor = (alpha: number, surfaceLum: number) => (alpha * lum + (1 - alpha) * surfaceLum > 0.6 ? '#0f172a' : '#ffffff');
  return {
    '--sapy-theme': `#${c}`,                         // focus rings / borders
    '--sapy-theme-fg': lum > 0.6 ? '#0f172a' : '#ffffff', // readable header text
    '--sapy-user-bg': `rgba(${r}, ${g}, ${b}, ${A_LIGHT})`,      // user bubble — softened theme (light)
    '--sapy-user-bg-dark': `rgba(${r}, ${g}, ${b}, ${A_DARK})`, // user bubble — softened theme (dark)
    '--sapy-user-fg': fgFor(A_LIGHT, 0.96),      // bubble text over the light chat surface
    '--sapy-user-fg-dark': fgFor(A_DARK, 0.06),  // bubble text over the dark chat surface
  };
}

// ── Structured sample form (Phase 4b) ───────────────────────────────────────
// A pack-driven multi-field intake form. Fields come from config (`sample_form`),
// so it's customizable per client without touching this component. `product` is a
// searchable catalog picker; `grade` a dropdown derived from the chosen product.
// Submitting posts to a deterministic endpoint (no LLM) — see submitSampleForm.

function SampleForm({ schema, products, prefill, themeColor, submitting, error, onSubmit, onCancel }: {
  schema: FormField[];
  products: ProductOption[];
  prefill: Record<string, string>;
  themeColor: string;
  submitting: boolean;
  error: string | null;
  onSubmit: (values: Record<string, string>) => void;
  onCancel: () => void;
}) {
  const [values, setValues] = useState<Record<string, string>>(() => ({ ...prefill }));
  const [productQuery, setProductQuery] = useState(prefill.product || '');
  const [showPicker, setShowPicker] = useState(false);
  const [touched, setTouched] = useState(false);

  const set = (k: string, v: string) => setValues(prev => ({ ...prev, [k]: v }));

  const matches = useMemo(() => {
    const q = productQuery.trim().toLowerCase();
    const seen = new Set<string>();
    const out: ProductOption[] = [];
    for (const p of products) {
      if (q && !(p.name.toLowerCase().includes(q) || (p.cas_number || '').toLowerCase().includes(q))) continue;
      const k = `${p.name.toLowerCase()}|${p.cas_number || ''}`;
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(p);
      if (out.length >= 30) break;
    }
    return out;
  }, [products, productQuery]);

  const selectedProduct = useMemo(
    () => products.find(p => p.name.toLowerCase() === (values.product || '').toLowerCase()),
    [products, values.product]);
  const grades = selectedProduct?.grades || [];

  const missing = schema.filter(f => f.required && !(values[f.name] || '').trim()).map(f => f.name);

  const pickProduct = (p: ProductOption) => {
    setValues(prev => ({ ...prev, product: p.name, grade: '' }));
    setProductQuery(p.name);
    setShowPicker(false);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (missing.length) return;
    onSubmit(values);
  };

  const baseInput = "w-full rounded-xl border bg-transparent px-3 py-2 text-[14px] font-google text-slate-900 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500";
  const fieldBorder = (name: string, required?: boolean) =>
    touched && required && !(values[name] || '').trim()
      ? 'border-red-400 dark:border-red-500' : 'border-slate-300 dark:border-slate-600';

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-gray-50/50 dark:bg-slate-950/50">
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-gray-100 dark:border-slate-800 shrink-0">
        <button type="button" onClick={onCancel} aria-label="Back"
          className="flex items-center gap-1 -ml-1 px-1.5 py-1 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800/60 transition-colors">
          <span className="material-symbols-outlined text-[18px] leading-none">arrow_back</span>
        </button>
        <span className="text-[14px] font-google font-semibold text-slate-800 dark:text-slate-100">Request a sample</span>
      </div>

      <form onSubmit={submit} className="flex-1 overflow-y-auto px-3.5 py-3 flex flex-col gap-3 scrollbar-thin">
        {schema.map((f) => (
          <label key={f.name} className="flex flex-col gap-1">
            <span className="text-[12px] font-google font-medium text-slate-600 dark:text-slate-300">
              {f.label}{f.required && <span className="text-red-500"> *</span>}
            </span>

            {f.type === 'product' ? (
              <div className="relative">
                <input
                  value={productQuery}
                  onChange={e => { setProductQuery(e.target.value); set('product', e.target.value); setShowPicker(true); }}
                  onFocus={() => setShowPicker(true)}
                  placeholder={f.placeholder || 'Search products…'}
                  className={`${baseInput} ${fieldBorder(f.name, f.required)}`} />
                {showPicker && matches.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 max-h-44 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg scrollbar-thin z-20">
                    {matches.map((p, i) => (
                      <button key={`${p.name}-${p.cas_number || ''}-${i}`} type="button" onClick={() => pickProduct(p)}
                        className="w-full text-left px-3 py-2 flex items-center justify-between gap-2 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                        <span className="text-[14px] font-google text-slate-800 dark:text-slate-200 truncate">{p.name}</span>
                        <span className="text-[11px] text-slate-400 dark:text-slate-500 shrink-0 font-google">{p.cas_number || ''}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : f.type === 'grade' ? (
              grades.length > 0 ? (
                <select value={values.grade || ''} onChange={e => set('grade', e.target.value)}
                  className={`${baseInput} ${fieldBorder(f.name, f.required)}`}>
                  <option value="">{f.placeholder || 'Select a grade'}</option>
                  {grades.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              ) : (
                <input value={values.grade || ''} onChange={e => set('grade', e.target.value)}
                  placeholder={f.placeholder || 'Grade'} className={`${baseInput} ${fieldBorder(f.name, f.required)}`} />
              )
            ) : f.type === 'textarea' ? (
              <textarea value={values[f.name] || ''} onChange={e => set(f.name, e.target.value)} rows={2}
                placeholder={f.placeholder || ''} className={`${baseInput} resize-none ${fieldBorder(f.name, f.required)}`} />
            ) : (
              <input
                type={f.type === 'email' ? 'email' : f.type === 'tel' ? 'tel' : f.type === 'number' ? 'number' : 'text'}
                value={values[f.name] || ''} onChange={e => set(f.name, e.target.value)}
                placeholder={f.placeholder || ''} className={`${baseInput} ${fieldBorder(f.name, f.required)}`} />
            )}
          </label>
        ))}

        {error && <p className="text-[12px] font-google text-red-500">{error}</p>}

        <button type="submit" disabled={submitting}
          className="mt-1 w-full rounded-full py-2.5 text-[14px] font-google font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
          style={{ backgroundColor: themeColor }}>
          {submitting ? 'Sending…' : 'Submit request'}
        </button>
      </form>
    </div>
  );
}

// ── ChatWidget ────────────────────────────────────────────────────────────────

type ChatWidgetProps = { apiKey?: string; isEmbed?: boolean };

export default function ChatWidget({ apiKey, isEmbed = false }: ChatWidgetProps) {
  // Resolve API key and base URL (supports both prop and window.SapybaseConfig)
  const activeApiKey = apiKey ?? (typeof window !== 'undefined' ? window.SapybaseConfig?.apiKey : undefined);
  const activeApiUrl = typeof window !== 'undefined'
    ? (window.SapybaseConfig?.apiUrl ?? '')
    : '';

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

  // Widget session token (anti quota-drain). Minted from /api/widget/session and
  // sent as x-Sapybase-session on every /api/chat call. Stored in a ref; lazily
  // re-minted when missing or within 60s of expiry.
  const sessionTokenRef = useRef<{ token: string; exp: number } | null>(null);

  const getSessionToken = useCallback(async (): Promise<string | null> => {
    if (!activeApiKey) return null;
    const cached = sessionTokenRef.current;
    if (cached && cached.exp - Date.now() > 60_000) return cached.token;
    try {
      const parentOrigin = (window as unknown as { __SapybaseParentOrigin?: string }).__SapybaseParentOrigin || '';
      const res = await fetch(`${activeApiUrl}/api/widget/session`, {
        method: 'POST',
        headers: {
          'x-api-key': activeApiKey,
          ...(parentOrigin ? { 'x-Sapybase-parent-origin': parentOrigin } : {}),
        },
      });
      if (!res.ok) {
        console.warn(`[Sapybase] session token mint failed: ${res.status}`);
        return null; // 503 during soft-launch = not configured; chat still works
      }
      const data = await res.json();
      const ttlMs = (Number(data.expires_in) || 1800) * 1000;
      sessionTokenRef.current = { token: data.token, exp: Date.now() + ttlMs };
      return data.token;
    } catch (err) {
      console.warn('[Sapybase] session token mint error:', err);
      return null;
    }
  }, [activeApiKey, activeApiUrl]);

  useEffect(() => {
    if (activeApiKey) void getSessionToken();
  }, [activeApiKey, getSessionToken]);

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
            logo_url: (() => {
              const raw = data.logo_url || DEFAULT_CONFIG.logo_url;
              return raw.startsWith('/') ? `https://www.sapybase.com${raw}` : raw;
            })(),
            initial_message: data.initial_message || DEFAULT_CONFIG.initial_message,
            quick_questions: data.quick_questions || [],
            logo_shape: data.logo_shape || 'circle',
            custom_logo_url: data.custom_logo_url || '',
            avatar_bg_style: data.avatar_bg_style || 'none',
            lead_capture_enabled: data.lead_capture_enabled || false,
            white_label_enabled: data.white_label_enabled === true,
            hub_cards: Array.isArray(data.hub_cards) ? data.hub_cards : [],
            products: Array.isArray(data.products) ? data.products : [],
            sample_form: Array.isArray(data.sample_form) ? data.sample_form : [],
          });
          leadCaptureEnabledRef.current = data.lead_capture_enabled || false;
          setMessages(prev => {
            if (prev.length === 1 && prev[0].role === 'bot') {
              return [{ role: 'bot', content: data.initial_message || DEFAULT_CONFIG.initial_message, ts: Date.now() }];
            }
            return prev;
          });
        } else {
          const errorDetail = await res.text().catch(() => 'Unknown error');
          console.warn(`[Sapybase] Config fetch failed with status ${res.status}:`, errorDetail);
        }
      } catch (err) {
        console.warn('[Sapybase] Could not load bot config:', err);
      } finally {
        if (isEmbed && typeof window !== 'undefined' && window.parent !== window) {
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              postToParent({ type: 'Sapybase:ready' });
            });
          });
        }
      }
    };
    fetchConfig();
  }, [activeApiKey]);

  const BOT_NAME = configData.bot_name || 'Sapybase';
  const THEME_COLOR = configData.theme_color || '#5730F5';
  const LOGO_URL = configData.custom_logo_url || '';
  const LOGO_SHAPE = configData.logo_shape || 'circle';
  const AVATAR_BG_STYLE = configData.avatar_bg_style || 'none';
  // A vertical pack supplies hub cards → the widget gets the Chat/Home hybrid.
  // Generic (vertical=NULL) bots have none → no nav arrow, no Home, plain chat.
  const hasHub = (configData.hub_cards?.length ?? 0) > 0;
  const themeStyleVars = useMemo(() => themeVars(THEME_COLOR), [THEME_COLOR]);

  const leadCapturedRef = useRef(false);
  const leadFormShownRef = useRef(false);
  const userMessageCountRef = useRef(0);
  const [clearCount, setClearCount] = useState(0);

  const MAX_MESSAGES = 100;
  const appendBounded = (prev: Message[], ...next: Message[]): Message[] => {
    const combined = [...prev, ...next];
    if (combined.length <= MAX_MESSAGES) return combined;
    return [combined[0], ...combined.slice(-(MAX_MESSAGES - 1))];
  };

  const [isOpen, setIsOpen] = useState(isEmbed);
  const [showMenu, setShowMenu] = useState(false);
  const [handoffSent, setHandoffSent] = useState(false);
  const [messages, setMessages] = useState<Message[]>([{ role: 'bot', content: DEFAULT_CONFIG.initial_message, ts: Date.now() }]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  // Phase 3 hub: the tool card currently expanded into a slot mini-form (null =
  // showing the card strip), and the mini-form's single input value.
  const [activeHubCard, setActiveHubCard] = useState<HubCard | null>(null);
  const [hubInput, setHubInput] = useState('');
  // Phase 4b — the structured sample form. Opened from the "Request a sample" hub
  // card OR when the agent emits a {form} action in chat (free-text intent). One
  // form, two entry points; submitting it POSTs to a deterministic endpoint.
  const [sampleFormOpen, setSampleFormOpen] = useState(false);
  const [sampleFormPrefill, setSampleFormPrefill] = useState<Record<string, string>>({});
  const [sampleSubmitting, setSampleSubmitting] = useState(false);
  const [sampleError, setSampleError] = useState<string | null>(null);
  // Hybrid hub: which screen is showing. A vertical (pack) bot opens on 'home' (the
  // action-card grid + bottom Home/Chat tabs) per the chemical Figma; the header
  // back-arrow returns there from 'chat'. A generic bot has no hub → always 'chat'.
  const [hubView, setHubView] = useState<'chat' | 'home'>('chat');
  // Land a vertical bot on Home the first time its config (hub cards) arrives.
  const didInitHubView = useRef(false);
  useEffect(() => {
    if (!didInitHubView.current && hasHub) {
      didInitHubView.current = true;
      setHubView('home');
    }
  }, [hasHub]);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setIsMobile(window.innerWidth < 640);
    const handleResize = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    // Embedded mode lives in a fixed-size iframe that already provides the
    // correct height. The visualViewport/--sapy-vh hack is only for the
    // real-mobile fullscreen case; running it inside a cross-origin iframe
    // makes Chrome report the PARENT page's viewport height, inflating the
    // panel past the iframe so the message list never overflows (dead wheel).
    if (!isMobile || !isOpen || isEmbed) return;
    const vv = window.visualViewport;
    if (!vv) return;
    const fullHeight = window.innerHeight;
    const sync = () => {
      document.documentElement.style.setProperty('--sapy-vh', `${vv.height}px`);
      // Remove safe-area bottom padding when keyboard is open to avoid gap
      const keyboardOpen = vv.height < fullHeight * 0.8;
      document.documentElement.style.setProperty('--sapy-safe-bottom', keyboardOpen ? '0px' : 'env(safe-area-inset-bottom, 0px)');
    };
    sync();
    vv.addEventListener('resize', sync);
    vv.addEventListener('scroll', sync);
    return () => {
      vv.removeEventListener('resize', sync);
      vv.removeEventListener('scroll', sync);
      document.documentElement.style.removeProperty('--sapy-vh');
      document.documentElement.style.removeProperty('--sapy-safe-bottom');
    };
  }, [isMobile, isOpen, isEmbed]);

  useEffect(() => {
    if (isEmbed && !isOpen) {
      postToParent({ type: 'Sapybase:close' });
    }
  }, [isOpen, isEmbed]);

  const [isTabletUp, setIsTabletUp] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(min-width: 768px)');
    const update = () => setIsTabletUp(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);


  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const userHasScrolledUpRef = useRef(false);
  const streamingCallbackRef = useRef<StreamCallbacks | null>(null);
  const animatedMsgIndices = useRef(new Set<number>());
  // "New message ↓" pill: shown when a finished reply extends below the fold.
  // We never auto-scroll during/after streaming — the pill lets the user jump
  // down on their own terms, keeping their reading position stable.
  const [showJumpPill, setShowJumpPill] = useState(false);

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
    if (!el) return;
    if (smooth) {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    } else {
      el.scrollTop = el.scrollHeight;
    }
  }, []);

  const forceScrollToBottom = useCallback((smooth = true) => {
    userHasScrolledUpRef.current = false;
    const el = scrollContainerRef.current;
    if (!el) return;
    if (smooth) {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    } else {
      el.scrollTop = el.scrollHeight;
    }
  }, []);

  const handleScrollContainer = useCallback(() => {
    const atBottom = isNearBottom();
    userHasScrolledUpRef.current = !atBottom;
    // Reaching the bottom means they've seen the latest — dismiss the pill.
    if (atBottom) setShowJumpPill(false);
  }, [isNearBottom]);


  useEffect(() => {
    const lastMsg = messages[messages.length - 1];
    if (lastMsg?.role === 'user') { forceScrollToBottom(true); }
    else if (lastMsg?.role === 'bot' && lastMsg.isStreaming && lastMsg.content === '') { forceScrollToBottom(true); }
    else if (isLoading) { forceScrollToBottom(true); }
    else { scrollToBottom(true); }
  }, [messages.length, isLoading, forceScrollToBottom, scrollToBottom]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => { forceScrollToBottom(false); inputRef.current?.focus({ preventScroll: true }); }, 10);
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

  // Phase 3 hub: a "chat" card just focuses the input; a "tool" card expands the
  // slot mini-form. Submitting the form fills {value} into the card's template
  // and sends it — driving the existing agent loop to the card's tool.
  const handleHubCardTap = (card: HubCard) => {
    if (card.action === 'chat') {
      setActiveHubCard(null);
      inputRef.current?.focus();
      return;
    }
    if (card.action === 'form') {
      openSampleForm({});
      return;
    }
    setActiveHubCard(card);
    setHubInput('');
  };

  // Open the structured sample form (from a hub card or an agent {form} action),
  // optionally prefilled with the product/grade the visitor mentioned in chat.
  const openSampleForm = (prefill: Record<string, string>) => {
    setActiveHubCard(null);
    setHubView('chat');
    setSampleError(null);
    setSampleFormPrefill(prefill || {});
    setSampleFormOpen(true);
  };

  // Submit the sample form: POST to the deterministic endpoint (no LLM), then
  // close the form and drop a confirmation card into the chat. Best-effort error
  // surfacing — the endpoint records + notifies; a failure here just asks to retry.
  const submitSampleForm = async (values: Record<string, string>) => {
    if (sampleSubmitting) return;
    setSampleSubmitting(true);
    setSampleError(null);
    try {
      const parentOrigin = (typeof window !== 'undefined' && (window as unknown as { __SapybaseParentOrigin?: string }).__SapybaseParentOrigin) || '';
      const sessionToken = await getSessionToken();
      const idem = (typeof crypto !== 'undefined' && crypto.randomUUID)
        ? crypto.randomUUID() : `${sessionId}-${Date.now()}`;
      const res = await fetch(`${activeApiUrl}/api/widget/sample-request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': activeApiKey!,
          ...(parentOrigin ? { 'x-Sapybase-parent-origin': parentOrigin } : {}),
          ...(sessionToken ? { 'x-Sapybase-session': sessionToken } : {}),
        },
        body: JSON.stringify({ fields: values, session_id: sessionId, idempotency_key: idem }),
      });
      if (!res.ok) {
        if (res.status === 422) { setSampleError('Please fill in all required fields.'); }
        else { setSampleError('Something went wrong. Please try again.'); }
        return;
      }
      const data = await res.json().catch(() => ({}));
      setSampleFormOpen(false);
      setSampleFormPrefill({});
      setMessages(prev => [...prev, {
        role: 'bot',
        content: "Thanks! Your sample request is in — our team will be in touch to arrange it.",
        sample: data.confirmation || { product: values.product, grade: values.grade, quantity: values.quantity },
        ts: Date.now(),
      }]);
    } catch {
      setSampleError('Something went wrong. Please try again.');
    } finally {
      setSampleSubmitting(false);
    }
  };

  // Home-screen card tap: jump to the Chat screen, then run the card (opens its
  // mini-form for tool cards, or focuses the input for the "Ask" card).
  const openCardFromHome = (card: HubCard) => {
    setHubView('chat');
    handleHubCardTap(card);
  };

  const submitHubValue = (value: string) => {
    const card = activeHubCard;
    const v = value.trim();
    if (!card || !v || isLoading) return;
    const message = (card.prompt_template || '{value}').replace('{value}', v);
    setActiveHubCard(null);
    setHubInput('');
    void sendMessage(message);
  };
  const submitHubCard = () => submitHubValue(hubInput);

  // Searchable product picker: filter the pack-supplied catalog by name or CAS as
  // the visitor types. Empty query shows the full list (browse). Capped for perf.
  const hubProductMatches = useMemo(() => {
    if (!activeHubCard || activeHubCard.input_source !== 'products') return [];
    const opts = configData.products || [];
    const q = hubInput.trim().toLowerCase();
    const list = q
      ? opts.filter(p =>
          p.name.toLowerCase().includes(q) ||
          (p.cas_number || '').toLowerCase().includes(q))
      : opts;
    // One row per product — the catalog has a row per grade (same name+CAS), so
    // collapse to distinct products for the picker; the agent collects grade next.
    const seen = new Set<string>();
    const distinct: ProductOption[] = [];
    for (const p of list) {
      const k = `${p.name.toLowerCase()}|${p.cas_number || ''}`;
      if (seen.has(k)) continue;
      seen.add(k);
      distinct.push(p);
      if (distinct.length >= 50) break;
    }
    return distinct;
  }, [activeHubCard, hubInput, configData.products]);

  const handleSend = async (e: React.FormEvent | null, overrideText?: string) => {
    if (e) e.preventDefault();
    if (!overrideText && !input.trim()) return;
    const userMessage = overrideText || input.trim();
    userMessageCountRef.current += 1;
    const now = Date.now();
    setMessages(prev => appendBounded(prev,
      { role: 'user', content: userMessage, ts: now },
      { role: 'bot', content: '', isStreaming: true, ts: now },
    ));
    setInput('');
    setIsLoading(true);
    userHasScrolledUpRef.current = false;
    setShowJumpPill(false);
    if (abortControllerRef.current) abortControllerRef.current.abort();
    const ctrl = new AbortController();
    abortControllerRef.current = ctrl;
    const resolvedApiKey = activeApiKey;
    if (!resolvedApiKey) {
      setMessages(prev => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last?.role === 'bot' && last.isStreaming) {
          updated[updated.length - 1] = { role: 'bot', content: 'Configure your API Key locally to start chatting with Sapy AI!', isStreaming: false };
        }
        return updated;
      });
      setIsLoading(false);
      return;
    }
    const recentHistory = messages
      .filter(m => (m.role === 'user' || m.role === 'bot') && typeof m.content === 'string')
      .slice(-4)
      .map(m => ({ role: m.role, content: m.content! }));
    let firstChunkReceived = false;
    let sseRetryCount = 0;
    // Structured "Open SDS" action emitted by the agent stream (a {sds:{...}}
    // event); captured here and attached to the bot message on [DONE].
    let pendingSds: Message['sds'] | null = null;
    // Structured quote card emitted by the agent stream (a {quote:{...}} event);
    // captured here and attached to the bot message on [DONE], like pendingSds.
    let pendingQuote: Message['quote'] | null = null;
    // "Open the sample form" action (a {form:{...}} event); captured here and acted
    // on at [DONE] so the form opens right after the bot's text reply lands.
    let pendingForm: { form_id: string; prefill: Record<string, string> } | null = null;
    const SSE_MAX_RETRIES = 1;
    try {
      const parentOriginChat = (typeof window !== 'undefined' && (window as unknown as { __SapybaseParentOrigin?: string }).__SapybaseParentOrigin) || '';
      const sessionToken = await getSessionToken();
      await fetchEventSource(`${activeApiUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': resolvedApiKey,
          ...(parentOriginChat ? { 'x-Sapybase-parent-origin': parentOriginChat } : {}),
          ...(sessionToken ? { 'x-Sapybase-session': sessionToken } : {}),
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
                updated[updated.length - 1] = { ...last, content: data.reply, isStreaming: false };
              } else {
                updated.push({ role: 'bot', content: data.reply, ts: Date.now() });
              }
              return updated;
            });
            setIsLoading(false);
            throw new Error('CACHE_HIT');
          }
          if (!response.ok) {
            if (response.status === 401) {
              sessionTokenRef.current = null; // force re-mint on next send
            }
            if (response.status === 402) {
              let detail = null;
              try { detail = await response.json(); } catch { /* noop */ }
              const isMessageLimit = (detail as { detail?: { code?: string } })?.detail?.code === 'MESSAGE_LIMIT_EXCEEDED';
              const errorContent = isMessageLimit
                ? `I've reached my monthly message limit. Please contact the site owner to upgrade their plan at [Sapybase.com](https://www.sapybase.com). I'll be back next billing cycle! 🚀`
                : "I'm temporarily unavailable. Please try again later.";
              setMessages(prev => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last?.role === 'bot' && last.isStreaming) {
                  updated[updated.length - 1] = { role: 'bot', content: errorContent, isStreaming: false };
                } else {
                  updated.push({ role: 'bot', content: errorContent });
                }
                return updated;
              });
              setIsLoading(false);
              throw new Error('HANDLED_ERROR');
            }
            if (response.status === 429) {
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
                  updated[updated.length - 1] = { role: 'bot', content: errorContent, isStreaming: false };
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
            streamingCallbackRef.current = null;
            setMessages(prev => {
              const updated = [...prev];
              const last = updated[updated.length - 1];
              if (last?.role === 'bot') {
                updated[updated.length - 1] = { ...last, content: fullContent, isStreaming: false, ...(pendingSds ? { sds: pendingSds } : {}), ...(pendingQuote ? { quote: pendingQuote } : {}) };
              }
              return updated;
            });
            setIsLoading(false);
            // Free-text sample intent → open the structured form (prefilled), the
            // same form the hub card opens. After the reply so it reads naturally.
            if (pendingForm) openSampleForm(pendingForm.prefill);
            // Never move the viewport on completion — keep the user exactly where
            // they are for reading continuity. If the finished answer extends below
            // the fold, surface the "new message" pill so they can jump down when
            // they choose. Deferred a frame so isNearBottom reads the FINAL height
            // (the message just jumped from typed-out text to full content).
            requestAnimationFrame(() => { if (!isNearBottom()) setShowJumpPill(true); });
            if (leadCaptureEnabledRef.current && !leadCapturedRef.current && !leadFormShownRef.current) {
              const lowerReply = fullContent.toLowerCase();
              const lowerUserMsg = userMessage.toLowerCase();
              const userBuyingIntent = ['quote', 'pricing', 'how much', 'cost', 'buy', 'purchase', 'hire', 'sign up', 'get started', 'book a', 'schedule', 'free trial', 'demo', 'subscribe'];
              const userHumanIntent = ['talk to a human', 'speak to someone', 'speak to a person', 'real person', 'contact you', 'contact us', 'reach out', 'get in touch', 'help me', 'i need help', 'support team', 'sales team'];
              const fallbackPhrases = ['does not appear in my knowledge base', "don't have information on that", 'please reach out to', 'contact our support', "i'm not sure", 'i do not have'];
              const isUserBuying = userBuyingIntent.some(w => lowerUserMsg.includes(w));
              const isUserAskingForHuman = userHumanIntent.some(w => lowerUserMsg.includes(w));
              const isFallback = fallbackPhrases.some(w => lowerReply.includes(w));
              if (isUserBuying || isUserAskingForHuman || isFallback) {
                leadFormShownRef.current = true;
                setTimeout(() => {
                  setMessages(prev => {
                    if (prev.some(m => m.role === 'lead_capture')) return prev;
                    return [...prev, { role: 'lead_capture', id: 'lead-form' }];
                  });
                  setTimeout(() => forceScrollToBottom(true), 100);
                }, 1500);
              }
            }
            return;
          }
          let chunk = '';
          try {
            const parsed = JSON.parse(msg.data);
            // Structured side-channel: the agent emits {sds:{url,...}} so the
            // widget renders a deterministic "Open SDS" button (no raw link).
            if (parsed.sds && typeof parsed.sds.url === 'string') {
              pendingSds = { url: parsed.sds.url, product: parsed.sds.product, label: parsed.sds.label };
              return;
            }
            // Structured side-channel: the agent emits {quote:{...}} with the
            // deterministic figures so the widget renders a quote card (no
            // model-typed numbers).
            if (parsed.quote && (parsed.quote.status === 'quoted' || parsed.quote.status === 'price_on_request')) {
              pendingQuote = parsed.quote;
              return;
            }
            // Structured side-channel: the agent emits {form:{form_id,prefill}} to
            // open the structured sample form (free-text intent → same form as the
            // hub card). Acted on at [DONE], after the bot's text reply.
            if (parsed.form && typeof parsed.form.form_id === 'string') {
              pendingForm = { form_id: parsed.form.form_id, prefill: parsed.form.prefill || {} };
              return;
            }
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
          if (sseRetryCount < SSE_MAX_RETRIES) {
            sseRetryCount += 1;
            streamingCallbackRef.current = null;
            return 1500;
          }
          const partial = streamingCallbackRef.current?.flush?.() || '';
          streamingCallbackRef.current = null;
          setMessages(prev => {
            const updated = [...prev];
            const last = updated[updated.length - 1];
            const fallback = "I'm having trouble connecting to the Sapybase servers right now. Please try again later or use the contact form.";
            const content = partial.trim() ? partial + '\n\n_(Connection lost — message may be incomplete.)_' : fallback;
            if (last?.role === 'bot' && last.isStreaming) {
              updated[updated.length - 1] = { role: 'bot', content, isStreaming: false };
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
      setIsLoading(false);
    }
  };

  const handleHandoff = () => {
    setShowMenu(false);
    if (handoffSent) return;
    setMessages(prev => [
      ...prev,
      { role: 'bot', content: "I'll connect you with our team! Share your email so they can reply to you directly. 👇", ts: Date.now() },
      { role: 'handoff_form', id: 'handoff-form' },
    ]);
  };

  const submitHandoff = async (visitorEmail: string, visitorName: string) => {
    setHandoffSent(true);
    const transcript = messages.filter(m => m.role === 'user' || m.role === 'bot').map(m => ({ role: m.role, content: m.content || '' }));
    try {
      const parentOriginHandoff = (typeof window !== 'undefined' && (window as unknown as { __SapybaseParentOrigin?: string }).__SapybaseParentOrigin) || '';
      const res = await fetch(`${activeApiUrl}/api/handoff`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': activeApiKey!,
          ...(parentOriginHandoff ? { 'x-Sapybase-parent-origin': parentOriginHandoff } : {}),
        },
        body: JSON.stringify({ transcript, visitor_email: visitorEmail, visitor_name: visitorName || null }),
      });
      const data = res.ok ? await res.json() : {};
      setMessages(prev => prev.map(m =>
        m.id === 'handoff-form' ? { role: 'handoff_confirmed', visitorEmail, redirectUrl: data.handoff_redirect_url, id: 'handoff-confirmed' } : m
      ));
    } catch {
      setMessages(prev => prev.map(m =>
        m.id === 'handoff-form' ? { role: 'bot', content: 'Something went wrong. Please try again.', ts: Date.now() } : m
      ));
      setHandoffSent(false);
    }
  };

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
    <div className={`${isEmbed ? 'relative w-full h-full' : 'sapy-chat-root fixed bottom-0 right-0 sm:bottom-6 sm:right-6'} z-2147483647 font-sans pointer-events-none`} style={{ isolation: 'isolate', width: isOpen ? '100%' : 'auto', height: isOpen ? '100%' : 'auto' }}>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            variants={{ hidden: { opacity: 0, scale: 0.8, y: 20, transformOrigin: 'bottom right' }, visible: { opacity: 1, scale: 1, y: 0, transition: { type: 'spring', stiffness: 350, damping: 25 } }, exit: { opacity: 0, scale: 0.8, y: 20, transition: { duration: 0.2 } } }}
            initial={isEmbed ? "visible" : "hidden"} animate="visible" exit="exit"
            className={`${isEmbed ? 'relative w-full h-full bg-white dark:bg-slate-900' : 'fixed inset-0 sm:inset-auto sm:bottom-22 sm:right-4 w-full h-dvh sm:w-[500px] sm:h-[650px] bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl'} sm:rounded-2xl shadow-lg shadow-blue-900/20 dark:shadow-black/40 flex flex-col sm:overflow-hidden z-2147483640 pointer-events-auto origin-bottom-right`}
            style={{ ...themeStyleVars, ...(isEmbed ? { height: '100%' } : isMobile ? { height: 'var(--sapy-vh, 100dvh)' } : {}) } as React.CSSProperties}
          >
            <div className={`relative shrink-0 ${hasHub && hubView === 'home' ? 'bg-gray-50/50 dark:bg-slate-950/50 bg-gradient-to-b from-[var(--sapy-theme)]/[0.12] to-[var(--sapy-theme)]/[0.04]' : 'bg-gray-50/50 dark:bg-slate-950/50'}`}>
              <div className="text-slate-900 dark:text-slate-100 p-2 pt-[max(env(safe-area-inset-top),0.75rem)] sm:pt-2 flex justify-end items-center relative">
                <div className="relative flex flex-row justify-between items-center w-full" ref={menuRef}>
                  <div className="relative flex items-center gap-2 pl-1">
                    {hasHub && hubView === 'chat' && (
                      // Top-nav back arrow → Home screen (only for vertical bots).
                      <button onClick={() => { setActiveHubCard(null); setHubView('home'); }}
                        style={{ WebkitTapHighlightColor: 'transparent', outlineColor: THEME_COLOR }}
                        className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors flex items-center justify-center focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2" aria-label="Go to home">
                        <span className="material-symbols-outlined text-[22px] leading-none text-slate-500 dark:text-slate-400">arrow_back</span>
                      </button>
                    )}
                    <div className="relative">
                      {/* In-chat profile avatar is ALWAYS a circle with no shadow so any
                          custom logo sits seamlessly. The selected shape applies to the
                          FAB floating icon only — never here. */}
                      <BotAvatar
                        shapeId="circle"
                        logoUrl={LOGO_URL}
                        botName={BOT_NAME}
                        themeColor={THEME_COLOR}
                        sizeClass="w-10 h-10 rounded-full"
                        hasShadow={false}
                        isCustom={!!configData.custom_logo_url}
                        bgStyle={AVATAR_BG_STYLE}
                        transparentBgImage={true}
                      />
                    </div>
                    <div className="flex items-center pl-1">
                      <p className="text-[15px] font-google font-medium text-slate-900 dark:text-slate-100 leading-none">{BOT_NAME}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {/* The ⋮ menu acts on a conversation (clear chat / handoff) — hide
                        it on the Home screen where there's nothing to act on; ✕ stays. */}
                    {hubView !== 'home' && (
                    <button onClick={() => setShowMenu(!showMenu)}
                      style={{ WebkitTapHighlightColor: 'transparent', WebkitTouchCallout: 'none', userSelect: 'none', WebkitUserSelect: 'none', outlineColor: THEME_COLOR }}
                      className="p-2.5 sm:p-2 hover:bg-black/5 dark:hover:bg-white/10 rounded-full transition-colors focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 min-w-[44px] min-h-[44px] flex items-center justify-center" aria-label="Chat menu">
                      <MoreHorizontal size={22} className="text-slate-500 dark:text-slate-400" />
                    </button>
                    )}
                    <button onClick={() => { if (isEmbed) { postToParent({ type: 'Sapybase:close' }); } else { setIsOpen(false); } }}
                      style={{ WebkitTapHighlightColor: 'transparent', WebkitTouchCallout: 'none', userSelect: 'none', WebkitUserSelect: 'none', outlineColor: THEME_COLOR }}
                      className="p-2.5 sm:p-2 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-full transition-colors group focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 min-w-[44px] min-h-[44px] flex items-center justify-center" aria-label="Close chat">
                      <X size={22} className="text-slate-400 dark:text-slate-500 group-hover:text-red-500 dark:group-hover:text-red-400 transition-colors" />
                    </button>
                  </div>
                  <AnimatePresence>
                    {showMenu && (
                      <motion.div initial={{ opacity: 0, scale: 0.95, y: -10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: -10 }}
                        className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-slate-800 backdrop-blur-md rounded-xl shadow-2xl border border-gray-100 dark:border-slate-700 py-1 z-[2147483647] overflow-hidden">
                        {configData.lead_capture_enabled && (
                          <button onClick={handleHandoff} disabled={handoffSent}
                            className="w-full text-left px-4 py-2.5 text-base font-normal font-google text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors border-b border-gray-100 dark:border-slate-700 flex items-center justify-between disabled:opacity-50">
                            {handoffSent ? 'Team notified ✓' : 'Talk to a human'}
                            <span className="material-symbols-outlined text-[18px]">support_agent</span>
                          </button>
                        )}
                        <button onClick={() => {
                          setMessages([{ role: 'bot', content: configData.initial_message, ts: Date.now() }]);
                          userMessageCountRef.current = 0;
                          leadCapturedRef.current = false;
                          leadFormShownRef.current = false;
                          animatedMsgIndices.current.clear();
                          setHandoffSent(false);
                          setShowMenu(false);
                          setClearCount(c => c + 1);
                        }} className="w-full text-left px-4 py-2.5 text-base font-normal font-google text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors border-b border-gray-100 dark:border-slate-700 flex items-center justify-between">
                          Clear chat <span className="material-symbols-outlined">refresh</span>
                        </button>
                        <a href="https://www.sapybase.com" target="_blank" rel="noopener noreferrer"
                          className="w-full text-left px-4 py-2.5 text-base font-normal font-google text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors flex items-center justify-between group"
                          onClick={() => setShowMenu(false)}>
                          Add to your site
                          <span className="material-symbols-outlined text-[18px] opacity-0 group-hover:opacity-100 transition-opacity">open_in_new</span>
                        </a>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>

            {hubView === 'chat' && !sampleFormOpen && (
            <div className="flex-1 relative flex flex-col min-h-0 bg-gray-50/50 dark:bg-slate-950/50 text-slate-900 dark:text-slate-100">
              {showJumpPill && (
                <button
                  type="button"
                  onClick={() => { forceScrollToBottom(true); setShowJumpPill(false); }}
                  aria-label="Scroll to latest message"
                  className="sapy-msg-in absolute bottom-3 left-1/2 -translate-x-1/2 z-30 flex items-center justify-center w-9 h-9 rounded-full bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-gray-200 dark:border-slate-700 shadow-lg shadow-black/10 hover:bg-gray-50 dark:hover:bg-slate-700 active:scale-95 transition-colors cursor-pointer">
                  <span className="material-symbols-outlined text-[18px]">arrow_downward</span>
                </button>
              )}
              <div ref={scrollContainerRef} onScroll={handleScrollContainer}
                className="flex-1 min-h-0 px-4 sm:px-5 overflow-y-auto overscroll-contain touch-pan-y flex flex-col gap-5 pt-6 pb-2 relative [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                style={{ maskImage: 'linear-gradient(to bottom, transparent, black 20px, black calc(100% - 28px), transparent)', WebkitMaskImage: 'linear-gradient(to bottom, transparent, black 20px, black calc(100% - 28px), transparent)' }}>
                {/* Centered readable column (Claude/Gemini): a no-op at the narrow
                    popup, but centers the thread whenever the embed is rendered wide. */}
                <div className="flex flex-col gap-5 w-full max-w-3xl mx-auto">
                  {hasHub && messages.length === 1 ? (
                    // Chat empty-state (chemical Figma): a centered prompt instead of
                    // the greeting bubble. Cards/pills below drive the first action.
                    <div className="flex flex-col items-center justify-center text-center min-h-[40vh] px-6">
                      <p className="text-[17px] font-google font-medium text-slate-500 dark:text-slate-400 leading-snug">
                        {configData.initial_message || 'What are you exploring today?'}
                      </p>
                    </div>
                  ) : (
                  <AnimatePresence initial={false}>
                    {messages.map((msg, idx) => {
                      const isNew = !animatedMsgIndices.current.has(idx);
                      if (isNew) animatedMsgIndices.current.add(idx);
                      const metaTime = msg.ts ? new Date(msg.ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '';
                      const metaLabel = msg.role === 'bot' ? (metaTime ? `Agent · ${metaTime}` : 'Agent') : metaTime;
                      return (
                        <motion.div key={`${clearCount}-${idx}`} layout={msg.isStreaming ? false : 'position'}
                          initial={isNew ? { opacity: 0, y: 10, scale: 0.95 } : false}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                          className={`flex min-w-0 ${msg.role === 'lead_capture' || msg.role === 'handoff_form' || msg.role === 'handoff_confirmed' || msg.role === 'lead_confirmed' ? 'w-full' : `${msg.role === 'bot' ? 'max-w-full' : 'max-w-[85%]'} ${msg.role === 'user' ? 'self-end text-left' : 'self-start text-left'}`}`}>
                          {msg.role === 'handoff_form' ? (
                            <HandoffContactForm themeColor={THEME_COLOR} onSubmit={submitHandoff}
                              onDismiss={() => setMessages(prev => prev.filter(m => m.id !== 'handoff-form'))} />
                          ) : msg.role === 'handoff_confirmed' ? (
                            <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700/60 rounded-2xl p-4 shadow-sm w-full self-start text-left mt-2 space-y-3">
                              <p className="text-sm font-google font-bold text-emerald-600 dark:text-emerald-400 text-center">✅ Team notified!</p>
                              <p className="text-xs font-google text-slate-500 dark:text-slate-400 text-center">
                                {msg.visitorEmail ? <><b className="text-slate-700 dark:text-slate-300">Our team will reply to {msg.visitorEmail} shortly.</b></> : 'Our team has been notified and will follow up shortly.'}
                              </p>
                              {msg.redirectUrl && (
                                <a href={msg.redirectUrl} target="_blank" rel="noopener noreferrer"
                                  className="flex items-center justify-center gap-2 w-full py-2 rounded-full text-sm font-google font-bold text-white transition-opacity hover:opacity-90"
                                  style={{ backgroundColor: THEME_COLOR }}>
                                  Connect instantly <span className="material-symbols-outlined text-[16px]">open_in_new</span>
                                </a>
                              )}
                            </div>
                          ) : msg.role === 'lead_confirmed' ? (
                            <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700/60 rounded-2xl p-4 shadow-sm w-full self-start text-left mt-2 space-y-3">
                              <p className="text-sm font-google font-bold text-emerald-600 dark:text-emerald-400 text-center">🎉 Got it!</p>
                              <p className="text-xs font-google text-slate-500 dark:text-slate-400 text-center">
                                {msg.content || 'We’ve received your details and will be in touch shortly.'}
                              </p>
                              <p className="text-xs font-google text-slate-600 dark:text-slate-300 text-center font-semibold">
                                Want to talk sooner? Book a time that works for you:
                              </p>
                              {msg.bookingUrl && (
                                <a href={msg.bookingUrl} target="_blank" rel="noopener noreferrer"
                                  className="flex items-center justify-center gap-2 w-full py-2 rounded-full text-sm font-google font-bold text-white transition-opacity hover:opacity-90"
                                  style={{ backgroundColor: THEME_COLOR }}>
                                  <span className="material-symbols-outlined text-[16px]">calendar_month</span> Book a call
                                </a>
                              )}
                            </div>
                          ) : msg.role === 'lead_capture' ? (
                            <LeadCaptureForm themeColor={THEME_COLOR} activeApiUrl={activeApiUrl} apiKey={activeApiKey ?? ''}
                              contextString={messages.slice(Math.max(0, idx - 4), idx).filter(m => m.role === 'user').map(m => m.content).join(' || ')}
                              onSubmit={(name, bookingUrl) => {
                                leadCapturedRef.current = true;
                                const thanks = `Thanks${name ? ' ' + name : ''}! We've received your details and our team will be in touch shortly. 🎉`;
                                setMessages(prev => prev.map(m => m.id === 'lead-form'
                                  ? (bookingUrl
                                    ? { role: 'lead_confirmed', content: thanks, bookingUrl, id: 'lead-confirmed' }
                                    : { role: 'bot', content: thanks, ts: Date.now() })
                                  : m));
                              }}
                              onDismiss={() => { leadCapturedRef.current = true; setMessages(prev => prev.filter(m => m.id !== 'lead-form')); }} />
                          ) : (
                            <div className={`flex flex-col max-w-full min-w-0 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                              <div className={`min-h-[38px] ${msg.role === 'user' ? 'px-5 py-3' : 'px-1 py-0.5'} ${msg.role === 'bot' && msg.isStreaming && isLoading ? '!bg-transparent !p-1' : ''} ${msg.role === 'user' ? 'w-fit max-w-full self-end' : 'w-full max-w-full self-start'} break-words ${msg.role === 'user' ? 'rounded-3xl bg-[var(--sapy-user-bg)] dark:bg-[var(--sapy-user-bg-dark)] text-[var(--sapy-user-fg)] dark:text-[var(--sapy-user-fg-dark)]' : 'text-gray-800 dark:text-slate-200 overflow-hidden prose prose-compact dark:prose-invert max-w-none prose-p:leading-normal prose-pre:bg-gray-50 dark:prose-pre:bg-slate-900 prose-pre:text-gray-800 dark:prose-pre:text-slate-200 prose-pre:text-sm prose-code:text-sm prose-pre:max-w-full prose-pre:overflow-x-auto prose-pre:whitespace-pre-wrap prose-table:block prose-table:overflow-x-auto prose-headings:text-gray-900 dark:prose-headings:text-slate-100 prose-strong:text-gray-900 dark:prose-strong:text-slate-100 prose-ul:my-1 prose-li:my-0 prose-p:font-regular prose-img:max-w-full prose-img:rounded-lg'}`}>
                                {msg.role === 'user' ? (
                                  <div className="max-w-full whitespace-pre-wrap break-words text-[14px] font-normal font-google leading-relaxed">{msg.content}</div>
                                ) : (
                                  <div className="min-w-0 max-w-full text-[14px] font-google leading-relaxed">
                                    <MessageContent content={msg.content ?? ''} isStreaming={msg.isStreaming} themeColor={THEME_COLOR} streamCallbackRef={msg.isStreaming ? streamingCallbackRef : undefined} />
                                  </div>
                                )}
                              </div>
                              {msg.role === 'bot' && !msg.isStreaming && msg.sds?.url && (
                                // Deterministic SDS action — the agent never pastes
                                // the raw link; this button carries the real sheet.
                                <a href={msg.sds.url} target="_blank" rel="noopener noreferrer"
                                  className="mt-2 inline-flex items-center gap-2 px-4 py-2 rounded-full text-[13px] font-google font-bold text-white transition-opacity hover:opacity-90"
                                  style={{ backgroundColor: THEME_COLOR }}>
                                  <span className="material-symbols-outlined text-[18px] leading-none">description</span>
                                  {msg.sds.label || 'Open SDS'}
                                  <span className="material-symbols-outlined text-[16px] leading-none">arrow_outward</span>
                                </a>
                              )}
                              {msg.role === 'bot' && !msg.isStreaming && msg.quote && (
                                // Deterministic quote card — the agent describes but
                                // never re-derives these figures. GST is shown as
                                // "extra"; a POR quote shows a "requested" confirmation.
                                <div className="mt-2 w-full max-w-[280px] rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden">
                                  <div className="flex items-center gap-2 px-3 py-2 text-white text-[12px] font-google font-bold" style={{ backgroundColor: THEME_COLOR }}>
                                    <span className="material-symbols-outlined text-[16px] leading-none">receipt_long</span>
                                    {msg.quote.status === 'quoted' ? 'Quote' : 'Quote requested'}
                                  </div>
                                  <div className="px-3 py-2.5 text-[13px] font-google text-slate-700 dark:text-slate-200 leading-relaxed">
                                    <div className="font-bold">{msg.quote.product}</div>
                                    <div className="text-[12px] text-slate-500 dark:text-slate-400">
                                      {[msg.quote.grade, msg.quote.pack_size].filter(Boolean).join(' · ')}
                                    </div>
                                    {msg.quote.status === 'quoted' ? (
                                      <>
                                        <div className="mt-2 flex justify-between"><span>Unit price</span><span>{fmtINR(msg.quote.unit_price, msg.quote.currency)}</span></div>
                                        <div className="flex justify-between"><span>Quantity</span><span>× {msg.quote.quantity}</span></div>
                                        <div className="mt-1 pt-1.5 border-t border-slate-200 dark:border-slate-700 flex justify-between font-bold"><span>Subtotal</span><span>{fmtINR(msg.quote.subtotal, msg.quote.currency)}</span></div>
                                        <div className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">{msg.quote.gst_note || 'GST extra as applicable'} · subject to confirmation</div>
                                      </>
                                    ) : (
                                      <div className="mt-2 text-[12px] text-slate-500 dark:text-slate-400">This pack is priced on request — our team will get back to you with a price.</div>
                                    )}
                                  </div>
                                </div>
                              )}
                              {msg.role === 'bot' && !msg.isStreaming && msg.sample && (
                                // Sample-request confirmation card — the team follows
                                // up; no price, no delivery promise (those are the
                                // owner's to confirm).
                                <div className="mt-2 w-full max-w-[280px] rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden">
                                  <div className="flex items-center gap-2 px-3 py-2 text-white text-[12px] font-google font-bold" style={{ backgroundColor: THEME_COLOR }}>
                                    <span className="material-symbols-outlined text-[16px] leading-none">package_2</span>
                                    Sample requested
                                  </div>
                                  <div className="px-3 py-2.5 text-[13px] font-google text-slate-700 dark:text-slate-200 leading-relaxed">
                                    <div className="font-bold">{msg.sample.product}</div>
                                    <div className="text-[12px] text-slate-500 dark:text-slate-400">
                                      {[msg.sample.grade, msg.sample.packaging, msg.sample.quantity ? `× ${msg.sample.quantity}` : null].filter(Boolean).join(' · ')}
                                    </div>
                                    <div className="mt-2 text-[12px] text-slate-500 dark:text-slate-400">Our team will be in touch to arrange your sample.</div>
                                  </div>
                                </div>
                              )}
                              {metaLabel && !msg.isStreaming && <span className="text-[11px] font-google text-slate-400 dark:text-slate-500 mt-1 px-1 leading-none">{metaLabel}</span>}
                            </div>
                          )}
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                  )}
                </div>
                <div ref={messagesEndRef} className="h-5 shrink-0" aria-hidden="true" />
              </div>
            </div>
            )}

            {hubView === 'chat' && sampleFormOpen && (
              <SampleForm
                schema={configData.sample_form ?? []}
                products={configData.products ?? []}
                prefill={sampleFormPrefill}
                themeColor={THEME_COLOR}
                submitting={sampleSubmitting}
                error={sampleError}
                onSubmit={submitSampleForm}
                onCancel={() => { setSampleFormOpen(false); setSampleError(null); }}
              />
            )}

            {hubView === 'home' && hasHub && (
              // Home screen — branded gradient + 2-col action grid + pill Home/Chat
              // nav + Vaayu footer (chemical Figma).
              <div className="flex-1 min-h-0 flex flex-col bg-gray-50/50 dark:bg-slate-950/50 bg-gradient-to-b from-[var(--sapy-theme)]/[0.06] via-[var(--sapy-theme)]/[0.02] to-transparent">
                <div className="flex-1 overflow-y-auto px-3 pt-6 pb-3 flex flex-col [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  <p className="text-[19px] font-google font-semibold text-slate-900 dark:text-slate-100 px-1 mb-4 leading-snug">How can we help you today?</p>
                  {/* 2-col action grid (chemical Figma). An odd last card spans both
                      columns so 3 / 5 cards never leave an empty cell. */}
                  <div className="grid grid-cols-2 gap-2.5">
                    {(configData.hub_cards ?? []).map((card, i, arr) => {
                      const oddLast = arr.length % 2 === 1 && i === arr.length - 1;
                      return (
                        <button key={card.id} type="button" onClick={() => openCardFromHome(card)} aria-label={card.label}
                          className={`${oddLast ? 'col-span-2' : ''} flex flex-col items-center justify-center text-center gap-2 rounded-2xl border border-slate-200/70 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-5 transition-colors hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50/60 dark:hover:bg-slate-800/40`}>
                          <span className="material-symbols-outlined text-[26px] leading-none text-[var(--sapy-theme)]" aria-hidden="true">{HUB_ICON[card.icon] || 'bolt'}</span>
                          <span className="text-[13.5px] font-google font-medium text-slate-800 dark:text-slate-100 leading-tight break-words">{card.label}</span>
                          {card.subtitle && <span className="text-[11.5px] font-google text-slate-500 dark:text-slate-400 leading-snug break-words">{card.subtitle}</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
                {/* Pill-shaped Home/Chat segmented nav (active = inner white pill) */}
                <div className="shrink-0 flex flex-col items-center px-3 pt-2" style={{ paddingBottom: isMobile ? 'var(--sapy-safe-bottom, env(safe-area-inset-bottom, 6px))' : 'env(safe-area-inset-bottom, 6px)' }}>
                  <div className="inline-flex items-center gap-1 p-1 rounded-full bg-slate-100 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60">
                    <button type="button" onClick={() => setHubView('home')} aria-label="Home" aria-pressed="true"
                      className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-white dark:bg-slate-950 text-[var(--sapy-theme)] shadow-sm text-[12.5px] font-google font-medium">
                      <span className="material-symbols-outlined text-[16px] leading-none">home</span>
                      Home
                    </button>
                    <button type="button" onClick={() => setHubView('chat')} aria-label="Chat" aria-pressed="false"
                      className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-slate-500 dark:text-slate-400 text-[12.5px] font-google font-medium hover:text-slate-700 dark:hover:text-slate-200 transition-colors">
                      <span className="material-symbols-outlined text-[16px] leading-none">chat_bubble</span>
                      Chat
                    </button>
                  </div>
                  {!configData.white_label_enabled && (
                    <a href="https://www.sapybase.com" target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1.5 mt-2.5 text-[10px] font-sans font-normal tracking-wide text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors group">
                      <Image src={BrandLogo} alt="Vaayu" width={18} height={12} className="opacity-50 group-hover:opacity-100 transition-opacity" />
                      Vaayu Intelligence
                    </a>
                  )}
                </div>
              </div>
            )}

            {hubView === 'chat' && !sampleFormOpen && (
            <div className="bg-gray-50/50 dark:bg-slate-950/50 shrink-0 z-10 flex flex-col">
              {hasHub && (activeHubCard || (messages.length === 1 && !input.trim())) ? (
                // Phase 3 — pack-driven hub. Card strip on a fresh conversation;
                // a tool card (here or from Home) swaps in its slot mini-form,
                // which may open mid-conversation when launched from the Home tab.
                <div className="px-4 sm:px-5 pb-1 pt-2.5 w-full max-w-3xl mx-auto">
                  {activeHubCard ? (
                    <div className="flex flex-col gap-2">
                      {/* Back sits at the top so the visitor can return to asking;
                          below it is the single required field (no duplicate input). */}
                      <button type="button" onClick={() => setActiveHubCard(null)} aria-label="Back to options"
                        className="flex items-center gap-1 self-start -ml-1 px-1.5 py-1 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800/60 transition-colors">
                        <span className="material-symbols-outlined text-[18px] leading-none">arrow_back</span>
                        <span className="text-[13px] font-medium font-google">Back</span>
                      </button>
                      <div className="relative">
                        {activeHubCard.input_source === 'products' && hubProductMatches.length > 0 && (
                          // Drop-UP (input sits near the bottom): the searchable catalog.
                          <div className="absolute bottom-full left-0 right-0 mb-1.5 max-h-44 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg scrollbar-thin z-20">
                            {hubProductMatches.map((p, i) => (
                              <button key={`${p.name}-${p.cas_number || ''}-${i}`} type="button" onClick={() => submitHubValue(p.name)}
                                className="w-full text-left px-3 py-2 flex items-center justify-between gap-2 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                                <span className="text-[14px] font-google text-slate-800 dark:text-slate-200 truncate">{p.name}</span>
                                <span className="text-[11px] text-slate-400 dark:text-slate-500 shrink-0 font-google">{p.cas_number || p.grade || ''}</span>
                              </button>
                            ))}
                          </div>
                        )}
                        <form onSubmit={(e) => { e.preventDefault(); submitHubCard(); }}
                          className="relative flex items-center gap-1.5 rounded-full bg-transparent border border-slate-300 dark:border-slate-600 pl-3.5 pr-1.5 py-1.5 transition-colors focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500">
                          {activeHubCard.input_source === 'products' && (
                            <span className="material-symbols-outlined text-[18px] leading-none text-slate-400 dark:text-slate-500 shrink-0" aria-hidden="true">search</span>
                          )}
                          <input value={hubInput} onChange={e => setHubInput(e.target.value)} autoFocus
                            placeholder={activeHubCard.input_label || 'Type your answer'}
                            aria-label={activeHubCard.input_label || activeHubCard.label}
                            className="flex-1 min-w-0 bg-transparent focus:outline-none text-[15px] font-google text-slate-900 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-500" />
                          <button type="submit" disabled={!hubInput.trim() || isLoading} aria-label="Submit"
                            className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center bg-slate-200 dark:bg-slate-700 transition-colors disabled:cursor-not-allowed ${hubInput.trim() && !isLoading ? 'text-blue-900 dark:text-blue-300' : 'text-slate-400 dark:text-slate-500'}`}>
                            <span className="material-symbols-outlined text-[20px] leading-none">arrow_upward</span>
                          </button>
                        </form>
                      </div>
                    </div>
                  ) : (
                    // Chat empty-state shortcuts: the hub actions as stacked pills
                    // (chemical Figma). The full card grid lives on the Home screen;
                    // here they're quick entries for someone already in chat.
                    <div className="flex flex-col items-start gap-2">
                      {configData.hub_cards!.map((card) => (
                        <button key={card.id} type="button" onClick={() => handleHubCardTap(card)} aria-label={card.label}
                          className="px-4 py-2.5 min-h-[40px] rounded-full text-[14px] font-normal font-google transition-all max-w-full text-left break-words bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 border border-slate-200/60 dark:border-slate-800/80 shadow-sm hover:text-[var(--sapy-theme)] dark:hover:text-[var(--sapy-theme)] hover:border-slate-300 dark:hover:border-slate-700 hover:shadow">
                          {card.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : messages.length === 1 && !input.trim() && (configData.quick_questions?.length ?? 0) > 0 ? (
                <div className="flex flex-col items-start gap-2 px-4 sm:px-5 pb-1 pt-2.5 w-full max-w-3xl mx-auto">
                  {configData.quick_questions.map((q, qidx) => {
                    const label = typeof q === 'string' ? q : (q.label || q.prompt || '');
                    if (!label) return null;
                    return (
                      <button key={qidx} onClick={() => sendMessage(label)}
                        className="px-4 py-2.5 min-h-[40px] rounded-full text-[14px] font-normal font-google transition-all max-w-full text-left break-words bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 border border-slate-200/60 dark:border-slate-800/80 shadow-sm hover:text-[var(--sapy-theme)] dark:hover:text-[var(--sapy-theme)] hover:border-slate-300 dark:hover:border-slate-700 hover:shadow">
                        {label}
                      </button>
                    );
                  })}
                </div>
              ) : null}
              <div className="px-4 sm:px-5 pt-2 w-full max-w-3xl mx-auto" style={{ paddingBottom: isMobile ? 'var(--sapy-safe-bottom, env(safe-area-inset-bottom, 8px))' : 'env(safe-area-inset-bottom, 8px)' }}>
                {/* Hide the main chat input while a hub mini-form is open — the
                    card's own field is the only input required; the Back button
                    above returns the visitor here to free-ask. */}
                {!activeHubCard && (
                <form onSubmit={handleSend} className="relative flex items-center gap-1.5 rounded-full bg-transparent border border-slate-300 dark:border-slate-600 pl-4 pr-1.5 py-1.5 transition-colors focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500">
                  <textarea ref={inputRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKeyDown}
                    placeholder="Ask anything"
                    className="flex-1 max-h-32 min-h-[28px] bg-transparent resize-none py-[6px] focus:outline-none leading-relaxed text-slate-900 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-500 disabled:opacity-50 appearance-none rounded-none text-[15px] font-google [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                    rows={1} disabled={isLoading} aria-label="Chat input" />
                  <button type="submit" disabled={isLoading || !input.trim()} aria-label="Send message"
                    className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center bg-slate-200 dark:bg-slate-700 transition-colors disabled:cursor-not-allowed ${input.trim() && !isLoading ? 'text-blue-900 dark:text-blue-300' : 'text-slate-400 dark:text-slate-500'}`}>
                    <span className="material-symbols-outlined text-[20px] leading-none">arrow_upward</span>
                  </button>
                </form>
                )}
                {!configData.white_label_enabled && (
                  <div className="flex items-center justify-center gap-1.5 py-2.5">
                    <a href="https://www.sapybase.com" target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-[10px] font-sans font-normal tracking-wide text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors group">
                      <Image src={BrandLogo} alt="Vaayu" width={18} height={12} className="opacity-50 group-hover:opacity-100 transition-opacity" />
                      Vaayu Intelligence
                    </a>
                  </div>
                )}
              </div>
            </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {!isEmbed && (
        <div className={`fixed bottom-3 right-3 sm:bottom-4 sm:right-4 z-2147483646 pointer-events-auto ${isOpen ? 'hidden sm:block' : 'block'}`}>
          <div className="relative flex items-center justify-end">
            <FabButton
              fabPath={FAB_PATH}
              fabGradient={fabGradient}
              logoUrl={LOGO_URL}
              botName={BOT_NAME}
              themeColor={THEME_COLOR}
              isCustomLogo={!!configData.custom_logo_url}
              fabShapeX={fabShape.x || 0}
              fabShapeY={fabShape.y || 0}
              isOpen={isOpen}
              onClick={() => setIsOpen(prev => !prev)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
