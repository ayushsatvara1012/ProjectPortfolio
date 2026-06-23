'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { ArrowUpRight, Zap, Activity } from 'lucide-react';

const InteractiveSchematic = dynamic(() => import('./InteractiveSchematic'), { ssr: false });

const navLinks = [
  { name: 'Home', href: '#home' },
  { name: 'Projects', href: '#projects' },
  { name: 'Services', href: '#services' },
  { name: 'Process', href: '#process' },
  { name: 'About', href: '/about' },
  { name: 'Contact', href: '/contact' },
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
                <span className="text-xl min-[1011px]:text-2xl font-google font-medium text-slate-900 dark:text-slate-200">
                  Sapy<span className="text-blue-600">base</span>
                </span>
                <div className="h-px w-8 bg-gray-100 dark:bg-slate-800" />
                <span className="text-sm tracking-widest font-normal text-slate-600 dark:text-slate-400 font-google">Protocol_V4.2</span>
              </div>
              <h2 className="text-4xl min-[1011px]:text-5xl font-google font-medium text-slate-900 dark:text-slate-200">
                Join us to build the <br />
                <span className="text-slate-600 dark:text-slate-400 transition-colors duration-500 group-hover/brand:text-transparent bg-clip-text bg-linear-to-r from-red-600 to-blue-700">
                  future of AI
                </span>
              </h2>
            </div>
            <div className="flex flex-wrap gap-4 relative z-10">
              <button
                onClick={() => router.push('/contact')}
                className="bg-slate-900 dark:bg-blue-600 text-white px-8 py-4 rounded-full text-base tracking-wider font-google font-normal hover:bg-blue-600 dark:hover:bg-blue-500 transition-all active:scale-95 flex items-center gap-3 group/btn"
              >
                Contact Us <Zap size={14} className="opacity-40 group-hover/btn:opacity-100" />
              </button>
            </div>
          </div>

          {/* Navigation grid */}
          <div className="min-[1011px]:col-span-7 grid grid-cols-1 sm:grid-cols-3 gap-px bg-gray-200 dark:bg-slate-800">

            {/* Platform */}
            <div className="bg-white dark:bg-slate-950 p-10 min-[1011px]:p-12 space-y-10">
              <div className="flex items-center gap-2 text-sm tracking-widest font-bold text-slate-600 dark:text-slate-400 font-google">
                <div className="h-1.5 w-1.5 rounded-none bg-blue-600" />
                <span className='font-normal font-google text-base tracking-wider text-slate-900 dark:text-slate-200'>Platform</span>
              </div>
              <ul className="space-y-4">
                {navLinks.map((link, idx) => (
                  <li key={idx}>
                    <a
                      href={link.href}
                      onClick={(e) => handleLinkClick(e, link.href)}
                      className="text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-600 transition-all text-sm tracking-wider font-normal font-google flex items-center justify-between group/link"
                    >
                      {link.name}
                      <ArrowUpRight size={12} className="opacity-0 group-hover/link:opacity-100 transition-all translate-y-1 group-hover/link:translate-y-0" />
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Launched On */}
            <div className="bg-white dark:bg-slate-950 p-10 min-[1011px]:p-12 space-y-10 group/cell transition-colors">
              <div className="flex items-center gap-2 text-sm tracking-widest font-bold text-slate-600 dark:text-slate-400 font-google">
                <div className="h-1.5 w-1.5 rounded-none bg-orange-500" />
                <span className='font-normal font-google text-base tracking-wider text-slate-900 dark:text-slate-200'>Launched On</span>
              </div>
              <div className="flex flex-col gap-5 cursor-pointer items-center justify-around">
                {/* Product Hunt — light/dark themed variants */}
                <a
                  href="https://www.producthunt.com/products/sapybase?embed=true&utm_source=badge-featured&utm_medium=badge&utm_campaign=badge-vaayu-intelligence"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block"
                >
                  <img
                    alt="Vaayu Intelligence - Intelligence Integrated | Product Hunt"
                    width={250}
                    height={54}
                    loading="lazy"
                    decoding="async"
                    className="h-auto w-full max-w-[220px] dark:hidden"
                    src="https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=1179236&theme=light&t=1782237888926"
                  />
                  <img
                    alt="Vaayu Intelligence - Intelligence Integrated | Product Hunt"
                    width={250}
                    height={54}
                    loading="lazy"
                    decoding="async"
                    className="hidden h-auto w-full max-w-[220px] dark:block"
                    src="https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=1179236&theme=neutral&t=1782237888926"
                  />
                </a>
                {/* Fazier */}
                <a href="https://fazier.com/launches/vaayu" target="_blank"><img src="https://fazier.com/api/v1/public/badges/embed_image.svg?launch_id=9650&badge_type=daily&variant=2&theme=light" width="270" alt="Fazier badge" /></a>
                <a
                  href="https://fazier.com/launches/www.sapybase.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block"
                >
                  <img
                    src="https://fazier.com/api/v1/public/badges/embed_image.svg?launch_id=9650&badge_type=featured&theme=light"
                    width={120}
                    height={51}
                    loading="lazy"
                    decoding="async"
                    alt="Sapybase launch on Fazier"
                    className="h-auto w-auto"
                  />
                </a>
              </div>
            </div>

            {/* Social */}
            <div className="bg-white dark:bg-slate-950 p-6 min-[1011px]:p-12 space-y-6 min-[1011px]:space-y-10 relative overflow-hidden">
              <div className="flex items-center gap-2 text-sm tracking-widest font-bold text-slate-600 dark:text-slate-400 font-google relative z-10">
                <div className="h-1.5 w-1.5 rounded-none bg-emerald-500" />
                <span className='font-normal font-google text-base tracking-wider text-slate-900 dark:text-slate-200'>Social Network</span>
              </div>
              <div className="flex flex-col gap-8 relative z-10">
                <ul className="space-y-4">
                  {[
                    { icon: 'code', href: 'https://github.com/ayushsatvara1012', label: 'ayushsatvara1012', external: true },
                    { icon: 'work', href: 'https://www.linkedin.com/in/ayushsatvara', label: '/ayushsatvara', external: true },
                    { icon: 'mail', href: 'mailto:ayush@sapybase.com', label: 'ayush@sapybase.com', external: false },
                    { icon: 'call', href: 'tel:+15626681855', label: '+1 562 668 1855', external: false },
                  ].map((social, i) => (
                    <li key={i}>
                      <a
                        href={social.href}
                        {...(social.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                        className="flex items-center gap-3 text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-600 transition-colors group/social"
                      >
                        <span className="material-symbols-outlined text-[18px] shrink-0 opacity-50 group-hover/social:opacity-100 transition-opacity">
                          {social.icon}
                        </span>
                        <span className="text-sm tracking-wider font-normal font-google break-all">{social.label}</span>
                      </a>
                    </li>
                  ))}
                </ul>
                <div className="space-y-6">
                  <div className="space-y-2">
                    <p className="text-[10px] tracking-[0.2em] font-bold text-slate-400 dark:text-slate-600">Operations_Base</p>
                    <p className="text-sm font-google font-medium text-slate-700 dark:text-slate-300 leading-relaxed">
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
            <div className="flex flex-col min-[1011px]:flex-row items-center gap-6 text-sm tracking-wide font-normal text-slate-600 dark:text-slate-400 font-google">
              <p className="text-center">© 2026 Sapybase LLC — Built to make AI work for every business.</p>
              <div className="hidden min-[1011px]:block h-px w-6 bg-gray-200 dark:bg-slate-800" />
              <div className="flex gap-6">
                <Link href="/privacy-policy" className="hover:text-slate-900 dark:hover:text-slate-200 transition-colors">Privacy Policy</Link>
                <Link href="/terms-and-conditions" className="hover:text-slate-900 dark:hover:text-slate-200 transition-colors">Terms and Conditions</Link>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Activity size={14} className="text-emerald-500" />
              <span className="text-sm tracking-wide font-normal text-slate-900 dark:text-slate-200 font-google">
                Status: <span className="text-emerald-600">Operational</span>
              </span>
            </div>
          </div>



        </div>
      </div>
    </footer>
  );
}
