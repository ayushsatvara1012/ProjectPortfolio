import React from 'react';
import {
  Github,
  ArrowRight,
  Globe,
  Cpu,
  Boxes,
  Zap,
  Activity,
  Layers
} from 'lucide-react';

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
    icon: <Globe size={14} />,
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
    icon: <Globe size={14} />,
    image: "https://images.unsplash.com/photo-1517430816045-df4b7de11d1d?auto=format&fit=crop&q=80&w=1000"
  },
  {
    id: "03",
    title: "SaPyBase",
    subtitle: "Agency Identity Core",
    description: "Ultra-modern, Bento-grid architecture engineered to showcase dual technical profiles. Leveraging React 19 and Tailwind v4 for zero-lag mobile responsiveness.",
    github: "https://github.com/ayushsatvara1012/ProjectPortfolio.git",
    launch: "#",
    status: "Deployed: Vercel",
    accent: "blue",
    icon: <Cpu size={14} />,
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
    icon: <Cpu size={14} />,
    image: "https://images.unsplash.com/photo-1531297484001-80022131f5a1?auto=format&fit=crop&q=80&w=1000"
  }
];

const ProjectSection = () => {
  return (
    <section id="projects" className="bg-white py-12 overflow-hidden">
      <div className="max-w-8xl mx-auto px-6 md:px-12">
        
        {/* Tic-Tac-Toe Grid Architecture */}
        <div className="grid grid-cols-1 gap-px bg-gray-200 border border-gray-200 rounded-none overflow-hidden">
          
          {/* 1. SECTION HEADER BLOCK */}
          <div className="bg-white p-12 md:p-6 flex flex-col justify-center gap-8">
            <div className="flex items-center gap-3 text-md uppercase tracking-widest font-bold text-slate-600">
              <Boxes size={14} />
              <span>Project_Portfolio</span>
            </div>
            <div className="space-y-4">
              <h2 className="text-4xl md:text-5xl font-display font-bold text-slate-900">
                Our 
                <span className="text-indigo-600"> Work.</span>
              </h2>
              <p className="text-base font-display text-slate-600 leading-relaxed max-w-2xl">
                Architecting high-concurrency systems that bridge the gap between complex business logic and high-performance digital interfaces.
              </p>
            </div>
          </div>

          {/* 2. PROJECT ROWS */}
          {projects.map((project, index) => (
            <div key={project.id} className="grid grid-cols-1 lg:grid-cols-12 gap-px bg-gray-200">
              
              {/* IMAGE CELL */}
              <div className="lg:col-span-4 bg-white p-0 relative overflow-hidden h-[300px] lg:h-auto group/img">
                <img 
                  src={project.image} 
                  alt={project.title} 
                  className="w-full h-full object-cover grayscale-0 lg:grayscale opacity-90 transition-all duration-700 lg:group-hover/img:grayscale-0 group-hover/img:scale-105"
                />
                <div className="absolute top-6 left-6 py-1 px-3 bg-slate-900 text-[10px] uppercase tracking-widest font-bold text-white">
                  NODE_REF_{project.id}
                </div>
              </div>

              {/* CONTENT CELL */}
              <div className="lg:col-span-5 bg-white p-10 md:p-14 flex flex-col justify-center gap-6 group/content">
                <div className="flex items-center justify-end gap-2 text-sm font-display uppercase tracking-widest font-bold text-slate-600">
                  <span className="text-green-600">{project.icon}</span>
                  <span>{project.status}</span>
                </div>
                
                <div className="space-y-4">
                  <h3 className="text-xl md:text-3xl font-display text-slate-900 transition-transform duration-500 group-hover/content:translate-x-1">
                    {project.title}
                  </h3>
                  <p className="text-sm font-display uppercase tracking-widest font-bold text-blue-600">
                    // {project.subtitle}
                  </p>
                </div>

                <p className="text-sm font-display text-slate-600 leading-relaxed">
                  {project.description}
                </p>
              </div>

              {/* ACTIONS CELL */}
              <div className="lg:col-span-3 grid grid-cols-2 lg:grid-cols-1 lg:grid-rows-2 gap-px bg-gray-200">
                <a 
                  href={project.github} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="bg-white hover:bg-slate-900 hover:text-white transition-all duration-300 flex flex-row lg:flex-col items-center justify-center p-6 lg:p-8 gap-4 group/btn"
                >
                  <Github className="w-5 h-5 md:w-8 md:h-8 opacity-40 group-hover/btn:opacity-100" />
                  <span className="text-md tracking-widest font-display">Source</span>
                </a>
                <a 
                  href={project.launch} 
                  className="bg-white hover:bg-blue-800 hover:text-white transition-all duration-300 flex flex-row lg:flex-col items-center justify-center p-6 lg:p-8 gap-4 group/btn"
                >
                  <ArrowRight className="w-5 h-5 md:w-8 md:h-8 opacity-40 group-hover/btn:opacity-100" />
                  <span className="text-md tracking-widest font-display">Launch</span>
                </a>
              </div>

            </div>
          ))}

          {/* 3. PERFORMANCE PROTOCOL CTA BLOCK */}
          <div className="bg-white p-12 flex flex-col items-center gap-3 text-center">
            <div className="flex flex-wrap justify-center gap-8 md:gap-16">
              {[
                { label: "LATENCY", value: "<100ms", icon: <Zap size={14} /> },
                { label: "UPTIME", value: "99.98%", icon: <Activity size={14} /> },
                { label: "SECURITY", value: "ENCRYPTED", icon: <ShieldCheck size={14} /> },
                { label: "ARCH", value: "ATOMIC", icon: <Layers size={14} /> }
              ].map((m, i) => (
                <div key={i} className="flex flex-col items-center gap-2">
                  <div className="text-slate-300">{m.icon}</div>
                  <span className="text-md font-display uppercase tracking-widest font-bold text-slate-600">{m.label}</span>
                  <span className="text-base font-bold text-slate-900">{m.value}</span>
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>
    </section>
  );
};

// Internal ShieldCheck icon to resolve dependency
const ShieldCheck = ({ size, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 11 12 14 15 11"/>
  </svg>
);

export default ProjectSection;