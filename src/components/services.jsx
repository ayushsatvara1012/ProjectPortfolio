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
    <section id="services" className="bg-white py-24 md:py-32 border-t border-gray-100 overflow-hidden">
      <div className="max-w-7xl mx-auto px-6 md:px-12">
        
        {/* Tic-Tac-Toe Grid Architecture */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-gray-200 border border-gray-200 rounded-none overflow-hidden">
          
          {/* 1. HEADER CELL (Full Width) */}
          <div className="md:col-span-2 bg-white p-12 md:p-20 flex flex-col md:flex-row justify-between items-start md:items-end gap-12 group/header">
            <div className="max-w-2xl space-y-8">
              <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-[0.25em] text-slate-400">
                <Activity size={14} className="text-slate-300" />
                <span>Service_Module_Registry</span>
              </div>
              <h2 className="text-4xl sm:text-6xl md:text-8xl font-black text-slate-900 tracking-tighter leading-[0.85] uppercase">
                ENGINEERING <br />
                <span className="text-slate-200">Super-Structures.</span>
              </h2>
            </div>
            
            {/* Architectural Legend */}
            <div className="border border-gray-200 p-6 md:p-8 space-y-4 min-w-[240px] transition-colors duration-500 group-hover/header:border-indigo-100">
              <div className="flex justify-between items-center text-[10px] font-mono tracking-widest text-slate-400 uppercase">
                <span>System_Version</span>
                <span className="text-slate-900">2.0.6</span>
              </div>
              <div className="flex justify-between items-center text-[10px] font-mono tracking-widest text-slate-400 uppercase">
                <span>Uptime</span>
                <span className="text-emerald-600 font-bold">99.99%</span>
              </div>
              <div className="flex justify-between items-center text-[10px] font-mono tracking-widest text-slate-400 uppercase">
                <span>Protocol</span>
                <span className="text-slate-900">HP_SECURE</span>
              </div>
              <div className="pt-4 border-t border-gray-100 flex gap-1">
                {[1, 2, 3, 4, 5].map(i => (
                  <div key={i} className="h-1 w-full bg-slate-900 opacity-10" />
                ))}
              </div>
            </div>
          </div>

          {/* 2. MODULE CELLS (4 Services) */}
          {services.map((service, idx) => (
            <div key={service.id} className="bg-white p-10 md:p-14 flex flex-col justify-between gap-12 group/cell transition-colors duration-500 hover:bg-slate-50/50">
              <div className="space-y-8">
                {/* Eyebrow Label */}
                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.25em] text-slate-400">
                  <span className="text-indigo-600">MODULE_{service.id}</span>
                  <span className="text-slate-300 text-[8px]">//</span>
                  <span>{service.label}</span>
                </div>

                {/* Sharp Icon Square */}
                <div className="w-12 h-12 border border-gray-200 flex items-center justify-center text-slate-900 bg-white group-hover/cell:border-indigo-200 group-hover/cell:text-indigo-600 transition-all duration-500">
                  {service.icon}
                </div>

                {/* Content */}
                <div className="space-y-4">
                  <h3 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tighter uppercase leading-[0.9]">
                    {service.title.split(' & ').join(' \n& ')}
                  </h3>
                  <p className="text-sm text-slate-500 font-medium leading-relaxed tracking-tight max-w-sm">
                    {service.description}
                  </p>
                </div>

                {/* Tags for specific modules */}
                {service.tags && (
                  <div className="flex flex-wrap gap-2 pt-2">
                    {service.tags.map(tag => (
                      <span key={tag} className="border border-gray-100 bg-white text-slate-400 px-2 py-1 text-[9px] font-bold uppercase tracking-widest font-mono">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Action Button */}
              <div className="pt-8 border-t border-gray-100 mt-auto">
                <button 
                  onClick={() => navigate(service.route)}
                  className="w-full md:w-auto px-8 py-5 bg-slate-900 text-white hover:bg-indigo-600 text-[10px] font-black uppercase tracking-[0.3em] transition-all duration-300 flex items-center justify-center gap-3 group/btn"
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