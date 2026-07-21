'use client';

import React from 'react';

const INSIGHT_MODULES = [
  {
    id: "01",
    label: "ANALYTICS REPORT",
    icon: "monitoring",
    accentKey: "blue",
    title: "AI-Synthesized Analytics",
    description: "Your bot's chat logs converted into a plain-English business report — top customer trends, knowledge gaps, actionable advice, and a 30-day activity heatmap. Refreshed every 24 hours automatically.",
    tags: ["TOP_TRENDS", "DAILY_HEATMAP", "AI_SYNTHESIS"],
  },
  {
    id: "02",
    label: "LEADS CRM",
    icon: "contacts",
    accentKey: "violet",
    title: "Leads Captured by Your Bot",
    description: "Every visitor who shared their name, email, or phone with the chatbot lands here automatically. View, filter, and export your pipeline of bot-qualified leads without lifting a finger.",
    tags: ["AUTO_CAPTURE", "EXPORT_CSV"],
  },
  {
    id: "03",
    label: "CONVERSATIONS",
    icon: "forum",
    accentKey: "cyan",
    title: "Full Conversation History",
    description: "Browse every chat session your bot has ever had — full transcript, timestamps, and answered vs. unanswered status. See exactly how visitors talk to your business in their own words.",
    tags: ["FULL_TRANSCRIPTS", "STATUS_FILTER"],
  },
  {
    id: "04",
    label: "ROI CALCULATOR",
    icon: "savings",
    accentKey: "emerald",
    title: "Your Return on Investment",
    description: "See exactly what your chatbot earns you this month — hours of support saved, cost avoided compared to a human agent, and revenue potential from captured leads. The average Sapybase bot saves businesses 40+ support hours a month.",
    tags: ["HOURS_SAVED", "COST_AVOIDED", "REVENUE_POTENTIAL"],
  }
];

const accentClasses: Record<string, { text: string; bg: string; border: string; iconBg: string; glow: string; hoverText: string }> = {
  blue: {
    text: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-50/50 dark:bg-blue-950/10",
    border: "border-blue-200/50 dark:border-blue-800/40",
    iconBg: "bg-blue-500/10 dark:bg-blue-500/20 text-blue-500 dark:text-blue-400",
    glow: "bg-blue-500/10 dark:bg-blue-500/15",
    hoverText: "group-hover:text-blue-600 dark:group-hover:text-blue-400"
  },
  violet: {
    text: "text-violet-600 dark:text-violet-400",
    bg: "bg-violet-50/50 dark:bg-violet-950/10",
    border: "border-violet-200/50 dark:border-violet-800/40",
    iconBg: "bg-violet-500/10 dark:bg-violet-500/20 text-violet-500 dark:text-violet-400",
    glow: "bg-violet-500/10 dark:bg-violet-500/15",
    hoverText: "group-hover:text-violet-600 dark:group-hover:text-violet-400"
  },
  cyan: {
    text: "text-cyan-600 dark:text-cyan-400",
    bg: "bg-cyan-50/50 dark:bg-cyan-950/10",
    border: "border-cyan-200/50 dark:border-cyan-800/40",
    iconBg: "bg-cyan-500/10 dark:bg-cyan-500/20 text-cyan-500 dark:text-cyan-400",
    glow: "bg-cyan-500/10 dark:bg-cyan-500/15",
    hoverText: "group-hover:text-cyan-600 dark:group-hover:text-cyan-400"
  },
  emerald: {
    text: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-50/50 dark:bg-emerald-950/10",
    border: "border-emerald-200/50 dark:border-emerald-800/40",
    iconBg: "bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-500 dark:text-emerald-400",
    glow: "bg-emerald-500/10 dark:bg-emerald-500/15",
    hoverText: "group-hover:text-emerald-600 dark:group-hover:text-emerald-400"
  }
};

