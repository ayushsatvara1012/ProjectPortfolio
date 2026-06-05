import React from 'react';

/**
 * RoiFrame — ROI & Attribution visual.
 * A revenue card with an inline sparkline, a semicircular ROI gauge, and a
 * per-channel attribution breakdown. Currency-forward; shares no shapes with
 * the funnel, leads or conversation frames.
 */

const CHANNELS = [
  { name: 'Chat', val: '$31.4k', w: 196, delay: '.1s' },
  { name: 'Email follow-up', val: '$9.8k', w: 92, delay: '.22s' },
  { name: 'Direct', val: '$7.0k', w: 66, delay: '.34s' },
];

export default function RoiFrame({ className = '' }: { className?: string }) {
  // gauge: 6.4x mapped onto a 0–10x semicircle (radius 56)
  const pct = 6.4 / 10;
  const arc = Math.PI * 56; // semicircle length
  const off = arc - arc * pct;
  return (
    <svg
      viewBox="0 0 480 360"
      role="img"
      aria-label="Revenue attribution, ROI gauge and channel breakdown"
      className={`w-full h-auto ${className}`}
      preserveAspectRatio="xMidYMid meet"
    >
      <style>{`
        @keyframes vyGauge { to { stroke-dashoffset: var(--vy-goff); } }
        .vy-gauge { animation: vyGauge 1.6s cubic-bezier(.22,1,.36,1) .3s forwards; }
        @keyframes vySpark { to { stroke-dashoffset: 0; } }
        .vy-spark { stroke-dasharray: 240; stroke-dashoffset: 240; animation: vySpark 1.8s cubic-bezier(.22,1,.36,1) .2s forwards; }
        @keyframes vyGrow { from { transform: scaleX(0) } to { transform: scaleX(1) } }
        .vy-grow { transform-origin: left; animation: vyGrow .9s cubic-bezier(.22,1,.36,1) both; }
      `}</style>
      <defs>
        <linearGradient id="vyRoiSpark" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#004DE8" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#004DE8" stopOpacity="0" />
        </linearGradient>
      </defs>

      <rect x="1" y="1" width="478" height="358" rx="18"
        className="fill-white dark:fill-slate-950 stroke-slate-200 dark:stroke-slate-800" strokeWidth="1.5" />
      <text x="24" y="34" className="fill-slate-900 dark:fill-white" fontSize="15" fontWeight="600" fontFamily="sans-serif">Revenue attribution</text>

      {/* Revenue card with sparkline */}
      <rect x="24" y="52" width="256" height="140" rx="14" fill="#004DE8" opacity="0.06" />
      <rect x="24" y="52" width="256" height="140" rx="14" fill="none" stroke="#004DE8" strokeOpacity="0.25" strokeWidth="1.4" />
      <text x="42" y="80" className="fill-slate-500 dark:fill-slate-400" fontSize="10" fontFamily="sans-serif">Revenue attributed</text>
      <text x="42" y="112" fill="#004DE8" fontSize="30" fontWeight="800" fontFamily="sans-serif">$48.2k</text>
      <rect x="42" y="122" width="56" height="18" rx="9" fill="#22C55E" opacity="0.14" />
      <path d="M50 134 l4 -5 l4 5" fill="none" stroke="#16A34A" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <text x="62" y="135" fill="#16A34A" fontSize="9.5" fontWeight="700" fontFamily="sans-serif">+32%</text>
      {/* sparkline */}
      <path d="M44 178 L74 170 L104 174 L134 158 L164 164 L194 146 L224 152 L262 132 L262 184 L44 184 Z" fill="url(#vyRoiSpark)" />
      <path d="M44 178 L74 170 L104 174 L134 158 L164 164 L194 146 L224 152 L262 132"
        fill="none" stroke="#004DE8" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="vy-spark" />

      {/* ROI gauge */}
      <g transform="translate(372 150)">
        <path d="M-56 0 A56 56 0 0 1 56 0" fill="none" className="stroke-slate-100 dark:stroke-slate-800" strokeWidth="12" strokeLinecap="round" />
        <path d="M-56 0 A56 56 0 0 1 56 0" fill="none" stroke="#004DE8" strokeWidth="12" strokeLinecap="round"
          strokeDasharray={arc} strokeDashoffset={arc} className="vy-gauge" style={{ ['--vy-goff' as string]: String(off) }} />
        <text x="0" y="-6" className="fill-slate-900 dark:fill-white" fontSize="26" fontWeight="800" textAnchor="middle" fontFamily="sans-serif">6.4×</text>
        <text x="0" y="12" className="fill-slate-400 dark:fill-slate-500" fontSize="9" textAnchor="middle" fontFamily="sans-serif">return on spend</text>
      </g>

      {/* Channel breakdown */}
      <text x="24" y="228" className="fill-slate-400 dark:fill-slate-500" fontSize="9" letterSpacing="1" fontFamily="sans-serif">BY CHANNEL</text>
      {CHANNELS.map((c, i) => {
        const y = 244 + i * 36;
        return (
          <g key={i}>
            <text x="24" y={y + 11} className="fill-slate-700 dark:fill-slate-200" fontSize="10.5" fontFamily="sans-serif">{c.name}</text>
            <rect x="150" y={y} width="244" height="15" rx="7.5" className="fill-slate-100 dark:fill-slate-800" />
            <rect x="150" y={y} width={c.w} height="15" rx="7.5" fill="#004DE8" opacity={1 - i * 0.22}
              className="vy-grow" style={{ animationDelay: c.delay }} />
            <text x="456" y={y + 11} className="fill-slate-900 dark:fill-white" fontSize="10.5" fontWeight="700" textAnchor="end" fontFamily="sans-serif">{c.val}</text>
          </g>
        );
      })}
    </svg>
  );
}
