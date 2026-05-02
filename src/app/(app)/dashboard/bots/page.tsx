'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { SkeletonBase } from '@/src/app/components/SkeletonLoader';
import UpgradePrompt from '@/src/app/components/UpgradePrompt';
import DemoMigrationBanner from '@/src/app/components/DemoMigrationBanner';
import { useAuthenticatedFetch, useIsAuthReady, UpgradeError } from '@/src/lib/hooks/useAuthenticatedFetch';

const SPEED_BADGE: Record<string, { label: string; cls: string }> = {
  standard: { label: 'Standard', cls: 'text-slate-500 bg-slate-50 border-slate-200' },
  priority: { label: 'Priority', cls: 'text-blue-600 bg-blue-50 border-blue-200' },
  dedicated: { label: 'Dedicated', cls: 'text-violet-600 bg-violet-50 border-violet-200' },
  none: { label: 'No Access', cls: 'text-red-500 bg-red-50 border-red-200' },
};

interface Bot {
  id: string;
  bot_name: string;
  company_name: string;
  theme_color: string;
  allowed_origin: string;
  messages_used: number;
}

interface Plan {
  tier: string;
  can_add_more: boolean;
  speed_tier: string;
  current_bots: number;
  max_bots: number;
  message_limit: number;
  chunk_limit: number;
}

