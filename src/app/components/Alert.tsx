'use client';

type AlertProps = {
  message?: string;
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  type?: 'success' | 'error' | 'warning' | 'development';
};

const STYLES = {
  success: {
    container: 'border-emerald-200 bg-white dark:border-emerald-900/50 dark:bg-slate-950',
    iconBg: 'bg-emerald-100 dark:bg-emerald-900/40',
    icon: 'check_circle',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
    defaultTitle: 'Success',
  },
  error: {
    container: 'border-red-200 bg-white dark:border-red-900/50 dark:bg-slate-950',
    iconBg: 'bg-red-100 dark:bg-red-900/40',
    icon: 'error',
    iconColor: 'text-red-600 dark:text-red-400',
    defaultTitle: 'Error',
  },
  warning: {
    container: 'border-amber-200 bg-white dark:border-amber-900/50 dark:bg-slate-950',
    iconBg: 'bg-amber-100 dark:bg-amber-900/40',
    icon: 'warning',
    iconColor: 'text-amber-600 dark:text-amber-400',
    defaultTitle: 'Warning',
  },
  development: {
    container: 'border-blue-200 bg-white dark:border-blue-900/50 dark:bg-slate-950',
    iconBg: 'bg-blue-100 dark:bg-blue-900/40',
    icon: 'info',
    iconColor: 'text-blue-600 dark:text-blue-400',
    defaultTitle: 'Info',
  },
} as const;

export default function Alert({ message, isOpen, onClose, title, type = 'success' }: AlertProps) {
  if (!isOpen) return null;
  const s = STYLES[type] ?? STYLES.success;

  return (
    <div className="fixed top-20 right-5 z-[55] animate-in fade-in slide-in-from-right-4 duration-300">
      <div className={`flex items-center gap-4 p-4 rounded-2xl shadow-2xl border min-w-[320px] ${s.container}`}>
        <div className={`shrink-0 w-10 h-10 flex items-center justify-center rounded-full ${s.iconBg}`}>
          <span className={`material-symbols-outlined text-lg ${s.iconColor}`}>{s.icon}</span>
        </div>
        <div className="flex-1">
          <h3 className="text-lg text-slate-900 dark:text-slate-100 tracking-wider font-semibold font-sans">
            {title || s.defaultTitle}
          </h3>
          <p className="text-lg font-sans font-medium text-slate-800 dark:text-slate-300 mt-0.5">{message}</p>
        </div>
        <button onClick={onClose} className="p-1 hover:bg-black/5 dark:hover:bg-white/5 rounded-md transition-colors flex items-center justify-center">
          <span className="material-symbols-outlined text-[16px] text-slate-400 dark:hover:text-white">close</span>
        </button>
      </div>
    </div>
  );
}
