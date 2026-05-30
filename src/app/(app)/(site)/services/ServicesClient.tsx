'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import HowItWorks from '@/src/components/marketing/HowItWorks';
import Metrics from '@/src/components/marketing/Metrics';
import MarketingServices from '@/src/components/marketing/Services';
import ScrollReveal from '@/src/components/marketing/ScrollReveal';

const services = [
  {
    id: 'custom-software',
    name: 'Custom Software Development',
    price: 'Starting from $3,000',
    icon: 'smart_toy',
    whatItDoes: 'We design and build bespoke software systems, high-performance backends, custom REST/GraphQL APIs, and scalable microservices engineered to fit your specific business processes.',
    whyChooseSapybase: 'Our backends are architected for sub-100ms latency and high concurrency using async engines, ensuring your database and infrastructure scale automatically without bottlenecks.'
  },
  {
    id: 'full-stack',
    name: 'Full Stack Development',
    price: 'Starting from $2,500',
    icon: 'code',
    whatItDoes: 'We engineer end-to-end web applications, combining robust server architectures with responsive client interfaces using modern frontend and backend frameworks.',
    whyChooseSapybase: 'We build with React 19, Next.js, FastAPI, and PostgreSQL, utilizing Tailwind v4 for zero-lag mobile responsiveness and secure session handling.'
  },
  {
    id: 'seo-optimization',
    name: 'SEO & Performance',
    price: 'Starting from $300',
    icon: 'speed',
    whatItDoes: 'We audit, refactor, and optimize your website for search engines and instant load speeds, implementing structural HTML practices and fine-tuning core web vitals.',
    whyChooseSapybase: 'We guarantee a perfect 100/100 Lighthouse performance score on all marketing static sites, optimizing images, CSS, and script fetch priorities.'
  },
  {
    id: 'static-dynamic',
    name: 'Static & Dynamic Websites',
    price: 'Starting from $400',
    icon: 'devices',
    whatItDoes: 'We develop high-performance static landing pages, corporate websites, portfolios, or content-managed dynamic platforms to convert visitors into leads.',
    whyChooseSapybase: 'Every site features smooth scroll reveals, custom micro-animations, light/dark mode compatibility, and zero-configuration global edge distribution.'
  }
];

