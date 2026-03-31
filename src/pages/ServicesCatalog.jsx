import React, { useEffect } from 'react';
import { ArrowLeft, ChevronRight, Phone, MessageCircle, Bot, Code2, Globe as GlobeIcon, Layout } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import SEO from '../components/Seo';
import seoConfig from '../seo/seoConfig';

const services = [
  {
    id: 'custom-software',
    name: 'Custom Software Development',
    description: 'Bespoke software solutions engineered for scalability and performance. We build robust systems tailored to your unique business logic.',
    price: 'Starting from $3,000',
    features: ['Microservices Architecture', 'Cloud Native', 'API Integration'],
    icon: <Bot size={20} />
  },
  {
    id: 'full-stack',
    name: 'Full Stack Development',
    description: 'End-to-end web applications built with modern stacks like React, Node.js, and Python. Seamless integration from frontend to database.',
    price: 'Starting from $2,500',
    features: ['Responsive UI/UX', 'Real-time Features', 'Secure Authentication'],
    icon: <Code2 size={20} />
  },
  {
    id: 'seo-optimization',
    name: 'SEO & Performance',
    description: 'Optimize your digital presence for search engines and lightning-fast load times. We ensure your brand is discovered and ranks high.',
    price: 'Starting from $300',
    features: ['Core Web Vitals', 'Technical SEO', 'Content Strategy'],
    icon: <GlobeIcon size={20} />
  },
  {
    id: 'static-dynamic',
    name: 'Static & Dynamic Websites',
    description: 'High-speed static landing pages or feature-rich dynamic websites. Perfect for portfolios, marketing sites, and CMS-driven platforms.',
    price: 'Starting from $400',
    features: ['Next.js / Vite', 'Headless CMS', 'Global Edge CDN'],
    icon: <Layout size={20} />
  }
];

