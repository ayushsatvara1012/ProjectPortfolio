import React from 'react';
import { GraduationCap, Briefcase, Cpu, Globe, ArrowUpRight, Code2, Shield, Zap } from 'lucide-react';

/**
 * ARCHITECTURAL COMPONENT: ResumeNode
 * Purpose: A modular card representing an individual's technical profile.
 * Optimization: Uses CSS transitions over JS animations to protect LCP/FCP.
 */
const ResumeNode = ({ name, role, education, experience, stack, accentColor }) => (
  <div className="relative group p-px rounded-[2.5rem] bg-linear-to-b from-slate-200 to-transparent dark:from-slate-800 dark:to-transparent">
    <div className="bg-white dark:bg-slate-950 rounded-[2.4rem] p-8 lg:p-10 transition-all duration-500 border border-slate-100 dark:border-slate-900 overflow-hidden h-full flex flex-col">

      {/* 1. IDENTITY BLOCK */}
      <div className="flex justify-between items-start mb-10">
        <div>
          <h2 className="text-4xl md:text-5xl font-display font-black tracking-tight text-slate-900 dark:text-slate-200 uppercase leading-none">
            {name}
          </h2>
          <p className={`font-mono text-[10px] tracking-[0.3em] uppercase mt-3 font-bold ${accentColor}`}>
            {role}
          </p>
        </div>
        <div className="h-12 w-12 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 flex items-center justify-center text-slate-400 group-hover:text-indigo-500 transition-colors">
          <Globe size={18} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 grow">
        {/* 2. ACADEMIC FOUNDATION */}
        <div className="space-y-4">
          <div className="flex items-center gap-3 text-slate-400">
            <GraduationCap size={16} />
            <span className="text-[10px] uppercase tracking-widest font-bold font-sans">Education</span>
          </div>
          <div className="relative pl-4 border-l-2 border-slate-100 dark:border-slate-800">
            <h4 className="text-sm font-bold font-sans text-slate-900 dark:text-slate-200 leading-tight">{education.degree}</h4>
            <p className="text-sm text-slate-500 font-medium mt-1">{education.univ}</p>
            <div className="inline-flex mt-3 px-2 py-0.5 rounded-full bg-slate-50 dark:bg-slate-900 text-[10px] font-mono font-bold text-indigo-500 border border-indigo-500/20">
              GPA: {education.gpa}
            </div>
          </div>
        </div>

        {/* 3. TECHNICAL STACK */}
        <div className="space-y-4">
          <div className="flex items-center gap-3 text-slate-400">
            <Cpu size={16} />
            <span className="text-[10px] uppercase tracking-widest font-bold font-sans">Tactical Stack</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {stack.map(tech => (
              <span key={tech} className="px-2.5 py-1 text-[10px] uppercase tracking-widest font-bold font-sans rounded-md border border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-400 bg-slate-50/50 dark:bg-slate-900/50 hover:border-indigo-500/30 transition-colors cursor-default">
                {tech}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* 4. OPERATIONAL EXPERIENCE (PROJECTS) */}
      <div className="mt-10 pt-8 border-t border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-3 text-slate-400 mb-6">
          <Briefcase size={16} />
          <span className="text-[10px] uppercase tracking-widest font-bold font-sans">Core Projects</span>
        </div>
        <div className="grid grid-cols-1 gap-3">
          {experience.map((exp, i) => (
            <div key={i} className="group/item flex items-center justify-between p-4 rounded-2xl bg-slate-50/50 dark:bg-slate-900/30 border border-transparent hover:border-slate-100 dark:hover:border-slate-800 transition-all cursor-pointer">
              <div className="flex items-center gap-4">
                <div className={`p-2 rounded-lg bg-white dark:bg-slate-950 shadow-sm ${accentColor}`}>
                  <Code2 size={16} />
                </div>
                <div>
                  <h5 className="text-sm font-bold font-sans text-slate-900 dark:text-slate-200 leading-tight">{exp.title}</h5>
                  <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mt-0.5">{exp.tech}</p>
                </div>
              </div>
              <ArrowUpRight size={14} className="text-slate-300 group-hover/item:text-indigo-500 transition-all group-hover/item:translate-x-0.5 group-hover/item:-translate-y-0.5" />
            </div>
          ))}
        </div>
      </div>

      {/* Decorative System ID */}
      <div className="absolute -bottom-2 -right-2 text-[60px] font-display font-black text-slate-100 dark:text-slate-900/40 select-none pointer-events-none -rotate-12">
        {name.substring(0, 2)}
      </div>
    </div>
  </div>
);

const DuoPortfolio = () => {
  return (
    <section className="py-12 px-6 bg-white dark:bg-slate-950 min-h-dvh overflow-hidden">
      <div className="max-w-7xl mx-auto">

        {/* DUO HEADER */}
        <div className="flex flex-col items-center text-center mb-24 space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800 mb-2">
            <Zap size={14} className="text-indigo-600" />
            <span className="text-[10px] uppercase tracking-widest font-bold font-sans text-indigo-600">The Synergy Protocol</span>
          </div>
          <h1 className="text-5xl md:text-8xl font-display font-black text-slate-900 dark:text-slate-200 tracking-tight leading-none">
            ENGINEER <span className="text-transparent bg-clip-text bg-linear-to-r from-indigo-600 to-violet-500">NODES.</span>
          </h1>
          <p className="max-w-2xl text-base text-slate-500 dark:text-slate-400 leading-relaxed">
            Bridging theoretical computer science with production-grade full-stack engineering.
            Two nodes, one unified digital ecosystem.
          </p>
        </div>

        {/* BENTO GRID DUO */}
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-stretch">

          {/* NODE 01: THE ARCHITECT */}
          <ResumeNode
            name="Ayush P. Satvara"
            role="Software Development Engineer"
            accentColor="text-indigo-600 dark:text-indigo-400"
            education={{ degree: "MS Computer Science", univ: "New York Institute of Technology", gpa: "3.26/4.0" }}
            stack={["Python", "FastAPI", "AWS", "PostgreSQL", "React 19", "Tailwind CSS", "Vite"]}
            experience={[
              { title: "SaPyBase Portfolio", tech: "React • Vite • Tailwind v4 • SEO" },
              { title: "LuminaLib AI", tech: "FastAPI • pgvector • RAG" },
              { title: "V-Comm: Community Management", tech: "IAM • S3 • EC2 • Route53" }
            ]}
          />

          {/* NODE 02: THE CREATIVE ENGINEER */}
          <ResumeNode
            name="Kathan Pandya"
            role="Full-Stack Engineer"
            accentColor="text-violet-600 dark:text-violet-400"
            education={{ degree: "BTech Information Technology", univ: "LDRP Institute of Technology", gpa: "3.9/4.0" }}
            stack={["TypeScript", "SvelteKit", "Angular", "Node.js", "MongoDB", "Figma", "SCSS"]}
            experience={[
              { title: "Community Management", tech: "React • Supabase • CRUD" },
              { title: "UI/UX Design System", tech: "Figma • Atomic Design" },
              { title: "Real-time Dashboards", tech: "WebSockets • Redis" }
            ]}
          />
        </div>

        {/* FOOTER SYNERGY BADGE */}
        <div className="mt-20 flex justify-center">
          <div className="p-6 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800 text-center">
            <p className="text-[10px] font-mono text-slate-400 uppercase tracking-widest">
              Integrated Deployment Status: <span className="text-emerald-500 font-bold font-sans">Optimal</span>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default DuoPortfolio;