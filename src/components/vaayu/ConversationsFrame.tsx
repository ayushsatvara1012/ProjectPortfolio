import React from 'react';

/**
 * ConversationsFrame — Conversations & Insights visual.
 * A live transcript (alternating bubbles + typing dots) beside an insights
 * sidebar (top questions with mini bars, sentiment split, tags). The BI angle on
 * chat — a layout used nowhere else on the site.
 */

const TOPICS = [
  { w: 92, n: '214' },
  { w: 70, n: '168' },
  { w: 48, n: '97' },
];

export default function ConversationsFrame({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 480 360"
      role="img"
      aria-label="Conversation transcript with auto-summarized insights"
      className={`w-full h-auto ${className}`}
      preserveAspectRatio="xMidYMid meet"
    >
      <style>{`
        @keyframes vyType { 0%,60%,100% { opacity:.3 } 30% { opacity:1 } }
        .vy-t1 { animation: vyType 1.4s ease-in-out infinite; }
        .vy-t2 { animation: vyType 1.4s ease-in-out .2s infinite; }
        .vy-t3 { animation: vyType 1.4s ease-in-out .4s infinite; }
        @keyframes vyIn { from { opacity:0; transform: translateY(6px) } to { opacity:1; transform: translateY(0) } }
        .vy-msg { animation: vyIn .6s cubic-bezier(.22,1,.36,1) both; }
        @keyframes vyBar { from { transform: scaleX(0) } to { transform: scaleX(1) } }
        .vy-ibar { transform-origin: left; animation: vyBar .9s cubic-bezier(.22,1,.36,1) both; }
      `}</style>

      <rect x="1" y="1" width="478" height="358" rx="18"
        className="fill-white dark:fill-slate-950 stroke-slate-200 dark:stroke-slate-800" strokeWidth="1.5" />

      {/* ── Transcript column ── */}
      <text x="24" y="34" className="fill-slate-900 dark:fill-white" fontSize="15" fontWeight="600" fontFamily="sans-serif">Conversation</text>
      <circle cx="150" cy="29" r="3" fill="#22C55E" />
      <text x="160" y="33" className="fill-slate-400 dark:fill-slate-500" fontSize="9" fontFamily="sans-serif">active</text>

      {/* bot bubble */}
      <g className="vy-msg" style={{ animationDelay: '0s' }}>
        <circle cx="34" cy="64" r="11" fill="#004DE8" opacity="0.14" />
        <path d="M30 60 C30 56 33 54 37 54 C35 58 34 59 32 62 C35 60 37 59 40 56 C40 60 37 63 33 63 C35 60 36 59 38 57 C35 59 33 60 30 60 Z" fill="#004DE8" />
        <rect x="52" y="54" width="150" height="46" rx="12" fill="#004DE8" opacity="0.08" />
        <rect x="64" y="66" width="118" height="6" rx="3" fill="#004DE8" opacity="0.4" />
        <rect x="64" y="80" width="96" height="6" rx="3" fill="#004DE8" opacity="0.25" />
      </g>

      {/* user bubble (right) */}
      <g className="vy-msg" style={{ animationDelay: '.15s' }}>
        <rect x="118" y="112" width="138" height="38" rx="12" className="fill-slate-100 dark:fill-slate-800" />
        <rect x="130" y="124" width="110" height="6" rx="3" className="fill-slate-400 dark:fill-slate-500" />
        <rect x="130" y="136" width="72" height="6" rx="3" className="fill-slate-300 dark:fill-slate-600" />
        <circle cx="272" cy="120" r="11" className="fill-slate-200 dark:fill-slate-700" />
      </g>

      {/* bot bubble 2 */}
      <g className="vy-msg" style={{ animationDelay: '.3s' }}>
        <circle cx="34" cy="178" r="11" fill="#004DE8" opacity="0.14" />
        <path d="M30 174 C30 170 33 168 37 168 C35 172 34 173 32 176 C35 174 37 173 40 170 C40 174 37 177 33 177 C35 174 36 173 38 171 C35 173 33 174 30 174 Z" fill="#004DE8" />
        <rect x="52" y="166" width="172" height="44" rx="12" fill="#004DE8" opacity="0.08" />
        <rect x="64" y="178" width="140" height="6" rx="3" fill="#004DE8" opacity="0.4" />
        <rect x="64" y="192" width="104" height="6" rx="3" fill="#004DE8" opacity="0.25" />
      </g>

      {/* typing indicator */}
      <g className="vy-msg" style={{ animationDelay: '.45s' }}>
        <rect x="52" y="224" width="58" height="26" rx="13" className="fill-slate-100 dark:fill-slate-800" />
        <circle cx="68" cy="237" r="3.5" className="fill-slate-400 dark:fill-slate-500 vy-t1" />
        <circle cx="81" cy="237" r="3.5" className="fill-slate-400 dark:fill-slate-500 vy-t2" />
        <circle cx="94" cy="237" r="3.5" className="fill-slate-400 dark:fill-slate-500 vy-t3" />
      </g>

      {/* input bar */}
      <rect x="24" y="312" width="248" height="30" rx="15" className="fill-white dark:fill-slate-900 stroke-slate-200 dark:stroke-slate-700" strokeWidth="1.4" />
      <rect x="40" y="324" width="120" height="6" rx="3" className="fill-slate-200 dark:fill-slate-700" />
      <circle cx="256" cy="327" r="11" fill="#004DE8" />
      <path d="M252 327 h7 M256 323 l4 4 l-4 4" fill="none" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />

      {/* ── Insights sidebar ── */}
      <line x1="300" y1="20" x2="300" y2="340" className="stroke-slate-100 dark:stroke-slate-800" strokeWidth="1.4" />
      <text x="320" y="42" className="fill-slate-400 dark:fill-slate-500" fontSize="9" letterSpacing="1" fontFamily="sans-serif">TOP QUESTIONS</text>
      {TOPICS.map((t, i) => {
        const y = 58 + i * 34;
        return (
          <g key={i}>
            <rect x="320" y={y} width={140} height="9" rx="4.5" className="fill-slate-700 dark:fill-slate-200" opacity={0.85 - i * 0.18} />
            <rect x="320" y={y + 16} width="120" height="7" rx="3.5" className="fill-slate-100 dark:fill-slate-800" />
            <rect x="320" y={y + 16} width={t.w} height="7" rx="3.5" fill="#004DE8" opacity={1 - i * 0.22}
              className="vy-ibar" style={{ animationDelay: `${0.2 + i * 0.12}s` }} />
            <text x="460" y={y + 8} className="fill-slate-400 dark:fill-slate-500" fontSize="8.5" textAnchor="end" fontFamily="sans-serif">{t.n}</text>
          </g>
        );
      })}

      {/* sentiment */}
      <text x="320" y="186" className="fill-slate-400 dark:fill-slate-500" fontSize="9" letterSpacing="1" fontFamily="sans-serif">SENTIMENT</text>
      <rect x="320" y="196" width="140" height="14" rx="7" className="fill-slate-100 dark:fill-slate-800" />
      <rect x="320" y="196" width="96" height="14" rx="7" fill="#22C55E" className="vy-ibar" style={{ animationDelay: '.5s' }} />
      <rect x="416" y="196" width="30" height="14" className="fill-slate-300 dark:fill-slate-600 vy-ibar" style={{ animationDelay: '.6s' }} />
      <text x="320" y="228" fill="#16A34A" fontSize="9" fontWeight="700" fontFamily="sans-serif">68% positive</text>
      <text x="460" y="228" className="fill-slate-400 dark:fill-slate-500" fontSize="9" textAnchor="end" fontFamily="sans-serif">21% neutral</text>

      {/* auto tags */}
      <text x="320" y="262" className="fill-slate-400 dark:fill-slate-500" fontSize="9" letterSpacing="1" fontFamily="sans-serif">AUTO-TAGGED</text>
      {[
        { x: 320, w: 60, label: 'pricing' },
        { x: 386, w: 56, label: 'refund' },
        { x: 320, w: 78, label: 'shipping', y2: true },
      ].map((tag, i) => (
        <g key={i} transform={`translate(${tag.x} ${tag.y2 ? 298 : 272})`}>
          <rect x="0" y="0" width={tag.w} height="20" rx="10" fill="#004DE8" opacity="0.1" />
          <text x={tag.w / 2} y="14" fill="#004DE8" fontSize="9" fontWeight="600" textAnchor="middle" fontFamily="sans-serif">{tag.label}</text>
        </g>
      ))}
    </svg>
  );
}
