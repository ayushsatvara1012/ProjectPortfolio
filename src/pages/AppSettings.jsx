import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { useUser, useAuth, UserButton } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';
import { User, CreditCard, Palette, ShieldCheck, KeyRound, Eye, EyeOff } from 'lucide-react';
import Alert from '../components/alert';
import ManageSubscriptions from '../components/ManageSubscriptions';
import { useBotSettings } from '../context/BotSettingsContext';
import { useUserRole } from '../context/UserContext';
import BotPreview from '../components/BotPreview';

const cellCls = 'bg-white';
const inputCls = "w-full px-3 py-2.5 bg-transparent border border-gray-100 focus:outline-none focus:ring-1 focus:ring-slate-900/20 focus:border-slate-400 text-sm text-slate-900 transition-all";
const labelCls = "block text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-1.5";
const headingCls = "text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-4";
const sectionGap = 'space-y-px';
const GRID_BG = { background: 'white' };

// ── Account ───────────────────────────────────────────────────────────────────
export const AccountSection = () => {
    const { user } = useUser();
    const { userRole } = useUserRole();
    const navigate = useNavigate();
    return (
        <div className={sectionGap + ' p-8'} style={GRID_BG}>
            <div className={`${cellCls} px-6 py-5 border border-gray-100`}>
                <h2 className="text-base font-bold text-slate-900 mb-0.5">Account</h2>
                <p className="text-sm text-slate-500">Manage your profile and access.</p>
            </div>
            <div className={`${cellCls} p-6 border border-gray-100`}>
                <p className={headingCls}><User className="inline w-3.5 h-3.5 mr-1.5 text-slate-400" />Profile</p>
                <div className="flex items-center gap-4 p-4 bg-[#FAFAFA] border border-gray-100">
                    <UserButton appearance={{ elements: { avatarBox: 'w-12 h-12' } }} />
                    <div>
                        <p className="font-bold text-slate-900">{user?.fullName || 'Developer'}</p>
                        <p className="text-sm text-slate-500">{user?.primaryEmailAddress?.emailAddress}</p>
                        <span className="inline-flex mt-1 px-2 py-0.5 border border-gray-200 bg-[#FAFAFA] text-[9px] font-bold uppercase tracking-widest text-slate-500">
                            {userRole === 'SUPER_ADMIN' ? 'Platform Owner' : userRole === 'ADMIN' ? 'Admin' : 'Member'}
                        </span>
                    </div>
                </div>
                <p className="text-xs text-slate-400 mt-3">Click your avatar to manage name, password, and connected accounts.</p>
            </div>
        </div>
    );
};

// ── Billing ───────────────────────────────────────────────────────────────────
export const BillingSection = () => (
    <div className={sectionGap + ' p-8'} style={GRID_BG}>
        <div className={`${cellCls} px-6 py-5 border border-gray-100`}>
            <h2 className="text-base font-bold text-slate-900 mb-0.5">Billing</h2>
            <p className="text-sm text-slate-500">Manage your subscription and invoices.</p>
        </div>
        <div className={cellCls + ' border border-gray-100'}><ManageSubscriptions /></div>
    </div>
);

// ── Customize (docked BotPreview as separate full-height column) ─────────────
export const CustomizeSection = () => {
    const { botSettings, updateSetting } = useBotSettings();
    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-px h-full bg-[#E8EBF0] overflow-hidden" style={GRID_BG}>
            {/* Left Column: Header + Form */}
            <div className="bg-white flex flex-col overflow-hidden">
                <div className="px-8 py-6 border-b border-gray-100 shrink-0">
                    <h2 className="text-base font-bold text-slate-900 mb-0.5">Customize</h2>
                    <p className="text-sm text-slate-500">Configure your bot's visual identity. Changes reflect instantly in the preview.</p>
                </div>
                {/* Form area (padded, scrollable) */}
                <div className="p-8 overflow-y-auto custom-scrollbar flex-1">
                    <p className={headingCls}><Palette className="inline w-3.5 h-3.5 mr-1.5 text-slate-400" />Bot Appearance</p>
                    <div className="space-y-6">
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
                                <div className="w-12 h-12 border border-gray-200 overflow-hidden cursor-pointer shrink-0 rounded-lg shadow-sm"
                                    style={{ background: botSettings.primaryColor }}>
                                    <input type="color" value={botSettings.primaryColor}
                                        onChange={e => updateSetting('primaryColor', e.target.value)}
                                        className="opacity-0 w-full h-full cursor-pointer" />
                                </div>
                                <input type="text" value={botSettings.primaryColor}
                                    onChange={e => updateSetting('primaryColor', e.target.value)}
                                    className={inputCls + ' font-mono uppercase text-base'} placeholder="#5730F5" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            {/* Right Column: Preview (flush) */}
            <div className="bg-white overflow-hidden border-l border-gray-100 h-full relative">
                <BotPreview />
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
            const res = await fetch(`${baseUrl}/api/rotate-key`, {
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
        <div className={sectionGap + ' p-8'} style={GRID_BG}>
            <div className={`${cellCls} px-6 py-5 border border-gray-100`}>
                <h2 className="text-base font-bold text-slate-900 mb-0.5">API Keys</h2>
                <p className="text-sm text-slate-500">Rotate your secret API key. The old key is immediately invalidated.</p>
            </div>
            <div className={`${cellCls} p-6 border border-gray-100`}>
                <p className={headingCls}><KeyRound className="inline w-3.5 h-3.5 mr-1.5 text-slate-400" />API Key Management</p>
                {newKey && (
                    <div className="mb-5 p-4 bg-emerald-50 border border-emerald-200">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 mb-2">New Key — Copy Now</p>
                        <div className="flex items-center gap-2 font-mono text-xs text-slate-900 bg-white border border-emerald-200 p-3">
                            <span className="flex-1 truncate">{showKey ? newKey : newKey.slice(0, 8) + '••••••••••••••••'}</span>
                            <button onClick={() => setShowKey(p => !p)} className="text-slate-400 hover:text-slate-600">
                                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                            <button onClick={() => { navigator.clipboard.writeText(newKey); showAlertMsg('success', 'Copied!'); }}
                                className="px-2 py-1 bg-slate-900 text-white text-[10px] font-bold">Copy</button>
                        </div>
                    </div>
                )}
                <button onClick={handleRotate} disabled={isLoading}
                    className="px-5 py-2.5 min-h-[44px] bg-slate-900 text-white text-xs font-bold uppercase tracking-widest hover:bg-slate-800 transition-colors disabled:opacity-50 flex items-center gap-2 active:scale-[0.99]">
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
