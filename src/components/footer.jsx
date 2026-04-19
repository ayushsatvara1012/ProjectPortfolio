import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Github, Linkedin, Twitter, ArrowUpRight, Mail, Zap, Activity } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const InteractiveSchematic = () => {
  const containerRef = useRef(null);
  const mouseRef = useRef({ active: false, x: 0, y: 0, w: 1, h: 1 });
  const timeRef = useRef(0);
  
  const dotsConfig = useMemo(() => [
    { id: 1, isX: false, linePos: "8%", offset: 0.1, speed: 0.1, color: "fill-indigo-500", r: 2.5 },
    { id: 2, isX: false, linePos: "35%", offset: 0.4, speed: 0.15, color: "fill-blue-500", r: 2.5 },
    { id: 3, isX: true,  linePos: "15%", offset: 0.7, speed: 0.12, color: "fill-emerald-500", r: 3 },
    { id: 4, isX: true,  linePos: "85%", offset: 0.2, speed: 0.18, color: "fill-violet-500", r: 2.5 },
    { id: 5, isX: false, linePos: "70%", offset: 0.5, speed: 0.14, color: "fill-amber-500", r: 3 },
    { id: 6, isX: true,  linePos: "40%", offset: 0.8, speed: 0.16, color: "fill-rose-500", r: 2.5 },
    { id: 7, isX: false, linePos: "85%", offset: 0.3, speed: 0.11, color: "fill-cyan-500", r: 2 },
    { id: 8, isX: true,  linePos: "65%", offset: 0.9, speed: 0.13, color: "fill-fuchsia-500", r: 2.5 },
    { id: 9, isX: false, linePos: "8%",  offset: 0.6, speed: 0.17, color: "fill-teal-500", r: 2 },
    { id: 10, isX: true, linePos: "15%", offset: 0.05, speed: 0.19, color: "fill-orange-500", r: 2 },
    { id: 11, isX: false, linePos: "70%", offset: 0.25, speed: 0.13, color: "fill-sky-500", r: 2 },
    { id: 12, isX: true,  linePos: "85%", offset: 0.55, speed: 0.16, color: "fill-pink-500", r: 3 },
  ], []);

  const [dotsData, setDotsData] = useState(dotsConfig.map(d => ({ ...d, pos: 0 })));

  useEffect(() => {
    let frame;
    let currentPositions = dotsConfig.map(d => d.offset);

    const loop = () => {
      timeRef.current += 0.01;
      
      const newPos = dotsConfig.map((dot, i) => {
        const baseAbsolute = timeRef.current * dot.speed + dot.offset;
        const localBase = baseAbsolute % 1;
        let targetAbsolute = baseAbsolute;
        
        const m = mouseRef.current;
        if (m.active && m.w > 0) {
           const mouseLocal = dot.isX ? (m.x / m.w) : (m.y / m.h);
           const dist = Math.abs(mouseLocal - localBase);
           
           // Gravitational pull bubble of 20%
           if (dist < 0.20) {
             const pullFactor = 1 - (dist / 0.20); // 0.0 - 1.0 depending on proximity
             targetAbsolute = baseAbsolute + (mouseLocal - localBase) * (pullFactor * 0.9);
           }
        }

        currentPositions[i] += (targetAbsolute - currentPositions[i]) * 0.1;
        // Absolute bound wrapping to purely restrict within screen smoothly
        const finalWrapped = ((currentPositions[i] % 1) + 1) % 1;
        
        return { ...dot, pos: finalWrapped };
      });

      setDotsData(newPos);
      frame = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(frame);
  }, [dotsConfig]);

  const handleMouseMove = (e) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    mouseRef.current = { 
      active: true,
      x: e.clientX - rect.left, 
      y: e.clientY - rect.top,
      w: rect.width,
      h: rect.height
    };
  };

  const handleMouseLeave = () => {
    mouseRef.current.active = false;
  };

  return (
    <div 
      ref={containerRef}
      className="absolute inset-0 z-0 overflow-hidden"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <svg className="w-full h-full pointer-events-none" xmlns="http://www.w3.org/2000/svg">
        {/* Foundation Lines */}
        <line x1="8%" y1="0" x2="8%" y2="100%" className="stroke-slate-200 dark:stroke-slate-800 stroke-[1px] transition-colors" />
        <line x1="35%" y1="0" x2="35%" y2="100%" className="stroke-slate-200 dark:stroke-slate-800 stroke-[1px] transition-colors" />
        
        <line x1="0" y1="15%" x2="100%" y2="15%" className="stroke-slate-200 dark:stroke-slate-800 stroke-[1px] transition-colors" />
        <line x1="0" y1="85%" x2="100%" y2="85%" className="stroke-slate-200 dark:stroke-slate-800 stroke-[1px] transition-colors" />

        <line x1="70%" y1="15%" x2="70%" y2="100%" className="stroke-slate-200 dark:stroke-slate-800 stroke-[1px] transition-colors" />
        <line x1="85%" y1="15%" x2="85%" y2="100%" className="stroke-slate-200 dark:stroke-slate-800 stroke-[1px] transition-colors" />
        
        <line x1="70%" y1="40%" x2="100%" y2="40%" className="stroke-slate-200 dark:stroke-slate-800 stroke-[1px] transition-colors" />
        <line x1="70%" y1="65%" x2="100%" y2="65%" className="stroke-slate-200 dark:stroke-slate-800 stroke-[1px] transition-colors" />

        {/* Crosshairs */}
        <g className="stroke-slate-300 dark:stroke-slate-700 stroke-[1px] transition-colors">
          <line x1="7.5%" y1="15%" x2="8.5%" y2="15%" />
          <line x1="8%" y1="13%" x2="8%" y2="17%" />
          
          <line x1="34.5%" y1="50%" x2="35.5%" y2="50%" />
          <line x1="35%" y1="48%" x2="35%" y2="52%" />
        </g>

        {/* Colored Tracking Dots */}
        {dotsData.map((d, i) => (
          <circle 
            key={i}
            cx={d.isX ? `${d.pos * 100}%` : d.linePos}
            cy={d.isX ? d.linePos : `${d.pos * 100}%`}
            r={d.r}
            className={d.color}
          />
        ))}
      </svg>
    </div>
  );
};

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
    { name: "React 19 / Vite" },
    { name: "Python 3.12 / FastAPI" },
    { name: "PostgreSQL / Supabase" },
    { name: "Tailwind CSS v4" },
    { name: "Lucide / Framer" },
    { name: "AWS Cloud" },
    { name: "Docker Container" },
    { name: "Git Workflow" }
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
    <footer className="bg-white border-x border-gray-100 dark:border-slate-800 overflow-hidden dark:bg-slate-950">
      <div className="max-w-8xl mx-auto">
        
        {/* Tic-Tac-Toe Grid Architecture */}
        <div className="grid grid-cols-1 min-[1011px]:grid-cols-12 gap-px bg-gray-200 dark:bg-slate-800 border-x border-gray-200 dark:border-slate-800">
          
          {/* 1. BRANDING CELL (md:col-span-5) */}
          <div className="min-[1011px]:col-span-5 bg-white dark:bg-slate-950 p-12 min-[1011px]:p-16 flex flex-col justify-between gap-12 group/brand relative overflow-hidden transition-colors">
            
            {/* THE "TITLE BLOCK" INTERACTIVE SVG BACKGROUND */}
            <InteractiveSchematic />

            <div className="space-y-8 relative z-10">
              <div className="flex items-center gap-3">
                <span className="text-xl min-[1011px]:text-2xl font-display font-bold text-slate-900 dark:text-slate-200 uppercase">
                  SaPy<span className="text-indigo-600">Base</span>
                </span>
                <div className="h-px w-8 bg-gray-100 dark:bg-slate-800" />
                <span className="text-sm uppercase tracking-widest font-bold text-slate-600 dark:text-slate-400 font-sans">Protocol_V4.2</span>
              </div>
              
              <h2 className="text-4xl min-[1011px]:text-5xl font-display font-bold tracking-tight text-slate-900 dark:text-slate-200 uppercase">
                Ready to architect your <br />
                <span className="text-slate-600 dark:text-slate-400 transition-colors duration-500 group-hover/brand:text-indigo-600">next Digital Frontier?</span>
              </h2>
            </div>

            <div className="flex flex-wrap gap-4 relative z-10">
              <button
                onClick={() => navigate('/services')}
                className="bg-slate-900 dark:bg-indigo-600 text-white px-8 py-4 rounded-none text-sm uppercase tracking-widest font-bold font-sans hover:bg-indigo-600 dark:hover:bg-indigo-500 transition-all active:scale-95 flex items-center gap-3 group/btn"
              >
                Start_Project <Zap size={14} className="opacity-40 group-hover/btn:opacity-100" />
              </button>
            </div>
          </div>

          {/* 2. NAVIGATION GRID (md:col-span-7) */}
          <div className="min-[1011px]:col-span-7 grid grid-cols-1 sm:grid-cols-3 gap-px bg-gray-200 dark:bg-slate-800">
            
            {/* PLATFORM MODULE */}
            <div className="bg-white dark:bg-slate-950 p-10 min-[1011px]:p-12 space-y-10 group/cell transition-colors duration-500 hover:bg-slate-50/50 dark:hover:bg-slate-900/50">
              <div className="flex items-center gap-2 text-sm uppercase tracking-widest font-bold text-slate-600 dark:text-slate-400 font-sans">
                <div className="h-1.5 w-1.5 rounded-none bg-indigo-600" />
                <span>Platform</span>
              </div>
              <ul className="space-y-4">
                {navigateToPages.map((link, idx) => (
                  <li key={`foot-nav-${link.name}-${idx}`}>
                    <a
                      href={link.href}
                      onClick={(e) => handleLinkClick(e, link.href)}
                      className="text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all text-sm uppercase tracking-widest font-bold font-sans flex items-center justify-between group/link"
                    >
                      {link.name} <ArrowUpRight size={12} className="opacity-0 group-hover/link:opacity-100 transition-all translate-y-1 group-hover/link:translate-y-0" />
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            {/* STACK MODULE */}
            <div className="bg-white dark:bg-slate-950 p-10 min-[1011px]:p-12 space-y-10 group/cell transition-colors duration-500 hover:bg-slate-50/50 dark:hover:bg-slate-900/50">
              <div className="flex items-center gap-2 text-sm uppercase tracking-widest font-bold text-slate-600 dark:text-slate-400 font-sans">
                <div className="h-1.5 w-1.5 rounded-none bg-slate-900 dark:bg-slate-200" />
                <span>Tech_Stack</span>
              </div>
              <ul className="space-y-4">
                {stackList.map((stack, idx) => (
                  <li key={`foot-stack-${idx}`} className="text-slate-600 dark:text-slate-400 text-sm uppercase tracking-widest font-bold font-sans cursor-default hover:text-slate-900 dark:hover:text-slate-200 transition-colors">
                    {stack.name}
                  </li>
                ))}
              </ul>
            </div>

            {/* SOCIAL MODULE */}
            <div className="bg-white dark:bg-slate-950 p-6 min-[1011px]:p-12 space-y-6 min-[1011px]:space-y-10 group/cell transition-colors duration-500 hover:bg-slate-50/50 dark:hover:bg-slate-900/50 relative overflow-hidden">


              <div className="flex items-center gap-2 text-sm uppercase tracking-widest font-bold text-slate-600 dark:text-slate-400 font-sans relative z-10">
                <div className="h-1.5 w-1.5 rounded-none bg-emerald-500" />
                <span>Social_Net</span>
              </div>
              <div className="flex flex-col gap-8 relative z-10">
                {/* Row 1: Social Links */}
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-gray-200 dark:bg-slate-800 border border-gray-100 dark:border-slate-800">
                    {[
                      { Icon: Github, href: "https://github.com/ayushsatvara1012", label: "GIT" },
                      { Icon: Linkedin, href: "https://www.linkedin.com/in/ayushsatvara", label: "LNK" },
                    ].map((social, i) => (
                      <a
                        key={`foot-social-${i}`}
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

                {/* New: Contact & Location Modules (Mobile First) */}
                <div className="space-y-6">
                  {/* Email Node */}
                  <div className="space-y-2">
                    <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-slate-400 dark:text-slate-600">Connect_Direct</p>
                    <a 
                      href="mailto:ayushsatvara2002@gmail.com" 
                      className="text-sm font-display font-medium text-slate-900 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-400 break-all transition-colors block"
                    >
                      ayushsatvara2002@gmail.com
                    </a>
                  </div>

                  {/* Address Node */}
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

          {/* 3. BOTTOM LEGEND ROW (md:col-span-12) */}
          <div className="min-[1011px]:col-span-12 bg-white dark:bg-slate-950 p-8 min-[1011px]:p-10 border-t border-white dark:border-slate-800 flex flex-col min-[1011px]:flex-row justify-between items-center gap-6">
            <div className="flex flex-col min-[1011px]:flex-row items-center gap-6 text-sm uppercase tracking-widest font-bold text-slate-600 dark:text-slate-400 font-sans">
              <p className='text-center'>© 2026 SAPYBASE LLC — ENGINEERED WITH PRECISION.</p>
              <div className="hidden min-[1011px]:block h-px w-6 bg-gray-200 dark:bg-slate-800" />
              <div className="flex gap-6">
                <a href="/privacy-policy" className="hover:text-slate-900 dark:hover:text-slate-200 transition-colors">PRIVACY</a>
                <a href="/terms-and-conditions" className="hover:text-slate-900 dark:hover:text-slate-200 transition-colors">TERMS</a>
              </div>
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
};

export default ModernFooter;