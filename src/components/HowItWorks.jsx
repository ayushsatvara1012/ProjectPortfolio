import { useState } from "react";

const PIPELINE_STEPS = [
  {
    id: 1,
    step: "01",
    label: "INGEST",
    title: "Connect Your Data",
    subtitle: "Zero manual entry. Pure extraction.",
    value: {
      heading: "Your knowledge, on autopilot.",
      body: "SaPyBase securely crawls your website or accepts PDF uploads and extracts every meaningful sentence — product descriptions, FAQs, pricing tables, policy pages — without you copying a single line. The moment you hit connect, your content becomes the brain of your chatbot.",
      bullets: ["PDF · URL · Raw Text supported", "Auto-sync on content change", "No manual data entry"],
    },
    tech: {
      type: "terminal",
      label: "INGESTION LOG",
      lines: [
        { key: "source",  value: '"pricing.html"',    color: "text-emerald-400" },
        { key: "status",  value: '"extracted"',        color: "text-blue-400"   },
        { key: "tokens",  value: "1405",               color: "text-amber-400"  },
        { key: "chunks",  value: "18",                 color: "text-violet-400" },
        { key: "elapsed", value: '"0.84s"',            color: "text-slate-400"  },
      ],
    },
    icon: "upload_file",
    detail: "PDF · URL · Raw Text",
  },
  {
    id: 2,
    step: "02",
    label: "VECTORIZE",
    title: "AI Reads Intent, Not Keywords",
    subtitle: "Why your bot gives smart answers.",
    value: {
      heading: "Beyond keyword search.",
      body: "Traditional search breaks when a customer types \"what does it cost?\" instead of \"pricing\". SaPyBase converts every sentence into a mathematical vector — a fingerprint of its meaning. When a user asks a question, we find the closest meaning, not the closest word.",
      bullets: ["pgvector semantic search", "Prevents keyword-mismatch failures", "Context-aware retrieval"],
    },
    tech: {
      type: "vector",
      label: "EMBEDDING SAMPLE",
      word: "Pricing",
      vector: [0.421, -0.892, 0.115, 0.673, -0.234, 0.889, -0.451, 0.102],
    },
    icon: "psychology",
    detail: "pgvector · Semantic Search",
  },
  {
    id: 3,
    step: "03",
    label: "DEPLOY",
    title: "Live in 60 Seconds",
    subtitle: "One script tag. Every platform.",
    value: {
      heading: "Ship to production instantly.",
      body: "No backend to configure. No server to maintain. Paste one script tag into any HTML page — React, Next.js, Webflow, Shopify, plain HTML — and your AI agent starts streaming answers to real customers immediately. Customize the widget color, name, and persona from your dashboard.",
      bullets: ["React · Next.js · Webflow · HTML", "Widget customizable from dashboard", "Streaming answers via WebSocket"],
    },
    tech: {
      type: "script",
      label: "EMBED SNIPPET",
      snippet: `<script
  src="https://cdn.sapybase.com/widget.js"
  data-bot-id="sb_prod_x7k9m"
  data-theme="blue"
  defer
></script>`,
    },
    icon: "rocket_launch",
    detail: "React · Next.js · HTML · Webflow",
  },
];

/* ── Terminal mock ─────────────────────────────────────────────────────── */
const TerminalPanel = ({ data }) => (
  <div className="flex flex-col h-full">
    <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
      <div className="flex gap-1.5">
        <div className="w-2.5 h-2.5 rounded-full bg-rose-400" />
        <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
        <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
      </div>
      <span className="text-[9px] font-mono uppercase tracking-widest text-slate-400 dark:text-slate-500 ml-1">{data.label}</span>
    </div>
    <div className="flex-1 p-5 font-mono text-sm bg-slate-950 dark:bg-slate-950 overflow-hidden">
      <span className="text-slate-600 text-xs">// extraction output</span>
      <div className="mt-3 space-y-1.5">
        <span className="text-slate-500">{"{"}</span>
        {data.lines.map((l) => (
          <div key={l.key} className="pl-4">
            <span className="text-slate-400">&quot;{l.key}&quot;</span>
            <span className="text-slate-600">: </span>
            <span className={l.color}>{l.value}</span>
            <span className="text-slate-600">,</span>
          </div>
        ))}
        <span className="text-slate-500">{"}"}</span>
      </div>
      <div className="mt-4 flex items-center gap-2">
        <span className="text-emerald-500 text-xs">✓</span>
        <span className="text-emerald-400 text-xs font-mono">Knowledge base updated</span>
      </div>
    </div>
  </div>
);

