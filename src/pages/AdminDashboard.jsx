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
import { AppPageSkeleton } from '../components/SkeletonLoader';
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

    // ── Render ─────────────────────────────────────────────────────────────────
    if (!isUserLoaded || isContextLoading || isLoading) {
        return <div className="p-8"><AppPageSkeleton /></div>;
    }

    return (
        <div className="grid gap-px bg-gray-100 border-b border-gray-100">
            {/* Header Cell */}
            <div className="bg-white p-8 lg:p-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                    <div className="px-2 py-0.5 border border-gray-100 bg-gray-50 text-[10px] font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2 w-fit mb-4 rounded-none">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        Super Admin Console
                    </div>
                    <h1 className="text-3xl lg:text-4xl font-black text-slate-900 tracking-tight uppercase">
                        Platform <span className="text-slate-400">Management</span>
                    </h1>
                    <p className="text-slate-500 mt-2 font-medium">Monitor ecosystem health and manage user subscriptions.</p>
                </div>

                <div className="flex items-center gap-px bg-gray-100 border border-gray-100">
                    <div className="bg-white relative flex items-center">
                        <Search className="absolute left-3 w-3.5 h-3.5 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search users or companies..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-9 pr-4 py-2.5 bg-transparent border-none focus:outline-none font-medium text-xs text-slate-900 w-64 rounded-none"
                        />
                    </div>
                    <button 
                        onClick={fetchAdminData} 
                        disabled={isLoading}
                        className="p-3 bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50 transition-colors"
                    >
                        <Activity className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Admin Stats Grid (Flush Cells) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px bg-gray-100 border-t border-b border-gray-100">
                {isLoading ? (
                    <div className="col-span-4 bg-white p-8"><SkeletonLoader.Stats /></div>
                ) : (
                    [
                        { label: 'Total Users', value: stats.total_users, icon: Users, color: 'text-slate-900' },
                        { label: 'Active Companies', value: stats.total_companies, icon: Building2, color: 'text-slate-900' },
                        { label: 'System Health', value: '99.9%', icon: Activity, color: 'text-emerald-600' },
                        { label: 'Avg. Latency', value: '4.2s', icon: Zap, color: 'text-amber-600' }
                    ].map((s, i) => (
                        <div key={i} className="bg-white p-8">
                            <div className="flex items-center justify-between mb-4">
                                <div className={`p-2 border border-gray-100 bg-gray-50 rounded-none ${s.color}`}>
                                    <s.icon className="w-4 h-4" />
                                </div>
                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Live</span>
                            </div>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">{s.label}</p>
                            <h3 className="text-2xl font-black text-slate-900 tracking-tighter">{s.value}</h3>
                        </div>
                    ))
                )}
            </div>

            {/* Main Management Cell */}
            <div className="bg-white border-t border-gray-100">
                {/* Tabs Cell Header */}
                <div className="flex gap-px bg-gray-100 border-b border-gray-100">
                    <button
                        onClick={() => setActiveTab('users')}
                        className={`px-8 py-4 text-[10px] font-bold uppercase tracking-widest transition-colors ${activeTab === 'users' ? 'bg-white text-slate-900 border-b-2 border-slate-900' : 'bg-gray-50 text-slate-400 hover:bg-white hover:text-slate-600'}`}
                    >
                        User Entities
                    </button>
                    <button
                        onClick={() => setActiveTab('companies')}
                        className={`px-8 py-4 text-[10px] font-bold uppercase tracking-widest transition-colors ${activeTab === 'companies' ? 'bg-white text-slate-900 border-b-2 border-slate-900' : 'bg-gray-50 text-slate-400 hover:bg-white hover:text-slate-600'}`}
                    >
                        Company Nodes
                    </button>
                </div>

                {/* Table Content Area */}
                <div className="p-8">
                    {isLoading ? <SkeletonLoader.Table /> : (
                        activeTab === 'users' ? (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse border border-gray-100">
                                    <thead>
                                        <tr className="bg-gray-50 border-b border-gray-100">
                                            <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-400 border-r border-gray-100">Entity Details</th>
                                            <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-400 border-r border-gray-100">Access Tier</th>
                                            <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-400 text-right">Settings</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {filteredUsers.map((u) => (
                                            <tr key={u.clerk_id} className="hover:bg-gray-50 transition-colors">
                                                <td className="px-6 py-5 border-r border-gray-100">
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-10 h-10 border border-gray-100 bg-white flex items-center justify-center font-black text-xs text-slate-400">
                                                            {u.email?.charAt(0).toUpperCase()}
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-bold text-slate-900">{u.email}</p>
                                                            <p className="text-[10px] text-slate-400 font-medium mt-0.5 tracking-tight uppercase">{u.clerk_id}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-5 border-r border-gray-100">
                                                    <select
                                                        value={u.tier || 'FREE'}
                                                        onChange={(e) => handleUpdateUser(u.clerk_id, 'tier', e.target.value)}
                                                        className="bg-white border border-gray-100 rounded-none px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-700 focus:ring-1 focus:ring-slate-900 outline-none"
                                                    >
                                                        <option value="FREE">Free</option>
                                                        <option value="STARTER">Starter</option>
                                                        <option value="PRO">Pro</option>
                                                        <option value="ENTERPRISE">Enterprise</option>
                                                    </select>
                                                </td>
                                                <td className="px-6 py-5 text-right">
                                                    <button 
                                                        disabled={isActionLoading}
                                                        className="p-2.5 bg-gray-50 border border-gray-100 text-slate-400 hover:bg-white hover:text-slate-900 transition-colors disabled:opacity-50"
                                                    >
                                                        {isActionLoading ? <span className="text-[10px] font-bold leading-none">...</span> : <Settings className="w-4 h-4" />}
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse border border-gray-100">
                                    <thead>
                                        <tr className="bg-gray-50 border-b border-gray-100">
                                            <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-400 border-r border-gray-100">Company Node</th>
                                            <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-400 border-r border-gray-100">Allowed Origin</th>
                                            <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-400 text-right">Node Controls</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {filteredCompanies.map((c) => (
                                            <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                                                <td className="px-6 py-5 border-r border-gray-100">
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-10 h-10 border border-gray-100 bg-white flex items-center justify-center text-slate-400">
                                                            <Building2 className="w-5 h-5" />
                                                        </div>
                                                        <span className="text-xs font-bold text-slate-900 uppercase tracking-widest">{c.name}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-5 border-r border-gray-100 text-[11px] font-medium text-slate-500 uppercase tracking-tight">
                                                    {c.origin}
                                                </td>
                                                <td className="px-6 py-5 text-right">
                                                    <button 
                                                        onClick={() => handleDeleteCompany(c.id)} 
                                                        disabled={isActionLoading}
                                                        className="p-2.5 bg-red-50 border border-red-100 text-red-600 hover:bg-red-600 hover:text-white transition-colors disabled:opacity-50"
                                                    >
                                                        {isActionLoading ? <span className="text-[10px] font-bold leading-none">...</span> : <Trash2 className="w-4 h-4" />}
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {filteredCompanies.length === 0 && (
                                    <div className="flex flex-col items-center justify-center py-20 bg-gray-50">
                                        <Building2 className="w-12 h-12 text-gray-200 mb-4" />
                                        <p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest">No Node Entities Found</p>
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
