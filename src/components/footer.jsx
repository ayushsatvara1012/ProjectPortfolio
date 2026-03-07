
import { Terminal, Github, Linkedin, Twitter, ArrowUpRight, Mail, Zap } from 'lucide-react';

const ModernFooter = () => {
  return (
    <footer className="relative bg-slate-950 pt-24 pb-12 overflow-hidden">
      {/* Background Mesh Glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-px bg-linear-to-r from-transparent via-indigo-500 to-transparent opacity-50" />
      <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-96 h-96 bg-indigo-600/20 blur-[120px] rounded-full" />

      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-20">

          {/* Big CTA Branding Box (The Bento Style) */}
          <div className="lg:col-span-5 p-8 rounded-3xl bg-slate-900/50 border border-slate-800 backdrop-blur-sm flex flex-col justify-between group hover:border-indigo-500/50 transition-all duration-500">
            <div>
              <div className="flex items-center gap-2 mb-6">
                <div className="bg-indigo-600 p-2 rounded-xl shadow-lg shadow-indigo-500/20">
                  <Terminal className="w-6 h-6 text-white" />
                </div>
                <span className="text-2xl font-bold tracking-tight text-white">
                  SaPy<span className="text-indigo-500">.</span>IO
                </span>
              </div>
              <h2 className="text-3xl font-bold text-white leading-tight">
                Ready to architect your <br />
                <span className="text-slate-500 group-hover:text-indigo-400 transition-colors">next digital frontier?</span>
              </h2>
            </div>

            <div className="mt-10 flex flex-wrap gap-4">
              <button className="bg-white text-slate-950 px-6 py-3 rounded-full font-bold flex items-center gap-2 hover:bg-indigo-500 hover:text-white transition-all active:scale-95">
                Start Project <Zap size={18} fill="currentColor" />
              </button>
              <a href="mailto:hello@startup.io" className="p-3 rounded-full border border-slate-700 text-white hover:bg-slate-800 transition-all">
                <Mail size={20} />
              </a>
            </div>
          </div>

          {/* Navigation Links Grid */}
          <div className="lg:col-span-7 grid grid-cols-2 md:grid-cols-3 gap-8 p-4">
            <div className="space-y-6">
              <h4 className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-500">Platform</h4>
              <ul className="space-y-4">
                {['Home', 'Projects', 'Services', 'Process'].map((link) => (
                  <li key={link}>
                    <a href={`#${link.toLowerCase()}`} className="text-slate-400 hover:text-white transition-colors text-sm flex items-center gap-1 group">
                      {link} <ArrowUpRight size={12} className="opacity-0 group-hover:opacity-100 transition-all" />
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-6">
              <h4 className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-500">Stack</h4>
              <ul className="space-y-4 text-sm text-slate-400">
                <li className="hover:text-white transition-colors cursor-default">React / Vite</li>
                <li className="hover:text-white transition-colors cursor-default">FastAPI / Python</li>
                <li className="hover:text-white transition-colors cursor-default">AWS / Cloud</li>
                <li className="hover:text-white transition-colors cursor-default">PostgreSQL</li>
              </ul>
            </div>

            <div className="space-y-6 col-span-2 md:col-span-1">
              <h4 className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-500">Social</h4>
              <div className="flex gap-4">
                {[
                  { Icon: Github, href: "https://github.com/ayushsatvara1012" },
                  { Icon: Linkedin, href: "ww.linkedin.com/in/ayush-piyushkumar-satvara-39ba66196" },
                  { Icon: Twitter, href: "#" }
                ].map((social, i) => (
                  <a key={i} href={social.href} className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 hover:text-indigo-400 hover:border-indigo-400/50 transition-all">
                    <social.Icon size={20} />
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Section */}
        <div className="flex flex-col md:flex-row justify-between items-center pt-8 border-t border-slate-900 text-slate-500 text-xs">
          <p>© 2026 SaPyBase — Engineered with precision.</p>
          <div className="flex gap-6 mt-4 md:mt-0">
            <a href="#" className="hover:text-white transition-colors">Privacy</a>
            <a href="#" className="hover:text-white transition-colors">Terms</a>
            <span className="text-slate-800">|</span>
            <span className="flex items-center gap-1">
              Status: <span className="text-emerald-500 font-bold">Systems Operational</span>
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default ModernFooter;