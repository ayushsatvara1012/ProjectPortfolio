'use client';

import React, { useState, useEffect, useLayoutEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

// useLayoutEffect warns during SSR; fall back to useEffect on the server.
const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

const PIPELINE_STEPS = [
  {
    id: 1,
    step: "01",
    label: "INGEST",
    title: "Connect Your Data",
    subtitle: "Zero manual entry. Pure extraction.",
    description: "Vaayu securely crawls your website or accepts PDF uploads and extracts every meaningful sentence — product details, FAQs, pricing tables, policies — without you copying a single line. The moment you connect, your content becomes the brain of your chatbot.",
    bullets: [
      "Auto-sync on website content changes",
      "Upload PDFs, CSVs, or enter raw text",
      "No manual database configuration required"
    ],
  },
  {
    id: 2,
    step: "02",
    label: "UNDERSTAND",
    title: "AI Reads Intent, Not Keywords",
    subtitle: "Semantic intent-matching.",
    description: "Traditional search breaks when a customer types 'what does it cost?' instead of 'pricing'. Vaayu converts every sentence into an AI fingerprint that understands meaning, not just keywords. When a user asks a question, we match the closest meaning, not just words, preventing chatbot failures.",
    bullets: [
      "Semantic matching (meaning-aware search)",
      "Protects against chatbot hallucination",
      "Context-aware conversation memory"
    ],
  },
  {
    id: 3,
    step: "03",
    label: "DEPLOY",
    title: "Live in 60 Seconds",
    subtitle: "One script tag. Every platform.",
    description: "No backend to configure, no servers to maintain. Simply copy a single line of script and paste it into any HTML page — React, Next.js, Webflow, Shopify, or WordPress. Your AI agent starts streaming answers to visitors immediately.",
    bullets: [
      "Works on Shopify, WordPress, Wix, Squarespace, Webflow, Framer — if it accepts HTML, it works",
      "Customize widget colors & avatar from dashboard",
      "Instant real-time WebSocket answer streaming"
    ],
  },
];

const QUESTIONS_DATA = [
  { query: "what does it cost?", match: "97%", intent: "Pricing Details" },
  { query: "how do I set it up?", match: "99%", intent: "Deployment Guide" },
  { query: "is there a free trial?", match: "95%", intent: "Free Tier Policy" },
];

// ── Shared engine logo node ──────────────────────────────────────────────────
// Accepts optional `phase` to show thinking/resolved ring states.
// The outer div is sized and positioned by the caller.
function EngineLogoNode({
  phase,
  reducedMotion = false,
}: {
  phase?: "typing" | "sending" | "thinking" | "resolved";
  reducedMotion?: boolean;
}) {
  const isThinking = phase === "thinking";
  const isResolved = phase === "resolved";

  return (
    <div className="relative w-full h-full">
      {/* Outer pulse ring — desktop only, skipped on mobile to save GPU */}
      {isThinking && !reducedMotion && (
        <motion.div
          className="absolute inset-0 rounded-full border border-blue-500/30"
          style={{ willChange: "transform, opacity" }}
          animate={{ scale: [1, 1.5, 1], opacity: [0.7, 0, 0.7] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "easeOut" }}
        />
      )}

      {/* Spinning gradient border — static on mobile */}
      <motion.div
        className="absolute inset-0 rounded-full border-2 border-transparent border-t-indigo-500 border-r-blue-400"
        style={{ willChange: "transform" }}
        animate={isThinking && !reducedMotion ? { rotate: 360 } : { rotate: 0 }}
        transition={
          isThinking && !reducedMotion
            ? { duration: 1, repeat: Infinity, ease: "linear" }
            : { duration: 0.5 }
        }
      />

      {/* Inner disc */}
      <div
        className={`absolute inset-[10%] rounded-full border bg-white dark:bg-slate-900 flex items-center justify-center shadow-md transition-all duration-300 ${isThinking
            ? "border-blue-500/40 dark:border-blue-400/40 shadow-blue-500/10"
            : isResolved
              ? "border-emerald-500/40 dark:border-emerald-400/40 shadow-emerald-500/10"
              : "border-slate-200 dark:border-slate-800"
          }`}
      >
        {/* Logo breathing animation — skipped on mobile */}
        {reducedMotion ? (
          <img
            src="/logo2.svg"
            alt="Vaayu Engine"
            className="w-[58%] h-[58%] object-contain"
          />
        ) : (
          <motion.img
            src="/logo2.svg"
            alt="Vaayu Engine"
            className="w-[58%] h-[58%] object-contain"
            style={{ willChange: "transform" }}
            animate={isThinking ? { scale: [1, 1.12, 1] } : { scale: [1, 1.05, 1] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
          />
        )}
      </div>
    </div>
  );
}

// ── SVG gradient defs reused across step 1 ───────────────────────────────────
// IDs are scoped to prevent collisions when all three previews are mounted.
function Step1SVGDefs() {
  return (
    <defs>
      {/* userSpaceOnUse avoids degenerate-bbox failures on zero-height/zero-width paths */}
      <linearGradient id="s1-glow-a" gradientUnits="userSpaceOnUse" x1="100" y1="250" x2="400" y2="250">
        <stop offset="0%" stopColor="#3B82F6" stopOpacity="0" />
        <stop offset="50%" stopColor="#3B82F6" stopOpacity="1" />
        <stop offset="100%" stopColor="#6366F1" stopOpacity="0" />
      </linearGradient>
      <linearGradient id="s1-glow-b" gradientUnits="userSpaceOnUse" x1="100" y1="250" x2="400" y2="250">
        <stop offset="0%" stopColor="#6366F1" stopOpacity="0" />
        <stop offset="50%" stopColor="#4F46E5" stopOpacity="1" />
        <stop offset="100%" stopColor="#3B82F6" stopOpacity="0" />
      </linearGradient>
    </defs>
  );
}

// ── Step 2 visual (semantic understanding) ───────────────────────────────────
// Coordinate mapping (viewBox 0 0 500 500):
//   search bar   → left-[80%] top-[50%]  → SVG (400, 250)
//   engine logo  → left-[20%] top-[50%]  → SVG (100, 250)
//   intent card  → left-[20%] top-[82%]  → SVG (100, 410)
function StepTwoVisual({
  phase,
  typedText,
  currentData,
  isMobile = false,
}: {
  phase: "typing" | "sending" | "thinking" | "resolved";
  typedText: string;
  currentData: (typeof QUESTIONS_DATA)[0];
  isMobile?: boolean;
}) {
  const active = phase === "sending" || phase === "thinking" || phase === "resolved";

  return (
    <div className="relative w-full h-full">
      <svg
        viewBox="0 0 500 500"
        className="absolute inset-0 w-full h-full pointer-events-none z-0 overflow-visible"
      >
        <defs>
          {/* Horizontal: search bar (400) → engine (100) — right-to-left gradient */}
          <linearGradient id="s2-horiz" x1="100%" y1="0%" x2="0%" y2="0%">
            <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#6366F1" stopOpacity="1" />
          </linearGradient>
          {/* Vertical: engine (250) → intent card (410) */}
          <linearGradient id="s2-vert" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#6366F1" stopOpacity="1" />
            <stop offset="100%" stopColor="#10B981" stopOpacity="1" />
          </linearGradient>
        </defs>

        {/* Base dashed horizontal line: search (400,250) ← engine (100,250) */}
        <path
          d="M 400 250 L 100 250"
          stroke="#E2E8F0"
          strokeWidth="1.5"
          fill="none"
          className="dark:stroke-slate-800"
          strokeDasharray="4 4"
        />

        {/* Animated overlay when request is in-flight */}
        {active && (
          <motion.path
            key={`s2-horiz-${currentData.query}`}
            d="M 400 250 L 100 250"
            stroke="url(#s2-horiz)"
            strokeWidth="2.5"
            fill="none"
            pathLength={100}
            strokeDasharray="100"
            initial={{ strokeDashoffset: 100 }}
            animate={{ strokeDashoffset: 0 }}
            transition={{ duration: 0.8, ease: "easeInOut" }}
          />
        )}

        {/* Moving data packet */}
        {phase === "sending" && (
          <>
            <motion.circle
              key={`pkt-core-${currentData.query}`}
              cx={400} cy={250} r={5}
              fill="#3B82F6"
              animate={{ cx: 100 }}
              transition={{ duration: 0.8, ease: "easeInOut" }}
            />
            <motion.circle
              key={`pkt-glow-${currentData.query}`}
              cx={400} cy={250} r={10}
              fill="#3B82F6"
              fillOpacity={0.3}
              animate={{ cx: 100 }}
              transition={{ duration: 0.8, ease: "easeInOut" }}
            />
          </>
        )}

        {/* Vertical line from engine bottom (100,275) to intent card (100,395) */}
        {phase === "resolved" && (
          <>
            <path
              d="M 100 275 L 100 395"
              stroke="#E2E8F0"
              strokeWidth="1.5"
              fill="none"
              className="dark:stroke-slate-800"
              strokeDasharray="3 3"
            />
            <motion.path
              key={`s2-vert-${currentData.query}`}
              d="M 100 275 L 100 395"
              stroke="url(#s2-vert)"
              strokeWidth="2"
              fill="none"
              pathLength={100}
              strokeDasharray="100"
              initial={{ strokeDashoffset: 100 }}
              animate={{ strokeDashoffset: 0 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            />
          </>
        )}
      </svg>

      {/* Search bar — RIGHT anchor: left-[80%] top-[50%] */}
      {/* w-[50%]: increased from 38% to better accommodate text display */}
      <div className="absolute left-[78%] top-[50%] -translate-x-1/2 -translate-y-1/2 w-[42%] z-10">
        <div className="border border-slate-200 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/70 backdrop-blur-sm rounded-xl px-3 py-2.5 flex items-center gap-2 shadow-sm">
          <span className="material-symbols-outlined text-[15px] text-blue-500 shrink-0">
            search
          </span>
          <span className="text-[11px] font-mono text-slate-800 dark:text-slate-200 min-h-[16px] flex items-center w-full overflow-hidden">
            <span className="truncate">{typedText}</span>
            {phase === "typing" && (
              <motion.span
                animate={{ opacity: [1, 0, 1] }}
                transition={{ repeat: Infinity, duration: 0.8 }}
                className="shrink-0 inline-block w-[1.5px] h-[12px] bg-blue-500 ml-0.5 rounded-full"
              />
            )}
          </span>
        </div>
      </div>

      {/* Engine node — mobile only; desktop uses the shared overlay */}
      {isMobile && (
        <div className="absolute left-[20%] top-[50%] -translate-x-1/2 -translate-y-1/2 w-[22%] aspect-square z-10 pointer-events-none">
          <EngineLogoNode phase={phase} />
          <span className="absolute top-[115%] left-1/2 -translate-x-1/2 text-[8px] font-mono font-bold tracking-wider text-slate-400 dark:text-slate-500 uppercase whitespace-nowrap select-none">
            Vaayu Engine
          </span>
        </div>
      )}

      {/* Intent resolution card — below engine: SVG vertical line at x=100 (20%)
          falls inside the card's span (4% → 58%), so no SVG changes needed.
          Left-anchored at 4% to avoid the -translate-x-1/2 left-clip. */}
      <div className="absolute left-[4%] top-[82%] -translate-y-1/2 w-[56%] z-20 flex flex-col items-center gap-2">
        <AnimatePresence mode="wait">
          {phase === "thinking" && (
            <motion.div
              key="thinking"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="flex items-center gap-1.5 text-[9px] font-mono text-indigo-500 dark:text-indigo-400 bg-indigo-50/60 dark:bg-indigo-950/20 px-2.5 py-1 rounded-md border border-indigo-100/60 dark:border-indigo-900/30 whitespace-nowrap"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-ping shrink-0" />
              Analyzing intent…
            </motion.div>
          )}

          {phase === "resolved" && (
            <motion.div
              key="resolved"
              initial={{ opacity: 0, scale: 0.92, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: -4 }}
              transition={isMobile
                ? { type: "tween", duration: 0.2 }
                : { type: "spring", stiffness: 280, damping: 22 }}
              className="w-full flex flex-col items-center gap-1.5"
            >
              <div className="flex items-center gap-1.5 bg-slate-50/90 dark:bg-slate-900/90 backdrop-blur-sm border border-slate-200 dark:border-slate-800/80 rounded-lg px-2.5 py-1 text-[9px] font-mono text-slate-500 dark:text-slate-400 whitespace-nowrap">
                Query Embedding
                <span className="text-blue-500 font-bold mx-0.5">→</span>
                <span className="text-slate-800 dark:text-slate-200 font-bold">
                  {currentData.match} Match
                </span>
              </div>
              <div className="flex items-center gap-1.5 bg-emerald-500/10 dark:bg-emerald-500/20 border border-emerald-500/30 dark:border-emerald-500/40 rounded-lg px-2.5 py-1 text-[10px] font-mono text-emerald-600 dark:text-emerald-400 font-bold whitespace-nowrap">
                <span className="material-symbols-outlined text-[12px] text-emerald-500 shrink-0">
                  check_circle
                </span>
                {currentData.intent}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ── Step 3 visual (deployment / live widget) ─────────────────────────────────
// Vertical layout:
//   snippet  → left-[50%] top-[22%]  → SVG center (250, 110), bottom ≈ y=140
//   browser  → left-[50%] top-[64%]  → SVG center (250, 320), top    ≈ y=202
//   arrow    → M 250 142 L 250 200   (vertical, center-aligned)
function StepThreeVisual({ isMobile = false, isActive = true }: { isMobile?: boolean; isActive?: boolean }) {
  const [phase, setPhase] = useState<"copying" | "transferring" | "installing" | "active">("copying");
  const [copied, setCopied] = useState(false);
  const [chatPhase, setChatPhase] = useState<"hidden" | "user-typing" | "bot-thinking" | "bot-typing">("hidden");
  const [typedUser, setTypedUser] = useState("");
  const [typedBot, setTypedBot] = useState("");

  const userQuery = "is it live?";
  const botAnswer = "Live & streaming answers! 🚀";

  useEffect(() => {
    if (!isActive) {
      setPhase("copying");
      setCopied(false);
      setChatPhase("hidden");
      setTypedUser("");
      setTypedBot("");
      return;
    }

    let timer: ReturnType<typeof setTimeout>;

    if (phase === "copying") {
      setCopied(false);
      setChatPhase("hidden");
      setTypedUser("");
      setTypedBot("");

      // Mobile: skip cursor delay, copy immediately
      timer = setTimeout(() => {
        setCopied(true);
        timer = setTimeout(() => {
          setPhase("transferring");
        }, 600);
      }, isMobile ? 600 : 1400);
    } else if (phase === "transferring") {
      timer = setTimeout(() => {
        setPhase("installing");
      }, isMobile ? 500 : 1000);
    } else if (phase === "installing") {
      timer = setTimeout(() => {
        setPhase("active");
        setChatPhase("user-typing");
      }, isMobile ? 500 : 1000);
    } else if (phase === "active") {
      if (chatPhase === "user-typing") {
        if (typedUser.length < userQuery.length) {
          timer = setTimeout(() => {
            setTypedUser(userQuery.slice(0, typedUser.length + 1));
          }, isMobile ? 50 : 80);
        } else {
          timer = setTimeout(() => {
            setChatPhase("bot-thinking");
          }, 400);
        }
      } else if (chatPhase === "bot-thinking") {
        timer = setTimeout(() => {
          setChatPhase("bot-typing");
        }, isMobile ? 600 : 1200);
      } else if (chatPhase === "bot-typing") {
        if (typedBot.length < botAnswer.length) {
          timer = setTimeout(() => {
            setTypedBot(botAnswer.slice(0, typedBot.length + 1));
          }, isMobile ? 30 : 50);
        } else {
          timer = setTimeout(() => {
            setPhase("copying");
          }, 3500);
        }
      }
    }

    return () => clearTimeout(timer);
  }, [phase, chatPhase, typedUser, typedBot, isMobile, isActive]);

  return (
    <div className="relative w-full h-full">

      {/* ── SVG: vertical arrow connecting snippet → browser ─────────────────
          Snippet center:  top-[22%] = y=110; card height ~30px → bottom y≈140
          Browser top:     top-[64%] = y=320; aspect-16/9 w=84% → h≈47% →
                           top edge at 64%−23.5% = 40.5% → y≈202
          Arrow: M 250 142 L 250 200
      ────────────────────────────────────────────────────────────────────── */}
      <svg
        viewBox="0 0 500 500"
        className="absolute inset-0 w-full h-full pointer-events-none z-0 overflow-visible"
      >
        <defs>
          <linearGradient id="s3-vert" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#10B981" stopOpacity="1" />
          </linearGradient>
        </defs>

        {/* Base dashed connector */}
        <path
          d="M 250 142 L 250 200"
          stroke="#E2E8F0"
          strokeWidth="1.5"
          fill="none"
          className="dark:stroke-slate-800"
          strokeDasharray="3 3"
        />

        {/* Animated glow overlay */}
        {(phase === "transferring" || phase === "installing" || phase === "active") && (
          <motion.path
            d="M 250 142 L 250 200"
            stroke="url(#s3-vert)"
            strokeWidth="2.5"
            fill="none"
            pathLength={100}
            strokeDasharray="100"
            initial={{ strokeDashoffset: 100 }}
            animate={{ strokeDashoffset: 0 }}
            transition={{ duration: 0.7, ease: "easeInOut" }}
          />
        )}

        {/* Data packet travelling snippet → browser */}
        {phase === "transferring" && (
          <>
            <motion.circle cx={250} cy={142} r={5} fill="#10B981" animate={{ cy: 200 }} transition={{ duration: 0.7, ease: "easeInOut" }} />
            <motion.circle cx={250} cy={142} r={10} fill="#10B981" fillOpacity={0.3} animate={{ cy: 200 }} transition={{ duration: 0.7, ease: "easeInOut" }} />
          </>
        )}
      </svg>

      {/* ── TOP: Code snippet — compact, full-width, centered ──────────────── */}
      {/* Center at top-[22%] → SVG y=110. Width 82% → 410px at 500px canvas. */}
      <div className="absolute left-[50%] top-[22%] -translate-x-1/2 -translate-y-1/2 w-[82%] z-10">
        <div className="relative border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm rounded-xl px-3 py-2 flex items-center gap-2 shadow-md">

          {/* macOS traffic-light dots */}
          <div className="flex gap-1 shrink-0">
            <span className="w-2 h-2 rounded-full bg-rose-400/60" />
            <span className="w-2 h-2 rounded-full bg-amber-400/60" />
            <span className="w-2 h-2 rounded-full bg-emerald-400/60" />
          </div>

          {/* Inline code snippet */}
          <div className="flex-1 font-mono text-[9px] text-slate-600 dark:text-slate-400 leading-normal overflow-hidden select-none">
            <span className="text-blue-500">&lt;script</span>{" "}
            <span className="text-purple-500">src</span>=<span className="text-emerald-600 dark:text-emerald-400">&quot;sapy.js&quot;</span>{" "}
            <span className="text-purple-500">data-id</span>=<span className="text-emerald-600 dark:text-emerald-400">&quot;sb-12&quot;</span>
            <span className="text-blue-500">&gt;&lt;/script&gt;</span>
          </div>

          {/* Copy button */}
          <motion.button
            animate={copied ? { scale: [1, 0.92, 1] } : {}}
            transition={{ duration: 0.15 }}
            className={`shrink-0 flex items-center gap-1 border rounded-md px-1.5 py-0.5 text-[8px] font-mono font-medium transition-colors ${copied
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                : "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700/60 text-slate-500 dark:text-slate-400"
              }`}
          >
            <span className="material-symbols-outlined text-[10px]">
              {copied ? "check" : "content_copy"}
            </span>
            {copied ? "Copied!" : "Copy"}
          </motion.button>

          {/* Virtual cursor click animation — desktop only */}
          {phase === "copying" && !isMobile && (
            <motion.div
              className="absolute z-20 pointer-events-none text-blue-500"
              initial={{ x: 80, y: 40, opacity: 0 }}
              animate={{
                x: [80, 76, 76, 80],
                y: [40, 8, 8, 40],
                scale: [1, 1, 0.85, 1],
                opacity: [0, 1, 1, 0],
              }}
              transition={{ duration: 1.4, times: [0, 0.5, 0.65, 1], ease: "easeInOut" }}
            >
              <svg className="w-3 h-3 drop-shadow-md fill-current" viewBox="0 0 24 24">
                <path d="M4.5 2v17.5l4.7-4.7 3.8 9 2.5-1.1-3.8-9 6.2-.2L4.5 2z" />
              </svg>
            </motion.div>
          )}
        </div>
      </div>

      {/* ── BOTTOM: Browser mockup — large, centered ───────────────────────────
          Center at top-[64%] → SVG y=320. Width 84% (420px at 500px canvas).
          aspect-[16/9] → height 236px (47.2% of canvas). Top edge ≈ y=202.
          Chat widget at w-[50%] of browser → 210px. Clearly readable.
      ────────────────────────────────────────────────────────────────────── */}
      <div className="absolute left-[50%] top-[64%] -translate-x-1/2 -translate-y-1/2 w-[84%] z-10">
        <div
          className={`relative border bg-white dark:bg-slate-900 rounded-xl overflow-hidden flex flex-col aspect-[16/9] shadow-lg transition-all duration-500 ${phase === "installing"
              ? "border-emerald-500/60 shadow-emerald-500/10 scale-[1.01]"
              : phase === "active"
                ? "border-slate-200 dark:border-slate-800/80"
                : "border-slate-200 dark:border-slate-800/80 opacity-60"
            }`}
        >
          {/* Browser chrome bar */}
          <div className="bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5 flex items-center gap-2 border-b border-slate-200 dark:border-slate-800/60 shrink-0">
            <div className="flex gap-1 shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700" />
              <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700" />
              <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700" />
            </div>
            <div className="flex-1 bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/50 rounded px-2 py-0.5 text-[8px] font-mono text-slate-400 dark:text-slate-500 text-center truncate select-none">
              yourwebsite.com
            </div>
          </div>

          {/* Page body */}
          <div className="relative flex-1 p-3 flex flex-col gap-2 bg-slate-50/30 dark:bg-slate-900/30 overflow-hidden">
            {/* Skeleton content */}
            <div className="h-2 w-1/3 bg-slate-200 dark:bg-slate-800 rounded-full" />
            <div className="h-1.5 w-2/3 bg-slate-100 dark:bg-slate-800/60 rounded-full" />
            <div className="h-1.5 w-1/2 bg-slate-100 dark:bg-slate-800/60 rounded-full" />

            {/* Script installed confirmation */}
            <AnimatePresence>
              {phase === "installing" && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.85 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.85 }}
                  className="absolute inset-0 m-auto w-[65%] h-[55%] bg-emerald-500/10 dark:bg-emerald-950/40 border border-emerald-500/30 rounded-xl flex items-center justify-center gap-2 text-[10px] font-mono text-emerald-600 dark:text-emerald-400 font-bold shadow-sm"
                >
                  <span className="material-symbols-outlined text-[14px] text-emerald-500 animate-ping">
                    sensors
                  </span>
                  Script Installed!
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── Live chat widget — now 50% of the wider browser ──────────── */}
            {phase === "active" && (
              <div className="absolute inset-0 flex flex-col justify-end items-end p-2">
                <AnimatePresence mode="wait">
                  {chatPhase === "hidden" ? (
                    <motion.div
                      key="launcher"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      exit={{ scale: 0 }}
                      transition={isMobile
                        ? { type: "tween", duration: 0.15 }
                        : { type: "spring", stiffness: 300, damping: 20 }}
                      className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center shadow-lg"
                    >
                      <span className="material-symbols-outlined text-[16px] text-white">chat_bubble</span>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="chat-box"
                      initial={{ opacity: 0, y: 14, scale: 0.88 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 14, scale: 0.88 }}
                      transition={isMobile
                        ? { type: "tween", duration: 0.2 }
                        : { type: "spring", stiffness: 260, damping: 22 }}
                      className="w-[50%] h-[90%] bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl flex flex-col shadow-2xl overflow-hidden"
                    >
                      {/* Chat header */}
                      <div className="bg-blue-500 px-3 py-2 flex items-center gap-2 shrink-0">
                        <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        <span className="text-[10px] font-google font-bold text-white uppercase tracking-wider">
                          Live Assistant
                        </span>
                      </div>

                      {/* Messages */}
                      <div className="flex-1 p-2.5 flex flex-col gap-2 overflow-hidden text-[10px] font-sans">
                        {typedUser && (
                          <motion.div
                            initial={{ opacity: 0, x: 8 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="self-end bg-blue-500 text-white rounded-xl rounded-tr-none px-2.5 py-1.5 max-w-[85%] text-right font-medium leading-snug"
                          >
                            {typedUser}
                          </motion.div>
                        )}

                        {chatPhase === "bot-thinking" && (
                          <div className="self-start flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 rounded-xl rounded-tl-none px-3 py-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400 dark:bg-slate-500 animate-bounce" style={{ animationDelay: "0ms" }} />
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400 dark:bg-slate-500 animate-bounce" style={{ animationDelay: "150ms" }} />
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400 dark:bg-slate-500 animate-bounce" style={{ animationDelay: "300ms" }} />
                          </div>
                        )}

                        {typedBot && (
                          <motion.div
                            initial={{ opacity: 0, x: -8 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="self-start bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-xl rounded-tl-none px-2.5 py-1.5 max-w-[85%] font-medium leading-snug"
                          >
                            {typedBot}
                          </motion.div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Status badge — below browser, centered */}
      <AnimatePresence>
        {phase === "active" && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.3 }}
            className="absolute bottom-[3%] left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-emerald-500/10 dark:bg-emerald-500/15 border border-emerald-500/30 rounded-full px-3 py-1"
          >
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping shrink-0" />
            <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
              Bot streaming live
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Typewriter state isolated into its own component ─────────────────────────
// Only this tiny node re-renders on every 60ms character tick.
// The parent re-renders only on phase transitions (~4× per cycle vs ~50×).
type TypewriterPhase = "typing" | "sending" | "thinking" | "resolved";

function TypewriterLabel({
  isActive,
  isMobile,
  onPhaseChange,
}: {
  isActive: boolean;
  isMobile: boolean;
  onPhaseChange?: (phase: TypewriterPhase) => void;
}) {
  const [phase, setPhase] = useState<TypewriterPhase>("typing");
  const [typedText, setTypedText] = useState("");
  const [currentIdx, setCurrentIdx] = useState(0);
  const currentData = QUESTIONS_DATA[currentIdx];

  useEffect(() => {
    if (!isActive) {
      setPhase("typing");
      setTypedText("");
      setCurrentIdx(0);
      onPhaseChange?.("typing");
      return;
    }

    let timer: ReturnType<typeof setTimeout>;

    if (phase === "typing") {
      const full = currentData.query;
      if (typedText.length < full.length) {
        timer = setTimeout(() => setTypedText(full.slice(0, typedText.length + 1)), 60);
      } else {
        timer = setTimeout(() => { setPhase("sending"); onPhaseChange?.("sending"); }, 800);
      }
    } else if (phase === "sending") {
      timer = setTimeout(() => { setPhase("thinking"); onPhaseChange?.("thinking"); }, 900);
    } else if (phase === "thinking") {
      timer = setTimeout(() => { setPhase("resolved"); onPhaseChange?.("resolved"); }, 1500);
    } else if (phase === "resolved") {
      timer = setTimeout(() => {
        setTypedText("");
        setCurrentIdx((p) => (p + 1) % QUESTIONS_DATA.length);
        setPhase("typing");
        onPhaseChange?.("typing");
      }, 3000);
    }

    return () => clearTimeout(timer);
  }, [phase, typedText, currentIdx, currentData, isActive, onPhaseChange]);

  return (
    <StepTwoVisual
      phase={phase}
      typedText={typedText}
      currentData={currentData}
      isMobile={isMobile}
    />
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function HowItWorks() {
  const [activeStep, setActiveStep] = useState(1);
  const stepRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [step2Phase, setStep2Phase] = useState<TypewriterPhase>("typing");
  const [isMobile, setIsMobile] = useState(false);
  const handleStep2Phase = useCallback((p: TypewriterPhase) => setStep2Phase(p), []);

  // Sync mirror of activeStep + a pending "anchor" for pinning a card's
  // on-screen position across an accordion open/close on mobile.
  const activeStepRef = useRef(1);
  const pendingAnchorRef = useRef<{ id: number; top: number } | null>(null);

  // Single entry point for changing the active step. On mobile it records the
  // target card's current viewport top BEFORE the state change, so the layout
  // effect below can scroll-compensate the instant height change — keeping the
  // header/text fixed instead of being shoved up when the card above collapses.
  const activateStep = useCallback((id: number) => {
    if (activeStepRef.current === id) return;
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      const el = stepRefs.current[id - 1];
      if (el) pendingAnchorRef.current = { id, top: el.getBoundingClientRect().top };
    }
    activeStepRef.current = id;
    setActiveStep(id);
  }, []);

  // Pin the newly-active card: cancel any vertical shift the accordion
  // collapse/expand introduced, so the header stays exactly where it was.
  // Runs before paint, so the shift + correction are atomic (no visible jump).
  useIsomorphicLayoutEffect(() => {
    const anchor = pendingAnchorRef.current;
    pendingAnchorRef.current = null;
    if (!anchor || anchor.id !== activeStep) return;
    const el = stepRefs.current[activeStep - 1];
    if (!el) return;
    const delta = el.getBoundingClientRect().top - anchor.top;
    if (delta) window.scrollBy(0, delta);
  }, [activeStep]);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check, { passive: true });
    return () => window.removeEventListener("resize", check);
  }, []);

  // IntersectionObserver — auto-activates the step nearest viewport centre
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            const idx = stepRefs.current.findIndex((el) => el === e.target);
            if (idx !== -1) activateStep(idx + 1);
          }
        });
      },
      { rootMargin: "-30% 0px -40% 0px", threshold: 0.1 }
    );

    stepRefs.current.forEach((r) => r && observer.observe(r));
    return () => observer.disconnect();
  }, [activateStep]);

  const handleStepClick = (id: number) => {
    activateStep(id);
    // Desktop only: center the card so it lines up with the sticky visual panel.
    // On mobile, activateStep already pins the card's position (see the layout
    // effect), so the header stays put and the preview opens on the lower side.
    if (!isMobile) {
      stepRefs.current[id - 1]?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  // ── Per-step preview panels ────────────────────────────────────────────────
  // All absolute-positioned elements use percentage coordinates that match the
  // SVG viewBox (0 0 500 500) via the mapping: left-[X%] ↔ SVG x = X * 5.
  //
  //  Left anchor   left-[20%]  →  SVG x = 100
  //  Right anchor  left-[80%]  →  SVG x = 400
  //  Top row       top-[20%]   →  SVG y = 100
  //  Middle row    top-[50%]   →  SVG y = 250
  //  Bottom row    top-[80%]   →  SVG y = 400

  const renderPreview = (stepId: number, isMobile = false, isActive = true) => {
    switch (stepId) {
      // ── STEP 1: INGEST ────────────────────────────────────────────────────
      case 1:
        return (
          <div className="relative w-full h-full">
            <svg
              viewBox="0 0 500 500"
              className="absolute inset-0 w-full h-full pointer-events-none z-0 overflow-visible"
            >
              <Step1SVGDefs />

              {/* Base dashed paths: source nodes (100,y) → engine (400,250) */}
              <path d="M 100 100 C 240 100, 260 250, 400 250" stroke="#E2E8F0" strokeWidth="1.5" fill="none" className="dark:stroke-slate-800" strokeDasharray="4 4" />
              <path d="M 100 250 L 400 250" stroke="#E2E8F0" strokeWidth="1.5" fill="none" className="dark:stroke-slate-800" strokeDasharray="4 4" />
              <path d="M 100 400 C 240 400, 260 250, 400 250" stroke="#E2E8F0" strokeWidth="1.5" fill="none" className="dark:stroke-slate-800" strokeDasharray="4 4" />

              {/* Animated glow pulses — native SVG <animate> uses user-unit coords directly,
                  avoiding Framer Motion's CSS-px / viewBox scale mismatch on mobile */}
              {!isMobile && (
                <path d="M 100 100 C 240 100, 260 250, 400 250" stroke="url(#s1-glow-a)" strokeWidth="2.5" fill="none" strokeDasharray="76 304">
                  <animate attributeName="stroke-dashoffset" from="0" to="-380" dur="2.5s" repeatCount="indefinite" calcMode="linear" />
                </path>
              )}
              <path d="M 100 250 L 400 250" stroke="url(#s1-glow-b)" strokeWidth="2.5" fill="none" strokeDasharray="60 240">
                <animate attributeName="stroke-dashoffset" from="0" to="-300" dur="2s" begin="0.5s" repeatCount="indefinite" calcMode="linear" />
              </path>
              {!isMobile && (
                <path d="M 100 400 C 240 400, 260 250, 400 250" stroke="url(#s1-glow-a)" strokeWidth="2.5" fill="none" strokeDasharray="76 304">
                  <animate attributeName="stroke-dashoffset" from="0" to="-380" dur="2.8s" begin="0.2s" repeatCount="indefinite" calcMode="linear" />
                </path>
              )}
            </svg>

            {/* Source nodes — LEFT column at 20%, tops 20% / 50% / 80% */}
            {(
              [
                { icon: "language", top: "20%" },
                { icon: "description", top: "50%" },
                { icon: "table_chart", top: "80%" },
              ] as const
            ).map(({ icon, top }) => (
              <div
                key={icon}
                className="absolute w-[13%] aspect-square -translate-x-1/2 -translate-y-1/2 z-10"
                style={{ left: "20%", top }}
              >
                <div className="w-full h-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-center shadow-sm">
                  <span className="material-symbols-outlined text-[clamp(20px,3vw,38px)] text-slate-500 dark:text-slate-400">
                    {icon}
                  </span>
                </div>
              </div>
            ))}

            {/* Engine node — RIGHT anchor, mobile only (desktop uses shared overlay) */}
            {isMobile && (
              <div className="absolute w-[22%] aspect-square left-[80%] top-[50%] -translate-x-1/2 -translate-y-1/2 z-10 pointer-events-none">
                <EngineLogoNode />
                <span className="absolute top-[115%] left-1/2 -translate-x-1/2 text-[8px] font-mono font-bold tracking-wider text-slate-400 dark:text-slate-500 uppercase whitespace-nowrap select-none">
                  Vaayu Engine
                </span>
              </div>
            )}
          </div>
        );

      // ── STEP 2: UNDERSTAND ────────────────────────────────────────────────
      case 2:
        return (
          <TypewriterLabel
            isActive={isActive}
            isMobile={isMobile}
            onPhaseChange={handleStep2Phase}
          />
        );

      // ── STEP 3: DEPLOY ────────────────────────────────────────────────────
      case 3:
        return <StepThreeVisual isMobile={isMobile} isActive={isActive} />;

      default:
        return null;
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <section
      id="how-it-works"
      className="relative w-full bg-white dark:bg-slate-950 transition-colors duration-500 py-10 sm:py-12 overflow-x-clip border-none shadow-none"
    >
      {/* Ambient background glows */}
      <div className="absolute top-1/3 left-10 w-96 h-96 bg-blue-500/5 dark:bg-blue-600/10 rounded-full blur-[120px] pointer-events-none select-none" />
      <div className="absolute bottom-1/3 right-10 w-96 h-96 bg-indigo-500/5 dark:bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none select-none" />

      <div className="max-w-8xl mx-auto px-6 sm:px-12 lg:px-20 relative z-10">

        {/* Section header */}
        <div className="mb-20 max-w-3xl">
          <div className="flex items-center gap-2 text-sm uppercase tracking-widest font-bold font-google text-slate-400 dark:text-slate-500 mb-4">
            <span className="material-symbols-outlined text-[16px] text-blue-500">linear_scale</span>
            <span>How It Works</span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-google font-medium tracking-tight leading-tight text-slate-900 dark:text-white mb-6">
            From your content to a live AI chatbot —{" "}
            <span className="text-transparent bg-clip-text bg-linear-to-r from-blue-600 to-cyan-600 dark:from-blue-400 dark:to-cyan-400">
              in 10 minutes
            </span>
          </h2>
          <p className="text-lg font-google text-slate-500 dark:text-slate-400 leading-relaxed">
            No developers. No data scientists. No machine learning experience. Just your website content and few minutes.
          </p>
        </div>

        {/* Two-column layout */}
        <div className="flex flex-col lg:flex-row gap-16 lg:gap-24 items-stretch">

          {/* ── LEFT: sticky visual preview (desktop only) ──────────────────── */}
          <div className="hidden lg:flex w-full lg:w-[48%] flex-col relative self-stretch">

            <div className="sticky top-[calc(50vh-250px)] w-full aspect-square max-w-[550px] mx-auto overflow-hidden">

              {/* Sliding track: 300% wide, each panel is 1/3 (= card width) */}
              <div
                className="flex h-full w-[300%] transition-transform duration-700 ease-in-out will-change-transform"
                style={{ transform: `translate3d(-${(activeStep - 1) * 33.333}%, 0, 0)` }}
              >
                {[1, 2, 3].map((id) => (
                  <div
                    key={id}
                    className="w-1/3 h-full shrink-0 flex items-center justify-center"
                  >
                    {renderPreview(id, false, activeStep === id)}
                  </div>
                ))}
              </div>

              {/* ── Shared engine overlay ────────────────────────────────────
                  Positioned on the CARD (not a slide) so it can animate
                  across slides without a jump.

                  Two layers:
                    outer div  — CSS transition on `left` for the slide motion
                    inner div  — framer-motion for enter/exit opacity+scale
                                 (avoids transform conflict with -translate-x/y)
              ──────────────────────────────────────────────────────────────── */}
              <div
                className="absolute top-[50%] z-30 pointer-events-none -translate-x-1/2 -translate-y-1/2 w-[22%] aspect-square"
                style={{
                  left: activeStep === 2 ? "20%" : "80%",
                  transition: "left 700ms cubic-bezier(0.32, 0.94, 0.6, 1)",
                }}
              >
                <AnimatePresence>
                  {activeStep < 3 && (
                    <motion.div
                      key="engine-overlay"
                      initial={{ opacity: 0, scale: 0.75 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.75 }}
                      transition={{ duration: 0.35, ease: "easeOut" }}
                      className="relative w-full h-full flex flex-col items-center"
                    >
                      <EngineLogoNode phase={activeStep === 2 ? step2Phase : undefined} />
                      <span className="absolute top-[115%] left-1/2 -translate-x-1/2 text-[9px] font-mono font-bold tracking-wider text-slate-400 dark:text-slate-500 uppercase whitespace-nowrap select-none">
                        Sapy Engine
                      </span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

            </div>
          </div>

          {/* ── RIGHT: scrolling step cards ─────────────────────────────────── */}
          <div className="w-full lg:w-[52%] flex flex-col gap-8">
            {PIPELINE_STEPS.map((s) => {
              const isActive = activeStep === s.id;
              return (
                <div
                  key={s.id}
                  ref={(el) => { stepRefs.current[s.id - 1] = el; }}
                  onClick={() => handleStepClick(s.id)}
                  className={`group relative p-5 sm:p-8 rounded-2xl sm:rounded-3xl transition-all duration-500 cursor-pointer flex flex-col gap-4 ${isActive
                      ? "bg-white dark:bg-slate-950"
                      : "bg-slate-50/40 dark:bg-slate-900/10"
                    }`}
                >

                  {/* Header row */}
                  <div className="flex items-center justify-between">
                    <span
                      className={`font-mono text-sm font-bold uppercase tracking-widest transition-colors duration-300 ${isActive
                          ? "text-blue-600 dark:text-blue-400"
                          : "text-slate-400 dark:text-slate-600"
                        }`}
                    >
                      Step {s.step} · {s.label}
                    </span>
                    <span
                      className={`material-symbols-outlined text-[20px] transition-all duration-300 ${isActive
                          ? "text-blue-500 translate-x-0"
                          : "text-slate-300 dark:text-slate-700 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0"
                        }`}
                    >
                      chevron_right
                    </span>
                  </div>

                  {/* Title & description */}
                  <div className="space-y-2">
                    <h3
                      className={`text-2xl font-google font-bold leading-tight transition-colors duration-300 ${isActive
                          ? "text-slate-900 dark:text-white"
                          : "text-slate-500 dark:text-slate-500"
                        }`}
                    >
                      {s.title}
                    </h3>
                    <p
                      className={`text-base font-google leading-relaxed transition-colors duration-300 ${isActive
                          ? "text-slate-600 dark:text-slate-400"
                          : "text-slate-400 dark:text-slate-600"
                        }`}
                    >
                      {s.description}
                    </p>
                  </div>

                  {/* Expandable: bullets + mobile preview — a real accordion
                      (only the active step is mounted, for performance).
                      Mobile: the OPENING card eases smoothly (ease-in-out), but
                      the CLOSING card collapses instantly — that instant collapse
                      is what activateStep scroll-pins, so the header never moves
                      while the active card eases open downward beneath it.
                      Desktop (lg+): smooth animated accordion both ways. */}
                  <div
                    className={`grid lg:transition-all lg:duration-500 lg:ease-in-out ${
                      isActive
                        ? "transition-all duration-300 ease-in-out grid-rows-[1fr] opacity-100 mt-2"
                        : "grid-rows-[0fr] opacity-0 mt-0"
                    }`}
                  >
                    <div className="overflow-hidden flex flex-col gap-6">
                      <ul className="space-y-2.5">
                        {s.bullets.map((b) => (
                          <li
                            key={b}
                            className="flex items-center gap-3 text-sm font-google text-slate-600 dark:text-slate-400"
                          >
                            <span className="material-symbols-outlined text-[16px] text-emerald-500 shrink-0">
                              check_circle
                            </span>
                            <span>{b}</span>
                          </li>
                        ))}
                      </ul>

                      {/* Mobile preview — hidden on lg+ where the sticky panel handles it */}
                      <div className="lg:hidden aspect-square w-full sm:max-w-full md:max-w-[380px] mx-auto overflow-hidden flex items-center justify-center">
                        <div className="relative w-full h-full">
                          {renderPreview(s.id, true, activeStep === s.id)}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

        </div>
      </div>
    </section>
  );
}
