// import Github from '../assets/github-logo.png'
import { Github,ExternalLink, ArrowRight, Server, Globe, Cpu ,Boxes,Terminal} from 'lucide-react';
import NoImage from '../assets/icons/no-image.svg'
import JavascriptIcon from '../assets/icons/javascript.svg'
import ReactIcon from '../assets/icons/react.svg'
import MongoDBIcon from '../assets/icons/mongo.svg'
import NodeIcon from '../assets/icons/node.svg'
import HTMLIcon from '../assets/icons/html.svg'
import CSSIcon from '../assets/icons/css.svg'
import PythonIcon from '../assets/icons/python.svg'
import TailwindIcon from '../assets/icons/tailwind.svg'
import PostgreIcon from '../assets/icons/postgre.svg'
import AWSIcon from '../assets/icons/aws.svg'
import DockerIcon from '../assets/icons/docker.svg'


function projectSection() {
  return (
    <section id="projects" className="relative py-20 bg-white dark:bg-slate-950 overflow-hidden">
      {/* Background Architectural Grid */}
      <div className="absolute inset-0 z-0 opacity-[0.03] dark:opacity-[0.05] pointer-events-none" 
           style={{ backgroundImage: 'linear-gradient(#4f46e5 1px, transparent 1px), linear-gradient(90deg, #4f46e5 1px, transparent 1px)', backgroundSize: '40px 40px' }}>
      </div>

      <div className="max-w-7xl mx-auto px-6 relative z-10">
        
        {/* Header & Tech Dashboard Stack */}
        <div className="grid lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-7">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800 mb-6">
              <Boxes size={14} className="text-indigo-600" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-600">Full-Stack Ecosystem</span>
            </div>
            <h2 className="text-4xl md:text-6xl font-bold text-slate-900 dark:text-white mb-6 tracking-tight">
              Selected <span className="text-transparent bg-clip-text bg-linear-to-r from-indigo-600 to-violet-500">Technologies.</span>
            </h2>
            <p className="text-slate-600 dark:text-slate-400 max-w-xl text-lg leading-relaxed">
              We leverage a high-performance stack to bridge the gap between complex backend logic and seamless frontend experiences.
            </p>
          </div>

          {/* Neo-Brutalist Tech Grid */}
          <div className="lg:col-span-5">
            <div className="grid grid-cols-4 gap-3 p-6 rounded-3xl bg-slate-50/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 backdrop-blur-xl shadow-2xl shadow-indigo-500/5">
              {[PythonIcon, JavascriptIcon, ReactIcon, HTMLIcon, CSSIcon, NodeIcon, TailwindIcon, MongoDBIcon, AWSIcon, PostgreIcon, DockerIcon].map((icon, idx) => (
                <div key={idx} className="aspect-square flex items-center justify-center p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm hover:scale-110 hover:-rotate-3 transition-all cursor-pointer group">
                  <img src={icon} alt="tech" className="w-15 h-15 lg:grayscale lg:group-hover:grayscale-0 lg:transition-all" />
                </div>
              ))}
              <div className="aspect-square flex items-center justify-center p-2 rounded-xl bg-indigo-600 text-white shadow-lg">
                <Terminal size={20} />
              </div>
            </div>
          </div>
        </div>

        {/* Featured Deployments with "Blueprint" Styling */}
        <div className="flex flex-col space-y-12">
          <div className="flex flex-col mt-10 md:flex-row md:items-end justify-between gap-4">
            <div>
              <h2 className="text-4xl font-bold text-slate-900 dark:text-white">
                Featured <span className="italic font-light text-emerald-600">Deployments</span>
              </h2>
              <div className="h-1 w-20 bg-indigo-600 mt-2 rounded-full"></div>
            </div>
            <p className="text-slate-500 font-mono text-sm tracking-tighter uppercase">/ Architecture_Log_2026</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            
            {/* PROJECT 1: DIGITAL LIBRARY */}
            <div className="group relative">
              <div className="absolute -inset-2 bg-linear-to-r from-indigo-500 to-violet-500 rounded-[2.5rem] opacity-0 group-hover:opacity-10 transition-opacity blur-2xl"></div>
              
              <div className="relative rounded-4xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
                {/* Deployment Header */}
                <div className="p-8 pb-0 flex justify-between items-start">
                  <div className="p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600">
                    <Globe size={32} />
                  </div>
                  <div className="flex flex-col items-end">
                    <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                      <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">Active Development</span>
                    </div>
                  </div>
                </div>

                <div className="p-8">
                  <h3 className="text-3xl font-bold text-slate-900 dark:text-white mb-2 group-hover:translate-x-1 transition-transform">
                    LuminaLib
                  </h3>
                  <p className="text-slate-600 dark:text-slate-400 mb-4 leading-relaxed font-light">
                    <span className='italic'> Distributed Book Intelligence Engine</span> | A high-performance e-commerce engine featuring a FastAPI backend. Optimized for sub-second page loads.
                  </p>

                  {/* Tech Labels - Architect Style */}
                  <div className="flex gap-4 mb-4 font-mono text-[10px] text-slate-400">
                    <span className="flex items-center gap-1"><div className="w-1 h-1 bg-indigo-500 rounded-full"></div> REACT_UI</span>
                    <span className="flex items-center gap-1"><div className="w-1 h-1 bg-indigo-500 rounded-full"></div> FAST_API</span>
                    <span className="flex items-center gap-1"><div className="w-1 h-1 bg-indigo-500 rounded-full"></div> PG_SQL</span>
                  </div>

                  <div className="flex items-center gap-8 pt-6 border-t border-slate-100 dark:border-slate-800">
                    <a href="#" className="group/link flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-indigo-600 transition-colors">
                      <Github size={18} /> <span>SOURCE</span>
                    </a>
                    <a href="#" className="flex items-center gap-2 text-sm font-black text-indigo-600">
                      LAUNCH <ArrowRight size={18} className="group-hover:translate-x-2 transition-transform" />
                    </a>
                  </div>
                </div>
              </div>
            </div>

            {/* PROJECT 2: AGENCY PORTFOLIO */}
            <div className="group relative mt-0 md:mt-12"> {/* Asymmetric offset */}
              <div className="absolute -inset-2 bg-linear-to-r from-blue-500 to-cyan-500 rounded-[2.5rem] opacity-0 group-hover:opacity-10 transition-opacity blur-2xl"></div>
              
              <div className="relative rounded-4xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
                <div className="p-8 pb-0 flex justify-between items-start">
                  <div className="p-4 rounded-2xl bg-blue-50 dark:bg-blue-900/30 text-blue-600">
                    <Cpu size={32} />
                  </div>
                  <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20">
                    <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
                    <span className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">Edge: Vercel</span>
                  </div>
                </div>

                <div className="p-8">
                  <h3 className="text-3xl font-bold text-slate-900 dark:text-white mb-2 group-hover:translate-x-1 transition-transform">
                    SaPyBase
                  </h3>
                  <p className="text-slate-600 dark:text-slate-400 mb-4 leading-relaxed font-light">
                    Our internal startup identity. Built with modern glassmorphic UI patterns and high-performance animation.
                  </p>

                  <div className="flex gap-4 mb-4 font-mono text-[10px] text-slate-400">
                    <span className="flex items-center gap-1"><div className="w-1 h-1 bg-blue-500 rounded-full"></div> VITE_JS</span>
                    <span className="flex items-center gap-1"><div className="w-1 h-1 bg-blue-500 rounded-full"></div> TAILWIND</span>
                    <span className="flex items-center gap-1"><div className="w-1 h-1 bg-blue-500 rounded-full"></div> FRAMER</span>
                  </div>

                  <div className="flex items-center gap-8 pt-6 border-t border-slate-100 dark:border-slate-800">
                    <a href="#" className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-blue-600 transition-colors">
                      <Github size={18} /> <span>SOURCE</span>
                    </a>
                    <a href="#" className="flex items-center gap-2 text-sm font-black text-blue-600">
                      LAUNCH <ArrowRight size={18} className="group-hover:translate-x-2 transition-transform" />
                    </a>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </section>
  );
};

export default projectSection;