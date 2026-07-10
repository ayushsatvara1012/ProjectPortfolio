import Link from 'next/link';

// Auth route group — no navbar/footer, centered on a blueprint-grid background.
// Applies to /sign-in/* and /sign-up/*.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen flex items-center justify-center bg-white dark:bg-slate-950 overflow-hidden">
      <Link
        href="/"
        className="absolute top-5 left-5 sm:top-6 sm:left-6 z-20 inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] font-medium text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 hover:bg-slate-100/70 dark:hover:bg-slate-800/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
      >
        <span className="material-symbols-outlined text-[18px] leading-none" aria-hidden>
          arrow_back
        </span>
        Back to home
      </Link>
      {/* Blueprint grid — matches Sapybase minimal aesthetic */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.25] dark:opacity-[0.15]"
        style={{
          backgroundImage:
            'linear-gradient(to right, rgb(226 232 240 / 1) 1px, transparent 1px), linear-gradient(to bottom, rgb(226 232 240 / 1) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
          maskImage:
            'radial-gradient(ellipse at center, black 40%, transparent 75%)',
          WebkitMaskImage:
            'radial-gradient(ellipse at center, black 40%, transparent 75%)',
        }}
      />
      <div className="relative z-10 w-full max-w-md px-6 py-12 flex items-center justify-center">
        {children}
      </div>
    </div>
  );
}
