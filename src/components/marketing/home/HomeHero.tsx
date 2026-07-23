import React from 'react';
import Link from 'next/link';

/* Hero — centered "Claude Console" editorial layout: hand-drawn doodle, calm headline,
   and a cobalt-tinted product panel with a dark chat console rising into it.
   Server Component (no interactivity) to keep it out of the client bundle / LCP path. */
export default function HomeHero() {
  return (
    <section
      id="home"
      className="relative bg-[#FAFAFC] dark:bg-[#0B0F19] pt-28 lg:pt-36 pb-0 overflow-x-clip transition-colors duration-500"
    >
      <div className="max-w-3xl mx-auto px-6 text-center">
        <div className="w-[74px] h-[62px] mx-auto mb-7 text-[#0F172A] dark:text-[#F8FAFC]" aria-hidden="true">
          <svg viewBox="0 0 78 66" fill="none" className="w-full h-full">
            <path d="M8 30c0-11 9-19 24-19s26 7 26 19-11 18-26 18c-4 0-7-.4-10-1.2L9 52l3-9.5C9.6 39.6 8 35 8 30Z" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" />
            <path d="M23 27c6-3 13-3 20 0M23 34c5-2.4 11-2.4 15 0" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
            <path d="M60 14c4-1.5 7 .5 6.5 4.2M63 8.5c2.6 3 2 6-1 7.6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>

        <h1 className="font-google font-bold tracking-[-0.04em] leading-[1.03] text-[#0F172A] dark:text-[#F8FAFC] text-[40px] sm:text-[54px] lg:text-[64px]">
          Give your website an
          <br />
          intelligence that <span className="text-[#004DE8] dark:text-[#6E97FF]">answers.</span>
        </h1>

        <p className="mx-auto mt-6 max-w-[34ch] font-google text-[#475569] dark:text-[#94A3B8] text-[17px] sm:text-lg leading-[1.55]">
          Vaayu learns your business, answers every customer 24/7, captures the leads, and shows you the revenue it earned.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3.5">
          <Link
            href="/vaayu"
            className="inline-flex items-center gap-2 rounded-full bg-[#004DE8] dark:bg-[#3E6BE0] px-7 py-3.5 text-base font-google font-semibold text-white transition-all duration-200 hover:bg-[#002B82] dark:hover:bg-[#2E5FD6] hover:-translate-y-0.5"
          >
            Get Vaayu free
          </Link>
          <a
            href="#console"
            className="inline-flex items-center gap-2 rounded-full border border-[#CBD5E1] dark:border-[#1E293B] px-7 py-3.5 text-base font-google font-semibold text-[#0F172A] dark:text-[#F8FAFC] transition-all duration-200 hover:border-[#94A3B8] dark:hover:border-[#475569] hover:-translate-y-0.5"
          >
            See the console
          </a>
        </div>

        <p className="mt-5 font-google text-[13.5px] text-[#64748B] dark:text-[#64748B]">
          Free forever tier · no credit card · live in 5 minutes
        </p>
      </div>

      {/* Tinted product showcase */}
      <div className="max-w-6xl mx-auto px-6 mt-16 sm:mt-[68px]">
        <div className="relative overflow-hidden rounded-t-[28px] rounded-b-none border border-b-0 border-[#CBD5E1] dark:border-[#1E293B] bg-[radial-gradient(120%_140%_at_50%_-10%,#EFF6FF,#DBEAFE)] dark:bg-[radial-gradient(120%_140%_at_50%_-10%,#0F172A,#1E293B)] px-5 sm:px-10 pt-8 sm:pt-14">
          <p className="relative mb-5 text-[13px] font-google font-semibold text-[#002B82]/80 dark:text-[#6E97FF]">
            Vaayu, answering a real customer — grounded in your documents
          </p>

          <div className="relative mx-auto max-w-[620px] rounded-t-[18px] border border-b-0 border-white/[0.06] bg-[#17161F] px-5 sm:px-6 pt-5 pb-8 text-left shadow-[0_30px_60px_-30px_rgba(0,0,20,0.55)]">
            <div className="mb-4 flex items-center gap-2" aria-hidden="true">
              <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
              <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
              <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
              <span className="ml-1.5 font-mono text-[11px] tracking-wider text-white/40">vaayu · live</span>
            </div>

            <div className="flex flex-col gap-3">
              <div className="ml-auto max-w-[88%] rounded-2xl rounded-br-md bg-white/[0.09] px-4 py-2.5 text-[14px] leading-relaxed text-[#EDECF5]">
                Do you ship the 5-litre solvent to Gujarat, and how long does it take?
              </div>
              <div className="max-w-[88%] rounded-2xl rounded-bl-md bg-[#004DE8] px-4 py-2.5 text-[14px] leading-relaxed text-white">
                Yes — the 5&nbsp;L grade ships to Gujarat in 2–3 business days. Bulk orders are quoted separately.
                <span className="mt-2.5 flex w-fit items-center gap-1.5 rounded-md bg-white/[0.16] px-2 py-1 text-[11.5px] text-white">
                  <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5" aria-hidden="true">
                    <rect x="4" y="4" width="16" height="16" rx="2.5" stroke="currentColor" strokeWidth="1.7" />
                    <path d="M8 9h8M8 13h5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                  </svg>
                  From your catalogue.pdf · p.12
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
