'use client';

import React from 'react';

// Real moments a business owner lives through — the "Sound familiar?" hook.
// `quote` (when present) is the customer's question, emphasized inline.
const scenarios: { before: string; quote?: string; after?: string }[] = [
  {
    before: "It's 11pm. A customer asks ",
    quote: '“do you ship to my area?”',
    after: " — you're asleep, and by morning they've bought somewhere else.",
  },
  {
    before: "You've answered ",
    quote: '“what time do you close?”',
    after: ' for the tenth time today, instead of doing real work.',
  },
  {
    before: 'Someone was ready to buy — then left because no one replied fast enough.',
  },
  {
    before: 'A visitor had one last question before paying, and nobody was there to answer it.',
  },
  {
    before: "A great lead came in over the weekend… and by Monday, they'd gone cold.",
  },
];

const FeatureIllustration = () => {
  return (
    <section className="relative w-full px-6 py-20 md:px-12 md:py-28 lg:px-20 lg:py-22 flex justify-center">

      {/* Left-aligned content column; the particle glide occupies the right. */}
      <div className="relative z-10 w-full max-w-7xl flex flex-col items-start text-left">

        {/* Small heading */}
        <h2 className="font-google text-2xl sm:text-3xl font-medium tracking-tight text-slate-900 dark:text-white mb-10">
          Sound familiar?
        </h2>

        {/* Numbered editorial list */}
        <ol className="w-full max-w-2xl list-none">
          {scenarios.map((s, index) => (
            <li
              key={index}
              className="flex items-start gap-5 sm:gap-7 py-5 sm:py-6 border-b border-slate-100 dark:border-slate-900"
            >
              <span className="shrink-0 pt-1 font-google text-sm font-semibold tabular-nums text-slate-300 dark:text-slate-700">
                {String(index + 1).padStart(2, '0')}
              </span>
              <p className="font-google text-lg sm:text-xl leading-relaxed text-slate-700 dark:text-slate-300">
                {s.before}
                {s.quote && (
                  <em className="not-italic font-medium text-slate-900 dark:text-white">
                    {s.quote}
                  </em>
                )}
                {s.after}
              </p>
            </li>
          ))}
        </ol>

        {/* Highlighted closing — gradient-blue, no box */}
        <p className="mt-10 max-w-2xl font-google text-2xl sm:text-3xl font-medium leading-snug tracking-tight">
          <span className="text-transparent bg-clip-text bg-linear-to-r from-blue-700 to-blue-500 dark:from-blue-500 dark:to-blue-400">
            Vaayu catches every one of these — answering instantly, in your words, and capturing the lead before it&rsquo;s gone.
          </span>
        </p>

      </div>

    </section>
  );
};

export default FeatureIllustration;
