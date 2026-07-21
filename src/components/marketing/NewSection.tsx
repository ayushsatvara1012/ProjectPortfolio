'use client';

import React, { useRef, useEffect } from 'react';

const features = [
  {
    icon: '/up_arrow_icon.svg',
    title: 'Trained on your stuff, not the internet',
    body: 'Upload your docs, website, and spreadsheets. The bot learns your business — no generic answers.',
  },
  {
    icon: '/hexa_icon.svg',
    title: 'Never makes things up',
    body: "If the answer isn't in your data, it says so and hands off to your team. No hallucinated policies.",
  },
  {
    icon: '/chat_icon.svg',
    title: 'Remembers the conversation',
    body: 'Knows what "it" and "that one" mean three messages in. Customers don\'t have to repeat themselves.',
  },
  {
    icon: '/time_icon.svg',
    title: 'Live in under 10 minutes',
    body: 'Drop in one line of code. Match your brand colors and logo. Done — no engineers required.',
  },
];

const NewSection = () => {
  const sectionRef = useRef<HTMLElement>(null);
  const ragRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const onScrollOrResize = () => {
      if (window.innerWidth < 1024) {
        if (ragRef.current) {
          ragRef.current.style.opacity = '1';
        }
        return;
      }

      const rect = section.getBoundingClientRect();
      const vh = window.innerHeight;
      // How much of the section is visible as a fraction 0→1
      const visible = Math.max(0, Math.min(1, (vh - rect.top) / rect.height));
      // Start fading in at 30%, fully visible at 55%
      const opacity = Math.max(0, Math.min(1, (visible - 0.7) / 0.25));
      if (ragRef.current) {
        ragRef.current.style.opacity = (opacity * 0.4).toString();
      }
    };

    window.addEventListener('scroll', onScrollOrResize, { passive: true });
    window.addEventListener('resize', onScrollOrResize, { passive: true });
    onScrollOrResize();
    return () => {
      window.removeEventListener('scroll', onScrollOrResize);
      window.removeEventListener('resize', onScrollOrResize);
    };
  }, []);

  return (
    <section ref={sectionRef} className="relative w-full min-h-screen flex items-center">
      <div className="w-full max-w-7xl mx-auto px-6 md:px-12 lg:px-20 grid grid-cols-1 lg:grid-cols-[35%_65%] gap-12 py-10 lg:py-12">

        {/* Left column — AntigravityBackground travels here */}
        <div className="flex items-center justify-center">
          <div
            ref={ragRef}
            className="font-google text-2xl sm:text-3xl lg:text-4xl leading-tight tracking-tight text-slate-900 dark:text-white select-none pointer-events-none text-center lg:text-left flex flex-col items-center lg:items-start opacity-100 lg:opacity-0"
            style={{ transition: 'opacity 0.4s ease-out' }}
          >
            <span>An agent that never hallucinates and always answer based on your data.</span>
            <span className="text-slate-500 text-base mt-4 lg:self-end">"RAG - Retrieval Augmented Generation"</span>
          </div>
        </div>

        {/* Right column — content */}
        <div className="flex flex-col justify-center gap-8">
          <div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-google font-semibold tracking-tight text-slate-900 dark:text-white leading-tight mb-4">
              A chatbot that actually knows your business
            </h2>
            <p className="text-xl font-google font-regular text-slate-500 dark:text-slate-400 leading-relaxed max-w-lg">
              Trained on your content. Speaks in your voice. Honest when it doesn't know something.
            </p>
          </div>

          <ol className="flex flex-col gap-5 list-none">
            {features.map((f, idx) => (
              <li key={idx} className="flex items-start gap-4">
                <div className="shrink-0 w-12 h-12 flex items-center justify-center">
                  <img src={f.icon} alt="" className="w-10 h-10 object-contain" />
                </div>
                <div className="flex flex-col gap-1 min-w-0">
                  <p className="font-google font-medium text-xl text-slate-900 dark:text-white leading-snug">
                    {f.title}
                  </p>
                  <p className="font-google font-regular text-base text-slate-500 dark:text-slate-400 leading-relaxed">
                    {f.body}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>

      </div>
    </section>
  );
};

export default NewSection;
