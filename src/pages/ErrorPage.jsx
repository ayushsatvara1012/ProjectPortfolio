import React from 'react';
import { useRouteError, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AlertCircle, Home, RotateCcw } from 'lucide-react';

const ErrorPage = () => {
  const error = useRouteError();
  const navigate = useNavigate();

  console.error(error);

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 flex items-center justify-center p-6 relative overflow-hidden transition-colors">
      {/* Background Decor */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full pointer-events-none z-0">
        <div className="absolute top-[20%] left-[10%] w-[40%] h-[40%] bg-rose-500/5 dark:bg-rose-500/10 blur-[120px] rounded-full"></div>
        <div className="absolute bottom-[20%] right-[10%] w-[30%] h-[30%] bg-indigo-500/5 dark:bg-indigo-500/10 blur-[120px] rounded-full"></div>
      </div>

      <div className="max-w-xl w-full relative z-10 text-center space-y-12">
        {/* Error Illustration / Icon */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative inline-block"
        >
          <div className="absolute -inset-4 bg-rose-500/10 dark:bg-rose-500/20 blur-2xl rounded-full animate-pulse"></div>
          <div className="relative bg-white dark:bg-slate-900 border border-rose-100 dark:border-rose-900/50 p-8 rounded-3xl shadow-2xl">
            <AlertCircle size={64} className="text-rose-500" strokeWidth={1.5} />
          </div>
        </motion.div>

        {/* Text Content */}
        <div className="space-y-4">
          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl md:text-5xl font-black text-slate-900 dark:text-white"
          >
            Sapybase <span className="text-rose-500 underline decoration-rose-500/30 underline-offset-8">Interrupted.</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-slate-500 dark:text-slate-400 text-lg font-light max-w-md mx-auto"
          >
            We encountered an unexpected architectural breach or the page you're looking for has moved into a different dimension.
          </motion.p>
        </div>

        {/* Error Details (Minimalist Code Block) */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 font-mono text-left max-w-md mx-auto shadow-sm"
        >
          <div className="flex items-center gap-2 mb-3 border-b border-slate-200 dark:border-slate-800 pb-3">
            <img src="/sb_logo2.svg" className="w-4 h-4 block dark:hidden object-contain" alt="" />
            <img src="/sb_logo2_dark.svg" className="w-4 h-4 hidden dark:block object-contain" alt="" />
            <span className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Error_Report</span>
          </div>
          <p className="text-xs text-rose-500/80 dark:text-rose-400 font-medium leading-relaxed">
            {error.statusText || error.message || "Unknown Runtime Exception"}
          </p>
          {error.status && (
            <p className="text-[10px] text-slate-400 mt-2">
              Status_Code: {error.status}
            </p>
          )}
        </motion.div>

        {/* Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="flex flex-col sm:flex-row gap-4 justify-center items-center"
        >
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-8 py-4 rounded-2xl font-bold hover:bg-slate-800 dark:hover:bg-slate-50 transition-all active:scale-95 shadow-xl shadow-slate-200/50 dark:shadow-none"
          >
            <Home size={18} /> Return Home
          </button>
          <button
            onClick={() => window.location.reload()}
            className="flex items-center gap-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 px-8 py-4 rounded-2xl font-bold hover:bg-slate-50 dark:hover:bg-slate-900 transition-all"
          >
            <RotateCcw size={18} /> Retry System
          </button>
        </motion.div>
      </div>
    </div>
  );
};

export default ErrorPage;
