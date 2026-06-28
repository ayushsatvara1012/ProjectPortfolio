'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { FAB_SHAPES, resolveAvatarBg } from '../ui/avatar/AvatarShared';

const IS_DEV = process.env.NODE_ENV === 'development';
const ASSET_BASE_URL = IS_DEV ? '' : 'https://www.sapybase.com';

const BLOCKED_LOGO_HOSTS = [
  'cdn.discordapp.com',
  'media.discordapp.net',
  'files.slack.com',
  'media.giphy.com',
];

function preValidateUrl(url: string) {
  if (!url || !url.trim()) return null;

  if (!url.startsWith('https://')) {
    return 'URL must start with https://. Plain http:// and data: URIs are not accepted.';
  }

  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();

    if (host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0') {
      return 'Private/local addresses are not allowed.';
    }

    for (const blocked of BLOCKED_LOGO_HOSTS) {
      if (host === blocked || host.endsWith('.' + blocked)) {
        return `Links from ${blocked} expire quickly. Use a permanent CDN (e.g. Cloudinary, your own domain, or Imgur).`;
      }
    }
  } catch {
    return 'Please enter a valid URL (e.g. https://example.com/logo.png).';
  }

  return null;
}

// ── BotAvatar ──────────────────────────────────────────────────────────────────
// SVG clipPath renderer — the ONLY approach that correctly clips to irregular
// paths (bento tail, sharp point). CSS overflow-hidden cannot do this.
//
// 4-layer SVG stack:
//   L1 themeColor <path>  — fills entire shape including tail
//   L2 white <rect>       — backdrop for transparent PNGs (only when image shown)
//   L3 <image>            — custom logo, slice-scaled to fill clip area
//   L4 <text>             — initial letter fallback (only when no image)
type BotAvatarProps = {
  shapeId?: string;
  logoUrl?: string;
  botName?: string;
  size?: 'sm' | 'md' | 'lg';
  themeColor?: string;
  bgStyle?: string;
  isCustom?: boolean;
  hasShadow?: boolean;
  transparentBgImage?: boolean;
};

export function BotAvatar({
  shapeId = 'circle',
  logoUrl = '',
  botName = 'S',
  size = 'md',
  themeColor = '#5730F5',
  bgStyle = 'none',
  isCustom = true,
  hasShadow = true,
  transparentBgImage = false,
}: BotAvatarProps) {
  const [imgFailed, setImgFailed] = useState(false);
  const prevUrlRef = useRef(logoUrl);

  // EC5: reset imgFailed whenever URL changes so new image gets a fresh attempt
  useEffect(() => {
    if (logoUrl !== prevUrlRef.current) {
      setImgFailed(false);
      prevUrlRef.current = logoUrl;
    }
  }, [logoUrl]);

  // EC6: unique per-instance IDs prevent SVG clipPath/gradient ID collisions
  const uid = React.useId().replace(/:/g, '');

  const shape = FAB_SHAPES[shapeId] || FAB_SHAPES.circle;
  const FAB_PATH = shape.path;
  const offsetX = shape.x || 0;
  const offsetY = shape.y || 0;

  const bg = resolveAvatarBg(bgStyle);
  const gradient = bg.kind === 'gradient' ? bg.colors : null;
  const solid = bg.kind === 'solid' ? bg.color : null;
  const showImage = !!(logoUrl && logoUrl.trim() && !imgFailed);
  const useFallback = !showImage || !isCustom;
  const FallbackLogoUrl = `${ASSET_BASE_URL}/logo2.svg`;

  // L1 fill: white backdrop when fallback logo is shown, otherwise solid colour,
  // gradient, themeColor, or transparent — in that priority order.
  const baseFill = useFallback
    ? '#ffffff'
    : (gradient ? `url(#${uid}-grad)` : (solid ? solid : (transparentBgImage ? 'transparent' : themeColor)));

  // EC2: sizes in SVG coordinate units (viewBox is 0 0 100 100)
  const sizePx = { sm: 28, md: 40, lg: 56 }[size] ?? 40;
  const fontSize = { sm: 10, md: 15, lg: 21 }[size] ?? 15;

  return (
    <svg
      viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg"
      width={sizePx}
      height={sizePx}
      className={`shrink-0 ${hasShadow ? 'drop-shadow-sm' : ''}`}
      overflow="visible"
    >
      <defs>
        {/* EC12: clipPath defined inline in same SVG — safe in shadow DOM */}
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

      {/* L1: theme-color fills entire path including tail/corners */}
      <path d={FAB_PATH} fill={baseFill} />

      {/* L2: white/slate backdrop clipped to shape — EC1 transparent PNG fix.
           EC8: if gradient bgStyle, show gradient not white so it shows through. */}
      {showImage && !useFallback && (
        <g clipPath={`url(#${uid}-clip)`}>
          {gradient ? (
            <rect x="0" y="0" width="100" height="100" fill={`url(#${uid}-grad)`} />
          ) : (
            <rect x="0" y="0" width="100" height="100" fill={solid ? solid : (transparentBgImage ? 'transparent' : '#f8fafc')} />
          )}
        </g>
      )}

      {/* L3: custom logo clipped precisely to shape — EC2 tail coverage */}
      {showImage && !useFallback && (
        <g clipPath={`url(#${uid}-clip)`}>
          <image
            href={logoUrl}
            x={0}
            y={0}
            width={100}
            height={100}
            preserveAspectRatio="xMidYMid slice"
          />
        </g>
      )}

      {/* L4: fallback logo when no custom image or image fails to load */}
      {useFallback ? (
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
      ) : null}
    </svg>
  );
}


