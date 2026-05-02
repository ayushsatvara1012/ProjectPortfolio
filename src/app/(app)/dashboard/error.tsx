'use client';

import { useEffect } from 'react';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[dashboard:error]', error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 p-8 text-center">
      <span className="material-symbols-outlined text-[48px] text-slate-300 dark:text-slate-600">error</span>
      <div className="space-y-2">
        <h2 className="text-lg font-display font-semibold text-slate-800 dark:text-slate-200">
          Something went wrong
        </h2>
        <p className="text-sm font-display text-slate-500 dark:text-slate-400 max-w-sm">
          This page failed to load. Your data is safe — try again or refresh the page.
        </p>
        {error.digest && (
          <p className="text-xs font-mono text-slate-400 dark:text-slate-600">
            Error ID: {error.digest}
          </p>
        )}
      </div>
      <button
        onClick={reset}
        className="px-5 py-2.5 text-sm font-display font-semibold border border-gray-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
      >
        Try again
      </button>
    </div>
  );
}
