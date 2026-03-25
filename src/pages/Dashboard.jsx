import React, { useState, useRef, useEffect } from 'react';
import { UploadCloud, Link as LinkIcon, Key, FileText, X, BrainCircuit, Sparkles, Database, Eye, EyeOff, Boxes, Zap, Lock, Activity, Settings } from 'lucide-react';
import SkeletonLoader from '../components/SkeletonLoader';
import { motion, AnimatePresence } from 'framer-motion';
import { SignedIn, SignedOut, SignInButton, useUser, useAuth } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';
import Alert from '../components/alert';
import Logo from '../components/Logo';
import Pricing from './Pricing';

const Dashboard = () => {
    const { user } = useUser();
    const { getToken, isLoaded: isAuthLoaded } = useAuth();
    const navigate = useNavigate();
    const [apiKey, setApiKey] = useState('');
    const [showApiKey, setShowApiKey] = useState(false);
    const [url, setUrl] = useState('');
    const [file, setFile] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [alertConfig, setAlertConfig] = useState({ open: false, type: 'success', msg: '' });
    const [userTier, setUserTier] = useState(null);
    const [trialEndDate, setTrialEndDate] = useState(null);
    const [stats, setStats] = useState({ total_documents: 0, total_messages: 0 });
    const [messagesUsed, setMessagesUsed] = useState(0);
    const [messageLimit, setMessageLimit] = useState(200);
    const [periodEnd, setPeriodEnd] = useState(null);
    const [isTierChecking, setIsTierChecking] = useState(true);
    const [showPricing, setShowPricing] = useState(false);

    const fileInputRef = useRef(null);

    // Fetch company details on mount
    useEffect(() => {
        const fetchUserData = async () => {
            if (!isAuthLoaded) return;
            try {
                const token = await getToken();
                const baseUrl = import.meta.env.VITE_API_URL || '';
                
                // Fetch user profile and company details in parallel for faster population
                const [meRes, companyRes] = await Promise.all([
                    fetch(`${baseUrl}/api/me`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    }),
                    fetch(`${baseUrl}/api/company/details`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    })
                ]);

                if (meRes.ok) {
                    const data = await meRes.json();
                    setUserTier(data.tier);
                    setTrialEndDate(data.trial_end_date);
                    setMessagesUsed(data.messages_used);
                    setMessageLimit(data.message_limit);
                    setPeriodEnd(data.period_end);
                    setStats({
                        total_documents: data.total_documents || 0,
                        total_messages: data.total_messages || 0
                    });
                }

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

    // Lockout logic: disable if FREE/STARTER and limits are maxed out
    const isLockedOut = (userTier === 'FREE' || userTier === 'STARTER') && (messagesUsed >= messageLimit);

    const bentoCardStyle = "bg-white dark:bg-[#111111] border border-slate-200 dark:border-slate-800 rounded-xl p-6 group relative overflow-hidden flex flex-col";

    if (isTierChecking) {
        return (
            <div className="w-full h-screen bg-slate-50 dark:bg-[#0A0A0A] flex items-center justify-center transition-colors duration-500">
                <Logo className="w-[120px] h-16" />
            </div>
        );
    }

    return (
        <>
            <SignedIn>
                <div className="w-full min-h-screen bg-slate-50 dark:bg-[#0A0A0A] pt-28 pb-12 px-4 sm:px-6 lg:px-8 relative">
                    <div className="max-w-7xl mx-auto relative z-10 w-full">
                        {/* Header */}
                        <div className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6">
                            <div>
                                <div className="flex items-center gap-3 mb-4 flex-wrap">
                                    <h1 className="text-3xl lg:text-4xl font-bold text-slate-900 dark:text-white tracking-tight">
                                        AI Command Center
                                    </h1>
                                    {userTier === 'STARTER' && (
                                        <div className={`px-2 py-0.5 rounded-md border text-[11px] font-mono uppercase tracking-wider flex items-center gap-2 ${
                                            daysLeft > 5 
                                                ? 'bg-slate-100 dark:bg-[#1A1A1A] border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                                                : 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-900/30 text-amber-600 dark:text-amber-400'
                                        }`}>
                                            <Zap className="w-3 h-3 fill-current" />
                                            {daysLeft} Days left
                                        </div>
                                    )}
                                    {(userTier === 'PRO' || userTier === 'ENTERPRISE') && (
                                        <div className="px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-[#1A1A1A] text-[11px] font-mono uppercase tracking-wider text-slate-600 dark:text-slate-400 flex items-center gap-2">
                                            <Sparkles className="w-3 h-3 fill-current text-indigo-500" />
                                            {userTier} Plan
                                        </div>
                                    )}
                                    {userTier !== 'PRO' && userTier !== 'ENTERPRISE' && (
                                        <button 
                                            onClick={() => navigate('/pricing')}
                                            className="px-3 py-1 rounded-md bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-[10px] font-bold uppercase tracking-widest hover:bg-slate-800 dark:hover:bg-white transition-colors"
                                        >
                                            Upgrade Plan
                                        </button>
                                    )}
                                </div>
                                <p className="text-slate-500 dark:text-slate-400 font-medium max-w-2xl text-base">
                                    Train your enterprise knowledge brain and manage AI deployments.
                                </p>
                            </div>
                            <div className="flex items-center gap-4 bg-white dark:bg-[#111111] p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                                <button 
                                    onClick={async () => {
                                        try {
                                            const response = await fetch(`${import.meta.env.VITE_API_URL}/api/billing/portal`, {
                                                headers: {
                                                    'Authorization': `Bearer ${await window.Clerk.session.getToken()}`
                                                }
                                            });
                                            const data = await response.json();
                                            if (data.url) {
                                                window.open(data.url, '_blank');
                                            } else {
                                                alert(data.detail || "Could not generate billing portal link.");
                                            }
                                        } catch (err) {
                                            console.error("Billing portal error:", err);
                                            alert("Failed to connect to billing portal.");
                                        }
                                    }}
                                    className="px-3 py-1.5 bg-slate-100 dark:bg-[#1A1A1A] text-slate-900 dark:text-slate-100 rounded-md text-[10px] font-bold uppercase tracking-widest border border-slate-200 dark:border-slate-800 hover:bg-slate-200 dark:hover:bg-[#222222] transition-colors"
                                >
                                    Billing Portal
                                </button>
                                <div className="w-8 h-8 rounded-md bg-slate-100 dark:bg-[#1A1A1A] border border-slate-200 dark:border-slate-800 flex items-center justify-center font-bold text-slate-500 text-xs text-mono">
                                    {user?.firstName?.charAt(0) || 'U'}
                                </div>
                                <div>
                                    <p className="text-xs font-bold text-slate-900 dark:text-white leading-none mb-1">{user?.fullName || 'Developer'}</p>
                                    <p className="text-[9px] text-slate-400 uppercase font-mono tracking-widest">Enterprise Access</p>
                                </div>
                            </div>
                        </div>

                        {/* Stats Grid */}
                        <div className="mb-10">
                            {isLoading ? <SkeletonLoader.Stats /> : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                                    {[
                                        { label: 'Total Ingested', value: stats.total_documents || 0, icon: Database, unit: 'docs' },
                                        { label: 'Active Memory', value: stats.total_messages || 0, icon: Activity, unit: 'msgs' },
                                        { label: 'Sync Status', value: 'Optimal', icon: Zap, unit: 'real-time' },
                                        { label: 'System Tier', value: userTier || 'Loading...', icon: Lock, unit: 'unlocked' }
                                    ].map((s, i) => (
                                        <div key={i} className="bg-white dark:bg-[#111111] border border-slate-200 dark:border-slate-800 p-6 rounded-xl transition-colors">
                                            <div className="flex items-center gap-2 mb-4">
                                                <s.icon className="w-4 h-4 text-slate-500" />
                                                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">{s.label}</p>
                                            </div>
                                            <h4 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight flex items-baseline gap-2">
                                                {s.value}
                                                <span className="text-[10px] text-slate-400 uppercase tracking-widest font-mono font-medium">{s.unit}</span>
                                            </h4>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Main Bento Grid */}
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                            {/* Knowledge Ingestion (Spans 7) */}
                            <div className="lg:col-span-7 space-y-8">
                                <section className={`${bentoCardStyle} p-6 lg:p-8 min-h-[400px]`}>
                                    {isTrialExpired && (
                                        <div className="absolute inset-0 z-30 bg-white/95 dark:bg-[#0A0A0A]/95 backdrop-blur-sm flex flex-col items-center justify-center p-8 text-center animate-in fade-in zoom-in duration-300">
                                            <div className="w-12 h-12 rounded-lg bg-slate-100 dark:bg-[#1A1A1A] border border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-400 mb-6">
                                                <Lock className="w-6 h-6" />
                                            </div>
                                            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2 tracking-tight">Requirement: Upgrade Plan</h3>
                                            <p className="text-sm text-slate-500 dark:text-slate-400 mb-8 max-w-sm leading-relaxed">Your trial has concluded. Upgrade to continue scaling your mission-critical AI automation.</p>
                                            <button 
                                                onClick={() => setUserTier(null)}
                                                className="px-6 py-2 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-md text-sm font-medium transition-colors"
                                            >
                                                Configure Subscription
                                            </button>
                                        </div>
                                    )}

                                    <div className="flex items-center gap-2 mb-8 relative z-10">
                                        <BrainCircuit className="w-4 h-4 text-slate-500" />
                                        <h2 className="text-sm font-bold uppercase tracking-widest text-slate-900 dark:text-white">Knowledge Ingestion</h2>
                                    </div>

                                    {isLockedOut && (
                                        <div className="mb-6 p-4 rounded-md bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/30 flex items-start gap-3 relative z-10">
                                            <Lock className="w-4 h-4 text-red-600 dark:text-red-400 mt-0.5" />
                                            <div>
                                                <h4 className="text-[11px] font-bold text-red-900 dark:text-red-400 uppercase tracking-widest mb-1">Quota Exceeded</h4>
                                                <p className="text-xs text-red-700 dark:text-red-400 leading-relaxed max-w-md">
                                                    You have exhausted your API message quota. Upgrade your plan to continue training.
                                                </p>
                                                <button 
                                                    onClick={(e) => { e.preventDefault(); setShowPricing(true); }}
                                                    className="mt-3 text-[10px] font-bold uppercase tracking-widest text-red-600 dark:text-red-400 hover:underline"
                                                >
                                                    Upgrade Plan &rarr;
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {isLoading ? <SkeletonLoader.Form /> : (
                                        <form onSubmit={handleTrain} className="space-y-6 relative z-10">
                                            <div>
                                                <label className="block text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-2">API Secret Key</label>
                                                <div className="relative group">
                                                    <input
                                                        type={showApiKey ? "text" : "password"}
                                                        value={apiKey}
                                                        onChange={(e) => setApiKey(e.target.value)}
                                                        className="w-full px-3 py-2 bg-transparent border border-slate-300 dark:border-slate-800 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 font-mono text-xs text-slate-900 dark:text-white transition-colors pr-10"
                                                        placeholder="sb_live_..."
                                                    />
                                                    <button type="button" onClick={() => setShowApiKey(!showApiKey)} className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-700">
                                                        {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-2">Source URL</label>
                                                    <input
                                                        type="url"
                                                        value={url}
                                                        onChange={(e) => setUrl(e.target.value)}
                                                        className="w-full px-3 py-2 text-sm bg-transparent border border-slate-300 dark:border-slate-800 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-slate-900 dark:text-white transition-colors"
                                                        placeholder="https://docs.site.com"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-2">PDF Archive</label>
                                                    <div 
                                                        onClick={() => fileInputRef.current?.click()}
                                                        className="flex items-center justify-between px-3 py-2 bg-transparent border border-slate-300 dark:border-slate-800 rounded-md cursor-pointer hover:border-slate-400 transition-colors group"
                                                    >
                                                        <span className="text-xs text-slate-500 group-hover:text-slate-700 transition-colors max-w-[150px] truncate">
                                                            {file ? file.name : "Select file..."}
                                                        </span>
                                                        <UploadCloud className="w-4 h-4 text-slate-400 group-hover:text-slate-600" />
                                                        <input type="file" ref={fileInputRef} className="hidden" accept=".pdf" onChange={handleFileChange} />
                                                    </div>
                                                </div>
                                            </div>

                                            <button 
                                                type="submit" 
                                                disabled={isLoading || isLockedOut}
                                                className={`w-full py-2.5 rounded-md text-sm font-medium transition-colors ${
                                                    isLockedOut 
                                                    ? 'bg-slate-100 dark:bg-[#1A1A1A] text-slate-400 border border-slate-200 dark:border-slate-800 cursor-not-allowed' 
                                                    : 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-white'
                                                }`}
                                            >
                                                {isLoading ? 'Processing Signal...' : isLockedOut ? "Lockout Active" : "Start Training Sequence"}
                                            </button>
                                        </form>
                                    )}
                                </section>
                            </div>

                            {/* Right Column: Stats & Meta (Spans 5) */}
                            <div className="lg:col-span-5 grid grid-cols-1 sm:grid-cols-2 gap-8">
                                <div className={`${bentoCardStyle} sm:col-span-2`}>
                                    <div className="flex justify-between items-start mb-6">
                                        <div className="flex items-center gap-2">
                                            <Database className="w-4 h-4 text-slate-500" />
                                            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">API Usage</h4>
                                        </div>
                                        {(messageLimit === null || messageLimit >= 999999) && (
                                            <span className="px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-[#1A1A1A] text-[10px] font-mono font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">Unlimited</span>
                                        )}
                                    </div>

                                    <div className="flex items-end gap-2 mb-4">
                                        <span className="text-4xl font-bold text-slate-900 dark:text-white tracking-tight">
                                            {messagesUsed}
                                            {messageLimit !== null && messageLimit < 999999 && (
                                                <span className="text-sm text-slate-400"> / {messageLimit}</span>
                                            )}
                                        </span>
                                        <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-slate-500 mb-1.5 ml-1">reqs</span>
                                    </div>

                                    {messageLimit !== null && messageLimit < 999999 && (
                                        <>
                                            <div className="w-full h-1.5 bg-slate-100 dark:bg-[#1A1A1A] rounded-full overflow-hidden flex">
                                                <motion.div 
                                                    initial={{ width: 0 }}
                                                    animate={{ width: `${Math.min((messagesUsed / messageLimit) * 100, 100)}%` }}
                                                    className={`h-full transition-all duration-700 ${
                                                        (messagesUsed / messageLimit) >= 1 ? 'bg-red-500' :
                                                        (messagesUsed / messageLimit) >= 0.8 ? 'bg-amber-500' :
                                                        'bg-slate-900 dark:bg-slate-100'
                                                    }`}
                                                />
                                            </div>
                                            <div className="flex justify-between items-center mt-3">
                                                <p className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest">
                                                    {Math.round((messagesUsed / messageLimit) * 100)}% Consumed
                                                </p>
                                                <p className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest">
                                                    Reset: {periodEnd ? new Date(periodEnd).toLocaleDateString() : '??-??-????'}
                                                </p>
                                            </div>
                                        </>
                                    )}
                                </div>

                                <div className={`${bentoCardStyle} sm:col-span-2 min-h-[180px] border-indigo-200/30 dark:border-indigo-800/20`}>
                                    <div className="relative z-10">
                                        <div className="px-2 py-0.5 rounded-md border border-indigo-200 dark:border-indigo-800/30 bg-indigo-50 dark:bg-indigo-900/10 text-[10px] font-mono font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 w-fit mb-4">Roadmap Expansion</div>
                                        <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-2 tracking-tight uppercase">Multi-Modality Vectoring</h3>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-medium">Coming soon. Cross-reference images, audio logs, and structured JSON feeds into a single unified knowledge model.</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </SignedIn>

            <SignedOut>
                <div className="w-full min-h-screen bg-slate-50 dark:bg-[#0A0A0A] flex items-center justify-center p-6">
                    <div className="max-w-sm w-full bg-white dark:bg-[#111111] rounded-xl p-10 border border-slate-200 dark:border-slate-800 shadow-xl text-center">
                        <div className="w-12 h-12 bg-slate-100 dark:bg-[#1A1A1A] rounded-lg border border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-500 mb-6 mx-auto">
                            <Lock className="w-6 h-6" />
                        </div>
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2 tracking-tight">Access Restricted</h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mb-8 leading-relaxed">Please sign in to access your developer dashboard and manage your AI deployments.</p>
                        <SignInButton mode="modal">
                            <button className="w-full py-2.5 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-md text-sm font-medium hover:bg-slate-800 dark:hover:bg-white transition-colors">
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
