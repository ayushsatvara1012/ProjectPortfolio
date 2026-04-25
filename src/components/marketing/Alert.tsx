'use client';

import React from 'react';

interface AlertProps {
    message: string;
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    type?: 'success' | 'error' | 'warning' | 'development';
}

const Alert: React.FC<AlertProps> = ({ message, isOpen, onClose, title, type = 'success' }) => {
  if (!isOpen) return null;

  // Configuration for different alert styles
  const styles = {
    success: {
      container: "border-emerald-200 bg-white dark:border-emerald-900/50 dark:bg-slate-950",
      iconBg: "bg-emerald-100 dark:bg-emerald-900/40",
      iconColor: "text-emerald-600 dark:text-emerald-400",
      icon: <span className="material-symbols-outlined text-lg text-emerald-600 dark:text-emerald-400">check_circle</span>,
      defaultTitle: "Success"
    },
    error: {
      container: "border-red-200 bg-white dark:border-red-900/50 dark:bg-slate-950",
      iconBg: "bg-red-100 dark:bg-red-900/40",
      iconColor: "text-red-600 dark:text-red-400",
      icon: <span className="material-symbols-outlined text-lg font-semibold text-red-600 dark:text-red-400">error</span>,
      defaultTitle: "Error"
    },
    warning: {
      container: "border-amber-200 bg-white dark:border-amber-900/50 dark:bg-slate-950",
      iconBg: "bg-amber-100 dark:bg-amber-900/40",
      iconColor: "text-amber-600 dark:text-amber-400",
      icon: <span className="material-symbols-outlined text-lg text-amber-600 dark:text-amber-400">warning</span>,
      defaultTitle: "Warning"
    },
    development: {
      container: "border-blue-200 bg-white dark:border-blue-900/50 dark:bg-slate-950",
      iconBg: "bg-blue-100 dark:bg-blue-900/40",
      iconColor: "text-blue-600 dark:text-blue-400",
      icon: <span className="material-symbols-outlined text-lg text-blue-600 dark:text-blue-400">info</span>,
      defaultTitle: "Development"
    }
  };

  const currentStyle = styles[type] || styles.success;

  return (
    <div className="fixed top-20 right-5 z-[100] animate-in fade-in slide-in-from-right-4 duration-300">
      <div className={`transition-all duration-300 flex items-center gap-4 p-4 rounded-2xl shadow-2xl border min-w-[320px] ${currentStyle.container}`}>
        
        {/* Dynamic Icon */}
        <div className={`shrink-0 w-10 h-10 flex items-center justify-center rounded-full ${currentStyle.iconBg}`}>
          {currentStyle.icon}
        </div>

        {/* Content */}
        <div className="flex-1">
          <h3 className="text-lg text-slate-900 dark:text-slate-100 tracking-wider font-semibold font-sans">
            {title || currentStyle.defaultTitle}
          </h3>
          <p className="text-lg font-sans font-medium text-slate-800 dark:text-slate-300 mt-0.5">{message}</p>
        </div>

        {/* Close Button */}
        <button onClick={onClose} className="p-1 hover:bg-black/5 dark:hover:bg-white/5 rounded-md transition-colors flex items-center justify-center">
          <span className="material-symbols-outlined text-[16px] text-slate-400 dark:hover:text-white">close</span>
        </button>
      </div>
    </div>
  );
};

export default Alert;
