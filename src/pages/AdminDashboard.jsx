import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
    Users, Building2, Shield, Settings, Trash2, Edit3, 
    Search, Filter, ChevronRight, Activity, Globe, 
    Calendar, Mail, Loader2, CheckCircle2, AlertCircle, 
    ShieldCheck, Zap
} from 'lucide-react';
import { useAuth, useUser } from '@clerk/clerk-react';

const AdminDashboard = () => {
    const { getToken } = useAuth();
    const { user, isLoaded: isUserLoaded } = useUser();
    const [users, setUsers] = useState([]);
    const [companies, setCompanies] = useState([]);
    const [stats, setStats] = useState({ total_users: 0, total_companies: 0 });
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState('users'); // 'users' or 'companies'

    useEffect(() => {
        if (isUserLoaded && user) {
            const authorizedEmail = import.meta.env.VITE_ADMIN_EMAIL;
            if (user.primaryEmailAddress?.emailAddress === authorizedEmail) {
                fetchAdminData();
            }
        }
    }, [isUserLoaded, user]);

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
            if (res.ok) fetchAdminData();
        } catch (error) {
            console.error("Error updating user:", error);
        }
    };

    const handleDeleteCompany = async (companyId) => {
        if (!window.confirm("Are you sure you want to delete this company? All knowledge data will be lost.")) return;
        try {
            const token = await getToken();
            const baseUrl = import.meta.env.VITE_API_URL || '';
            const res = await fetch(`${baseUrl}/api/admin/companies/${companyId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) fetchAdminData();
        } catch (error) {
            console.error("Error deleting company:", error);
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
            <div className="h-screen w-full flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950">
                <Loader2 className="w-10 h-10 text-indigo-600 animate-spin mb-4" />
                <p className="text-slate-500 font-bold animate-pulse uppercase tracking-widest text-xs">Verifying Credentials...</p>
            </div>
        );
    }

    const authorizedEmail = import.meta.env.VITE_ADMIN_EMAIL;
    if (user?.primaryEmailAddress?.emailAddress !== authorizedEmail) {
        return (
            <div className="h-screen w-full flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 p-6">
                <div className="w-20 h-20 bg-red-50 dark:bg-red-900/20 rounded-[2rem] flex items-center justify-center text-red-600 mb-8 border border-red-100 dark:border-red-900/30 shadow-xl shadow-red-500/10">
                    <Shield className="w-10 h-10" />
                </div>
                <h1 className="text-3xl font-black text-slate-900 dark:text-white mb-2">Access Denied</h1>
                <p className="text-slate-500 dark:text-slate-400 font-medium text-center max-w-sm mb-10 leading-relaxed">
                    This sector is restricted to the Primary System Administrator. Your account does not have authorization to view this module.
                </p>
                <button 
                    onClick={() => window.location.href = '/dashboard'}
                    className="px-10 py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-2xl hover:scale-[1.02] transition-all active:scale-[0.98]"
                >
                    Return to Mission Control
                </button>
            </div>
        );
    }

    if (isLoading) {
        return (
            <div className="h-screen w-full flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950">
                <Loader2 className="w-10 h-10 text-indigo-600 animate-spin mb-4" />
                <p className="text-slate-500 font-bold animate-pulse uppercase tracking-widest text-xs">Accessing Secure Archives...</p>
            </div>
        );
    }

    return (
        <div className="w-full min-h-screen bg-slate-50 dark:bg-slate-950 pt-28 pb-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
            {/* Ambient Background */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-500/5 blur-[120px]"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-blue-500/5 blur-[100px]"></div>
            </div>

            <div className="max-w-7xl mx-auto relative z-10 w-full">
                {/* Header Section */}
                <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
                    <div>
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-[10px] font-black uppercase tracking-widest mb-4">
                            <ShieldCheck className="w-3.5 h-3.5" />
                            Super Admin Console
                        </div>
                        <h1 className="text-4xl font-black tracking-tight text-slate-900 dark:text-white">
                            Platform <span className="text-transparent bg-clip-text bg-linear-to-r from-red-600 to-indigo-600">Management</span>
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
                                className="pl-10 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:ring-4 focus:ring-indigo-500/10 outline-none w-64 transition-all"
                            />
                        </div>
                        <button onClick={fetchAdminData} className="p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shadow-sm active:scale-95">
                            <Activity className={`w-5 h-5 text-slate-600 ${isLoading ? 'animate-spin' : ''}`} />
                        </button>
                    </div>
                </div>

                {/* Quick Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
                    {[
                        { label: 'Total Users', value: stats.total_users, icon: Users, color: 'indigo' },
                        { label: 'Active Companies', value: stats.total_companies, icon: Building2, color: 'blue' },
                        { label: 'Platform Status', value: 'Healthy', icon: Activity, color: 'emerald' },
                        { label: 'Avg. Latency', value: '4.2s', icon: Zap, color: 'amber' }
                    ].map((s, i) => (
                        <div key={i} className="bg-white/60 dark:bg-slate-900/40 backdrop-blur-xl border border-slate-200 dark:border-slate-800 p-6 rounded-[2rem] shadow-sm">
                            <div className={`p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 w-fit mb-4`}>
                                <s.icon className="w-5 h-5" />
                            </div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">{s.label}</p>
                            <h4 className="text-2xl font-black text-slate-900 dark:text-white">{s.value}</h4>
                        </div>
                    ))}
                </div>

                {/* Main Management Tabs */}
                <div className="bg-white/60 dark:bg-slate-900/40 backdrop-blur-2xl border border-slate-200 dark:border-slate-800 rounded-[2.5rem] p-4 shadow-sm min-h-[500px]">
                    <div className="flex items-center gap-2 mb-6 p-2 bg-slate-100 dark:bg-slate-950/50 rounded-2xl w-fit">
                        <button 
                            onClick={() => setActiveTab('users')}
                            className={`px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'users' ? 'bg-white dark:bg-slate-900 text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            Users
                        </button>
                        <button 
                            onClick={() => setActiveTab('companies')}
                            className={`px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'companies' ? 'bg-white dark:bg-slate-900 text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            Companies
                        </button>
                    </div>

                    <div className="overflow-x-auto">
                        {activeTab === 'users' ? (
                            <table className="w-full text-left border-separate border-spacing-y-3">
                                <thead>
                                    <tr className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                        <th className="px-6 py-2">User Entity</th>
                                        <th className="px-6 py-2">Account Role</th>
                                        <th className="px-6 py-2">Subscription Tier</th>
                                        <th className="px-6 py-2 text-right">Settings</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredUsers.map((u, i) => (
                                        <tr key={u.clerk_id} className="group bg-white dark:bg-slate-900/60 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shadow-sm">
                                            <td className="px-6 py-5 rounded-l-3xl border-y border-l border-slate-200 dark:border-slate-800">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-black text-slate-600">
                                                        {u.email?.charAt(0).toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-bold text-slate-900 dark:text-white">{u.email}</p>
                                                        <p className="text-[10px] text-slate-400 font-mono mt-0.5">{u.clerk_id}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-5 border-y border-slate-200 dark:border-slate-800">
                                                <select 
                                                    value={u.role} 
                                                    onChange={(e) => handleUpdateUser(u.clerk_id, 'role', e.target.value)}
                                                    className="bg-slate-100 dark:bg-slate-800 text-[10px] font-black uppercase px-3 py-1.5 rounded-lg border-none outline-none focus:ring-2 focus:ring-indigo-500/20"
                                                >
                                                    <option value="USER">User</option>
                                                    <option value="ADMIN">Admin</option>
                                                </select>
                                            </td>
                                            <td className="px-6 py-5 border-y border-slate-200 dark:border-slate-800">
                                                <select 
                                                    value={u.tier || 'FREE'} 
                                                    onChange={(e) => handleUpdateUser(u.clerk_id, 'tier', e.target.value)}
                                                    className={`text-[9px] font-black uppercase px-3 py-1.5 rounded-full border-none outline-none focus:ring-2 focus:ring-indigo-500/20 ${
                                                        u.tier === 'PRO' ? 'bg-indigo-100 text-indigo-700' :
                                                        u.tier === 'ENTERPRISE' ? 'bg-purple-100 text-purple-700' :
                                                        u.tier === 'STARTER' ? 'bg-green-100 text-green-700' :
                                                        'bg-slate-100 text-slate-500'
                                                    }`}
                                                >
                                                    <option value="FREE">Free</option>
                                                    <option value="STARTER">Starter</option>
                                                    <option value="PRO">Pro</option>
                                                    <option value="ENTERPRISE">Enterprise</option>
                                                </select>
                                            </td>
                                            <td className="px-6 py-5 rounded-r-3xl border-y border-r border-slate-200 dark:border-slate-800 text-right">
                                                <button className="p-2 text-slate-400 hover:text-indigo-600 transition-colors">
                                                    <Settings className="w-4 h-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        ) : (
                            <table className="w-full text-left border-separate border-spacing-y-3">
                                <thead>
                                    <tr className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                        <th className="px-6 py-2">Company Entity</th>
                                        <th className="px-6 py-2">Allowed Origin</th>
                                        <th className="px-6 py-2 text-right">Platform Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredCompanies.map((c) => (
                                        <tr key={c.id} className="group bg-white dark:bg-slate-900/60 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shadow-sm">
                                            <td className="px-6 py-5 rounded-l-3xl border-y border-l border-slate-200 dark:border-slate-800">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 flex items-center justify-center">
                                                        <Building2 className="w-5 h-5" />
                                                    </div>
                                                    <span className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-tight">{c.name}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-5 border-y border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-500">
                                                {c.origin}
                                            </td>
                                            <td className="px-6 py-5 rounded-r-3xl border-y border-r border-slate-200 dark:border-slate-800 text-right">
                                                <button onClick={() => handleDeleteCompany(c.id)} className="p-2.5 text-slate-400 hover:text-red-500 transition-colors bg-slate-50 dark:bg-slate-800 rounded-xl">
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                        {!isLoading && activeTab === 'companies' && companies.length === 0 && (
                            <div className="flex flex-col items-center justify-center py-20">
                                <Building2 className="w-12 h-12 text-slate-200 mb-4" />
                                <p className="text-slate-400 font-medium">No registered companies found.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdminDashboard;
