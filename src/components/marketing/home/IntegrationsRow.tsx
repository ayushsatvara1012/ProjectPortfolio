import React from 'react';

/* "Works where you already are" — real integrations only: the platforms Vaayu's
   one-line widget embeds on, plus the channels it reaches owners through.
   Monochrome glyphs (not brand logos) so nothing is misrepresented. */

type Chip = { label: string; icon: React.ReactNode };

const embedIcon = (d: React.ReactNode) => (
  <svg viewBox="0 0 24 24" fill="none" className="h-full w-full" aria-hidden="true">{d}</svg>
);

const chips: Chip[] = [
  { label: 'Next.js', icon: embedIcon(<><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.7" /><path d="M9 8v8l6-8v8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></>) },
  { label: 'React', icon: embedIcon(<><circle cx="12" cy="12" r="2" fill="currentColor" /><ellipse cx="12" cy="12" rx="9" ry="3.6" stroke="currentColor" strokeWidth="1.5" /><ellipse cx="12" cy="12" rx="9" ry="3.6" stroke="currentColor" strokeWidth="1.5" transform="rotate(60 12 12)" /><ellipse cx="12" cy="12" rx="9" ry="3.6" stroke="currentColor" strokeWidth="1.5" transform="rotate(120 12 12)" /></>) },
  { label: 'WordPress', icon: embedIcon(<><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.7" /><path d="M6 9l3 8 3-9 3 9 3-8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></>) },
  { label: 'Shopify', icon: embedIcon(<path d="M15 5c-2 0-3 1-3.5 2.5M8 7l-2 1 1 11 8 1 2-11-3-1" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />) },
  { label: 'Webflow', icon: embedIcon(<path d="M4 7l3 10 3-7 3 7 3-10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />) },
  { label: 'Plain HTML', icon: embedIcon(<path d="M9 8 5 12l4 4M15 8l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />) },
  { label: 'Slack', icon: embedIcon(<path d="M8 10a2 2 0 1 1 2-2v2H8zm0 2h2v2a2 2 0 1 1-2-2zm8-4a2 2 0 1 1 2 2h-2V8zm-2 0v2h-2a2 2 0 1 1 2-2z" fill="currentColor" />) },
  { label: 'WhatsApp', icon: embedIcon(<><path d="M4 20l1.5-4A8 8 0 1 1 9 19.5L4 20Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" /><path d="M9 9c0 3 3 6 6 6 1-1 1-1.5 0-2l-1.5-.6-1 1c-1-.4-2-1.4-2.4-2.4l1-1L10.5 8C10 7 9.5 8 9 9Z" fill="currentColor" /></>) },
  { label: 'Webhooks', icon: embedIcon(<><circle cx="8" cy="8" r="2.4" stroke="currentColor" strokeWidth="1.6" /><circle cx="17" cy="16" r="2.4" stroke="currentColor" strokeWidth="1.6" /><circle cx="6" cy="17" r="2.4" stroke="currentColor" strokeWidth="1.6" /><path d="M9.6 9.6 13 14M14.6 16H8.6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></>) },
];

export default function IntegrationsRow() {
  return (
    <section className="bg-[#FAFAFC] dark:bg-[#0B0F19] py-28 lg:py-32 text-center transition-colors duration-500">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-[640px]">
          <span className="text-[12.5px] font-semibold uppercase tracking-[0.14em] text-[#004DE8] dark:text-[#6E97FF]">Works where you already are</span>
          <h2 className="mt-4 font-google text-[29px] font-bold leading-[1.08] tracking-[-0.035em] text-[#0F172A] dark:text-[#F8FAFC] sm:text-4xl lg:text-[44px]">
            Drops into your site, talks to your team
          </h2>
          <p className="mt-4 font-google text-lg leading-relaxed text-[#475569] dark:text-[#94A3B8]">
            Embed on any platform, and Vaayu reaches you where you work.
          </p>
        </div>
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          {chips.map((c) => (
            <span
              key={c.label}
              className="inline-flex items-center gap-2.5 rounded-full border border-[#E2E8F0] dark:border-[#1E293B] bg-white dark:bg-[#111827] px-[18px] py-2.5 text-[14.5px] font-semibold text-[#0F172A] dark:text-[#F8FAFC] shadow-[0_6px_16px_-10px_rgba(26,25,20,0.14)]"
            >
              <span className="grid h-[18px] w-[18px] place-items-center text-[#004DE8] dark:text-[#6E97FF]">{c.icon}</span>
              {c.label}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