export default function BotsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const authFetch = useAuthenticatedFetch();
  const isAuthReady = useIsAuthReady();

  const { data: botsData, isLoading, error: queryError } = useQuery({
    queryKey: ['bots'],
    queryFn: () => authFetch('/api/companies') as Promise<{ bots: Bot[]; plan: Plan }>,
    enabled: isAuthReady,
  });

  const bots: Bot[] = (botsData as any)?.bots || [];
  const plan: Plan | null = (botsData as any)?.plan || null;
  const upgradeError = queryError instanceof UpgradeError ? queryError : null;

  // Surface non-upgrade query errors (network, 5xx) as toasts so the page
  // doesn't silently render an empty state when the fetch genuinely failed.
  useEffect(() => {
    if (!queryError || queryError instanceof UpgradeError) return;
    const msg = (queryError as Error)?.message || '';
    if (msg === 'AUTH_REQUIRED' || msg === 'FORBIDDEN' || msg === 'AUTH_NOT_READY') return;
    if (typeof window === 'undefined') return;
    window.dispatchEvent(
      new CustomEvent('Sapybase:toast', {
        detail: { kind: 'error', message: msg || 'Failed to load bots.' },
      })
    );
  }, [queryError]);

  const deleteMutation = useMutation({
    mutationFn: (botId: string) => authFetch(`/api/companies/${botId}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['bots'] }),
  });

  const handleDelete = (botId: string, botName: string) => {
    if (!window.confirm(`Delete "${botName}"? This will deactivate the bot and its API key.`)) return;
    deleteMutation.mutate(botId);
  };

  const deletingId = deleteMutation.isPending ? (deleteMutation.variables as string) : null;
  const canAdd = plan && plan.can_add_more;
  const speedInfo = SPEED_BADGE[plan?.speed_tier || 'none'];

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900 transition-all duration-500 relative overflow-hidden">
      <div className="absolute inset-0 bg-cover bg-center bg-no-repeat sm:bg-fixed opacity-100" style={{ backgroundImage: "url('/nature.webp')" }} />
      <div className="absolute inset-0 bg-white/40 dark:bg-slate-950/70 backdrop-blur-[2px] pointer-events-none" />

      <div className="relative flex flex-col h-full z-10">
        <DemoMigrationBanner />
        <div className="bg-white/70 dark:bg-slate-950/70 backdrop-blur-md px-4 py-4 sm:px-6 sm:py-5 md:px-8 md:py-6 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between transition-colors">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="material-symbols-outlined text-[16px] text-slate-600 dark:text-slate-400">smart_toy</span>
              <h1 className="text-xl md:text-2xl font-display font-bold text-slate-900 dark:text-slate-200">My Bots</h1>
            </div>
            <p className="text-md font-display text-slate-500 dark:text-slate-400">Manage all your AI assistants across your plan.</p>
          </div>
          {plan && (
            <div className="hidden sm:flex items-center gap-3">
              <span className={`px-3 py-1 text-[10px] uppercase tracking-widest font-bold font-google border rounded-none ${speedInfo.cls} dark:bg-slate-900 border dark:border-slate-800`}>
                {speedInfo.label} Speed
              </span>
              <span className="text-md font-google text-slate-500 dark:text-slate-400">
                {plan.current_bots} / {plan.max_bots === 999 ? '∞' : plan.max_bots} bots
              </span>
            </div>
          )}
        </div>

        {plan && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-px bg-gray-200/30 dark:bg-slate-800/30 border-b border-gray-100 dark:border-slate-800 transition-colors">
            {[
              { label: 'Plan', value: plan.tier || '—' },
              { label: 'Msgs / Bot / Mo', value: plan.message_limit >= 999999 ? 'Unlimited' : plan.message_limit.toLocaleString() },
              { label: 'Knowledge Chunks', value: plan.chunk_limit >= 999999 ? 'Unlimited' : plan.chunk_limit.toLocaleString() },
            ].map((s, i) => (
              <div key={i} className="bg-white/50 dark:bg-slate-950/70 backdrop-blur-md px-4 py-3 sm:px-6 sm:py-4 transition-colors">
                <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400 dark:text-slate-500 font-google mb-0.5">{s.label}</p>
                <p className="text-sm sm:text-base md:text-lg font-google font-semibold text-slate-900 dark:text-slate-200">{s.value}</p>
              </div>
            ))}
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {[1, 2, 3].map(i => <SkeletonBase key={i} className="h-48 rounded-none" />)}
            </div>
          ) : bots.length === 0 ? null : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              <AnimatePresence>
                {bots.map(bot => (
                  <motion.div key={bot.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
                    className="bg-white dark:bg-slate-950 border border-gray-100 dark:border-slate-800 flex flex-col transition-colors">
                    <div className="h-1 w-full" style={{ backgroundColor: bot.theme_color || '#5730F5' }} />
                    <div className="p-5 flex flex-col flex-1 gap-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="text-md font-google font-bold text-slate-900 dark:text-slate-200">{bot.bot_name}</h3>
                          <p className="text-xs uppercase tracking-widest font-bold text-slate-400 dark:text-slate-500 font-google mt-0.5">{bot.company_name}</p>
                        </div>
                        <div className="w-8 h-8 rounded-full border border-gray-100 dark:border-slate-800 flex items-center justify-center" style={{ backgroundColor: bot.theme_color + '20' }}>
                          <span className="material-symbols-outlined text-[16px]" style={{ color: bot.theme_color }}>smart_toy</span>
                        </div>
                      </div>

                      <a href={bot.allowed_origin} target="_blank" rel="noopener noreferrer" className="text-sm tracking-wide font-medium text-blue-600 dark:text-slate-500 font-google truncate flex items-center gap-2">
                        <span className="material-symbols-outlined text-[16px]">link</span> {bot.allowed_origin || 'No origin set'}
                      </a>

                      <div>
                        <div className="flex justify-between text-[10px] uppercase tracking-widest font-bold text-slate-400 dark:text-slate-500 font-google mb-1">
                          <span>Usage</span>
                          <span>{bot.messages_used} / {plan?.message_limit && plan.message_limit >= 999999 ? '∞' : plan?.message_limit}</span>
                        </div>
                        {plan && plan.message_limit < 999999 && (
                          <div className="h-1 bg-slate-100 dark:bg-slate-800 w-full">
                            <div className="h-full bg-slate-900 dark:bg-blue-500 transition-all" style={{ width: `${Math.min((bot.messages_used / (plan?.message_limit || 1)) * 100, 100)}%` }} />
                          </div>
                        )}
                      </div>

                      {plan && plan.message_limit < 999999 && bot.messages_used >= plan.message_limit * 0.8 && (
                        <div className="mt-1">
                          <UpgradePrompt mode="widget" code={bot.messages_used >= plan.message_limit ? 'MESSAGE_LIMIT_EXCEEDED' : 'DEFAULT'} tier={plan.tier} current={bot.messages_used} limit={plan.message_limit} />
                        </div>
                      )}

                      <div className="flex gap-2 mt-auto pt-3 border-t border-gray-100 dark:border-slate-800">
                        <button onClick={() => router.push(`/dashboard/train?bot=${bot.id}`)}
                          className="flex-1 py-2 text-[10px] uppercase tracking-widest font-bold font-sans bg-slate-900 dark:bg-blue-600 text-white hover:bg-slate-800 dark:hover:bg-blue-500 transition-colors flex items-center justify-center gap-1 cursor-pointer">
                          <span className="material-symbols-outlined text-[12px]">psychology</span> Train
                        </button>
                        <button onClick={() => router.push(`/dashboard/settings/customize?edit=${bot.id}`)}
                          className="flex-1 py-2 text-[10px] uppercase tracking-widest font-bold font-sans border border-gray-100 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors flex items-center justify-center gap-1 cursor-pointer">
                          <span className="material-symbols-outlined text-[12px]">settings</span> Settings
                        </button>
                        <button onClick={() => handleDelete(bot.id, bot.bot_name)} disabled={deletingId === bot.id || deleteMutation.isPending}
                          className="flex items-center justify-center p-2 border border-red-100 dark:border-red-900/40 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-40 cursor-pointer">
                          <span className="material-symbols-outlined text-[14px]">delete</span>
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              <motion.div layout
                className={`border-2 border-dashed flex flex-col items-center justify-center p-8 min-h-[200px] transition-colors ${canAdd ? 'border-gray-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-600 cursor-pointer bg-white dark:bg-slate-950 group' : 'border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-900/50 cursor-not-allowed'}`}
                onClick={() => canAdd && router.push('/dashboard/register')}>
                {canAdd ? (
                  <>
                    <div className="w-12 h-12 border border-gray-200 dark:border-slate-700 group-hover:border-blue-300 dark:group-hover:border-blue-600 flex items-center justify-center mb-3 transition-colors">
                      <span className="material-symbols-outlined text-[20px] text-slate-400 dark:text-slate-500 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">add</span>
                    </div>
                    <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400 dark:text-slate-500 font-sans group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors text-center">Add New Bot</p>
                    {plan && (
                      <p className="text-[10px] text-slate-400 dark:text-slate-600 font-sans mt-1 text-center">
                        {plan.max_bots - plan.current_bots} slot{plan.max_bots - plan.current_bots !== 1 ? 's' : ''} remaining
                      </p>
                    )}
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[20px] text-slate-300 dark:text-slate-600 mb-3">lock</span>
                    <p className="text-[10px] uppercase tracking-widest font-bold text-slate-300 dark:text-slate-600 font-sans text-center">Bot Limit Reached</p>
                    <Link href="/dashboard/pricing" onClick={e => e.stopPropagation()} className="mt-3 text-[10px] uppercase tracking-widest font-bold font-sans text-blue-600 dark:text-blue-400 hover:underline">
                      Upgrade Plan →
                    </Link>
                  </>
                )}
              </motion.div>
            </div>
          )}

          {!isLoading && bots.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <span className="material-symbols-outlined text-[48px] text-gray-200 dark:text-slate-700 mb-4">smart_toy</span>
              <p className="text-md uppercase tracking-widest font-bold text-slate-400 dark:text-slate-500 font-display mb-2">No bots yet</p>
              <p className="text-sm text-slate-400 dark:text-slate-600 font-display mb-6">Create your first AI assistant to get started.</p>
              <Link href="/dashboard/register" className="px-6 py-3 bg-slate-900 dark:bg-blue-600 text-white text-[10px] uppercase tracking-widest font-bold font-sans hover:bg-slate-800 dark:hover:bg-blue-500 transition-colors">
                Create First Bot
              </Link>
            </div>
          )}
        </div>

        {upgradeError && (
          <UpgradePrompt mode="modal" code={upgradeError.code} tier={upgradeError.tier} current={upgradeError.current} limit={upgradeError.limit} onDismiss={() => { }} />
        )}
      </div>
    </div>
  );
}
