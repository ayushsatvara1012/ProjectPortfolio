'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';

const services = [
  {
    id: 'custom-software',
    type: 'service',
    category: 'Development',
    name: 'Custom Software Development',
    icon: 'developer_board',
    whatItDoes: 'We design and build bespoke software applications, robust backend databases, and custom automation systems engineered specifically to fit your unique business operations.',
    whyChooseSapybase: 'We build systems that adapt to your exact business workflows, rather than forcing you to change your operations to fit restrictive off-the-shelf software.',
    benefits: [
      'Tailored portals, databases, and internal tools',
      'High-performance backend API design',
      'Scales automatically with your business growth',
      'Eliminates bottlenecks from manual workarounds'
    ],
    link: '/contact',
    linkText: 'Discuss Custom Software'
  },
  {
    id: 'website-development',
    type: 'service',
    category: 'Development',
    name: 'Website & Web App Development',
    icon: 'devices',
    whatItDoes: 'Stunning, high-performance websites and web portals optimized for maximum speed, styled to reflect your brand identity, and built to convert casual traffic into active leads.',
    whyChooseSapybase: 'Every page features clean, responsive layouts that load instantly on mobile, tablet, and desktop, ensuring you never lose a customer due to a slow website.',
    benefits: [
      'Sub-100ms loading speeds for optimal user experience',
      'Modern layouts styled with clean responsive CSS',
      'Built-in search engine optimization and analytics',
      'Seamless content management integration'
    ],
    link: '/contact',
    linkText: 'Discuss Web Development'
  },
  {
    id: 'rag-pipelines',
    type: 'service',
    category: 'AI & Data',
    name: 'RAG (Knowledge Retrieval) Pipelines',
    icon: 'database',
    whatItDoes: 'Secure AI systems that search and retrieve exact answers from your private company files, documentation, and databases without leaking sensitive information.',
    whyChooseSapybase: 'Your team can query thousands of pages of text using natural questions and get accurate, verifiable answers instantly without the risk of AI making up facts.',
    benefits: [
      'Connects securely to PDFs, manuals, and databases',
      'Answers are grounded directly in your source documents',
      'Keeps proprietary company data secure and private',
      'Reduces information lookup times for employees'
    ],
    link: '/contact',
    linkText: 'Discuss AI Search'
  },
  {
    id: 'ai-agents',
    type: 'service',
    category: 'AI & Data',
    name: 'AI Agents & Custom Automation',
    icon: 'support_agent',
    whatItDoes: 'Autonomous digital workers programmed to handle repetitive tasks, schedule meetings, retrieve order statuses, or guide customers through complex workflows.',
    whyChooseSapybase: 'We program task-oriented agents that integrate with your internal databases, running in the background 24/7 to reduce your team’s manual workload.',
    benefits: [
      'Automates repetitive support and sales tasks',
      'Integrates with your CRMs and database systems',
      'Operates continuously without human intervention',
      'Customized tone and logic matching your brand'
    ],
    link: '/contact',
    linkText: 'Discuss AI Agents'
  },
  {
    id: 'bi-dashboards',
    type: 'service',
    category: 'AI & Data',
    name: 'Business Intelligence Dashboards',
    icon: 'analytics',
    whatItDoes: 'Interactive dashboards that aggregate data from your websites, software systems, and spreadsheets into clear, visual charts and automated reports.',
    whyChooseSapybase: 'Instead of manually compiling complex reports or digging through spreadsheets, you get a single clear portal showing your key performance metrics at a glance.',
    benefits: [
      'Consolidates data from multiple separate platforms',
      'Clear, interactive graphs updated automatically',
      'Uncovers trends to make data-driven decisions',
      'Automated weekly email summaries of business performance'
    ],
    link: '/contact',
    linkText: 'Discuss BI Dashboards'
  },
  {
    id: 'seo-performance',
    type: 'service',
    category: 'Marketing',
    name: 'SEO, GEO, & AEO Performance',
    icon: 'query_stats',
    whatItDoes: 'Technical optimization to guarantee high visibility across traditional search engines (Google), generative AI search (Perplexity, ChatGPT, Gemini), and voice assistants.',
    whyChooseSapybase: 'As customers transition from standard keywords to asking conversational questions to AI, we optimize your site structure so your business is recommended first.',
    benefits: [
      'Traditional Google Search Engine Optimization (SEO)',
      'Generative Engine Optimization (GEO) for AI search',
      'Answer Engine Optimization (AEO) for voice assistants',
      'Perfect 100/100 Lighthouse performance optimization'
    ],
    link: '/contact',
    linkText: 'Discuss Search Visibility'
  },
  {
    id: 'cloud-infrastructure',
    type: 'service',
    category: 'Development',
    name: 'Cloud Infrastructure & Integrations',
    icon: 'cloud_sync',
    whatItDoes: 'Secure cloud hosting configuration and custom connection setups that sync your separate software tools (CRMs, email, payment processors) with one another.',
    whyChooseSapybase: 'We link your systems together to eliminate manual data entry, reduce human error, and keep your business database securely backed up in real-time.',
    benefits: [
      'Secure hosting on AWS, Vercel, or GCP',
      'Syncs CRMs, payment gates, and marketing tools',
      'Real-time automated database backups',
      'High-uptime architectures that scale with traffic spikes'
    ],
    link: '/contact',
    linkText: 'Discuss Cloud & Sync'
  }
];

