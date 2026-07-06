'use client';

/**
 * CreateBotFlow — the shared bot-provisioning experience.
 *
 * Renders the two-stage flow (config form → live credentials) and owns the
 * `/api/register` mutation. Used in two places with identical logic:
 *   • variant="page"  → the standalone /dashboard/register route
 *   • variant="modal" → the "New bot" modal launched from My Bots
 *
 * Presentation only differs by `variant`; the create logic, payload, and query
 * invalidation are the same in both.
 */

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import Link from 'next/link';
import Alert from '@/src/components/ui/Alert';
import UpgradePrompt from '@/src/components/features/UpgradePrompt';
import BotInstallGuide from '@/src/components/features/BotInstallGuide';
import { useUserRole } from '@/src/lib/context/UserContext';
import { useAuthenticatedFetch, UpgradeError } from '@/src/lib/hooks/useAuthenticatedFetch';
import { Card, SectionHeader, Badge, cx, card } from '@/src/components/dashboard/insights/ui';

const inputCls = "w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2.5 text-[13.5px] text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500/70 transition-colors";
const labelCls = "block text-[12.5px] font-semibold text-slate-700 dark:text-slate-300 mb-1.5 transition-colors";

export default function CreateBotFlow({
    variant = 'page',
    onClose,
}: {
    variant?: 'page' | 'modal';
    onClose?: () => void;
}) {
    const router = useRouter();
    const queryClient = useQueryClient();
    const { userTier } = useUserRole();
    const authFetch = useAuthenticatedFetch();

    const [formData, setFormData] = useState({
        companyName: '', allowedOrigin: '',
        themeColor: '#5730F5', companyTone: 'Professional and helpful',
    });
    const [registrationData, setRegistrationData] = useState<any>(null);
    const [alert, setAlert] = useState({ open: false, type: 'success' as 'success' | 'error' | 'development', msg: '' });
    const [copied, setCopied] = useState<string | null>(null);
    const [upgradeError, setUpgradeError] = useState<any>(null);

    const isLocked = !userTier || userTier === 'FREE' || String(userTier) === 'null';

    const showAlert = (type: 'success' | 'error' | 'development', msg: string) => setAlert({ open: true, type, msg });

    const handleCopy = (text: string, key: string) => {
        navigator.clipboard.writeText(text);
        setCopied(key);
        setTimeout(() => setCopied(null), 2000);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
        setFormData({ ...formData, [e.target.name]: e.target.value });

    const registerMutation = useMutation({
        mutationFn: (payload) =>
            authFetch('/api/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            }),
        onSuccess: (data: any) => {
            queryClient.invalidateQueries({ queryKey: ['bots'] });
            setRegistrationData({
                apiKey: data.api_key,
                companyName: formData.companyName,
                allowedOrigin: data.allowed_origin,
                // Used to deep-link "Train this bot" when the API surfaces an id.
                botId: data.company_id ?? data.id ?? data.bot_id ?? null,
            });
            showAlert('success', data.message || 'Registration successful!');
        },
        onError: (err: any) => {
            if (err instanceof UpgradeError) setUpgradeError(err);
            else showAlert('error', err.message);
        },
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.companyName.trim() || !formData.allowedOrigin.trim()) {
            showAlert('error', 'Company name and allowed origin are required.');
            return;
        }
        (registerMutation.mutate as any)({
            company_name: formData.companyName,
            allowed_origin: formData.allowedOrigin,
            theme_color: formData.themeColor,
            company_tone: formData.companyTone,
        });
    };

    const handleReset = () => {
        setRegistrationData(null);
        setFormData({ companyName: '', allowedOrigin: '', themeColor: '#5730F5', companyTone: 'Professional and helpful' });
    };

    const isLoading = registerMutation.isPending;
    const isModal = variant === 'modal';

    const goTrain = () => {
        const id = registrationData?.botId;
        router.push(id ? `/dashboard/train?bot=${id}` : '/dashboard/train');
    };

    return (
        <div className="flex flex-col gap-5">
            <AnimatePresence mode="wait" initial={false}>
                {!registrationData ? (
                    /* ── Config form ─────────────────────────────────────────── */
                    <motion.div
                        key="form"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.18 }}
                    >
                        <div className={cx('relative overflow-hidden', isModal ? 'rounded-2xl' : cx(card, 'p-5 sm:p-6'))}>
                            {isLocked && (
                                <div className="absolute inset-0 z-30 flex flex-col items-center justify-center rounded-2xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-md p-6 text-center transition-colors">
                                    <span className="material-symbols-outlined text-[30px] text-slate-400 dark:text-slate-500 mb-3">lock</span>
                                    <h3 className="text-[15px] font-bold text-slate-900 dark:text-slate-100 mb-1.5">Upgrade required</h3>
                                    <p className="text-[13px] text-slate-500 dark:text-slate-400 leading-relaxed max-w-[260px] mb-5">
                                        Provisioning a new bot requires an active subscription.
                                    </p>
                                    <Link href="/dashboard/pricing"
                                        className="inline-flex items-center rounded-lg bg-blue-600 px-5 py-2.5 text-[13px] font-semibold text-white hover:bg-blue-700 transition-colors active:scale-[0.98]">
                                        View plans
                                    </Link>
                                </div>
                            )}

                            <div className={isLocked ? 'opacity-30 pointer-events-none' : ''}>
                                {!isModal && (
                                    <SectionHeader
                                        title="Bot configuration"
                                        subtitle="Fill in the details to generate your bot's live credentials."
                                        icon="smart_toy"
                                        className="mb-5"
                                    />
                                )}

                                <form onSubmit={handleSubmit} className="space-y-4 p-2">
                                    <div>
                                        <label className={labelCls}>Company name</label>
                                        <div className="relative">
                                            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[16px] text-slate-400 dark:text-slate-500 pointer-events-none">corporate_fare</span>
                                            <input type="text" name="companyName" required value={formData.companyName}
                                                onChange={handleChange} className={cx(inputCls, 'pl-10')} placeholder="Acme Inc." />
                                        </div>
                                    </div>

                                    <div>
                                        <label className={labelCls}>Allowed origin</label>
                                        <div className="relative">
                                            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[16px] text-slate-400 dark:text-slate-500 pointer-events-none">public</span>
                                            <input type="url" name="allowedOrigin" required value={formData.allowedOrigin}
                                                onChange={handleChange} className={cx(inputCls, 'pl-10')} placeholder="https://example.com" />
                                        </div>
                                        <p className="mt-1.5 text-[12px] text-slate-500 dark:text-slate-400 leading-relaxed">
                                            Your bot's API key will be locked to this domain.
                                        </p>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div>
                                            <label className={labelCls}>Theme color</label>
                                            <div className="relative">
                                                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[16px] text-slate-400 dark:text-slate-500 pointer-events-none">palette</span>
                                                <input type="text" name="themeColor" value={formData.themeColor}
                                                    onChange={handleChange} className={cx(inputCls, 'pl-10 pr-12 font-mono uppercase tabular-nums')} />
                                                <div className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700">
                                                    <input type="color" name="themeColor" value={formData.themeColor}
                                                        onChange={handleChange}
                                                        className="absolute inset-[-6px] w-[calc(100%+12px)] h-[calc(100%+12px)] cursor-pointer" />
                                                </div>
                                            </div>
                                        </div>
                                        <div>
                                            <label className={labelCls}>Tone</label>
                                            <div className="relative">
                                                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[16px] text-slate-400 dark:text-slate-500 pointer-events-none">forum</span>
                                                <select name="companyTone" value={formData.companyTone} onChange={handleChange}
                                                    className={cx(inputCls, 'pl-10 pr-9 appearance-none cursor-pointer')}>
                                                    <option value="Professional and helpful">Professional</option>
                                                    <option value="Friendly and casual">Friendly</option>
                                                    <option value="Technical and concise">Technical</option>
                                                </select>
                                                <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-[16px] text-slate-400 dark:text-slate-500 pointer-events-none">expand_more</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-3 pt-1">
                                        <button type="submit" disabled={isLoading}
                                            className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-7 py-2.5 text-[13.5px] font-semibold text-white hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500/70 active:scale-[0.99]">
                                            {isLoading
                                                ? <><div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin motion-reduce:hidden" /> Provisioning…</>
                                                : <>Create bot <span className="material-symbols-outlined text-[16px]">arrow_forward</span></>}
                                        </button>
                                        {variant === 'modal' && onClose && (
                                            <button type="button" onClick={onClose}
                                                className="inline-flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 px-5 py-2.5 text-[13px] font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                                                Cancel
                                            </button>
                                        )}
                                    </div>
                                </form>
                            </div>
                        </div>
                    </motion.div>
                ) : (
                    /* ── Live credentials ────────────────────────────────────── */
                    <motion.div
                        key="success"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.18 }}
                        className="flex flex-col gap-4"
                    >
                        {/* Success header */}
                        <Card className="p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-4">
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
                                <span className="material-symbols-outlined text-[24px]">check_circle</span>
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <h2 className="text-[18px] font-bold text-slate-900 dark:text-slate-100 truncate tracking-[-0.01em]">
                                        {registrationData.companyName}
                                    </h2>
                                    <Badge tone="ok" dot={false}>Live</Badge>
                                </div>
                                <p className="text-[13px] text-slate-500 dark:text-slate-400 mt-0.5">Provision successful — credentials are active.</p>
                            </div>
                            <div className="flex flex-wrap gap-2.5 shrink-0">
                                <button onClick={goTrain}
                                    className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-5 py-2.5 text-[13px] font-semibold text-white hover:bg-blue-700 transition-colors active:scale-[0.98]">
                                    <span className="material-symbols-outlined text-[16px]">psychology</span> Train this bot
                                </button>
                                <button onClick={handleReset}
                                    className="inline-flex items-center rounded-lg bg-slate-100 dark:bg-slate-800 px-5 py-2.5 text-[13px] font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors active:scale-[0.98]">
                                    Create another
                                </button>
                                {variant === 'modal' && onClose && (
                                    <button onClick={onClose}
                                        className="inline-flex items-center rounded-lg border border-slate-200 dark:border-slate-700 px-5 py-2.5 text-[13px] font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors active:scale-[0.98]">
                                        Close
                                    </button>
                                )}
                            </div>
                        </Card>

                        {/* API key */}
                        <Card className="p-5">
                            <div className="flex items-center gap-2 mb-3.5">
                                <span className="material-symbols-outlined text-[16px] text-slate-400 dark:text-slate-500">vpn_key</span>
                                <p className="text-[13px] font-semibold text-slate-700 dark:text-slate-300">Secure API key</p>
                            </div>
                            <div className="flex items-center gap-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 px-3.5 py-3">
                                <span className="flex-1 truncate text-[12.5px] font-mono text-slate-900 dark:text-slate-100">{registrationData.apiKey}</span>
                                <button onClick={() => handleCopy(registrationData.apiKey, 'key')}
                                    aria-label="Copy API key"
                                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700 text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 transition-colors">
                                    <span className="material-symbols-outlined text-[16px]">{copied === 'key' ? 'check' : 'content_copy'}</span>
                                </button>
                            </div>
                        </Card>

                        {/* Stack-aware install guide */}
                        <Card>
                            <BotInstallGuide apiKey={registrationData.apiKey} />
                        </Card>
                    </motion.div>
                )}
            </AnimatePresence>

            <Alert isOpen={alert.open} type={alert.type} message={alert.msg} onClose={() => setAlert(p => ({ ...p, open: false }))} />

            {upgradeError && (
                <UpgradePrompt
                    mode="modal"
                    code={upgradeError.code}
                    tier={upgradeError.tier}
                    current={upgradeError.current}
                    limit={upgradeError.limit}
                    onDismiss={() => setUpgradeError(null)}
                />
            )}
        </div>
    );
}
