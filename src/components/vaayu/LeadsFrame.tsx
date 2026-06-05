import React from 'react';

/**
 * LeadsFrame — Lead Capture & Scoring visual.
 * A captured-leads panel: avatar rows, source chips, an animated score ring per
 * lead, and a status dot. One hot lead is highlighted. Unique to this section.
 */

type Row = {
  initials: string;
  source: 'Chat' | 'Form';
  score: number;
  tone: 'hot' | 'warm' | 'cold';
  nameW: number;
  hot?: boolean;
};

const ROWS: Row[] = [
  { initials: 'AK', source: 'Chat', score: 92, tone: 'hot', nameW: 74, hot: true },
  { initials: 'RM', source: 'Form', score: 78, tone: 'warm', nameW: 58 },
  { initials: 'JP', source: 'Chat', score: 64, tone: 'warm', nameW: 66 },
  { initials: 'SD', source: 'Chat', score: 41, tone: 'cold', nameW: 50 },
];

const toneColor: Record<Row['tone'], string> = { hot: '#004DE8', warm: '#6366F1', cold: '#94A3B8' };
const dotColor: Record<Row['tone'], string> = { hot: '#22C55E', warm: '#EAB308', cold: '#94A3B8' };

export default function LeadsFrame({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 480 360"
      role="img"
      aria-label="Captured leads scored from hot to cold"
      className={`w-full h-auto ${className}`}
      preserveAspectRatio="xMidYMid meet"
    >
      <style>{`
        @keyframes vyRing { to { stroke-dashoffset: var(--vy-off); } }
        .vy-ring { stroke-dasharray: 126; stroke-dashoffset: 126; animation: vyRing 1.4s cubic-bezier(.22,1,.36,1) .2s forwards; }
        @keyframes vyGlow { 0%,100% { opacity:.5 } 50% { opacity:1 } }
        .vy-glow { animation: vyGlow 2.2s ease-in-out infinite; }
      `}</style>

      {/* Panel */}
      <rect x="1" y="1" width="478" height="358" rx="18"
        className="fill-white dark:fill-slate-950 stroke-slate-200 dark:stroke-slate-800" strokeWidth="1.5" />

      {/* Header */}
      <text x="24" y="38" className="fill-slate-900 dark:fill-white" fontSize="15" fontWeight="600" fontFamily="sans-serif">Leads</text>
      <rect x="372" y="22" width="84" height="22" rx="11" fill="#004DE8" opacity="0.1" />
      <circle cx="388" cy="33" r="3" fill="#004DE8" className="vy-glow" />
      <text x="397" y="36" fill="#004DE8" fontSize="9" fontWeight="600" fontFamily="sans-serif">12 new today</text>

      {/* Column labels */}
      <text x="24" y="68" className="fill-slate-400 dark:fill-slate-500" fontSize="9" fontFamily="sans-serif" letterSpacing="1">CONTACT</text>
      <text x="210" y="68" className="fill-slate-400 dark:fill-slate-500" fontSize="9" fontFamily="sans-serif" letterSpacing="1">SOURCE</text>
      <text x="396" y="68" className="fill-slate-400 dark:fill-slate-500" fontSize="9" fontFamily="sans-serif" letterSpacing="1">SCORE</text>
      <line x1="24" y1="78" x2="456" y2="78" className="stroke-slate-100 dark:stroke-slate-800" strokeWidth="1.2" />

      {ROWS.map((r, i) => {
        const y = 96 + i * 62;
        const cy = y + 22;
        const off = 126 - (126 * r.score) / 100;
        return (
          <g key={i}>
            {r.hot && (
              <rect x="12" y={y} width="456" height="50" rx="12" fill="#004DE8" opacity="0.06" />
            )}
            {r.hot && (
              <rect x="12" y={y} width="456" height="50" rx="12" fill="none" stroke="#004DE8" strokeOpacity="0.4" strokeWidth="1.4" />
            )}
            {/* avatar */}
            <circle cx="44" cy={cy} r="17" fill={toneColor[r.tone]} opacity="0.14" />
            <circle cx="44" cy={cy} r="17" fill="none" stroke={toneColor[r.tone]} strokeWidth="1.4" strokeOpacity="0.5" />
            <text x="44" y={cy + 4} fill={toneColor[r.tone]} fontSize="11" fontWeight="700" textAnchor="middle" fontFamily="sans-serif">{r.initials}</text>
            {/* name + email placeholders */}
            <rect x="72" y={cy - 11} width={r.nameW} height="9" rx="4.5" className="fill-slate-700 dark:fill-slate-200" />
            <rect x="72" y={cy + 3} width={r.nameW + 34} height="7" rx="3.5" className="fill-slate-200 dark:fill-slate-700" />
            {/* source chip */}
            <rect x="210" y={cy - 11} width="62" height="22" rx="11"
              className={r.source === 'Chat' ? '' : 'fill-slate-100 dark:fill-slate-800'}
              fill={r.source === 'Chat' ? '#004DE8' : undefined} opacity={r.source === 'Chat' ? 0.1 : 1} />
            <circle cx="224" cy={cy} r="3" fill={r.source === 'Chat' ? '#004DE8' : '#94A3B8'} />
            <text x="233" y={cy + 3.5} fontSize="9" fontWeight="600" fontFamily="sans-serif"
              className={r.source === 'Chat' ? '' : 'fill-slate-500 dark:fill-slate-400'}
              fill={r.source === 'Chat' ? '#004DE8' : undefined}>{r.source}</text>
            {/* status dot */}
            <circle cx="330" cy={cy} r="4" fill={dotColor[r.tone]} />
            <circle cx="330" cy={cy} r="7" fill={dotColor[r.tone]} opacity="0.18" />
            {/* score ring */}
            <circle cx="420" cy={cy} r="20" fill="none" className="stroke-slate-100 dark:stroke-slate-800" strokeWidth="5" />
            <circle cx="420" cy={cy} r="20" fill="none" stroke={toneColor[r.tone]} strokeWidth="5" strokeLinecap="round"
              transform={`rotate(-90 420 ${cy})`} className="vy-ring" style={{ ['--vy-off' as string]: String(off) }} />
            <text x="420" y={cy + 4} fill={toneColor[r.tone]} fontSize="12" fontWeight="700" textAnchor="middle" fontFamily="sans-serif">{r.score}</text>
          </g>
        );
      })}
    </svg>
  );
}
