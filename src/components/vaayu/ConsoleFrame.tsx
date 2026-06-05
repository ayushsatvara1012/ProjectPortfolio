import React from 'react';

/**
 * ConsoleFrame — the hero "product shot" for /vaayu.
 *
 * A full app-window mock of the Vaayu console: window chrome, left nav rail,
 * top bar, a KPI stat row, a gradient area chart (animated draw), a weekly bar
 * cluster, and a live-conversation ticker. Built from scratch — does NOT reuse
 * any other illustration on the site. Theme-aware via Tailwind classes.
 */
export default function ConsoleFrame({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 760 480"
      role="img"
      aria-label="Vaayu console: live overview of leads, funnel and revenue"
      className={`w-full h-auto ${className}`}
      preserveAspectRatio="xMidYMid meet"
    >
      <style>{`
        @keyframes vyDraw { to { stroke-dashoffset: 0; } }
        @keyframes vyRise { from { transform: scaleY(0); } to { transform: scaleY(1); } }
        @keyframes vyPulse { 0%,100% { opacity: .35; } 50% { opacity: 1; } }
        @keyframes vyFloat { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
        .vy-line { stroke-dasharray: 620; stroke-dashoffset: 620; animation: vyDraw 2.4s cubic-bezier(.22,1,.36,1) .3s forwards; }
        .vy-bar { transform-origin: bottom; animation: vyRise .9s cubic-bezier(.22,1,.36,1) forwards; }
        .vy-dot { animation: vyPulse 2s ease-in-out infinite; }
        .vy-chip { animation: vyFloat 4s ease-in-out infinite; }
      `}</style>

      <defs>
        <linearGradient id="vyArea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#004DE8" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#004DE8" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="vyMark" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#3B82F6" />
          <stop offset="100%" stopColor="#002B82" />
        </linearGradient>
      </defs>

      {/* Window shell */}
      <rect x="1" y="1" width="758" height="478" rx="20"
        className="fill-white dark:fill-slate-950 stroke-slate-200 dark:stroke-slate-800" strokeWidth="1.5" />
      {/* Title bar */}
      <path d="M1 21 a20 20 0 0 1 20 -20 h718 a20 20 0 0 1 20 20 v20 H1 Z"
        className="fill-slate-50 dark:fill-slate-900" />
      <line x1="1" y1="41" x2="759" y2="41" className="stroke-slate-200 dark:stroke-slate-800" strokeWidth="1.5" />
      <circle cx="24" cy="21" r="5" className="fill-slate-300 dark:fill-slate-700" />
      <circle cx="42" cy="21" r="5" className="fill-slate-300 dark:fill-slate-700" />
      <circle cx="60" cy="21" r="5" className="fill-slate-300 dark:fill-slate-700" />
      <rect x="300" y="13" width="160" height="16" rx="8" className="fill-slate-100 dark:fill-slate-800" />
      <text x="316" y="25" className="fill-slate-400 dark:fill-slate-500" fontSize="9" fontFamily="sans-serif">app.vaayu.io/overview</text>

      {/* Left nav rail */}
      <rect x="1" y="42" width="150" height="437" className="fill-slate-50/60 dark:fill-slate-900/50" />
      <line x1="151" y1="42" x2="151" y2="479" className="stroke-slate-200 dark:stroke-slate-800" strokeWidth="1.5" />
      {/* logo mark */}
      <g transform="translate(22 64)">
        <path d="M2 14 C2 6 8 2 16 2 C12 8 10 10 6 16 C12 13 16 11 22 6 C22 14 16 20 8 20 C12 14 14 12 18 7 C12 11 8 13 2 14 Z"
          fill="url(#vyMark)" />
        <text x="34" y="16" className="fill-slate-900 dark:fill-white" fontSize="15" fontWeight="600" fontFamily="sans-serif">Vaayu</text>
      </g>
      {/* nav items */}
      {[
        { y: 116, w: 70, active: true },
        { y: 152, w: 52 },
        { y: 188, w: 60 },
        { y: 224, w: 44 },
        { y: 260, w: 78 },
      ].map((it, i) => (
        <g key={i}>
          {it.active && <rect x="14" y={it.y - 13} width="124" height="30" rx="9" fill="#004DE8" opacity="0.1" />}
          <rect x="26" y={it.y - 5} width="11" height="11" rx="3"
            className={it.active ? '' : 'fill-slate-300 dark:fill-slate-600'}
            fill={it.active ? '#004DE8' : undefined} />
          <rect x="48" y={it.y - 4} width={it.w} height="8" rx="4"
            className={it.active ? '' : 'fill-slate-200 dark:fill-slate-700'}
            fill={it.active ? '#004DE8' : undefined} opacity={it.active ? 0.8 : 1} />
        </g>
      ))}
      {/* nav footer avatar */}
      <circle cx="32" cy="452" r="11" className="fill-slate-200 dark:fill-slate-700" />
      <rect x="50" y="448" width="60" height="8" rx="4" className="fill-slate-200 dark:fill-slate-700" />

      {/* Top bar of main area */}
      <text x="172" y="76" className="fill-slate-900 dark:fill-white" fontSize="16" fontWeight="600" fontFamily="sans-serif">Overview</text>
      <text x="172" y="94" className="fill-slate-400 dark:fill-slate-500" fontSize="10" fontFamily="sans-serif">Last 30 days</text>
      <g className="vy-chip">
        <rect x="560" y="62" width="178" height="30" rx="9" fill="#004DE8" opacity="0.08" />
        <circle cx="578" cy="77" r="3.5" fill="#22C55E" className="vy-dot" />
        <text x="590" y="80" fill="#004DE8" fontSize="9.5" fontWeight="600" fontFamily="sans-serif">3 conversations live now</text>
      </g>

      {/* KPI stat row */}
      {[
        { x: 172, label: 'Leads captured', val: '540', sub: '+18%' },
        { x: 364, label: 'Conv. rate', val: '24.7%', sub: '+4.1%' },
        { x: 556, label: 'Revenue', val: '$48.2k', sub: '+32%' },
      ].map((c, i) => (
        <g key={i}>
          <rect x={c.x} y="108" width="166" height="78" rx="13"
            className="fill-white dark:fill-slate-900/60 stroke-slate-200 dark:stroke-slate-800" strokeWidth="1.5" />
          <text x={c.x + 16} y="130" className="fill-slate-400 dark:fill-slate-500" fontSize="9.5" fontFamily="sans-serif">{c.label}</text>
          <text x={c.x + 16} y="158" className="fill-slate-900 dark:fill-white" fontSize="22" fontWeight="700" fontFamily="sans-serif">{c.val}</text>
          <rect x={c.x + 16} y="166" width="42" height="14" rx="7" fill="#22C55E" opacity="0.12" />
          <text x={c.x + 23} y="176" fill="#16A34A" fontSize="8.5" fontWeight="600" fontFamily="sans-serif">{c.sub}</text>
        </g>
      ))}

      {/* Area chart card */}
      <rect x="172" y="202" width="358" height="258" rx="13"
        className="fill-white dark:fill-slate-900/60 stroke-slate-200 dark:stroke-slate-800" strokeWidth="1.5" />
      <text x="190" y="228" className="fill-slate-900 dark:fill-white" fontSize="12" fontWeight="600" fontFamily="sans-serif">Revenue attributed</text>
      <text x="190" y="244" className="fill-slate-400 dark:fill-slate-500" fontSize="9" fontFamily="sans-serif">traced from chat → sale</text>
      {/* gridlines */}
      {[280, 330, 380, 430].map((y) => (
        <line key={y} x1="190" y1={y} x2="512" y2={y} className="stroke-slate-100 dark:stroke-slate-800/60" strokeWidth="1" strokeDasharray="3 4" />
      ))}
      {/* area + line */}
      <path d="M190 410 L228 392 L266 400 L304 360 L342 372 L380 322 L418 332 L456 286 L494 300 L512 268 L512 432 L190 432 Z"
        fill="url(#vyArea)" />
      <path d="M190 410 L228 392 L266 400 L304 360 L342 372 L380 322 L418 332 L456 286 L494 300 L512 268"
        fill="none" stroke="#004DE8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="vy-line" />
      <circle cx="512" cy="268" r="4.5" fill="#004DE8" />
      <circle cx="512" cy="268" r="8" fill="#004DE8" opacity="0.18" className="vy-dot" />

      {/* Weekly bars card */}
      <rect x="546" y="202" width="192" height="258" rx="13"
        className="fill-white dark:fill-slate-900/60 stroke-slate-200 dark:stroke-slate-800" strokeWidth="1.5" />
      <text x="564" y="228" className="fill-slate-900 dark:fill-white" fontSize="12" fontWeight="600" fontFamily="sans-serif">Leads / week</text>
      {[
        { x: 566, h: 70, d: '.10s', tone: 'fill-slate-200 dark:fill-slate-700' },
        { x: 598, h: 110, d: '.20s', tone: 'fill-slate-300 dark:fill-slate-600' },
        { x: 630, h: 88, d: '.30s', tone: 'fill-slate-200 dark:fill-slate-700' },
        { x: 662, h: 138, d: '.45s', tone: 'accent' },
        { x: 694, h: 120, d: '.55s', tone: 'fill-slate-200 dark:fill-slate-700' },
      ].map((b, i) => (
        <rect key={i} x={b.x} y={430 - b.h} width="20" height={b.h} rx="6"
          className={`vy-bar ${b.tone === 'accent' ? '' : b.tone}`}
          fill={b.tone === 'accent' ? '#004DE8' : undefined}
          style={{ animationDelay: b.d }} />
      ))}
    </svg>
  );
}
