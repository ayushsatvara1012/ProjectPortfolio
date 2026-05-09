'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { Github, Linkedin, ArrowUpRight, Zap, Activity } from 'lucide-react';

const InteractiveSchematic = dynamic(() => import('./InteractiveSchematic'), { ssr: false });

const navLinks = [
  { name: 'Home', href: '#home' },
  { name: 'Projects', href: '#projects' },
  { name: 'Services', href: '#services' },
  { name: 'Process', href: '#process' },
  { name: 'About', href: '/about' },
  { name: 'Contact', href: '/contact' },
];

const stackList = [
  'React 19 / Next.js',
  'Python 3.12 / FastAPI',
  'PostgreSQL / Supabase',
  'Tailwind CSS v4',
  'Lucide / Framer',
  'AWS Cloud',
  'Docker Container',
  'Git Workflow',
];

export default function Footer() {
  const router = useRouter();
  const pathname = usePathname();

  const handleLinkClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    e.preventDefault();
    if (href.startsWith('#')) {
      const id = href.substring(1);
      if (pathname === '/') {
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
      } else {
        router.push('/');
        setTimeout(() => {
          document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      }
    } else {
      router.push(href);
    }
  };

  return (
    <footer className="bg-white border-x border-gray-100 dark:border-slate-800 overflow-hidden dark:bg-slate-950">
      <div className="max-w-8xl mx-auto">
        <div className="grid grid-cols-1 min-[1011px]:grid-cols-12 gap-px bg-gray-200 dark:bg-slate-800 border-x border-gray-200 dark:border-slate-800">

          {/* Branding cell */}
          <div className="min-[1011px]:col-span-5 bg-white dark:bg-slate-950 p-12 min-[1011px]:p-16 flex flex-col justify-between gap-12 group/brand relative overflow-hidden transition-colors">
            <InteractiveSchematic />
            <div className="space-y-8 relative z-10">
              <div className="flex items-center gap-3">
                <span className="text-xl min-[1011px]:text-2xl font-display font-bold text-slate-900 dark:text-slate-200 uppercase">
                  SaPy<span className="text-blue-600">Base</span>
                </span>
                <div className="h-px w-8 bg-gray-100 dark:bg-slate-800" />
                <span className="text-sm uppercase tracking-widest font-bold text-slate-600 dark:text-slate-400 font-sans">Protocol_V4.2</span>
              </div>
              <h2 className="text-4xl min-[1011px]:text-5xl font-display font-bold tracking-tight text-slate-900 dark:text-slate-200 uppercase">
                Ready to architect your <br />
                <span className="text-slate-600 dark:text-slate-400 transition-colors duration-500 group-hover/brand:text-transparent bg-clip-text bg-linear-to-r from-orange-600 via-green-600 to-blue-600">
                  next Digital Frontier?
                </span>
              </h2>
            </div>
            <div className="flex flex-wrap gap-4 relative z-10">
              <button
                onClick={() => router.push('/services')}
                className="bg-slate-900 dark:bg-blue-600 text-white px-8 py-4 rounded-none text-sm uppercase tracking-widest font-bold font-sans hover:bg-blue-600 dark:hover:bg-blue-500 transition-all active:scale-95 flex items-center gap-3 group/btn"
              >
                Start_Project <Zap size={14} className="opacity-40 group-hover/btn:opacity-100" />
              </button>
            </div>
          </div>

          {/* Navigation grid */}
          <div className="min-[1011px]:col-span-7 grid grid-cols-1 sm:grid-cols-3 gap-px bg-gray-200 dark:bg-slate-800">

            {/* Platform */}
            <div className="bg-white dark:bg-slate-950 p-10 min-[1011px]:p-12 space-y-10 group/cell transition-colors duration-500 hover:bg-slate-50/50 dark:hover:bg-slate-900/50">
              <div className="flex items-center gap-2 text-sm uppercase tracking-widest font-bold text-slate-600 dark:text-slate-400 font-sans">
                <div className="h-1.5 w-1.5 rounded-none bg-blue-600" />
                <span>Platform</span>
              </div>
              <ul className="space-y-4">
                {navLinks.map((link, idx) => (
                  <li key={idx}>
                    <a
                      href={link.href}
                      onClick={(e) => handleLinkClick(e, link.href)}
                      className="text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all text-sm uppercase tracking-widest font-bold font-sans flex items-center justify-between group/link"
                    >
                      {link.name}
                      <ArrowUpRight size={12} className="opacity-0 group-hover/link:opacity-100 transition-all translate-y-1 group-hover/link:translate-y-0" />
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Tech Stack */}
            <div className="bg-white dark:bg-slate-950 p-10 min-[1011px]:p-12 space-y-10 group/cell transition-colors duration-500 hover:bg-slate-50/50 dark:hover:bg-slate-900/50">
              <div className="flex items-center gap-2 text-sm uppercase tracking-widest font-bold text-slate-600 dark:text-slate-400 font-sans">
                <div className="h-1.5 w-1.5 rounded-none bg-slate-900 dark:bg-slate-200" />
                <span>Tech_Stack</span>
              </div>
              <ul className="space-y-4">
                {stackList.map((name, idx) => (
                  <li key={idx} className="text-slate-600 dark:text-slate-400 text-sm uppercase tracking-widest font-bold font-sans cursor-default hover:text-slate-900 dark:hover:text-slate-200 transition-colors">
                    {name}
                  </li>
                ))}
              </ul>
            </div>

            {/* Social */}
            <div className="bg-white dark:bg-slate-950 p-6 min-[1011px]:p-12 space-y-6 min-[1011px]:space-y-10 group/cell transition-colors duration-500 hover:bg-slate-50/50 dark:hover:bg-slate-900/50 relative overflow-hidden">
              <div className="flex items-center gap-2 text-sm uppercase tracking-widest font-bold text-slate-600 dark:text-slate-400 font-sans relative z-10">
                <div className="h-1.5 w-1.5 rounded-none bg-emerald-500" />
                <span>Social_Net</span>
              </div>
              <div className="flex flex-col gap-8 relative z-10">
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-gray-200 dark:bg-slate-800 border border-gray-100 dark:border-slate-800">
                    {[
                      { Icon: Github, href: 'https://github.com/ayushsatvara1012', label: 'GIT' },
                      { Icon: Linkedin, href: 'https://www.linkedin.com/in/ayushsatvara', label: 'LNK' },
                    ].map((social, i) => (
                      <a
                        key={i}
                        href={social.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-white dark:bg-slate-950 p-6 flex flex-row min-[1011px]:flex-col items-center justify-center text-slate-600 dark:text-slate-400 hover:bg-slate-900 dark:hover:bg-slate-800 hover:text-white transition-all gap-2 group/social"
                      >
                        <social.Icon size={18} className="opacity-40 group-hover/social:opacity-100" />
                        <span className="text-sm uppercase tracking-widest font-bold font-sans">{social.label}</span>
                      </a>
                    ))}
                  </div>
                </div>
                <div className="space-y-6">
                  <div className="space-y-2">
                    <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-slate-400 dark:text-slate-600">Connect_Direct</p>
                    <a
                      href="mailto:ayushsatvara2002@gmail.com"
                      className="text-sm font-display font-medium text-slate-900 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-400 break-all transition-colors block"
                    >
                      ayushsatvara2002@gmail.com
                    </a>
                  </div>
                  <div className="space-y-2">
                    <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-slate-400 dark:text-slate-600">Operations_Base</p>
                    <p className="text-sm font-display font-medium text-slate-700 dark:text-slate-300 leading-relaxed">
                      Sapybase LLC <br />
                      Jersey City, NJ 07306
                    </p>
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* Bottom legend row */}
          <div className="min-[1011px]:col-span-12 bg-white dark:bg-slate-950 px-6 py-4 min-[1011px]:px-8 min-[1011px]:py-4 border-t border-white dark:border-slate-800 flex flex-col min-[1011px]:flex-row justify-between items-center gap-6">
            <div className="flex flex-col min-[1011px]:flex-row items-center gap-6 text-sm uppercase tracking-widest font-bold text-slate-600 dark:text-slate-400 font-sans">
              <p className="text-center">© 2026 Sapybase LLC — ENGINEERED WITH PRECISION.</p>
              <div className="hidden min-[1011px]:block h-px w-6 bg-gray-200 dark:bg-slate-800" />
              <div className="flex gap-6">
                <Link href="/privacy-policy" className="hover:text-slate-900 dark:hover:text-slate-200 transition-colors">PRIVACY</Link>
                <Link href="/terms-and-conditions" className="hover:text-slate-900 dark:hover:text-slate-200 transition-colors">TERMS</Link>
              </div>
            </div>
            <div>
                <a href="https://fazier.com/launches/www.sapybase.com" target="_blank"><img src="https://fazier.com/api/v1//public/badges/launch_badges.svg?badge_type=launched&theme=neutral" width={120} alt="Fazier badge" /></a>
            </div>
            <div className="flex items-center gap-3">
              <Activity size={14} className="text-emerald-500" />
              <span className="text-sm uppercase tracking-widest font-bold text-slate-900 dark:text-slate-200 font-sans">
                Status: <span className="text-emerald-600">Operational</span>
              </span>
            </div>
          </div>

          

        </div>
      </div>
    </footer>
  );
}
