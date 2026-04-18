import React, { useState, useEffect } from 'react';
import Button from './button';
import { motion, AnimatePresence } from 'framer-motion';
import { useUser, useClerk } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';

const TYPEWRITER_WORDS = ['Businesses', 'Freelancers', 'Portfolios'];
const TYPING_SPEED = 80;
const DELETING_SPEED = 50;
const PAUSE_AFTER_TYPE = 1800;
const PAUSE_AFTER_DELETE = 400;

const HeroSection = () => {
  const navigate = useNavigate();
  const { isSignedIn } = useUser();
  const { openSignUp } = useClerk();
  const [view, setView] = useState('configure'); // 'train' | 'configure'
  const [botColor, setBotColor] = useState('#5730F5');
  const [isTraining, setIsTraining] = useState(false);

  const [displayText, setDisplayText] = useState('');
  const [wordIndex, setWordIndex] = useState(0);
  const [phase, setPhase] = useState('typing'); // 'typing' | 'pausing' | 'deleting' | 'pause-before-type'

  useEffect(() => {
    const currentWord = TYPEWRITER_WORDS[wordIndex];
    let timeout;

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
    <section id="home" className="relative min-h-screen bg-white dark:bg-slate-950 pt-16 lg:pt-20 overflow-hidden transition-colors duration-500">
      {/* Architectural Grid Container */}
      <div className="max-w-8xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-px bg-gray-100 dark:bg-slate-800 border-x border-gray-100 dark:border-slate-800 transition-colors duration-500">

        {/* ── LEFT COLUMN: VALUE PROPOSITION ──────────────── */}
        <div className="bg-white dark:bg-slate-950 p-8 lg:p-16 flex flex-col justify-center min-h-[500px]">
          <div className="px-2 py-0.5 bg-gray-50 dark:bg-slate-900 text-xs uppercase tracking-widest font-bold text-slate-600 dark:text-slate-400 flex items-center gap-2 w-fit mb-8 rounded-none border border-gray-100 dark:border-slate-800 transition-colors">
            <span className="material-symbols-outlined text-[14px]">memory</span>
            Next-Gen AI Infrastructure
          </div>

          <h1 className="text-5xl md:text-7xl font-display font-black tracking-tight leading-none text-slate-900 dark:text-slate-200 mb-6 transition-colors">
            Autonomous <br /> <span className="text-transparent bg-clip-text bg-linear-to-r from-green-600 to-blue-600">AI Chat Bots</span> <br />
            For Modern <br />{' '}
            <span className="inline-block relative">
              <span className="text-transparent bg-clip-text bg-linear-to-r from-blue-600 to-pink-600">
                {displayText}
              </span>
              <span
                className="inline-block w-[3px] h-[0.85em] ml-1 align-middle bg-indigo-500 dark:bg-indigo-400 rounded-sm"
                style={{
                  animation: 'caretBlink 1s step-start infinite',
                  verticalAlign: 'middle',
                }}
              />
            </span>
          </h1>

          <p className="text-base font-display text-slate-500 dark:text-slate-400 leading-relaxed max-w-lg mb-10 transition-colors">
            Connect your database, upload your docs, and deploy a custom AI agent in minutes in your <span className="text-transparent bg-clip-text bg-linear-to-r from-green-600 dark:from-green-500 to-blue-700 dark:to-blue-500">website</span>.
          </p>

          <div className="flex flex-col sm:flex-row gap-1 w-fit transition-colors">
            <button
              onClick={() => isSignedIn ? navigate('/app') : openSignUp()}
              className="overflow-hidden relative bg-slate-900 dark:bg-slate-900 text-sm font-display tracking-widest text-white border-none font-bold cursor-pointer z-10 group flex items-center justify-center px-8 py-4"
            >
              Get Your AI Bot<span className='material-symbols-outlined'>arrow_forward</span>
              {/* Layer 1: Dark Blue (Bottom - 100% width) */}
              <span
                class="absolute w-38 h-32 -top-14 -left-2 bg-blue-200 rotate-12 transform scale-x-0 group-hover:scale-x-150 transition-transform group-hover:duration-500 duration-1000 origin-left"
              ></span>
              <span
                class="absolute w-38 h-34 -top-10 -left-2 bg-blue-600 rotate-12 transform scale-x-0 group-hover:scale-x-120 transition-transform group-hover:duration-700 duration-700 origin-left"
              ></span>
              <span
                class="absolute w-36 h-32 -top-8 -left-2 bg-blue-800 rotate-12 transform scale-x-0 group-hover:scale-x-70 transition-transform group-hover:duration-1000 duration-500 origin-left"
              ></span>
              <span
                className="group-hover:opacity-100 group-hover:duration-1000 duration-100 opacity-0 absolute left-6 z-10 whitespace-nowrap"
              >Explore Now!</span>
            </button>

            <Button onClick={() => navigate('/docs')} className="bg-slate-100 dark:bg-slate-900 px-8 py-4 text-xl font-sans text-slate-900 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-900 transition-colors rounded-none flex items-center justify-center">
              <span className="material-symbols-outlined">
                docs
              </span>
              Read Docs
            </Button>
          </div>
        </div>

        {/* ── RIGHT COLUMN: HIGH-FIDELITY MICRO-REPLICAS ────── */}
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
                  app.sapybase.com
                </div>
                <div className="w-10" />
              </div>

              {/* App Content with Scale Trick */}
              <div className="p-0 overflow-hidden" style={{ height: '450px' }}>
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
                              Identity & <span className="text-indigo-600 dark:text-indigo-400">Deployment</span>
                            </h4>

                            <div className="space-y-3">
                              {[
                                { Icon: "tune", label: 'Customize your appearance' },
                                { Icon: "database", label: 'Train with your data' },
                                { Icon: "vrpano", label: 'Enhance user experience' }
                              ].map(({ Icon, label }, i) => (
                                <div key={i} className="flex items-center gap-3 group">
                                  <div className="w-8 h-8 flex items-center justify-center bg-gray-50 dark:bg-slate-950 border border-gray-100 dark:border-slate-800 group-hover:bg-white dark:group-hover:bg-slate-800 transition-colors">
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
                                    <div className="w-1 h-1 bg-indigo-500" /> {tech}
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
                            <button className="w-full py-3 bg-slate-900 dark:bg-indigo-600 outline-1 outline-transparent text-[10px] uppercase tracking-widest font-bold text-white font-sans hover:bg-slate-800 dark:hover:bg-indigo-500 transition-colors">
                              Create Tenant
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
                            <pre className="p-4 bg-slate-900 text-[#F8F8F2] border border-slate-900 text-sm font-mono overflow-hidden shadow-2xl rounded-none group-hover:border-indigo-500/30 transition-colors">
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
                            <p className="text-sm text-slate-600 dark:text-slate-400 font-medium transition-colors">https://docs.sapybase.com</p>
                          </div>
                          <button className="w-full py-3 bg-slate-900 dark:bg-indigo-600 hover:bg-slate-800 dark:hover:bg-indigo-500 text-[10px] uppercase tracking-widest font-bold text-white font-sans transition-colors">
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
                {/* Chat Header - Natively Scaled */}
                <div className="px-4.5 py-3.5 flex items-center justify-between border-b border-gray-100 dark:border-slate-800 bg-linear-to-r from-[#F3E8FF] via-[#F5F3FF] to-[#FFF7ED] dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 transition-colors duration-500">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-[#22C55E]" />
                    <div className="flex flex-col">
                      <p className="text-[10px] uppercase tracking-widest font-bold text-[#4F46E5] dark:text-indigo-400 font-sans">Sapy AI</p>
                      <p className="text-sm text-slate-600 dark:text-slate-400 font-medium italic opacity-80 transition-colors">Powered by SaPyBase</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-[16px] text-slate-600 dark:text-slate-400 cursor-pointer hover:text-slate-900 dark:hover:text-slate-200 transition-colors">more_horiz</span>
                    <div className="w-5 h-5 flex items-center justify-center text-red-500 cursor-pointer hover:text-red-700 transition-colors">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </div>
                  </div>
                </div>

                {/* Chat Body - Natively Scaled */}
                <div className="p-4.5 h-[250px] bg-white dark:bg-slate-950 space-y-5 overflow-hidden transition-colors duration-500">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 flex items-center justify-center shrink-0">
                      <div className="w-full h-full bg-indigo-50 dark:bg-slate-900 border border-indigo-100 dark:border-slate-700 flex items-center justify-center text-indigo-600 dark:text-indigo-400 transition-colors">
                        <span className='material-symbols-outlined' style={{ color: botColor }}>smart_toy</span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1 flex-1">
                      <span className="text-[10px] uppercase tracking-widest font-bold text-slate-600 dark:text-slate-400 font-sans ml-1 transition-colors">Sapy AI</span>
                      <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 p-3 rounded-xl text-sm font-semibold text-slate-500 dark:text-slate-300 leading-relaxed shadow-[0_4px_12px_rgba(0,0,0,0.03)] dark:shadow-none border-b-2 border-b-gray-50 dark:border-b-slate-900 transition-colors">
                        Hi! I'm SaPyBase AI Assistant. How can I help you build your custom software today?
                      </div>
                    </div>
                  </div>

                  {isTraining && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-center gap-3 p-3 bg-gray-50/50 dark:bg-slate-900/50 border border-dashed border-indigo-200 dark:border-indigo-800/50 mt-4 rounded-xl transition-colors"
                    >
                      <span className="material-symbols-outlined text-[16px] text-indigo-600 animate-spin" style={{ color: botColor }}>settings</span>
                      <div className="flex flex-col">
                        <span className="text-[10px] uppercase tracking-widest font-bold text-slate-900 dark:text-slate-200 font-sans transition-colors">Training Active</span>
                        <span className="text-[10px] uppercase tracking-widest font-bold text-slate-600 dark:text-slate-400 font-sans animate-pulse transition-colors">Syncing knowledge base...</span>
                      </div>
                    </motion.div>
                  )}
                </div>

                {/* Chat Footer - Natively Scaled */}
                <div className="px-4.5 py-4 border-t border-gray-50 dark:border-slate-800 bg-white dark:bg-slate-950 transition-colors duration-500">
                  <div className="flex gap-2 mb-3">
                    {['Services', 'About'].map(btn => (
                       <div key={btn} className="px-4 py-2 bg-[#EEF2FF] dark:bg-indigo-900/40 text-[#4F46E5] dark:text-indigo-300 text-[10px] uppercase tracking-widest font-bold font-sans rounded-full hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-colors cursor-pointer border border-indigo-50 dark:border-indigo-800/50 shadow-sm">
                        {btn}
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-slate-600 dark:text-slate-400 font-medium transition-colors">Ask anything...</div>
                    <span className="material-symbols-outlined text-[16px] text-indigo-500 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors cursor-pointer" style={{ color: botColor }}>send</span>
                  </div>
                </div>
              </div>
            )}
          </div>

        </div>

      </div>
    </section>
  );
};

export default HeroSection;