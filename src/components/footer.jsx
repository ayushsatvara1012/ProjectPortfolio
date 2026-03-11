
import { Terminal, Github, Linkedin, Twitter, ArrowUpRight, Mail, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const ModernFooter = () => {
  const navigate = useNavigate();
  const navigateToPages = [
    { name: "Home", href: "#home" },
    { name: "Projects", href: "#projects" },
    { name: "Services", href: "#services" },
    { name: "Process", href: "#process" },
    { name: "About", href: "/about" },
    { name: "Contact", href: "/contact" },
  ]
  const stackList = [
    { name: "React 19 / Next.js 16" },
    { name: "Python 3.12 / FastAPI" },
    { name: "PostgreSQL / Supabase" },
    { name: "Tailwind CSS " },
    { name: "Framer Motion " },
    { name: "AWS" },
    { name: "Docker / Kubernetes" },
    { name: "Git / GitHub" }

  ]

  const handleLinkClick = (e, href) => {
    e.preventDefault();
    if (href.startsWith("#")) {
      const targetId = href.substring(1);
      if (window.location.pathname === "/") {
        const targetElement = document.getElementById(targetId);
        if (targetElement) {
          targetElement.scrollIntoView({ behavior: "smooth" });
        }
      } else {
        navigate("/");
        setTimeout(() => {
          const targetElement = document.getElementById(targetId);
          if (targetElement) {
            targetElement.scrollIntoView({ behavior: "smooth" });
          }
        }, 100);
      }
    } else {
      navigate(href);
    }
  };

  return (
    <footer className="relative bg-white dark:bg-slate-950 pt-24 pb-12 overflow-hidden border-t border-slate-200 dark:border-slate-900 transition-colors">
      {/* Background Mesh Glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-px bg-linear-to-r from-transparent via-indigo-500/20 dark:via-indigo-500 to-transparent opacity-50" />
      <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-96 h-96 bg-indigo-600/5 dark:bg-indigo-600/20 blur-[120px] rounded-full" />

      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-10">

          {/* Big CTA Branding Box (The Bento Style) */}
          <div className="lg:col-span-5 p-8 rounded-3xl bg-linear-to-r from-indigo-100 to-violet-100 inset-shadow-sm inset-shadow-indigo-500/50 dark:from-slate-900/50 dark:to-slate-900/50 border border-slate-200 dark:border-slate-800 backdrop-blur-sm flex flex-col justify-between group hover:border-indigo-500/50 transition-all duration-500">
            <div>
              <div className="flex items-center gap-2 mb-6">
                <div className="bg-white dark:bg-slate-900/70 dark:border-slate-800 p-2 rounded-xl border border-slate-200">
                  <Terminal className="w-6 h-6 text-indigo-600" />
                </div>
                <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                  Sapybase<span className="text-indigo-500">.</span>
                </span>
              </div>
              <h2 className="text-3xl font-bold text-slate-900 dark:text-white leading-tight">
                Ready to architect your <br />
                <span className="text-slate-400 dark:text-slate-500 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">next digital frontier?</span>
              </h2>
            </div>

            <div className="mt-10 flex flex-wrap gap-4">
              <button
                onClick={() => navigate('/services')}
                className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-6 py-3 rounded-full font-bold flex items-center gap-2 hover:bg-slate-800 dark:hover:bg-slate-50 transition-all active:scale-95 shadow-lg shadow-slate-200/50 dark:shadow-none"
              >
                Start Project <Zap size={18} fill="currentColor" />
              </button>
              <a href="mailto:ayushsatvara2002@gmail.com" className="w-12 h-12 rounded-full border border-indigo-200 dark:border-slate-700 text-slate-600 dark:text-white hover:bg-slate-50 dark:hover:bg-slate-800 transition-all flex items-center justify-center">
                <Mail size={20} />
              </a>
            </div>
          </div>

          {/* Navigation Links Grid */}
          <div className="lg:col-span-7 grid grid-cols-2 md:grid-cols-3 gap-8 p-4">
            <div className="space-y-6">
              <h4 className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-500">Platform</h4>
              <ul className="space-y-1">
                {navigateToPages.map((link) => (
                  <li key={link.name}>
                    <a
                      href={link.href}
                      onClick={(e) => handleLinkClick(e, link.href)}
                      className="text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-white transition-colors text-sm flex items-center gap-1 group py-3"
                    >
                      {link.name} <ArrowUpRight size={12} className="opacity-0 group-hover:opacity-100 transition-all" />
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-6">
              <h4 className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-500">Stack</h4>
              <ul className="space-y-3 text-sm text-slate-500 dark:text-slate-400">
                {stackList.map((stack) => (
                  <li key={stack.name} className="hover:text-slate-900 dark:hover:text-white transition-colors cursor-default">
                    {stack.name}
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-6 col-span-2 md:col-span-1">
              <h4 className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-500">Social</h4>
              <div className="flex gap-4">
                {[
                  { 
                    Icon: Github, 
                    href: "https://github.com/ayushsatvara1012", 
                    hover: "hover:text-slate-950 hover:border-slate-950 dark:hover:text-white dark:hover:border-slate-600" 
                  },
                  { 
                    Icon: Linkedin, 
                    href: "https://www.linkedin.com/in/ayushsatvara", 
                    hover: "hover:text-blue-600 hover:border-blue-600 dark:hover:text-blue-400 dark:hover:border-blue-400/50" 
                  },
                ].map((social, i) => (
                  <a 
                    key={i} 
                    href={social.href} 
                    className={`w-12 h-12 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400 transition-all shadow-sm ${social.hover}`}
                  >
                    <social.Icon size={20} />
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Section */}
        <div className="flex flex-col md:flex-row justify-between items-center pt-8 border-t border-slate-100 dark:border-slate-900 text-slate-500 text-xs">
          <p>© 2026 Sapybase LLC — Engineered with precision.</p>
          <div className="flex gap-6 mt-4 md:mt-0">
            <a href="/privacy-policy" className="hover:text-slate-900 dark:hover:text-white transition-colors py-3 px-3">Privacy</a>
            <a href="/terms-and-conditions" className="hover:text-slate-900 dark:hover:text-white transition-colors py-3 px-3">Terms</a>
            <span className="text-slate-300 dark:text-slate-800 place-content-center">|</span>
            <span className="flex items-center gap-1">
              Status: <span className="text-emerald-500/80 dark:text-emerald-500 font-bold">Systems Operational</span>
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default ModernFooter;