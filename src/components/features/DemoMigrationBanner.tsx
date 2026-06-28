'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

// Surfaces a one-time prompt when a freshly-signed-up user lands on /dashboard
// with leftover demo data in sessionStorage. Lets them carry the demo bot's
// name/theme into the register flow, or discard the demo state entirely.
// No-ops when there is no demo data, so it's safe to mount unconditionally.
const DEMO_KEYS = ['demo_bot_config', 'demo_knowledge_chunks', 'demo_trained', 'demo_chat_messages'];
const DISMISSED_KEY = 'sb_demo_banner_dismissed';

export default function DemoMigrationBanner() {
  const router = useRouter();
  const [hasDemo, setHasDemo] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (sessionStorage.getItem(DISMISSED_KEY) === '1') return;
    const raw = sessionStorage.getItem('demo_bot_config');
    setHasDemo(!!raw);
  }, []);

  if (!hasDemo) return null;

  const handleImport = () => {
    // Pass the demo flag to /dashboard/register so it can pre-fill from
    // sessionStorage. Server endpoint to actually import demo knowledge is a
    // follow-up; this preserves the user's bot identity at minimum.
    router.push('/dashboard/register?from=demo');
    sessionStorage.setItem(DISMISSED_KEY, '1');
  };

  const handleDiscard = () => {
    DEMO_KEYS.forEach((k) => sessionStorage.removeItem(k));
    sessionStorage.setItem(DISMISSED_KEY, '1');
    setHasDemo(false);
  };

  return (
    <div className="bg-blue-50 dark:bg-blue-950/30 border-b border-blue-100 dark:border-blue-900/40 px-6 py-3 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
      <p className="text-sm font-display text-slate-700 dark:text-slate-300">
        We saved your demo bot from earlier. Want to bring it into your account?
      </p>
      <div className="flex gap-2">
        <button
          onClick={handleImport}
          className="px-4 py-2 text-[10px] uppercase tracking-widest font-bold font-sans bg-slate-900 dark:bg-blue-600 text-white hover:bg-slate-800 dark:hover:bg-blue-500 transition-colors cursor-pointer"
        >
          Import demo bot
        </button>
        <button
          onClick={handleDiscard}
          className="px-4 py-2 text-[10px] uppercase tracking-widest font-bold font-sans border border-gray-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
        >
          Discard
        </button>
      </div>
    </div>
  );
}
