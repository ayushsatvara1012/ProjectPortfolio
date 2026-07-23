import React from 'react';

/* Big split showcase — a dark BI-console panel (revenue + funnel) beside a short
   heading. Mirrors the "one product moment, lots of space" reference layout. */

const funnel = [
  { label: 'Visitors', value: '2,410', width: '100%', opacity: 'opacity-100' },
  { label: 'Chats started', value: '880', width: '66%', opacity: 'opacity-90' },
  { label: 'Leads captured', value: '216', width: '40%', opacity: 'opacity-75' },
];

export default function ConsoleShowcase() {
  return (
    <section id="console" className="bg-[#FAFAFC] dark:bg-[#0B0F19] py-28 lg:py-32 transition-colors duration-500">
      <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-10 px-6 lg:grid-cols-[1.35fr_0.65fr] lg:gap-14">
        {/* Dark console panel */}
        <div className="relative min-h-[320px] overflow-hidden rounded-[22px] bg-[radial-gradient(130%_130%_at_15%_10%,#1d2740,#12121b_60%)] p-7 sm:p-8 shadow-[0_16px_44px_-22px_rgba(26,25,20,0.4)]">
          <div className="relative text-[#E9EAF2]">
            <div className="text-[12px] text-[#E9EAF2]/60">Attributed revenue · last 30 days</div>
            <div className="mt-1 text-[38px] font-bold tracking-[-0.03em] tabular-nums text-white">
              $18,940<span className="ml-2.5 text-[13px] font-semibold text-[#5FD3A0]">▲ 34%</span>
            </div>
            <div className="mt-6 flex flex-col gap-2.5">
              {funnel.map((f) => (
                <div key={f.label}>
                  <div className="mb-1.5 flex justify-between text-[12px] text-[#E9EAF2]/70">
                    <span>{f.label}</span>
                    <span className="font-mono">{f.value}</span>
                  </div>
                  <div className={`h-[9px] rounded-[5px] bg-[#6E97FF] ${f.opacity}`} style={{ width: f.width }} />
                </div>
              ))}
              <div>
                <div className="mb-1.5 flex justify-between text-[12px] text-[#E9EAF2]/70">
                  <span>Converted</span>
                  <span className="font-mono">37</span>
                </div>
                <div className="h-[9px] w-[18%] rounded-[5px] bg-[#5FD3A0]" />
              </div>
            </div>
          </div>
        </div>

        {/* Copy */}
        <div>
          <div className="mb-4 h-[30px] w-[30px] text-[#004DE8] dark:text-[#6E97FF]" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" className="h-full w-full">
              <path d="M4 20V10M9 20V4M14 20v-7M19 20V8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
          <h2 className="font-google text-2xl font-bold leading-[1.12] tracking-[-0.03em] text-[#0F172A] dark:text-[#F8FAFC] sm:text-[32px]">
            One console for the whole funnel
          </h2>
          <p className="mt-3.5 font-google text-[16.5px] leading-[1.55] text-[#475569] dark:text-[#94A3B8]">
            Visitors, chats, leads, conversions, and dollars — all in one BI console, updated in real time. Finally know exactly what your website chat is worth.
          </p>
        </div>
      </div>
    </section>
  );
}
