'use client';

import { useEffect, useRef } from 'react';

type AlertType = 'success' | 'error' | 'warning' | 'development';

type AlertProps = {
  message?: string;
  isOpen: boolean;
  onClose: () => void;
  title?: string; // accepted for backwards compat, not rendered in minimal toast
  type?: AlertType;
  duration?: number; // ms — drives progress bar + auto-dismiss (default 6000)
};

const TYPE_STYLE: Record<AlertType, { dot: string; bar: string }> = {
  success:     { dot: 'bg-emerald-400', bar: 'bg-emerald-500' },
  error:       { dot: 'bg-red-400',     bar: 'bg-red-500'     },
  warning:     { dot: 'bg-amber-400',   bar: 'bg-amber-500'   },
  development: { dot: 'bg-blue-400',    bar: 'bg-blue-500'    },
};

export default function Alert({
  message,
  isOpen,
  onClose,
  type = 'success',
  duration = 6000,
  title: _title, // unused — minimal toast has no title
}: AlertProps) {
  // Keep a stable ref to onClose so the timer never resets just because the
  // parent re-renders and passes a new inline arrow function reference.
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; });

  useEffect(() => {
    if (!isOpen) return;
    const t = setTimeout(() => onCloseRef.current(), duration);
    return () => clearTimeout(t);
  }, [isOpen, duration]); // onClose excluded intentionally — handled via ref above

  if (!isOpen) return null;

  const s = TYPE_STYLE[type] ?? TYPE_STYLE.success;

  return (
    <div className="fixed top-20 right-5 z-[55] animate-in fade-in slide-in-from-right-4 duration-300">
      <div className="relative flex items-center gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-lg shadow-black/10 dark:shadow-black/40 px-4 py-3.5 min-w-[300px] max-w-[400px] overflow-hidden">

        {/* Coloured dot indicator */}
        <span className={`w-2 h-2 rounded-full shrink-0 ${s.dot}`} />

        {/* Message */}
        <p className="flex-1 text-sm font-medium font-google text-slate-700 dark:text-slate-200 leading-snug">
          {message}
        </p>

        {/* Close button */}
        <button
          onClick={onClose}
          className="shrink-0 ml-1 w-6 h-6 flex items-center justify-center rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <span className="material-symbols-outlined text-[14px]">close</span>
        </button>

        {/* Progress bar — drains left→right over `duration` ms */}
        <div
          className={`absolute bottom-0 left-0 w-full h-[2px] origin-left ${s.bar}`}
          style={{ animation: `alertBarShrink ${duration}ms linear forwards` }}
        />
      </div>
    </div>
  );
}
