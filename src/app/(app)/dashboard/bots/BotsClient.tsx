'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { SkeletonBase } from '@/src/app/components/SkeletonLoader';
import UpgradePrompt from '@/src/app/components/UpgradePrompt';
import DemoMigrationBanner from '@/src/app/components/DemoMigrationBanner';
import { useAuthenticatedFetch, useIsAuthReady, UpgradeError } from '@/src/lib/hooks/useAuthenticatedFetch';
import CreateBotFlow from '@/src/app/components/CreateBotFlow';
import { deleteBot } from './actions';

// Large, scrollable modal that hosts the shared bot-creation flow. Opening it
// from My Bots keeps the user in context instead of routing to a separate page.
function CreateBotModal({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[70] flex items-start sm:items-center justify-center overflow-y-auto p-3 sm:p-6" role="dialog" aria-modal="true" aria-label="Create a new bot">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative my-auto w-full max-w-2xl sm:max-w-3xl lg:max-w-4xl">
        <div className="relative flex max-h-[calc(100vh-1.5rem)] sm:max-h-[calc(100vh-3rem)] flex-col overflow-hidden rounded-2xl bg-[#f8f9fa] dark:bg-slate-950 shadow-2xl ring-1 ring-slate-200/70 dark:ring-slate-800">
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200/70 dark:border-slate-800/70 px-6 sm:px-8 py-4">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400">
                <span className="material-symbols-outlined text-[20px]">add</span>
              </span>
              <div className="min-w-0">
                <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-slate-900 dark:text-slate-100 leading-tight">Create a new bot</h2>
                <p className="text-[12.5px] text-slate-500 dark:text-slate-400 leading-snug">Provision a bot and get its embed script.</p>
              </div>
            </div>
            <button onClick={onClose} aria-label="Close" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors">
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar p-6 sm:p-8">
            <CreateBotFlow variant="modal" onClose={onClose} />
          </div>
        </div>
      </div>
    </div>
  );
}

function DeleteConfirmModal({ botName, onConfirm, onCancel }: { botName: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-950 w-full max-w-md shadow-2xl rounded-2xl overflow-hidden">
        <div className="p-6 border-b border-red-100 dark:border-red-900/30 flex items-center gap-3">
          <span className="material-symbols-outlined text-[22px] text-red-500">warning</span>
          <h3 className="text-base font-semibold font-google text-slate-900 dark:text-slate-200">Delete "{botName}"?</h3>
        </div>
        <div className="p-6 space-y-3">
          <p className="text-sm font-google text-slate-600 dark:text-slate-400 leading-relaxed">This action is permanent and cannot be undone. The following will be deleted:</p>
          <ul className="space-y-2">
            {['All trained knowledge & documents', 'Full conversation history', 'Analytics & insights', 'Captured leads', 'API key & configuration'].map(item => (
              <li key={item} className="flex items-center gap-2 text-sm font-google text-red-600 dark:text-red-400">
                <span className="material-symbols-outlined text-[14px]">remove_circle</span>
                {item}
              </li>
            ))}
          </ul>
        </div>
        <div className="p-5 flex gap-3 justify-end border-t border-gray-100 dark:border-slate-800">
          <button onClick={onCancel} className="px-5 py-2.5 text-sm font-medium font-sans rounded-xl border border-gray-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors cursor-pointer">
            Cancel
          </button>
          <button onClick={onConfirm} className="px-5 py-2.5 text-sm font-medium font-sans rounded-xl bg-red-600 text-white hover:bg-red-700 transition-colors cursor-pointer">
            Delete forever
          </button>
        </div>
      </div>
    </div>
  );
}

// Keys MUST cover every `speed` value in the backend PLAN_LIMITS (config.py):
// none | lite (EXPLORE) | standard (STARTER) | priority (PRO) | ultra (BUSINESS) | dedicated (ENTERPRISE).
// A missing key used to crash the whole page (speedInfo.cls on undefined) — the
// `?? FALLBACK` below now guarantees an unknown tier degrades gracefully instead.
const SPEED_BADGE: Record<string, { label: string; cls: string }> = {
  none: { label: 'No Access', cls: 'text-red-500 bg-red-500/10' },
  lite: { label: 'Lite', cls: 'text-slate-500 bg-slate-100 dark:text-slate-400 dark:bg-slate-800/60' },
  standard: { label: 'Standard', cls: 'text-slate-600 bg-slate-100 dark:text-slate-400 dark:bg-slate-800' },
  priority: { label: 'Priority', cls: 'text-slate-900 bg-slate-200 dark:text-slate-200 dark:bg-slate-700' },
  ultra: { label: 'Ultra', cls: 'text-slate-950 bg-slate-300 dark:text-slate-100 dark:bg-slate-600' },
  dedicated: { label: 'Dedicated', cls: 'text-slate-950 bg-slate-300 dark:text-slate-100 dark:bg-slate-600' },
};

