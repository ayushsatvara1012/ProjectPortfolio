const PerformanceMetrics = () => {
  const metrics = [
    {
      title: "Lighthouse Score",
      value: "100",
      description: "Achieved a perfect performance score by optimizing the critical rendering path and asset minification.",
      // Replaced animate-pulse with a static indicator for zero CPU overhead during paint
      pulse: <div className="h-2 w-2 rounded-full bg-emerald-500" />,
      // Replaced Lucide with Inline SVGs to reduce JS bundle size
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6 text-emerald-500">
          <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
        </svg>
      ),
      borderClass: "hover:border-emerald-500/30 hover:shadow-emerald-500/10"
    },
    {
      title: "CLS Reduction",
      value: "40%",
      description: "Minimized Cumulative Layout Shift through strict aspect-ratio styling and slot reservation logic.",
      pulse: <div className="h-2 w-2 rounded-full bg-indigo-600" />,
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6 text-indigo-600">
          <path d="M12 20V10M18 20V4M6 20v-4" />
        </svg>
      ),
      borderClass: "hover:border-indigo-500/30 hover:shadow-indigo-500/10"
    },
    {
      title: "Rendering Speed",
      value: "60 FPS",
      description: "Enhanced user engagement by maintaining silky-smooth rendering via hardware-accelerated transitions.",
      pulse: <div className="h-2 w-2 rounded-full bg-amber-500" />,
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6 text-amber-500">
          <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
        </svg>
      ),
      borderClass: "hover:border-amber-500/30 hover:shadow-amber-500/10"
    }
  ];

  return (
    <section id="process" className="p-6 rounded-3xl w-full bg-white dark:bg-slate-950">
      <div className="max-w-7xl mx-auto">
        <h2 className="sr-only">Performance Process</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {metrics.map((metric, index) => (
            <div
              key={index}
              /* Optimized transitions using will-change to hint browser for GPU acceleration */
              className={`group relative p-8 rounded-3xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 hover:bg-white dark:hover:bg-slate-900 hover:shadow-2xl ${metric.borderClass} transition-all duration-300 will-change-transform`}
            >
              <div className="flex flex-row-reverse items-center justify-between md:flex-col md:items-start lg:flex-row-reverse lg:items-center lg:justify-between">
                {/* Icon Container - Simplified transform for performance */}
                <div className="mb-8 p-4 w-fit rounded-2xl bg-white dark:bg-slate-800 shadow-sm group-hover:scale-105 transition-transform duration-300">
                  {metric.icon}
                </div>

                {/* Metric Value */}
                <div className="flex items-baseline gap-2 mb-3">
                  <span className="text-5xl md:text-4xl font-black text-slate-900 dark:text-white tracking-tighter">
                    {metric.value}
                  </span>

                  {metric.pulse}
                </div>
              </div>

              {/* Content */}
              <h3 className="text-xl md:text-lg font-bold text-slate-900 dark:text-white mb-4">
                {metric.title}
              </h3>

              <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
                {metric.description}
              </p>

              {/* Technical System ID - Removed opacity transition for zero-lag interaction */}
              <div className="absolute top-4 left-8 text-[10px] font-mono text-slate-300 dark:text-slate-700 opacity-0 group-hover:opacity-100">
                SPY_BSE_0{index + 1}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default PerformanceMetrics;