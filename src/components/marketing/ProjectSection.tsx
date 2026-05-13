import React from 'react';
import Image from 'next/image';

const projects = [
  {
    id: "01",
    title: "LuminaLib",
    subtitle: "Distributed Book Intelligence Engine",
    description: "AI-driven digital library platform using FastAPI and PostgreSQL with pgvector to manage 271k records. 384-dimensional vector embeddings drive context-aware discovery.",
    github: "https://github.com/ayushsatvara1012/book_store_ui.git",
    launch: "#",
    status: "Active Development",
    accent: "indigo",
    icon: <span className="material-symbols-outlined text-[14px]">public</span>,
    image: "https://images.unsplash.com/photo-1507842217343-583bb7270b66?auto=format&fit=crop&q=80&w=1000"
  },
  {
    id: "02",
    title: "V-Comm",
    subtitle: "Community Financial Hub",
    description: "Specialized digital hub for donation management and community heritage preservation. Built with React and FastAPI for high-concurrency village-scale synchronization.",
    github: "https://github.com/ayushsatvara1012/village-community-platform.git",
    launch: "https://village-community-platform.vercel.app/",
    status: "Deployed: Vercel",
    accent: "orange",
    icon: <span className="material-symbols-outlined text-[14px]">public</span>,
    image: "https://images.unsplash.com/photo-1517430816045-df4b7de11d1d?auto=format&fit=crop&q=80&w=1000"
  },
  {
    id: "03",
    title: "Sapybase",
    subtitle: "Agency Identity Core",
    description: "Ultra-modern, Bento-grid architecture engineered to showcase dual technical profiles. Leveraging React 19 and Tailwind v4 for zero-lag mobile responsiveness.",
    github: "https://github.com/ayushsatvara1012/ProjectPortfolio.git",
    launch: "#",
    status: "Deployed: Vercel",
    accent: "blue",
    icon: <span className="material-symbols-outlined text-[14px]">memory</span>,
    image: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&q=80&w=1000"
  },
  {
    id: "04",
    title: "Ghost SDR",
    subtitle: "Sales Development AI",
    description: "Next-generation sales development solution focused on optimizing complex digital workflows. Undergoing rigorous refinement for high-performance scalability.",
    github: "#",
    launch: "#",
    status: "Under Development",
    accent: "gray",
    icon: <span className="material-symbols-outlined text-[14px]">memory</span>,
    image: "https://images.unsplash.com/photo-1531297484001-80022131f5a1?auto=format&fit=crop&q=80&w=1000"
  }
];

