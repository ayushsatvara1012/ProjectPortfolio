import React from 'react';
import { X, CheckCircle2, AlertCircle, AlertTriangle } from 'lucide-react';

const Alert = ({ message, isOpen, onClose, title, type = 'success' }) => {
  if (!isOpen) return null;

  // Configuration for different alert styles
  const styles = {
    success: {
      container: "border-emerald-200 bg-emerald",
      iconBg: "bg-emerald-100",
      iconColor: "text-emerald-600",
      icon: <CheckCircle2 className="w-6 h-6 text-emerald-600" />,
      defaultTitle: "Success"
    },
    error: {
      container: "border-red-200 bg-red",
      iconBg: "bg-red-100",
      iconColor: "text-red-600",
      icon: <AlertCircle className="w-6 h-6 text-red-600" />,
      defaultTitle: "Error"
    },
    warning: {
      container: "border-amber-200 bg-amber",
      iconBg: "bg-amber-100",
      iconColor: "text-amber-600",
      icon: <AlertTriangle className="w-6 h-6 text-amber-600" />,
      defaultTitle: "Warning"
    },
    development: {
      container: "border-blue-200 bg-blue",
      iconBg: "bg-blue-100",
      iconColor: "text-blue-600",
      icon: <AlertCircle className="w-6 h-6 text-blue-600" />,
      defaultTitle: "Development"
    }
  };

  const currentStyle = styles[type] || styles.success;

  return (
    <div className="fixed top-20 right-5 z-50 animate-in fade-in slide-in-from-right-4 duration-300">
      <div className={`transition-all duration-300 flex items-center gap-4 p-4 rounded-2xl shadow-2xl border backdrop-blur-sm min-w-[320px] ${currentStyle.container}`}>
        
        {/* Dynamic Icon */}
        <div className={`shrink-0 w-10 h-10 flex items-center justify-center rounded-full ${currentStyle.iconBg}`}>
          {currentStyle.icon}
        </div>

        {/* Content */}
        <div className="flex-1">
          <h3 className="text-md text-slate-900 font-bold font-sans">
            {title || currentStyle.defaultTitle}
          </h3>
          <p className="text-md font-sans text-slate-600 font-medium mt-0.5">{message}</p>
        </div>

        {/* Close Button */}
        <button onClick={onClose} className="p-1 hover:bg-black/5 rounded-md transition-colors">
          <X className="w-4 h-4 text-slate-400" />
        </button>
      </div>
    </div>
  );
};

export default Alert;