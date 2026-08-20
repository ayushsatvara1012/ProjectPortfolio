'use client';

import React from 'react';

export default function AgentShowcaseSection() {
  return (
    <section className="relative py-16 sm:py-24 overflow-hidden transition-colors duration-500 text-slate-900 dark:text-slate-100">
      <div className="relative z-10 max-w-7xl mx-auto px-6 sm:px-8 lg:px-12">
        {/* Main Section Header */}
        <h2 className="mb-12 lg:mb-16 text-center font-google font-medium tracking-tight leading-[1.1] text-4xl sm:text-5xl lg:text-6xl text-slate-900 dark:text-white">
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
    </section>
  );
}
