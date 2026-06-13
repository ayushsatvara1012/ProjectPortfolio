'use client';

import { useState } from 'react';
import Link from 'next/link';

// ─────────────────────────────────────────────────────────────────────────────
// Embedded "Final Step: Integration" snippet shown inside the dashboard after a
// bot is created (see dashboard/register). The full product manual now lives in
// VaayuDocs (rendered at /docs).
// ─────────────────────────────────────────────────────────────────────────────

type Props = { apiKey?: string; apiUrl?: string };

const BotIntegrationDocs = ({ apiKey = 'YOUR_BOT_ID' }: Props) => {
  const [copied, setCopied] = useState(false);

  const code = `<!-- Paste before </body> on every page -->\n<script src="https://www.sapybase.com/sapybase-loader@1.js"\n        data-bot-id="${apiKey}"\n        defer></script>`;

  const handleCopy = () => {
    const done = () => { setCopied(true); setTimeout(() => setCopied(false), 2000); };
    const fallback = () => {
      const ta = document.createElement('textarea');
      ta.value = code; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta); return ok;
    };
    try {
      if (navigator.clipboard) {
        navigator.clipboard.writeText(code).then(done).catch(() => { if (fallback()) done(); });
      } else if (fallback()) done();
    } catch { fallback(); }
  };

  return (
    <div className="bg-white dark:bg-white/[0.02] rounded-2xl border border-slate-100 dark:border-white/[0.04] p-6 transition-colors duration-500">
      <div className="flex items-center gap-2.5 mb-4">
        <span className="material-symbols-outlined text-[20px] text-slate-500 dark:text-slate-400">rocket_launch</span>
        <h3 className="text-lg md:text-xl lg:text-2xl font-medium tracking-tight text-slate-900 dark:text-slate-200">Final Step: Integration</h3>
      </div>
      <p className="text-sm lg:text-base font-normal text-slate-600 dark:text-slate-400 lg:text-slate-700 lg:dark:text-slate-300 leading-relaxed mb-4">
        Copy the snippet below and paste it before <code className="px-1.5 py-0.5 bg-slate-100 dark:bg-white/[0.04] rounded-lg text-xs font-mono">&lt;/body&gt;</code> on every page. Need help?{' '}
        <Link href="/docs" className="font-semibold text-slate-700 dark:text-slate-300 underline underline-offset-4 hover:text-slate-900 dark:hover:text-slate-100 transition-colors">Full guide →</Link>
      </p>

      <div className="rounded-2xl overflow-hidden bg-slate-900 dark:bg-slate-950 border border-white/[0.06]">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.06]">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-700" />
            <span className="w-2.5 h-2.5 rounded-full bg-slate-700" />
            <span className="w-2.5 h-2.5 rounded-full bg-slate-700" />
          </div>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium tracking-wider uppercase text-slate-400 dark:text-slate-500 hover:text-slate-200 bg-white/[0.04] hover:bg-white/[0.08] rounded-lg transition-colors"
          >
            <span className="material-symbols-outlined text-[13px]">{copied ? 'check' : 'content_copy'}</span>
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
        <div className="p-4 overflow-x-auto custom-scrollbar">
          <pre className="m-0 text-[12px] sm:text-[13px] leading-relaxed font-mono text-slate-300 whitespace-pre">{code}</pre>
        </div>
      </div>
    </div>
  );
};

export default BotIntegrationDocs;
