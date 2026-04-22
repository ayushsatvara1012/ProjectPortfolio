import { useState } from 'react';
import SEO from '../components/Seo';
import seoConfig from '../seo/seoConfig';
import Projects from '../components/projectSection';
import ScrollReveal from '../components/ScrollReveal';

/* ─────────────────────────────────────────────────────────────────────────────
   DATA — all resume/about content lives here, deconstructed into grid cells
───────────────────────────────────────────────────────────────────────────── */
const STACK = [
  { name: 'Python',       note: 'Backend core'         },
  { name: 'FastAPI',      note: 'REST & async'          },
  { name: 'React 19',     note: 'UI layer'              },
  { name: 'PostgreSQL',   note: 'Relational store'      },
  { name: 'pgvector',     note: 'Semantic search'       },
  { name: 'AWS',          note: 'Cloud infra'           },
  { name: 'Tailwind v4',  note: 'Design system'         },
  { name: 'Vite',         note: 'Build tooling'         },
  { name: 'Gemini AI',    note: 'LLM layer'             },
  { name: 'RAG Pipeline', note: 'Context retrieval'     },
  { name: 'Supabase',     note: 'Auth & realtime'       },
  { name: 'Docker',       note: 'Containerisation'      },
];

const PROJECTS = [
  {
    title:   'SaPyBase Portfolio',
    tech:    'React · Vite · Tailwind v4 · SEO',
    result:  '100 Lighthouse',
    tag:     'LIVE',
  },
  {
    title:   'LuminaLib AI',
    tech:    'FastAPI · pgvector · RAG',
    result:  '<80ms retrieval',
    tag:     'DEPLOYED',
  },
  {
    title:   'V-Comm Platform',
    tech:    'IAM · S3 · EC2 · Route53',
    result:  '99.9% uptime',
    tag:     'PRODUCTION',
  },
];

const CERTIFICATIONS = [
  { name: 'AWS Certified Solutions Architect', issuer: 'Amazon Web Services' },
  { name: 'Generative AI: Prompt Engineering', issuer: 'IBM' },
  { name: 'Machine Learning with Python', issuer: 'IBM' },
  { name: 'Intermediate Machine Learning', issuer: 'Kaggle' },
  { name: 'Python Programming', issuer: 'Kaggle' },
  { name: 'Android Studio Masterclass', issuer: 'Udemy' },
];

/* ─────────────────────────────────────────────────────────────────────────────
   CELL WRAPPER — enforces the shared border-collapse token so every cell
   participates in the same grid seam. The outer grid uses `gap-px bg-slate-200
   dark:bg-slate-800`; each cell fills the slot with its own bg, making the
   1-px gap read as a hard border between cells.
───────────────────────────────────────────────────────────────────────────── */
const Cell = ({ children, className = '', onClick, role }) => (
  <div
    role={role}
    onClick={onClick}
    className={`bg-white dark:bg-slate-950 p-8 lg:p-12 flex flex-col transition-colors duration-200 ${className}`}
  >
    {children}
  </div>
);

/* Eyebrow label used in every cell header — matches metrics.jsx convention */
const Label = ({ icon, children }) => (
  <div className="flex items-center gap-2 text-xs uppercase tracking-widest font-bold text-slate-400 dark:text-slate-500 font-google mb-6">
    {icon && <span className="material-symbols-outlined text-[14px]">{icon}</span>}
    {children}
  </div>
);

