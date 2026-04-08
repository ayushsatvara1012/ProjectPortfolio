import React, { useState } from 'react';
import { motion } from 'framer-motion';
import SkeletonLoader from '../components/SkeletonLoader';
import { useUser } from '@clerk/clerk-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useUserRole } from '../context/UserContext';
import { useAuthenticatedFetch } from '../hooks/useApiCall';

const AdminDashboard = () => {
    const { user, isLoaded: isUserLoaded } = useUser();
    const queryClient = useQueryClient();
    const { userRole } = useUserRole();
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState('users');
    const authFetch = useAuthenticatedFetch();

    // ── useQuery: 3 parallel admin queries ────────────────────────────────────
    const usersQuery = useQuery({
        queryKey: ['admin', 'users'],
        queryFn: () => authFetch('/api/admin/users'),
        enabled: isUserLoaded && !!user,
    });

    const companiesQuery = useQuery({
        queryKey: ['admin', 'companies'],
        queryFn: () => authFetch('/api/admin/companies'),
        enabled: isUserLoaded && !!user,
    });

    const statsQuery = useQuery({
        queryKey: ['admin', 'stats'],
        queryFn: () => authFetch('/api/admin/stats'),
        enabled: isUserLoaded && !!user,
    });

    const users = usersQuery.data || [];
    const companies = companiesQuery.data || [];
    const stats = statsQuery.data || { total_users: 0, total_companies: 0 };
    const isLoading = usersQuery.isLoading || companiesQuery.isLoading || statsQuery.isLoading;

    const refetchAll = () => {
        usersQuery.refetch();
        companiesQuery.refetch();
        statsQuery.refetch();
    };

    // ── useMutation: update user tier ──────────────────────────────────────
    const updateUserMutation = useMutation({
        mutationFn: ({ clerkId, field, value }) =>
            authFetch(`/api/admin/users/${clerkId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ [field]: value }),
            }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
            queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] });
        },
    });

    const handleUpdateUser = (clerkId, field, value) => {
        updateUserMutation.mutate({ clerkId, field, value });
    };

    // ── useMutation: delete company ───────────────────────────────────────
    const deleteCompanyMutation = useMutation({
        mutationFn: (companyId) =>
            authFetch(`/api/admin/companies/${companyId}`, { method: 'DELETE' }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin', 'companies'] });
            queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] });
            queryClient.invalidateQueries({ queryKey: ['bots'] });
        },
    });

    const handleDeleteCompany = (companyId) => {
        if (!window.confirm("Are you sure you want to delete this company? All knowledge data will be lost.")) return;
        deleteCompanyMutation.mutate(companyId);
    };

    const isActionLoading = updateUserMutation.isPending || deleteCompanyMutation.isPending;

    const filteredUsers = users.filter(u =>
        u.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.clerk_id?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const filteredCompanies = companies.filter(c =>
        c.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.origin?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="grid gap-px bg-gray-100 dark:bg-slate-800 border-b border-gray-100 dark:border-slate-800 transition-colors duration-500">
            {/* Header Cell */}
            <div className="bg-white dark:bg-slate-950 p-8 lg:p-10 flex flex-col md:flex-row md:items-end justify-between gap-6 transition-colors duration-500">
                <div>
                    <div className="px-2 py-0.5 border border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-900 text-sm  uppercase tracking-widest font-bold text-slate-400 dark:text-slate-500 font-display flex items-center gap-2 w-fit mb-4 rounded-none transition-colors">
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
                            placeholder="Search users or companies..."
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

            {/* Admin Stats Grid (Flush Cells) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px bg-gray-100 dark:bg-slate-800 border-t border-b border-gray-100 dark:border-slate-800 transition-colors duration-500">
                {isLoading ? (
                    <div className="col-span-4 bg-white dark:bg-slate-950 p-8 transition-colors"><SkeletonLoader.Stats /></div>
                ) : (
                    [
                        { label: 'Total Users', value: stats.total_users, icon: 'group', color: 'text-slate-900 dark:text-slate-200' },
                        { label: 'Active Companies', value: stats.total_companies, icon: 'corporate_fare', color: 'text-slate-900 dark:text-slate-200' },
                        { label: 'System Health', value: '99.9%', icon: 'monitoring', color: 'text-emerald-600 dark:text-emerald-400' },
                        { label: 'Avg. Latency', value: '4.2s', icon: 'bolt', color: 'text-amber-600 dark:text-amber-400' }
                    ].map((s, i) => (
                        <div key={i} className="bg-white dark:bg-slate-950 p-8 transition-colors duration-500">
                            <div className="flex items-center justify-between mb-4">
                                <div className={`p-2 border border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-900 rounded-none transition-colors ${s.color}`}>
                                    <span className="material-symbols-outlined text-[16px] transition-colors">{s.icon}</span>
                                </div>
                                <span className="text-md  uppercase tracking-widest font-bold text-slate-400 dark:text-slate-500 font-display transition-colors">Live</span>
                            </div>
                            <p className="text-md  uppercase tracking-widest font-bold text-slate-400 dark:text-slate-500 font-display mb-1 transition-colors">{s.label}</p>
                            <h3 className="text-xl md:text-2xl font-display font-bold text-slate-900 dark:text-slate-200 transition-colors">{s.value}</h3>
                        </div>
                    ))
                )}
            </div>

            {/* Main Management Cell */}
            <div className="bg-white dark:bg-slate-950 border-t border-gray-100 dark:border-slate-800 transition-colors duration-500">
                {/* Tabs Cell Header */}
                <div className="flex gap-px bg-gray-100 dark:bg-slate-800 border-b border-gray-100 dark:border-slate-800 transition-colors">
                    <button
                        onClick={() => setActiveTab('users')}
                        className={`px-8 py-4 text-sm  uppercase tracking-widest font-bold font-display transition-colors ${activeTab === 'users' ? 'bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-200 border-b-2 border-slate-900 dark:border-indigo-500' : 'bg-gray-50 dark:bg-slate-900 text-slate-400 dark:text-slate-500 hover:bg-white dark:hover:bg-slate-800 hover:text-slate-600 dark:hover:text-slate-300'}`}
                    >
                        User Entities
                    </button>
                    <button
                        onClick={() => setActiveTab('companies')}
                        className={`px-8 py-4 text-sm  uppercase tracking-widest font-bold font-display transition-colors ${activeTab === 'companies' ? 'bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-200 border-b-2 border-slate-900 dark:border-indigo-500' : 'bg-gray-50 dark:bg-slate-900 text-slate-400 dark:text-slate-500 hover:bg-white dark:hover:bg-slate-800 hover:text-slate-600 dark:hover:text-slate-300'}`}
                    >
                        Company Nodes
                    </button>
                </div>

                {/* Table Content Area */}
                <div className="p-8">
                    {isLoading ? <SkeletonLoader.Table /> : (
                        activeTab === 'users' ? (
                            <div className="overflow-x-auto max-h-[640px] overflow-y-auto border border-gray-100 dark:border-slate-800 transition-colors custom-scrollbar">
                                <table className="w-full text-left border-collapse">
                                    <thead className="sticky top-0 z-10 bg-gray-50 dark:bg-slate-900 shadow-sm transition-colors">
                                        <tr>
                                            <th className="px-6 py-4 text-md  uppercase tracking-widest font-bold text-slate-400 dark:text-slate-500 font-display border-r border-gray-100 dark:border-slate-800 transition-colors">Entity Details</th>
                                            <th className="px-6 py-4 text-md  uppercase tracking-widest font-bold text-slate-400 dark:text-slate-500 font-display border-r border-gray-100 dark:border-slate-800 transition-colors">Access Tier</th>
                                            <th className="px-6 py-4 text-md  uppercase tracking-widest font-bold text-slate-400 dark:text-slate-500 font-display text-right transition-colors">Settings</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                                        {filteredUsers.map((u) => (
                                            <tr key={u.clerk_id} className="hover:bg-gray-50 dark:hover:bg-slate-900 transition-colors">
                                                <td className="px-6 py-5 border-r border-gray-100 dark:border-slate-800">
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-10 h-10 border border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-950 flex items-center justify-center text-xl md:text-2xl font-display font-bold text-slate-400 dark:text-slate-500 transition-colors">
                                                            {u.email?.charAt(0).toUpperCase()}
                                                        </div>
                                                        <div>
                                                            <p className="text-md text-slate-900 dark:text-slate-200 font-display transition-colors">{u.email}</p>
                                                            <p className="text-sm font-mono text-slate-400 dark:text-slate-500 mt-0.5 transition-colors">{u.clerk_id}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-5 border-r border-gray-100 dark:border-slate-800 transition-colors">
                                                    <select
                                                        value={u.tier || 'FREE'}
                                                        onChange={(e) => handleUpdateUser(u.clerk_id, 'tier', e.target.value)}
                                                        className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-none px-3 py-1.5 text-sm uppercase tracking-widest font-bold text-slate-700 dark:text-slate-300 font-display focus:ring-1 focus:ring-indigo-500 outline-none transition-colors"
                                                    >
                                                        <option value="FREE">Free</option>
                                                        <option value="STARTER">Starter</option>
                                                        <option value="PRO">Pro</option>
                                                        <option value="ENTERPRISE">Enterprise</option>
                                                    </select>
                                                </td>
                                                <td className="px-6 py-5 text-right border-gray-100 dark:border-slate-800 transition-colors">
                                                    <button 
                                                        disabled={isActionLoading}
                                                        className="p-2.5 bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 text-slate-400 dark:text-slate-500 hover:bg-white dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200 transition-colors disabled:opacity-50"
                                                    >
                                                        {isActionLoading ? <span className="text-md  uppercase tracking-widest font-bold font-display leading-none">...</span> : <span className="material-symbols-outlined text-[16px]">settings</span>}
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="overflow-x-auto max-h-[640px] overflow-y-auto border border-gray-100 dark:border-slate-800 transition-colors custom-scrollbar">
                                <table className="w-full text-left border-collapse">
                                    <thead className="sticky top-0 z-10 bg-gray-50 dark:bg-slate-900 shadow-sm transition-colors">
                                        <tr>
                                            <th className="px-6 py-4 text-md  uppercase tracking-widest font-bold text-slate-400 dark:text-slate-500 font-display border-r border-gray-100 dark:border-slate-800 transition-colors">Company Node</th>
                                            <th className="px-6 py-4 text-md  uppercase tracking-widest font-bold text-slate-400 dark:text-slate-500 font-display border-r border-gray-100 dark:border-slate-800 transition-colors">Allowed Origin</th>
                                            <th className="px-6 py-4 text-md  uppercase tracking-widest font-bold text-slate-400 dark:text-slate-500 font-display text-right transition-colors">Node Controls</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                                        {filteredCompanies.map((c) => (
                                            <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-slate-900 transition-colors">
                                                <td className="px-6 py-5 border-r border-gray-100 dark:border-slate-800 transition-colors">
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-10 h-10 border border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-950 flex items-center justify-center text-slate-400 dark:text-slate-500 transition-colors">
                                                            <span className="material-symbols-outlined text-[20px]">corporate_fare</span>
                                                        </div>
                                                        <span className="text-md  uppercase tracking-widest font-bold text-slate-900 dark:text-slate-200 font-display transition-colors">{c.name}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-5 border-r border-gray-100 dark:border-slate-800 text-sm text-slate-500 dark:text-slate-400 font-medium transition-colors">
                                                    {c.origin}
                                                </td>
                                                <td className="px-6 py-5 text-right border-gray-100 dark:border-slate-800 transition-colors">
                                                    <button 
                                                        onClick={() => handleDeleteCompany(c.id)} 
                                                        disabled={isActionLoading}
                                                        className="p-2.5 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/50 text-red-600 dark:text-red-400 hover:bg-red-600 dark:hover:bg-red-700 hover:text-white dark:hover:text-slate-200 transition-colors disabled:opacity-50"
                                                    >
                                                        {isActionLoading ? <span className="text-md  uppercase tracking-widest font-bold font-display leading-none">...</span> : <span className="material-symbols-outlined text-[16px]">delete</span>}
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {filteredCompanies.length === 0 && (
                                    <div className="flex flex-col items-center justify-center py-20 bg-gray-50 dark:bg-slate-900 transition-colors duration-500">
                                        <span className="material-symbols-outlined text-[48px] text-gray-200 dark:text-slate-700 mb-4 transition-colors">corporate_fare</span>
                                        <p className="text-md  uppercase tracking-widest font-bold text-slate-400 dark:text-slate-500 font-display transition-colors">No Node Entities Found</p>
                                    </div>
                                )}
                            </div>
                        )
                    )}
                </div>
            </div>
        </div>
    );
};

export default AdminDashboard;