const SPEED_BADGE_FALLBACK = { label: 'Standard', cls: 'text-slate-600 bg-slate-100 dark:text-slate-400 dark:bg-slate-800' };

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

export default function BotsClient({ initialData }: { initialData: { bots: Bot[]; plan: Plan } | null }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const authFetch = useAuthenticatedFetch();
  const isAuthReady = useIsAuthReady();

  const { data: botsData, isLoading, error: queryError } = useQuery({
    queryKey: ['bots'],
    queryFn: () => authFetch('/api/companies') as Promise<{ bots: Bot[]; plan: Plan }>,
    enabled: isAuthReady,
    initialData: initialData || undefined,
  });

  const bots: Bot[] = (botsData as any)?.bots || [];
  const plan: Plan | null = (botsData as any)?.plan || null;
  const upgradeError = queryError instanceof UpgradeError ? queryError : null;
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [showCreate, setShowCreate] = useState(false);

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

  const handleDelete = (botId: string, botName: string) => {
    setDeleteTarget({ id: botId, name: botName });
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const { id: botId } = deleteTarget;
    setDeleteTarget(null);
    setDeletingId(botId);
    try {
      await deleteBot(botId);
      queryClient.invalidateQueries({ queryKey: ['bots'] });
    } catch (err: any) {
      window.dispatchEvent(
        new CustomEvent('Sapybase:toast', {
          detail: { kind: 'error', message: err.message || 'Failed to delete bot.' },
        })
      );
    } finally {
      setDeletingId(null);
    }
  };

  const canAdd = plan && plan.can_add_more;
  const speedInfo = SPEED_BADGE[plan?.speed_tier || 'none'] ?? SPEED_BADGE_FALLBACK;

  return (
    <>
    <div className="flex flex-col h-full bg-[#f8f9fa] dark:bg-slate-950 transition-all duration-500 relative overflow-hidden">

      <div className="relative flex flex-col h-full z-10">
        <DemoMigrationBanner />
        <div className="px-6 py-5 sm:px-8 sm:py-6 flex items-center justify-between transition-colors">
          <div>
            <p className="text-sm md:text-base font-display text-slate-500 dark:text-slate-400">Manage all your AI assistants across your plan.</p>
          </div>
          {plan && (
            <div className="hidden sm:flex items-center gap-3">
              <span className={`px-3 py-1.5 text-xs font-medium font-google rounded-full ${speedInfo.cls}`}>
                {speedInfo.label} Speed
              </span>
              <span className="text-sm font-google text-slate-500 dark:text-slate-400">
                {plan.current_bots} / {plan.max_bots === 999 ? '∞' : plan.max_bots} bots
              </span>
            </div>
          )}
        </div>

        {plan && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 px-6 md:px-8 mb-6">
            {[
              { label: 'Plan', value: plan.tier || '—' },
              { label: 'Messages / bot / mo', value: plan.message_limit >= 999999 ? 'Unlimited' : plan.message_limit.toLocaleString() },
              { label: 'Knowledge words', value: plan.chunk_limit >= 999999 ? 'Unlimited' : (plan.chunk_limit * 60).toLocaleString() },
            ].map((s, i) => (
              <div key={i} className="bg-white dark:bg-slate-900 px-5 py-4 rounded-2xl transition-colors">
                <p className="text-xs text-slate-400 dark:text-slate-500 font-google mb-1">{s.label}</p>
                <p className="text-base md:text-lg font-google font-semibold text-slate-900 dark:text-slate-200">{s.value}</p>
              </div>
            ))}
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {[1, 2, 3].map(i => <SkeletonBase key={i} className="h-56 rounded-2xl" />)}
            </div>
          ) : bots.length === 0 ? null : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              <AnimatePresence>
                {bots.map(bot => (
                  <motion.div key={bot.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
                    className="bg-white dark:bg-slate-900 rounded-2xl flex flex-col transition-colors shadow-sm">
                    <div className="p-6 flex flex-col flex-1 gap-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="text-base font-semibold font-google text-slate-900 dark:text-slate-200">{bot.bot_name}</h3>
                          <p className="text-xs text-slate-400 dark:text-slate-500 font-google mt-0.5">{bot.company_name}</p>
                        </div>
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-slate-100 dark:bg-slate-800">
                          <span className="material-symbols-outlined text-[18px] text-slate-700 dark:text-slate-300">smart_toy</span>
                        </div>
                      </div>

                      <a href={bot.allowed_origin} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 font-google flex items-center gap-2 min-w-0">
                        <span className="material-symbols-outlined text-[15px] shrink-0">link</span>
                        <span className="truncate">{bot.allowed_origin || 'No origin set'}</span>
                      </a>

                      <div>
                        <div className="flex justify-between text-xs text-slate-400 dark:text-slate-500 font-google mb-1.5">
                          <span>Usage</span>
                          <span>{bot.messages_used} / {plan?.message_limit && plan.message_limit >= 999999 ? '∞' : plan?.message_limit}</span>
                        </div>
                        {plan && plan.message_limit < 999999 && (
                          <div className="h-1.5 bg-slate-100 dark:bg-slate-800 w-full rounded-full overflow-hidden">
                            <div className="h-full bg-slate-800 dark:bg-slate-300 rounded-full transition-all" style={{ width: `${Math.min((bot.messages_used / (plan?.message_limit || 1)) * 100, 100)}%` }} />
                          </div>
                        )}
                      </div>

                      {plan && plan.message_limit < 999999 && bot.messages_used >= plan.message_limit * 0.8 && (
                        <div className="mt-1">
                          <UpgradePrompt mode="widget" code={bot.messages_used >= plan.message_limit ? 'MESSAGE_LIMIT_EXCEEDED' : 'DEFAULT'} tier={plan.tier} current={bot.messages_used} limit={plan.message_limit} />
                        </div>
                      )}

                      <div className="flex gap-2 mt-auto pt-2">
                        <button onClick={() => router.push(`/dashboard/train?bot=${bot.id}`)}
                          className="flex-1 py-2.5 text-sm font-medium font-sans rounded-xl bg-slate-900 dark:bg-white text-white dark:text-black hover:bg-slate-700 dark:hover:bg-slate-200 transition-colors flex items-center justify-center gap-1.5 cursor-pointer">
                          <span className="material-symbols-outlined text-[15px]">psychology</span> Train
                        </button>
                        <button onClick={() => router.push(`/dashboard/settings/customize?edit=${bot.id}`)}
                          className="flex-1 py-2.5 text-sm font-medium font-sans rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors flex items-center justify-center gap-1.5 cursor-pointer">
                          <span className="material-symbols-outlined text-[15px]">settings</span> Settings
                        </button>
                        <button onClick={() => handleDelete(bot.id, bot.bot_name)} disabled={deletingId === bot.id}
                          className="flex items-center justify-center p-2.5 rounded-xl bg-red-50 dark:bg-red-500/10 text-red-500 hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors disabled:opacity-40 cursor-pointer">
                          <span className="material-symbols-outlined text-[16px]">delete</span>
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              <motion.div layout
                className={`rounded-2xl flex flex-col items-center justify-center p-8 min-h-[200px] transition-colors ${canAdd ? 'cursor-pointer bg-white dark:bg-slate-900 group shadow-sm' : 'bg-slate-50/60 dark:bg-slate-900/20 cursor-not-allowed'}`}
                onClick={() => canAdd && setShowCreate(true)}>
                {canAdd ? (
                  <>
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3 transition-colors bg-slate-100 dark:bg-slate-800">
                      <span className="material-symbols-outlined text-[20px] text-slate-400 dark:text-slate-500 group-hover:text-slate-800 dark:group-hover:text-slate-200 transition-colors">add</span>
                    </div>
                    <p className="text-sm font-medium text-slate-400 dark:text-slate-500 font-sans group-hover:text-slate-800 dark:group-hover:text-slate-200 transition-colors text-center">Add new bot</p>
                    {plan && (
                      <p className="text-xs text-slate-400 dark:text-slate-600 font-sans mt-1 text-center">
                        {plan.max_bots - plan.current_bots} slot{plan.max_bots - plan.current_bots !== 1 ? 's' : ''} remaining
                      </p>
                    )}
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[22px] text-slate-300 dark:text-slate-600 mb-3">lock</span>
                    <p className="text-sm font-medium text-slate-400 dark:text-slate-600 font-sans text-center">Bot limit reached</p>
                    <Link href="/dashboard/pricing" onClick={e => e.stopPropagation()} className="mt-3 text-sm font-medium font-sans text-slate-600 dark:text-slate-400 hover:underline">
                      Upgrade plan →
                    </Link>
                  </>
                )}
              </motion.div>
            </div>
          )}

          {!isLoading && bots.length === 0 && (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <span className="material-symbols-outlined text-[48px] text-slate-200 dark:text-slate-700 mb-5">smart_toy</span>
              <p className="text-lg font-semibold text-slate-700 dark:text-slate-300 font-display mb-2">No bots yet</p>
              <p className="text-sm text-slate-400 dark:text-slate-600 font-display mb-8 max-w-xs leading-relaxed">Create your first AI assistant to get started.</p>
              <button onClick={() => setShowCreate(true)} className="px-7 py-3 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-sm font-semibold font-sans rounded-xl hover:bg-slate-700 dark:hover:bg-white transition-colors cursor-pointer">
                Create first bot
              </button>
            </div>
          )}
        </div>

        {upgradeError && (
          <UpgradePrompt mode="modal" code={upgradeError.code} tier={upgradeError.tier} current={upgradeError.current} limit={upgradeError.limit} onDismiss={() => { }} />
        )}
      </div>
    </div>

    {deleteTarget && (
      <DeleteConfirmModal
        botName={deleteTarget.name}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    )}

    {showCreate && <CreateBotModal onClose={() => setShowCreate(false)} />}
    </>
  );
}
