import React from 'react';
import CopyEmbed from './CopyEmbed';

/* One-line install section — the "paste one snippet" moment. */
export default function InstallStrip() {
  return (
    <section id="install" className="bg-[#FAFAFC] dark:bg-[#0B0F19] py-28 lg:py-32 transition-colors duration-500">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-[640px] text-center">
          <span className="text-[12.5px] font-semibold uppercase tracking-[0.14em] text-[#004DE8] dark:text-[#6E97FF]">One-line install</span>
          <h2 className="mt-4 font-google text-[29px] font-bold leading-[1.08] tracking-[-0.035em] text-[#0F172A] dark:text-[#F8FAFC] sm:text-4xl lg:text-[44px]">
            Live on your site in one line
          </h2>
          <p className="mt-4 font-google text-lg leading-relaxed text-[#475569] dark:text-[#94A3B8]">
            Copy one snippet into your HTML. That&apos;s the whole integration — no packages, no build step.
          </p>
        </div>
        <div className="mx-auto mt-11 max-w-[760px]">
          <CopyEmbed />
        </div>
      </div>
    </section>
  );
}
