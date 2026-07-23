'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

// Fixed, top-left, theme-aware. Overview -> home; any detail route -> the map
// (natural hierarchy, keeps the immersive flow). Respects safe-area insets.
export default function BackControl() {
  const pathname = usePathname();
  const onOverview = pathname === '/architecture';
  const href = onOverview ? '/' : '/architecture';
  const label = onOverview ? 'Back to home' : 'Back to architecture';

  return (
    <Link
      href={href}
      aria-label={label}
      className="fixed left-[max(1rem,env(safe-area-inset-left))] top-[max(1rem,env(safe-area-inset-top))] z-50 inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white/80 px-3.5 py-2 text-sm font-medium text-slate-700 shadow-sm backdrop-blur transition-colors hover:bg-white dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-200 dark:hover:bg-slate-900"
    >
      <span className="material-symbols-outlined text-[18px] leading-none" aria-hidden>
        arrow_back
      </span>
      {label}
    </Link>
  );
}
