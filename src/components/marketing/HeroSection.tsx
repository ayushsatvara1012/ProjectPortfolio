'use client';

import React, { useState, useEffect } from 'react';
import Button from './Button';
import { useUser, useClerk } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import AntigravityBackground from './AntigravityBackground';

const TYPEWRITER_WORDS = ['E-commerce stores', 'SaaS companies', 'Local businesses', 'Service agencies'];
const TYPING_SPEED = 80;
const DELETING_SPEED = 50;
const PAUSE_AFTER_TYPE = 1800;
const PAUSE_AFTER_DELETE = 400;

const HeroSection = () => {
  const router = useRouter();
  const { isSignedIn } = useUser();
  const { openSignUp } = useClerk();

  const [displayText, setDisplayText] = useState('');
  const [wordIndex, setWordIndex] = useState(0);
  const [phase, setPhase] = useState<'typing' | 'deleting'>('typing');
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    handleResize();
    window.addEventListener('resize', handleResize, { passive: true });
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const currentWord = TYPEWRITER_WORDS[wordIndex];
    let timeout: NodeJS.Timeout;

    if (phase === 'typing') {
      if (displayText.length < currentWord.length) {
        timeout = setTimeout(() => {
          setDisplayText(currentWord.slice(0, displayText.length + 1));
        }, TYPING_SPEED);
      } else {
        timeout = setTimeout(() => setPhase('deleting'), PAUSE_AFTER_TYPE);
      }
    } else if (phase === 'deleting') {
      if (displayText.length > 0) {
        timeout = setTimeout(() => {
          setDisplayText(prev => prev.slice(0, -1));
        }, DELETING_SPEED);
      } else {
        timeout = setTimeout(() => {
          setWordIndex(i => (i + 1) % TYPEWRITER_WORDS.length);
          setPhase('typing');
        }, PAUSE_AFTER_DELETE);
      }
    }

    return () => clearTimeout(timeout);
  }, [displayText, phase, wordIndex]);

  return (
    <section id="home" className="relative min-h-screen bg-white dark:bg-slate-950 pt-16 lg:pt-20 overflow-x-clip transition-colors duration-500">

      {/* ── UNIFIED SINGLE HERO CONTAINER ──────────────── */}
      <AntigravityBackground
        particleCount={isMobile ? 100 : 50}
        particleType={isMobile ? 'dot' : 'capsule'}
        particleSeparation={isMobile ? 2 : 4}
      />
      <div className="max-w-8xl mx-auto w-full min-h-[calc(100vh-4rem)] lg:min-h-[calc(100vh-5rem)] bg-transparent relative overflow-hidden flex flex-col items-center justify-center px-6 sm:px-12 lg:px-20 py-12 lg:py-12 transition-colors duration-500 border-none shadow-none">

        {/* Text and controls centered */}
        <div className="relative z-10 max-w-xl lg:max-w-3xl flex flex-col justify-center items-center text-center">

          <h1 
            className="text-5xl sm:text-6xl md:text-7xl font-google font-medium tracking-tight leading-none text-slate-900 dark:text-slate-200 mb-6 transition-colors"
            aria-label="Your site answers every question 24/7 for businesses, SaaS companies, local businesses, and service agencies"
          >
            <span aria-hidden="true">
              Your site answers every question 24/7
              for {' '} <br />
              <span className="inline-block relative">
                <span className="text-transparent bg-clip-text bg-linear-to-r from-blue-700 to-blue-500">
                  {displayText}
                </span>
                <span
                  className="inline-block w-[3px] h-[0.85em] ml-1 align-middle bg-blue-500 dark:bg-blue-400 rounded-sm"
                  style={{
                    animation: 'caretBlink 1s step-start infinite',
                    verticalAlign: 'middle',
                  }}
                />
              </span>
            </span>
          </h1>

          <p className="text-base md:text-lg font-google text-slate-600 dark:text-slate-200 leading-relaxed max-w-xl mb-10 transition-colors mx-auto">
            Upload your website content or PDFs. Sapybase builds an AI agent that answers customer questions 24/7, captures leads automatically, and shows you exactly what it earned you — all without writing a single line of code.
          </p>

          <div className="flex flex-col sm:flex-row justify-center items-center gap-8 w-full transition-colors">
            <button
              onClick={() => isSignedIn ? router.push('/dashboard') : openSignUp()}
              className="overflow-hidden relative bg-slate-900 dark:bg-slate-900 text-lg font-google text-white border-none font-medium cursor-pointer z-10 group flex items-center justify-center px-8 py-4 rounded-full border border-slate-200/50 dark:border-slate-800"
            >
              Get Your Bot<span className='material-symbols-outlined ml-2'>arrow_forward</span>
              <span
                className="absolute w-40 h-32 -top-14 -left-2 bg-blue-200 rotate-12 transform scale-x-0 group-hover:scale-x-150 transition-transform group-hover:duration-500 duration-1000 origin-left"
              ></span>
              <span
                className="absolute w-40 h-36 -top-15 -left-2 bg-blue-600 rotate-12 transform scale-x-0 group-hover:scale-x-[120%] transition-transform group-hover:duration-700 duration-700 origin-left"
              ></span>
              <span
                className="absolute w-36 h-32 -top-8 -left-2 bg-blue-800 rotate-12 transform scale-x-0 group-hover:scale-x-75 transition-transform group-hover:duration-1000 duration-500 origin-left"
              ></span>
              <span
                className="group-hover:opacity-100 group-hover:duration-1000 duration-100 opacity-0 absolute left-6 z-10 whitespace-nowrap"
              >Explore Now!</span>
            </button>


            <Button onClick={() => router.push('/demo/train')} className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-8 py-4 text-lg font-google text-yellow-500 dark:text-yellow-400 hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors rounded-full flex items-center justify-center gap-1">
              <span className="material-symbols-outlined text-lg">
                experiment
              </span>
              Try Demo
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