const BrutalistCodeEditor = () => {
  return (
    <div className="hidden lg:flex w-full max-w-lg bg-slate-900 border border-slate-800 rounded-none flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-950">
        <div className="text-sm text-slate-500 font-mono tracking-widest uppercase">service_architect.ts</div>
        <div className="flex gap-2">
          <div className="w-2 h-2 bg-slate-700 rounded-none"></div>
          <div className="w-2 h-2 bg-slate-700 rounded-none"></div>
          <div className="w-2 h-2 bg-slate-700 rounded-none"></div>
        </div>
      </div>
      <div className="p-6 font-mono text-xs md:text-sm leading-relaxed overflow-hidden text-slate-300">
        <div className="flex gap-4">
          <span className="text-slate-600 select-none text-right w-4">1</span>
          <span className="text-indigo-400"><span className="text-purple-400">interface</span> <span className="text-blue-300">Project</span> &#123;</span>
        </div>
        <div className="flex gap-4">
          <span className="text-slate-600 select-none text-right w-4">2</span>
          <span className="text-slate-300 ml-4">id: <span className="text-amber-300">string</span>;</span>
        </div>
        <div className="flex gap-4">
          <span className="text-slate-600 select-none text-right w-4">3</span>
          <span className="text-slate-300 ml-4">scope: <span className="text-amber-300">'global'</span> | <span className="text-amber-300">'enterprise'</span>;</span>
        </div>
        <div className="flex gap-4">
          <span className="text-slate-600 select-none text-right w-4">4</span>
          <span className="text-indigo-400">&#125;</span>
        </div>
        <div className="flex gap-4">
          <span className="text-slate-600 select-none text-right w-4">5</span>
          <span>&nbsp;</span>
        </div>
        <div className="flex gap-4">
          <span className="text-slate-600 select-none text-right w-4">6</span>
          <span className="text-purple-400">async function</span> <span className="text-emerald-400">buildExcellence</span><span className="text-orange-300">(config)&#123;</span>
        </div>
        <div className="flex gap-4">
          <span className="text-slate-600 select-none text-right w-4">7</span>
          <span className="text-slate-300 ml-4">
            <span className="text-purple-400">return await</span> Architect.deploy(&#123;
          </span>
        </div>
        <div className="flex gap-4">
          <span className="text-slate-600 select-none text-right w-4">8</span>
          <span className="text-slate-300 ml-8">performance: <span className="text-amber-300">1.0</span>,</span>
        </div>
        <div className="flex gap-4">
          <span className="text-slate-600 select-none text-right w-4">9</span>
          <span className="text-slate-300 ml-8">ui: <span className="text-amber-300">'ultra-modern'</span></span>
        </div>
        <div className="flex gap-4">
          <span className="text-slate-600 select-none text-right w-4">10</span>
          <span className="text-slate-300 ml-4">&#125;);</span>
        </div>
        <div className="flex gap-4">
          <span className="text-slate-600 select-none text-right w-4">11</span>
          <span className="text-indigo-400">&#125;</span>
        </div>
      </div>
    </div>
  );
};

const ServicesCatalog = () => {
  const navigate = useNavigate();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <>
      <SEO {...seoConfig.services} />
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 pt-24 pb-20 transition-colors duration-500">
        
        {/* Header Section */}
        <header className="px-6 md:px-12 lg:px-0 max-w-7xl mx-auto mb-16 lg:mb-24 flex flex-col lg:flex-row items-start justify-between gap-12 pt-12">
          <div className="space-y-6 flex-1 max-w-2xl">
            <button
              onClick={() => navigate('/')}
              className="inline-flex items-center gap-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition-colors text-md font-display font-bold tracking-widest mb-4"
            >
              <ArrowLeft size={14} /> Back to Portfolio
            </button>
            <div className="text-sm font-display tracking-widest font-bold text-slate-400 dark:text-slate-500 mb-3 transition-colors">
              Registry_V4.2 // Service_Architect
            </div>
            <h1 className="text-5xl md:text-7xl font-display font-black tracking-tight leading-none text-slate-900 dark:text-slate-200 transition-colors">
              Tailored Digital <span className="text-blue-600 dark:text-blue-400">Service</span> Solutions
            </h1>
            <p className="text-3xl font-sans text-slate-500 dark:text-slate-400 leading-relaxed transition-colors">
              We combine architectural precision with creative engineering to deliver products that redefine industry standards.
            </p>
          </div>
          
          <BrutalistCodeEditor />
        </header>

        {/* Catalog Grid */}
        <section className="px-6 md:px-12 lg:px-0 max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-px bg-gray-200 dark:bg-slate-800 border border-gray-200 dark:border-slate-800 rounded-none transition-colors duration-500">
            {services.map((service) => (
              <div key={service.id} className="bg-white dark:bg-slate-950 rounded-none p-6 md:p-8 flex flex-col transition-colors duration-500">
                <div className="w-12 h-12 border border-gray-200 dark:border-slate-800 flex items-center justify-center text-slate-900 dark:text-slate-200 rounded-none mb-6 transition-colors">
                  {service.icon}
                </div>
                
                <div className="text-md font-display uppercase tracking-widest font-bold text-slate-400 dark:text-slate-500 mb-3 transition-colors">
                  {service.price} 
                </div>
                
                <h3 className="text-xl md:text-2xl font-display font-bold text-slate-900 dark:text-slate-200 mb-2 transition-colors">
                  {service.name}
                </h3>
                
                <p className="text-xl font-sans font-medium text-slate-500 dark:text-slate-400 leading-relaxed transition-colors">
                  {service.description}
                </p>
                
                <div className="flex flex-col gap-3 mt-6 pt-6 border-t border-gray-100 dark:border-slate-800 transition-colors">
                  {service.features.map((feature, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <ChevronRight className="w-3.5 h-3.5 text-slate-400 dark:text-slate-600 transition-colors" />
                      <span className="text-sm md:text-md font-display text-slate-600 dark:text-slate-400 transition-colors">{feature}</span>
                    </div>
                  ))}
                </div>
                
                <div className="mt-auto pt-8">
                  <button onClick={() => navigate('/services')} className="rounded-none bg-slate-900 dark:bg-indigo-600 text-md font-display uppercase tracking-widest font-bold text-white px-6 py-4 hover:bg-slate-800 dark:hover:bg-indigo-500 w-full text-center transition-colors">
                    Configure Project
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Bottom CTA */}
        <section className="px-6 md:px-12 lg:px-0 max-w-7xl mx-auto mt-16 md:mt-24">
          <div className="bg-white dark:bg-slate-950 border border-gray-200 dark:border-slate-800 rounded-none p-8 md:p-16 flex flex-col items-center text-center transition-colors duration-500">
            <div className="text-md font-display uppercase tracking-widest font-bold text-slate-400 dark:text-slate-500 mb-3 transition-colors">
              System_Protocol [001]
            </div>
            
            <h2 className="text-4xl md:text-5xl font-display font-bold tracking-tight text-slate-900 dark:text-slate-200 uppercase mb-4 transition-colors">
              Ready to Architect Your <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400">Digital Future?</span> 
            </h2>
            
            <p className="text-3xl font-sans text-slate-500 dark:text-slate-400 leading-relaxed max-w-2xl mb-8 transition-colors">
              Schedule a strategy call to discuss your project requirements and get a detailed architectural breakdown.
            </p>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-gray-200 dark:bg-slate-800 border border-gray-200 dark:border-slate-800 w-full max-w-lg transition-colors duration-500">
              <a href="tel:+15626681855" className="bg-white dark:bg-slate-950 flex items-center justify-center gap-3 p-5 text-md font-display uppercase tracking-widest font-bold text-slate-900 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors">
                <Phone size={14} /> Book a Call
              </a>
              <button onClick={() => window.open('https://wa.me/15626681855', '_blank')} className="bg-white dark:bg-slate-950 flex items-center justify-center gap-3 p-5 text-md font-display uppercase tracking-widest font-bold text-slate-900 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors">
                <MessageCircle size={14} /> Message System
              </button>
            </div>
          </div>
        </section>

      </div>
    </>
  );
};

export default ServicesCatalog;
