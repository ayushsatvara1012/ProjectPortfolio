import React, { useState, useEffect } from 'react';
import { Users, Building2, ShieldCheck, ExternalLink, Key, Search, Loader2, BarChart3, Globe, Zap, ArrowUpRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth, SignedIn, SignedOut, RedirectToSignIn } from '@clerk/clerk-react';
import Alert from '../components/alert';

const AdminDashboard = () => {
    const { getToken, isLoaded } = useAuth();
    const [stats, setStats] = useState({ total_users: 0, total_companies: 0 });
    const [companies, setCompanies] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [alertConfig, setAlertConfig] = useState({ open: false, type: 'success', msg: '' });

    useEffect(() => {
        const fetchAdminData = async () => {
            if (!isLoaded) return;
            try {
                const token = await getToken();
                const baseUrl = import.meta.env.VITE_API_URL
                    ? `${import.meta.env.VITE_API_URL.replace(/\/$/, "")}`
                    : '';
                
                // Fetch Stats
                const statsRes = await fetch(`${baseUrl}/api/admin/stats`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                
                if (statsRes.status === 403) {
                    setAlertConfig({ open: true, type: 'error', msg: 'Access Denied: You are not a Super Admin.' });
                    setIsLoading(false);
                    return;
                }
                
                const statsData = await statsRes.json();
                setStats(statsData);

                // Fetch Companies
                const companiesRes = await fetch(`${baseUrl}/api/admin/companies`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const companiesData = await companiesRes.json();
                setCompanies(companiesData);

            } catch (error) {
                console.error("Admin fetch error:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchAdminData();
    }, [isLoaded, getToken]);

    if (!isLoaded || isLoading) {
        return (
            <div className="h-screen w-full flex items-center justify-center bg-slate-50 dark:bg-slate-950">
                <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pt-28 pb-12 px-6 lg:px-12 font-sans tracking-tight">
            <Alert 
                open={alertConfig.open} 
                type={alertConfig.type} 
                msg={alertConfig.msg} 
                onClose={() => setAlertConfig({ ...alertConfig, open: false })} 
            />
            
            <div className="max-w-7xl mx-auto">
                <header className="mb-12">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 rounded-xl bg-orange-100 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400">
                            <ShieldCheck size={20} />
                        </div>
                        <span className="text-sm font-bold text-orange-600 dark:text-orange-400 uppercase tracking-widest">Super Admin Control</span>
                    </div>
                    <h1 className="text-4xl lg:text-5xl font-black text-slate-900 dark:text-white">Platform Oversight</h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-4 max-w-2xl">Monitor all tenants, API keys, and system-wide growth metrics from a single pane of glass.</p>
                </header>

                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
                    {[
                        { label: 'Total Users', value: stats.total_users, icon: <Users size={20} />, color: 'blue' },
                        { label: 'Active Companies', value: stats.total_companies, icon: <Building2 size={20} />, color: 'indigo' },
                        { label: 'Platform Revenue', value: '$0.00', icon: <Zap size={20} />, color: 'amber' },
                        { label: 'System Health', value: '100%', icon: <BarChart3 size={20} />, color: 'emerald' },
                    ].map((s, idx) => (
                        <div key={idx} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
                            <div className="flex items-center justify-between mb-4">
                                <div className={`p-3 rounded-2xl bg-${s.color}-50 dark:bg-${s.color}-500/10 text-${s.color}-600 dark:text-${s.color}-400`}>
                                    {s.icon}
                                </div>
                                <ArrowUpRight className="text-slate-300 dark:text-slate-600" size={18} />
                            </div>
                            <div className="text-slate-500 dark:text-slate-400 text-sm font-medium mb-1">{s.label}</div>
                            <div className="text-3xl font-black text-slate-900 dark:text-white">{s.value}</div>
                        </div>
                    ))}
                </div>

                {/* Companies Table */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-4xl overflow-hidden shadow-xl shadow-slate-200/50 dark:shadow-none">
                    <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                        <h3 className="text-xl font-bold text-slate-900 dark:text-white">Registered Companies</h3>
                        <div className="relative group">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={16} />
                            <input 
                                type="text" 
                                placeholder="Search companies..." 
                                className="pl-10 pr-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border-none focus:ring-2 focus:ring-indigo-500 text-sm"
                            />
                        </div>
                    </div>
                    
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="text-slate-400 dark:text-slate-500 text-xs uppercase tracking-wider">
                                    <th className="px-8 py-4 font-bold">Company Name</th>
                                    <th className="px-8 py-4 font-bold">Domain</th>
                                    <th className="px-8 py-4 font-bold">API Key</th>
                                    <th className="px-8 py-4 font-bold text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                                {companies.map((company) => (
                                    <tr key={company.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors group">
                                        <td className="px-8 py-5">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
                                                    {company.name.charAt(0)}
                                                </div>
                                                <span className="font-bold text-slate-900 dark:text-slate-100">{company.name}</span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-5 text-slate-500 dark:text-slate-400 text-sm font-medium">
                                            <div className="flex items-center gap-1">
                                                <Globe size={14} className="text-slate-300 dark:text-slate-600" />
                                                {company.domain}
                                            </div>
                                        </td>
                                        <td className="px-8 py-5 font-mono text-xs text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors">
                                            <div className="flex items-center gap-2">
                                                <Key size={12} />
                                                {company.key.substring(0, 15)}...
                                            </div>
                                        </td>
                                        <td className="px-8 py-5 text-right">
                                            <button className="p-2 rounded-lg hover:bg-white dark:hover:bg-slate-700 text-slate-400 hover:text-indigo-600 transition-all shadow-none hover:shadow-sm border border-transparent hover:border-slate-200 dark:hover:border-slate-600">
                                                <ExternalLink size={18} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {companies.length === 0 && (
                            <div className="py-20 flex flex-col items-center justify-center text-slate-400">
                                <Building2 size={48} className="mb-4 opacity-20" />
                                <p className="font-medium">No companies registered yet.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdminDashboard;