const BrutalistCodeEditor = () => {
  return (
    <div className="hidden lg:flex w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl flex-col overflow-hidden shadow-xl">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-950">
        <div className="text-xs text-slate-500 font-mono tracking-widest uppercase">service_architect.ts</div>
        <div className="flex gap-1.5">
          <div className="w-2.5 h-2.5 bg-rose-500/85 rounded-full"></div>
          <div className="w-2.5 h-2.5 bg-amber-500/85 rounded-full"></div>
          <div className="w-2.5 h-2.5 bg-emerald-500/85 rounded-full"></div>
        </div>
      </div>
      
      <div className="p-6 font-mono text-xs md:text-sm leading-relaxed overflow-hidden text-slate-300 bg-slate-950/40">
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

export default function ServicesClient() {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 transition-colors duration-500 overflow-x-hidden">
      
      {/* Header Section */}
      <header className="relative w-full max-w-8xl mx-auto px-6 sm:px-12 lg:px-20 pt-28 pb-16">
        {/* Ambient glows */}
        <div className="absolute top-0 left-0 w-96 h-96 bg-blue-500/5 dark:bg-blue-600/10 blur-[120px] rounded-full pointer-events-none" />
        
        <div className="flex flex-col lg:flex-row items-start justify-between gap-12 relative z-10">
          <div className="space-y-6 flex-1 max-w-2xl">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition-colors text-sm font-google font-medium tracking-wider mb-4"
            >
              <span className="material-symbols-outlined text-[16px]">arrow_back</span>
              Back to Portfolio
            </Link>
            
            <h1 className="text-5xl sm:text-6xl md:text-7xl font-google font-medium tracking-tight leading-none text-slate-900 dark:text-slate-200">
              Tailored Digital <br />
              <span className="text-transparent bg-clip-text bg-linear-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400">
                Service Solutions.
              </span>
            </h1>
            
            <p className="text-lg font-google text-slate-500 dark:text-slate-400 leading-relaxed">
              We combine architectural precision with creative engineering to deliver high-performance digital products that convert.
            </p>
          </div>
          
          <BrutalistCodeEditor />
        </div>
      </header>

      {/* Catalog Grid */}
      <ScrollReveal className="max-w-8xl mx-auto px-6 sm:px-12 lg:px-20 mb-24">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
          {services.map((service) => (
            <div 
              key={service.id} 
              className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800/60 rounded-3xl p-8 lg:p-10 shadow-[0_8px_30px_rgba(0,0,0,0.02)] dark:shadow-none hover:shadow-[0_12px_40px_rgba(0,0,0,0.05)] dark:hover:border-slate-700/80 hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between group"
            >
              <div className="space-y-6">
                {/* Header: Icon and Price */}
                <div className="flex items-center justify-between">
                  <div className="w-12 h-12 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex items-center justify-center text-blue-600 dark:text-blue-400 group-hover:bg-blue-500 group-hover:text-white group-hover:border-blue-500 transition-all duration-300">
                    <span className="material-symbols-outlined text-[24px]">{service.icon}</span>
                  </div>
                  
                  <div className="text-sm font-google font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                    {service.price}
                  </div>
                </div>

                {/* Title */}
                <h3 className="text-2xl font-google font-semibold text-slate-900 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors duration-200">
                  {service.name}
                </h3>

                {/* Info blocks: what it does & why choose sapybase */}
                <div className="space-y-4 pt-2 border-t border-slate-100 dark:border-slate-900/60">
                  <div className="space-y-1">
                    <span className="text-xs font-google font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                      What we do
                    </span>
                    <p className="text-sm font-google text-slate-600 dark:text-slate-400 leading-relaxed">
                      {service.whatItDoes}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <span className="text-xs font-google font-bold uppercase tracking-widest text-blue-500">
                      Why choose Sapybase
                    </span>
                    <p className="text-sm font-google text-slate-600 dark:text-slate-400 leading-relaxed">
                      {service.whyChooseSapybase}
                    </p>
                  </div>
                </div>
              </div>

              {/* Action */}
              <div className="pt-8">
                <Link 
                  href="/contact" 
                  className="w-full bg-slate-900 dark:bg-slate-900 text-base font-google text-white font-medium cursor-pointer flex items-center justify-center px-8 py-4 rounded-xl border border-slate-200/50 dark:border-slate-800 hover:bg-blue-600 dark:hover:bg-blue-600 transition-colors gap-2"
                >
                  Configure Project
                  <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                </Link>
              </div>
            </div>
          ))}
        </div>
      </ScrollReveal>
      
      <ScrollReveal delay={0.05}>
        <Metrics />
      </ScrollReveal>
      
      <ScrollReveal delay={0.05}>
        <MarketingServices />
      </ScrollReveal>

      {/* Bottom CTA */}
      <ScrollReveal className="max-w-8xl mx-auto px-6 sm:px-12 lg:px-20 mt-16 md:mt-24 mb-16">
        <div className="relative overflow-hidden bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800/60 rounded-3xl p-8 md:p-16 flex flex-col items-center text-center transition-all duration-300">
          {/* Ambient glow inside CTA */}
          <div className="absolute -bottom-10 -right-10 w-64 h-64 bg-indigo-500/5 dark:bg-indigo-600/10 blur-[100px] rounded-full pointer-events-none" />
          
          <div className="relative z-10 max-w-2xl flex flex-col items-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-full mb-6">
              <span className="material-symbols-outlined text-[14px] text-blue-600">rocket_launch</span>
              <span className="text-xs font-google uppercase tracking-widest font-bold text-slate-400 dark:text-slate-500">System_Protocol_001</span>
            </div>
            
            <h2 className="text-3xl md:text-5xl font-google font-semibold tracking-tight text-slate-900 dark:text-slate-100 mb-4 leading-tight">
              Ready to Architect Your <br />
              <span className="text-transparent bg-clip-text bg-linear-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400">
                Digital Future?
              </span>
            </h2>
            
            <p className="text-base font-google text-slate-500 dark:text-slate-400 leading-relaxed mb-8">
              Schedule a strategy call or send a brief to discuss your project requirements and receive a detailed architectural breakdown.
            </p>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-md">
              <a 
                href="tel:+15626681855" 
                className="bg-slate-900 dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800 px-6 py-4 text-base font-google font-medium text-white hover:bg-blue-600 dark:hover:bg-blue-600 transition-colors rounded-xl flex items-center justify-center gap-2 shadow-md"
              >
                <span className="material-symbols-outlined text-[18px]">call</span>
                Book a Call
              </a>
              <button 
                onClick={() => window.open('https://wa.me/15626681855', '_blank')} 
                className="bg-transparent border border-slate-200 dark:border-slate-700 px-6 py-4 text-base font-google font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors rounded-xl flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-[18px]">chat</span>
                Message System
              </button>
            </div>
          </div>
        </div>
      </ScrollReveal>

    </div>
  );
}
