'use client';

import React from 'react';
import AntigravityBackground from './AntigravityBackground';

const features = [
  {
    title: 'Answers questions at 3am, 3pm, and every minute in between.',
    solves: 'nobody answering at midnight.',
    body: 'Your bot is always on. Customers get instant answers, you get a full night\'s sleep.',
  },
  {
    title: 'Closes the questions that close sales.',
    solves: 'customers leaving without buying.',
    body: '"What\'s your return policy?" "Do you ship to Canada?" "Is there a student discount?" — handled in one reply, before doubt creeps in.',
  },
  {
    title: 'Replies in seconds, not days.',
    solves: 'slow response times.',
    body: 'No tickets, no queues, no "we\'ll get back to you." Just answers.',
  },
  {
    title: 'Takes the repeat questions off your team\'s plate.',
    solves: 'support burden.',
    body: 'Your humans handle the hard stuff. The bot handles the same five questions asked fifty times a day.',
  },
  {
    title: 'Captures leads when it can\'t answer.',
    solves: 'missed revenue.',
    body: 'If a question is too specific, it grabs their email and routes it to your team. No conversation gets lost.',
  },
];

const FeatureIllustration = () => {
  return (
    <section className="relative w-full bg-white dark:bg-slate-950 px-6 py-20 md:px-12 md:py-28 lg:px-20 lg:py-22 overflow-hidden flex justify-center transition-colors duration-500">
      
      {/* Right-side half-screen background with seamless fade */}
      <div 
        className="absolute right-0 top-0 bottom-0 w-full lg:w-1/2 z-0 pointer-events-none"
        style={{
          maskImage: 'linear-gradient(to right, transparent, black 20%)',
          WebkitMaskImage: 'linear-gradient(to right, transparent, black 20%)'
        }}
      >
        <AntigravityBackground
          particleCount={100}
          particleType="dot"
          effectStyle="ripples"
          particleSeparation={0.5}
          speed={0.4}
          containerClassName="absolute inset-0 z-0 pointer-events-none opacity-60"
        />
      </div>

      {/* Content wrapper centered on screen, text on the left */}
      <div className="relative z-10 w-full max-w-7xl flex flex-col items-start text-left">
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-google font-medium tracking-tight text-slate-900 dark:text-white mb-16 max-w-2xl leading-tight">
          Hire one bot instead of ten more support agents
        </h2>

        <ol className="w-full max-w-2xl space-y-12 list-none">
          {features.map((feature, index) => (
            <li key={index} className="flex gap-8 items-start group">

              <div className="flex flex-col gap-2">
                <p className="font-google font-medium text-xl sm:text-xl text-slate-900 dark:text-white leading-tight">
                  {feature.title}
                </p>

                <p className="font-google text-sm font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-widest">
                  Solves: {feature.solves}
                </p>

                <p className="font-google text-lg text-slate-600 dark:text-slate-400 leading-relaxed mt-2">
                  {feature.body}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </div>

    </section>
  );
};

export default FeatureIllustration;
