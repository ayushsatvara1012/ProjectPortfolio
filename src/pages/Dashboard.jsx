import React, { useState, useRef, useEffect } from 'react';
import { UploadCloud, Link as LinkIcon, Key, Loader2, FileText, X, BrainCircuit, Sparkles, Database, Eye, EyeOff, Boxes, Zap, Lock, Activity, Settings } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { SignedIn, SignedOut, SignInButton, useUser, useAuth } from '@clerk/clerk-react';
import Alert from '../components/alert';
import Pricing from './Pricing';

const Dashboard = () => {
    const { user } = useUser();
    const { getToken, isLoaded: isAuthLoaded } = useAuth();
    const [apiKey, setApiKey] = useState('');
    const [showApiKey, setShowApiKey] = useState(false);
    const [url, setUrl] = useState('');
    const [file, setFile] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [alertConfig, setAlertConfig] = useState({ open: false, type: 'success', msg: '' });
    const [userTier, setUserTier] = useState(null);
    const [trialEndDate, setTrialEndDate] = useState(null);
    const [isTierChecking, setIsTierChecking] = useState(true);

    const fileInputRef = useRef(null);

    // Fetch company details on mount
    useEffect(() => {
        const fetchUserData = async () => {
            if (!isAuthLoaded) return;
            try {
                const token = await getToken();
                const baseUrl = import.meta.env.VITE_API_URL || '';
                
                // Fetch user profile (tier and trial)
                const meRes = await fetch(`${baseUrl}/api/me`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (meRes.ok) {
                    const data = await meRes.json();
                    setUserTier(data.tier);
                    setTrialEndDate(data.trial_end_date);
                }

                // Fetch company details
                const companyRes = await fetch(`${baseUrl}/api/company/details`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (companyRes.ok) {
                    const data = await companyRes.json();
                    if (data.status === 'success') {
                        setApiKey(data.api_key);
                    }
                }
                
                setIsTierChecking(false);
            } catch (err) {
                console.error("Failed to fetch user details:", err);
                setIsTierChecking(false);
            }
        };

        fetchUserData();
    }, [isAuthLoaded, getToken]);

    const showAlert = (type, msg) => {
        setAlertConfig({ open: true, type, msg });
        setTimeout(() => setAlertConfig(prev => ({ ...prev, open: false })), 4000);
    };

    const handleFileChange = (e) => {
        if (e.target.files && e.target.files.length > 0) {
            const selectedFile = e.target.files[0];
            if (selectedFile.type === 'application/pdf' || selectedFile.name.toLowerCase().endsWith('.pdf')) {
                setFile(selectedFile);
                setAlertConfig(prev => ({ ...prev, open: false }));
            } else {
                setFile(null);
                showAlert('error', 'Please select a valid PDF file.');
            }
        }
    };

    const clearFile = () => {
        setFile(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleTrain = async (e) => {
        e.preventDefault();
        if (!url.trim() && !file) {
            showAlert('error', 'You must provide either a URL or a PDF file.');
            return;
        }
        setIsLoading(true);
        try {
            const token = await getToken();
            const formData = new FormData();
            if (url.trim()) formData.append('url', url.trim());
            if (file) formData.append('file', file);

            const baseUrl = import.meta.env.VITE_API_URL || '';
            const response = await fetch(`${baseUrl}/api/train`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.detail || 'Training failed.');
            showAlert('success', data.message || 'Training successful!');
            setUrl('');
            clearFile();
        } catch (error) {
            showAlert('error', error.message);
        } finally {
            setIsLoading(false);
        }
    };

    const calculateDaysLeft = () => {
        if (!trialEndDate) return null;
        const end = new Date(trialEndDate);
        const now = new Date();
        const diffTime = end - now;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays > 0 ? diffDays : 0;
    };

    const daysLeft = calculateDaysLeft();
    const isTrialExpired = userTier === 'STARTER' && daysLeft === 0;

    const bentoCardStyle = "bg-white/60 dark:bg-slate-900/40 backdrop-blur-2xl border border-slate-200 dark:border-slate-800/60 rounded-[2.5rem] p-6 group relative overflow-hidden flex flex-col shadow-sm";

    return (
        <>
            <SignedIn>
                {isTierChecking ? (
                    <div className="w-full h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
                        <Loader2 className="w-12 h-12 animate-spin text-indigo-600" />
                    </div>
                ) : !userTier ? (
                    <Pricing onPlanSelected={(tier) => setUserTier(tier)} />
                ) : (
                    <div className="w-full min-h-screen bg-slate-50 dark:bg-slate-950 pt-28 pb-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
                        {/* Ambient Orbs */}
                        <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
                            <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-500/5 blur-[120px]"></div>
                            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-blue-500/5 blur-[100px]"></div>
                        </div>

                        <div className="max-w-7xl mx-auto relative z-10 w-full">
                            {/* Header */}
                            <div className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6">
                                <div>
                                    <div className="flex items-center gap-3 mb-4 flex-wrap">
                                        <h1 className="text-4xl lg:text-5xl font-black text-slate-900 dark:text-white tracking-tight">
                                            AI <span className="text-transparent bg-clip-text bg-linear-to-r from-indigo-600 to-blue-600">Command Center</span>
                                        </h1>
                                        {userTier === 'STARTER' && (
                                            <div className={`px-4 py-1.5 rounded-full border text-[10px] font-black uppercase tracking-widest flex items-center gap-2 ${
                                                daysLeft > 5 
                                                    ? 'bg-green-100 dark:bg-green-900/30 border-green-200 dark:border-green-800 text-green-700 dark:text-green-400'
                                                    : 'bg-amber-100 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400 animate-pulse'
                                            }`}>
                                                <Zap className="w-3 h-3 fill-current" />
                                                {daysLeft} Days Left in Trial
                                            </div>
                                        )}
                                        {(userTier === 'PRO' || userTier === 'ENTERPRISE') && (
                                            <div className="px-4 py-1.5 rounded-full bg-indigo-100 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                                                <Sparkles className="w-3 h-3 fill-current" />
                                                {userTier} Active
                                            </div>
                                        )}
                                    </div>
                                    <p className="text-slate-500 dark:text-slate-400 font-medium max-w-2xl text-lg">
                                        Train your enterprise knowledge brain and manage AI deployments.
                                    </p>
                                </div>
                                <div className="flex items-center gap-4 bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                                    <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-black text-slate-600">
                                        {user?.firstName?.charAt(0) || 'U'}
                                    </div>
                                    <div className="pr-4">
                                        <p className="text-xs font-bold text-slate-900 dark:text-white leading-none mb-1">{user?.fullName || 'Developer'}</p>
                                        <p className="text-[9px] text-slate-400 uppercase font-black tracking-widest">Enterprise Access</p>
                                    </div>
                                </div>
                            </div>

                            {/* Main Bento Grid */}
                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                                {/* Knowledge Ingestion (Spans 7) */}
                                <div className="lg:col-span-7 space-y-8">
                                    <section className={`${bentoCardStyle} p-8 lg:p-10 min-h-[500px] relative overflow-hidden`}>
                                        {isTrialExpired && (
                                            <div className="absolute inset-0 z-30 bg-white/90 dark:bg-slate-900/95 backdrop-blur-xl flex flex-col items-center justify-center p-12 text-center animate-in fade-in zoom-in duration-500">
                                                <div className="w-20 h-20 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-amber-600 dark:text-amber-400 mb-8 border border-amber-200 dark:border-amber-800">
                                                    <Lock className="w-10 h-10" />
                                                </div>
                                                <h3 className="text-3xl font-black text-slate-900 dark:text-white mb-4">Trial Limit Reached</h3>
                                                <p className="text-slate-500 dark:text-slate-400 mb-10 max-w-md leading-relaxed text-lg">Your 30-day trial has concluded. Upgrade to continue training your AI and scaling your automation.</p>
                                                <button 
                                                    onClick={() => setUserTier(null)}
                                                    className="px-10 py-5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black uppercase tracking-widest text-xs transition-all shadow-xl shadow-indigo-500/20 active:scale-95 border-b-4 border-indigo-800"
                                                >
                                                    View Upgrade Options
                                                </button>
                                            </div>
                                        )}

                                        <div className="flex items-center gap-4 mb-10 relative z-10">
                                            <div className="p-3 bg-indigo-50 dark:bg-indigo-900/30 rounded-2xl text-indigo-600 dark:text-indigo-400">
                                                <BrainCircuit className="w-6 h-6" />
                                            </div>
                                            <h2 className="text-2xl font-black text-slate-900 dark:text-white">Knowledge Ingestion</h2>
                                        </div>

                                        <form onSubmit={handleTrain} className="space-y-6 relative z-10">
                                            <div>
                                                <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-3 ml-1">Admin API Credentials</label>
                                                <div className="relative group">
                                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                                        <Key className="h-5 w-5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                                                    </div>
                                                    <input
                                                        type={showApiKey ? "text" : "password"}
                                                        value={apiKey}
                                                        onChange={(e) => setApiKey(e.target.value)}
                                                        className="block w-full pl-12 pr-12 py-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 text-sm font-mono transition-all"
                                                        placeholder="sb_live_..."
                                                    />
                                                    <button type="button" onClick={() => setShowApiKey(!showApiKey)} className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-600">
                                                        {showApiKey ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                                                <div>
                                                    <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-3 ml-1">Source URL</label>
                                                    <input
                                                        type="url"
                                                        value={url}
                                                        onChange={(e) => setUrl(e.target.value)}
                                                        className="block w-full px-5 py-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 text-sm font-medium"
                                                        placeholder="https://docs.site.com"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-3 ml-1">PDF Document</label>
                                                    <div 
                                                        onClick={() => fileInputRef.current?.click()}
                                                        className="flex items-center justify-between px-5 py-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl cursor-pointer hover:border-indigo-500 transition-all group"
                                                    >
                                                        <span className="text-sm text-slate-400 group-hover:text-indigo-500 transition-colors max-w-[150px] truncate">
                                                            {file ? file.name : "Select PDF Archive"}
                                                        </span>
                                                        <UploadCloud className="w-5 h-5 text-slate-300 group-hover:text-indigo-500" />
                                                        <input type="file" ref={fileInputRef} className="hidden" accept=".pdf" onChange={handleFileChange} />
                                                    </div>
                                                </div>
                                            </div>

                                            <button 
                                                type="submit" 
                                                disabled={isLoading}
                                                className="w-full mt-6 py-5 bg-linear-to-r from-indigo-700 to-indigo-600 hover:from-indigo-600 hover:to-indigo-500 text-white rounded-2xl font-black uppercase tracking-widest text-xs transition-all shadow-xl shadow-indigo-500/20 active:scale-95 disabled:opacity-50"
                                            >
                                                {isLoading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : "Start Training Sequence"}
                                            </button>
                                        </form>

                                        {/* Decorative Form Background Icon */}
                                        <Sparkles className="absolute -right-16 -bottom-16 w-64 h-64 text-indigo-500/5 rotate-12 pointer-events-none" />
                                    </section>
                                </div>

                                {/* Right Column: Stats & Meta (Spans 5) */}
                                <div className="lg:col-span-5 grid grid-cols-1 sm:grid-cols-2 gap-8">
                                    <div className={`${bentoCardStyle} col-span-1`}>
                                        <div className="p-3 bg-blue-50 dark:bg-blue-900/30 rounded-2xl text-blue-600 dark:text-blue-400 w-fit mb-4">
                                            <Database className="w-6 h-6" />
                                        </div>
                                        <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Knowledge Units</h4>
                                        <div className="flex items-end gap-2">
                                            <span className="text-3xl font-black text-slate-900 dark:text-white">1,280</span>
                                            <span className="text-xs font-bold text-green-500 mb-1.5">+12%</span>
                                        </div>
                                    </div>

                                    <div className={`${bentoCardStyle} col-span-1`}>
                                        <div className="p-3 bg-indigo-50 dark:bg-indigo-900/30 rounded-2xl text-indigo-600 dark:text-indigo-400 w-fit mb-4">
                                            <Activity className="w-6 h-6" />
                                        </div>
                                        <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Inference Latency</h4>
                                        <div className="flex items-end gap-2">
                                            <span className="text-3xl font-black text-slate-900 dark:text-white">142</span>
                                            <span className="text-xs font-bold text-slate-500 mb-1.5">ms</span>
                                        </div>
                                    </div>

                                    <div className={`${bentoCardStyle} sm:col-span-2 min-h-[220px] bg-linear-to-br from-indigo-600/10 to-transparent border-indigo-200/30 dark:border-indigo-800/20`}>
                                        <div className="relative z-10">
                                            <div className="px-3 py-1 rounded-full bg-indigo-600 text-white text-[9px] font-black uppercase tracking-widest w-fit mb-6">Pro Features</div>
                                            <h3 className="text-xl font-black text-slate-900 dark:text-white mb-3">Multi-Modality Vectoring</h3>
                                            <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed font-medium">Coming soon. Cross-reference images, audio logs, and structured JSON feeds into a single unified knowledge model.</p>
                                        </div>
                                        <Sparkles className="absolute -right-8 -bottom-8 w-40 h-40 text-indigo-500/10 -rotate-12" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </SignedIn>

            <SignedOut>
                <div className="w-full min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-6">
                    <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-[3rem] p-12 border border-slate-200 dark:border-slate-800 shadow-2xl text-center relative overflow-hidden">
                        <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-3xl flex items-center justify-center mx-auto mb-8 text-slate-400">
                            <Lock className="w-8 h-8" />
                        </div>
                        <h2 className="text-3xl font-black text-slate-900 dark:text-white mb-4 tracking-tight">Access <span className="text-indigo-600">Restricted</span></h2>
                        <p className="text-slate-500 dark:text-slate-400 font-medium mb-10 leading-relaxed">Please sign in to access your developer dashboard and manage your AI deployments.</p>
                        <SignInButton mode="modal">
                            <button className="w-full py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl font-bold hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-slate-900/20 dark:shadow-white/5">
                                Sign In to SaPyBase
                            </button>
                        </SignInButton>
                    </div>
                </div>
            </SignedOut>

            <Alert
                isOpen={alertConfig.open}
                type={alertConfig.type}
                message={alertConfig.msg}
                onClose={() => setAlertConfig(prev => ({ ...prev, open: false }))}
            />
        </>
    );
};

export default Dashboard;
