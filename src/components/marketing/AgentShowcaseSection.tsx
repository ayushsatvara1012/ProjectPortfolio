'use client';

import React from 'react';

export default function AgentShowcaseSection() {
  return (
    <section className="relative py-16 sm:py-24 overflow-hidden transition-colors duration-500 text-slate-900 dark:text-slate-100">
      <div className="relative z-10 max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 space-y-24 lg:space-y-32">
        {/* Showcase Block 1: Customer Chat */}
        <div>
          {/* Main Section Header */}
          <h2 className="mb-12 lg:mb-16 text-center font-google font-medium tracking-tight leading-[1.1] text-4xl sm:text-5xl lg:text-5xl text-slate-900 dark:text-white">
            The way to handle customers with our chat
          </h2>

          {/* 2-Column Showcase Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
            {/* Left Column: Text & Description (spans ~40%) */}
            <div className="lg:col-span-5 flex flex-col justify-center space-y-6 text-left">
              <h3 className="font-google font-semibold tracking-tight text-3xl sm:text-4xl lg:text-4xl text-slate-900 dark:text-slate-100 leading-[1.15]">
                Built to handle your customer conversations end-to-end
              </h3>

              <p className="font-google text-base sm:text-lg text-slate-600 dark:text-slate-300 leading-relaxed">
                From answering routine inquiries and scheduling appointments to capturing high-intent leads 24/7, Vaayu seamlessly grounds every response in your business knowledge without manual intervention.
              </p>
            </div>

            {/* Right Column: Clean Frame with gen_chat.svg (spans ~60%) */}
            <div className="lg:col-span-7 w-full flex items-center justify-center">
              <div className="relative w-full overflow-hidden flex items-center justify-center">
                {/* SVG Illustration with no background and no drop shadow */}
                <img
                  src="/gen_chat.svg"
                  alt="Vaayu Generic Chatbot Customer Conversation"
                  className="w-full h-auto block max-w-full"
                  width={723}
                  height={542}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Showcase Block 2: Chemical Industry Tools */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
          {/* Left Column on Desktop (Image): Order 2 on Mobile, Order 1 on Desktop */}
          <div className="order-2 lg:order-1 lg:col-span-7 w-full flex items-center justify-center">
            <div className="relative w-full overflow-hidden flex items-center justify-center">
              <img
                src="/chem_chat.svg"
                alt="Chemical Industry Chatbot Tools"
                className="w-full h-auto block max-w-full"
                width={723}
                height={542}
              />
            </div>
          </div>

          {/* Right Column on Desktop (Text): Order 1 on Mobile, Order 2 on Desktop */}
          <div className="order-1 lg:order-2 lg:col-span-5 flex flex-col justify-center space-y-6 text-left">
            <h3 className="font-google font-semibold tracking-tight text-3xl sm:text-4xl lg:text-4xl text-slate-900 dark:text-slate-100 leading-[1.15]">
              Custom tools built for the chemical industry to make workflow smoother
            </h3>

            <p className="font-google text-base sm:text-lg text-slate-600 dark:text-slate-300 leading-relaxed">
              Instantly deliver Certificates of Analysis (COA), Safety Data Sheets (SDS), technical specifications, and custom quotes. Vaayu automates chemical industry compliance inquiries and product sample requests 24/7 with zero manual effort.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