// ── FabWidgetPreview (used in the customizer live preview strip) ───────────────
export const FabWidgetPreview = ({
  shapeId,
  logoUrl,
  botName,
  themeColor,
  bgStyle,
  isCustomUrl = false,
}: {
  shapeId: string;
  logoUrl: string;
  botName: string;
  themeColor: string;
  bgStyle: string;
  isCustomUrl?: boolean;
}) => {
  // Avatar shape is locked to circle across the product.
  const fabShape = FAB_SHAPES.circle;
  const FAB_PATH = fabShape.path;
  const THEME_COLOR = themeColor || '#5730F5';
  const BOT_NAME = botName || 'S';
  const bg = resolveAvatarBg(bgStyle);
  const gradient = bg.kind === 'gradient' ? bg.colors : null;
  const solid = bg.kind === 'solid' ? bg.color : null;
  const idPrefix = 'fab-preview';
  const useFallback = !logoUrl || !isCustomUrl;
  const FallbackLogoUrl = `${ASSET_BASE_URL}/logo2.svg`;

  return (
    <svg
      viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg"
      className="w-14 h-14 shrink-0 drop-shadow-sm"
      overflow="visible"
    >
      <defs>
        <clipPath id={`${idPrefix}-clip`}>
          <path d={FAB_PATH} />
        </clipPath>
        <filter id={`${idPrefix}-inset`} x="-20%" y="-20%" width="140%" height="140%">
          <feComponentTransfer in="SourceAlpha"><feFuncA type="table" tableValues="1 0" /></feComponentTransfer>
          <feGaussianBlur stdDeviation="3" /><feOffset dx="4" dy="4" result="dark" />
          <feComposite operator="in" in2="SourceAlpha" result="iDark" />
          <feFlood floodColor="rgba(0,0,0,0.14)" />
          <feComposite operator="in" in2="iDark" result="fDark" />
          <feComponentTransfer in="SourceAlpha"><feFuncA type="table" tableValues="1 0" /></feComponentTransfer>
          <feGaussianBlur stdDeviation="3" /><feOffset dx="-3" dy="-3" result="light" />
          <feComposite operator="in" in2="SourceAlpha" result="iLight" />
          <feFlood floodColor="rgba(255,255,255,0.8)" />
          <feComposite operator="in" in2="iLight" result="fLight" />
          <feMerge><feMergeNode in="SourceGraphic" /><feMergeNode in="fDark" /><feMergeNode in="fLight" /></feMerge>
        </filter>
        <linearGradient id={`${idPrefix}-light`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFFFFF" /><stop offset="100%" stopColor="#E2E8F0" />
        </linearGradient>
        <linearGradient id={`${idPrefix}-dark`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#1E293B" /><stop offset="100%" stopColor="#0F172A" />
        </linearGradient>
        {gradient && (
          <linearGradient id={`${idPrefix}-grad`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={gradient[0]} />
            <stop offset="100%" stopColor={gradient[1]} />
          </linearGradient>
        )}
      </defs>

      {/* Background */}
      <path
        d={FAB_PATH}
        fill={
          useFallback
            ? '#ffffff'
            : gradient
              ? `url(#${idPrefix}-grad)`
              : solid
                ? solid
                : THEME_COLOR
        }
        className={
          !gradient && !solid && !useFallback
            ? `dark:fill-[url(#${idPrefix}-dark)] transition-all duration-500`
            : 'transition-all duration-500'
        }
      />

      {/* EC1: white backdrop for custom URLs — transparent PNGs show slate-50 not theme color */}
      {logoUrl && isCustomUrl && (
        <g clipPath={`url(#${idPrefix}-clip)`}>
          {gradient ? (
            <rect x="0" y="0" width="100" height="100" fill={`url(#${idPrefix}-grad)`} />
          ) : (
            <rect x="0" y="0" width="100" height="100" fill={solid ? solid : '#f8fafc'} />
          )}
        </g>
      )}

      {/* Image clipped to shape — slice for custom URLs fills the full clip area */}
      {!useFallback ? (
        <g clipPath={`url(#${idPrefix}-clip)`}>
          <image
            href={logoUrl}
            x={fabShape.x || 0}
            y={fabShape.y || 0}
            width={100}
            height={100}
            preserveAspectRatio="xMidYMid slice"
          />
        </g>
      ) : (
        <g clipPath={`url(#${idPrefix}-clip)`}>
          <image
            href={FallbackLogoUrl}
            xlinkHref={FallbackLogoUrl}
            x={20 + (fabShape.x || 0)}
            y={20 + (fabShape.y || 0)}
            width={60}
            height={60}
            preserveAspectRatio="xMidYMid meet"
          />
        </g>
      )}

      {/* 3D inset shadow overlay */}
      <path d={FAB_PATH} fill="transparent" filter={`url(#${idPrefix}-inset)`} className="pointer-events-none" />
    </svg>
  );
};

// ── LogoCustomizer ──────────────────────────────────────────────────────────────
type LogoCustomizerProps = {
  customLogoUrl: string;
  primaryColor: string;
  botName: string;
  isProUser: boolean;
  onUrlChange: (url: string) => void;
  avatarBgStyle: string;
  onBgStyleChange: (styleId: string) => void;
  onPrimaryColorChange: (val: string) => void;
};

const DEFAULT_AVATAR_BG = '#ffffff';

const _labelCls = 'block text-[13px] font-medium font-google text-slate-600 dark:text-slate-300 mb-1 transition-colors';
const _inputCls = 'w-full text-sm font-google px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:border-slate-400 dark:focus:border-slate-500 focus:outline-none focus:ring-4 focus:ring-slate-900/[0.04] dark:focus:ring-white/[0.04] text-slate-900 dark:text-slate-200 transition rounded-lg';

export default function LogoCustomizer({
  customLogoUrl,
  primaryColor,
  botName,
  isProUser,
  onUrlChange,
  avatarBgStyle,
  onBgStyleChange,
  onPrimaryColorChange,
}: LogoCustomizerProps) {
  const [urlInput, setUrlInput] = useState(customLogoUrl || '');
  const [urlError, setUrlError] = useState<string | null>(null);

  useEffect(() => {
    setUrlInput(customLogoUrl || '');
    setUrlError(null);
  }, [customLogoUrl]);

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setUrlInput(val);
    const err = preValidateUrl(val);
    setUrlError(err);
    if (!err) onUrlChange(val);
  };

  const handleUrlBlur = () => {
    if (!urlError) onUrlChange(urlInput);
  };

  const bg = resolveAvatarBg(avatarBgStyle);
  const avatarHex = bg.kind === 'solid' ? bg.color : DEFAULT_AVATAR_BG;

  return (
    <div className="space-y-4">
      {/* Row 1: Preview + Logo URL + Logo BG — all on one line at sm+ */}
      <div className="flex flex-col sm:flex-row items-start gap-4">
        {/* Live preview pill */}
        <div className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shrink-0">
          <FabWidgetPreview
            shapeId="circle"
            logoUrl={(!urlError && urlInput) ? urlInput : customLogoUrl}
            botName={botName}
            themeColor={primaryColor}
            bgStyle={avatarBgStyle}
            isCustomUrl={!!customLogoUrl}
          />
          <div className="min-w-0">
            <p className="text-sm font-medium font-google text-slate-800 dark:text-slate-200 truncate">{botName || 'Your bot'}</p>
            <p className="text-[11px] font-google text-slate-500 dark:text-slate-400">Preview</p>
          </div>
        </div>

        {/* Logo URL */}
        <div className="flex-1 min-w-0 w-full">
          <label className={_labelCls}>
            Logo URL
            {!isProUser && (
              <span className="ml-1.5 px-1.5 py-0.5 bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 text-[9px] rounded-full border border-amber-200 dark:border-amber-800">
                Pro
              </span>
            )}
          </label>
          {!isProUser ? (
            <div className="relative">
              <div className={`${_inputCls} opacity-40 pointer-events-none select-none text-sm`}>
                https://your-domain.com/logo.png
              </div>
              <div className="absolute inset-0 flex items-center justify-center bg-white/60 dark:bg-slate-950/60 backdrop-blur-[1px] rounded-lg">
                <Link
                  href="/dashboard/pricing"
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-linear-to-r from-blue-600 to-green-600 text-white text-xs font-medium font-google hover:opacity-90 transition-all shadow-sm rounded-lg"
                >
                  <span className="material-symbols-outlined text-[12px]">lock</span>
                  Upgrade to Pro
                </Link>
              </div>
            </div>
          ) : (
            <>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[16px] text-slate-400 dark:text-slate-500">link</span>
                <input
                  type="url"
                  value={urlInput}
                  onChange={handleUrlChange}
                  onBlur={handleUrlBlur}
                  placeholder="https://your-domain.com/logo.png"
                  className={`${_inputCls} pl-9 pr-10 ${urlError ? '!border-red-400 dark:!border-red-500' : ''}`}
                  autoComplete="off"
                  spellCheck="false"
                />
                {urlInput && (
                  <span className={`material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-[16px] ${urlError ? 'text-red-500' : 'text-emerald-500'}`}>
                    {urlError ? 'error' : 'check_circle'}
                  </span>
                )}
              </div>
              {urlError && (
                <p className="text-[11px] text-red-600 dark:text-red-400 font-google mt-1">{urlError}</p>
              )}
              {urlInput && !urlError && (
                <button
                  type="button"
                  onClick={() => { setUrlInput(''); setUrlError(null); onUrlChange(''); }}
                  className="mt-1 flex items-center gap-1 text-xs font-medium text-red-500 hover:text-red-700 transition-colors font-google"
                >
                  <span className="material-symbols-outlined text-[12px]">close</span>
                  Clear
                </button>
              )}
            </>
          )}
        </div>

        {/* Logo background colour */}
        <div className="shrink-0 w-full sm:w-auto sm:min-w-[160px]">
          <label className={_labelCls}>Logo background</label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={avatarHex}
              onChange={e => onBgStyleChange(e.target.value)}
              className={`${_inputCls} flex-1 uppercase font-mono text-xs`}
              placeholder={DEFAULT_AVATAR_BG}
              spellCheck="false"
              autoComplete="off"
            />
            <div
              className="w-10 h-10 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden cursor-pointer shrink-0"
              style={{ background: avatarHex }}
            >
              <input
                type="color"
                value={avatarHex}
                onChange={e => onBgStyleChange(e.target.value)}
                className="opacity-0 w-full h-full cursor-pointer"
                aria-label="Logo background colour"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Row 2: Chat theme colour — compact inline */}
      <div className="flex flex-col sm:flex-row sm:items-end gap-4">
        <div className="sm:max-w-[280px] w-full">
          <label className={_labelCls}>Chat theme colour</label>
          <p className="text-[11px] font-google text-slate-500 dark:text-slate-400 mb-1.5">Header gradient, message bubbles, action buttons.</p>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={primaryColor}
              onChange={e => onPrimaryColorChange?.(e.target.value)}
              className={`${_inputCls} flex-1 uppercase font-mono text-xs`}
              placeholder="#5730F5"
            />
            <div
              className="w-10 h-10 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden cursor-pointer shrink-0"
              style={{ background: primaryColor }}
            >
              <input
                type="color"
                value={primaryColor}
                onChange={e => onPrimaryColorChange?.(e.target.value)}
                className="opacity-0 w-full h-full cursor-pointer"
                aria-label="Chat theme colour"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
