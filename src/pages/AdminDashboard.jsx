import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
    Users, Building2, Shield, Settings, Trash2, Edit3,
    Search, Filter, ChevronRight, Activity, Globe,
    Calendar, Mail, CheckCircle2, AlertCircle,
    ShieldCheck, Zap
} from 'lucide-react';
import SkeletonLoader from '../components/SkeletonLoader';
import Logo from '../components/Logo';
import Loader from '../components/Loader';
import { useAuth, useUser } from '@clerk/clerk-react';
import { useUserRole } from '../context/UserContext';

const AdminDashboard = () => {
    const { getToken } = useAuth();
    const { user, isLoaded: isUserLoaded } = useUser();
    const [users, setUsers] = useState([]);
    const [companies, setCompanies] = useState([]);
    const [stats, setStats] = useState({ total_users: 0, total_companies: 0 });
    const [isLoading, setIsLoading] = useState(true);
    const [isActionLoading, setIsActionLoading] = useState(false);
    const { userRole, isLoading: isContextLoading } = useUserRole();
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState('users'); // 'users' or 'companies'

    useEffect(() => {
        if (isUserLoaded && user) {
            fetchAdminData();
        }
    }, [isUserLoaded, user, getToken]);

    const fetchAdminData = async () => {
        setIsLoading(true);
        try {
            const token = await getToken();
            const baseUrl = import.meta.env.VITE_API_URL || '';

            const [usersRes, companiesRes, statsRes] = await Promise.all([
                fetch(`${baseUrl}/api/admin/users`, { headers: { 'Authorization': `Bearer ${token}` } }),
                fetch(`${baseUrl}/api/admin/companies`, { headers: { 'Authorization': `Bearer ${token}` } }),
                fetch(`${baseUrl}/api/admin/stats`, { headers: { 'Authorization': `Bearer ${token}` } })
            ]);

            if (usersRes.ok) setUsers(await usersRes.json());
            if (companiesRes.ok) setCompanies(await companiesRes.json());
            if (statsRes.ok) setStats(await statsRes.json());
        } catch (error) {
            console.error("Error fetching admin data:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleUpdateUser = async (clerkId, field, value) => {
        setIsActionLoading(true);
        try {
            const token = await getToken();
            const baseUrl = import.meta.env.VITE_API_URL || '';
            const res = await fetch(`${baseUrl}/api/admin/users/${clerkId}`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ [field]: value })
            });
            if (res.ok) await fetchAdminData();
        } catch (error) {
            console.error("Error updating user:", error);
        } finally {
            setIsActionLoading(false);
        }
    };

    const handleDeleteCompany = async (companyId) => {
        if (!window.confirm("Are you sure you want to delete this company? All knowledge data will be lost.")) return;
        setIsActionLoading(true);
        try {
            const token = await getToken();
            const baseUrl = import.meta.env.VITE_API_URL || '';
            const res = await fetch(`${baseUrl}/api/admin/companies/${companyId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) await fetchAdminData();
        } catch (error) {
            console.error("Error deleting company:", error);
        } finally {
            setIsActionLoading(false);
        }
    };

    const filteredUsers = users.filter(u =>
        u.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.clerk_id?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const filteredCompanies = companies.filter(c =>
        c.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.origin?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (!isUserLoaded) {
        return (
            <div className="w-full h-screen bg-white dark:bg-slate-950 flex items-center justify-center transition-colors duration-500">
                <Logo className="w-[160px] h-20" />
            </div>
        );
    }

    if (isContextLoading) {
        return <Loader fullScreen />;
    }


    return (
        <div className="w-full min-h-screen bg-slate-50 dark:bg-[#0A0A0A] pt-28 pb-12 px-4 sm:px-6 lg:px-8 relative">
            <div className="max-w-7xl mx-auto relative z-10 w-full">
                {/* Header Section */}
                <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
                    <div>
                        <div className="px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-[#1A1A1A] text-[11px] font-mono uppercase tracking-wider text-slate-600 dark:text-slate-400 flex items-center gap-2 w-fit mb-4">
                            <ShieldCheck className="w-3.5 h-3.5" />
                            Super Admin Console
                        </div>
                        <h1 className="text-3xl lg:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
                            Platform <span className="bg-linear-to-r from-red-600 to-blue-600 bg-clip-text text-transparent">Management</span>
                        </h1>
                        <p className="text-slate-500 dark:text-slate-400 mt-2 font-medium">Monitor ecosystem health and manage user subscriptions.</p>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="relative group">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                            <input
                                type="text"
                                placeholder="Search users or companies..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-10 pr-4 py-2.5 bg-transparent border border-slate-300 dark:border-slate-800 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono text-xs text-slate-900 dark:text-white w-64"
                            />
                        </div>
                        <button 
                            onClick={fetchAdminData} 
                            disabled={isLoading}
                            className="p-2.5 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-md hover:bg-slate-800 dark:hover:bg-white transition-colors disabled:opacity-50"
                        >
                            <Activity className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Admin Stats Grid */}
                {isLoading ? <SkeletonLoader.Stats /> : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                        {[
                            { label: 'Total Users', value: stats.total_users, icon: Users, color: 'text-indigo-600' },
                            { label: 'Active Companies', value: stats.total_companies, icon: Building2, color: 'text-blue-600' },
                            { label: 'System Health', value: '99.9%', icon: Activity, color: 'text-emerald-500' },
                            { label: 'Avg. Latency', value: '4.2s', icon: Zap, color: 'text-amber-500' }
                        ].map((s, i) => (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.1 }}
                                className="bg-white dark:bg-[#111111] border border-slate-200 dark:border-slate-800 p-4 rounded-xl hover:shadow-md transition-shadow"
                            >
                                <div className="flex items-center justify-between mb-3">
                                    <div className={`p-1.5 rounded-lg bg-slate-50 dark:bg-[#1A1A1A] border border-slate-200 dark:border-slate-800 ${s.color}`}>
                                        <s.icon className="w-3.5 h-3.5" />
                                    </div>
                                    <span className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest">Live</span>
                                </div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">{s.label}</p>
                                <h3 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">{s.value}</h3>
                            </motion.div>
                        ))}
                    </div>
                )}

                {/* Main Management Tabs */}
                <div className="bg-white dark:bg-[#111111] border border-slate-200 dark:border-slate-800 rounded-xl p-5 lg:p-6 min-h-[500px]">
                    <div className="flex gap-2 mb-8 border-b border-slate-200 dark:border-slate-800 pb-4">
                        <button
                            onClick={() => setActiveTab('users')}
                            className={`px-4 py-2 rounded-md text-[10px] font-bold uppercase tracking-widest transition-colors ${activeTab === 'users' ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                        >
                            Users
                        </button>
                        <button
                            onClick={() => setActiveTab('companies')}
                            className={`px-4 py-2 rounded-md text-[10px] font-bold uppercase tracking-widest transition-colors ${activeTab === 'companies' ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                        >
                            Companies
                        </button>
                    </div>

                    <div className="overflow-hidden">
                        {isLoading ? <SkeletonLoader.Table /> : (
                            activeTab === 'users' ? (
                                <>
                                    {/* Desktop View */}
                                    <div className="hidden md:block overflow-x-auto">
                                        <table className="w-full text-left border-collapse">
                                            <thead>
                                                <tr className="text-[9px] font-bold uppercase tracking-widest text-slate-400">
                                                    <th className="px-4 py-3 border-b border-slate-200 dark:border-slate-800">User Entity</th>
                                                    <th className="px-4 py-3 border-b border-slate-200 dark:border-slate-800">Subscription Tier</th>
                                                    <th className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 text-right">Settings</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {filteredUsers.map((u) => (
                                                    <tr key={u.clerk_id} className="group hover:bg-slate-50 dark:hover:bg-[#1A1A1A] transition-colors border-b border-slate-200 dark:border-slate-800">
                                                        <td className="px-4 py-4">
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-8 h-8 rounded-md bg-slate-100 dark:bg-[#1A1A1A] flex items-center justify-center font-black text-[10px] text-slate-500 border border-slate-200 dark:border-slate-800">
                                                                    {u.email?.charAt(0).toUpperCase()}
                                                                </div>
                                                                <div>
                                                                    <p className="text-xs font-bold text-slate-900 dark:text-white">{u.email}</p>
                                                                    <p className="text-[9px] text-slate-400 font-mono mt-0.5">{u.clerk_id}</p>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-4">
                                                            <select
                                                                value={u.tier || 'FREE'}
                                                                onChange={(e) => handleUpdateUser(u.clerk_id, 'tier', e.target.value)}
                                                                className="bg-transparent border border-slate-300 dark:border-slate-800 rounded-md px-2 py-1 text-[10px] font-mono font-bold uppercase tracking-widest text-slate-700 dark:text-slate-300 focus:ring-1 focus:ring-indigo-500 outline-none"
                                                            >
                                                                <option value="FREE">Free</option>
                                                                <option value="STARTER">Starter</option>
                                                                <option value="PRO">Pro</option>
                                                                <option value="ENTERPRISE">Enterprise</option>
                                                            </select>
                                                        </td>
                                                         <td className="px-4 py-4 text-right">
                                                            <button 
                                                                disabled={isActionLoading}
                                                                className="p-2 text-slate-400 hover:text-indigo-600 transition-colors disabled:opacity-50"
                                                            >
                                                                {isActionLoading ? <span className="text-[10px] font-mono leading-none">...</span> : <Settings className="w-3.5 h-3.5" />}
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>

                                    {/* Mobile View */}
                                    <div className="md:hidden flex flex-col gap-4">
                                        {filteredUsers.map((u) => (
                                            <div key={u.clerk_id} className="bg-slate-50 dark:bg-[#1A1A1A] p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                                                <div className="flex items-center gap-3 mb-4">
                                                    <div className="w-10 h-10 rounded-md bg-white dark:bg-slate-900 flex items-center justify-center font-black text-slate-500 border border-slate-200 dark:border-slate-800">
                                                        {u.email?.charAt(0).toUpperCase()}
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{u.email}</p>
                                                        <p className="text-[9px] text-slate-400 font-mono truncate">{u.clerk_id}</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-800">
                                                    <select
                                                        value={u.tier || 'FREE'}
                                                        onChange={(e) => handleUpdateUser(u.clerk_id, 'tier', e.target.value)}
                                                        className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-md px-3 py-1.5 text-[10px] font-mono font-bold uppercase tracking-widest text-slate-700 dark:text-slate-300 min-h-[44px]"
                                                    >
                                                        <option value="FREE">Free</option>
                                                        <option value="STARTER">Starter</option>
                                                        <option value="PRO">Pro</option>
                                                        <option value="ENTERPRISE">Enterprise</option>
                                                    </select>
                                                    <button className="p-3 text-slate-400 hover:text-indigo-600 transition-colors border border-slate-200 dark:border-slate-800 rounded-md bg-white dark:bg-slate-900 min-h-[44px]">
                                                        <Settings className="w-5 h-5" />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </>
                            ) : (
                                <>
                                    {/* Desktop View */}
                                    <div className="hidden md:block overflow-x-auto">
                                        <table className="w-full text-left border-collapse">
                                            <thead>
                                                <tr className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                                                    <th className="px-4 py-3 border-b border-slate-200 dark:border-slate-800">Company Entity</th>
                                                    <th className="px-4 py-3 border-b border-slate-200 dark:border-slate-800">Allowed Origin</th>
                                                    <th className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 text-right">Platform Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {filteredCompanies.map((c) => (
                                                    <tr key={c.id} className="group hover:bg-slate-50 dark:hover:bg-[#1A1A1A] transition-colors border-b border-slate-200 dark:border-slate-800">
                                                        <td className="px-4 py-4">
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-8 h-8 rounded-md bg-slate-100 dark:bg-[#1A1A1A] text-slate-500 flex items-center justify-center border border-slate-200 dark:border-slate-800">
                                                                    <Building2 className="w-4 h-4" />
                                                                </div>
                                                                <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-tight">{c.name}</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-4 text-xs font-mono text-slate-500">
                                                            {c.origin}
                                                        </td>
                                                         <td className="px-4 py-4 text-right">
                                                            <button 
                                                                onClick={() => handleDeleteCompany(c.id)} 
                                                                disabled={isActionLoading}
                                                                className="p-2.5 text-slate-400 hover:text-red-500 transition-colors bg-slate-100 dark:bg-[#1A1A1A] border border-slate-200 dark:border-slate-800 rounded-md disabled:opacity-50"
                                                            >
                                                                {isActionLoading ? <span className="text-[10px] font-mono">...</span> : <Trash2 className="w-4 h-4" />}
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>

                                    {/* Mobile View */}
                                    <div className="md:hidden flex flex-col gap-4">
                                        {filteredCompanies.map((c) => (
                                            <div key={c.id} className="bg-slate-50 dark:bg-[#1A1A1A] p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                                                <div className="flex items-center gap-3 mb-4">
                                                    <div className="w-10 h-10 rounded-md bg-white dark:bg-slate-900 flex items-center justify-center text-slate-500 border border-slate-200 dark:border-slate-800">
                                                        <Building2 className="w-5 h-5" />
                                                    </div>
                                                    <p className="text-sm font-bold text-slate-900 dark:text-white uppercase truncate">{c.name}</p>
                                                </div>
                                                <p className="text-[10px] font-mono text-slate-400 mb-4 px-1 truncate">{c.origin}</p>
                                                <div className="flex items-center justify-end pt-4 border-t border-slate-200 dark:border-slate-800">
                                                    <button 
                                                        onClick={() => handleDeleteCompany(c.id)} 
                                                        className="p-3 text-red-500 transition-colors border border-slate-200 dark:border-slate-800 rounded-md bg-white dark:bg-slate-900 min-h-[44px] flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                        Delete Node
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </>
                            )
                        )}
                        {!isLoading && activeTab === 'companies' && companies.length === 0 && (
                            <div className="flex flex-col items-center justify-center py-20">
                                <Building2 className="w-12 h-12 text-slate-200 mb-4" />
                                <p className="text-slate-400 font-medium text-sm">No registered companies found.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdminDashboard;
