import { BrainCircuit, Code2, CloudCog, Globe, Activity, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Services = () => {
  const navigate = useNavigate();

  const services = [
    {
      id: "01",
      label: "INTELLIGENCE",
      title: "AI & Neural Integration",
      description: "Deploying RAG-optimized LLMs and custom machine learning models that evolve with your data. We architect context-aware intelligence.",
      icon: <BrainCircuit size={20} />,
      btnText: "EXPLORE ARCHITECTURE",
      route: "/services"
    },
    {
      id: "02",
      label: "PERFORMANCE",
      title: "Ultra-Fast Web Engines",
      description: "React/Vite apps engineered for sub-200ms TTFB. High-end UX meeting industrial strength, V8-optimized code.",
      icon: <Code2 size={20} />,
      btnText: "VIEW DEPLOYMENT",
      tags: ["V8_OPTIMIZED", "SSR_READY"],
      route: "/services"
    },
    {
      id: "03",
      label: "INFRASTRUCTURE",
      title: "Cloud Architect",
      description: "AWS infrastructure design using Lambda and Serverless patterns. Scaling without friction across distributed nodes.",
      icon: <CloudCog size={20} />,
      btnText: "SYSTEM LOGS",
      route: "/services"
    },
    {
      id: "04",
      label: "CONNECTIVITY",
      title: "Global Scaling",
      description: "CDN-first deployment for global audiences. Real-time data synchronization at the edge for edge-first applications.",
      icon: <Globe size={20} />,
      btnText: "VIEW DEPLOYMENT LOGS",
      route: "/app/train"
    }
  ];

  return (
    <section id="services" className="bg-white dark:bg-slate-950 py-12 overflow-hidden transition-colors duration-500">
      <div className="max-w-8xl mx-auto px-6 md:px-12">
        
        {/* Tic-Tac-Toe Grid Architecture */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-gray-200 dark:bg-slate-800 border-b border-gray-200 dark:border-slate-800 rounded-none overflow-hidden transition-colors duration-500">
          
          {/* 1. HEADER CELL (Full Width) */}
          <div className="md:col-span-2 bg-white dark:bg-slate-950 p-12 md:p-4 flex flex-col md:flex-row justify-between items-start md:items-end gap-12 group/header transition-colors duration-500">
            <div className="max-w-2xl space-y-8">
              <div className="flex items-center gap-3 text-md font-display uppercase tracking-widest font-bold text-slate-600 dark:text-slate-400 transition-colors">
                <Activity size={14} className="text-slate-300 dark:text-slate-600 transition-colors" />
                <span>Service_Module_Registry</span>
              </div>
              <h2 className="text-4xl md:text-5xl font-display font-bold tracking-tight text-slate-900 dark:text-slate-200 uppercase transition-colors">
                ENGINEERING <br />
                <span className="text-blue-600 dark:text-blue-400">Super-Structures.</span>
              </h2>
            </div>
            
            {/* Architectural Legend */}
            <div className="border-l border-gray-200 dark:border-slate-800 p-6 md:p-8 space-y-4 min-w-[240px] transition-colors duration-500 group-hover/header:border-indigo-100 dark:group-hover/header:border-indigo-900/40">
              <div className="flex justify-between items-center text-[10px] uppercase tracking-widest font-bold text-slate-600 dark:text-slate-400 transition-colors">
                <span>System_Version</span>
                <span className="text-slate-900 dark:text-slate-200 font-sans transition-colors">2.0.6</span>
              </div>
              <div className="flex justify-between items-center text-[10px] uppercase tracking-widest font-bold text-slate-600 dark:text-slate-400 mt-4 transition-colors">
                <span>Uptime</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-sans transition-colors">99.99%</span>
              </div>
              <div className="flex justify-between items-center text-[10px] uppercase tracking-widest font-bold text-slate-600 dark:text-slate-400 mt-4 transition-colors">
                <span>Protocol</span>
                <span className="text-slate-900 dark:text-slate-200 transition-colors">HP_SECURE</span>
              </div>
              <div className="pt-4 border-t border-gray-100 dark:border-slate-800 flex gap-1 transition-colors">
                {[1, 2, 3, 4, 5].map(i => (
                  <div key={i} className="h-1 w-full bg-slate-900 dark:bg-slate-200 opacity-10 dark:opacity-20 transition-all duration-500" />
                ))}
              </div>
            </div>
          </div>

          {/* 2. MODULE CELLS (4 Services) */}
          {services.map((service, idx) => (
            <div key={service.id} className="bg-white dark:bg-slate-950 p-5 md:p-10 flex flex-col justify-between gap-12 group/cell transition-colors duration-500 hover:bg-slate-50/50 dark:hover:bg-slate-900/50 border-t dark:border-slate-800">
              <div className="space-y-8">
                {/* Eyebrow Label */}
                <div className="flex items-center gap-2 text-md font-display tracking-widest font-bold text-slate-600 dark:text-slate-400 transition-colors">
                  <span className="text-blue-600 dark:text-blue-400">{`MODULE_${service.id}`}</span>
                  <span className="text-slate-500 dark:text-slate-600">//</span>
                  <span>{service.label}</span>
                </div>

                {/* Sharp Icon Square */}
                <div className="w-12 h-12 border border-gray-200 dark:border-slate-700 flex items-center justify-center text-slate-900 dark:text-slate-200 bg-white dark:bg-slate-900 group-hover/cell:border-indigo-200 dark:group-hover/cell:border-indigo-700 group-hover/cell:text-indigo-600 dark:group-hover/cell:text-indigo-400 transition-all duration-500">
                  {service.icon}
                </div>

                {/* Content */}
                <div className="space-y-4">
                  <h3 className="text-xl md:text-4xl font-display font-bold text-slate-900 dark:text-slate-200 transition-colors">
                    {service.title.split(' & ').join(' \n& ')}
                  </h3>
                  <p className="text-md font-display text-slate-500 dark:text-slate-400 leading-relaxed max-w-sm transition-colors">
                    {service.description}
                  </p>
                </div>

                {/* Tags for specific modules */}
                {service.tags && (
                  <div className="flex flex-wrap gap-2 pt-2">
                    {service.tags.map(tag => (
                      <span key={tag} className="border-l border-gray-300 dark:border-slate-700 bg-transparent px-2 py-1 text-md font-display uppercase tracking-widest font-bold text-slate-600 dark:text-slate-400 transition-colors">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Action Button */}
              <div className="pt-8 border-t border-gray-100 dark:border-slate-800 mt-auto transition-colors">
                <button 
                  onClick={() => navigate(service.route)}
                  className="w-full md:w-auto px-8 py-5 bg-slate-900 dark:bg-indigo-600 hover:bg-indigo-600 dark:hover:bg-indigo-500 text-md font-sans uppercase tracking-widest font-bold text-white transition-all duration-300 flex items-center justify-center gap-3 group/btn"
                >
                  {service.btnText}
                  <ChevronRight size={14} className="opacity-40 group-hover/btn:translate-x-1 group-hover/btn:opacity-100 transition-all" />
                </button>
              </div>
            </div>
          ))}

        </div>

      </div>
    </section>
  );
};

export default Services;