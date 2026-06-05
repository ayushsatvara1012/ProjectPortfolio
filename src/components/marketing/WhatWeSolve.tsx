'use client';

import React, { useEffect, useState, useRef } from 'react';

const textItems = [
  {
    id: '1',
    title: "Customers leaving at midnight with questions you can't answer",
  },
  {
    id: '2',
    title: "Visitors abandoning your site because no one responded",
  },
  {
    id: '3',
    title: "Losing sales to competitors who replied faster",
  },
  {
    id: '4',
    title: "Your team drowning in the same five questions every day",
  },
  {
    id: '5',
    title: "Leads slipping away because nobody captured their contact",
  },
];

const WhatWeSolve = () => {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const intersectingMap = new Map<number, boolean>();

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const index = itemRefs.current.findIndex(el => el === entry.target);
          if (index !== -1) {
            intersectingMap.set(index, entry.isIntersecting);
          }
        });

        // Find the active index from the intersecting ones
        let activeIdx: number | null = null;
        for (let i = 0; i < textItems.length; i++) {
          if (intersectingMap.get(i)) {
            activeIdx = i;
            break; // take the first one that intersects
          }
        }
        setActiveIndex(activeIdx);
      },
      {
        rootMargin: '-40% 0px -40% 0px',
        threshold: 0,
      }
    );

    itemRefs.current.forEach((el) => {
      if (el) observer.observe(el);
    });

    return () => {
      observer.disconnect();
    };
  }, []);

  return (
    <section className="relative w-full bg-white dark:bg-slate-950 py-10 lg:py-12 overflow-hidden transition-colors duration-500 border-none shadow-none">
      {/* Immersive Full-Screen SVG Background Container */}
      <div className="absolute inset-0 z-0 pointer-events-none select-none overflow-hidden">
        <div className="absolute inset-0 w-full h-full flex items-center justify-center opacity-15 sm:opacity-20 lg:opacity-100 transition-opacity duration-500">
          <div className="absolute inset-0 bg-red-500/5 dark:bg-red-600/10  rounded-full p-5 blur-[100px] scale-100 lg:scale-90" />
          <img
            src="/vector_WWS.svg"
            alt="Friction Points Background"
            loading="lazy"
            decoding="async"
            className="w-full h-full object-cover object-left lg:object-center relative z-10 drop-shadow-[0_20px_50px_rgba(0,0,0,0.08)] dark:drop-shadow-[0_20px_50px_rgba(255,255,255,0.03)]"
          />
        </div>
      </div>

      {/* Content Container - Padded to keep text beautifully formatted */}
      <div className="max-w-8xl mx-auto px-6 sm:px-12 lg:px-12 xl:px-20 relative z-10">
        <div className="flex justify-end">

          {/* Right Column Content strictly occupying the Right End on Desktop */}
          <div className="w-full lg:w-[50%] xl:w-[52%] flex flex-col justify-center">

            {/* Title & Text Header Section */}
            <div className="mb-12">

              <h2 className="text-4xl sm:text-5xl lg:text-6xl font-google font-medium tracking-tight text-slate-900 dark:text-white mb-6 leading-none">
                Every missed question is a&nbsp;
                <span className="text-transparent bg-clip-text bg-linear-to-r from-red-600 to-orange-600 dark:from-red-500 dark:to-orange-400">
                  missed sale.
                </span>
              </h2>
              <p className="text-base md:text-lg font-google text-slate-800 dark:text-slate-200 leading-relaxed max-w-xl">
                Most AI chatbots make things up. Vaayu only answers from your actual content — so customers get accurate answers, and you never have to apologize for wrong information again.
              </p>
            </div>

            {/* List of Pain Points */}
            <div className="flex flex-col">
              {textItems.map((item, index) => (
                <div
                  key={item.id}
                  ref={(el) => {
                    itemRefs.current[index] = el;
                  }}
                  className={`group relative transition-colors duration-300 ${index !== textItems.length - 1
                    ? 'border-b border-slate-200 dark:border-slate-800'
                    : ''
                    }`}
                >
                  <div className="py-6 sm:py-6 flex items-center justify-start md:pl-10">
                    <h3
                      className={`text-xl sm:text-2xl font-google font-medium transition-colors duration-300 ${activeIndex === index
                          ? 'text-red-600 dark:text-red-400'
                          : 'text-slate-800 dark:text-slate-200'
                        }`}
                    >
                      {item.title}
                    </h3>
                  </div>
                </div>
              ))}
            </div>

          </div>

        </div>
      </div>
    </section>
  );
};

export default WhatWeSolve;
