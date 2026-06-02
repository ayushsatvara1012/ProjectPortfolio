'use client';

import React, { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';

/* ─────────────────────────────────────────────────────────────────────────────
   FOUNDER SECTION  —  the single home for every personal detail about Ayush.

   Collapsed: a centered profile banner (photo · name · title · Read more),
              capped at max-w-5xl.
   Expanded:  the card smoothly widens to max-w-8xl and grows in height,
              revealing a full responsive dossier grid — Education, Projects,
              Qualities, Certifications, and Core stack.

   Styled to match the new SaaS homepage theme (rounded-3xl glass cards,
   font-medium headings, gradient accents, ambient glow, emerald accents).
   Fully responsive: stacks on mobile, two-up on tablet, multi-column on desktop.
 ───────────────────────────────────────────────────────────────────────────── */

type Education = { period: string; degree: string; school: string; score: string };
type Project = { title: string; tech: string; result: string; tag: string };
type Cert = { name: string; issuer: string };
type Stack = { name: string; note: string };

interface FounderSectionProps {
  stack: Stack[];
  certifications: Cert[];
  projects: Project[];
  education: Education[];
}

const COLLAPSED_WIDTH = '64rem'; // max-w-5xl — centered profile banner
const EXPANDED_WIDTH = '88rem'; // max-w-8xl — full dossier
const EASE = 'easeInOut';

const SectionLabel = ({ icon, children }: { icon: string; children: React.ReactNode }) => (
  <div className="flex items-center gap-2 text-xs uppercase tracking-widest font-bold font-google text-slate-400 dark:text-slate-500 mb-4">
    <span className="material-symbols-outlined text-[14px] text-blue-500">{icon}</span>
    {children}
  </div>
);

/** A bordered glass sub-panel used for each dossier block. */
const Panel = ({ className = '', children }: { className?: string; children: React.ReactNode }) => (
  <div
    className={`rounded-2xl border border-slate-200/60 dark:border-slate-800/60 bg-white/60 dark:bg-slate-950/30 p-6 sm:p-7 ${className}`}
  >
    {children}
  </div>
);

const CONNECTIONS_MAP: Record<string, { projects: string[]; certs: string[] }> = {
  'Python': { projects: ['LuminaLib AI'], certs: ['Machine Learning with Python', 'Python Programming'] },
  'FastAPI': { projects: ['LuminaLib AI'], certs: [] },
  'React 19': { projects: ['Sapybase Portfolio'], certs: [] },
  'PostgreSQL': { projects: [], certs: [] },
  'pgvector': { projects: ['LuminaLib AI'], certs: [] },
  'AWS': { projects: ['V-Comm Platform'], certs: ['AWS Certified Solutions Architect'] },
  'Tailwind v4': { projects: ['Sapybase Portfolio'], certs: [] },
  'Vite': { projects: ['Sapybase Portfolio'], certs: [] },
  'Gemini AI': { projects: ['LuminaLib AI'], certs: ['Generative AI: Prompt Engineering'] },
  'RAG Pipeline': { projects: ['LuminaLib AI'], certs: ['Generative AI: Prompt Engineering', 'Machine Learning with Python'] },
  'Supabase': { projects: ['Sapybase Portfolio'], certs: [] },
  'Docker': { projects: ['V-Comm Platform'], certs: [] }
};

const FounderSection = ({ stack, certifications, projects, education }: FounderSectionProps) => {
  const [expanded, setExpanded] = useState(false);
  const reduce = useReducedMotion();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const sectionRef = useRef<HTMLDivElement | null>(null);
  const [hoveredTag, setHoveredTag] = useState<string | null>(null);
  const [connections, setConnections] = useState<{
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    cp1x: number;
    cp1y: number;
    cp2x: number;
    cp2y: number;
  }[]>([]);

  useEffect(() => {
    if (expanded && sectionRef.current) {
      const yOffset = -90; // offset for the sticky header
      const element = sectionRef.current;
      const y = element.getBoundingClientRect().top + window.scrollY + yOffset;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  }, [expanded]);

  useEffect(() => {
    if (!hoveredTag || !containerRef.current) {
      setConnections([]);
      return;
    }

    const updateCoords = () => {
      if (!containerRef.current || !hoveredTag) return;
      const container = containerRef.current;
      const containerRect = container.getBoundingClientRect();
      const sourceEl = container.querySelector(`[data-stack-tag="${hoveredTag}"]`);
      if (!sourceEl) return;

      const sourceRect = sourceEl.getBoundingClientRect();
      const map = CONNECTIONS_MAP[hoveredTag];
      if (!map) return;

      const sLeft = sourceRect.left - containerRect.left;
      const sRight = sourceRect.right - containerRect.left;
      const sTop = sourceRect.top - containerRect.top;
      const sBottom = sourceRect.bottom - containerRect.top;
      const sCenterX = sLeft + sourceRect.width / 2;
      const sCenterY = sTop + sourceRect.height / 2;

      const newConnections: typeof connections = [];

      const calculatePoints = (dRect: DOMRect) => {
        const dLeft = dRect.left - containerRect.left;
        const dRight = dRect.right - containerRect.left;
        const dTop = dRect.top - containerRect.top;
        const dBottom = dRect.bottom - containerRect.top;
        const dCenterX = dLeft + dRect.width / 2;
        const dCenterY = dTop + dRect.height / 2;

        const distX = sLeft > dRight ? sLeft - dRight : dLeft > sRight ? dLeft - sRight : 0;
        const distY = sTop > dBottom ? sTop - dBottom : dTop > sBottom ? dTop - sBottom : 0;

        let x1, y1, x2, y2, cp1x, cp1y, cp2x, cp2y;

        if (distX > distY) {
          // Horizontal connection
          if (sCenterX < dCenterX) {
            x1 = sRight;
            y1 = sCenterY;
            x2 = dLeft;
            y2 = dCenterY;
          } else {
            x1 = sLeft;
            y1 = sCenterY;
            x2 = dRight;
            y2 = dCenterY;
          }
          const dx = x2 - x1;
          cp1x = x1 + dx * 0.5;
          cp1y = y1;
          cp2x = x2 - dx * 0.5;
          cp2y = y2;
        } else {
          // Vertical connection
          if (sCenterY < dCenterY) {
            x1 = sCenterX;
            y1 = sBottom;
            x2 = Math.max(dLeft, Math.min(dRight, sCenterX));
            y2 = dTop;
          } else {
            x1 = sCenterX;
            y1 = sTop;
            x2 = Math.max(dLeft, Math.min(dRight, sCenterX));
            y2 = dBottom;
          }
          const dy = y2 - y1;
          cp1x = x1;
          cp1y = y1 + dy * 0.5;
          cp2x = x2;
          cp2y = y2 - dy * 0.5;
        }

        // Prevent degenerate bounding box for SVG linear gradients (occurs on vertical/horizontal lines)
        if (Math.abs(x1 - x2) < 1) x2 = x1 + 1;
        if (Math.abs(y1 - y2) < 1) y2 = y1 + 1;

        return { x1, y1, x2, y2, cp1x, cp1y, cp2x, cp2y };
      };

      map.projects.forEach((proj) => {
        const el = container.querySelector(`[data-project-title="${proj}"]`);
        if (el) {
          const rect = el.getBoundingClientRect();
          newConnections.push(calculatePoints(rect));
        }
      });

      map.certs.forEach((cert) => {
        const el = container.querySelector(`[data-cert-name="${cert}"]`);
        if (el) {
          const rect = el.getBoundingClientRect();
          newConnections.push(calculatePoints(rect));
        }
      });

      setConnections(newConnections);
    };

    updateCoords();
    window.addEventListener('resize', updateCoords);
    // Extra timeout to ensure DOM layout settles
    const timer = setTimeout(updateCoords, 100);

    return () => {
      window.removeEventListener('resize', updateCoords);
      clearTimeout(timer);
    };
  }, [hoveredTag]);

  return (
    <section ref={sectionRef} className="relative w-full bg-white dark:bg-slate-950 py-10 sm:py-12 overflow-hidden transition-colors duration-500 scroll-mt-24">
      {/* Ambient background glows — mirrors the homepage sections */}
      <div className="absolute top-1/4 left-10 w-96 h-96 bg-blue-500/5 dark:bg-blue-600/10 rounded-full blur-[120px] pointer-events-none select-none" />
      <div className="absolute bottom-1/4 right-10 w-96 h-96 bg-indigo-500/5 dark:bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none select-none" />

      <div className="max-w-8xl mx-auto px-6 sm:px-12 lg:px-20 relative z-10">

        {/* Header */}
        <div className="flex flex-col items-center text-center mb-12">
          <div className="flex items-center gap-2 text-sm uppercase tracking-widest font-bold font-google text-slate-400 dark:text-slate-500 mb-4">
            <span className="material-symbols-outlined text-[16px] text-blue-500">person</span>
            <span>The person behind Sapybase</span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-google font-medium tracking-tight leading-tight text-slate-900 dark:text-white">
            Meet the{' '}
            <span className="text-transparent bg-clip-text bg-linear-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400">
              founder
            </span>
          </h2>
        </div>

        {/* Card — width animates between collapsed (5xl) and expanded (8xl) */}
        <motion.div
          animate={{ maxWidth: expanded ? EXPANDED_WIDTH : COLLAPSED_WIDTH }}
          transition={reduce ? { duration: 0 } : { duration: 0.6, ease: EASE }}
          className="mx-auto w-full rounded-3xl bg-slate-50/50 dark:bg-slate-900/30 border border-slate-200/60 dark:border-slate-800/60 backdrop-blur-xl overflow-hidden"
        >
          <div className="p-6 sm:p-10 lg:p-12">

            {/* ── Identity header (photo · name · title · toggle) ───────────── */}
            <div className="flex flex-col items-center text-center gap-6 sm:flex-row sm:text-left sm:items-center sm:gap-8">
              <div className="relative w-24 h-24 sm:w-28 sm:h-28 lg:w-32 lg:h-32 rounded-full overflow-hidden border border-slate-200 dark:border-slate-800 shadow-md shrink-0">
                <Image
                  src="/IMG_9145.webp"
                  alt="Ayush Satvara"
                  fill
                  sizes="(max-width: 640px) 96px, 128px"
                  className="object-cover"
                  style={{ objectPosition: 'center top' }}
                />
              </div>

              <div className="flex-1 min-w-0">
                <h3 className="text-2xl sm:text-3xl font-google font-semibold text-slate-900 dark:text-slate-100 leading-tight">
                  Ayush Satvara
                </h3>
                <p className="text-sm sm:text-base font-google text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                  Founder · Lead Software Engineer at Sapybase
                </p>
              </div>

              <button
                onClick={() => setExpanded((v) => !v)}
                aria-expanded={expanded}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-blue-600 hover:bg-blue-500 text-white text-sm font-google font-medium tracking-wide transition-colors shrink-0"
              >
                {expanded ? 'Read less' : 'Read more'}
                <span
                  className={`material-symbols-outlined text-[18px] transition-transform duration-300 ${
                    expanded ? 'rotate-180' : ''
                  }`}
                >
                  expand_more
                </span>
              </button>
            </div>

            {/* ── Expanded dossier (height + fade reveal) ──────────────────── */}
            <AnimatePresence initial={false}>
              {expanded && (
                <motion.div
                  key="details"
                  initial={reduce ? false : { opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={reduce ? { duration: 0 } : { duration: 0.5, ease: EASE }}
                  className="overflow-hidden"
                  onAnimationComplete={() => {
                    if (expanded && sectionRef.current) {
                      const yOffset = -90; // offset for the sticky header
                      const element = sectionRef.current;
                      const y = element.getBoundingClientRect().top + window.scrollY + yOffset;
                      window.scrollTo({ top: y, behavior: 'smooth' });
                    }
                  }}
                >
                  <div
                    ref={containerRef}
                    className="relative mt-8 sm:mt-10 pt-8 sm:pt-10 border-t border-slate-200/60 dark:border-slate-800/60"
                  >
                    {/* SVG Connector overlay */}
                    {connections.length > 0 && (
                      <svg
                        className="absolute inset-0 w-full h-full pointer-events-none z-20 overflow-visible"
                        fill="none"
                      >
                        <defs>
                          <linearGradient id="dossier-line-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#3B82F6" stopOpacity="1" />
                            <stop offset="100%" stopColor="#6366F1" stopOpacity="0.4" />
                          </linearGradient>
                        </defs>
                        {connections.map((c, idx) => (
                          <g key={idx}>
                            <motion.path
                              d={`M ${c.x1} ${c.y1} C ${c.cp1x} ${c.cp1y}, ${c.cp2x} ${c.cp2y}, ${c.x2} ${c.y2}`}
                              stroke="url(#dossier-line-grad)"
                              strokeWidth="1.5"
                              strokeDasharray="4 4"
                              initial={{ pathLength: 0, opacity: 0 }}
                              animate={{ pathLength: 1, opacity: 0.7 }}
                              transition={{ duration: 0.35, ease: 'easeOut' }}
                            />
                            <motion.circle
                              cx={c.x2}
                              cy={c.y2}
                              r="3.5"
                              className="fill-blue-500 dark:fill-blue-400"
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              transition={{ delay: 0.15 }}
                            />
                          </g>
                        ))}
                      </svg>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8 relative z-10">

                      {/* Education */}
                      <Panel className={`transition-all duration-300 ${hoveredTag ? 'opacity-30 blur-[0.5px]' : 'opacity-100'}`}>
                        <SectionLabel icon="school">Education</SectionLabel>
                        <div className="flex flex-col gap-5">
                          {education.map((e, i) => (
                            <div key={i} className="border-l-2 border-blue-500/60 pl-4">
                              <p className="text-xs font-google font-bold uppercase tracking-widest text-slate-400 mb-1">
                                {e.period}
                              </p>
                              <h5 className="text-base font-google font-medium text-slate-900 dark:text-slate-100 leading-tight">
                                {e.degree}
                              </h5>
                              <p className="text-sm font-google text-slate-500 dark:text-slate-400 mt-0.5">
                                {e.school}
                              </p>
                              <span className="inline-block mt-2 text-xs font-google font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                                {e.score}
                              </span>
                            </div>
                          ))}
                        </div>
                      </Panel>

                      {/* Projects */}
                      <Panel className="transition-all duration-300">
                        <SectionLabel icon="folder_open">Projects</SectionLabel>
                        <div className="flex flex-col divide-y divide-slate-200/70 dark:divide-slate-800/70">
                          {projects.map((p, i) => {
                            const live = p.tag === 'Live' || p.tag === 'Deployed';
                            const isLinked = hoveredTag && CONNECTIONS_MAP[hoveredTag]?.projects.includes(p.title);
                            return (
                              <div
                                key={i}
                                data-project-title={p.title}
                                className={`flex items-center justify-between gap-3 py-3 first:pt-0 transition-all duration-300 ${
                                  hoveredTag
                                    ? isLinked
                                      ? 'opacity-100 scale-[1.01] bg-blue-500/5 dark:bg-blue-500/10 px-2 rounded-lg'
                                      : 'opacity-25 blur-[0.5px]'
                                    : 'opacity-100'
                                }`}
                              >
                                <div className="flex items-center gap-3 min-w-0">
                                  <div className="min-w-0">
                                    <p className="text-base font-google font-medium text-slate-900 dark:text-slate-100 truncate">
                                      {p.title}
                                    </p>
                                    <div className="flex items-center gap-1.5 text-sm font-google text-slate-400 dark:text-slate-500">
                                      <span className="truncate">{p.tech}</span>
                                      <span className="text-slate-300 dark:text-slate-700">•</span>
                                      <span className={`text-[10px] font-semibold uppercase tracking-wider shrink-0 ${
                                        live
                                          ? 'text-emerald-600 dark:text-emerald-500'
                                          : 'text-blue-600 dark:text-blue-500'
                                      }`}>
                                        {p.tag}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                                <span className="text-xs font-google font-normal text-emerald-600 dark:text-emerald-500 whitespace-nowrap">
                                  {p.result}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </Panel>

                      {/* Certifications */}
                      <Panel className="transition-all duration-300">
                        <SectionLabel icon="workspace_premium">Certifications</SectionLabel>
                        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                          {certifications.map((c, i) => {
                            const isLinked = hoveredTag && CONNECTIONS_MAP[hoveredTag]?.certs.includes(c.name);
                            return (
                              <li
                                key={i}
                                data-cert-name={c.name}
                                className={`flex items-start gap-2.5 transition-all duration-300 ${
                                  hoveredTag
                                    ? isLinked
                                      ? 'opacity-100 scale-[1.01] bg-emerald-500/5 dark:bg-emerald-500/10 p-1.5 rounded-lg'
                                      : 'opacity-25 blur-[0.5px]'
                                    : 'opacity-100'
                                }`}
                              >
                                <span className="material-symbols-outlined text-[16px] text-emerald-500 shrink-0 mt-0.5">
                                  check_circle
                                </span>
                                <div>
                                  <p className="text-sm font-google font-medium text-slate-800 dark:text-slate-200 leading-snug">
                                    {c.name}
                                  </p>
                                  <p className="text-xs font-google text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                                    {c.issuer}
                                  </p>
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      </Panel>

                      {/* Core stack */}
                      <Panel className="transition-all duration-300">
                        <SectionLabel icon="memory">Core stack</SectionLabel>
                        <div className="flex flex-wrap gap-2">
                          {stack.map((t, i) => {
                            const isActive = hoveredTag === t.name;
                            return (
                              <span
                                key={i}
                                data-stack-tag={t.name}
                                title={t.note}
                                onMouseEnter={() => setHoveredTag(t.name)}
                                onMouseLeave={() => setHoveredTag(null)}
                                className={`px-3 py-1 rounded-full text-xs font-google font-medium border transition-all duration-200 cursor-help select-none ${
                                  hoveredTag
                                    ? isActive
                                      ? 'bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-500/20 scale-105'
                                      : 'bg-slate-100/50 dark:bg-slate-900/10 border-slate-200/50 dark:border-slate-800/50 text-slate-400 dark:text-slate-600 opacity-40 scale-95'
                                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-blue-500 dark:hover:border-blue-400 hover:text-blue-500'
                                }`}
                              >
                                {t.name}
                              </span>
                            );
                          })}
                        </div>
                      </Panel>

                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default FounderSection;
