import { ArrowRight, Code, Server, Shield, Zap } from 'lucide-react';

function heroSection() {
  return (
    <>
      <section id="home" className="relative min-h-screen pt-5 overflow-hidden bg-slate-50 dark:bg-slate-950">
        {/* Background Decorative Element: "The Grid" */}
        <div className="absolute inset-0 z-0 opacity-20 dark:opacity-10 pointer-events-none"
          style={{ backgroundImage: 'radial-gradient(#4f46e5 0.5px, transparent 0.5px)', backgroundSize: '24px 24px' }}>
        </div>

        <main className="relative z-10 max-w-7xl mx-auto px-6 pt-16 lg:pt-16 pb-24">
          <div className="grid lg:grid-cols-2 gap-12 items-center">

            {/* Left Column: The Copy */}
            <div className="space-y-8">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-100 dark:border-indigo-800">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                </span>
                <span className="text-xs font-bold tracking-widest uppercase text-indigo-600 dark:text-indigo-400">
                  Now accepting Q1 2026 Projects
                </span>
              </div>

              <h1 className="text-5xl lg:text-7xl font-extrabold tracking-tight  text-slate-900 dark:text-white leading-[1.1]">
                Engineering Digital Excellence from <span className="text-transparent bg-clip-text bg-linear-to-r from-indigo-600 to-violet-500 font-questrial">Code to Cloud.</span>
              </h1>

              <p className="max-w-xl text-lg font-light lg:text-xl text-slate-600 dark:text-slate-400 leading-relaxed">
                We don't just build websites. We architect, develop, and deploy high-performance web applications tailored for the next generation of startups.
              </p>

              <div className="flex flex-col sm:flex-row gap-4">
                <button className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-4 rounded-xl font-bold transition-all hover:shadow-lg hover:shadow-indigo-200 active:scale-95">
                  Launch Your Project <ArrowRight size={20} />
                </button>
                <button className="flex items-center justify-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white px-8 py-4 rounded-xl font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-all">
                  View Architecture
                </button>
              </div>
            </div>

            {/* Right Column: The Visual "Architecture" */}
            <div className="relative hidden lg:block">
              <div className="relative z-10 bottom-12.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 shadow-2xl">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 space-y-3">
                    <div className="p-2 w-fit rounded-lg bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600">
                      <Code size={24} />
                    </div>
                    <h3 className="font-bold dark:text-white">Clean Code</h3>
                    <p className="text-xs text-slate-500">Modular Python & React components built for scale.</p>
                  </div>
                  <div className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 space-y-3 mt-8">
                    <div className="p-2 w-fit rounded-lg bg-violet-100 dark:bg-violet-900/50 text-violet-600">
                      <Server size={24} />
                    </div>
                    <h3 className="font-bold dark:text-white font-questrial">Deployment</h3>
                    <p className="text-xs text-slate-500">Serverless AWS architecture & CI/CD pipelines.</p>
                  </div>
                  <div className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 space-y-3">
                    <div className="p-2 w-fit rounded-lg bg-blue-100 dark:bg-blue-900/50 text-blue-600">
                      <Zap size={24} />
                    </div>
                    <h3 className="font-bold dark:text-white">Optimization</h3>
                    <p className="text-xs text-slate-500">Lightning fast load times & SEO focused.</p>
                  </div>
                  <div className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 space-y-3 mt-5">
                    <div className="p-2 w-fit rounded-lg bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600">
                      <Shield size={24} />
                    </div>
                    <h3 className="font-bold dark:text-white">Security</h3>
                    <p className="text-xs text-slate-500">Hardened PostgreSQL & IAM security protocols.</p>
                  </div>
                </div>
              </div>
              {/* Soft decorative glow */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 bg-indigo-500/20 blur-[120px] rounded-full"></div>
            </div>

          </div>
        </main>
      </section>
    </>
  )
}

export default heroSection