/* ── Vector mock ───────────────────────────────────────────────────────── */
const VectorPanel = ({ data }) => (
  <div className="flex flex-col h-full">
    <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
      <span className="material-symbols-outlined text-[12px] text-blue-500">schema</span>
      <span className="text-[9px] font-mono uppercase tracking-widest text-slate-400 dark:text-slate-500">{data.label}</span>
    </div>
    <div className="flex-1 p-5 bg-slate-950 dark:bg-slate-950 flex flex-col justify-center gap-5">
      <div className="flex items-center gap-3">
        <div className="px-3 py-1.5 border border-blue-500/40 bg-blue-500/10 font-mono text-sm text-blue-400 tracking-widest">
          &quot;{data.word}&quot;
        </div>
        <span className="material-symbols-outlined text-[16px] text-slate-600">arrow_forward</span>
        <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">1536-dim vector</span>
      </div>
      <div className="space-y-1">
        <span className="text-[9px] font-mono text-slate-600 uppercase tracking-widest">embedding[0..7]</span>
        <div className="flex flex-wrap gap-1.5 mt-1.5">
          {data.vector.map((v, i) => (
            <div key={i} className="px-2 py-1 border border-slate-700 bg-slate-900 font-mono text-xs text-slate-400">
              {v > 0 ? (
                <span className="text-emerald-400">{v.toFixed(3)}</span>
              ) : (
                <span className="text-rose-400">{v.toFixed(3)}</span>
              )}
            </div>
          ))}
          <div className="px-2 py-1 border border-slate-800 font-mono text-xs text-slate-600">...</div>
        </div>
      </div>
      <div className="pt-3 border-t border-slate-800">
        <p className="text-[10px] font-mono text-slate-500 leading-relaxed">
          cosine_similarity(&quot;what does it cost?&quot;, embedding[&quot;Pricing&quot;]) = <span className="text-emerald-400">0.97</span>
        </p>
      </div>
    </div>
  </div>
);

/* ── Script embed mock ─────────────────────────────────────────────────── */
const ScriptPanel = ({ data }) => (
  <div className="flex flex-col h-full">
    <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
      <span className="material-symbols-outlined text-[12px] text-violet-500">code</span>
      <span className="text-[9px] font-mono uppercase tracking-widest text-slate-400 dark:text-slate-500">{data.label}</span>
    </div>
    <div className="flex-1 p-5 bg-slate-950 dark:bg-slate-950 flex flex-col justify-between gap-5">
      <pre className="font-mono text-xs leading-relaxed text-slate-300 whitespace-pre overflow-x-auto">
        <span className="text-slate-500">&lt;</span>
        <span className="text-blue-400">script</span>
        {"\n  "}
        <span className="text-amber-300">src</span>
        <span className="text-slate-500">=</span>
        <span className="text-emerald-400">&quot;https://cdn.sapybase.com/widget.js&quot;</span>
        {"\n  "}
        <span className="text-amber-300">data-bot-id</span>
        <span className="text-slate-500">=</span>
        <span className="text-emerald-400">&quot;sb_prod_x7k9m&quot;</span>
        {"\n  "}
        <span className="text-amber-300">data-theme</span>
        <span className="text-slate-500">=</span>
        <span className="text-emerald-400">&quot;blue&quot;</span>
        {"\n  "}
        <span className="text-violet-400">defer</span>
        {"\n"}
        <span className="text-slate-500">&gt;&lt;/</span>
        <span className="text-blue-400">script</span>
        <span className="text-slate-500">&gt;</span>
      </pre>
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[10px] font-mono text-emerald-400 uppercase tracking-widest">Bot streaming live</span>
        </div>
        <div className="flex items-center gap-2 pl-3.5">
          <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">platform: any html · load: 4.1kb</span>
        </div>
      </div>
    </div>
  </div>
);

