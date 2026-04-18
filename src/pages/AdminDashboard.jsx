import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import SkeletonLoader from '../components/SkeletonLoader';
import { useUser } from '@clerk/clerk-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useUserRole } from '../context/UserContext';
import { useAuthenticatedFetch } from '../hooks/useApiCall';

// ── Tier config ───────────────────────────────────────────────────────────────
const TIERS = ['FREE', 'BASIC', 'STARTER', 'PRO', 'ENTERPRISE'];

const TIER_STYLE = {
    FREE:        'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700',
    BASIC:       'bg-sky-50 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400 border border-sky-200 dark:border-sky-800',
    STARTER:     'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-200 dark:border-blue-800',
    PRO:         'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border border-amber-200 dark:border-amber-800',
    ENTERPRISE:  'bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400 border border-violet-200 dark:border-violet-800',
    SUPER_ADMIN: 'bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400 border border-rose-200 dark:border-rose-800',
};

const TierBadge = ({ tier }) => (
    <span className={`inline-flex items-center px-2 py-0.5 text-[10px] font-google font-bold uppercase tracking-widest rounded-none ${TIER_STYLE[tier] || TIER_STYLE.FREE}`}>
        {tier || 'FREE'}
    </span>
);

const StatusBadge = ({ status }) => {
    const active = status !== 'suspended';
    return (
        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-google font-bold uppercase tracking-widest rounded-none ${active ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800' : 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400 border border-red-200 dark:border-red-800'}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-emerald-500' : 'bg-red-500'}`} />
            {active ? 'Active' : 'Suspended'}
        </span>
    );
};

// ── Usage bar ─────────────────────────────────────────────────────────────────
const UsageBar = ({ used = 0, limit = 0 }) => {
    const pct = limit > 0 ? Math.min((used / limit) * 100, 100) : 0;
    const color = pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-500' : 'bg-indigo-500';
    return (
        <div className="w-full">
            <div className="flex justify-between items-center mb-1">
                <span className="text-[10px] font-google font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                    {used.toLocaleString()} / {limit > 0 ? limit.toLocaleString() : '∞'}
                </span>
                <span className="text-[10px] font-google font-bold text-slate-400 dark:text-slate-500">{Math.round(pct)}%</span>
            </div>
            <div className="h-1 w-full bg-gray-100 dark:bg-slate-800">
                <div className={`h-full ${color} transition-all duration-500`} style={{ width: `${pct}%` }} />
            </div>
        </div>
    );
};

