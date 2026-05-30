import React from 'react';
import Image from 'next/image';

const projects = [
  {
    id: "01",
    title: "Lumina Search",
    subtitle: "Search Intelligence Engine",
    description: "AI-driven search engine using FastAPI and PostgreSQL with pgvector to manage bulk data (271k+ records) with 384-dimensional vector embeddings drive context-aware discovery.",
    github: "https://github.com/ayushsatvara1012/book_store_ui.git",
    launch: "#",
    status: "Active Development",
    accent: "red",
    icon: <span className="material-symbols-outlined text-[14px]">public</span>,
    image: "https://images.unsplash.com/photo-1507842217343-583bb7270b66?auto=format&fit=crop&q=80&w=1000"
  },
  {
    id: "02",
    title: "Village-Community Platform",
    subtitle: "Community Financial Hub",
    description: "Specialized digital hub for donation management and community heritage preservation. Built with React and FastAPI for high-concurrency village-scale synchronization.",
    github: "https://github.com/ayushsatvara1012/village-community-platform.git",
    launch: "https://village-community-platform.vercel.app/",
    status: "Deployed: Vercel",
    accent: "emerald",
    icon: <span className="material-symbols-outlined text-[14px]">public</span>,
    image: "https://images.unsplash.com/photo-1517430816045-df4b7de11d1d?auto=format&fit=crop&q=80&w=1000"
  },
  {
    id: "03",
    title: "Sapybase",
    subtitle: "Agency Identity Core",
    description: "Ultra-modern, Bento-grid architecture engineered to showcase dual technical profiles. Leveraging React 19 and Tailwind v4 for zero-lag mobile responsiveness.",
    github: "#",
    launch: "/",
    status: "Deployed: Vercel",
    accent: "emerald",
    icon: <span className="material-symbols-outlined text-[14px]">memory</span>,
    image: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&q=80&w=1000"
  },
  {
    id: "04",
    title: "Ghost SDR",
    subtitle: "Sales Development AI",
    description: "Next-generation sales development solution focused on optimizing complex digital workflows. Undergoing rigorous refinement for high-performance scalability.",
    github: "https://github.com/ayushsatvara1012/ghostSDR",
    launch: "#",
    status: "Under Development",
    accent: "yellow",
    icon: <span className="material-symbols-outlined text-[14px]">memory</span>,
    image: "https://images.unsplash.com/photo-1531297484001-80022131f5a1?auto=format&fit=crop&q=80&w=1000"
  }
];

const accentClasses: Record<string, { text: string; bg: string; border: string; dot: string }> = {
  emerald: {
    text: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-50/50 dark:bg-emerald-950/20",
    border: "border-emerald-200/50 dark:border-emerald-800/40",
    dot: "bg-emerald-500"
  },
  yellow: {
    text: "text-yellow-600 dark:text-yellow-400",
    bg: "bg-yellow-50/50 dark:bg-yellow-950/20",
    border: "border-yellow-200/50 dark:border-yellow-800/40",
    dot: "bg-yellow-500"
  },
  blue: {
    text: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-50/50 dark:bg-blue-950/20",
    border: "border-blue-200/50 dark:border-blue-800/40",
    dot: "bg-blue-500"
  },
  red: {
    text: "text-red-600 dark:text-red-400",
    bg: "bg-red-50/50 dark:bg-red-950/20",
    border: "border-red-200/50 dark:border-red-800/40",
    dot: "bg-red-500"
  }
};

