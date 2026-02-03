// import Github from '../assets/github-logo.png'
import { Github, ExternalLink, ArrowRight, Server, Globe, Cpu } from 'lucide-react';
function projectSection() {
  return (
    <section className="py-24 bg-white dark:bg-slate-950">
      <div className="max-w-7xl mx-auto px-6">

        {/* Section Header */}
        <div className="mb-12.5">
          <h2 className="text-3xl md:text-5xl font-bold text-slate-900 dark:text-white mb-4">
            Selected <span className="text-indigo-600">Architectures.</span>
          </h2>
          <p className="text-slate-600 dark:text-slate-400 max-w-2xl text-lg">
            A look into the systems we've designed, developed, and deployed. From modular frontends to scalable backends.
          </p>
        </div>
        {/* Featured Deployment */}
        <section id="projects" className="py-20 rounded-2xl bg-slate-50 dark:bg-slate-950 px-6">
          <div className="max-w-7xl mx-auto">

            {/* Section Heading */}
            <div className="mb-12">
              <h2 className="text-4xl font-bold text-slate-900 dark:text-white">Featured <span className='text-green-600'>Deployments</span></h2>
              <p className="text-slate-500 mt-2">Manual selection of our most robust architectures.</p>
            </div>

            {/* Manual Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

              {/* PROJECT 1: BOOK STORE */}
              <div className="group relative overflow-hidden rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 transition-all hover:shadow-2xl">
                {/* Deployment Badge */}
                <div className="absolute top-5 right-5 z-20">
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50/90 dark:bg-emerald-900/20 backdrop-blur-md border border-emerald-200 dark:border-emerald-800">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-700 dark:text-emerald-400">Live on AWS</span>
                  </div>
                </div>

                <div className="p-8">
                  <div className="mb-6 inline-flex p-3 rounded-2xl bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600">
                    <Globe size={28} />
                  </div>

                  <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-3 group-hover:text-indigo-600 transition-colors">
                    Digital Book Store
                  </h3>

                  <p className="text-slate-600 dark:text-slate-400 mb-6 leading-relaxed">
                    A high-performance e-commerce engine featuring a FastAPI backend and PostgreSQL. Optimized for sub-second page loads and secure transactions.
                  </p>

                  {/* Static Tech Stack */}
                  <div className="flex flex-wrap gap-2 mb-8">
                    <span className="px-3 py-1 text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-md">REACT</span>
                    <span className="px-3 py-1 text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-md">FASTAPI</span>
                    <span className="px-3 py-1 text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-md">POSTGRESQL</span>
                  </div>

                  <div className="flex items-center justify-around gap-6 pt-6 border-t border-slate-100 dark:border-slate-800">
                    <a href="https://github.com/your-repo" className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors">
                      <Github size={18} /> Source Code
                    </a>
                    <a href="https://live-demo.com" className="flex items-center gap-1 text-sm font-bold text-indigo-600 hover:gap-3 transition-all">
                      View Project <ArrowRight size={16} />
                    </a>
                  </div>
                </div>
              </div>

              {/* PROJECT 2: PORTFOLIO / STARTUP SITE */}
              <div className="group relative overflow-hidden rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 transition-all hover:shadow-2xl">
                {/* Deployment Badge */}
                <div className="absolute top-5 right-5 z-20">
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50/90 dark:bg-blue-900/20 backdrop-blur-md border border-blue-200 dark:border-blue-800">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-blue-700 dark:text-blue-400">Deployed: Vercel</span>
                  </div>
                </div>

                <div className="p-8">
                  <div className="mb-6 inline-flex p-3 rounded-2xl bg-blue-50 dark:bg-blue-900/30 text-blue-600">
                    <Cpu size={28} />
                  </div>

                  <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-3 group-hover:text-blue-600 transition-colors">
                    Agency Portfolio
                  </h3>

                  <p className="text-slate-600 dark:text-slate-400 mb-6 leading-relaxed">
                    Our internal startup identity. Built with a mobile-first approach, focusing on performance scores and modern glassmorphic UI patterns.
                  </p>

                  {/* Static Tech Stack */}
                  <div className="flex flex-wrap gap-2 mb-8">
                    <span className="px-3 py-1 text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-md">VITE</span>
                    <span className="px-3 py-1 text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-md">TAILWIND</span>
                    <span className="px-3 py-1 text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-md">FRAMER MOTION</span>
                  </div>

                  <div className="flex items-center justify-around gap-6 pt-6 border-t border-slate-100 dark:border-slate-800">
                    <a href="https://github.com/your-repo" className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors">
                      <Github size={18} /> Source Code
                    </a>
                    <a href="https://live-demo.com" className="flex items-center gap-1 text-sm font-bold text-indigo-600 hover:gap-3 transition-all">
                      View Project <ArrowRight size={16} />
                    </a>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </section>
      </div>
    </section>
  );
};

export default projectSection;