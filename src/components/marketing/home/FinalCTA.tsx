import React from 'react';
import Link from 'next/link';

/* Calm closing CTA — doodle + short line + two buttons, on the warm ground. */
export default function FinalCTA() {
  return (
    <section className="bg-[#FAF9F5] dark:bg-[#14130E] py-28 lg:py-32 text-center transition-colors duration-500">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto mb-6 h-[62px] w-[74px] text-[#1A1914] dark:text-[#F5F3EB]" aria-hidden="true">
          <svg viewBox="0 0 78 66" fill="none" className="h-full w-full">
            <path d="M8 30c0-11 9-19 24-19s26 7 26 19-11 18-26 18c-4 0-7-.4-10-1.2L9 52l3-9.5C9.6 39.6 8 35 8 30Z" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" />
            <path d="M23 27c6-3 13-3 20 0M23 34c5-2.4 11-2.4 15 0" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
            <path d="M60 14c4-1.5 7 .5 6.5 4.2M63 8.5c2.6 3 2 6-1 7.6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>
        <h2 className="mx-auto max-w-[17ch] font-google text-[32px] font-bold leading-[1.05] tracking-[-0.04em] text-[#1A1914] dark:text-[#F5F3EB] sm:text-5xl lg:text-[54px]">
          Give your website an intelligence that sells.
        </h2>
        <p className="mt-5 font-google text-lg text-[#57544B] dark:text-[#ABA79A]">
          Point Vaayu at your content, paste one line, and watch the leads roll in.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3.5">
          <Link
            href="/vaayu"
            className="inline-flex items-center rounded-full bg-[#004DE8] dark:bg-[#3E6BE0] px-7 py-3.5 font-google text-base font-semibold text-white transition-all duration-200 hover:bg-[#002B82] dark:hover:bg-[#2E5FD6] hover:-translate-y-0.5"
          >
            Get Vaayu free
          </Link>
          <Link
            href="/contact"
            className="inline-flex items-center rounded-full border border-[#D9D4C6] dark:border-[#37342A] px-7 py-3.5 font-google text-base font-semibold text-[#1A1914] dark:text-[#F5F3EB] transition-all duration-200 hover:border-[#928E82] dark:hover:border-[#706C61] hover:-translate-y-0.5"
          >
            Book a demo
          </Link>
        </div>
      </div>
    </section>
  );
}