const ProjectSection = () => {
  return (
    <section id="projects" className="bg-white dark:bg-slate-950 py-12 overflow-hidden transition-colors duration-500">
      <div className="max-w-8xl mx-auto px-6 md:px-12">

        {/* Cohesive grid architecture matching About section grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-slate-200 dark:bg-slate-800 border-x border-b border-slate-200 dark:border-slate-800 transition-colors duration-500">

          {/* 1. SECTION HEADER BLOCK (Spans full width) */}
          <div className="md:col-span-2 bg-white dark:bg-slate-950 p-8 lg:p-12 flex flex-col justify-center gap-4 transition-colors duration-500 border-t border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2 text-xs uppercase tracking-widest font-bold text-slate-400 dark:text-slate-500 font-google">
              <span className="material-symbols-outlined text-[14px]">inventory_2</span>
              <span>Registry // Case_Studies</span>
            </div>
            
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
              <div className="max-w-2xl">
                <h2 className="text-4xl md:text-5xl font-google font-semibold tracking-tight text-slate-900 dark:text-slate-100 transition-colors">
                  Selected <span className="text-blue-600 dark:text-blue-400">Projects</span>
                </h2>
                <p className="text-base font-google tracking-wider text-slate-600 dark:text-slate-200 mt-2 leading-relaxed">
                  Architecting high-concurrency systems that bridge the gap between complex business logic and high-performance digital interfaces.
                </p>
              </div>
              
              <div className="flex items-center gap-2 shrink-0 bg-slate-50 dark:bg-slate-900 px-3.5 py-1.5 border border-slate-200 dark:border-slate-800/80 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                <span className="text-xs font-google font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                  {projects.length} Records Indexed
                </span>
              </div>
            </div>
          </div>

          {/* 2. PROJECT CARDS */}
          {projects.map((project) => {
            const accent = accentClasses[project.accent] || accentClasses.red;
            return (
              <div 
                key={project.id} 
                className="bg-white dark:bg-slate-950 p-8 lg:p-12 flex flex-col justify-between"
              >
                <div className="space-y-6">
                  {/* Card Header: Node reference & status badge */}
                  <div className="flex items-center justify-between text-xs font-google uppercase tracking-widest font-bold">
                    <span className="text-slate-400 dark:text-slate-500">
                      PROJECT_REF_{project.id}
                    </span>
                    
                    <div className={`flex items-center gap-1.5 ${accent.text} ${accent.bg} ${accent.border} border px-2.5 py-0.5 rounded-full text-[10px]`}>
                      <span className={`w-1 h-1 rounded-full ${accent.dot} animate-pulse`} />
                      <span>{project.status}</span>
                    </div>
                  </div>

                {/* Card Image: Modern layout aspect ratio with hover effects */}
                <div className="relative aspect-video w-full overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900">
                  <Image
                    src={project.image}
                    alt={project.title}
                    fill
                    sizes="(max-width: 768px) 100vw, 50vw"
                    className="object-cover grayscale transition-all duration-700 group-hover:grayscale-0 group-hover:scale-102"
                  />
                </div>

                {/* Text Content */}
                <div className="space-y-2">
                  <h3 className="text-2xl font-google font-semibold text-slate-900 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors duration-200">
                    {project.title}
                  </h3>
                  <p className="text-base font-google font-bold uppercase tracking-widest text-blue-600 dark:text-blue-400">
                  {project.subtitle}
                  </p>
                </div>

                <p className="text-base tracking-wider font-google text-slate-600 dark:text-slate-200 leading-relaxed">
                  {project.description}
                </p>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-3 mt-8 pt-6 border-t border-slate-100 dark:border-slate-800/60">
                {project.github !== "#" ? (
                  <a
                    href={project.github}
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-sm font-google font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors"
                  >
                    <span className="material-symbols-outlined text-[18px]">code</span>
                    <span>Source</span>
                  </a>
                ) : (
                  <button
                    disabled
                    className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl border border-slate-200 dark:border-slate-800/60 bg-slate-50 dark:bg-slate-900/30 text-sm font-google font-medium text-slate-400 dark:text-slate-600 cursor-not-allowed"
                  >
                    <span className="material-symbols-outlined text-[18px]">lock</span>
                    <span>Locked</span>
                  </button>
                )}
                
                {project.launch !== "#" ? (
                  <a
                    href={project.launch}
                    target={project.launch === "/" ? "_self" : "_blank"}
                    rel={project.launch === "/" ? undefined : "noopener noreferrer"}
                    className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-slate-950 dark:bg-slate-900 text-sm font-google font-medium text-white hover:bg-blue-600 dark:hover:bg-blue-600 transition-colors border border-slate-800"
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      {project.launch === "/" ? "home" : "open_in_new"}
                    </span>
                    <span>{project.launch === "/" ? "Current Site" : "Launch"}</span>
                  </a>
                ) : (
                  <button
                    disabled
                    className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl border border-slate-200 dark:border-slate-800/60 bg-slate-50 dark:bg-slate-900/30 text-sm font-google font-medium text-slate-400 dark:text-slate-600 cursor-not-allowed"
                  >
                    <span className="material-symbols-outlined text-[18px]">lock</span>
                    <span>Locked</span>
                  </button>
                )}
              </div>
            </div>
            );
          })}

          {/* 3. PERFORMANCE METRICS STRIP (Spans full width) */}
          <div className="md:col-span-2 grid grid-cols-2 lg:grid-cols-4 gap-px bg-slate-200 dark:bg-slate-800 transition-colors duration-500">
            {[
              { label: "LATENCY", value: "<100ms", icon: "bolt", accent: "text-blue-500" },
              { label: "UPTIME", value: "99.98%", icon: "vital_signs", accent: "text-green-500" },
              { label: "SECURITY", value: "ENCRYPTED", icon: "verified_user", accent: "text-blue-500" },
              { label: "ARCH", value: "ATOMIC", icon: "layers", accent: "text-green-500" }
            ].map((m, i) => (
              <div key={i} className="bg-white dark:bg-slate-950 p-6 lg:p-8 flex flex-col gap-2 transition-colors duration-200">
                <div className="flex items-center gap-2 text-xs tracking-widest font-medium text-slate-400 dark:text-slate-500 font-google">
                  <span className={`material-symbols-outlined text-base ${m.accent}`}>{m.icon}</span>
                  {m.label}
                </div>
                <div className="text-2xl font-google font-semibold tracking-wider text-slate-900 dark:text-slate-100 leading-none">
                  {m.value}
                </div>
              </div>
            ))}
          </div>

        </div>

      </div>
    </section>
  );
};

export default ProjectSection;
