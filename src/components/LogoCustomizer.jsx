import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';

// ── Shape catalogue ────────────────────────────────────────────────────────────
// Each entry defines the Tailwind class applied to the avatar container,
// a human label, and a unique id used for storage.
const SHAPES = [
    {
        id: 'circle',
        label: 'Circle',
        twClass: 'rounded-full',
        icon: (
            <svg viewBox="0 0 40 40" className="w-6 h-6" fill="currentColor">
                <circle cx="20" cy="20" r="18" />
            </svg>
        ),
    },
    {
        id: 'squircle',
        label: 'Squircle',
        twClass: 'rounded-[2rem]',
        icon: (
            <svg viewBox="0 0 40 40" className="w-6 h-6" fill="currentColor">
                <rect x="2" y="2" width="36" height="36" rx="14" ry="14" />
            </svg>
        ),
    },
    {
        id: 'bento',
        label: 'Bento',
        twClass: 'rounded-2xl',
        icon: (
            <svg viewBox="0 0 40 40" className="w-6 h-6" fill="currentColor">
                <rect x="2" y="2" width="36" height="36" rx="8" ry="8" />
            </svg>
        ),
    },
    {
        id: 'sharp',
        label: 'Sharp',
        twClass: 'rounded-lg',
        icon: (
            <svg viewBox="0 0 40 40" className="w-6 h-6" fill="currentColor">
                <rect x="2" y="2" width="36" height="36" rx="3" ry="3" />
            </svg>
        ),
    },
];

export const SHAPE_CLASS_MAP = Object.fromEntries(
    SHAPES.map(s => [s.id, s.twClass])
);

// ── Front-end URL pre-validation (does NOT hit backend) ────────────────────────
const BLOCKED_LOGO_HOSTS = [
    'cdn.discordapp.com',
    'media.discordapp.net',
    'files.slack.com',
    'media.giphy.com',
];

function preValidateUrl(url) {
    if (!url || !url.trim()) return null; // empty = cleared, no error

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

    return null; // ✓ passes front-end checks
}

// ── BotAvatar — shared between preview and live widget ────────────────────────
// Exported so BotPreview.jsx and chatWidget.jsx can both import it.
export function BotAvatar({ shapeId = 'circle', logoUrl = '', botName = 'S', size = 'md', themeColor = '#5730F5' }) {
    const [imgFailed, setImgFailed] = useState(false);
    const prevUrlRef = useRef(logoUrl);

    // Reset failed state whenever the URL changes so we try the new image
    useEffect(() => {
        if (logoUrl !== prevUrlRef.current) {
            setImgFailed(false);
            prevUrlRef.current = logoUrl;
        }
    }, [logoUrl]);

    const shapeClass = SHAPE_CLASS_MAP[shapeId] || 'rounded-full';
    const initial = (botName || 'S').charAt(0).toUpperCase();

    const sizeClasses = {
        sm: 'w-7 h-7 text-sm',
        md: 'w-10 h-10 text-lg',
        lg: 'w-14 h-14 text-2xl',
    };
    const sizeClass = sizeClasses[size] || sizeClasses.md;

    const showImage = logoUrl && logoUrl.trim() && !imgFailed;

    return (
        <div
            className={`${sizeClass} ${shapeClass} overflow-hidden flex items-center justify-center shrink-0 border border-gray-100 dark:border-slate-700 shadow-sm`}
            style={{ backgroundColor: showImage ? '#ffffff' : themeColor }}
        >
            {showImage ? (
                <img
                    src={logoUrl}
                    alt={`${botName} logo`}
                    className="w-full h-full object-cover bg-white"
                    onError={() => setImgFailed(true)}
                />
            ) : (
                <span
                    className="font-bold leading-none select-none"
                    style={{ color: '#ffffff', fontSize: size === 'lg' ? '1.5rem' : size === 'sm' ? '0.75rem' : '1rem' }}
                >
                    {initial}
                </span>
            )}
        </div>
    );
}

// ── LogoCustomizer — the full settings panel section ──────────────────────────
/**
 * Props:
 *   logoShape      {string}   current shape id  ('circle' | 'squircle' | 'bento' | 'sharp')
 *   customLogoUrl  {string}   current URL or ''
 *   primaryColor   {string}   hex color for fallback bg
 *   botName        {string}   used for fallback initial
 *   isProUser      {boolean}  whether the user has Pro/Enterprise tier
 *   onShapeChange  {fn}       (shapeId: string) => void
 *   onUrlChange    {fn}       (url: string) => void
 */