/* ─────────────────────────────────────────────────────────────────────────────
   ABOUT PAGE
───────────────────────────────────────────────────────────────────────────── */
const AboutPage = () => {
  const [activeProject, setActiveProject] = useState(null);

  return (
    <>
      <SEO {...seoConfig.about} />
      <div className="bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-200 overflow-x-clip transition-colors duration-500">

        {/* ══════════════════════════════════════════════════════════════════
            HEADER STRIP — mirrors the contact page label convention
        ══════════════════════════════════════════════════════════════════ */}
        <div className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 pt-20 pb-0">
          <div className="max-w-8xl mx-auto px-6 md:px-12 py-6 flex items-center justify-between">
            <div className="inline-flex items-center gap-2 px-2 py-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-none">
              <span className="material-symbols-outlined text-[14px] text-blue-600">terminal</span>
              <span className="text-xs font-display uppercase tracking-widest font-bold text-slate-400 dark:text-slate-500">Sapybase_v2.0 · About</span>
            </div>
            {/* Available-for-work signal */}
            <div className="flex items-center gap-2">
              <span className="block w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-xs font-google font-bold uppercase tracking-widest text-green-600 dark:text-green-500">Available</span>
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════════
            ROW 1 — 3-col grid: HERO · STACK · METRIC
            gap-px + bg-slate-200 = collapsed 1-px seams between cells
        ══════════════════════════════════════════════════════════════════ */}
        <div className="max-w-8xl mx-auto px-6 md:px-12">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-px bg-slate-200 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 transition-colors duration-500">

            {/* ── CELL A · HERO ─────────────────────────────────────────── */}
            <div
              className="lg:col-span-2 min-h-[420px] sm:min-h-[500px] lg:min-h-[480px] relative overflow-hidden flex flex-col justify-between group"
              style={{
                backgroundImage: 'url(/about-vec.webp)',
                backgroundSize: 'cover',
                backgroundPosition: 'center center',
                backgroundRepeat: 'no-repeat',
              }}
            >
              {/* Scrim — heavier at bottom so text stays readable on every screen */}
              <div className="absolute inset-0 bg-linear-to-b from-white/85 via-white/75 to-white/95 dark:from-slate-950/85 dark:via-slate-950/75 dark:to-slate-950/95 transition-colors duration-500" />

              {/* Globe — decorative, pinned to bottom-right, scales with screen */}
              <div className="absolute -top-65 -right-60 w-lg h-lg sm:w-160 sm:h-160 md:w-3xl md:h-3xl lg:w-4xl lg:h-4xl opacity-20 dark:opacity-10 pointer-events-none select-none translate-x-20 translate-y-20 sm:translate-x-28 sm:translate-y-28">
                <img
                  src="/globe.svg"
                  alt=""
                  aria-hidden="true"
                  className="w-full h-full object-contain"
                />
              </div>

              {/* Content sits above the scrim and globe */}
              <div className="relative z-10 flex flex-col justify-between flex-1 p-8 lg:p-12">
                <div>
                  <Label icon="person">Founder · Lead Engineer</Label>
                  <h1 className="text-5xl md:text-7xl font-display font-black tracking-tight leading-none text-slate-900 dark:text-slate-100 mb-6">
                    Built by One<br />
                    <span className="text-blue-600">Scaled for</span><br />
                    the World.
                  </h1>
                  <p className="text-base font-google text-slate-500 dark:text-slate-400 leading-relaxed max-w-md">
                    I'm <strong className="text-slate-900 dark:text-slate-200 font-bold">Ayush Satvara</strong> — the solo architect, engineer, and founder
                    behind SaPyBase. Every line of infrastructure, from the RAG pipeline to the
                    React UI, was designed and shipped by one person.
                  </p>
                </div>
                <div className="mt-10 flex flex-col sm:flex-row gap-3">
                  <a
                    href="/contact"
                    className="inline-flex items-center gap-2 px-6 py-3 bg-slate-900 dark:bg-slate-200 text-white dark:text-slate-900 text-sm font-display font-bold uppercase tracking-wider transition-colors duration-200 hover:bg-blue-600 dark:hover:bg-blue-500 dark:hover:text-white"
                  >
                    Start a Project
                    <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                  </a>
                </div>
              </div>
            </div>

            {/* ── CELL B · PROFILE IMAGE ─────────────────────────────────── */}
            <Cell className="items-center justify-center min-h-[360px] lg:min-h-0 p-0 overflow-hidden relative bg-slate-50 dark:bg-slate-900">
              <img
                src="/IMG_9145.webp"
                alt="Ayush Satvara"
                className="w-full h-full object-cover transition-all duration-700 min-h-[300px] lg:min-h-full"
                style={{ objectPosition: 'center top' }}
              />
              {/* Overlay badge */}
              <div className="absolute bottom-0 left-0 right-0 bg-white/90 dark:bg-slate-950/90 border-t border-slate-200 dark:border-slate-800 px-5 py-3 flex items-center justify-between">
                <div>
                  <p className="text-xs font-google font-bold uppercase tracking-widest text-slate-400">MS Computer Science</p>
                  <p className="text-sm font-display font-bold text-slate-900 dark:text-slate-200">NYIT · GPA 3.26</p>
                </div>
                <span className="material-symbols-outlined text-[18px] text-slate-300 dark:text-slate-700">school</span>
              </div>
            </Cell>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════════
            ROW 2 — METRICS STRIP (4 stats, mirroring metrics.jsx rhythm)
        ══════════════════════════════════════════════════════════════════ */}
        <ScrollReveal className="max-w-8xl mx-auto px-6 md:px-12">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-slate-200 dark:bg-slate-800 border-x border-b border-slate-200 dark:border-slate-800 transition-colors duration-500">
            {[
              { eyebrow: 'Bot Response Time',   value: '<2s',        icon: 'bolt',          accent: 'text-blue-500'   },
              { eyebrow: 'Chatbot Uptime',       value: '99.9%',      icon: 'verified_user', accent: 'text-green-500'  },
              { eyebrow: 'Deploy Time',          value: '< 10 min',   icon: 'rocket_launch', accent: 'text-blue-500'   },
              { eyebrow: 'Platforms Supported',  value: 'Any HTML',   icon: 'devices',       accent: 'text-green-500'  },
            ].map((m, i) => (
              <div key={i} className="bg-white dark:bg-slate-950 p-8 lg:p-10 flex flex-col gap-3 group/cell transition-colors duration-200 hover:bg-slate-50 dark:hover:bg-slate-900">
                <div className="flex items-center gap-2 text-xs uppercase tracking-widest font-bold text-slate-400 dark:text-slate-500 font-google">
                  <span className={`material-symbols-outlined text-[14px] ${m.accent}`}>{m.icon}</span>
                  {m.eyebrow}
                </div>
                <div className="text-4xl md:text-5xl font-display font-black tracking-tight text-slate-900 dark:text-slate-100 tabular-nums leading-none group-hover/cell:translate-x-0.5 transition-transform duration-200">
                  {m.value}
                </div>
              </div>
            ))}
          </div>
        </ScrollReveal>

        {/* ══════════════════════════════════════════════════════════════════
            ROW 3 — TECH STACK · PROJECTS
        ══════════════════════════════════════════════════════════════════ */}
        <ScrollReveal className="max-w-8xl mx-auto px-6 md:px-12">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-px bg-slate-200 dark:bg-slate-800 border-x border-b border-slate-200 dark:border-slate-800 transition-colors duration-500">

            {/* ── CELL · TECH STACK ──────────────────────────────────────── */}
            <Cell>
              <Label icon="memory">Core Stack</Label>
              <div className="flex flex-col divide-y divide-slate-100 dark:divide-slate-800">
                {STACK.map((t, i) => (
                  <div key={i} className="flex items-center justify-between py-2.5 group/row">
                    <span className="text-sm font-display font-bold text-slate-800 dark:text-slate-200 group-hover/row:text-blue-600 dark:group-hover/row:text-blue-400 transition-colors duration-150">
                      {t.name}
                    </span>
                    <span className="text-xs font-google text-slate-400 dark:text-slate-600 uppercase tracking-wider">
                      {t.note}
                    </span>
                  </div>
                ))}
              </div>
            </Cell>

            {/* ── CELL · PROJECTS ─────────────────────────────────────────── */}
            <Cell className="lg:col-span-2">
              <Label icon="folder_open">Core Projects</Label>
              <div className="flex flex-col gap-px bg-slate-200 dark:bg-slate-800 border border-slate-200 dark:border-slate-800">
                {PROJECTS.map((p, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveProject(activeProject === i ? null : i)}
                    className={`
                      w-full text-left bg-white dark:bg-slate-950 p-5 flex items-start justify-between gap-4
                      transition-colors duration-150 group/row
                      ${activeProject === i ? 'bg-blue-50 dark:bg-blue-950/30' : 'hover:bg-slate-50 dark:hover:bg-slate-900'}
                    `}
                  >
                    <div className="flex flex-col gap-1 min-w-0">
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className={`text-xs font-google font-bold uppercase tracking-widest px-1.5 py-0.5 border ${
                          p.tag === 'LIVE' || p.tag === 'DEPLOYED'
                            ? 'border-green-200 dark:border-green-800 text-green-600 dark:text-green-500 bg-green-50 dark:bg-green-900/20'
                            : 'border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        }`}>
                          {p.tag}
                        </span>
                        <span className="text-base font-display font-bold text-slate-900 dark:text-slate-100 group-hover/row:text-blue-600 dark:group-hover/row:text-blue-400 transition-colors">
                          {p.title}
                        </span>
                      </div>
                      {activeProject === i && (
                        <p className="text-xs font-google text-slate-500 dark:text-slate-400 uppercase tracking-wider mt-1">
                          {p.tech}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-xs font-display font-bold text-green-600 dark:text-green-500 whitespace-nowrap">
                        {p.result}
                      </span>
                      <span className={`material-symbols-outlined text-[16px] text-slate-300 dark:text-slate-700 transition-transform duration-200 ${activeProject === i ? 'rotate-90 text-blue-500' : 'group-hover/row:text-blue-500'}`}>
                        chevron_right
                      </span>
                    </div>
                  </button>
                ))}
              </div>

              {/* Bootstrapped banner */}
              <div className="mt-auto pt-8">
                <div className="border border-dashed border-slate-200 dark:border-slate-800 p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-google font-bold uppercase tracking-widest text-slate-400 mb-1">Founding Status</p>
                    <p className="text-4xl font-display font-black text-slate-900 dark:text-slate-100 tracking-tight leading-none">
                      100% Bootstrapped
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-xs font-google font-bold uppercase tracking-widest text-green-600 dark:text-green-500">Solo-built · NYC</span>
                  </div>
                </div>
              </div>
            </Cell>

          </div>
        </ScrollReveal>

        {/* ══════════════════════════════════════════════════════════════════
            ROW 4 — EDUCATION · CERTIFICATIONS · PHILOSOPHY
        ══════════════════════════════════════════════════════════════════ */}
        <ScrollReveal className="max-w-8xl mx-auto px-6 md:px-12">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-slate-200 dark:bg-slate-800 border-x border-b border-slate-200 dark:border-slate-800 transition-colors duration-500">

            {/* ── CELL · EDUCATION ──────────────────────────────────────── */}
            <Cell className="hover:bg-slate-50/60 dark:hover:bg-slate-900/40 transition-colors duration-200">
              <Label icon="school">Education</Label>

              <div className="flex flex-col gap-6">
                <div className="border-l-2 border-blue-500 pl-4">
                  <p className="text-xs font-google font-bold uppercase tracking-widest text-slate-400 mb-1">2023 – 2025</p>
                  <h3 className="text-lg font-display font-bold text-slate-900 dark:text-slate-100 leading-tight">
                    MS Computer Science
                  </h3>
                  <p className="text-sm font-google text-slate-500 dark:text-slate-400 mt-1">
                    New York Institute of Technology
                  </p>
                  <div className="inline-flex items-center gap-1.5 mt-3 px-2 py-0.5 border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20">
                    <span className="text-xs font-display font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">GPA 3.26 / 4.0</span>
                  </div>
                </div>

                <div className="border-l-2 border-slate-200 dark:border-slate-800 pl-4">
                  <p className="text-xs font-google font-bold uppercase tracking-widest text-slate-400 mb-1">2019 – 2023</p>
                  <h3 className="text-lg font-display font-bold text-slate-900 dark:text-slate-100 leading-tight">
                    BTech Information Technology
                  </h3>
                  <p className="text-sm font-google text-slate-500 dark:text-slate-400 mt-1">
                    KSV University
                  </p>
                  <div className="inline-flex items-center gap-1.5 mt-3 px-2 py-0.5 border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20">
                    <span className="text-xs font-display font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">CGPA 7.52 / 10</span>
                  </div>
                </div>
              </div>
            </Cell>

            {/* ── CELL · CERTIFICATIONS ─────────────────────────────────── */}
            <Cell className="hover:bg-slate-50/60 dark:hover:bg-slate-900/40 transition-colors duration-200">
              <Label icon="workspace_premium">Certifications</Label>
              <div className="flex flex-col divide-y divide-slate-100 dark:divide-slate-800">
                {CERTIFICATIONS.map((c, i) => (
                  <div key={i} className="flex flex-col gap-0.5 py-3 group/row">
                    <span className="text-sm font-display font-bold text-slate-800 dark:text-slate-200 group-hover/row:text-blue-600 dark:group-hover/row:text-blue-400 transition-colors duration-150 leading-snug">
                      {c.name}
                    </span>
                    <span className="text-xs font-google text-slate-400 dark:text-slate-600 uppercase tracking-wider">
                      {c.issuer}
                    </span>
                  </div>
                ))}
              </div>
            </Cell>

            {/* ── CELL · WHAT WE DELIVER ────────────────────────────────── */}
            <Cell className="bg-slate-50/50 dark:bg-slate-900 hover:bg-slate-100/60 dark:hover:bg-slate-900/70 transition-colors duration-200">
              <Label icon="lightbulb">What We Deliver</Label>
              <div className="flex flex-col gap-5">
                {[
                  {
                    heading: 'AI Chatbot on Your Website',
                    body: 'We build a custom AI assistant trained on your own content — your FAQs, product pages, and docs. Your visitors get instant, accurate answers 24/7 without you lifting a finger.',
                    icon: 'smart_toy',
                    accent: 'text-blue-500',
                  },
                  {
                    heading: 'Trained on Your Data, Not the Internet',
                    body: 'Unlike generic AI tools, your bot only knows what you teach it. Upload a PDF, paste a URL, or type your policies — the bot sticks to your information and never makes things up.',
                    icon: 'database',
                    accent: 'text-green-500',
                  },
                  {
                    heading: 'Embed in 60 Seconds',
                    body: 'One script tag. Paste it into any website — Shopify, Webflow, WordPress, or plain HTML — and your chatbot is live. No developer needed after the initial setup.',
                    icon: 'code',
                    accent: 'text-blue-500',
                  },
                  {
                    heading: 'Full Control from a Dashboard',
                    body: "Retrain the bot when your content changes, adjust its tone and name, and watch real conversations in the dashboard. You own every setting — no black box.",
                    icon: 'tune',
                    accent: 'text-green-500',
                  },
                ].map((p, i) => (
                  <div key={i} className="flex gap-3">
                    <span className={`material-symbols-outlined text-[18px] mt-0.5 shrink-0 ${p.accent}`}>{p.icon}</span>
                    <div>
                      <p className="text-sm font-display font-bold text-slate-900 dark:text-slate-100 leading-none mb-1">{p.heading}</p>
                      <p className="text-xs font-google text-slate-500 dark:text-slate-400 leading-relaxed">{p.body}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Cell>

          </div>
        </ScrollReveal>

        {/* ══════════════════════════════════════════════════════════════════
            ROW 5 — PROJECT PORTFOLIO
        ══════════════════════════════════════════════════════════════════ */}
        <ScrollReveal><Projects /></ScrollReveal>

        {/* ══════════════════════════════════════════════════════════════════
            ROW 6 — CTA STRIP (full-width, dark, matches site footer energy)
        ══════════════════════════════════════════════════════════════════ */}
        <ScrollReveal className="max-w-8xl mx-auto px-6 md:px-12">
          <div className="border-x border-b border-slate-200 dark:border-slate-800 bg-slate-950 dark:bg-slate-950 p-12 md:p-20 flex flex-col lg:flex-row items-start lg:items-end justify-between gap-8 transition-colors duration-500">
            <div>
              <p className="text-xs font-google font-bold uppercase tracking-widest text-slate-500 mb-4">
                Deployment Status ·{' '}
                <span className="text-green-500">Optimal</span>
              </p>
              <h2 className="text-4xl md:text-6xl font-display font-black tracking-tight text-white leading-none">
                Performance-First.<br />
                <span className="text-blue-500">Always.</span>
              </h2>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 shrink-0">
              <a
                href="/contact"
                className="inline-flex items-center gap-2 px-7 py-4 bg-blue-600 hover:bg-blue-500 text-white text-sm font-display font-bold uppercase tracking-wider transition-colors duration-150"
              >
                Start Building
                <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
              </a>
              <a
                href="/services"
                className="inline-flex items-center gap-2 px-7 py-4 border border-slate-700 hover:border-slate-500 text-slate-400 hover:text-white text-sm font-display font-bold uppercase tracking-wider transition-colors duration-150"
              >
                View Services
              </a>
            </div>
          </div>
        </ScrollReveal>

        {/* Bottom spacer — matches the page rhythm */}
        <div className="h-px bg-slate-200 dark:bg-slate-800 max-w-8xl mx-auto px-6 md:px-12" />
        <div className="pb-8" />

      </div>
    </>
  );
};

export default AboutPage;
