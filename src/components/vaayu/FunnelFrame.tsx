import React from 'react';

/**
 * FunnelFrame — Conversion Funnel visual.
 * A true converging funnel silhouette (4 trapezoid stages) with counts inside
 * and drop-off % badges in the gutter. A distinct shape language vs every other
 * frame on the page.
 */

const STAGES = [
  { name: 'Visitors', count: '8,420', wTop: 360, wBot: 250, opacity: 0.95, delay: '0s' },
  { name: 'Conversations', count: '2,180', wTop: 250, wBot: 150, opacity: 0.8, delay: '.12s' },
  { name: 'Leads', count: '540', wTop: 150, wBot: 80, opacity: 0.62, delay: '.24s' },
  { name: 'Sales', count: '96', wTop: 80, wBot: 40, opacity: 0.45, delay: '.36s' },
];

const DROPS = ['25.9%', '24.8%', '17.8%'];

export default function FunnelFrame({ className = '' }: { className?: string }) {
  const CX = 230;
  const H = 56;
  const GAP = 10;
  const y0 = 50;
  return (
    <svg
      viewBox="0 0 480 360"
      role="img"
      aria-label="Conversion funnel from visitors to sales with drop-off rates"
      className={`w-full h-auto ${className}`}
      preserveAspectRatio="xMidYMid meet"
    >
      <style>{`
        @keyframes vyFunnel { from { opacity:0; transform: translateY(10px) } to { opacity:1; transform: translateY(0) } }
        .vy-stage { animation: vyFunnel .7s cubic-bezier(.22,1,.36,1) both; }
      `}</style>
      <defs>
        <linearGradient id="vyFunnelG" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3B82F6" />
          <stop offset="100%" stopColor="#002B82" />
        </linearGradient>
      </defs>

      <rect x="1" y="1" width="478" height="358" rx="18"
        className="fill-white dark:fill-slate-950 stroke-slate-200 dark:stroke-slate-800" strokeWidth="1.5" />
      <text x="24" y="34" className="fill-slate-900 dark:fill-white" fontSize="15" fontWeight="600" fontFamily="sans-serif">Conversion funnel</text>

      {STAGES.map((s, i) => {
        const y = y0 + i * (H + GAP);
        const tl = CX - s.wTop / 2, tr = CX + s.wTop / 2;
        const bl = CX - s.wBot / 2, br = CX + s.wBot / 2;
        return (
          <g key={i} className="vy-stage" style={{ animationDelay: s.delay }}>
            <polygon points={`${tl},${y} ${tr},${y} ${br},${y + H} ${bl},${y + H}`}
              fill="url(#vyFunnelG)" opacity={s.opacity} />
            <text x={CX} y={y + H / 2 - 1} fill="#ffffff" fontSize="11" fontWeight="600" textAnchor="middle" fontFamily="sans-serif">{s.name}</text>
            <text x={CX} y={y + H / 2 + 15} fill="#ffffff" fontSize="14" fontWeight="700" textAnchor="middle" fontFamily="sans-serif" opacity="0.95">{s.count}</text>
            {/* drop-off badge in gutter */}
            {i < STAGES.length - 1 && (
              <g transform={`translate(424 ${y + H + GAP / 2})`}>
                <line x1="-12" y1="0" x2="-176" y2="0" className="stroke-slate-200 dark:stroke-slate-800" strokeWidth="1.2" strokeDasharray="2 4" />
                <rect x="-2" y="-12" width="52" height="24" rx="12" className="fill-slate-50 dark:fill-slate-900 stroke-slate-200 dark:stroke-slate-800" strokeWidth="1.2" />
                <path d="M8 -3 l4 5 l4 -5" fill="none" stroke="#004DE8" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                <text x="22" y="4" fill="#004DE8" fontSize="9.5" fontWeight="700" fontFamily="sans-serif">{DROPS[i]}</text>
              </g>
            )}
          </g>
        );
      })}

      {/* baseline summary */}
      <line x1="24" y1="318" x2="456" y2="318" className="stroke-slate-100 dark:stroke-slate-800" strokeWidth="1.2" />
      <circle cx="30" cy="338" r="3" fill="#004DE8" />
      <text x="40" y="342" className="fill-slate-500 dark:fill-slate-400" fontSize="10" fontFamily="sans-serif">Visitor → sale</text>
      <text x="456" y="342" className="fill-slate-900 dark:fill-white" fontSize="11" fontWeight="700" textAnchor="end" fontFamily="sans-serif">1.14% end-to-end</text>
    </svg>
  );
}
