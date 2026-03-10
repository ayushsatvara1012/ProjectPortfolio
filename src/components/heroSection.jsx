import { ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

function heroSection() {
  const navigate = useNavigate();
  return (
    <>
      <section id="home" className="relative min-h-screen overflow-hidden bg-slate-50 dark:bg-slate-950">
        {/* Optimized Grid: Using a fixed opacity and CSS variable for faster painting */}
        <div className="absolute inset-0 z-0 opacity-15 pointer-events-none will-change-transform"
          style={{
            backgroundImage: 'radial-gradient(#4f46e5 0.5px, transparent 0.5px)',
            backgroundSize: '24px 24px',
            /* Hint the browser that this layer is static */
            willChange: 'transform'
          }}>
        </div>

        <main className="min-h-screen relative z-10 max-w-7xl mx-auto px-6 pt-16 lg:pt-16 pb-12">
          <div className="grid lg:grid-cols-2 gap-12 items-center">

            {/* Left Column: The Copy */}
            <div className="space-y-10 mt-5 lg:mt-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-100 dark:border-indigo-800">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                </span>
                <span className="text-xs font-bold tracking-widest uppercase text-indigo-600 dark:text-indigo-400">
                  Now accepting Q1 2026 Projects
                </span>
              </div>

              {/* LCP Target: Use standard gradient syntax for better browser compatibility */}
              <h1 className="text-5xl sm:text-center lg:text-7xl lg:text-start font-extrabold tracking-tight text-slate-900 dark:text-white leading-[1.1]">
                Engineering Digital Excellence from <span className="text-transparent bg-clip-text bg-linear-to-r from-indigo-600 to-violet-500 font-questrial">Code to Cloud.</span>
              </h1>

              <p className="max-w-xl text-lg font-light sm:max-w-screen sm:text-center lg:text-start lg:text-xl text-slate-600 dark:text-slate-400 leading-relaxed">
                We don't just build websites. We architect, develop, and deploy high-performance web applications tailored for the next generation of startups.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 sm:place-content-center">
                <button 
                  onClick={() => navigate('/services')}
                  className="flex items-center justify-center gap-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-8 py-4 rounded-xl font-bold hover:bg-slate-800 dark:hover:bg-slate-50 transition-all active:scale-95 shadow-xl shadow-slate-200/50 dark:shadow-none"
                >
                  Launch Your Project <ArrowRight size={20} />
                </button>
                <button className="flex items-center justify-center gap-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 px-8 py-4 rounded-xl font-bold hover:bg-slate-50 dark:hover:bg-slate-900 transition-all">
                  View Architecture
                </button>
              </div>
            </div>

            {/* Right Column: Optimized with Inline SVGs for immediate paint */}
            <div className="relative hidden sm:block lg:block">


              <div className="relative z-10 bottom-12.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 shadow-2xl sm:mt-15">
                {/* background dotted grid */}
                <div className="absolute z-10 top-5 right-5 w-3 h-3 rounded-full  group-hover:bg-indigo-600/10 transition-colors duration-700 bg-green-500 " />
                <div className="absolute z-10 top-5 right-10 w-3 h-3 rounded-full  group-hover:bg-indigo-600/10 transition-colors duration-700 bg-yellow-500 " />
                <div className="absolute z-10 top-5 right-15 w-3 h-3 rounded-full  group-hover:bg-indigo-600/10 transition-colors duration-700 bg-red-500 " />
                <div className="grid grid-cols-2 gap-4">
                  {/* Card 1: Code */}
                  <div className="z-20 p-6 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 space-y-3">
                    <div className="p-2 w-fit rounded-lg bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>
                    </div>
                    <h3 className="font-bold dark:text-white">Clean Code</h3>
                    <p className="text-xs text-slate-500">Modular Python & React components built for scale.</p>
                  </div>

                  {/* Card 2: Server */}
                  <div className="z-20 p-6 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 space-y-3 mt-8">
                    <div className="p-2 w-fit rounded-lg bg-violet-100 dark:bg-violet-900/50 text-violet-600">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="8" rx="2" ry="2"></rect><rect x="2" y="14" width="20" height="8" rx="2" ry="2"></rect><line x1="6" y1="6" x2="6.01" y2="6"></line><line x1="6" y1="18" x2="6.01" y2="18"></line></svg>
                    </div>
                    <h3 className="font-bold dark:text-white">Deployment</h3>
                    <p className="text-xs text-slate-500">Serverless AWS architecture & CI/CD pipelines.</p>
                  </div>

                  {/* Card 3: Optimization */}
                  <div className="z-20 p-6 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 space-y-3">
                    <div className="p-2 w-fit rounded-lg bg-blue-100 dark:bg-blue-900/50 text-blue-600">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"></path></svg>
                    </div>
                    <h3 className="font-bold dark:text-white">Optimization</h3>
                    <p className="text-xs text-slate-500">Lightning fast load times & SEO focused.</p>
                  </div>

                  {/* Card 4: Security */}
                  <div className="z-20 p-6 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 space-y-3 mt-5">
                    <div className="p-2 w-fit rounded-lg bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
                    </div>
                    <h3 className="font-bold dark:text-white">Security</h3>
                    <p className="text-xs text-slate-500">Hardened PostgreSQL & IAM security protocols.</p>
                  </div>
                </div>
              </div>
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 bg-indigo-500/20 blur-[120px] rounded-full"></div>
            </div>

          </div>
        </main>
      </section >
    </>
  )
}

export default heroSection