const HowItWorks = () => {
  const [activeStep, setActiveStep] = useState(1);
  const active = PIPELINE_STEPS.find((s) => s.id === activeStep);

  return (
    <section id="how-it-works" className="bg-white dark:bg-slate-950 overflow-hidden transition-colors duration-500">
      <div className="max-w-8xl mx-auto px-6 md:px-3">
        <div className="grid grid-cols-1 gap-px bg-slate-200 dark:bg-slate-800 border-y border-slate-200 dark:border-slate-800 transition-colors duration-500">

          {/* ── HEADER CELL ──────────────────────────────────────────────── */}
          <div className="bg-white dark:bg-slate-950 p-8 md:p-12 flex flex-col md:flex-row md:items-end justify-between gap-8 transition-colors duration-500">
            <div className="space-y-4 max-w-xl">
              <div className="flex items-center gap-2 text-xs uppercase tracking-widest font-bold font-google text-slate-400 dark:text-slate-500">
                <span className="material-symbols-outlined text-[14px]">linear_scale</span>
                <span>Process_Overview // Three_Stages</span>
              </div>
              <h2 className="text-4xl md:text-5xl font-display font-black tracking-tight leading-none text-slate-900 dark:text-slate-200 uppercase">
                From Data to <br />
                <span className="text-blue-600 dark:text-blue-400">Live Chatbot.</span>
              </h2>
              <p className="text-base font-google text-slate-500 dark:text-slate-400 leading-relaxed">
                No machine learning expertise required. Click each stage to understand exactly what happens under the hood.
              </p>
            </div>
            <div className="flex flex-row md:flex-col items-start md:items-end gap-4 md:gap-2 shrink-0">
              <div className="text-4xl md:text-5xl font-display font-black tabular-nums text-slate-900 dark:text-slate-200">&lt; 10</div>
              <div className="text-xs uppercase tracking-widest font-bold font-google text-slate-400 dark:text-slate-500 md:text-right">
                Minutes to deploy<br className="hidden md:block" /> a live AI chatbot
              </div>
            </div>
          </div>

          {/* ── PIPELINE NAV — 3 tabs ─────────────────────────────────────── */}
          <div className="bg-white dark:bg-slate-950 transition-colors duration-500">
            <div className="grid grid-cols-3 gap-px bg-slate-200 dark:bg-slate-800">
              {PIPELINE_STEPS.map((s) => {
                const isActive = activeStep === s.id;
                return (
                  <button
                    key={s.id}
                    onClick={() => setActiveStep(s.id)}
                    className={`group relative flex flex-col gap-3 p-5 md:p-8 text-left transition-all duration-300 cursor-pointer
                      ${isActive
                        ? "bg-white dark:bg-slate-950"
                        : "bg-slate-50/60 dark:bg-slate-900/60 hover:bg-slate-50 dark:hover:bg-slate-900"
                      }`}
                  >
                    {/* Active top border indicator */}
                    <div className={`absolute top-0 left-0 right-0 h-0.5 transition-all duration-300
                      ${isActive ? "bg-blue-600 dark:bg-blue-400" : "bg-transparent group-hover:bg-slate-200 dark:group-hover:bg-slate-700"}`}
                    />

                    {/* Eyebrow */}
                    <div className={`text-sm uppercase tracking-widest font-bold font-google transition-colors duration-300
                      ${isActive ? "text-blue-600 dark:text-blue-400" : "text-slate-400 dark:text-slate-600"}`}>
                      STEP_{s.step}
                    </div>

                    {/* Icon — ghost watermark expands behind tab content */}
                    <div className="relative flex items-start overflow-visible">
                      <span
                        className={`material-symbols-outlined absolute select-none pointer-events-none transition-all duration-300 z-0 leading-none
                          ${isActive ? "opacity-[0.3] text-blue-600 dark:text-blue-400" : "opacity-[0.04] text-slate-500 dark:text-slate-400"}`}
                        style={{ fontSize: "100px", top: "-24px", right: "-8px" }}
                      >
                        {s.icon}
                      </span>
                    </div>

                    {/* Label + title */}
                    <div>
                      <div className={`text-sm uppercase tracking-widest font-bold font-google mb-1 transition-colors duration-300
                        ${isActive ? "text-slate-500 dark:text-slate-400" : "text-slate-400 dark:text-slate-600"}`}>
                        {s.label}
                      </div>
                      <div className={`text-sm md:text-base font-display font-bold leading-tight transition-colors duration-300
                        ${isActive ? "text-slate-900 dark:text-slate-200" : "text-slate-400 dark:text-slate-600"}`}>
                        {s.title}
                      </div>
                    </div>

                    {/* Active caret pointing down */}
                    {isActive && (
                      <div className="absolute -bottom-[9px] left-1/2 -translate-x-1/2 w-4 h-4 bg-white dark:bg-slate-950 border-b border-r border-slate-200 dark:border-slate-800 rotate-45 z-10" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── EXPLAINER PANEL ──────────────────────────────────────────── */}
          <div className="bg-white dark:bg-slate-950 transition-all duration-300">
            {/* Panel inner: two columns on desktop */}
            <div
              key={activeStep}
              className="grid grid-cols-1 md:grid-cols-2 gap-px bg-slate-200 dark:bg-slate-800 animate-[fadeSlideIn_0.25s_ease-out_both]"
              style={{ animation: "fadeSlideIn 0.25s ease-out both" }}
            >
              {/* LEFT — value / business explanation */}
              <div className="bg-white dark:bg-slate-950 p-8 md:p-10 flex flex-col gap-6 transition-colors duration-500">
                <div className="flex items-center gap-2 text-xs uppercase tracking-widest font-bold font-google text-slate-400 dark:text-slate-500">
                  <span className="text-blue-600 dark:text-blue-400">STEP_{active.step}</span>
                  <span className="text-slate-300 dark:text-slate-600">//</span>
                  <span>{active.label}</span>
                </div>

                <div className="space-y-3 flex-1">
                  <h3 className="text-2xl md:text-3xl font-display font-bold text-slate-900 dark:text-slate-200 leading-tight">
                    {active.value.heading}
                  </h3>
                  <p className="text-sm font-google text-slate-500 dark:text-slate-400 leading-relaxed">
                    {active.value.body}
                  </p>
                </div>

                <ul className="space-y-2.5">
                  {active.value.bullets.map((b) => (
                    <li key={b} className="flex items-center gap-3 text-xs font-google text-slate-500 dark:text-slate-400">
                      <span className="material-symbols-outlined text-[14px] text-emerald-500 shrink-0">check_circle</span>
                      {b}
                    </li>
                  ))}
                </ul>

                <div className="pt-6 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500 uppercase tracking-widest">{active.detail}</span>
                  <span className="material-symbols-outlined text-[14px] text-slate-300 dark:text-slate-700">arrow_forward</span>
                </div>
              </div>

              {/* RIGHT — tech visualization */}
              <div className="bg-slate-50/50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden min-h-[280px] md:min-h-0 transition-colors duration-500">
                {active.tech.type === "terminal" && <TerminalPanel data={active.tech} />}
                {active.tech.type === "vector"   && <VectorPanel   data={active.tech} />}
                {active.tech.type === "script"   && <ScriptPanel   data={active.tech} />}
              </div>
            </div>
          </div>

          {/* ── STATUS STRIP ─────────────────────────────────────────────── */}
          <div className="bg-slate-50/50 dark:bg-slate-900 p-8 md:p-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 transition-colors duration-500">
            <div className="flex items-center gap-4">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              <p className="text-xs uppercase tracking-widest font-bold font-google text-slate-500 dark:text-slate-400">
                System Status: <span className="text-emerald-600 dark:text-emerald-400">Deployment pipeline operational</span>
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs uppercase tracking-widest font-bold font-google text-slate-400 dark:text-slate-500">
              <span className="material-symbols-outlined text-[14px]">check_circle</span>
              No credit card required to start
            </div>
          </div>

        </div>
      </div>

      {/* Keyframe for panel swap animation */}
      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0);   }
        }
      `}</style>
    </section>
  );
};

export default HowItWorks;