const Services = () => {
  return (
    <section id="services" className="relative w-full bg-white dark:bg-slate-950 py-24 sm:py-32 overflow-x-clip transition-colors duration-500">
      {/* Ambient background glows */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-blue-500/5 dark:bg-blue-600/10 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-indigo-500/5 dark:bg-indigo-600/10 blur-[120px] rounded-full pointer-events-none" />

      <div className="max-w-8xl mx-auto px-6 sm:px-12 lg:px-20 relative z-10">
        
        {/* HEADER BLOCK */}
        <div className="flex flex-col lg:flex-row items-start lg:items-end justify-between gap-12 mb-16">
          <div className="max-w-2xl space-y-4">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-google font-semibold tracking-tight leading-tight text-slate-900 dark:text-slate-200">
              Your Bot's <br />
              <span className="text-transparent bg-clip-text bg-linear-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400">
                Business Intelligence.
              </span>
            </h2>
            
            <p className="text-base md:text-lg font-google text-slate-500 dark:text-slate-400 leading-relaxed">
              Every conversation your AI handles generates data. The Insights dashboard turns that data into decisions — who visited, what they asked, what was missed, and what it's worth to you.
            </p>
          </div>

          {/* Live Stats Legend Card */}
          <div className="w-full lg:max-w-md bg-slate-50/30 dark:bg-slate-900/20 border border-slate-200/40 dark:border-slate-800/40 rounded-3xl p-6 lg:p-8 flex flex-col justify-between shadow-[0_8px_30px_rgba(0,0,0,0.01)] shadow-[inset_0_1px_1px_rgba(255,255,255,0.45)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-xl transition-all duration-300 overflow-hidden relative">
            {/* Noise Background Overlay */}
            <div 
              className="absolute inset-0 opacity-[0.035] dark:opacity-[0.07] pointer-events-none mix-blend-overlay z-0"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`
              }}
            />
            {/* Soft Ambient Glow */}
            <div className="absolute -top-24 -left-24 w-64 h-64 rounded-full blur-3xl pointer-events-none z-0 bg-blue-500/5 dark:bg-blue-500/10" />
            <div className="space-y-3.5 relative z-10">
              <div className="flex justify-between items-center text-xs uppercase tracking-widest font-bold text-slate-400 dark:text-slate-500">
                <span>Report Refreshes</span>
                <span className="text-slate-950 dark:text-slate-100 font-google">Every 24 Hours</span>
              </div>
              <div className="h-px bg-slate-200/60 dark:bg-slate-800/40" />
              
              <div className="flex justify-between items-center text-xs uppercase tracking-widest font-bold text-slate-400 dark:text-slate-500">
                <span>Active Modules</span>
                <span className="text-blue-600 dark:text-blue-400 font-google">4 Channels Live</span>
              </div>
              <div className="pl-3 flex flex-col gap-2.5 pt-1">
                {[
                  "Analytics Report",
                  "Lead CRM System",
                  "Conversations Log",
                  "ROI Calculator Engine"
                ].map(item => (
                  <div key={item} className="flex justify-between items-center text-xs font-google font-medium text-slate-500 dark:text-slate-400">
                    <span>{item}</span>
                    <span className="text-emerald-500 font-bold">✓</span>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="flex items-center justify-between mt-6 pt-4 border-t border-slate-200/60 dark:border-slate-800/40 relative z-10">
              <span className="text-xs uppercase tracking-widest font-bold text-slate-400 dark:text-slate-500">Tier Access</span>
              <span className="text-[10px] font-google font-bold uppercase tracking-widest px-2 py-0.5 bg-emerald-500/10 dark:bg-emerald-500/20 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 rounded-full">PRO+ Optimal</span>
            </div>
          </div>
        </div>

        {/* CARDS GRID */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
          {INSIGHT_MODULES.map((mod) => {
            const accent = accentClasses[mod.accentKey] || accentClasses.blue;
            return (
              <div 
                key={mod.id} 
                className="bg-white/40 dark:bg-slate-900/30 border border-slate-200/40 dark:border-slate-800/40 rounded-3xl p-8 lg:p-10 shadow-[0_8px_30px_rgba(0,0,0,0.02)] dark:shadow-none shadow-[inset_0_1px_1px_rgba(255,255,255,0.45)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-xl hover:shadow-[0_20px_50px_rgba(0,0,0,0.08)] dark:hover:shadow-[0_20px_50px_rgba(0,0,0,0.3)] dark:hover:border-slate-700/60 hover:-translate-y-1.5 transition-all duration-500 flex flex-col justify-between group overflow-hidden relative"
              >
                {/* Noise Background Overlay */}
                <div 
                  className="absolute inset-0 opacity-[0.035] dark:opacity-[0.07] pointer-events-none mix-blend-overlay z-0"
                  style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`
                  }}
                />

                {/* Double Glow Hover Effects */}
                <div className={`absolute -top-24 -left-24 w-64 h-64 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none z-0 ${accent.glow}`} />
                <div className={`absolute -bottom-24 -right-24 w-64 h-64 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none z-0 ${accent.glow}`} />

                {/* Ghost watermark icon */}
                <span
                  className={`material-symbols-outlined absolute select-none pointer-events-none z-0 opacity-[0.03] dark:opacity-[0.06] group-hover:scale-105 group-hover:-translate-x-1 group-hover:-translate-y-1 transition-transform duration-500 ${accent.text}`}
                  style={{ fontSize: "160px", bottom: "-10px", right: "-10px", lineHeight: 1 }}
                >
                  {mod.icon}
                </span>

                <div className="space-y-6 relative z-10">
                  {/* Card Content */}
                  <div className="space-y-3">
                    <h3 className={`text-2xl font-google font-semibold text-slate-900 dark:text-slate-100 ${accent.hoverText} transition-colors duration-200`}>
                      {mod.title}
                    </h3>
                    
                    <span className={`text-xs font-google font-bold uppercase tracking-widest ${accent.text}`}>
                      // {mod.label}
                    </span>
                    
                    <p className="text-sm font-google text-slate-500 dark:text-slate-400 leading-relaxed pt-2">
                      {mod.description}
                    </p>
                  </div>
                </div>

                {/* Tags */}
                <div className="flex flex-wrap gap-2 mt-8 pt-6 border-t border-slate-100 dark:border-slate-900/60 relative z-10">
                  {mod.tags.map(tag => (
                    <span 
                      key={tag} 
                      className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[10px] font-google font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 px-3 py-1 rounded-full transition-all duration-200"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

      </div>
    </section>
  );
};

export default Services;
