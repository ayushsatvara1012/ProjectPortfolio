import { useNavigate } from 'react-router-dom';

const INSIGHT_MODULES = [
  {
    id: "01",
    label: "ANALYTICS REPORT",
    icon: "monitoring",
    accent: "text-blue-600 dark:text-blue-400",
    title: "AI-Synthesized Analytics",
    description: "Your bot's chat logs converted into a plain-English business report — top customer trends, knowledge gaps, actionable advice, and a 30-day activity heatmap. Refreshed every 24 hours automatically.",
    tags: ["TOP_TRENDS", "DAILY_HEATMAP", "AI_SYNTHESIS"],
    route: "/app/insights"
  },
  {
    id: "02",
    label: "LEADS CRM",
    icon: "contacts",
    accent: "text-violet-600 dark:text-violet-400",
    title: "Leads Captured by Your Bot",
    description: "Every visitor who shared their name, email, or phone with the chatbot lands here automatically. View, filter, and export your pipeline of bot-qualified leads without lifting a finger.",
    tags: ["AUTO_CAPTURE", "EXPORT_CSV"],
    route: "/app/insights"
  },
  {
    id: "03",
    label: "CONVERSATIONS",
    icon: "forum",
    accent: "text-cyan-600 dark:text-cyan-400",
    title: "Full Conversation History",
    description: "Browse every chat session your bot has ever had — full transcript, timestamps, and answered vs. unanswered status. See exactly how visitors talk to your business in their own words.",
    tags: ["FULL_TRANSCRIPTS", "STATUS_FILTER"],
    route: "/app/insights"
  },
  {
    id: "04",
    label: "ROI CALCULATOR",
    icon: "savings",
    accent: "text-emerald-600 dark:text-emerald-400",
    title: "Your Return on Investment",
    description: "See the real dollar value your chatbot delivers — support hours saved, cost avoided against human agent rates, and revenue potential from leads captured. Know exactly what the bot earns you.",
    tags: ["HOURS_SAVED", "COST_AVOIDED", "REVENUE_POTENTIAL"],
    route: "/app/insights"
  }
];

