import React, { useState, useRef, useEffect } from 'react';
import { UploadCloud, Link as LinkIcon, Key, FileText, X, BrainCircuit, Sparkles, Database, Eye, EyeOff, Boxes, Zap, Lock, Activity, Settings } from 'lucide-react';
import SkeletonLoader from '../components/SkeletonLoader';
import { motion, AnimatePresence } from 'framer-motion';
import { SignedIn, SignedOut, SignInButton, useUser, useAuth } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';
import Alert from '../components/alert';
import Logo from '../components/Logo';
import Pricing from './Pricing';
import { useUserRole } from '../context/UserContext';
import Loader from '../components/Loader';

const Dashboard = () => {
    const { user } = useUser();
    const { getToken, isLoaded: isAuthLoaded } = useAuth();
    const navigate = useNavigate();
    const { 
        userRole, userTier, isLoading: isContextLoading, 
        subscriptionStatus: globalSubStatus, trialEndDate: globalTrialEnd, 
        messagesUsed: globalMessagesUsed, messageLimit: globalMessageLimit,
        totalDocuments: globalTotalDocs, totalMessages: globalTotalMsgs,
        billingPeriodEnd: globalPeriodEnd
    } = useUserRole();

    const [apiKey, setApiKey] = useState('');
    const [showApiKey, setShowApiKey] = useState(false);
    const [url, setUrl] = useState('');
    const [file, setFile] = useState(null);
    const [isLoading, setIsLoading] = useState(false); // No longer blocks the whole page
    const [alertConfig, setAlertConfig] = useState({ open: false, type: 'success', msg: '' });
    
    // Derived states from UserContext
    const [subscriptionStatus, setSubscriptionStatus] = useState('active');
    const [trialEndDate, setTrialEndDate] = useState(null);
    const [stats, setStats] = useState({ total_documents: 0, total_messages: 0 });
    const [messagesUsed, setMessagesUsed] = useState(0);
    const [messageLimit, setMessageLimit] = useState(200);
    const [periodEnd, setPeriodEnd] = useState(null);

    const [showPricing, setShowPricing] = useState(false);
    const [isTraining, setIsTraining] = useState(false);
    const [trainingText, setTrainingText] = useState('');

    // Sync local state with UserContext whenever it updates
    useEffect(() => {
        if (!isContextLoading) {
            setSubscriptionStatus(globalSubStatus);
            setTrialEndDate(globalTrialEnd);
            setStats({
                total_documents: globalTotalDocs,
                total_messages: globalTotalMsgs
            });
            setMessagesUsed(globalMessagesUsed);
            setMessageLimit(globalMessageLimit);
            setPeriodEnd(globalPeriodEnd);
        }
    }, [isContextLoading, globalSubStatus, globalTrialEnd, globalTotalDocs, globalTotalMsgs, globalMessagesUsed, globalMessageLimit, globalPeriodEnd]);

    const fileInputRef = useRef(null);
    const trainingTextRef = useRef(null);

    // fetchUserData removed as it is now handled by UserContext at the root level

    const showAlert = (type, msg) => {
        setAlertConfig({ open: true, type, msg });
        setTimeout(() => setAlertConfig(prev => ({ ...prev, open: false })), 8000);
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
        if (!url.trim() && !file && !trainingText.trim()) {
            showAlert('error', 'You must provide a URL, a PDF file, or manual text.');
            return;
        }
        setIsTraining(true);
        try {
            const token = await getToken();
            const formData = new FormData();
            if (url.trim()) formData.append('url', url.trim());
            if (file) formData.append('file', file);
            if (trainingText.trim()) formData.append('text', trainingText.trim());
            if (apiKey.trim()) formData.append('api_key', apiKey.trim()); // Allow manual key override/input

            const baseUrl = import.meta.env.VITE_API_URL || '';
            const response = await fetch(`${baseUrl}/api/train`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.detail || 'Training failed.');

            if (data.warning) {
                showAlert('warning', data.warning);
                // Highlight and scroll to manual text area for guidance
                trainingTextRef.current?.focus();
                trainingTextRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            } else {
                showAlert('success', data.message || 'Training successful!');
            }

            setUrl('');
            setTrainingText('');
            clearFile();
        } catch (error) {
            showAlert('error', error.message);
        } finally {
            setIsTraining(false);
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

    const bentoCardStyle = "bg-white dark:bg-[#111111] border border-slate-200 dark:border-slate-800 rounded-xl p-5 sm:p-6 group relative overflow-hidden flex flex-col";

    if (isContextLoading) {
        return <Loader fullScreen />;
    }

    return (
        <>
            <SignedIn>
                <div className="w-full min-h-screen bg-slate-50 dark:bg-[#0A0A0A] text-slate-900 dark:text-slate-200 pt-28 pb-12 px-4 sm:px-6 lg:px-8 flex justify-center flex-col items-center">
                    <div className="max-w-7xl mx-auto relative z-10 w-full">
                        {/* Header */}
                        <div className="mb-8 md:mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6">
                            <div className="w-full">
                                <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
                                    <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-slate-900 dark:text-white tracking-tight">
                                        <span className="bg-linear-to-r from-red-600 to-indigo-600 bg-clip-text text-transparent font-black leading-tight">Neural Engine Console</span>
                                    </h1>
                                    {userTier === 'STARTER' && (
                                        <div className={`px-2 py-0.5 rounded-md border text-[11px] font-mono uppercase tracking-wider flex items-center gap-2 ${daysLeft > 5
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
                            <div className="flex items-center gap-4 bg-white dark:bg-[#111111] p-4 rounded-xl border border-slate-200 dark:border-slate-800 w-full md:w-auto justify-between md:justify-start">
                                <div className='text-left md:text-center px-0 md:px-4'>
                                    <p className="text-sm md:text-xs font-bold text-slate-900 dark:text-white leading-none mb-1">{user?.fullName || 'Developer'}</p>
                                    <p className="text-[10px] md:text-[9px] text-slate-400 uppercase font-mono tracking-widest">
                                        {userRole === 'SUPER_ADMIN' ? 'Platform Owner' : userRole === 'ADMIN' ? 'Company Admin' : 'Member'}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="mb-10">
                            {isLoading ? <SkeletonLoader.Stats /> : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                    {[
                                        { label: 'Total Ingested', value: stats.total_documents || 0, icon: Database, unit: 'docs' },
                                        { label: 'Active Memory', value: stats.total_messages || 0, icon: Activity, unit: 'msgs' },
                                        { label: 'Sync Status', value: 'Optimal', icon: Zap, unit: 'real-time' },
                                        { label: 'System Tier', value: userTier || 'Loading...', icon: Lock, unit: 'unlocked' }
                                    ].map((s, i) => (
                                        <div key={i} className="bg-white dark:bg-[#111111] border border-slate-200 dark:border-slate-800 p-4 sm:p-5 rounded-xl transition-colors">
                                            <div className="flex items-center gap-2 mb-3">
                                                <s.icon className="w-3.5 h-3.5 text-slate-500" />
                                                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{s.label}</p>
                                            </div>
                                            <h4 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight flex items-baseline gap-2">
                                                {s.value}
                                                <span className="text-[9px] text-slate-400 uppercase tracking-widest font-mono font-medium">{s.unit}</span>
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
                                <section className={`${bentoCardStyle} p-5 lg:p-6 min-h-[400px]`}>
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

                                    <div className="flex items-center gap-2 mb-6 relative z-10">
                                        <BrainCircuit className="w-3.5 h-3.5 text-slate-500" />
                                        <h2 className="text-xs font-bold uppercase tracking-widest text-slate-900 dark:text-white">Knowledge Ingestion</h2>
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
                                        <form onSubmit={handleTrain} className="space-y-8 relative z-10">
                                            {/* Vertical Layout for all fields */}
                                            <div className="flex flex-col gap-6">
                                                <div>
                                                    <label className="block text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-2">API Secret Key</label>
                                                    <div className="relative group">
                                                        <input
                                                            type={showApiKey ? "text" : "password"}
                                                            value={apiKey}
                                                            onChange={(e) => setApiKey(e.target.value)}
                                                            className="w-full px-3 py-2.5 bg-transparent border border-slate-300 dark:border-slate-800 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 font-mono text-xs text-slate-900 dark:text-white transition-colors pr-10"
                                                            placeholder="sb_live_..."
                                                        />
                                                        <button type="button" onClick={() => setShowApiKey(!showApiKey)} className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-700">
                                                            {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                                        </button>
                                                    </div>
                                                </div>

                                                <div>
                                                    <label className="block text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-2">Source URL</label>
                                                    <input
                                                        type="url"
                                                        value={url}
                                                        onChange={(e) => setUrl(e.target.value)}
                                                        className="w-full px-3 py-2.5 text-sm bg-transparent border border-slate-300 dark:border-slate-800 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-slate-900 dark:text-white transition-colors"
                                                        placeholder="https://docs.site.com"
                                                    />
                                                </div>

                                                <div>
                                                    <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Knowledge Text (Manual Entry)</label>
                                                    <textarea
                                                        ref={trainingTextRef}
                                                        value={trainingText}
                                                        onChange={(e) => setTrainingText(e.target.value)}
                                                        rows={4}
                                                        className={`w-full px-3 py-2.5 text-sm bg-transparent border rounded-md focus:outline-none focus:ring-1 transition-all resize-none ${alertConfig.type === 'warning' && alertConfig.open
                                                            ? 'border-amber-400 ring-2 ring-amber-400/20 bg-amber-50/5 dark:bg-amber-400/5 animate-pulse'
                                                            : 'border-slate-300 dark:border-slate-800'
                                                            }`}
                                                        placeholder="Paste your services, FAQs, or raw knowledge here..."
                                                    />
                                                </div>

                                                <div>
                                                    <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">PDF Archive</label>
                                                    <div
                                                        onClick={() => fileInputRef.current?.click()}
                                                        className="flex flex-col items-center justify-center gap-3 px-6 py-10 bg-transparent border-2 border-dashed border-slate-300 dark:border-slate-800 rounded-xl cursor-pointer hover:border-indigo-500/50 hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-all group"
                                                    >
                                                        <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-white/5 flex items-center justify-center text-slate-400 group-hover:text-indigo-500 transition-colors">
                                                            <UploadCloud className="w-5 h-5" />
                                                        </div>
                                                        <div className="text-center">
                                                            <span className="text-[13px] font-bold text-slate-900 dark:text-white block mb-0.5">
                                                                {file ? file.name : "Drop mission-critical PDF here"}
                                                            </span>
                                                            <span className="text-[9px] text-slate-400 uppercase tracking-widest font-bold">
                                                                {file ? "Click to change file" : "or click to browse filesystem"}
                                                            </span>
                                                        </div>
                                                        <input type="file" ref={fileInputRef} className="hidden" accept=".pdf" onChange={handleFileChange} />
                                                    </div>
                                                </div>
                                            </div>

                                            <button
                                                type="submit"
                                                disabled={isTraining || isLockedOut}
                                                className={`w-full py-3 rounded-md text-sm font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-3 ${isLockedOut
                                                    ? 'bg-slate-100 dark:bg-[#1A1A1A] text-slate-400 border border-slate-200 dark:border-slate-800 cursor-not-allowed'
                                                    : 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-white active:scale-[0.98]'
                                                    }`}
                                            >
                                                {isTraining ? "Training Neural Model..." : isLockedOut ? "Lockout Active" : "Start Training Sequence"}
                                            </button>
                                        </form>
                                    )}
                                </section>
                            </div>

                            {/* Right Column: Stats & Meta (Spans 5) */}
                            <div className="lg:col-span-5 grid grid-cols-1 sm:grid-cols-2 gap-8">
                                {isLoading ? <SkeletonLoader.Card /> : (
                                    <div className={`${bentoCardStyle} sm:col-span-2`}>
                                        <div className="flex justify-between items-start mb-6">
                                            <div className="flex items-center gap-2">
                                                <Database className="w-3.5 h-3.5 text-slate-500" />
                                                <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-500">API Usage</h4>
                                            </div>
                                            {(messageLimit === null || messageLimit >= 999999) && (
                                                <span className="px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-[#1A1A1A] text-[9px] font-mono font-bold uppercase tracking-widest text-indigo-600 dark:text-indigo-400">Unlimited</span>
                                            )}
                                        </div>

                                        <div className="flex items-end gap-2 mb-4">
                                            <span className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
                                                {messagesUsed}
                                                {messageLimit !== null && messageLimit < 999999 && (
                                                    <span className="text-xs text-slate-400"> / {messageLimit}</span>
                                                )}
                                            </span>
                                            <span className="text-[9px] font-mono font-bold uppercase tracking-widest text-slate-500 mb-1.5 ml-1.5">reqs</span>
                                        </div>

                                        {messageLimit !== null && messageLimit < 999999 && (
                                            <>
                                                <div className="w-full h-1.5 bg-slate-100 dark:bg-[#1A1A1A] rounded-full overflow-hidden flex">
                                                    <motion.div
                                                        initial={{ width: 0 }}
                                                        animate={{ width: `${Math.min((messagesUsed / messageLimit) * 100, 100)}%` }}
                                                        className={`h-full transition-all duration-700 ${(messagesUsed / messageLimit) >= 1 ? 'bg-red-500' :
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
                                )}

                                {isLoading ? <SkeletonLoader.Card /> : (
                                    <div className={`${bentoCardStyle} sm:col-span-2 min-h-[180px] border-indigo-200/30 dark:border-indigo-800/20`}>
                                        <div className="relative z-10">
                                            <div className="px-2 py-0.5 rounded-md border border-indigo-200 dark:border-indigo-800/30 bg-indigo-50 dark:bg-indigo-900/10 text-[9px] font-mono font-bold uppercase tracking-widest text-indigo-600 dark:text-indigo-400 w-fit mb-4">Roadmap Expansion</div>
                                            <h3 className="text-xs font-bold text-slate-900 dark:text-white mb-2 tracking-tight uppercase">Multi-Modality Vectoring</h3>
                                            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed font-medium">Coming soon. Cross-reference images, audio logs, and structured JSON feeds into a single unified knowledge model.</p>
                                        </div>
                                    </div>
                                )}
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
