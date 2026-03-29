import React from 'react';
import { Zap, BarChart3, Cpu, ArrowUpRight, ShieldCheck, Database, Globe, Layers, Activity } from 'lucide-react';

const PerformanceMetrics = () => {
  const gridData = [
    {
      type: "metric",
      eyebrow: "GLOBAL EDGE LATENCY",
      value: "< 50ms",
      subtext: "Average response time across CDN nodes.",
      icon: <Globe className="w-3.5 h-3.5" />
    },
    {
      type: "text",
      heading: "Autonomous RAG",
      body: "Upload documentation; our pipeline generates semantic embeddings instantly. Deploy context-aware agents sans manual pipelines."
    },
    {
      type: "metric",
      eyebrow: "CORE WEB VITALS",
      value: "100/100",
      subtext: "Perfect Lighthouse performance benchmarks.",
      icon: <Activity className="w-3.5 h-3.5" />
    },
    {
      type: "text",
      heading: "Modern Stacks",
      body: "Engineered with React 19 + Tailwind v4 for max speed. Atomic components ensure zero redundant CSS and fast paint cycles."
    },
    {
      type: "metric",
      eyebrow: "DATABASE READ-WRITE",
      value: "10x",
      subtext: "Accelerated ingestion via Supabase indexing.",
      icon: <Database className="w-3.5 h-3.5" />
    },
    {
      type: "text",
      heading: "Scalable Infrastructure",
      body: "FastAPI backends optimized for high-concurrency. Seamless Supabase integration ensures real-time sync at scale."
    },
    {
      type: "metric",
      eyebrow: "AUTHENTICATION UPTIME",
      value: "99.9%",
      subtext: "Resilient Clerk-managed identity layer.",
      icon: <ShieldCheck className="w-3.5 h-3.5" />
    },
    {
      type: "text",
      heading: "Enterprise Security",
      body: "End-to-end encryption for data-at-rest. Strict CORS policies and origin validation prevent unauthorized access."
    },
    {
      type: "metric",
      eyebrow: "JAVASCRIPT BUNDLE",
      value: "< 12KB",
      subtext: "Minified production footprint per route.",
      icon: <Layers className="w-3.5 h-3.5" />
    }
  ];

  return (
    <section id="metrics" className="w-full bg-white py-2 overflow-hidden">
      <div className="max-w-7xl mx-auto px-6 md:px-12">
        
        {/* 9-Cell Checkerboard Extended Grid Archivecture */}
        <div className="relative group/grid">
          
          {/* Vertical Extended Lines (at 33% and 66%) */}
          <div className="hidden md:block absolute left-[33.33%] top-[-100vh] bottom-[-100vh] w-px bg-slate-200 transition-colors duration-500 group-hover/grid:bg-indigo-100" />
          <div className="hidden md:block absolute left-[66.66%] top-[-100vh] bottom-[-100vh] w-px bg-slate-200 transition-colors duration-500 group-hover/grid:bg-indigo-100" />
          
          {/* Horizontal Extended Lines (0%, 33%, 66%, 100%) */}
          <div className="absolute top-0 left-[-100vw] right-[-100vw] h-px bg-slate-200 transition-colors duration-500 group-hover/grid:bg-indigo-100" />
          <div className="absolute top-[33.33%] left-[-100vw] right-[-100vw] h-px bg-slate-200 transition-colors duration-500 group-hover/grid:bg-indigo-100 hidden md:block" />
          <div className="absolute top-[66.66%] left-[-100vw] right-[-100vw] h-px bg-slate-200 transition-colors duration-500 group-hover/grid:bg-indigo-100 hidden md:block" />
          <div className="absolute bottom-0 left-[-100vw] right-[-100vw] h-px bg-slate-200 transition-colors duration-500 group-hover/grid:bg-indigo-100" />

          {/* 3x3 Grid Content */}
          <div className="grid grid-cols-1 md:grid-cols-3 relative z-10">
            {gridData.map((cell, index) => (
              <div 
                key={index} 
                className={`
                  p-12 md:p-14 flex flex-col gap-6 group/cell transition-colors duration-500
                  ${index % 2 === 0 ? 'bg-white hover:bg-slate-50/50' : 'bg-slate-50/50 hover:bg-slate-100/50'}
                  ${index < 6 ? 'border-b md:border-b-0 border-slate-100' : ''}
                `}
              >
                {cell.type === "metric" ? (
                  <>
                    {/* Eyebrow Label */}
                    <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.25em] text-slate-400">
                      <span className="text-slate-300 group-hover/cell:text-indigo-500 transition-colors">{cell.icon}</span>
                      <span>{cell.eyebrow}</span>
                    </div>

                    {/* Primary Metric */}
                    <div className="space-y-4">
                      <div className="text-4xl md:text-7xl font-black text-slate-900 tracking-tighter tabular-nums leading-[0.8] transition-transform duration-500 group-hover/cell:translate-x-1">
                        {cell.value}
                      </div>
                      
                      {/* Subtext */}
                      <div className="flex items-start gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-relaxed opacity-80">
                        <ArrowUpRight className="w-3 h-3 text-emerald-500 shrink-0" strokeWidth={3} />
                        <span>{cell.subtext}</span>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    {/* Heading for Text Cells */}
                    <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.25em] text-slate-600">
                      <div className="h-1.5 w-1.5 rounded-full bg-slate-300" />
                      <span>{cell.heading}</span>
                    </div>

                    {/* Body Text */}
                    <p className="text-[13px] text-slate-500 font-medium leading-[1.6] tracking-tight max-w-[280px]">
                      {cell.body}
                    </p>

                    {/* Technical ID */}
                    <div className="mt-auto pt-8 border-t border-slate-100/50 flex items-center justify-between opacity-40">
                      <span className="text-[8px] font-mono font-bold text-slate-300 uppercase tracking-widest">SY_SYS_ARCH_0{index + 1}</span>
                      <div className="flex gap-1">
                        {[40, 60, 80].map(op => (
                          <div key={op} className={`h-1 w-1 bg-slate-900 opacity-${op / 100}`} />
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>

      </div>
    </section>
  );
};

export default PerformanceMetrics;