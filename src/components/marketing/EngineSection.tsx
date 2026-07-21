'use client';

import React from 'react';

const EngineSection = () => {
  return (
    <section className="relative w-full bg-white dark:bg-slate-950 py-12 sm:py-16 lg:py-16 min-h-[400px] sm:min-h-[500px] lg:min-h-[750px] overflow-hidden transition-colors duration-500 border-none shadow-none flex flex-col items-center justify-start">
      {/* Background Vector Overlay */}
      <div
        className="absolute inset-0 z-0 pointer-events-none select-none transition-opacity duration-500 opacity-100 overflow-hidden"
      >
        <img
          src="/vector_EngineBG.svg"
          alt=""
          aria-hidden="true"
          loading="lazy"
          decoding="async"
          className="absolute top-0 left-1/2 -translate-x-1/2 w-full min-w-[900px] h-full object-cover pointer-events-none select-none"
        />
      </div>
      {/* Decorative background illustration */}
      <img
        src="/vector_SBdesign2.svg"
        alt=""
        aria-hidden="true"
        loading="lazy"
        decoding="async"
        className="hidden lg:block absolute pointer-events-none select-none z-0 top-[-581px] left-[-131px] w-[667px] h-auto"
      />

      {/* Centered Top Heading */}
      <div className="max-w-5xl mx-auto px-6 text-center relative z-10 w-full mb-8 sm:mb-12 lg:mb-16">
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-google font-semibold tracking-tight text-slate-900 dark:text-white leading-tight">
          We Provide <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-cyan-600 dark:from-red-600 dark:to-yellow-400">RAG </span>Engine
        </h2>
        <p className="font-google text-base sm:text-lg lg:text-xl font-normal text-slate-600 dark:text-slate-100 max-w-2xl mx-auto mt-4 transition-colors duration-300 ease-in-out tracking-widest">TRAINED ON YOUR DOCS · GROUNDED IN YOUR DATA</p>
      </div>

      {/* Centered Grouped SVGs Container */}
      <div className="relative z-10 w-full max-w-7xl mx-auto px-6 flex flex-col lg:flex-row items-center justify-center gap-4 sm:gap-8 lg:gap-12 flex-1 mt-4 sm:mt-8">
        
        {/* Left Column */}
        <div className="w-full lg:w-auto flex justify-center items-center">
          <img
            src="/vector_SBengine.svg"
            alt="Vaayu Engine Vector"
            loading="lazy"
            decoding="async"
            className="w-full max-w-lg lg:max-w-[700px] h-auto object-contain transition-all duration-500 drop-shadow-[0_20px_50px_rgba(0,0,0,0.08)] dark:drop-shadow-[0_20px_50px_rgba(255,255,255,0.03)]"
          />
        </div>

        {/* Right Column */}
        <div className="w-full lg:w-auto flex justify-center items-center">
          <img
            src="/vector_chat.svg"
            alt="Vaayu Chat Vector"
            loading="lazy"
            decoding="async"
            className="w-full max-w-[320px] sm:max-w-md lg:max-w-[450px] h-auto object-contain transition-all duration-500 drop-shadow-[0_20px_50px_rgba(0,0,0,0.08)] dark:drop-shadow-[0_20px_50px_rgba(255,255,255,0.03)]"
          />
        </div>

      </div>

    </section>
  );
};

export default EngineSection;
