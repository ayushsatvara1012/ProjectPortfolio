'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { AVATAR_GRADIENTS, FAB_SHAPES, SHAPE_CLASS_MAP } from './avatar/AvatarShared';

const IS_DEV = process.env.NODE_ENV === 'development';
const ASSET_BASE_URL = IS_DEV ? '' : 'https://www.sapybase.com';

// ── Shape catalogue (for shape picker UI) ─────────────────────────────────────
export const SHAPES = [
  {
    id: 'circle',
    label: 'Circle',
    twClass: 'rounded-full',
    icon: (
      <svg viewBox="0 0 100 100" className="w-14 h-14" fill="currentColor">
        <path d={FAB_SHAPES.circle.path} />
      </svg>
    ),
  },
  {
    id: 'squircle',
    label: 'Squircle',
    twClass: 'rounded-[2rem]',
    icon: (
      <svg viewBox="0 0 100 100" className="w-14 h-14" fill="currentColor">
        <path d={FAB_SHAPES.squircle.path} />
      </svg>
    ),
  },
  {
    id: 'bento',
    label: 'Bento',
    twClass: 'rounded-2xl',
    icon: (
      <svg viewBox="0 0 100 100" className="w-14 h-14" fill="currentColor">
        <path d={FAB_SHAPES.bento.path} />
      </svg>
    ),
  },
  {
    id: 'sharp',
    label: 'Sharp',
    twClass: 'rounded-lg',
    icon: (
      <svg viewBox="0 0 100 100" className="w-14 h-14" fill="currentColor">
        <path d={FAB_SHAPES.sharp.path} />
      </svg>
    ),
  },
];



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

  const gradient = bgStyle && bgStyle !== 'none' ? AVATAR_GRADIENTS[bgStyle] : null;
  const showImage = !!(logoUrl && logoUrl.trim() && !imgFailed);
  const useFallback = !showImage || !isCustom;
  const FallbackLogoUrl = `${ASSET_BASE_URL}/logo2.svg`;

  // L1 fill: white backdrop when fallback logo is shown, otherwise themeColor or gradient or transparent
  const baseFill = useFallback
    ? '#ffffff'
    : (gradient ? `url(#${uid}-grad)` : (transparentBgImage ? 'transparent' : themeColor));

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
            <rect x="0" y="0" width="100" height="100" fill={transparentBgImage ? 'transparent' : '#f8fafc'} />
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
  const fabShape = FAB_SHAPES[shapeId] || FAB_SHAPES.circle;
  const FAB_PATH = fabShape.path;
  const THEME_COLOR = themeColor || '#5730F5';
  const BOT_NAME = botName || 'S';
  const gradient = bgStyle && bgStyle !== 'none' ? AVATAR_GRADIENTS[bgStyle] : null;
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
              : THEME_COLOR
        }
        className={
          !gradient && !useFallback
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
            <rect x="0" y="0" width="100" height="100" fill="#f8fafc" />
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
  logoShape: string;
  customLogoUrl: string;
  primaryColor: string;
  botName: string;
  isProUser: boolean;
  onShapeChange: (shapeId: string) => void;
  onUrlChange: (url: string) => void;
  avatarBgStyle: string;
  onBgStyleChange: (styleId: string) => void;
  onPrimaryColorChange: (val: string) => void;
};

