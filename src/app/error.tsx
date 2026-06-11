'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';

import Image from 'next/image';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Structured payload for whatever monitoring backend lands later (Sentry,
    // Logtail, etc.). Until then, console.error keeps the trace visible in
    // dev tools and any platform log drain.
    const payload = {
      message: error.message,
      digest: error.digest,
      stack: error.stack,
      url: typeof window !== 'undefined' ? window.location.href : undefined,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
      ts: new Date().toISOString(),
    };
    console.error('[app:error-boundary]', payload);
    // Hook point for Sentry: window.Sentry?.captureException(error, { extra: payload });
  }, [error]);

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 flex items-center justify-center p-6 relative overflow-hidden transition-colors">
      {/* Background Decor */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full pointer-events-none z-0">
        <div className="absolute top-[20%] left-[10%] w-[40%] h-[40%] bg-rose-500/5 dark:bg-rose-500/10 blur-[120px] rounded-full"></div>
        <div className="absolute bottom-[20%] right-[10%] w-[30%] h-[30%] bg-indigo-500/5 dark:bg-indigo-500/10 blur-[120px] rounded-full"></div>
      </div>

      <div className="max-w-xl w-full relative z-10 text-center space-y-12">
        {/* Error Illustration / Icon */}
        <div className="anim-err-fade-scale relative inline-block">
          <div className="absolute -inset-4 bg-rose-500/10 dark:bg-rose-500/20 blur-2xl rounded-full animate-pulse"></div>
          <div className="relative bg-white dark:bg-slate-900 border border-rose-100 dark:border-rose-900/50 p-8 rounded-3xl shadow-2xl">
            <span className="material-symbols-outlined text-[64px] text-rose-500">error</span>
          </div>
        </div>

        {/* Text Content */}
        <div className="space-y-4">
          <h1 className="anim-err-fade-up text-5xl md:text-7xl font-display font-black tracking-tight leading-none text-slate-900 dark:text-slate-200">
            Sapybase <span className="text-rose-500 underline decoration-rose-500/30 underline-offset-8">Interrupted.</span>
          </h1>
          <p
            style={{ animationDelay: '0.1s' }}
            className="anim-err-fade-up text-base text-slate-500 leading-relaxed dark:text-slate-400 max-w-md mx-auto"
          >
            We encountered an unexpected architectural breach. The system has been notified and we're working to restore stability.
          </p>
        </div>

        {/* Error Details (Minimalist Code Block) */}
        <div
          style={{ animationDelay: '0.2s' }}
          className="anim-err-fade bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 font-mono text-left max-w-md mx-auto shadow-sm"
        >
          <div className="flex items-center gap-2 mb-3 border-b border-slate-200 dark:border-slate-800 pb-3">
            <Image src="/logo2.svg" className="w-4 h-4 object-contain" alt="Sapybase" width={16} height={16} />
            <span className="text-[10px] uppercase tracking-widest font-bold text-slate-400 font-sans">Runtime_Exception</span>
          </div>
          <p className="text-sm font-medium text-rose-500/80 dark:text-rose-400 break-words">
            {error.message || "Unknown Runtime Error"}
          </p>
          {error.digest && (
            <p className="text-[10px] text-slate-400 mt-2">
              Digest: {error.digest}
            </p>
          )}
        </div>

        {/* Actions */}
        <div
          style={{ animationDelay: '0.3s', '--err-rise': '20px' } as React.CSSProperties}
          className="anim-err-fade-up flex flex-col sm:flex-row gap-4 justify-center items-center"
        >
          <button
            onClick={() => reset()}
            className="flex items-center gap-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-8 py-4 rounded-2xl font-bold font-sans hover:bg-slate-800 dark:hover:bg-slate-50 transition-all active:scale-95 shadow-xl shadow-slate-200/50 dark:shadow-none"
          >
            <span className="material-symbols-outlined text-[18px]">refresh</span> Retry Operation
          </button>
          <Link
            href="/"
            className="flex items-center gap-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 px-8 py-4 rounded-2xl font-bold font-sans hover:bg-slate-50 dark:hover:bg-slate-900 transition-all"
          >
            <span className="material-symbols-outlined text-[18px]">home</span> Emergency Exit
          </Link>
        </div>
      </div>
    </div>
  );
}
