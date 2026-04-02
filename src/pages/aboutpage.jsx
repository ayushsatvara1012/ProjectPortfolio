import React from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck, Cpu, Globe, ArrowBigRight, Rocket, Layers, Activity, ChevronRight, Terminal } from 'lucide-react';
import Resume from '../components/resume';
import SEO from '../components/Seo';
import seoConfig from '../seo/seoConfig';


const AboutPage = () => {
    const partners = [
        {
            name: "Ayush Satvara",
            role: "Founder & Lead Software Engineer",
            image: "/IMG_9145.webp",
            skills: ["Python", "FastAPI", "PostGres", "GenAI"],
            desc: "AWS Certified Solutions Architect specializes in building high-performance digital ecosystems featuring AI-driven semantic search and projects achieving 99 Lighthouse performance scores. Excelling at optimizing frontend latency and architecting scalable backend ETL pipelines for large-scale datasets. His technical expertise is further validated by specialized certifications in Generative AI, Machine Learning, and Data Science."
        },
        {
            name: "Kathan Pandya",
            role: "Frontend Developer",
            image: "/IMG_9163.webp",
            skills: ["React", "JS", "RestAPI", "Typescript"],
            desc: "Spearheaded the development of high-performance, scalable web interfaces using Angular, TypeScript, and JavaScript. Architected and implemented responsive, data-intensive dashboards using HTML5 and Advanced CSS/SCSS. Integrate complex REST APIs, optimizing frontend performance and ensuring Type-safe application architecture through TypeScript. Focused on enhancing user experience (UX) maintaining high standards for cross-browser compatibility and mobile responsiveness."
        }
    ];

    return (
        <>
            <SEO {...seoConfig.about} />
            <div className="bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-200 overflow-x-hidden transition-colors duration-500">

                {/* SECTION 1: Laptop-Optimized Hero & Partners (Fits 100vh) */}
                <section className="min-h-dvh flex flex-col justify-center pt-24 pb-12 px-4 md:px-8 lg:px-12 max-w-[1600px] mx-auto">
                    <div className="grid lg:grid-cols-12 gap-8 lg:gap-5 items-center">

                        {/* LEFT: Heading & Context */}
                        <div className="lg:col-span-5 space-y-6 flex items-center lg:items-start text-center lg:text-start flex-col relative w-full h-full">
                            {/* THE UNEVEN GRID BACKGROUND */}
                            <div className="absolute inset-[-100px] pointer-events-none z-0">
                                {/* Static Grid */}
                                <svg className="w-full h-full absolute inset-0" xmlns="http://www.w3.org/2000/svg">
                                    <line x1="12%" y1="0" x2="12%" y2="100%" className="stroke-slate-200 dark:stroke-slate-800 stroke-[1px]" />
                                    <line x1="28%" y1="0" x2="28%" y2="100%" className="stroke-slate-200 dark:stroke-slate-800 stroke-[1px]" />
                                    <line x1="75%" y1="0" x2="75%" y2="100%" className="stroke-slate-200 dark:stroke-slate-800 stroke-[1px]" />
                                    <line x1="92%" y1="0" x2="92%" y2="100%" className="stroke-slate-200 dark:stroke-slate-800 stroke-[1px]" />

                                    <line x1="0" y1="18%" x2="100%" y2="18%" className="stroke-slate-200 dark:stroke-slate-800 stroke-[1px]" />
                                    <line x1="0" y1="55%" x2="100%" y2="55%" className="stroke-slate-200 dark:stroke-slate-800 stroke-[1px]" />
                                    <line x1="0" y1="82%" x2="100%" y2="82%" className="stroke-slate-200 dark:stroke-slate-800 stroke-[1px]" />
                                    
                                    <circle cx="75%" cy="55%" r="4" className="fill-none stroke-slate-300 dark:stroke-slate-700 stroke-[1px]" />
                                    <circle cx="28%" cy="18%" r="4" className="fill-none stroke-slate-300 dark:stroke-slate-700 stroke-[1px]" />
                                </svg>
                                
                                {/* Animated Overlay */}
                                <svg className="w-full h-full absolute inset-0" viewBox="0 0 100 100" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
                                    <defs>
                                        <linearGradient id="gridSnake1" x1="0%" y1="0%" x2="100%" y2="100%">
                                            <stop offset="0%" stopColor="#818cf8" />
                                            <stop offset="100%" stopColor="#a855f7" />
                                        </linearGradient>
                                        <linearGradient id="gridSnake2" x1="100%" y1="0%" x2="0%" y2="100%">
                                            <stop offset="0%" stopColor="#e879f9" />
                                            <stop offset="100%" stopColor="#f43f5e" />
                                        </linearGradient>
                                        <linearGradient id="gridSnake3" x1="0%" y1="100%" x2="100%" y2="0%">
                                            <stop offset="0%" stopColor="#22d3ee" />
                                            <stop offset="100%" stopColor="#6366f1" />
                                        </linearGradient>
                                        <linearGradient id="gridSnake4" x1="0%" y1="0%" x2="0%" y2="100%">
                                            <stop offset="0%" stopColor="#34d399" />
                                            <stop offset="100%" stopColor="#059669" />
                                        </linearGradient>
                                    </defs>

                                    <motion.path 
                                        d="M 12 0 L 12 55 L 75 55 L 75 100" 
                                        fill="none" 
                                        stroke="url(#gridSnake1)" 
                                        strokeWidth="1.5" 
                                        vectorEffect="non-scaling-stroke"
                                        initial={{ pathLength: 0, opacity: 0 }}
                                        animate={{ pathLength: 1, opacity: [0, 1, 1, 0] }}
                                        transition={{ duration: 4, ease: "easeInOut", repeat: Infinity, repeatDelay: 1 }}
                                    />
                                    <motion.path 
                                        d="M 0 18 L 92 18 L 92 82 L 28 82 L 28 100" 
                                        fill="none" 
                                        stroke="url(#gridSnake2)" 
                                        strokeWidth="1.5" 
                                        vectorEffect="non-scaling-stroke"
                                        initial={{ pathLength: 0, opacity: 0 }}
                                        animate={{ pathLength: 1, opacity: [0, 1, 1, 0] }}
                                        transition={{ duration: 5, ease: "easeInOut", repeat: Infinity, repeatDelay: 0.5, delay: 1 }}
                                    />
                                    <motion.path 
                                        d="M 100 55 L 12 55 L 12 82 L 100 82" 
                                        fill="none" 
                                        stroke="url(#gridSnake3)" 
                                        strokeWidth="1.5" 
                                        vectorEffect="non-scaling-stroke"
                                        initial={{ pathLength: 0, opacity: 0 }}
                                        animate={{ pathLength: 1, opacity: [0, 1, 1, 0] }}
                                        transition={{ duration: 4.5, ease: "easeInOut", repeat: Infinity, repeatDelay: 1.5, delay: 2 }}
                                    />
                                    <motion.path 
                                        d="M 92 100 L 92 0" 
                                        fill="none" 
                                        stroke="url(#gridSnake4)" 
                                        strokeWidth="1.5" 
                                        vectorEffect="non-scaling-stroke"
                                        initial={{ pathLength: 0, opacity: 0 }}
                                        animate={{ pathLength: 1, opacity: [0, 1, 1, 0] }}
                                        transition={{ duration: 3, ease: "easeInOut", repeat: Infinity, repeatDelay: 2, delay: 0.5 }}
                                    />
                                </svg>
                            </div>

                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 relative z-10">
                                <Terminal className='w-4 h-4 text-indigo-600 dark:text-indigo-400' />
                                <span className="text-[10px] uppercase tracking-widest font-bold text-slate-600 dark:text-slate-200">Sapybase_v2.0</span>
                            </div>
                            <h1 className="text-5xl md:text-7xl font-display font-black tracking-tight leading-none text-slate-900 dark:text-slate-200 relative z-10">
                                THE <span className="text-indigo-600 dark:text-indigo-400 bg-indigo-100/50 dark:bg-indigo-900/30 px-1">ARCHITECTS</span> <br /> OF CODE.
                            </h1>
                            <p className="text-md font-display text-slate-500 leading-relaxed max-w-md relative z-10">
                                We engineer scalable ecosystems that bridge business vision and technical reality.
                            </p>
                        </div>

                        {/* RIGHT: Informative UI Module */}
                        <div className="lg:col-span-7 bg-slate-50 dark:bg-slate-900/40 rounded-4xl md:rounded-[2.5rem] border border-slate-200 dark:border-slate-800 p-6 md:p-8 relative overflow-hidden h-auto min-h-[500px] lg:min-h-[600px] mt-8 lg:mt-0 pb-12 lg:pb-8">

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4">
                                {/* Partner Cards */}
                                {partners.map((p, i) => (
                                    <div
                                        key={i}
                                        className="bg-white dark:bg-slate-900 rounded-3xl p-3 inset-shadow-sm inset-shadow-slate-200 dark:inset-shadow-slate-800 border border-slate-100 dark:border-slate-800 flex flex-col min-h-[420px] md:min-h-[450px] transition-transform duration-300 hover:-translate-y-2"
                                    >
                                        <div className="h-40 md:h-48 lg:h-56 xl:h-48 shrink-0 overflow-hidden rounded-2xl mb-4 bg-slate-200 dark:bg-slate-800">
                                            <img src={p.image} alt={p.name} className="w-full h-full object-cover grayscale hover:grayscale-0 transition-all duration-500" />
                                        </div>
                                        <h3 className="text-xl md:text-2xl font-display font-bold text-slate-900 dark:text-slate-200">{p.name}</h3>
                                        <p className="text-md uppercase font-bold text-slate-600 mb-3 dark:text-slate-300">{p.role}</p>
                                        <div className='text-md font-sans font-medium text-slate-600 mb-4 grow leading-relaxed dark:text-slate-300'>{p.desc}</div>
                                        <div className="mt-auto flex flex-wrap gap-1">
                                            {p.skills.map(s => (
                                                <span key={s} className="px-2 py-0.5 rounded-md bg-slate-50 dark:bg-slate-800 text-md text-slate-600 border border-slate-100 font-medium dark:text-slate-300 dark:border-slate-700">{s}</span>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Floating Technical Overlay */}
                            <div className="absolute top-22 right-6 bg-slate-900 text-white p-3 md:p-4 rounded-xl md:rounded-2xl shadow-2xl lg:flex items-center gap-3 md:gap-4 hidden">
                                <Activity className="text-emerald-400 animate-pulse" size={18} />
                                <div className="text-[10px] uppercase tracking-widest font-bold text-slate-200">
                                    <p className="opacity-70">Stack_Ready</p>
                                    <p>UPTIME: 99.98%</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                <section><Resume /></section>

                {/* SECTION 2: Technical Philosophy & Business (Muted Colors) */}
                <section className="bg-gray-950 border-t border-t-slate-700 py-20 md:py-32 px-4 md:px-8 rounded-t-[2.5rem] md:rounded-t-[3rem] lg:rounded-t-[5rem] relative">
                    <div className="max-w-8xl mx-auto grid lg:grid-cols-2 gap-12 md:gap-16 items-center">

                        <div className="space-y-6 md:space-y-8">
                            <h2 className="text-4xl md:text-5xl font-display font-bold tracking-tight text-white">
                                Performance-First <br className="hidden md:block" /> <span className="text-slate-500 leading-relaxed italic">Solutions.</span>
                            </h2>
                            <div className="space-y-4 text-md font-display text-slate-500 leading-relaxed max-w-lg">
                                <p>
                                    Built on <span className="text-indigo-400">Atomic Design Principles</span>, this platform utilizes React 19 and Vite to ensure lightning-fast interaction.
                                </p>
                                <p>
                                    We optimize customer engagement through <span className="text-white">Solution Architecture</span> that prioritizes user retention and system reliability.
                                </p>
                            </div>
                        </div>

                        {/* TONED DOWN Business Card (Deep Indigo/Slate) */}
                        <div className="bg-slate-900/40 border border-slate-800 rounded-4xl md:rounded-[2.5rem] p-8 md:p-12 text-white relative group overflow-hidden transition-all duration-500 hover:border-slate-700">
                            <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity duration-700">
                                <Rocket size={120} />
                            </div>

                            <h3 className="text-xl md:text-2xl font-display font-bold text-white mb-6 md:mb-8 flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center">
                                    <div className="w-2 h-2 rounded-full bg-indigo-500" />
                                </div>
                                How we help you?
                            </h3>

                            <ul className="space-y-4 md:space-y-5 relative z-10">
                                {[
                                    "Conversion-Focused Architecture",
                                    "Cloud Cost Optimization",
                                    "Scalable System Integration",
                                    "Customer Retention UX"
                                ].map((item, i) => (
                                    <li key={i} className="flex items-center gap-3 text-md font-display text-slate-600 font-medium">
                                        <ChevronRight size={14} className="text-indigo-500" />
                                        {item}
                                    </li>
                                ))}
                            </ul>

                            <button className="mt-8 md:mt-10 w-full py-3 md:py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-md font-display uppercase tracking-widest font-bold transition-all active:scale-95">
                                Initiate Consultation
                            </button>
                        </div>
                    </div>
                </section>
            </div>
        </>
    );
};

export default AboutPage;