// ── Toggle switch ─────────────────────────────────────────────────────────────
const Toggle = ({ checked, onChange, label }) => (
    <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 focus:outline-none ${checked ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-slate-700'}`}
        role="switch"
        aria-checked={checked}
    >
        <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform duration-200 ${checked ? 'translate-x-4' : 'translate-x-0.5'}`} />
        <span className="sr-only">{label}</span>
    </button>
);

// ── Manage Slide-Over ─────────────────────────────────────────────────────────
const ManageSlideOver = ({ user, onClose, onSave, isSaving }) => {
    const [draft, setDraft] = useState({
        tier: user.tier || 'FREE',
        status: user.status || 'active',
        custom_plan_enabled: !!(user.custom_message_limit || user.custom_bot_limit),
        custom_message_limit: user.custom_message_limit || '',
        custom_bot_limit: user.custom_bot_limit || '',
    });

    const set = (key, val) => setDraft(d => ({ ...d, [key]: val }));

    const companies = Array.isArray(user.companies) ? user.companies : [];
    const isValid = !draft.custom_plan_enabled || (
        (draft.custom_message_limit === '' || Number(draft.custom_message_limit) >= 0) &&
        (draft.custom_bot_limit === '' || Number(draft.custom_bot_limit) >= 0)
    );

    const handleSave = () => {
        if (!isValid || isSaving) return;
        onSave({
            tier: draft.tier,
            status: draft.status,
            custom_message_limit: draft.custom_plan_enabled && draft.custom_message_limit !== '' ? Number(draft.custom_message_limit) : null,
            custom_bot_limit: draft.custom_plan_enabled && draft.custom_bot_limit !== '' ? Number(draft.custom_bot_limit) : null,
        });
    };

    return (
        <div className="fixed inset-0 z-50 flex" role="dialog" aria-modal="true">
            {/* Backdrop */}
            <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Panel */}
            <motion.div
                initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                className="ml-auto relative z-10 flex flex-col w-full max-w-md h-full bg-white dark:bg-slate-950 border-l border-gray-100 dark:border-slate-800 shadow-2xl overflow-y-auto"
            >
                {/* Header */}
                <div className="flex items-start justify-between p-6 border-b border-gray-100 dark:border-slate-800 sticky top-0 bg-white dark:bg-slate-950 z-10">
                    <div className="flex-1 min-w-0 pr-4">
                        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                            <TierBadge tier={user.tier} />
                            <StatusBadge status={user.status} />
                            {user.role === 'SUPER_ADMIN' && <TierBadge tier="SUPER_ADMIN" />}
                        </div>
                        <p className="text-sm font-google font-bold text-slate-900 dark:text-slate-100 truncate" title={user.email}>{user.email}</p>
                        <p className="text-[10px] font-mono text-slate-400 dark:text-slate-500 mt-0.5 truncate">{user.clerk_id}</p>
                    </div>
                    <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors shrink-0">
                        <span className="material-symbols-outlined text-[20px]">close</span>
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 p-6 space-y-6">

                    {/* Access Tier */}
                    <div>
                        <label className="block text-[10px] font-google font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-2">Access Tier</label>
                        <select
                            value={draft.tier}
                            onChange={e => set('tier', e.target.value)}
                            disabled={isSaving}
                            className="w-full bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 px-3 py-2.5 text-sm font-google font-bold text-slate-900 dark:text-slate-200 uppercase tracking-widest focus:ring-1 focus:ring-indigo-500 outline-none transition-colors disabled:opacity-50 rounded-none"
                        >
                            {TIERS.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                    </div>

                    {/* Account Status */}
                    <div>
                        <label className="block text-[10px] font-google font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-2">Account Status</label>
                        <button
                            type="button"
                            onClick={() => set('status', draft.status === 'suspended' ? 'active' : 'suspended')}
                            disabled={isSaving}
                            className={`w-full flex items-center justify-between px-4 py-3 border text-sm font-google font-bold uppercase tracking-widest transition-colors disabled:opacity-50 ${
                                draft.status === 'suspended'
                                    ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40'
                                    : 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/40'
                            }`}
                        >
                            <span className="flex items-center gap-2">
                                <span className="material-symbols-outlined text-[16px]">{draft.status === 'suspended' ? 'block' : 'check_circle'}</span>
                                {draft.status === 'suspended' ? 'Activate Account' : 'Suspend Account'}
                            </span>
                            <StatusBadge status={draft.status} />
                        </button>
                    </div>

                    {/* Custom Plan */}
                    <div className="border border-gray-100 dark:border-slate-800 p-4">
                        <div className="flex items-center justify-between mb-1">
                            <div>
                                <p className="text-sm font-google font-bold text-slate-900 dark:text-slate-100">Custom Plan Override</p>
                                <p className="text-[10px] font-google text-slate-400 dark:text-slate-500 mt-0.5">Bypass standard tier limits with manual caps</p>
                            </div>
                            <Toggle
                                checked={draft.custom_plan_enabled}
                                onChange={v => set('custom_plan_enabled', v)}
                                label="Enable custom plan"
                            />
                        </div>

                        <AnimatePresence>
                            {draft.custom_plan_enabled && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                                    transition={{ duration: 0.2 }}
                                    className="overflow-hidden"
                                >
                                    <div className="mt-4 space-y-4 pt-4 border-t border-gray-100 dark:border-slate-800">
                                        <div>
                                            <label className="block text-[10px] font-google font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-1.5">
                                                Monthly Message Cap
                                            </label>
                                            <input
                                                type="number"
                                                min={0}
                                                placeholder="e.g. 50000"
                                                value={draft.custom_message_limit}
                                                onChange={e => set('custom_message_limit', e.target.value)}
                                                disabled={isSaving}
                                                className="w-full bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 px-3 py-2.5 text-sm font-google text-slate-900 dark:text-slate-200 focus:ring-1 focus:ring-indigo-500 outline-none transition-colors disabled:opacity-50 rounded-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-google font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-1.5">
                                                Active Bot Limit
                                            </label>
                                            <input
                                                type="number"
                                                min={0}
                                                placeholder="e.g. 10"
                                                value={draft.custom_bot_limit}
                                                onChange={e => set('custom_bot_limit', e.target.value)}
                                                disabled={isSaving}
                                                className="w-full bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 px-3 py-2.5 text-sm font-google text-slate-900 dark:text-slate-200 focus:ring-1 focus:ring-indigo-500 outline-none transition-colors disabled:opacity-50 rounded-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                            />
                                        </div>
                                        {!isValid && (
                                            <p className="text-[10px] font-google text-red-600 dark:text-red-400 flex items-center gap-1">
                                                <span className="material-symbols-outlined text-[12px]">warning</span>
                                                Values must be 0 or greater
                                            </p>
                                        )}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* Bot Visibility */}
                    <div>
                        <div className="flex items-center gap-2 mb-3">
                            <label className="text-[10px] font-google font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                                Deployed Bots
                            </label>
                            <span className="px-1.5 py-0.5 text-[10px] font-google font-bold bg-gray-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                                {companies.length}
                            </span>
                        </div>

                        {companies.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-8 border border-dashed border-gray-200 dark:border-slate-700">
                                <span className="material-symbols-outlined text-[32px] text-gray-200 dark:text-slate-700 mb-2">smart_toy</span>
                                <p className="text-[10px] font-google font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">No bots deployed</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {companies.map((bot, i) => (
                                    <div key={bot.id || i} className="flex items-center gap-3 p-3 border border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-900">
                                        <div className="w-7 h-7 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 flex items-center justify-center shrink-0">
                                            <span className="material-symbols-outlined text-[14px] text-slate-400 dark:text-slate-500">smart_toy</span>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-google font-bold text-slate-900 dark:text-slate-200 truncate">{bot.bot_name || bot.name || 'Unnamed Bot'}</p>
                                            <p className="text-[10px] font-mono text-slate-400 dark:text-slate-500 truncate">{bot.allowed_origin || bot.origin || '—'}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="sticky bottom-0 bg-white dark:bg-slate-950 border-t border-gray-100 dark:border-slate-800 p-4 flex gap-3">
                    <button
                        onClick={onClose}
                        disabled={isSaving}
                        className="flex-1 px-4 py-3 text-sm font-google font-bold uppercase tracking-widest border border-gray-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-900 transition-colors disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isSaving || !isValid}
                        className="flex-1 px-4 py-3 text-sm font-google font-bold uppercase tracking-widest bg-slate-900 dark:bg-indigo-600 text-white hover:bg-slate-800 dark:hover:bg-indigo-500 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {isSaving ? (
                            <>
                                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                Saving
                            </>
                        ) : 'Save Changes'}
                    </button>
                </div>
            </motion.div>
        </div>
    );
};

// ── Mobile user card ──────────────────────────────────────────────────────────
const UserCard = ({ u, onManage }) => {
    const usage = u.usage_tracking || {};
    return (
        <div className="bg-white dark:bg-slate-950 border border-gray-100 dark:border-slate-800 p-4 transition-colors">
            <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 flex items-center justify-center text-sm font-google font-bold text-slate-500 dark:text-slate-400 shrink-0">
                        {u.email?.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                        <p className="text-sm font-google font-bold text-slate-900 dark:text-slate-100 truncate" title={u.email}>{u.email}</p>
                        <p className="text-[10px] font-mono text-slate-400 dark:text-slate-500 truncate">{u.clerk_id}</p>
                    </div>
                </div>
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <TierBadge tier={u.role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : u.tier} />
                    <StatusBadge status={u.status} />
                </div>
            </div>

            <div className="mb-3">
                <UsageBar used={usage.messages_used} limit={usage.message_limit} />
            </div>

            <div className="flex items-center justify-between">
                <span className="text-[10px] font-google text-slate-400 dark:text-slate-500 flex items-center gap-1">
                    <span className="material-symbols-outlined text-[12px]">smart_toy</span>
                    {(u.companies || []).length} bot{(u.companies || []).length !== 1 ? 's' : ''}
                </span>
                <button
                    onClick={() => onManage(u)}
                    className="px-3 py-1.5 text-[10px] font-google font-bold uppercase tracking-widest bg-slate-900 dark:bg-slate-800 text-white hover:bg-slate-700 dark:hover:bg-slate-700 transition-colors"
                >
                    Manage
                </button>
            </div>
        </div>
    );
};

// ── Main component ────────────────────────────────────────────────────────────
const AdminDashboard = () => {
    const { user, isLoaded: isUserLoaded } = useUser();
    const queryClient = useQueryClient();
    const { userRole } = useUserRole();
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedUser, setSelectedUser] = useState(null);
    const authFetch = useAuthenticatedFetch();

    // ── Queries ───────────────────────────────────────────────────────────────
    const usersQuery = useQuery({
        queryKey: ['admin', 'users'],
        queryFn: () => authFetch('/api/admin/users'),
        enabled: isUserLoaded && !!user,
    });

    const statsQuery = useQuery({
        queryKey: ['admin', 'stats'],
        queryFn: () => authFetch('/api/admin/stats'),
        enabled: isUserLoaded && !!user,
    });

    const users = usersQuery.data || [];
    const stats = statsQuery.data || { total_users: 0, total_companies: 0 };
    const isLoading = usersQuery.isLoading || statsQuery.isLoading;
    const hasError = usersQuery.isError || statsQuery.isError;

    const refetchAll = () => {
        usersQuery.refetch();
        statsQuery.refetch();
    };

    // ── Mutations ─────────────────────────────────────────────────────────────
    const limitsMutation = useMutation({
        mutationFn: ({ clerkId, payload }) =>
            authFetch(`/api/admin/users/${clerkId}/limits`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
            queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] });
            setSelectedUser(null);
        },
    });

    const handleSaveLimits = (payload) => {
        if (!selectedUser) return;
        limitsMutation.mutate({ clerkId: selectedUser.clerk_id, payload });
    };

    // ── Search: match email, clerk_id, or any company name ───────────────────
    const filteredUsers = users.filter(u => {
        const term = searchTerm.toLowerCase();
        if (!term) return true;
        return (
            u.email?.toLowerCase().includes(term) ||
            u.clerk_id?.toLowerCase().includes(term) ||
            (u.companies || []).some(c =>
                (c.bot_name || c.name || '').toLowerCase().includes(term) ||
                (c.allowed_origin || c.origin || '').toLowerCase().includes(term)
            )
        );
    });

    return (
        <div className="grid gap-px bg-gray-100 dark:bg-slate-800 border-b border-gray-100 dark:border-slate-800 transition-colors duration-500">

            {/* Header */}
            <div className="bg-white dark:bg-slate-950 p-8 lg:p-10 flex flex-col md:flex-row md:items-end justify-between gap-6 transition-colors duration-500">
                <div>
                    <div className="px-2 py-0.5 border border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-900 text-sm uppercase tracking-widest font-bold text-slate-400 dark:text-slate-500 font-display flex items-center gap-2 w-fit mb-4 rounded-none transition-colors">
                        <span className="material-symbols-outlined text-[14px]">verified_user</span>
                        Super Admin Console
                    </div>
                    <h1 className="text-xl font-display font-black tracking-tight leading-none text-slate-900 dark:text-slate-200 uppercase transition-colors">
                        Platform <span className="text-slate-400 dark:text-slate-600">Management</span>
                    </h1>
                    <p className="text-md font-mono text-slate-500 dark:text-slate-400 leading-relaxed mt-2 transition-colors">Monitor ecosystem health and manage user subscriptions.</p>
                </div>

                <div className="flex items-center gap-px bg-gray-100 dark:bg-slate-800 border border-gray-100 dark:border-slate-800 transition-colors duration-500">
                    <div className="bg-white dark:bg-slate-950 relative flex items-center transition-colors">
                        <span className="material-symbols-outlined absolute left-3 text-[14px] text-slate-400 dark:text-slate-500">search</span>
                        <input
                            type="text"
                            placeholder="Search users, bots, origins..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-9 pr-4 py-2.5 bg-transparent border-none focus:outline-none text-sm text-slate-900 dark:text-slate-200 font-medium w-64 rounded-none transition-colors"
                        />
                    </div>
                    <button
                        onClick={refetchAll}
                        disabled={isLoading}
                        className="p-3 bg-slate-900 dark:bg-indigo-600 text-white hover:bg-slate-800 dark:hover:bg-indigo-500 disabled:opacity-50 transition-colors"
                    >
                        <span className="material-symbols-outlined text-[16px]">monitoring</span>
                    </button>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px bg-gray-100 dark:bg-slate-800 border-t border-b border-gray-100 dark:border-slate-800 transition-colors duration-500">
                {isLoading ? (
                    <div className="col-span-4 bg-white dark:bg-slate-950 p-8 transition-colors"><SkeletonLoader.Stats /></div>
                ) : (
                    [
                        { label: 'Total Users', value: stats.total_users, icon: 'group', color: 'text-slate-900 dark:text-slate-200' },
                        { label: 'Active Companies', value: stats.total_companies, icon: 'corporate_fare', color: 'text-slate-900 dark:text-slate-200' },
                        { label: 'System Health', value: '99.9%', icon: 'monitoring', color: 'text-emerald-600 dark:text-emerald-400' },
                        { label: 'Avg. Latency', value: '4.2s', icon: 'bolt', color: 'text-amber-600 dark:text-amber-400' },
                    ].map((s, i) => (
                        <div key={i} className="bg-white dark:bg-slate-950 p-8 transition-colors duration-500">
                            <div className="flex items-center justify-between mb-4">
                                <div className={`p-2 border border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-900 rounded-none transition-colors ${s.color}`}>
                                    <span className="material-symbols-outlined text-[16px] transition-colors">{s.icon}</span>
                                </div>
                                <span className="text-md uppercase tracking-widest font-bold text-slate-400 dark:text-slate-500 font-display transition-colors">Live</span>
                            </div>
                            <p className="text-md uppercase tracking-widest font-bold text-slate-400 dark:text-slate-500 font-display mb-1 transition-colors">{s.label}</p>
                            <h3 className="text-xl md:text-2xl font-display font-bold text-slate-900 dark:text-slate-200 transition-colors">{s.value}</h3>
                        </div>
                    ))
                )}
            </div>

            {/* Main Content */}
            <div className="bg-white dark:bg-slate-950 border-t border-gray-100 dark:border-slate-800 transition-colors duration-500">
                <div className="p-6 lg:p-8">
                    {isLoading ? (
                        <SkeletonLoader.Table />
                    ) : hasError ? (
                        <div className="flex flex-col items-center justify-center py-20 border border-red-100 dark:border-red-900/40 bg-red-50 dark:bg-red-900/10">
                            <span className="material-symbols-outlined text-[40px] text-red-300 dark:text-red-700 mb-3">error</span>
                            <p className="text-sm font-google font-bold text-red-600 dark:text-red-400 mb-1">Failed to load data</p>
                            <p className="text-[11px] font-google text-red-400 dark:text-red-600 mb-4">Check your connection and try again</p>
                            <button
                                onClick={refetchAll}
                                className="px-4 py-2 text-[10px] font-google font-bold uppercase tracking-widest bg-red-600 text-white hover:bg-red-700 transition-colors"
                            >
                                Retry
                            </button>
                        </div>
                    ) : (
                        <>
                            {/* Mobile: Bento cards */}
                            <div className="md:hidden space-y-3">
                                {filteredUsers.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-16 border border-dashed border-gray-200 dark:border-slate-700">
                                        <span className="material-symbols-outlined text-[40px] text-gray-200 dark:text-slate-700 mb-3">manage_accounts</span>
                                        <p className="text-[11px] font-google font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">No users found</p>
                                    </div>
                                ) : filteredUsers.map(u => (
                                    <UserCard key={u.clerk_id} u={u} onManage={setSelectedUser} />
                                ))}
                            </div>

                            {/* Desktop: sticky-header table */}
                            <div className="hidden md:block overflow-x-auto max-h-[640px] overflow-y-auto border border-gray-100 dark:border-slate-800 custom-scrollbar">
                                <table className="w-full text-left border-collapse">
                                    <thead className="sticky top-0 z-10 bg-gray-50 dark:bg-slate-900 shadow-sm transition-colors">
                                        <tr>
                                            <th className="px-6 py-4 text-[11px] font-google font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 border-r border-gray-100 dark:border-slate-800">Entity Details</th>
                                            <th className="px-6 py-4 text-[11px] font-google font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 border-r border-gray-100 dark:border-slate-800">Tier / Status</th>
                                            <th className="px-6 py-4 text-[11px] font-google font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 border-r border-gray-100 dark:border-slate-800">Usage</th>
                                            <th className="px-6 py-4 text-[11px] font-google font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 border-r border-gray-100 dark:border-slate-800">Bots</th>
                                            <th className="px-6 py-4 text-[11px] font-google font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 text-right">Controls</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                                        {filteredUsers.length === 0 ? (
                                            <tr>
                                                <td colSpan={5}>
                                                    <div className="flex flex-col items-center justify-center py-16">
                                                        <span className="material-symbols-outlined text-[40px] text-gray-200 dark:text-slate-700 mb-3">manage_accounts</span>
                                                        <p className="text-[11px] font-google font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">No users found</p>
                                                    </div>
                                                </td>
                                            </tr>
                                        ) : filteredUsers.map(u => {
                                            const usage = u.usage_tracking || {};
                                            const botCount = (u.companies || []).length;
                                            return (
                                                <tr key={u.clerk_id} className="hover:bg-gray-50 dark:hover:bg-slate-900/50 transition-colors">
                                                    <td className="px-6 py-4 border-r border-gray-100 dark:border-slate-800">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-9 h-9 bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 flex items-center justify-center text-sm font-google font-bold text-slate-500 shrink-0">
                                                                {u.email?.charAt(0).toUpperCase()}
                                                            </div>
                                                            <div className="min-w-0">
                                                                <p className="text-sm font-google font-bold text-slate-900 dark:text-slate-200 truncate max-w-[200px]" title={u.email}>{u.email}</p>
                                                                <p className="text-[10px] font-mono text-slate-400 dark:text-slate-500 truncate max-w-[200px]">{u.clerk_id}</p>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 border-r border-gray-100 dark:border-slate-800">
                                                        <div className="flex flex-col gap-1.5">
                                                            <TierBadge tier={u.role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : u.tier} />
                                                            <StatusBadge status={u.status} />
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 border-r border-gray-100 dark:border-slate-800 min-w-[160px]">
                                                        <UsageBar used={usage.messages_used} limit={usage.message_limit} />
                                                    </td>
                                                    <td className="px-6 py-4 border-r border-gray-100 dark:border-slate-800">
                                                        <span className="inline-flex items-center gap-1 text-[11px] font-google font-bold text-slate-500 dark:text-slate-400">
                                                            <span className="material-symbols-outlined text-[13px]">smart_toy</span>
                                                            {botCount}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <button
                                                            onClick={() => setSelectedUser(u)}
                                                            className="px-3 py-1.5 text-[10px] font-google font-bold uppercase tracking-widest bg-slate-900 dark:bg-slate-800 text-white hover:bg-slate-700 dark:hover:bg-slate-700 transition-colors"
                                                        >
                                                            Manage
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Slide-over */}
            <AnimatePresence>
                {selectedUser && (
                    <ManageSlideOver
                        user={selectedUser}
                        onClose={() => setSelectedUser(null)}
                        onSave={handleSaveLimits}
                        isSaving={limitsMutation.isPending}
                    />
                )}
            </AnimatePresence>
        </div>
    );
};

export default AdminDashboard;
