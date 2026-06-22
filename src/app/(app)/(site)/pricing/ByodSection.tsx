'use client';

/* ─────────────────────────────────────────────────────────────────────────────
   BYOD — "Bring Your Own Database" enterprise tier.
   Full-width horizontal section shown BELOW the Starter / Growth / Scale cards
   on the marketing /pricing page. Theme-matched (font-display / font-google,
   material-symbols, dark mode, brand gradient) and responsive: stacks on mobile,
   splits identity | features horizontally from lg up.

   The CTA opens a "BYOD Plan Application" compose modal that lets the visitor
   send via Gmail / Outlook / Yahoo / their default mail app — the same provider
   picker used by the Action Center follow-up draft (ActionCenterPanel).
 ───────────────────────────────────────────────────────────────────────────── */

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';

// Sales contact — kept consistent with the page's other "Talk to Sales" /
// "Email Us" CTAs.
const SALES_EMAIL = 'ayushsatvara2002@gmail.com';

const BYOD_HIGHLIGHTS: { icon: string; label: string }[] = [
  { icon: 'database', label: 'Bring your own Postgres / Supabase' },
  { icon: 'security', label: 'Data stays in your infrastructure' },
  { icon: 'verified_user', label: 'Full data residency & compliance' },
  { icon: 'lan', label: 'Dedicated routing to your database' },
  { icon: 'monitoring', label: 'Live connection health monitoring' },
  { icon: 'speed', label: 'Transparent usage metering' },
  { icon: 'admin_panel_settings', label: 'Admin-managed onboarding' },
  { icon: 'support_agent', label: 'Priority enterprise support' },
];

const DEFAULT_SUBJECT = 'BYOD Plan Application';
const DEFAULT_BODY =
  `Hi Vaayu team,\n\n` +
  `I'd like to apply for the BYOD (Bring Your Own Database) plan for my organisation.\n\n` +
  `Organisation:\n` +
  `Website:\n` +
  `Database (Postgres / Supabase / other):\n` +
  `Expected bots:\n` +
  `Expected monthly messages:\n` +
  `Data residency / compliance needs:\n` +
  `Anything else:\n\n` +
  `Thanks!`;