const vaayuProduct = {
  id: 'vaayu-platform',
  type: 'product',
  category: 'Product Platform',
  name: 'Vaayu Intelligence Platform',
  icon: 'chat_bubble',
  whatItDoes: 'Our flagship conversational business intelligence platform. It resides on your website, resolves visitor inquiries automatically 24/7, captures high-intent leads, and generates visual analytics detailing support hours and revenue saved.',
  whyChooseSapybase: 'Trained on your PDFs, website links, or text in under 10 minutes. Zero coding required — just copy and paste a single script tag into Webflow, Shopify, WordPress, or Next.js.',
  benefits: [
    'Instant answers for your customers 24/7 based on your files',
    'Automatic lead capture, scoring, and CRM integration',
    'Direct measurement of support hours saved and ROI',
    'Strict guardrails — only answers using your training data'
  ],
  link: '/vaayu',
  linkText: 'Explore Vaayu Platform',
  featured: true
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
        
        <div className="flex flex-col items-start gap-6 relative z-10 max-w-3xl">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition-colors text-sm font-google font-medium tracking-wider mb-4"
          >
            <span className="material-symbols-outlined text-[16px]">arrow_back</span>
            Back to Portfolio
          </Link>
          
          <h1 className="text-5xl sm:text-6xl md:text-7xl font-google font-medium tracking-tight leading-none text-slate-900 dark:text-slate-200">
            Engineered to Scale. <br />
            <span className="text-transparent bg-clip-text bg-linear-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400">
              Built to Think.
            </span>
          </h1>
          
          <p className="text-lg font-google text-slate-500 dark:text-slate-400 leading-relaxed">
            From custom backend architectures and high-performance websites to advanced RAG pipelines and autonomous AI agents, we build the technology that powers your growth.
          </p>
        </div>
      </header>

      {/* Catalog Services Grid */}
      <div className="max-w-8xl mx-auto px-6 sm:px-12 lg:px-20 mb-16">
        <h2 className="text-[10px] font-google font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-8 block">
          // Our Services
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
          {services.map((service) => (
            <div 
              key={service.id} 
              className="border rounded-3xl p-8 lg:p-10 flex flex-col justify-between transition-all duration-300 group shadow-none bg-linear-to-br from-slate-50/70 to-slate-100/30 dark:from-slate-900/30 dark:to-slate-950/20 border-slate-200/60 dark:border-slate-800/60 hover:border-slate-300 dark:hover:border-slate-700 hover:from-slate-50 hover:to-slate-100/40 dark:hover:from-slate-900/40 dark:hover:to-slate-950/30"
            >
              <div className="space-y-6">
                {/* Header: Icon and Category */}
                <div className="flex items-center justify-between">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-300 bg-slate-100/80 text-slate-700 dark:bg-slate-800/60 dark:text-slate-300 border border-slate-200/40 dark:border-slate-700/40">
                    <span className="material-symbols-outlined text-[24px]">{service.icon}</span>
                  </div>
                  
                  <span className="px-2.5 py-0.5 text-[10px] font-google font-bold uppercase tracking-wider rounded-full border bg-slate-100/60 text-slate-600 dark:bg-slate-800/40 dark:text-slate-400 border-slate-200/50 dark:border-slate-800">
                    {service.category}
                  </span>
                </div>

                {/* Title */}
                <h3 className="text-2xl font-google font-semibold text-slate-900 dark:text-slate-100 transition-colors duration-200 group-hover:text-slate-900 dark:group-hover:text-white">
                  {service.name}
                </h3>

                {/* Info block: what it does */}
                <p className="text-sm font-google text-slate-600 dark:text-slate-400 leading-relaxed">
                  {service.whatItDoes}
                </p>

                {/* Bulleted Benefits list */}
                <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-900/60">
                  <span className="text-[10px] font-google font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 block mb-4">
                    How it helps your business:
                  </span>
                  <ul className="space-y-2.5">
                    {service.benefits.map((benefit, idx) => (
                      <li key={idx} className="flex items-center gap-2 text-xs font-google text-slate-600 dark:text-slate-400">
                        <span className="material-symbols-outlined text-[16px] text-emerald-500 shrink-0">check_circle</span>
                        <span>{benefit}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Action Link */}
              <div className="pt-8">
                <Link 
                  href={service.link} 
                  className="w-full text-sm font-google font-medium cursor-pointer flex items-center justify-center px-6 py-3.5 rounded-full transition-all duration-200 gap-2 border bg-slate-900 text-white dark:bg-slate-900 border-slate-900 dark:border-slate-800 hover:bg-slate-800 dark:hover:bg-slate-800"
                >
                  {service.linkText}
                  <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Flagship Product Section */}
      <div className="max-w-8xl mx-auto px-6 sm:px-12 lg:px-20 mb-24">
        <h2 className="text-[10px] font-google font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-8 block">
          // Our Product
        </h2>
        <div 
          className="border rounded-3xl p-8 lg:p-10 flex flex-col justify-between transition-all duration-300 group shadow-none relative overflow-hidden bg-linear-to-br from-blue-50/40 via-white to-white dark:from-blue-950/10 dark:via-slate-950 dark:to-slate-950 border-blue-200/50 dark:border-blue-800/40 hover:border-blue-500/50 dark:hover:border-blue-400/50"
        >
          {/* Large Ghost Vaayu Logo */}
          <img 
            src="/vaayu_logo.svg" 
            alt="Vaayu Ghost Logo" 
            className="absolute bottom-0 right-0 w-72 h-auto opacity-50 pointer-events-none z-0 translate-y-6 translate-x-6 select-none"
          />

          <div className="space-y-6 relative z-10 max-w-4xl">
            {/* Header: Icon and Category */}
            <div className="flex items-center justify-between">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-300 bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400 border border-blue-500/20">
                <span className="material-symbols-outlined text-[24px]">{vaayuProduct.icon}</span>
              </div>
              
              <span className="px-2.5 py-0.5 text-[10px] font-google font-bold uppercase tracking-wider rounded-full border bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400 border-blue-500/20">
                {vaayuProduct.category}
              </span>
            </div>

            {/* Title */}
            <h3 className="text-3xl font-google font-semibold text-slate-900 dark:text-slate-100 transition-colors duration-200 group-hover:text-blue-600 dark:group-hover:text-blue-400">
              {vaayuProduct.name}
            </h3>

            {/* Info block: what it does */}
            <p className="text-base font-google text-slate-600 dark:text-slate-400 leading-relaxed">
              {vaayuProduct.whatItDoes}
            </p>

            <p className="text-sm font-google text-slate-500 dark:text-slate-400 leading-relaxed">
              {vaayuProduct.whyChooseSapybase}
            </p>

            {/* Bulleted Benefits list */}
            <div className="space-y-3 pt-6 border-t border-slate-100 dark:border-slate-900/60">
              <span className="text-[10px] font-google font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 block mb-2">
                How it helps your business:
              </span>
              <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3">
                {vaayuProduct.benefits.map((benefit, idx) => (
                  <li key={idx} className="flex items-center gap-2 text-xs font-google text-slate-600 dark:text-slate-400">
                    <span className="material-symbols-outlined text-[16px] text-emerald-500 shrink-0">check_circle</span>
                    <span>{benefit}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Action Link (capped width, not full width on desktop) */}
          <div className="pt-8 relative z-10">
            <Link 
              href={vaayuProduct.link} 
              className="w-full md:max-w-xs text-sm font-google font-medium cursor-pointer flex items-center justify-center px-6 py-3.5 rounded-full transition-all duration-200 gap-2 border bg-blue-600 text-white border-blue-600 hover:bg-blue-700 hover:border-blue-700"
            >
              {vaayuProduct.linkText}
              <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Bottom CTA */}
      <div className="max-w-8xl mx-auto px-6 sm:px-12 lg:px-20 mt-16 md:mt-24 mb-16">
        <div className="relative overflow-hidden bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800/60 rounded-3xl p-8 md:p-16 flex flex-col items-center text-center transition-all duration-300 shadow-none">
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
                className="bg-slate-900 dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800 px-6 py-4 text-base font-google font-medium text-white hover:bg-blue-600 dark:hover:bg-blue-600 transition-colors rounded-full flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-[18px]">call</span>
                Book a Call
              </a>
              <button 
                onClick={() => window.open('https://wa.me/15626681855', '_blank')} 
                className="bg-transparent border border-slate-200 dark:border-slate-700 px-6 py-4 text-base font-google font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors rounded-full flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-[18px]">chat</span>
                Message System
              </button>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