const Services = () => {
  const navigate = useNavigate();

  return (
    <section id="services" className="bg-white dark:bg-slate-950 py-12 overflow-hidden transition-colors duration-500">
      <div className="max-w-8xl mx-auto px-6 md:px-3">

        <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-gray-200 dark:bg-slate-800  overflow-hidden transition-colors duration-500">

          {/* HEADER CELL */}
          <div className="md:col-span-2 bg-white dark:bg-slate-950 md:p-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-12 group/header transition-colors duration-500">
            <div className="max-w-2xl space-y-8">
              <div className="flex items-center gap-3 text-md font-display uppercase tracking-widest font-bold text-slate-600 dark:text-slate-400 transition-colors">
                <span className="material-symbols-outlined text-[14px] text-slate-300 dark:text-slate-600 transition-colors">insights</span>
                <span>Insight_Module_Registry</span>
              </div>
              <h2 className="text-4xl md:text-5xl font-display font-bold tracking-tight text-slate-900 dark:text-slate-200 uppercase transition-colors">
                YOUR BOT'S <br />
                <span className="text-blue-600 dark:text-blue-400">Business Intelligence.</span>
              </h2>
              <p className="text-md font-display text-slate-500 dark:text-slate-400 leading-relaxed max-w-xl transition-colors">
                Every conversation your AI handles generates data. The Insights dashboard turns that data into decisions — who visited, what they asked, what was missed, and what it's worth to you.
              </p>
            </div>

            {/* Live Stats Legend */}
            <div className="py-2 space-y-4 w-full transition-colors duration-500 group-hover/header:border-blue-100 dark:group-hover/header:border-blue-900/40">
              <div className="flex justify-between items-center text-md uppercase tracking-widest font-bold text-slate-600 dark:text-slate-400 transition-colors">
                <span>Report Refreshes Every</span>
                <span className="text-slate-900 dark:text-slate-200 font-sans transition-colors">24h</span>
              </div>
              <div className="flex justify-between items-center text-md uppercase tracking-widest font-bold text-slate-600 dark:text-slate-400 mt-4 transition-colors">
                <span>Data Modules</span>
                <span className="text-blue-600 dark:text-blue-400 font-sans transition-colors">4</span>
              </div>
              <div className="pl-3 flex justify-between items-center text-md uppercase tracking-widest font-bold text-slate-600 dark:text-slate-400 mt-4 transition-colors">
                <span>Analytics Report</span>
                <span className="text-blue-600 dark:text-blue-400 font-sans transition-colors">✓</span>
              </div>
              <div className="pl-3 flex justify-between items-center text-md uppercase tracking-widest font-bold text-slate-600 dark:text-slate-400 mt-4 transition-colors">
                <span>Lead CRM</span>
                <span className="text-blue-600 dark:text-blue-400 font-sans transition-colors">✓</span>
              </div>
              <div className="pl-3 flex justify-between items-center text-md uppercase tracking-widest font-bold text-slate-600 dark:text-slate-400 mt-4 transition-colors">
                <span>Conversations History</span>
                <span className="text-blue-600 dark:text-blue-400 font-sans transition-colors">✓</span>
              </div>
              <div className="pl-3 flex justify-between items-center text-md uppercase tracking-widest font-bold text-slate-600 dark:text-slate-400 mt-4 transition-colors">
                <span>ROI Calculator</span>
                <span className="text-blue-600 dark:text-blue-400 font-sans transition-colors">✓</span>
              </div>
              <div className="flex justify-between items-center text-md uppercase tracking-widest font-bold text-slate-600 dark:text-slate-400 mt-4 transition-colors">
                <span>Access</span>
                <span className="text-emerald-600 dark:text-emerald-400 transition-colors">PRO+</span>
              </div>
              <div className="pt-4 pb-4 flex gap-1 transition-colors">
                {[1, 2, 3, 4, 5].map(i => (
                  <div key={i} className="h-1 w-full bg-slate-900 dark:bg-slate-200 opacity-10 dark:opacity-20 transition-all duration-500" />
                ))}
              </div>
            </div>
          </div>

          {/* MODULE CELLS */}
          {INSIGHT_MODULES.map((mod) => (
            <div key={mod.id} className="relative bg-white dark:bg-slate-950 py-8 md:p-10 flex flex-col justify-between gap-10 group/cell transition-colors duration-500 hover:bg-slate-50/50 dark:hover:bg-slate-900/50 border-t border-slate-200 dark:border-slate-800 overflow-hidden">

              {/* Ghost icon watermark */}
              <span
                className={`material-symbols-outlined absolute select-none pointer-events-none z-0 opacity-[0.1] md:opacity-[0.4] group-hover/cell:opacity-[0.7] transition-opacity duration-500 ${mod.accent}`}
                style={{ fontSize: "180px", bottom: "0px", right: "0px", lineHeight: 1 }}
              >
                {mod.icon}
              </span>

              <div className="space-y-8 relative z-10">

                {/* Eyebrow */}
                <div className="flex items-center gap-2 text-md font-display tracking-widest font-bold text-slate-600 dark:text-slate-400 transition-colors">
                  <span className={`text-blue-600 dark:text-blue-400`}>{`_${mod.id}`}</span>
                  <span className='border-l border-gray-400 pl-2'>{mod.label}</span>
                </div>

                {/* Content */}
                <div className="space-y-4">
                  <h3 className="text-xl md:text-3xl font-display font-bold text-slate-900 dark:text-slate-200 transition-colors">
                    {mod.title}
                  </h3>
                  <p className="text-md font-display text-slate-500 dark:text-slate-400 leading-relaxed max-w-sm transition-colors">
                    {mod.description}
                  </p>
                </div>

                {/* Tags */}
                <div className="flex flex-wrap gap-2 pt-2">
                  {mod.tags.map(tag => (
                    <span key={tag} className="border-l border-gray-300 dark:border-slate-700 bg-transparent px-2 py-1 text-md font-display uppercase tracking-widest font-bold text-slate-600 dark:text-slate-400 transition-colors">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              {/* CTA */}
              {/* <div className="pt-8 border-t border-gray-100 dark:border-slate-800 mt-auto transition-colors relative z-10">
                <button
                  onClick={() => navigate(mod.route)}
                  className="w-full md:w-auto px-8 py-5 bg-slate-900 dark:bg-blue-600 hover:bg-blue-600 dark:hover:bg-blue-500 text-md font-sans uppercase tracking-widest font-bold text-white transition-all duration-300 flex items-center justify-center gap-3 group/btn"
                >
                  VIEW {mod.label}
                  <span className="material-symbols-outlined text-[14px] opacity-40 group-hover/btn:translate-x-1 group-hover/btn:opacity-100 transition-all">chevron_right</span>
                </button>
              </div> */}
            </div>
          ))}

        </div>

      </div>
    </section>
  );
};

export default Services;