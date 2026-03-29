import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowRight, Building2, Globe, Palette,
  MessageSquare, Bot, BrainCircuit, Database,
  Zap, Lock, Activity, Clock, Plus,
  ChevronDown, Send, User, Sparkles, Cpu,
  ShieldCheck, Settings, MoreHorizontal, Code2, Copy
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const HeroSection = () => {
  const navigate = useNavigate();
  const [view, setView] = useState('configure'); // 'train' | 'configure'
  const [botColor, setBotColor] = useState('#5730F5');
  const [isTraining, setIsTraining] = useState(false);

  // Lifecycle for training indicator
  useEffect(() => {
    if (view === 'train') {
      setIsTraining(true);
      const timer = setTimeout(() => setIsTraining(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [view]);

  return (
    <section id="home" className="relative min-h-screen bg-white pt-16 lg:pt-20 overflow-hidden">
      {/* Architectural Grid Container */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-px bg-gray-100 border border-gray-100 p-px">

        {/* ── LEFT COLUMN: VALUE PROPOSITION ──────────────── */}
        <div className="bg-white p-8 lg:p-16 flex flex-col justify-center min-h-[500px]">
          <div className="px-2 py-0.5 border border-gray-100 bg-gray-50 text-[10px] font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2 w-fit mb-8 rounded-none">
            <Cpu className="w-3.5 h-3.5" />
            Next-Gen AI Infrastructure
          </div>

          <h1 className="text-4xl lg:text-6xl font-black text-slate-900 tracking-tight uppercase leading-[0.95] mb-6">
            Autonomous <span className="text-slate-400">AI Agents</span> <br />
            For Modern <span className="text-indigo-600">SaaS</span>
          </h1>

          <p className="text-slate-500 text-lg lg:text-xl font-medium max-w-lg mb-10 leading-relaxed">
            Connect your database, upload your docs, and deploy a custom RAG agent in minutes.
            No complex pipelines required.
          </p>

          <div className="flex flex-col sm:flex-row gap-px bg-gray-100 w-fit">
            <button
              onClick={() => navigate('/services')}
              className="bg-slate-900 text-white px-8 py-4 text-xs font-bold uppercase tracking-widest hover:bg-slate-800 transition-colors flex items-center gap-2 rounded-none"
            >
              Start Building Free <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => window.open('https://docs.sapybase.com', '_blank')}
              className="bg-white border border-transparent text-slate-600 px-8 py-4 text-xs font-bold uppercase tracking-widest hover:bg-gray-50 transition-colors rounded-none outline-1 outline-gray-100"
            >
              Read the Docs
            </button>
          </div>
        </div>

        {/* ── RIGHT COLUMN: HIGH-FIDELITY MICRO-REPLICAS ────── */}
        <div className="bg-[#FAFAFA] relative min-h-[650px] overflow-hidden flex flex-col items-center">

          {/* Blueprint Grid Background */}
          <div
            className="absolute inset-0 pointer-events-none opacity-[0.05]"
            style={{
              backgroundImage: `linear-gradient(to right, #000 1px, transparent 1px), linear-gradient(to bottom, #000 1px, transparent 1px)`,
              backgroundSize: '40px 40px'
            }}
          />

          {/* Segmented Control (Toggle) */}
          <div className="relative z-30 mt-8 bg-gray-100 p-1 rounded-full flex gap-1 border border-gray-200 shadow-inner">
            <button
              onClick={() => setView('train')}
              className={`px-6 py-2 text-[11px] font-bold uppercase tracking-widest transition-all rounded-full ${view === 'train' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
            >
              Train Agent
            </button>
            <button
              onClick={() => setView('configure')}
              className={`px-6 py-2 text-[11px] font-bold uppercase tracking-widest transition-all rounded-full ${view === 'configure' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
            >
              Configure Bot
            </button>
          </div>

          <div className="relative w-full flex-1 mt-12 px-8">
            {/* ── MAIN APP WINDOW (65%) ────────────────── */}
            <motion.div
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              className="absolute left-0 top-0 w-[85%] z-10 bg-white border border-gray-200 shadow-[0_20px_50px_rgba(0,0,0,0.06)] overflow-hidden rounded-none"
            >
              {/* macOS Header */}
              <div className="bg-gray-50 border-b border-gray-200 px-4 py-3 flex items-center justify-between">
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 bg-[#FF5F56] rounded-full" />
                  <div className="w-2.5 h-2.5 bg-[#FFBD2E] rounded-full" />
                  <div className="w-2.5 h-2.5 bg-[#27C93F] rounded-full" />
                </div>
                <div className="bg-white border border-gray-200 rounded px-12 py-0.5 text-[9px] text-gray-400 font-medium">
                  app.sapybase.com
                </div>
                <div className="w-10" />
              </div>

              {/* App Content with Scale Trick */}
              <div className="p-0 overflow-hidden" style={{ height: '400px' }}>
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
                          <Bot className="w-4 h-4 text-slate-400" />
                          <h2 className="text-xs font-bold uppercase tracking-widest text-slate-900">Bot Identity</h2>
                        </div>
                        <div className="grid grid-cols-2 gap-8 mb-6">
                          <div className="space-y-4">
                            <h3 className="text-2xl font-black text-slate-900 tracking-tight leading-tight">
                              Identity & <span className="text-indigo-600">Deployment</span>
                            </h3>

                            <div className="space-y-3">
                              {[
                                { Icon: Zap, label: 'Customize your appearance' },
                                { Icon: Database, label: 'Train with your data' },
                                { Icon: ShieldCheck, label: 'Enhance user experience' }
                              ].map(({ Icon, label }, i) => (
                                <div key={i} className="flex items-center gap-3 group">
                                  <div className="w-8 h-8 flex items-center justify-center bg-gray-50 border border-gray-100 group-hover:bg-white transition-colors">
                                    <Icon className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 transition-colors" />
                                  </div>
                                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 group-hover:text-slate-600 transition-colors">
                                    {label}
                                  </span>
                                </div>
                              ))}
                            </div>

                            {/* Compatibility Bullet Points */}
                            <div className="pt-2 space-y-1.5">
                              <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1">Universal Compatibility</p>
                              <ul className="grid grid-cols-2 gap-x-4 gap-y-1">
                                {['Next.js', 'React', 'Flutter', 'Angular'].map(tech => (
                                  <li key={tech} className="flex items-center gap-1.5 text-[10px] text-slate-500 font-medium">
                                    <div className="w-1 h-1 bg-indigo-500" /> {tech}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </div>

                          <div className="space-y-4">
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Company Name</label>
                              <div className="w-full bg-gray-50 border border-gray-100 py-2.5 px-3 text-xs text-slate-900 font-medium">SaPyBase AI</div>
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Theme Color</label>
                              <div className="flex items-center gap-2">
                                <div className="flex-1 bg-gray-50 border border-gray-100 py-2.5 px-3 text-xs font-mono text-slate-900 uppercase">
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
                            <button className="w-full py-3 bg-slate-900 text-white text-[10px] font-bold uppercase tracking-widest">
                              Create Tenant
                            </button>
                          </div>
                        </div>

                        {/* Full-width Quick Embed Snippet */}
                        <div className="pt-4 border-t border-gray-100">
                          <div className="flex items-center gap-2 mb-3">
                            <Code2 className="w-3 h-3 text-slate-400" />
                            <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Quick Embed Snippet</p>
                          </div>
                          <div className="relative group">
                            <pre className="p-4 bg-slate-900 text-[#F8F8F2] border border-slate-900 text-[11px] font-mono overflow-hidden shadow-2xl rounded-none group-hover:border-indigo-500/30 transition-colors">
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
                              <Copy className="w-3.5 h-3.5" />
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
                          <BrainCircuit className="w-4 h-4 text-slate-400" />
                          <h2 className="text-xs font-bold uppercase tracking-widest text-slate-900">Train AI</h2>
                        </div>
                        <div className="grid grid-cols-4 gap-px bg-gray-100 border border-gray-100 mb-8">
                          {[
                            { label: 'Sources', val: '12', icon: Database },
                            { label: 'Memory', val: '4.2k', icon: Activity },
                            { label: 'Tier', val: 'Scale', icon: Zap },
                            { label: 'Quota', val: '80%', icon: Clock },
                          ].map((s, i) => (
                            <div key={i} className="bg-white p-4">
                              <div className="flex items-center gap-1.5 mb-1">
                                <s.icon className="w-3 h-3 text-slate-400" />
                                <span className="text-[8px] font-bold uppercase tracking-tighter text-slate-400">{s.label}</span>
                              </div>
                              <p className="text-lg font-bold text-slate-900 tracking-tight">{s.val}</p>
                            </div>
                          ))}
                        </div>
                        <div className="space-y-4">
                          <div className="flex gap-px bg-gray-100 border border-gray-100 w-fit mb-4">
                            {['URL', 'PDF Upload', 'Manual Text'].map((t, i) => (
                              <div key={i} className={`px-4 py-2 text-[9px] font-bold uppercase tracking-widest ${i === 0 ? 'bg-white text-slate-900' : 'bg-gray-50 text-slate-400'}`}>
                                {t}
                              </div>
                            ))}
                          </div>
                          <div className="w-full aspect-video bg-gray-50 border border-dashed border-gray-200 flex flex-col items-center justify-center gap-2">
                            <Globe className="w-6 h-6 text-gray-300" />
                            <p className="text-[10px] text-gray-400 font-medium">https://docs.sapybase.com</p>
                          </div>
                          <button className="w-full py-3 bg-slate-900 text-white text-[10px] font-bold uppercase tracking-widest">
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
              <div className="absolute right-4 top-24 w-[310px] z-20 bg-white border border-gray-100 shadow-[0_40px_80px_rgba(0,0,0,0.18)] overflow-hidden rounded-2xl">
                {/* Chat Header - Natively Scaled */}
                <div className="px-4.5 py-3.5 flex items-center justify-between border-b border-gray-100 bg-linear-to-r from-[#F3E8FF] via-[#F5F3FF] to-[#FFF7ED]">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-[#22C55E]" />
                    <div className="flex flex-col">
                      <p className="text-xs font-black text-[#4F46E5] leading-tight tracking-tight">Sapy AI</p>
                      <p className="text-[9px] text-slate-400 font-bold italic opacity-80">Powered by SaPyBase</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <MoreHorizontal className="w-4 h-4 text-slate-400 cursor-pointer hover:text-slate-600 transition-colors" />
                    <div className="w-5 h-5 flex items-center justify-center text-red-500 cursor-pointer hover:text-red-700 transition-colors">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </div>
                  </div>
                </div>

                {/* Chat Body - Natively Scaled */}
                <div className="p-4.5 h-[250px] bg-white space-y-5 overflow-hidden">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 flex items-center justify-center shrink-0">
                      <div className="w-full h-full bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                        <Cpu className="w-5 h-5" style={{ color: botColor }} />
                      </div>
                    </div>
                    <div className="flex flex-col gap-1 flex-1">
                      <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Sapy AI</span>
                      <div className="bg-white border border-gray-100 p-3 rounded-xl text-[3px] text-slate-700 leading-relaxed shadow-[0_4px_12px_rgba(0,0,0,0.03)] border-b-2 border-b-gray-50">
                        Hi! I'm SaPyBase AI Assistant. How can I help you build your custom software today?
                      </div>
                    </div>
                  </div>

                  {isTraining && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-center gap-3 p-3 bg-gray-50/50 border border-dashed border-indigo-200 mt-4 rounded-xl"
                    >
                      <Settings className="w-4 h-4 text-indigo-600 animate-spin" style={{ color: botColor }} />
                      <div className="flex flex-col">
                        <span className="text-[9px] font-black text-slate-900 uppercase tracking-widest">Training Active</span>
                        <span className="text-[8px] text-slate-400 font-bold italic animate-pulse">Syncing knowledge base...</span>
                      </div>
                    </motion.div>
                  )}
                </div>

                {/* Chat Footer - Natively Scaled */}
                <div className="px-4.5 py-4 border-t border-gray-50 bg-white">
                  <div className="flex gap-2 mb-3">
                    {['Services', 'About'].map(btn => (
                      <div key={btn} className="px-4 py-2 bg-[#EEF2FF] text-[#4F46E5] text-[10px] font-bold rounded-full hover:bg-indigo-100 transition-colors cursor-pointer border border-indigo-50 shadow-sm">
                        {btn}
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="text-[11px] text-slate-400 font-medium tracking-tight">Ask anything...</div>
                    <Send className="w-4 h-4 text-indigo-500 hover:text-indigo-700 transition-colors cursor-pointer" style={{ color: botColor }} />
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