const ProjectSection = () => {
  return (
    <section id="projects" className="bg-white dark:bg-slate-950 py-12 overflow-hidden transition-colors duration-500">
      <div className="max-w-8xl mx-auto px-6 md:px-12">

        {/* Tic-Tac-Toe Grid Architecture */}
        <div className="grid grid-cols-1 gap-px bg-gray-200 dark:bg-slate-800 border border-gray-200 dark:border-slate-800 rounded-none overflow-hidden transition-colors duration-500">

          {/* 1. SECTION HEADER BLOCK */}
          <div className="bg-white dark:bg-slate-950 p-12 md:p-6 flex flex-col justify-center gap-8 transition-colors duration-500">
            <div className="flex items-center gap-3 text-sm uppercase tracking-widest font-bold text-slate-600 dark:text-slate-400 transition-colors">
              <span className="material-symbols-outlined text-[14px]">inventory_2</span>
              <span>Project_Portfolio</span>
            </div>
            <div className="space-y-4">
              <h2 className="text-4xl md:text-5xl font-display font-bold text-slate-900 dark:text-slate-200 transition-colors">
                Our
                <span className="text-indigo-600 dark:text-indigo-400"> Work.</span>
              </h2>
              <p className="text-base font-display text-slate-600 dark:text-slate-400 leading-relaxed max-w-2xl transition-colors">
                Architecting high-concurrency systems that bridge the gap between complex business logic and high-performance digital interfaces.
              </p>
            </div>
          </div>

          {/* 2. PROJECT ROWS */}
          {projects.map((project, index) => (
            <div key={project.id} className="grid grid-cols-1 lg:grid-cols-12 gap-px bg-gray-200 dark:bg-slate-800 transition-colors duration-500">

              {/* IMAGE CELL */}
              <div className="lg:col-span-4 bg-white dark:bg-slate-950 p-0 relative overflow-hidden h-[300px] lg:h-auto group/img transition-colors duration-500">
                <Image
                  src={project.image}
                  alt={project.title}
                  fill
                  sizes="(max-width: 768px) 100vw, 33vw"
                  className="object-cover grayscale-0 lg:grayscale opacity-90 transition-all duration-700 lg:group-hover/img:grayscale-0 group-hover/img:scale-105"
                />
                <div className="absolute top-6 left-6 py-1 px-3 bg-slate-900 dark:bg-indigo-600 text-[10px] uppercase tracking-widest font-bold text-white transition-colors">
                  NODE_REF_{project.id}
                </div>
              </div>

              {/* CONTENT CELL */}
              <div className="lg:col-span-5 bg-white dark:bg-slate-950 p-10 md:p-14 flex flex-col justify-center gap-6 group/content transition-colors duration-500">
                <div className="flex items-center justify-end gap-2 text-sm font-display uppercase tracking-widest font-bold text-slate-600 dark:text-slate-400 transition-colors">
                  <span className="text-green-600 dark:text-emerald-400">{project.icon}</span>
                  <span>{project.status}</span>
                </div>

                <div className="space-y-4">
                  <h3 className="text-xl md:text-3xl font-display text-slate-900 dark:text-slate-200 transition-transform duration-500 group-hover/content:translate-x-1">
                    {project.title}
                  </h3>
                  <p className="text-sm font-display uppercase tracking-widest font-bold text-blue-600 dark:text-blue-400 transition-colors">
                    // {project.subtitle}
                  </p>
                </div>

                <p className="text-sm font-display text-slate-600 dark:text-slate-400 leading-relaxed transition-colors">
                  {project.description}
                </p>
              </div>

              {/* ACTIONS CELL */}
              <div className="lg:col-span-3 grid grid-cols-2 lg:grid-cols-1 lg:grid-rows-2 gap-px bg-gray-200 dark:bg-slate-800 transition-colors duration-500">
                <a
                  href={project.github}
                  target="_blank" rel="noopener noreferrer"
                  className="bg-white dark:bg-slate-950 dark:text-slate-400 hover:bg-slate-900 dark:hover:bg-slate-800 hover:text-white dark:hover:text-slate-200 transition-all duration-300 flex flex-row lg:flex-col items-center justify-center p-6 lg:p-8 gap-4 group/btn"
                >
                  <span className="material-symbols-outlined text-[20px] md:text-[32px] opacity-40 group-hover/btn:opacity-100">code</span>
                  <span className="text-sm tracking-widest font-display">Source</span>
                </a>
                <a
                  href={project.launch}
                  target="_blank" rel="noopener noreferrer"
                  className="bg-white dark:bg-slate-950 dark:text-slate-400 hover:bg-blue-800 dark:hover:bg-indigo-600 hover:text-white dark:hover:text-slate-200 transition-all duration-300 flex flex-row lg:flex-col items-center justify-center p-6 lg:p-8 gap-4 group/btn"
                >
                  <span className="material-symbols-outlined text-[20px] md:text-[32px] opacity-40 group-hover/btn:opacity-100">arrow_forward</span>
                  <span className="text-sm tracking-widest font-display">Launch</span>
                </a>
              </div>

            </div>
          ))}

          {/* 3. PERFORMANCE PROTOCOL CTA BLOCK */}
          <div className="bg-white dark:bg-slate-950 p-12 flex flex-col items-center gap-3 text-center transition-colors duration-500">
            <div className="flex flex-wrap justify-center gap-8 md:gap-16">
              {[
                { label: "LATENCY", value: "<100ms", icon: <span className="material-symbols-outlined text-[14px]">bolt</span> },
                { label: "UPTIME", value: "99.98%", icon: <span className="material-symbols-outlined text-[14px]">vital_signs</span> },
                { label: "SECURITY", value: "ENCRYPTED", icon: <span className="material-symbols-outlined text-[14px]">verified_user</span> },
                { label: "ARCH", value: "ATOMIC", icon: <span className="material-symbols-outlined text-[14px]">layers</span> }
              ].map((m, i) => (
                <div key={i} className="flex flex-col items-center gap-2">
                  <div className="text-slate-300 dark:text-slate-700 transition-colors">{m.icon}</div>
                  <span className="text-sm font-display uppercase tracking-widest font-bold text-slate-600 dark:text-slate-400 transition-colors">{m.label}</span>
                  <span className="text-base font-bold text-slate-900 dark:text-slate-200 transition-colors">{m.value}</span>
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>
    </section>
  );
};

export default ProjectSection;
