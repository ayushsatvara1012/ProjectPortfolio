import React from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck, Cpu, Globe,ArrowBigRight, Rocket, Terminal, Layers, Activity, ChevronRight } from 'lucide-react';
import { desc } from 'framer-motion/client';

const Apptest = () => {
  const partners = [
    {
      name: "Ayush Satvara",
      role: "Software Developer",
      image: "/IMG_9145.webp",
      skills: ["Python", "FastAPI","PostGres", "GenAI"],
      desc: "AWS Certified Solutions Architect specializes in building high-performance digital ecosystems featuring AI-driven semantic search and projects achieving 99 Lighthouse performance scores.Excelling at optimizing frontend latency and architecting scalable backend ETL pipelines for large-scale datasets. His technical expertise is further validated by specialized certifications in Generative AI, Machine Learning, and Data Science."
    },
    {
      name: "Kathan Pandya",
      role: "Frontend Developer",
      image: "https://via.placeholder.com/300x350",
      skills: ["React", "JS", "RestAPI","Typescript"],
      desc: "Spearheaded the development of high-performance, scalable web interfaces using Angular, TypeScript, and JavaScript.Architected and implemented responsive, data-intensive dashboards using HTML5 and Advanced CSS/SCSS.Integrate complex REST APIs, optimizing frontend performance and ensuring Type-safe application architecture through TypeScript.Focused on enhancing user experience (UX) maintaining high standards for cross-browser compatibility and mobile responsiveness."
    }
  ];

  return (
    <div className="bg-white text-slate-900">
      
      {/* SECTION 1: Laptop-Optimized Hero & Partners (Fits 100vh) */}
      <section className="min-h-screen flex flex-col justify-center py-12 px-6 lg:px-12 max-w-[1600px] mx-auto">
        <div className="grid lg:grid-cols-12 gap-12 items-center">
          
          {/* LEFT: Heading & Context */}
          <div className="lg:col-span-5 space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 border border-slate-200">
              <Terminal size={12} className="text-indigo-600" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 font-mono">Profile_Registry_v2</span>
            </div>
            <h1 className="text-5xl md:text-7xl font-black tracking-tighter leading-[0.9]">
              THE <span className="text-indigo-600 bg-indigo-100/50">ARCHITECTS</span> <br /> OF CODE.
            </h1>
            <p className="text-base text-slate-500 font-light max-w-md leading-relaxed">
              We engineer scalable ecosystems that bridge business vision and technical reality. 
            </p>
          </div>

          {/* RIGHT: Informative UI Module */}
          <div className="lg:col-span-7 bg-slate-50 rounded-[2.5rem] border border-slate-200 p-6 md:p-8 relative overflow-hidden h-auto min-h-[600px] mt-10 lg:mt-0 pb-12 lg:pb-8">
            <div className="absolute top-0 right-0 p-6 flex gap-2 z-10">
              <div className="w-2 h-2 rounded-full bg-red-400" />
              <div className="w-2 h-2 rounded-full bg-amber-400" />
              <div className="w-2 h-2 rounded-full bg-emerald-400" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 h-full gap-8 pt-4">
              {/* Partner Cards */}
              {partners.map((p, i) => (
                <motion.div 
                  key={i}
                  whileHover={{ y: -5 }}
                  className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100 flex flex-col h-full min-h-[450px]"
                >
                  <div className="h-48 shrink-0 overflow-hidden rounded-2xl mb-4 bg-slate-200">
                    <img src={p.image} alt={p.name} className="w-full h-full object-cover grayscale" />
                  </div>
                  <h3 className="font-bold text-lg leading-tight">{p.name}</h3>
                  <p className="text-indigo-600 font-mono text-[9px] uppercase tracking-widest mb-3">{p.role}</p>
                  <div className='text-slate-900 text-xs font-quantico mb-4 grow'>{p.desc}</div>
                  <div className="mt-auto flex flex-wrap gap-1">
                    {p.skills.map(s => (
                      <span key={s} className="px-2 py-0.5 rounded-md bg-slate-50 text-[8px] font-bold text-slate-400 border border-slate-100">{s}</span>
                    ))}
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Floating Technical Overlay */}
            <div className="absolute bottom-4 right-6 bg-slate-900 text-white p-4 rounded-2xl shadow-2xl flex items-center gap-4">
              <Activity className="text-emerald-400 animate-pulse" size={20} />
              <div className="font-mono text-[9px]">
                <p className="opacity-50">STACK_READY</p>
                <p className="font-bold">UPTIME: 99.98%</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 2: Technical Philosophy & Business (Muted Colors) */}
      <section className="bg-[#0a0c10] py-24 px-6 rounded-t-[3rem] lg:rounded-t-[5rem] relative">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-16 items-center">
          
          <div className="space-y-8">
            <h2 className="text-3xl md:text-5xl font-bold text-white tracking-tighter">
              Performance-First <br /> <span className="text-slate-500 font-light italic">Solutions.</span>
            </h2>
            <div className="space-y-4 text-slate-400 font-light text-sm leading-relaxed max-w-lg">
              <p>
                Built on <span className="text-indigo-400">Atomic Design Principles</span>, this platform utilizes React 19 and Vite to ensure lightning-fast interaction.
              </p>
              <p>
                We optimize customer engagement through <span className="text-white">Solution Architecture</span> that prioritizes user retention and system reliability.
              </p>
            </div>
          </div>

          {/* TONED DOWN Business Card (Deep Indigo/Slate) */}
          <div className="bg-slate-900/50 border border-slate-800 rounded-[2.5rem] p-10 text-white relative group overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
              <Rocket size={120} />
            </div>
            
            <h3 className="text-2xl font-bold mb-8 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-indigo-500" />
              </div>
              How we help you?
            </h3>

            <ul className="space-y-5 relative z-10">
              {[
                "Conversion-Focused Architecture",
                "Cloud Cost Optimization",
                "Scalable System Integration",
                "Customer Retention UX"
              ].map((item, i) => (
                <li key={i} className="flex items-center gap-3 text-sm text-slate-300">
                  <ChevronRight size={14} className="text-indigo-500" />
                  {item}
                </li>
              ))}
            </ul>

            <button className="mt-10 w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-xs uppercase tracking-widest transition-all">
              Initiate Consultation
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Apptest;