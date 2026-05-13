'use client';

import React from 'react';

const EngineSection = () => {
  return (
    <section className="relative w-full bg-white dark:bg-slate-950 py-12 sm:py-16 lg:py-24 min-h-[400px] sm:min-h-[500px] lg:min-h-[750px] overflow-hidden transition-colors duration-500 border-none shadow-none flex flex-col items-center justify-start">
      {/* Centered Top Heading */}
      <div className="max-w-5xl mx-auto px-6 text-center relative z-10 w-full mb-8 sm:mb-12 lg:mb-16">
        <h2 className="text-4xl sm:text-5xl lg:text-6xl font-google font-black tracking-tight text-slate-900 dark:text-white leading-none">
          We Provide <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-cyan-600 dark:from-blue-500 dark:to-cyan-400">RAG Engine</span>
        </h2>
        <p className="font-google text-base sm:text-lg lg:text-xl font-normal text-slate-500 dark:text-slate-400 max-w-2xl mx-auto mt-4 transition-colors duration-300 ease-in-out">A CHATBOT FOR WEBSITES</p>
      </div>

      {/* 60/40 Split Container */}
      <div className="relative z-10 w-full max-w-7xl mx-auto px-6 flex flex-col lg:flex-row items-center justify-between gap-8 sm:gap-12 flex-1 mt-4 sm:mt-8">
        
        {/* Left Column - 60% */}
        <div className="w-full lg:w-[60%] flex flex-col justify-center">
          {/* Empty left column as requested */}
        </div>

        {/* Right Column - 40% */}
        <div className="w-full lg:w-[40%] flex justify-center items-center">
          <img
            src="/vector_chat.svg"
            alt="Sapybase Chat Vector"
            className="w-full max-w-sm sm:max-w-md lg:max-w-full h-auto object-contain transition-all duration-500 drop-shadow-[0_20px_50px_rgba(0,0,0,0.08)] dark:drop-shadow-[0_20px_50px_rgba(255,255,255,0.03)]"
          />
        </div>

      </div>

    </section>
  );
};

export default EngineSection;