export default function LogoCustomizer({
    logoShape,
    customLogoUrl,
    primaryColor,
    botName,
    isProUser,
    onShapeChange,
    onUrlChange,
}) {
    const [urlInput, setUrlInput] = useState(customLogoUrl || '');
    const [urlError, setUrlError] = useState(null);

    // Sync external value → internal state (e.g. bot switch)
    useEffect(() => {
        setUrlInput(customLogoUrl || '');
        setUrlError(null);
    }, [customLogoUrl]);

    const handleUrlChange = (e) => {
        const val = e.target.value;
        setUrlInput(val);

        const err = preValidateUrl(val);
        setUrlError(err);

        // Only propagate upward when the value passes front-end validation
        if (!err) {
            onUrlChange(val);
        }
    };

    const handleUrlBlur = () => {
        // On blur, also propagate even if empty (allows clearing)
        if (!urlError) {
            onUrlChange(urlInput);
        }
    };

    const labelCls = "block text-[10px] font-sans uppercase tracking-widest font-bold text-slate-400 dark:text-slate-500 mb-1.5 transition-colors";
    const inputCls = "w-full px-3 py-2.5 bg-transparent border border-gray-100 dark:border-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-900/20 dark:focus:ring-blue-500/50 focus:border-slate-400 dark:focus:border-blue-400 text-sm text-slate-900 dark:text-slate-200 font-mono transition-colors";

    return (
        <div className="space-y-6">
            {/* ── Shape Picker ── */}
            <div>
                <label className={labelCls}>
                    Bot Avatar Shape
                    {!isProUser && (
                        <span className="ml-2 px-1.5 py-0.5 bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 text-[9px] rounded-full border border-amber-200 dark:border-amber-800">
                            Pro+
                        </span>
                    )}
                </label>

                <div className="grid grid-cols-4 gap-2">
                    {SHAPES.map(shape => {
                        const isSelected = logoShape === shape.id;
                        return (
                            <button
                                key={shape.id}
                                type="button"
                                onClick={() => onShapeChange(shape.id)}
                                disabled={!isProUser}
                                className={`
                                    flex flex-col items-center gap-2 p-3 border transition-all duration-200
                                    ${!isProUser ? 'opacity-40 cursor-not-allowed' : ''}
                                    ${isSelected
                                        ? 'border-slate-900 dark:border-blue-500 bg-slate-50 dark:bg-blue-900/20 text-slate-900 dark:text-blue-400'
                                        : 'border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-400 dark:text-slate-500 hover:border-slate-300 dark:hover:border-slate-600 hover:text-slate-700 dark:hover:text-slate-300'
                                    }
                                `}
                                title={shape.label}
                            >
                                {/* Shape icon */}
                                <div className={`w-8 h-8 flex items-center justify-center`}>
                                    {shape.icon}
                                </div>
                                <span className="text-[9px] uppercase tracking-widest font-bold font-sans">
                                    {shape.label}
                                </span>
                                {isSelected && (
                                    <span className="material-symbols-outlined text-[14px] text-blue-500 dark:text-blue-400 -mt-1">
                                        check_circle
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* ── Live Shape Preview ── */}
            <div className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800">
                <BotAvatar
                    shapeId={logoShape}
                    logoUrl={(!urlError && urlInput) ? urlInput : customLogoUrl}
                    botName={botName}
                    themeColor={primaryColor}
                    size="lg"
                />
                <div>
                    <p className="text-xs font-sans font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-0.5">
                        Live Shape Preview
                    </p>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 font-sans leading-relaxed">
                        {customLogoUrl && !urlError
                            ? 'Showing your custom logo'
                            : 'Showing initials fallback — add a logo URL below'}
                    </p>
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
                    /* Locked overlay for non-Pro users */
                    <div className="relative">
                        <div className={`${inputCls} opacity-40 pointer-events-none select-none`}>
                            https://your-domain.com/logo.png
                        </div>
                        <div className="absolute inset-0 flex items-center justify-center bg-white/60 dark:bg-slate-950/60 backdrop-blur-[1px]">
                            <Link
                                to="/app/pricing"
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-linear-to-r from-blue-600 to-green-600 text-white text-[10px] uppercase tracking-widest font-bold font-sans hover:opacity-90 transition-all shadow-sm"
                            >
                                <span className="material-symbols-outlined text-[12px]">lock</span>
                                Upgrade to Pro
                            </Link>
                        </div>
                    </div>
                ) : (
                    /* Active input for Pro users */
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
                                className={`${inputCls} pl-9 ${urlError ? 'border-red-300 dark:border-red-700 focus:ring-red-300' : ''}`}
                                autoComplete="off"
                                spellCheck="false"
                            />
                            {/* Inline status icon */}
                            {urlInput && (
                                <span
                                    className={`material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-[16px] ${
                                        urlError ? 'text-red-500' : 'text-emerald-500'
                                    }`}
                                >
                                    {urlError ? 'error' : 'check_circle'}
                                </span>
                            )}
                        </div>

                        {/* Error message */}
                        {urlError && (
                            <div className="flex items-start gap-2 px-3 py-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50">
                                <span className="material-symbols-outlined text-[14px] text-red-500 shrink-0 mt-0.5">warning</span>
                                <p className="text-[10px] text-red-700 dark:text-red-300 font-sans leading-relaxed">{urlError}</p>
                            </div>
                        )}

                        {/* Guidance notes */}
                        <div className="space-y-1.5 px-1">
                            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-sans leading-relaxed">
                                <span className="font-bold">Requirements:</span> Must be a public HTTPS URL serving an image (PNG, JPG, SVG, or WebP) under 2 MB. Your server must allow public access.
                            </p>
                            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-sans leading-relaxed">
                                <span className="font-bold text-amber-600 dark:text-amber-400">⚠ Avoid:</span> Discord, Slack, or Giphy links — they expire or require authentication. Use <span className="font-medium">Cloudinary, Imgur, or your own domain</span>.
                            </p>
                            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-sans leading-relaxed">
                                <span className="font-bold">Your responsibility:</span> Store the image in your own codebase or CDN. SaPyBase does not host or proxy images.
                            </p>
                        </div>

                        {/* Clear button */}
                        {urlInput && (
                            <button
                                type="button"
                                onClick={() => {
                                    setUrlInput('');
                                    setUrlError(null);
                                    onUrlChange('');
                                }}
                                className="flex items-center gap-1 text-[10px] text-red-500 hover:text-red-700 transition-colors font-sans font-bold uppercase tracking-widest"
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
