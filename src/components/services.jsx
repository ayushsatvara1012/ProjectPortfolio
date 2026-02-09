
import { BrainCircuit, Code2, CloudCog, Globe, Terminal, Fingerprint, Activity } from 'lucide-react';

const Services = () => {
  return (
    <section id="services" className="py-32 bg-slate-950 relative overflow-hidden">

      {/* Background "Neural" Lines */}
      <div className="absolute inset-0 opacity-20 pointer-events-none">
        <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
          <path d="M0 20 Q 50 50 100 20" stroke="url(#lineGradient)" fill="none" strokeWidth="0.1" />
          <path d="M0 80 Q 50 50 100 80" stroke="url(#lineGradient)" fill="none" strokeWidth="0.1" />
          <defs>
            <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="transparent" />
              <stop offset="50%" stopColor="#6366f1" />
              <stop offset="100%" stopColor="transparent" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <div className="flex flex-col md:flex-row justify-between items-end mb-20 gap-8">
          <div className="max-w-2xl">
            <div className="flex items-center gap-3 text-indigo-500 font-mono text-xs mb-4 tracking-[0.3em] uppercase">
              <Activity size={14} className="animate-pulse" />
              Service Modules Available
            </div>
            <h2 className="text-5xl md:text-7xl font-black text-white leading-none">
              Engineering <br />
              <span className="text-transparent bg-clip-text bg-linear-to-r from-indigo-400 via-violet-400 to-fuchsia-400">
                Super-Structures.
              </span>
            </h2>
          </div>
          <div className="hidden lg:block text-right">
            <p className="text-slate-500 font-mono text-xs uppercase tracking-widest leading-relaxed">
              System_Version: 2.0.6 <br />
              Protocol: High_Performance <br />
              Uptime: 99.99%
            </p>
          </div>
        </div>

        {/* The Creative Bento Architecture */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 auto-rows-fr">

          {/* 01. AI DEVELOPMENT - The "Brain" Module */}
          <div className="md:col-span-8 group relative rounded-4xl bg-slate-900/40 border border-slate-800 backdrop-blur-xl p-10 overflow-hidden hover:border-indigo-500/50 transition-all duration-700">
            <div className="relative z-20 h-full flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-mono text-indigo-500 mb-2 block tracking-widest">MODULE_01 // INTELLIGENCE</span>
                <h3 className="text-4xl font-bold text-white mb-6">AI & Neural <br />Integration</h3>
                <p className="text-slate-400 max-w-sm leading-relaxed font-light">
                  Deploying RAG-optimized LLMs and custom machine learning models that evolve with your data. We don't just add AI; we architect intelligence.
                </p>
              </div>
              <div className="mt-12 flex items-center gap-6">
                <div className="flex -space-x-3">
                  {/* Decorative Tech Rings */}
                  <div className="w-10 h-10 rounded-full bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center backdrop-blur-md">
                    <BrainCircuit size={18} className="text-indigo-400" />
                  </div>
                  <div className="w-10 h-10 rounded-full bg-violet-600/20 border border-violet-500/40 flex items-center justify-center backdrop-blur-md">
                    <Fingerprint size={18} className="text-violet-400" />
                  </div>
                </div>
                <button className="text-xs font-bold text-white flex items-center gap-2 group/btn">
                  EXPLORE ARCHITECTURE <Terminal size={14} className="group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            </div>
            {/* Visual Decoration: Floating Grid */}
            <div className="absolute top-0 right-0 w-80 h-full bg-indigo-600/5 mask-[radial-gradient(ellipse_at_center,white,transparent)] group-hover:bg-indigo-600/10 transition-colors duration-700"
              style={{ backgroundImage: 'radial-gradient(#4f46e5 0.5px, transparent 0.5px)', backgroundSize: '20px 20px' }} />
          </div>

          {/* 02. WEB SERVICES - The "Speed" Module */}
          <div className="md:col-span-4 group relative rounded-4xl bg-slate-900/60 border border-indigo-500/30 backdrop-blur-2xl p-8 flex flex-col justify-between overflow-hidden transition-all duration-500 hover:border-indigo-400 hover:shadow-[0_0_40px_-10px_rgba(79,70,229,0.3)]">

            {/* Inner Glow Aura - This provides the highlight without the harshness */}
            <div className="absolute -top-24 -right-24 w-48 h-48 bg-indigo-600/20 blur-[80px] rounded-full group-hover:bg-indigo-600/40 transition-colors duration-700" />

            <div className="relative z-10 space-y-4">
              {/* Animated Icon Container */}
              <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 group-hover:scale-110 group-hover:bg-indigo-500/20 transition-all duration-500">
                <Code2 size={28} strokeWidth={1.5} />
              </div>

              <h3 className="text-2xl font-bold text-white tracking-tight">
                Ultra-Fast <br />
                <span className="text-indigo-400">Web Engines</span>
              </h3>

              <p className="text-slate-400 text-sm font-light leading-relaxed">
                React/Vite apps engineered for sub-200ms TTFB. High-end UX meeting industrial strength code.
              </p>
            </div>

            <div className="relative z-10 mt-8">
              <div className="flex flex-wrap gap-2 mb-6">
                <span className="text-[9px] font-mono px-2 py-1 rounded bg-indigo-950/50 border border-indigo-800/50 text-indigo-300">V8_OPTIMIZED</span>
                <span className="text-[9px] font-mono px-2 py-1 rounded bg-slate-800/50 border border-slate-700 text-slate-400">SSR_READY</span>
              </div>

              <div className="pt-4 border-t border-slate-800 flex justify-between items-center text-[10px] font-mono tracking-widest text-slate-500">
                <span className="group-hover:text-indigo-400 transition-colors">PERF_INDEX: 100</span>
                <div className="flex gap-1">
                  <div className="w-1 h-1 bg-indigo-500 rounded-full animate-pulse" />
                  <div className="w-1 h-1 bg-indigo-500 rounded-full animate-pulse delay-75" />
                  <div className="w-1 h-1 bg-indigo-500 rounded-full animate-pulse delay-150" />
                </div>
              </div>
            </div>

            {/* Subtle Scanning Line Effect */}
            <div className="absolute bottom-0 left-0 w-full h-px bg-linear-to-r from-transparent via-indigo-500/50 to-transparent translate-y-full group-hover:animate-scan" />
          </div>

          {/* 03. CLOUD DEPLOYMENT - The "Core" Module */}
          <div className="md:col-span-4 group relative rounded-4xl bg-slate-900/40 border border-slate-800 backdrop-blur-xl p-8 hover:bg-slate-900/60 transition-all">
            <CloudCog size={32} className="text-indigo-500 mb-6 group-hover:rotate-90 transition-transform duration-1000" />
            <h4 className="text-xl font-bold text-white mb-3">Cloud Architect</h4>
            <p className="text-slate-400 text-sm font-light leading-relaxed mb-6">
              AWS infrastructure design using Lambda & Serverless patterns. Scaling without friction.
            </p>
            <div className="flex gap-2">
              <div className="h-1 w-12 bg-indigo-500 rounded-full" />
              <div className="h-1 w-4 bg-slate-700 rounded-full" />
              <div className="h-1 w-4 bg-slate-700 rounded-full" />
            </div>
          </div>

          {/* 04. GLOBAL SCALING - The "Scale" Module */}
          <div className="md:col-span-8 group relative rounded-4xl backdrop-blur-2xl border border-emerald-500/30 hover:border-emerald-400 hover:shadow-[0_0_40px_-10px_rgba(79,70,229,0.3)] p-1 flex items-center overflow-hidden">
            <div className="absolute -top-24 -right-24 w-48 h-48 bg-emerald-600/20 blur-[80px] rounded-full group-hover:bg-emerald-600/40 transition-colors duration-700" />
            <div className="bg-slate-950 w-full h-full rounded-[1.9rem] p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 transition-all group-hover:bg-slate-900/30">
              <div className="flex items-center gap-6">
                <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                  <Globe size={32} />
                </div>
                <div>
                  <h4 className="text-xl font-bold text-white tracking-tight">Global Connectivity</h4>
                  <p className="text-slate-500 text-sm">CDN-first deployment for global audiences.</p>
                </div>
              </div>
              <button className="px-6 py-3 rounded-xl border border-slate-700 text-white text-xs font-bold hover:bg-white hover:text-black transition-all">
                VIEW DEPLOYMENT LOGS
              </button>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
};

export default Services;