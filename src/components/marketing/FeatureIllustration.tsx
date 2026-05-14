'use client';

import React from 'react';

const FeatureIllustration = () => {
  return (
    <section className="relative w-full bg-white dark:bg-slate-950 pt-20 pb-16 overflow-hidden flex flex-col items-center justify-start transition-colors duration-500 border-none">
      {/* Blue radial gradient top-left background */}
      <div
        className="absolute inset-0 z-0 pointer-events-none select-none"
        style={{ background: 'radial-gradient(ellipse 55% 45% at 0% 0%, rgba(59,130,246,0.45) 0%, transparent 70%), radial-gradient(ellipse 55% 45% at 100% 0%, rgba(59,130,246,0.45) 0%, transparent 70%)' }}
      />

      {/* Decorative background illustration — adjust position/size as needed */}
      <img
        src="/vector_SBdesign2.svg"
        alt=""
        aria-hidden="true"
        className="absolute pointer-events-none select-none z-0"
        style={{ bottom: '-272px', left: '-131px', width: '667px', height: 'auto', opacity: 1 }}
      />

      {/* Feature Showcase Illustrations Container */}
      <div className="relative z-10 max-w-7xl mx-auto px-6 flex justify-center w-full mb-24 sm:mb-32 lg:mb-40">
        {/* Mobile Illustration */}
        <img
          src="/vector2_mobile.svg"
          alt="Feature Showcase Illustration Mobile"
          className="w-full h-auto max-w-7xl block min-[430px]:hidden drop-shadow-[0_10px_30px_rgba(0,0,0,0.1)] dark:drop-shadow-[0_10px_30px_rgba(0,0,0,0.4)]"
        />
        {/* Tablet Illustration */}
        <img
          src="/vector2_tablet.svg"
          alt="Feature Showcase Illustration Tablet"
          className="w-full h-auto max-w-7xl hidden min-[430px]:block lg:hidden drop-shadow-[0_10px_30px_rgba(0,0,0,0.1)] dark:drop-shadow-[0_10px_30px_rgba(0,0,0,0.4)]"
        />
        {/* Desktop Illustration */}
        <img
          src="/vector2.svg"
          alt="Feature Showcase Illustration Desktop"
          className="w-full h-auto max-w-7xl hidden lg:block drop-shadow-[0_10px_30px_rgba(0,0,0,0.1)] dark:drop-shadow-[0_10px_30px_rgba(0,0,0,0.4)]"
        />
      </div>
    </section>
  );
};

export default FeatureIllustration;