export default function LogoCustomizer({
  logoShape,
  customLogoUrl,
  primaryColor,
  botName,
  isProUser,
  onShapeChange,
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

  const labelCls = 'block text-lg font-semibold font-google text-slate-600 dark:text-slate-400 mb-1.5 transition-colors';
  const inputCls = 'w-full text-md font-google px-3 py-2.5 bg-transparent border border-gray-300 dark:border-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-900/20 dark:focus:ring-blue-500/50 focus:border-slate-400 dark:focus:border-blue-400 text-slate-900 dark:text-slate-200 transition-colors rounded-sm';

  return (
    <div className="space-y-6">
      {/* ── Live Shape Preview ── */}
      <div className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800">
        <FabWidgetPreview
          shapeId={logoShape}
          logoUrl={(!urlError && urlInput) ? urlInput : customLogoUrl}
          botName={botName}
          themeColor={primaryColor}
          bgStyle={avatarBgStyle}
          isCustomUrl={!!customLogoUrl}
        />
        <div className="flex flex-1 items-center gap-4 ml-2">
          <input
            type="text"
            value={primaryColor}
            onChange={e => onPrimaryColorChange?.(e.target.value)}
            className={`${inputCls} flex-1 uppercase`}
            placeholder="#5730F5"
          />
          <div
            className="w-12 h-12 border border-gray-200 dark:border-slate-700 overflow-hidden cursor-pointer shrink-0 rounded-none bg-slate-100 dark:bg-slate-900 transition-colors"
            style={{ background: primaryColor }}
          >
            <input
              type="color"
              value={primaryColor}
              onChange={e => onPrimaryColorChange?.(e.target.value)}
              className="opacity-0 w-full h-full cursor-pointer"
            />
          </div>
        </div>
      </div>

      {/* ── Shape Picker ── */}
      <div>
        <label className={labelCls + ' flex items-center'}>
          Bot Avatar Shape
          {!isProUser && (
            <span className="ml-2 px-1.5 py-0.5 bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 text-[9px] rounded-full border border-amber-200 dark:border-amber-800">
              Pro+
            </span>
          )}
        </label>

        <div className="grid grid-cols-4 gap-4 py-2">
          {SHAPES.map(shape => {
            const isSelected = logoShape === shape.id;
            return (
              <button
                key={shape.id}
                type="button"
                onClick={() => onShapeChange(shape.id)}
                disabled={!isProUser}
                className={`
                  group relative flex flex-col items-center gap-3 transition-all duration-300
                  ${!isProUser ? 'opacity-40 cursor-not-allowed' : ''}
                `}
                title={shape.label}
              >
                <div className={`
                  flex items-center justify-center transition-all duration-300
                  ${isSelected
                    ? 'text-blue-500 dark:text-blue-400 scale-110 drop-shadow-[0_8px_16px_rgba(59,130,246,0.25)]'
                    : 'text-slate-300 dark:text-slate-700 group-hover:text-slate-400 dark:group-hover:text-slate-500 group-hover:scale-105'
                  }
                `}>
                  {shape.icon}
                  {isSelected && (
                    <div className="absolute -top-1 -right-1 bg-white dark:bg-slate-900 rounded-full">
                      <span className="material-symbols-outlined text-[16px] text-blue-500 dark:text-blue-400 block p-0.5">
                        check_circle
                      </span>
                    </div>
                  )}
                </div>
                <span className={`text-md font-medium font-sans transition-colors ${isSelected ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400'}`}>
                  {shape.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Background Style ── */}
      <div>
        <label className={labelCls}>
          Avatar Background
          {!isProUser && (
            <span className="ml-2 px-1.5 py-0.5 bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 text-[9px] rounded-full border border-amber-200 dark:border-amber-800">
              Pro+
            </span>
          )}
        </label>
        <p className="text-md text-slate-400 dark:text-slate-500 font-google leading-relaxed mb-3">
          Premium gradients for transparent logo URLs.
        </p>

        <div className="flex flex-wrap gap-6 py-2">
          {Object.entries(AVATAR_GRADIENTS).map(([baseId, gradData]) => {
            const isSelected = (avatarBgStyle || 'none') === baseId;
            const hasGradient = gradData !== null;

            return (
              <button
                key={baseId}
                type="button"
                onClick={() => onBgStyleChange(baseId)}
                disabled={!isProUser}
                className={`
                  group relative flex flex-col items-center gap-2 transition-all duration-300
                  ${!isProUser ? 'opacity-40 cursor-not-allowed' : ''}
                `}
                title={`${baseId} gradient`}
              >
                <div className={`
                  w-10 h-10 rounded-full transition-all duration-300 flex items-center justify-center
                  ${isSelected ? 'ring-2 ring-offset-2 ring-blue-500 dark:ring-blue-400 scale-110 drop-shadow-md' : 'ring-1 ring-gray-200 dark:ring-slate-700 hover:scale-105 hover:ring-slate-300 dark:hover:ring-slate-500'}
                  ${!hasGradient ? 'bg-white dark:bg-slate-900' : ''}
                `}
                  style={hasGradient ? { background: `linear-gradient(135deg, ${gradData[0]}, ${gradData[1]})` } : {}}
                >
                  {!hasGradient && <span className="material-symbols-outlined text-[16px] text-slate-400">block</span>}
                  {isSelected && hasGradient && (
                    <span className="material-symbols-outlined text-[18px] text-white drop-shadow-sm font-bold">check</span>
                  )}
                </div>
                <span className={`text-sm font-normal font-google transition-colors ${isSelected ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400'}`}>
                  {baseId}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Custom Logo URL (PRO GATE) ── */}
      <div className="relative">
        <label className={labelCls}>
          Custom Logo URL
          {!isProUser && (
            <span className="ml-2 px-1.5 py-0.5 bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 text-[9px] rounded-full border border-amber-200 dark:border-amber-800">
              Pro only
            </span>
          )}
        </label>

        {!isProUser ? (
          <div className="relative">
            <div className={`${inputCls} opacity-40 pointer-events-none select-none`}>
              https://your-domain.com/logo.png
            </div>
            <div className="absolute inset-0 flex items-center justify-center bg-white/60 dark:bg-slate-950/60 backdrop-blur-[1px]">
              <Link
                href="/dashboard/pricing"
                className="flex items-center gap-1.5 px-3 py-1.5 bg-linear-to-r from-blue-600 to-green-600 text-white text-sm font-medium font-sans hover:opacity-90 transition-all shadow-sm"
              >
                <span className="material-symbols-outlined text-[12px]">lock</span>
                Upgrade to Pro
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[16px] text-slate-400 dark:text-slate-500">
                link
              </span>
              <input
                type="url"
                value={urlInput}
                onChange={handleUrlChange}
                onBlur={handleUrlBlur}
                placeholder="https://your-domain.com/logo.png"
                className={`${inputCls} pl-9 pr-10 ${urlError ? 'border-red-300 dark:border-red-700 focus:ring-red-300' : ''}`}
                autoComplete="off"
                spellCheck="false"
              />
              {urlInput && (
                <span
                  className={`material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-[16px] ${urlError ? 'text-red-500' : 'text-emerald-500'}`}
                >
                  {urlError ? 'error' : 'check_circle'}
                </span>
              )}
            </div>

            {urlError && (
              <div className="flex items-start gap-2 px-3 py-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50">
                <span className="material-symbols-outlined text-[14px] text-red-500 shrink-0 mt-0.5">warning</span>
                <p className="text-[10px] text-red-700 dark:text-red-300 font-sans leading-relaxed">{urlError}</p>
              </div>
            )}

            <div className="space-y-1.5 px-1">
              <p className="text-sm text-slate-400 dark:text-slate-500 font-google leading-relaxed">
                <span className="font-bold">Requirements:</span> Must be a public HTTPS URL serving an image (PNG, JPG, SVG, or WebP) under 2 MB.
              </p>
            </div>

            {urlInput && (
              <button
                type="button"
                onClick={() => {
                  setUrlInput('');
                  setUrlError(null);
                  onUrlChange('');
                }}
                className="flex items-center gap-1 text-md font-medium text-red-500 hover:text-red-700 transition-colors font-sans"
              >
                <span className="material-symbols-outlined text-[12px]">close</span>
                Clear logo URL
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
