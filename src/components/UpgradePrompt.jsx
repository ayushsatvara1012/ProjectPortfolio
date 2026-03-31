import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowUpRight, Zap, X, Bot, MessageSquare, Database } from 'lucide-react';

const LIMIT_CONFIG = {
  BOT_LIMIT_EXCEEDED: {
    icon: Bot,
    title: 'Bot Limit Reached',
    accent: 'indigo',
    tip: (tier, limit) =>
      tier === 'TRIAL'
        ? `Your Trial plan includes 1 bot. Upgrade to Professional for 2 bots.`
        : tier === 'STARTER'
        ? `Your Professional plan supports 2 bots. Upgrade to Enterprise for up to 5 bots.`
        : `Your ${tier} plan supports ${limit} bot(s). Contact us for custom limits.`,
  },
  MESSAGE_LIMIT_EXCEEDED: {
    icon: MessageSquare,
    title: 'Monthly Message Limit Reached',
    accent: 'amber',
    tip: (tier, limit) =>
      `You've used all ${limit?.toLocaleString()} messages on your ${tier} plan this month. Upgrade for more.`,
  },
  CHUNK_LIMIT_EXCEEDED: {
    icon: Database,
    title: 'Knowledge Base Full',
    accent: 'rose',
    tip: (tier, limit) =>
      `Your ${tier} plan allows ${limit?.toLocaleString()} knowledge chunks. Upgrade to train on more data.`,
  },
  DEFAULT: {
    icon: Zap,
    title: 'Plan Limit Reached',
    accent: 'indigo',
    tip: () => 'You have reached a limit on your current plan. Upgrade to continue.',
  },
};

const ACCENT_STYLES = {
  indigo: {
    bg: 'bg-indigo-50 dark:bg-indigo-900/20',
    border: 'border-indigo-200 dark:border-indigo-800/50',
    icon: 'text-indigo-600 dark:text-indigo-400',
    iconBg: 'bg-indigo-100 dark:bg-indigo-900/40',
    btn: 'bg-indigo-600 hover:bg-indigo-700 dark:hover:bg-indigo-500',
    progress: 'bg-indigo-500',
  },
  amber: {
    bg: 'bg-amber-50 dark:bg-amber-900/20',
    border: 'border-amber-200 dark:border-amber-800/50',
    icon: 'text-amber-600 dark:text-amber-400',
    iconBg: 'bg-amber-100 dark:bg-amber-900/40',
    btn: 'bg-amber-600 hover:bg-amber-700 dark:hover:bg-amber-500',
    progress: 'bg-amber-500',
  },
  rose: {
    bg: 'bg-rose-50 dark:bg-rose-900/20',
    border: 'border-rose-200 dark:border-rose-800/50',
    icon: 'text-rose-600 dark:text-rose-400',
    iconBg: 'bg-rose-100 dark:bg-rose-900/40',
    btn: 'bg-rose-600 hover:bg-rose-700 dark:hover:bg-rose-500',
    progress: 'bg-rose-500',
  },
};

/**
 * UpgradePrompt — three display modes:
 *   mode="inline"  — banner inside a page section (default)
 *   mode="modal"   — centered overlay with backdrop
 *   mode="widget"  — compact version for bot card usage warnings
 */
const UpgradePrompt = ({
  code = 'DEFAULT',
  tier = '',
  current = null,
  limit = null,
  mode = 'inline',
  onDismiss = null,
}) => {
  const navigate = useNavigate();
  const config = LIMIT_CONFIG[code] || LIMIT_CONFIG.DEFAULT;
  const accent = ACCENT_STYLES[config.accent] || ACCENT_STYLES.indigo;
  const Icon = config.icon;
  const pct = current !== null && limit && limit < 999999
    ? Math.min((current / limit) * 100, 100)
    : null;

  const inner = (
    <div className={`${accent.bg} border ${accent.border} p-5 transition-colors`}>
      <div className="flex items-start gap-4">
        <div className={`w-10 h-10 shrink-0 flex items-center justify-center ${accent.iconBg} rounded-none`}>
          <Icon className={`w-5 h-5 ${accent.icon}`} />
        </div>

        <div className="flex-1 min-w-0">
          <p className={`text-sm font-display font-bold ${accent.icon} mb-0.5`}>{config.title}</p>
          <p className="text-sm text-slate-600 dark:text-slate-400 font-display leading-relaxed">
            {config.tip(tier, limit)}
          </p>

          {pct !== null && (
            <div className="mt-3">
              <div className="flex justify-between text-[10px] uppercase tracking-widest font-bold text-slate-400 dark:text-slate-500 font-sans mb-1">
                <span>{current?.toLocaleString()} used</span>
                <span>{limit?.toLocaleString()} limit</span>
              </div>
              <div className="h-1.5 bg-white dark:bg-slate-800 w-full">
                <div
                  className={`h-full ${accent.progress} transition-all`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          )}

          <div className="mt-4 flex items-center gap-3 flex-wrap">
            <button
              onClick={() => navigate('/app/pricing')}
              className={`flex items-center gap-1.5 px-5 py-2 text-[10px] uppercase tracking-widest font-bold font-sans text-white ${accent.btn} transition-colors active:scale-95`}
            >
              <Zap className="w-3 h-3" />
              Upgrade Plan
              <ArrowUpRight className="w-3 h-3" />
            </button>
            {onDismiss && (
              <button
                onClick={onDismiss}
                className="text-[10px] uppercase tracking-widest font-bold font-sans text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
              >
                Dismiss
              </button>
            )}
          </div>
        </div>

        {onDismiss && mode !== 'modal' && (
          <button onClick={onDismiss} className="shrink-0 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );

  if (mode === 'widget') {
    return (
      <div className={`${accent.bg} border ${accent.border} px-4 py-3 flex items-center gap-3`}>
        <Icon className={`w-4 h-4 shrink-0 ${accent.icon}`} />
        <p className="text-sm text-slate-700 dark:text-slate-300 font-medium flex-1 leading-snug">
          {config.title} —{' '}
          <button
            onClick={() => navigate('/app/pricing')}
            className={`font-bold underline ${accent.icon}`}
          >
            Upgrade
          </button>
        </p>
      </div>
    );
  }

  if (mode === 'modal') {
    return (
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          onClick={onDismiss}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            className="w-full max-w-md bg-white dark:bg-slate-950 border border-gray-100 dark:border-slate-800 shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-slate-800">
              <p className="text-md uppercase tracking-widest font-bold font-sans text-slate-400 dark:text-slate-500">Plan Limit</p>
              {onDismiss && (
                <button onClick={onDismiss} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <div className="p-6">{inner}</div>
          </motion.div>
        </motion.div>
      </AnimatePresence>
    );
  }

  return inner;
};

export default UpgradePrompt;