export default function ByodSection() {
  const [open, setOpen] = useState(false);
  const [fromEmail, setFromEmail] = useState('');
  const [subject, setSubject] = useState(DEFAULT_SUBJECT);
  const [body, setBody] = useState(DEFAULT_BODY);
  const [copied, setCopied] = useState(false);
  const [showProviders, setShowProviders] = useState(false);

  // Reset the draft each time the modal opens, and close it on Escape.
  useEffect(() => {
    if (!open) return;
    setSubject(DEFAULT_SUBJECT);
    setBody(DEFAULT_BODY);
    setCopied(false);
    setShowProviders(false);
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  // Fold the optional reply-to address into the body so the recipient knows who
  // applied (mailto/compose links can't set the From header).
  const composedBody = fromEmail.trim()
    ? `Reply to: ${fromEmail.trim()}\n\n${body}`
    : body;

  const toStr = encodeURIComponent(SALES_EMAIL);
  const subStr = encodeURIComponent(subject);
  const bodyStr = encodeURIComponent(composedBody);
  const mailto = `mailto:${SALES_EMAIL}?subject=${subStr}&body=${bodyStr}`;
  const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${toStr}&su=${subStr}&body=${bodyStr}`;
  const outlookUrl = `https://outlook.live.com/mail/0/deeplink/compose?to=${toStr}&subject=${subStr}&body=${bodyStr}`;
  const yahooUrl = `https://compose.mail.yahoo.com/?to=${toStr}&subject=${subStr}&body=${bodyStr}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(`${subject}\n\n${composedBody}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      <motion.section
        aria-label="BYOD — Bring Your Own Database"
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-60px' }}
        transition={{ duration: 0.5 }}
        className="relative mt-6 overflow-hidden rounded-2xl border border-gray-200 dark:border-slate-800/60 bg-white dark:bg-white/[0.02] backdrop-blur-sm shadow-sm transition-all duration-300 hover:border-gray-300 dark:hover:border-slate-700 hover:shadow-lg dark:hover:shadow-slate-950/20"
      >
        {/* Brand accent rail */}
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-blue-600 to-green-600" />

        <div className="flex flex-col lg:flex-row">
          {/* LEFT — identity + price + CTA */}
          <div className="flex flex-col gap-5 p-7 sm:p-8 lg:w-[38%] lg:shrink-0 border-b lg:border-b-0 lg:border-r border-gray-200 dark:border-slate-800/60">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-green-600 text-white shadow-lg shadow-blue-500/20">
                <span className="material-symbols-outlined text-[20px]">database</span>
              </div>
              <div className="flex flex-col items-start gap-1.5">
                <h3 className="text-lg font-display font-bold uppercase tracking-wide text-slate-900 dark:text-slate-100">BYOD</h3>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 dark:bg-white px-3 py-1">
                  <span className="material-symbols-outlined text-[12px] text-white dark:text-slate-900">workspace_premium</span>
                  <span className="text-[10px] font-display font-bold uppercase tracking-widest text-white dark:text-slate-900">Enterprise</span>
                </span>
              </div>
            </div>

            <p className="text-sm font-google text-slate-600 dark:text-slate-400 leading-relaxed">
              Bring Your Own Database — run Vaayu on top of{' '}
              <span className="font-semibold text-slate-800 dark:text-slate-200">your own Postgres or Supabase.</span>{' '}
              Your data never leaves your infrastructure, with dedicated routing, metering and full compliance control.
            </p>

            <div className="flex items-end gap-2">
              <span className="text-4xl sm:text-5xl font-display font-black text-slate-900 dark:text-slate-100">Custom</span>
              <span className="mb-1.5 text-sm font-google text-slate-500 dark:text-slate-400">tailored to your scale</span>
            </div>

            <button
              type="button"
              onClick={() => setOpen(true)}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-blue-600 to-green-600 px-6 py-4 text-sm font-display font-bold uppercase tracking-widest text-white transition-all duration-200 hover:opacity-90 active:scale-[0.98] shadow-lg shadow-blue-500/10"
            >
              <span className="material-symbols-outlined text-[16px]">mail</span>
              Contact us
              <ArrowRight size={14} />
            </button>

            <div className="flex items-start gap-1.5">
              <span className="material-symbols-outlined text-[14px] text-slate-400 dark:text-slate-500 shrink-0">lock</span>
              <span className="text-[11px] font-google text-slate-500 dark:text-slate-400 leading-relaxed">
                You own and control the data layer — we never store your conversations.
              </span>
            </div>
          </div>

          {/* RIGHT — feature highlights */}
          <div className="flex-1 p-7 sm:p-8">
            <div className="mb-5 flex items-center gap-2">
              <span className="material-symbols-outlined text-[14px] text-slate-400 dark:text-slate-500">auto_awesome</span>
              <span className="text-[10px] font-display font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">What's included</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {BYOD_HIGHLIGHTS.map(f => (
                <div
                  key={f.label}
                  className="flex items-center gap-3 rounded-full border border-gray-200 dark:border-slate-800/60 bg-slate-50/60 dark:bg-white/[0.02] px-4 py-2.5 transition-colors hover:border-gray-300 dark:hover:border-slate-700"
                >
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 dark:bg-white/[0.06]">
                    <span className="material-symbols-outlined text-[15px] text-slate-600 dark:text-slate-400">{f.icon}</span>
                  </div>
                  <span className="text-sm font-google font-medium text-slate-700 dark:text-slate-300 leading-tight">{f.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </motion.section>

      {/* BYOD Plan Application — compose modal */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-3 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label="BYOD plan application"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col h-[85vh] max-h-[800px]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-blue-500">database</span>
                <span className="text-[14px] font-semibold text-slate-900 dark:text-slate-100">BYOD plan application</span>
              </div>
              <button onClick={() => setOpen(false)} aria-label="Close" className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="flex flex-col flex-1 overflow-hidden">
              <div className="flex items-center border-b border-slate-100 dark:border-slate-800 px-6 py-3">
                <span className="text-slate-400 text-[13px] w-20 shrink-0">To</span>
                <div className="flex-1 text-[14px] font-medium text-slate-800 dark:text-slate-200 truncate">{SALES_EMAIL}</div>
              </div>
              <div className="flex items-center border-b border-slate-100 dark:border-slate-800 px-6 py-3">
                <span className="text-slate-400 text-[13px] w-20 shrink-0">Your email</span>
                <input
                  type="email"
                  value={fromEmail}
                  onChange={(e) => setFromEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="flex-1 bg-transparent text-[14px] text-slate-800 dark:text-slate-200 focus:outline-none placeholder:text-slate-400 dark:placeholder:text-slate-600"
                />
              </div>
              <div className="flex items-center border-b border-slate-100 dark:border-slate-800 px-6 py-3">
                <span className="text-slate-400 text-[13px] w-20 shrink-0">Subject</span>
                <input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Email subject…"
                  className="flex-1 bg-transparent text-[14px] font-semibold text-slate-900 dark:text-slate-100 focus:outline-none placeholder:text-slate-400 dark:placeholder:text-slate-600"
                />
              </div>
              <div className="flex-1 p-6 overflow-hidden">
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Tell us about your setup…"
                  className="w-full h-full bg-transparent text-[14.5px] leading-relaxed text-slate-700 dark:text-slate-300 focus:outline-none resize-none custom-scrollbar"
                />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3 bg-slate-50/50 dark:bg-slate-900">
              <button type="button" onClick={handleCopy} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 px-4 py-2 text-[13px] font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                <span className="material-symbols-outlined text-[16px]">content_copy</span>{copied ? 'Copied!' : 'Copy draft'}
              </button>
              <div className="relative">
                <button type="button" onClick={() => setShowProviders((p) => !p)} aria-expanded={showProviders} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-700 px-5 py-2 text-[13px] font-semibold text-white transition-colors">
                  <span className="material-symbols-outlined text-[16px]">send</span>Send via…
                  <span className="material-symbols-outlined text-[16px]">{showProviders ? 'expand_more' : 'expand_less'}</span>
                </button>
                {showProviders && (
                  <div className="absolute bottom-full right-0 mb-2 w-48 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl overflow-hidden z-10 flex flex-col py-1">
                    {[{ href: gmailUrl, icon: 'mail', label: 'Gmail' }, { href: outlookUrl, icon: 'forward_to_inbox', label: 'Outlook' }, { href: yahooUrl, icon: 'email', label: 'Yahoo Mail' }].map((p) => (
                      <a key={p.label} href={p.href} target="_blank" rel="noopener noreferrer" onClick={() => setOpen(false)} className="px-4 py-2 text-[13px] text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 flex items-center gap-2 transition-colors">
                        <span className="material-symbols-outlined text-[16px]">{p.icon}</span>{p.label}
                      </a>
                    ))}
                    <div className="h-px bg-slate-100 dark:bg-slate-700 my-1" />
                    <a href={mailto} onClick={() => setOpen(false)} className="px-4 py-2 text-[13px] text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 flex items-center gap-2 transition-colors">
                      <span className="material-symbols-outlined text-[16px]">devices</span>Default mail app
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
