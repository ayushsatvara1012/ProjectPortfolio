import React, { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { useUser, useAuth, UserButton } from '@clerk/clerk-react';
import { useNavigate, Link } from 'react-router-dom';
import { User, Palette, KeyRound, Eye, EyeOff, Lock, Plus, Trash2, Sun, Moon, Bot, ChevronDown } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import Alert from '../components/alert';
import ManageSubscriptions from '../components/ManageSubscriptions';
import { useBotSettings } from '../context/BotSettingsContext';
import { useUserRole } from '../context/UserContext';
import BotPreview from '../components/BotPreview';
import { useAuthenticatedFetch } from '../hooks/useApiCall';

const cellCls = 'bg-white dark:bg-slate-950 transition-colors duration-500';
const inputCls = "w-full text-md font-mono px-3 py-2.5 bg-transparent border border-gray-100 dark:border-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-900/20 dark:focus:ring-indigo-500/50 focus:border-slate-400 dark:focus:border-indigo-400 text-slate-900 dark:text-slate-200 transition-colors";
const labelCls = "block text-md font-display uppercase tracking-widest font-bold text-slate-400 dark:text-slate-500 font-sans mb-1.5 transition-colors";
const headingCls = "text-md font-display uppercase tracking-widest font-bold text-slate-400 dark:text-slate-500 font-sans mb-4 transition-colors";
const sectionGap = 'space-y-px';

// ── Account ───────────────────────────────────────────────────────────────────
export const AccountSection = () => {
    const { user } = useUser();
    const { userRole } = useUserRole();
    return (
        <div className={sectionGap + ' p-8 bg-white dark:bg-slate-900 transition-colors duration-500'}>
            <div className={`${cellCls} px-6 py-5 border border-gray-100 dark:border-slate-800 transition-colors`}>
                <h2 className="text-xl md:text-2xl font-display font-bold text-slate-900 dark:text-slate-200 mb-0.5 transition-colors">Account</h2>
                <p className="text-md font-display text-slate-500 dark:text-slate-400 leading-relaxed transition-colors">Manage your profile and access.</p>
            </div>
            <div className={`${cellCls} p-6 border border-gray-100 dark:border-slate-800 transition-colors`}>
                <p className={headingCls}><User className="inline w-3.5 h-3.5 mr-1.5 text-slate-400 dark:text-slate-500 transition-colors" />Profile</p>
                <div className="flex items-center gap-4 p-4 bg-[#FAFAFA] dark:bg-slate-900 border border-gray-100 dark:border-slate-800 transition-colors">
                    <UserButton appearance={{ elements: { avatarBox: 'w-12 h-12' } }} />
                    <div>
                        <p className="text-xl md:text-2xl font-display font-bold text-slate-900 dark:text-slate-200 transition-colors">{user?.fullName || 'Developer'}</p>
                        <p className="text-md font-display text-slate-500 dark:text-slate-400 leading-relaxed transition-colors">{user?.primaryEmailAddress?.emailAddress}</p>
                        <span className="inline-flex mt-1 px-2 py-0.5 border border-gray-200 dark:border-slate-700 bg-[#FAFAFA] dark:bg-slate-800 text-[10px] uppercase tracking-widest font-bold text-slate-500 dark:text-slate-400 font-sans transition-colors">
                            {userRole === 'SUPER_ADMIN' ? 'Platform Owner' : userRole === 'ADMIN' ? 'Admin' : 'Member'}
                        </span>
                    </div>
                </div>
                <p className="text-lg font-sans text-slate-400 dark:text-slate-500 font-medium mt-3 transition-colors">Click your avatar to manage name, password, and connected accounts.</p>
            </div>
        </div>
    );
};

// ── Billing ───────────────────────────────────────────────────────────────────
export const BillingSection = () => (
    <div className={sectionGap + ' p-8 bg-white dark:bg-slate-900 transition-colors duration-500'}>
        <div className={`${cellCls} px-6 py-5 border border-gray-100 dark:border-slate-800 transition-colors`}>
            <h2 className="text-xl md:text-2xl font-display font-bold text-slate-900 dark:text-slate-200 mb-0.5 transition-colors">Billing</h2>
            <p className="text-md font-display text-slate-500 dark:text-slate-400 leading-relaxed transition-colors">Manage your subscription and invoices.</p>
        </div>
        <div className={cellCls + ' border border-gray-100 dark:border-slate-800 transition-colors'}><ManageSubscriptions /></div>
    </div>
);

// ── Customize (docked BotPreview as separate full-height column) ─────────────
export const CustomizeSection = () => {
    const { botSettings, updateSetting, saveSettings, fetchSettings, isSaving, isLoading } = useBotSettings();
    const { userTier, userRole } = useUserRole();
    const authFetch = useAuthenticatedFetch();
    const [alert, setAlert] = useState({ open: false, type: 'success', msg: '' });

    // Bot Selection Logic
    const [selectedBotId, setSelectedBotId] = useState('');
    const { data: botsData } = useQuery({
        queryKey: ['bots'],
        queryFn: () => authFetch('/api/companies'),
    });
    const bots = botsData?.bots || [];

    // Sync selectedBotId and fetch settings
    useEffect(() => {
        if (bots.length > 0 && !selectedBotId) {
            setSelectedBotId(bots[0].id);
        }
    }, [bots, selectedBotId]);

    useEffect(() => {
        if (selectedBotId) {
            fetchSettings(selectedBotId);
        }
    }, [selectedBotId]);

    // Theme Toggle Logic (Localized to Bot Preview)
    const [isDark, setIsDark] = useState(false); 

    useEffect(() => {
        // Analyze current system/global theme on mount
        const isSystemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        const isGlobalDark = document.documentElement.classList.contains('dark');
        setIsDark(isSystemDark || isGlobalDark);
    }, []);

    const toggleTheme = () => setIsDark(!isDark);

    // Tiered Access Logic
    const isTotallyLocked = !userTier || userTier === 'null';
    const isFree = userTier === 'FREE';
    const isBasic = userTier === 'BASIC';
    const isAdvancedLocked = (isFree || isBasic) && userRole !== 'SUPER_ADMIN';
    const showFullOverlay = isTotallyLocked || isFree;

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-px h-auto lg:h-[calc(100vh-3rem)] bg-[#E8EBF0] dark:bg-slate-900 overflow-visible lg:overflow-hidden transition-colors duration-500">
            {/* Left Column: Header + Form */}
            <div className="bg-white dark:bg-slate-950 flex flex-col lg:overflow-hidden relative transition-colors h-auto lg:h-full">
                <div className="px-8 py-6 border-b border-gray-100 dark:border-slate-800 shrink-0 transition-colors">
                    <h2 className="text-xl md:text-2xl font-display font-bold text-slate-900 dark:text-slate-200 mb-0.5 transition-colors">Customize</h2>
                    <p className="text-md font-display text-slate-500 dark:text-slate-400 leading-relaxed transition-colors">Configure your bot's visual identity. Changes reflect instantly in the preview.</p>
                </div>
                {/* Form area (padded, scrollable on desktop) */}
                <div className="p-8 lg:overflow-y-auto custom-scrollbar lg:flex-1 relative">
                    
                    {showFullOverlay && (
                        <div className="absolute inset-0 z-50 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center border-t border-gray-100 dark:border-slate-800 transition-colors">
                             <Lock className="w-8 h-8 text-slate-400 dark:text-slate-500 mb-4 transition-colors" />
                             <h3 className="text-md font-display uppercase tracking-widest font-bold text-slate-900 dark:text-slate-200 mb-2 transition-colors">Upgrade Required</h3>
                             <p className="text-md font-display text-slate-500 dark:text-slate-400 leading-relaxed max-w-[260px] mb-6 transition-colors">Customizing your bot's visual identity requires an active subscription.</p>
                             <Link to="/app/pricing" className="px-6 py-3 bg-slate-900 dark:bg-indigo-600 text-white text-md font-display uppercase tracking-widest font-bold hover:bg-slate-800 dark:hover:bg-indigo-500 transition-colors shadow-sm">
                                 View Plans
                             </Link>
                        </div>
                    )}

                    {userRole === 'SUPER_ADMIN' && (
                        <div className="mb-8 p-4 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30 transition-colors">
                            <p className={headingCls + ' text-amber-700! dark:text-amber-500! mb-2'}>Admin: Model Engine Override</p>
                            <div className="space-y-4">
                                <div>
                                    <label className={labelCls + ' text-amber-600! dark:text-amber-400!'}>Select Model Engine</label>
                                    <select 
                                        value={botSettings.aiModel}
                                        onChange={e => updateSetting('aiModel', e.target.value)}
                                        className={inputCls + ' bg-white! dark:bg-slate-950! border-amber-200! dark:border-amber-900/50!'}
                                    >
                                        <option value="">Default (Auto / Tier-based)</option>
                                        <option value="gemini-2.5-flash-lite">Gemini 2.5 Flash-Lite (Max Speed)</option>
                                        <option value="gemini-2.5-flash">Gemini 2.5 Flash (Balanced Thinking)</option>
                                        <option value="gemini-2.5-pro">Gemini 2.5 Pro (Standard Reasoning)</option>
                                        <option value="gemini-3.1-pro-preview">Gemini 3.1 Pro (Next-Gen Preview)</option>
                                    </select>
                                    <p className="text-[10px] text-amber-600/70 mt-2 italic font-sans uppercase tracking-widest leading-relaxed">
                                        This override bypasses the user's subscription tier model mapping.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Bot Selector UI */}
                    {bots.length > 1 && (
                        <div className="mb-8 p-6 bg-[#FAFAFA] dark:bg-slate-900 border border-gray-100 dark:border-slate-800 transition-colors shadow-sm">
                            <div className="flex items-center gap-2 mb-4">
                                <Bot className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                                <p className={headingCls + ' mb-0'}>Customization Target</p>
                            </div>
                            <div className="relative">
                                <select 
                                    value={selectedBotId}
                                    onChange={e => setSelectedBotId(e.target.value)}
                                    className={inputCls + " appearance-none pr-10 font-sans font-medium text-sm"}
                                >
                                    {bots.map(b => (
                                        <option key={b.id} value={b.id}>
                                            {b.bot_name || 'Unnamed Bot'} — {b.company_name}
                                        </option>
                                    ))}
                                </select>
                                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                            </div>
                            <p className="text-[10px] text-slate-400 mt-2 italic font-sans uppercase tracking-widest leading-relaxed">
                                Switching bots will load their specific visual identity and configuration.
                            </p>
                        </div>
                    )}

                    <p className={headingCls}><Palette className="inline w-3.5 h-3.5 mr-1.5 text-slate-400 dark:text-slate-500 transition-colors" />Bot Appearance</p>
                    <div className={`space-y-6 ${showFullOverlay || isLoading ? 'opacity-30 pointer-events-none' : ''}`}>
                        <div>
                            <label className={labelCls}>Bot Name</label>
                            <input type="text" value={botSettings.name}
                                onChange={e => updateSetting('name', e.target.value)}
                                className={inputCls} placeholder="SaPyBase AI" />
                        </div>
                        <div>
                            <label className={labelCls}>Greeting Message</label>
                            <input type="text" value={botSettings.greeting}
                                onChange={e => updateSetting('greeting', e.target.value)}
                                className={inputCls} placeholder="Hi! How can I help you today?" />
                        </div>
                        <div>
                            <label className={labelCls}>Primary Color</label>
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 border border-gray-200 dark:border-slate-700 overflow-hidden cursor-pointer shrink-0 rounded-none bg-slate-100 dark:bg-slate-900 transition-colors"
                                    style={{ background: botSettings.primaryColor }}>
                                    <input type="color" value={botSettings.primaryColor}
                                        onChange={e => updateSetting('primaryColor', e.target.value)}
                                        className="opacity-0 w-full h-full cursor-pointer" />
                                </div>
                                <input type="text" value={botSettings.primaryColor}
                                    onChange={e => updateSetting('primaryColor', e.target.value)}
                                    className={inputCls + ' font-mono uppercase text-md font-display leading-relaxed'} placeholder="#5730F5" />
                            </div>
                        </div>

                        {/* Advanced Sections: Locked for BASIC Tier */}
                        <div className="space-y-6 relative">
                            {isAdvancedLocked && (
                                <div className="absolute -inset-4 z-40 bg-white/40 dark:bg-slate-950/40 backdrop-blur-[2px] flex flex-col items-center justify-center p-4 text-center group cursor-help transition-all hover:backdrop-blur-sm">
                                    <div className="px-3 py-1.5 bg-slate-900 dark:bg-indigo-600 text-white text-[10px] uppercase tracking-widest font-bold font-sans shadow-lg flex items-center gap-2">
                                        <Lock className="w-3 h-3" /> Starter or Pro Required
                                    </div>
                                    <Link to="/app/pricing" className="mt-2 text-xs font-bold text-slate-800 dark:text-slate-200 underline underline-offset-4 decoration-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity">Upgrade Now</Link>
                                </div>
                            )}

                            <div className={isAdvancedLocked ? 'opacity-40 grayscale-[0.5] pointer-events-none filter blur-[0.5px]' : ''}>
                                {/* Company Tone */}
                                <div className="mb-6">
                                    <label className={labelCls}>Company Tone</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {['Professional', 'Friendly', 'Humorous', 'Technical', 'Concise'].map(tone => (
                                            <label key={tone} className="flex items-center gap-2 p-3 border border-gray-100 dark:border-slate-800 bg-[#FAFAFA] dark:bg-slate-900 cursor-pointer hover:border-slate-300 dark:hover:border-slate-600 transition-colors">
                                                <input 
                                                    type="checkbox" 
                                                    checked={botSettings.companyTone?.includes(tone)}
                                                    onChange={(e) => {
                                                        const newTones = e.target.checked 
                                                            ? [...botSettings.companyTone, tone] 
                                                            : botSettings.companyTone.filter(t => t !== tone);
                                                        updateSetting('companyTone', newTones);
                                                    }}
                                                    className="w-4 h-4 accent-slate-900 dark:accent-indigo-600"
                                                />
                                                <span className="text-lg font-sans font-medium text-slate-700 dark:text-slate-300">{tone}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                {/* System Prompt */}
                                <div className="mb-6">
                                    <label className={labelCls}>System Prompt / Instructions</label>
                                    <textarea 
                                        value={botSettings.systemPrompt}
                                        onChange={e => updateSetting('systemPrompt', e.target.value)}
                                        className={inputCls + ' min-h-[120px] resize-none py-3'}
                                        placeholder="Example: You are a helpful assistant for SaPyBase. Always be professional and direct..."
                                    />
                                    <p className="text-[10px] text-slate-400 mt-2 italic font-sans uppercase tracking-widest leading-relaxed">
                                        Core instructions for your AI. Define its personality and constraints here.
                                    </p>
                                </div>

                                {/* Quick Questions */}
                                <div>
                                    <div className="flex items-center justify-between mb-4">
                                        <label className={labelCls + ' mb-0'}>Quick Questions</label>
                                        <button 
                                            onClick={() => updateSetting('quickQuestions', [...botSettings.quickQuestions, { label: '', prompt: '' }])}
                                            className="p-1 px-2 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 text-[10px] uppercase tracking-widest font-bold font-sans transition-colors flex items-center gap-1.5"
                                        >
                                            <Plus className="w-3 h-3" /> Add Question
                                        </button>
                                    </div>
                                    <div className="space-y-3">
                                        {(Array.isArray(botSettings.quickQuestions) ? botSettings.quickQuestions : []).map((q, idx) => (
                                            <div key={idx} className="p-4 bg-[#FAFAFA] dark:bg-slate-900 border border-gray-100 dark:border-slate-800 space-y-3 relative group transition-colors">
                                                <button 
                                                    onClick={() => {
                                                        const newQs = [...botSettings.quickQuestions];
                                                        newQs.splice(idx, 1);
                                                        updateSetting('quickQuestions', newQs);
                                                    }}
                                                    className="absolute top-2 right-2 p-1.5 text-slate-400 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                                <div>
                                                    <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400 font-sans mb-1.5 transition-colors">Label (Button Text)</p>
                                                    <input 
                                                        type="text" 
                                                        value={q.label}
                                                        onChange={e => {
                                                            const newQs = [...botSettings.quickQuestions];
                                                            newQs[idx].label = e.target.value;
                                                            updateSetting('quickQuestions', newQs);
                                                        }}
                                                        className={inputCls + ' text-sm py-2'}
                                                        placeholder="e.g. Pricing"
                                                    />
                                                </div>
                                                <div>
                                                    <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400 font-sans mb-1.5 transition-colors">Prompt (Hidden Message)</p>
                                                    <input 
                                                        type="text" 
                                                        value={q.prompt}
                                                        onChange={e => {
                                                            const newQs = [...botSettings.quickQuestions];
                                                            newQs[idx].prompt = e.target.value;
                                                            updateSetting('quickQuestions', newQs);
                                                        }}
                                                        className={inputCls + ' text-sm py-2'}
                                                        placeholder="e.g. Tell me about your pricing plans"
                                                    />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Save Button */}
                        <div className="pt-4 border-t border-gray-100 dark:border-slate-800 transition-colors">
                            <button 
                                onClick={async () => {
                                    const res = await saveSettings(selectedBotId);
                                    if (res.success) {
                                        setAlert({ open: true, type: 'success', msg: 'Settings saved successfully!' });
                                    } else {
                                        setAlert({ open: true, type: 'error', msg: res.message });
                                    }
                                }}
                                disabled={isSaving || showFullOverlay}
                                className="w-full py-4 min-h-[48px] bg-slate-900 dark:bg-indigo-600 text-white text-lg uppercase tracking-widest font-bold font-sans hover:bg-slate-800 dark:hover:bg-indigo-500 transition-all flex items-center justify-center gap-3 active:scale-[0.98] disabled:opacity-50"
                            >
                                {isSaving ? (
                                    <><div className="w-3 h-3 border-2 border-white/30 border-t-white animate-spin" /> PERSISTING...</>
                                ) : (
                                    <>SAVE_CONFIG</>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
                <Alert 
                    isOpen={alert.open} 
                    type={alert.type} 
                    message={alert.msg} 
                    onClose={() => setAlert(p => ({ ...p, open: false }))} 
                />
            </div>

            {/* Right Column: Preview (Responsive Scaling Container) */}
            {/* Right Column: Preview (Responsive Scaling Container) */}
            <div className={`overflow-visible lg:overflow-hidden border-t lg:border-t-0 lg:border-l w-full h-auto lg:h-full relative transition-colors flex flex-col items-center justify-center custom-scrollbar p-0 lg:p-8 ${isDark ? 'dark bg-slate-950 border-slate-800' : 'bg-[#FAFAFA] border-gray-100'}`}>
                {/* Visual Note & Theme Toggle */}
                <div className="absolute bottom-8 lg:top-2 lg:bottom-auto left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-3 w-full px-4 text-center">
                    <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400 dark:text-slate-500 font-sans">
                        Check contrast in both modes
                    </p>
                    <button 
                        onClick={toggleTheme}
                        className="flex items-center gap-2.5 px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-full shadow-lg hover:scale-105 active:scale-95 transition-all group"
                    >
                        <div className="w-5 h-5 flex items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 transition-colors">
                            {isDark ? <Sun className="w-3.5 h-3.5 text-amber-500" /> : <Moon className="w-3.5 h-3.5 text-indigo-500" />}
                        </div>
                        <span className="text-[10px] uppercase tracking-widest font-bold text-slate-700 dark:text-slate-300">
                            {isDark ? 'Preview: Light Mode' : 'Preview: Dark Mode'} — <span className="text-indigo-500 dark:text-amber-500">Switch</span>
                        </span>
                    </button>
                </div>

                <div className="w-full lg:h-full lg:w-full flex lg:items-center lg:justify-center origin-top lg:origin-center scale-[0.82] lg:scale-100 transition-transform duration-500 py-4 lg:py-0">
                    <BotPreview theme={isDark ? 'dark' : 'light'} />
                </div>
            </div>
        </div>
    );
};

// ── API Keys ──────────────────────────────────────────────────────────────────
export const ApiKeysSection = () => {
    const { getToken } = useAuth();
    const [isLoading, setIsLoading] = useState(false);
    const [newKey, setNewKey] = useState('');
    const [showKey, setShowKey] = useState(false);
    const [alert, setAlert] = useState({ open: false, type: 'success', msg: '' });
    const baseUrl = import.meta.env.VITE_API_URL || '';

    const showAlertMsg = (type, msg) => {
        setAlert({ open: true, type, msg });
        setTimeout(() => setAlert(p => ({ ...p, open: false })), 6000);
    };

    const handleRotate = async () => {
        if (!window.confirm('Rotating your key will invalidate the old one. Continue?')) return;
        setIsLoading(true);
        try {
            const token = await getToken();
            const res = await fetch(`${baseUrl}/api/company/rotate-key`, {
                method: 'POST', headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.detail || 'Key rotation failed.');
            setNewKey(data.new_key);
            showAlertMsg('success', 'Key rotated. Copy it now — it will not be shown again.');
        } catch (e) {
            showAlertMsg('error', e.message);
        } finally { setIsLoading(false); }
    };

    return (
        <div className={sectionGap + ' p-8 bg-white dark:bg-slate-900 transition-colors duration-500'}>
            <div className={`${cellCls} px-6 py-5 border border-gray-100 dark:border-slate-800 transition-colors`}>
                <h2 className="text-xl md:text-2xl font-display font-bold text-slate-900 dark:text-slate-200 mb-0.5 transition-colors">API Keys</h2>
                <p className="text-md font-display text-slate-500 dark:text-slate-400 leading-relaxed transition-colors">Rotate your secret API key. The old key is immediately invalidated.</p>
            </div>
            <div className={`${cellCls} p-6 border border-gray-100 dark:border-slate-800 transition-colors`}>
                <p className={headingCls}><KeyRound className="inline w-3.5 h-3.5 mr-1.5 text-slate-400 dark:text-slate-500 transition-colors" />API Key Management</p>
                {newKey && (
                    <div className="mb-5 p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-900/50 transition-colors">
                        <p className="text-[10px] uppercase tracking-widest font-bold text-emerald-600 dark:text-emerald-400 font-sans mb-2 transition-colors">New Key — Copy Now</p>
                        <div className="flex items-center gap-2 font-mono text-sm text-slate-900 dark:text-slate-200 font-medium bg-white dark:bg-slate-950 border border-emerald-200 dark:border-emerald-900/50 p-3 transition-colors">
                            <span className="flex-1 truncate">{showKey ? newKey : newKey.slice(0, 8) + '••••••••••••••••'}</span>
                            <button onClick={() => setShowKey(p => !p)} className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
                                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                            <button onClick={() => { navigator.clipboard.writeText(newKey); showAlertMsg('success', 'Copied!'); }}
                                className="px-2 py-1 bg-slate-900 dark:bg-indigo-600 text-white text-[10px] uppercase tracking-widest font-bold font-sans hover:bg-slate-800 dark:hover:bg-indigo-500 transition-colors">Copy</button>
                        </div>
                    </div>
                )}
                <button onClick={handleRotate} disabled={isLoading}
                    className="px-5 py-2.5 min-h-[44px] bg-slate-900 dark:bg-indigo-600 text-white text-[10px] uppercase tracking-widest font-bold font-sans hover:bg-slate-800 dark:hover:bg-indigo-500 transition-colors disabled:opacity-50 flex items-center gap-2 active:scale-[0.99]">
                    {isLoading ? <><div className="w-3 h-3 border-2 border-white/30 border-t-white animate-spin" /> Rotating...</> : 'Rotate API Key'}
                </button>
            </div>
            <Alert isOpen={alert.open} type={alert.type} message={alert.msg} onClose={() => setAlert(p => ({ ...p, open: false }))} />
        </div>
    );
};

// ── Shell ─────────────────────────────────────────────────────────────────────
const AppSettings = () => <Outlet />;
export default AppSettings;
