'use client';

import React, { useState, useEffect } from 'react';
import Button from './Button';
import { motion, AnimatePresence } from 'framer-motion';
import { useUser, useClerk } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
const TYPEWRITER_WORDS = ['Businesses', 'Freelancers', 'Portfolios'];
const TYPING_SPEED = 80;
const DELETING_SPEED = 50;
const PAUSE_AFTER_TYPE = 1800;
const PAUSE_AFTER_DELETE = 400;

const HeroSection = () => {
  const router = useRouter();
  const { isSignedIn } = useUser();
  const { openSignUp } = useClerk();
  const [view, setView] = useState<'train' | 'configure'>('configure');
  const [botColor, setBotColor] = useState('#0000FF');
  const [isTraining, setIsTraining] = useState(false);

  const [displayText, setDisplayText] = useState('');
  const [wordIndex, setWordIndex] = useState(0);
  const [phase, setPhase] = useState<'typing' | 'pausing' | 'deleting' | 'pause-before-type'>('typing');

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

  // Lifecycle for training indicator
  useEffect(() => {
    if (view === 'train') {
      setIsTraining(true);
      const timer = setTimeout(() => setIsTraining(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [view]);

  return (
    <section id="home" className="relative min-h-screen bg-white dark:bg-slate-950 pt-16 lg:pt-20 overflow-x-clip transition-colors duration-500">
      {/* ── UNIFIED SINGLE HERO CONTAINER ──────────────── */}
      <div className="max-w-8xl mx-auto w-full min-h-[calc(100vh-5rem)] bg-white dark:bg-slate-950 relative overflow-hidden flex flex-col justify-center px-6 sm:px-12 lg:px-20 py-12 lg:py-12 transition-colors duration-500 border-none shadow-none">
        
        {/* Background Vector Illustration on the right end */}
        <div className="absolute right-0 top-0 bottom-0 w-full lg:w-[60%] z-0 flex items-center justify-end pointer-events-none select-none overflow-hidden">
          <img
            src="/vector_hero.svg"
            alt="Hero Background Illustration"
            className="w-full h-full object-cover lg:object-contain object-right max-h-[850px] opacity-15 sm:opacity-20 lg:opacity-100 transition-opacity duration-500 drop-shadow-[0_20px_50px_rgba(0,0,0,0.15)] dark:drop-shadow-[0_20px_50px_rgba(0,0,0,0.5)]"
          />
        </div>

        {/* Text and controls on the left end */}
        <div className="relative z-10 max-w-xl lg:max-w-2xl flex flex-col justify-center">
          <div className="px-2 py-0.5 bg-gray-50 dark:bg-slate-900 text-xs uppercase tracking-widest font-bold text-slate-600 dark:text-slate-400 flex items-center gap-2 w-fit mb-8 rounded-none transition-colors">
            <span className="material-symbols-outlined text-[14px]">memory</span>
            Next-Gen AI Infrastructure
          </div>

          <h1 className="text-5xl md:text-7xl font-google font-black tracking-tight leading-none text-slate-900 dark:text-slate-200 mb-6 transition-colors">
            RAG_First <br /> <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-600 to-blue-600">AI Chat Engine</span> <br />
            for {' '}
            <span className="inline-block relative">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-pink-600">
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
          </h1>

          <p className="text-base font-google text-slate-500 dark:text-slate-400 leading-relaxed max-w-lg mb-10 transition-colors">
            Connect your database, upload your docs, and deploy a custom AI agent in minutes in your <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-600 dark:from-green-500 to-blue-700 dark:to-blue-500">website</span>.
          </p>

          <div className="flex flex-col sm:flex-row gap-1 w-fit transition-colors">
            <button
              onClick={() => isSignedIn ? router.push('/dashboard') : openSignUp()}
              className="overflow-hidden relative bg-slate-900 dark:bg-slate-900 text-sm font-google tracking-widest text-white border-none font-bold cursor-pointer z-10 group flex items-center justify-center p-4"
            >
              Get Your Bot<span className='material-symbols-outlined ml-2'>arrow_forward</span>
              <span
                className="absolute w-38 h-32 -top-14 -left-2 bg-blue-200 rotate-12 transform scale-x-0 group-hover:scale-x-150 transition-transform group-hover:duration-500 duration-1000 origin-left"
              ></span>
              <span
                className="absolute w-38 h-34 -top-10 -left-2 bg-blue-600 rotate-12 transform scale-x-0 group-hover:scale-x-120 transition-transform group-hover:duration-700 duration-700 origin-left"
              ></span>
              <span
                className="absolute w-36 h-32 -top-8 -left-2 bg-blue-800 rotate-12 transform scale-x-0 group-hover:scale-x-70 transition-transform group-hover:duration-1000 duration-500 origin-left"
              ></span>
              <span
                className="group-hover:opacity-100 group-hover:duration-1000 duration-100 opacity-0 absolute left-6 z-10 whitespace-nowrap"
              >Explore Now!</span>
            </button>

            <Button onClick={() => router.push('/docs')} className="bg-slate-100 dark:bg-slate-900 px-8 py-4 text-xl font-google text-slate-900 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-900 transition-colors rounded-none flex items-center justify-center">
              <span className="material-symbols-outlined mr-2">
                docs
              </span>
              Read Docs
            </Button>

            <Button onClick={() => router.push('/demo/train')} className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-8 py-4 text-xl font-google text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors rounded-none flex items-center justify-center gap-1">
              <span className="material-symbols-outlined text-[18px]">
                experiment
              </span>
              Try Demo
            </Button>
          </div>
        </div>
      </div>

        {/*
          ── COMMENTED OUT RIGHT COLUMN: HIGH-FIDELITY MICRO-REPLICAS ──────
          Preserved below inside a false conditional render to avoid nested JSX comment syntax errors.
        */}
        {false && (
          <div className="bg-[#FAFAFA] dark:bg-slate-950 relative min-h-[650px] overflow-hidden flex flex-col items-center shadow-[inset_5px_5px_8px_-3px_rgba(35,35,35,0.30)] dark:shadow-none transition-colors duration-500">

          {/* Blueprint Grid Background */}
          <div
            className="absolute inset-0 pointer-events-none opacity-[0.05] dark:opacity-[0.1] text-black dark:text-white"
            style={{
              backgroundImage: `linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)`,
              backgroundSize: '40px 40px'
            }}
          />

          {/* Segmented Control (Toggle) */}
          <div className="relative z-30 mt-8 bg-gray-100 dark:bg-slate-900 p-1 rounded-full flex gap-1 border border-gray-200 dark:border-slate-800 shadow-inner dark:shadow-none transition-colors duration-500">
            <button
              onClick={() => setView('train')}
              className={`px-6 py-2 text-[10px] uppercase tracking-widest font-bold transition-all rounded-full ${view === 'train' ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-200 shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'}`}
            >
              Train Agent
            </button>
            <button
              onClick={() => setView('configure')}
              className={`px-6 py-2 text-[10px] uppercase tracking-widest font-bold transition-all rounded-full ${view === 'configure' ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-200 shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'}`}
            >
              Configure Bot
            </button>
          </div>

          <div className="relative w-full flex-1 mt-12 px-8">
            {/* ── MAIN APP WINDOW (65%) ────────────────── */}
            <motion.div
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              className="absolute left-5 top-0 w-[85%] z-10 bg-white dark:bg-slate-950 border border-gray-200 dark:border-slate-800 shadow-[0_20px_50px_rgba(0,0,0,0.06)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden rounded-none transition-colors duration-500"
            >
              {/* macOS Header */}
              <div className="bg-gray-50 dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-4 py-3 flex items-center justify-between transition-colors duration-500">
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 bg-[#FF5F56] rounded-full" />
                  <div className="w-2.5 h-2.5 bg-[#FFBD2E] rounded-full" />
                  <div className="w-2.5 h-2.5 bg-[#27C93F] rounded-full" />
                </div>
                <div className="bg-white dark:bg-slate-950 border border-gray-200 dark:border-slate-800 rounded px-12 py-0.5 text-sm text-slate-600 dark:text-slate-400 font-medium transition-colors">
                  app.Sapybase.com
                </div>
                <div className="w-10" />
              </div>

              {/* App Content with Scale Trick */}
              <div className="p-0 overflow-hidden h-[280px] sm:h-[360px] md:h-[450px]">
                <div style={{ transform: 'scale(0.8)', transformOrigin: 'top left', width: '125%' }}>
                  <AnimatePresence mode="wait">
                    {view === 'configure' ? (
                      <motion.div
                        key="config-ui"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="p-8"
                      >
                        <div className="flex items-center gap-2 mb-6">
                          <span className="material-symbols-outlined text-[16px] text-slate-600 dark:text-slate-400 transition-colors">smart_toy</span>
                          <h3 className="text-md tracking-widest font-display text-slate-900 dark:text-slate-200 transition-colors">Bot Identity</h3>
                        </div>
                        <div className="grid grid-cols-2 gap-8 mb-6">
                          <div className="space-y-4">
                            <h4 className="text-xl md:text-2xl font-display font-bold text-slate-900 dark:text-slate-200 transition-colors">
                              Identity & <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-600 to-green-600 dark:from-orange-400 dark:to-green-400">Deployment</span>
                            </h4>

                            <div className="space-y-3">
                              {[
                                { Icon: "tune", label: 'Customize your appearance' },
                                { Icon: "database", label: 'Train with your data' },
                                { Icon: "vrpano", label: 'Enhance user experience' }
                              ].map(({ Icon, label }, i) => (
                                <div key={i} className="flex items-center gap-3 group">
                                  <div className="w-8 h-8 flex items-center justify-center bg-gray-50 dark:bg-slate-950 border border-gray-100 dark:border-slate-800 group-hover:bg-white dark:group-hover:bg-slate-800 transition-colors text-slate-600 dark:text-slate-400">
                                    <span className="material-symbols-outlined">
                                      {Icon}
                                    </span>
                                  </div>
                                  <span className="text-sm uppercase tracking-wider font-semibold text-slate-600 dark:text-slate-300 font-sans group-hover:text-slate-900 dark:group-hover:text-slate-200 transition-colors">
                                    {label}
                                  </span>
                                </div>
                              ))}
                            </div>

                            {/* Compatibility Bullet Points */}
                            <div className="pt-2 space-y-1.5">
                              <p className="text-md uppercase tracking-widest font-bold text-slate-600 dark:text-slate-400 font-sans mb-1 transition-colors">Universal Compatibility</p>
                              <ul className="grid grid-cols-2 gap-x-4 gap-y-1">
                                {['Next.js', 'React', 'Flutter', 'Angular'].map(tech => (
                                  <li key={tech} className="flex items-center gap-1.5 text-md font-sans text-slate-600 tracking-wider dark:text-slate-300 font-semibold transition-colors">
                                    <div className="w-1 h-1 bg-emerald-500" /> {tech}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </div>

                          <div className="space-y-4">
                            <div className="space-y-1.5">
                              <label className="text-[10px] uppercase tracking-widest font-bold text-slate-600 dark:text-slate-400 font-sans transition-colors">Company Name</label>
                              <div className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 py-2.5 px-3 text-sm text-slate-900 dark:text-slate-200 font-medium transition-colors">Sapy AI</div>
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-[10px] uppercase tracking-widest font-bold text-slate-600 dark:text-slate-400 font-sans transition-colors">Theme Color</label>
                              <div className="flex items-center gap-2">
                                <div className="flex-1 bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 py-2.5 px-3 text-sm text-slate-900 dark:text-slate-200 font-mono uppercase transition-colors">
                                  {botColor}
                                </div>
                                <input
                                  type="color"
                                  value={botColor}
                                  onChange={(e) => setBotColor(e.target.value)}
                                  className="w-10 h-10 border-0 p-0 cursor-pointer bg-transparent"
                                />
                              </div>
                            </div>
                            <button className="w-full py-3 bg-slate-900 dark:bg-blue-600 outline-1 outline-transparent text-[10px] uppercase tracking-widest font-bold text-white font-sans hover:bg-slate-800 dark:hover:bg-blue-500 transition-colors">
                              Create Your Bot
                            </button>
                          </div>
                        </div>

                        {/* Full-width Quick Embed Snippet */}
                        <div className="pt-4 border-t border-gray-100 dark:border-slate-800 transition-colors">
                          <div className="flex items-center gap-2 mb-3">
                            <span className="material-symbols-outlined text-[12px] text-slate-600 dark:text-slate-400">code</span>
                            <p className="text-[10px] uppercase tracking-widest font-bold text-slate-600 dark:text-slate-400 font-sans transition-colors">Quick Embed Snippet</p>
                          </div>
                          <div className="relative group">
                            <pre className="p-4 bg-slate-900 text-[#F8F8F2] border border-slate-900 text-sm font-mono overflow-hidden shadow-2xl rounded-none group-hover:border-blue-500/30 transition-colors">
                              <code>
                                <span className="text-[#6272A4]">&lt;</span>
                                <span className="text-[#FF79C6]">script</span>
                                <br />
                                <span className="text-[#50FA7B] ml-2">src</span>
                                <span className="text-[#F1FA8C]">="https://sapybase.com/widget.js"</span>
                                <br />
                                <span className="text-[#50FA7B] ml-2">data-api-key</span>
                                <span className="text-[#F1FA8C]">="sb_live_0123456789"</span>
                                <br />
                                <span className="text-[#50FA7B] ml-2">defer</span>
                                <br />
                                <span className="text-[#6272A4]">&gt;</span>
                                <span className="text-[#6272A4]">&lt;/</span>
                                <span className="text-[#FF79C6]">script</span>
                                <span className="text-[#6272A4]">&gt;</span>
                              </code>
                            </pre>
                            <div className="absolute top-2 right-2 p-1.5 bg-white/10 text-white/40 border border-white/10 group-hover:text-white/80 transition-colors">
                              <span className="material-symbols-outlined text-[14px]">content_copy</span>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ) : (
                      <motion.div
                        key="train-ui"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="p-8 pb-0"
                      >
                        <div className="flex items-center gap-2 mb-6">
                          <span className="material-symbols-outlined text-[16px] text-slate-600 dark:text-slate-400 transition-colors">psychology</span>
                          <h3 className="text-sm tracking-widest font-display text-slate-900 dark:text-slate-200 transition-colors">Train AI</h3>
                        </div>
                        <div className="grid grid-cols-4 gap-px bg-gray-100 dark:bg-slate-800 border border-gray-100 dark:border-slate-800 mb-8 transition-colors">
                          {[
                            { label: 'Sources', val: '12', icon: 'database' },
                            { label: 'Memory', val: '4.2k', icon: 'vital_signs' },
                            { label: 'Tier', val: 'Scale', icon: 'bolt' },
                            { label: 'Quota', val: '80%', icon: 'schedule' },
                          ].map((s, i) => (
                            <div key={i} className="bg-white dark:bg-slate-950 p-4 transition-colors">
                              <div className="flex items-center gap-1.5 mb-1">
                                <span className="material-symbols-outlined text-[12px] text-slate-600 dark:text-slate-400 transition-colors">{s.icon}</span>
                                <span className="text-[10px] uppercase tracking-widest font-bold text-slate-600 dark:text-slate-400 font-sans transition-colors">{s.label}</span>
                              </div>
                              <p className="text-xl md:text-2xl font-display font-bold text-slate-900 dark:text-slate-200 transition-colors">{s.val}</p>
                            </div>
                          ))}
                        </div>
                        <div className="space-y-4">
                          <div className="flex gap-px bg-gray-100 dark:bg-slate-800 border border-gray-100 dark:border-slate-800 w-fit mb-4 transition-colors">
                            {['URL', 'PDF Upload', 'Manual Text'].map((t, i) => (
                              <div key={i} className={`px-4 py-2 text-[10px] uppercase tracking-widest font-bold font-sans transition-colors ${i === 0 ? 'bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-200' : 'bg-gray-50 dark:bg-slate-900 text-slate-600 dark:text-slate-400'}`}>
                                {t}
                              </div>
                            ))}
                          </div>
                          <div className="w-full aspect-video bg-gray-50 dark:bg-slate-900 border border-dashed border-gray-200 dark:border-slate-800 flex flex-col items-center justify-center gap-2 transition-colors">
                            <span className="material-symbols-outlined text-[24px] text-gray-300 dark:text-slate-600">public</span>
                            <p className="text-sm text-slate-600 dark:text-slate-400 font-medium transition-colors">https://docs.Sapybase.com</p>
                          </div>
                          <button className="w-full py-3 bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 dark:hover:bg-blue-500 text-[10px] uppercase tracking-widest font-bold text-white font-sans transition-colors">
                            Start Training Sequence
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </motion.div>

            {/* ── FREE-FLOATING BOT PREVIEW (Outside Window) ─────────────────── */}
            {view === 'train' && (
              <div className="absolute right-4 top-24 w-[310px] z-20 bg-white dark:bg-slate-950 border border-gray-100 dark:border-slate-800 shadow-[0_40px_80px_rgba(0,0,0,0.18)] dark:shadow-[0_40px_80px_rgba(0,0,0,0.6)] overflow-hidden rounded-2xl transition-colors duration-500">
                {/* Chat Header - Exact Match */}
                <div className="relative shrink-0">
                  <div
                    className="absolute inset-0 animate-gradient-x opacity-20"
                    style={{
                      background: `linear-gradient(90deg, ${botColor}, #f97316, ${botColor})`,
                      backgroundSize: '200% 200%'
                    }}
                  />
                  <div className="bg-white/40 dark:bg-slate-900/40 backdrop-blur-md text-slate-900 dark:text-slate-100 p-2 flex justify-end items-center relative z-10 border-b border-gray-200/50 dark:border-slate-800/50 transition-colors duration-500">
                    <div className="relative flex flex-row justify-between items-center w-full">
                      <div className="relative flex items-center gap-3 pl-2">
                        <div className="relative">
                          <div className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-green-500 border-2 border-white animate-pulse z-10" />
                          <div className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center shrink-0 shadow-sm border-none p-0 m-0" style={{ backgroundColor: botColor }}>
                            <span className="font-bold leading-none select-none text-white text-[12px] m-0 p-0">S</span>
                          </div>
                        </div>
                        <div className="flex flex-row items-center justify-center">
                          <p className="text-sm font-display font-bold" style={{ color: botColor }}>Sapy AI</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="p-1.5 rounded-full flex items-center justify-center min-w-[32px] min-h-[32px]">
                          <span className="material-symbols-outlined text-[18px] text-slate-500 dark:text-slate-400">more_horiz</span>
                        </div>
                        <div className="p-1.5 rounded-full flex items-center justify-center min-w-[32px] min-h-[32px]">
                          <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Chat Body - Exact Match */}
                <div className="h-[300px] p-4 bg-gray-50/50 dark:bg-slate-950/50 text-slate-900 dark:text-slate-100 flex flex-col gap-5 overflow-hidden transition-colors duration-500">
                  <div className="flex flex-col items-start min-w-0 max-w-[85%] self-start">
                    <span className="text-[10px] uppercase tracking-widest font-bold text-slate-400 font-sans mb-1.5 ml-1 leading-none">Sapy AI</span>
                    <div className="px-3 py-2 min-h-[36px] w-fit max-w-full bg-slate-100 dark:bg-slate-800 text-gray-800 dark:text-slate-200 border border-gray-200/60 dark:border-slate-700/60 rounded-2xl rounded-tl-none overflow-hidden text-xs font-google leading-relaxed">
                      Hi! I'm Sapybase AI Assistant. How can I help you build your custom software today?
                    </div>
                  </div>

                  {isTraining && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-center gap-3 p-3 bg-white/50 dark:bg-slate-900/50 border border-dashed border-blue-200 dark:border-blue-800/50 mt-1 rounded-xl transition-colors"
                    >
                      <span className="material-symbols-outlined text-[16px] text-blue-600 animate-spin" style={{ color: botColor }}>settings</span>
                      <div className="flex flex-col">
                        <span className="text-[10px] uppercase tracking-widest font-bold text-slate-900 dark:text-slate-200 font-sans transition-colors">Training Active</span>
                        <span className="text-[10px] uppercase tracking-widest font-bold text-slate-600 dark:text-slate-400 font-sans animate-pulse transition-colors">Syncing knowledge base...</span>
                      </div>
                    </motion.div>
                  )}

                  {!isTraining && (
                    <div className="flex flex-col items-end gap-2 px-1 pb-2 pt-1 self-end w-full mt-auto">
                      {['Services', 'About'].map((btn, qidx) => (
                        <div
                          key={qidx}
                          className="px-3 py-1.5 border rounded-md text-[11px] font-regular font-google transition-colors w-fit text-left break-words bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700"
                        >
                          {btn}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Fixed Branding Footer */}
                <div className="shrink-0 py-1 flex justify-center items-center bg-gray-50/80 dark:bg-slate-950/80 backdrop-blur-sm border-t border-gray-200/50 dark:border-slate-800/50">
                  <div className="flex items-center gap-1.5 text-[5px] font-sans font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
                    <Image src="/SB_loading.svg" alt="Sapybase" width={14} height={14} className="w-3.5 h-3.5 grayscale opacity-50" />
                    Powered by Sapybase
                  </div>
                </div>

                {/* Input Area - Exact Match */}
                <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl border-t border-gray-200/50 dark:border-slate-800/50 shrink-0 z-10 flex flex-col">
                  <div className="p-1 w-full shadow-sm" style={{ paddingBottom: '6px' }}>
                    <div className="relative flex items-center gap-1 pb-0.5">
                      <div className="flex-1 min-h-[30px] bg-transparent px-2.5 py-1 text-slate-400 dark:text-slate-500 text-xs font-medium font-sans flex items-center">
                        Ask anything...
                      </div>
                      <div
                        className="p-1.5 shrink-0 rounded-lg min-w-[28px] min-h-[28px] flex items-center justify-center opacity-50"
                        style={{ color: botColor }}
                      >
                        <span className="material-symbols-outlined text-[16px]">send</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

        </div>
        )}
    </section>
  );
};

export default HeroSection;
