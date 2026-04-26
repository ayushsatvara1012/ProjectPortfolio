'use client';

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

type ToastKind = 'success' | 'error' | 'info' | 'warning';
type Toast = { id: number; kind: ToastKind; message: string };

type ToastContextValue = {
  showToast: (kind: ToastKind, message: string) => void;
};

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

const KIND_STYLE: Record<ToastKind, string> = {
  success: 'bg-emerald-600 text-white',
  error: 'bg-red-600 text-white',
  info: 'bg-slate-900 text-white',
  warning: 'bg-amber-500 text-white',
};

export const ToastProvider = ({ children }: { children: React.ReactNode }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((kind: ToastKind, message: string) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, kind, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  }, []);

  // Bridge: any code (including non-React modules like useAuthenticatedFetch's
  // 401/403 events) can dispatch a window event to surface a toast.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ kind?: ToastKind; message?: string }>).detail;
      if (detail?.message) showToast(detail.kind || 'info', detail.message);
    };
    window.addEventListener('sapybase:toast', handler);
    return () => window.removeEventListener('sapybase:toast', handler);
  }, [showToast]);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed bottom-6 right-6 z-[1000] flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`px-4 py-3 text-sm font-display shadow-lg pointer-events-auto max-w-sm ${KIND_STYLE[t.kind]}`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
};
