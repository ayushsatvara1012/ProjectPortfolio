'use client';

import React, { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Standard error reporting hook point
    console.error('[global-error-boundary]', error);
  }, [error]);

  return (
    <html lang="en">
      <body className="bg-white dark:bg-slate-950 flex items-center justify-center min-h-screen p-6 font-sans">
        <div className="max-w-md w-full text-center space-y-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-rose-50 dark:bg-rose-900/20 rounded-full mb-4">
            <span className="material-symbols-outlined text-4xl text-rose-600 dark:text-rose-400">terminal</span>
          </div>
          <h1 className="text-4xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
            System Failure
          </h1>
          <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
            A critical error occurred in the application root. We've been notified and are investigating the breach.
          </p>
          <div className="pt-4">
            <button
              onClick={() => reset()}
              className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-8 py-4 rounded-xl font-bold hover:opacity-90 transition-all"
            >
              Restart System
            </button>
          </div>
          <div className="mt-8 pt-8 border-t border-slate-100 dark:border-slate-800">
            <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400">
              Diagnostic_Code: {error.digest || 'ROOT_CRASH'}
            </p>
          </div>
        </div>
      </body>
    </html>
  );
}
