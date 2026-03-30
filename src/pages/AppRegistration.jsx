import React, { useState } from 'react';
import {
    Building2, Globe, Palette, MessageSquare, Copy, CheckCircle,
    Code2, Sparkles, ArrowRight, Key, Zap, BookOpen, ChevronRight,
    ChevronDown, Shield, Bot, Lock
} from 'lucide-react';
import { SignedIn, SignedOut, SignUp, useUser, useAuth } from '@clerk/clerk-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, Link } from 'react-router-dom';
import Alert from '../components/alert';
import { AppPageSkeleton } from '../components/SkeletonLoader';
import { useUserRole } from '../context/UserContext';

const AppRegistration = () => {
    const { user, isLoaded } = useUser();
    const { getToken } = useAuth();
    const navigate = useNavigate();
    const { userTier } = useUserRole();

    const [formData, setFormData] = useState({
        companyName: '', allowedOrigin: '',
        themeColor: '#5730F5', companyTone: 'Professional and helpful'
    });
    const [isLoading, setIsLoading] = useState(false);
    const [registrationData, setRegistrationData] = useState(null);
    const [alert, setAlert] = useState({ open: false, type: 'success', msg: '' });
    const [copied, setCopied] = useState(false);
    const [openAccordion, setOpenAccordion] = useState(0);

    const isLocked = !userTier || userTier === 'FREE' || userTier === 'null';

    if (!isLoaded) return <div className="p-8"><AppPageSkeleton /></div>;

    const showAlert = (type, msg) => {
        setAlert({ open: true, type, msg });
        setTimeout(() => setAlert(p => ({ ...p, open: false })), 8000);
    };

    const handleCopy = (text) => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleChange = e => setFormData({ ...formData, [e.target.name]: e.target.value });

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.companyName.trim() || !formData.allowedOrigin.trim()) {
            showAlert('error', 'Company Name and Allowed Origin are required.');
            return;
        }
        setIsLoading(true);
        try {
            const token = await getToken();
            const baseUrl = import.meta.env.VITE_API_URL?.replace(/\/$/, '') || 'https://sapyai.onrender.com';
            const res = await fetch(`${baseUrl}/api/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({
                    company_name: formData.companyName,
                    allowed_origin: formData.allowedOrigin,
                    theme_color: formData.themeColor,
                    company_tone: formData.companyTone,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.detail || data.message || 'Registration failed.');
            setRegistrationData({ apiKey: data.api_key, companyName: formData.companyName, allowedOrigin: data.allowed_origin });
            showAlert('success', data.message || 'Registration successful!');
        } catch (err) {
            showAlert('error', err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleReset = () => {
        setRegistrationData(null);
        setFormData({ companyName: '', allowedOrigin: '', themeColor: '#5730F5', companyTone: 'Professional and helpful' });
    };

    const frontendUrl = window.location.origin;
    const backendUrl = import.meta.env.VITE_API_URL?.replace(/\/$/, '') || window.location.origin;

    const inputCls = "w-full pl-10 pr-3 py-2.5 bg-transparent border border-gray-100 focus:outline-none focus:ring-1 focus:ring-slate-900/20 focus:border-slate-400 text-sm text-slate-900 transition-all";
    const cardCls = "bg-white p-6";
    const cellCls = "bg-white";
    const GRID_BG = { background: '#E8EBF0' };

    const integrationGuides = [
        {
            title: 'Next.js (App Router)',
            code: `import Script from 'next/script';\n\nexport default function RootLayout({ children }) {\n  return (\n    <html lang="en">\n      <body>\n        {children}\n        <Script src="${frontendUrl}/widget.js"\n          data-api-key="${registrationData?.apiKey || 'YOUR_API_KEY'}"\n          strategy="lazyOnload"\n        />\n      </body>\n    </html>\n  );\n}`
        },
        {
            title: 'React / Vite',
            code: `<!-- In public/index.html -->\n<script\n  src="${frontendUrl}/widget.js"\n  data-api-key="${registrationData?.apiKey || 'YOUR_API_KEY'}"\n  defer\n></script>`
        },
        {
            title: 'Vanilla HTML / Webflow',
            code: `<!-- Before </body> -->\n<script\n  src="${frontendUrl}/widget.js"\n  data-api-key="${registrationData?.apiKey || 'YOUR_API_KEY'}"\n  defer\n></script>`
        },
    ];

    return (
        <div className="flex flex-col h-full bg-[#E8EBF0] overflow-hidden">
            {/* Header */}
            <div className="bg-white px-8 py-6 shrink-0 border-b border-gray-100">
                <div className="flex items-center gap-2 mb-1">
                    <Bot className="w-5 h-5 text-slate-600" />
                    <h1 className="text-xl md:text-2xl font-display font-bold text-slate-900">Bot Identity</h1>
                </div>
                <p className="text-md font-display text-slate-500 leading-relaxed">Configure your tenant and get your API integration credentials.</p>
            </div>

            <SignedOut>
                <div className="bg-white p-8 text-center max-w-md mx-auto border border-gray-100">
                    <Sparkles className="w-8 h-8 text-slate-600 mx-auto mb-4" />
                    <h2 className="text-xl md:text-2xl font-display font-bold text-slate-900 mb-2">Sign in to continue</h2>
                    <p className="text-md font-display text-slate-500 leading-relaxed mb-5">Create an account to provision your first AI chatbot.</p>
                    <div className="flex justify-center"><SignUp routing="hash" signInUrl="/sign-in" /></div>
                </div>
            </SignedOut>

            <SignedIn>
                <AnimatePresence mode="wait" initial={false}>
                    {!registrationData ? (
                        <motion.div key="form"
                            exit={{ opacity: 0, y: -8 }}
                            className="grid grid-cols-1 lg:grid-cols-12 gap-px bg-[#E8EBF0] flex-1 overflow-hidden"
                        >

                            <div className={`lg:col-span-5 ${cellCls} p-10 overflow-y-auto custom-scrollbar`}>
                                <div className="inline-flex items-center gap-2 px-2 py-1 border border-slate-100 bg-[#FAFAFA] text-md uppercase tracking-widest font-bold text-slate-500 font-sans mb-6">
                                    <Sparkles className="w-3 h-3" />
                                    Account provisioned
                                </div>
                                <h2 className="text-4xl md:text-5xl font-display font-bold tracking-tight text-slate-900 mb-4">
                                    Identity &{' '}
                                    <span className="bg-gradient-to-r from-indigo-600 to-indigo-400 bg-clip-text text-transparent">Deployment</span>
                                </h2>
                                <p className="text-md font-display text-slate-500 leading-relaxed mb-8">Provision your tenant, get your API key, and start chatting.</p>
                                <div className="space-y-4">
                                    {[
                                        { icon: Zap, text: 'Instant Provisioning', sub: 'Active immediately' },
                                        { icon: Shield, text: 'Enterprise Security', sub: 'Domain-locked access' },
                                        { icon: Code2, text: 'Easy Integration', sub: 'Zero-config snippet' },
                                    ].map((f, i) => (
                                        <div key={i} className="flex text-md font-display items-center gap-4 p-4 border border-gray-100 bg-[#FAFAFA] group hover:border-slate-300 transition-all">
                                            <div className="w-10 h-10 border border-gray-200 bg-white flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                                                <f.icon className="w-4 h-4 text-slate-900" />
                                            </div>
                                            <div>
                                                <p className="text-sm text-slate-900 font-medium">{f.text}</p>
                                                <p className="text-md uppercase tracking-widest font-bold text-slate-600 font-sans mt-0.5">{f.sub}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Right: Form card */}
                            <div className={`lg:col-span-7 ${cellCls} p-10 overflow-y-auto custom-scrollbar border-l border-gray-100 relative`}>

                                {isLocked && (
                                    <div className="absolute inset-0 z-50 bg-white/60 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center border-t border-gray-100">
                                        <Lock className="w-8 h-8 text-slate-600 mb-4" />
                                        <h3 className="text-md uppercase tracking-widest font-bold text-slate-900 font-sans mb-2">Upgrade Required</h3>
                                        <p className="text-md font-display text-slate-500 leading-relaxed max-w-[260px] mb-6">Provisioning a new tenant requires an active subscription.</p>
                                        <Link to="/app/pricing" className="px-6 py-3 bg-slate-900 text-white text-md uppercase tracking-widest font-bold font-sans hover:bg-slate-800 transition-colors shadow-sm">
                                            View Plans
                                        </Link>
                                    </div>
                                )}

                                <div className={isLocked ? 'opacity-30 pointer-events-none' : ''}>
                                    <h3 className="text-xl md:text-2xl font-display font-bold text-slate-900 mb-1">Tenant Config</h3>
                                    <p className="text-md font-display text-slate-500 leading-relaxed mb-8">Fill in details to generate your unique credentials.</p>

                                    <form onSubmit={handleSubmit} className="space-y-5">
                                        {[
                                            { name: 'companyName', label: 'Company Name', Icon: Building2, type: 'text', placeholder: 'Acme Inc.' },
                                            { name: 'allowedOrigin', label: 'Allowed Origin', Icon: Globe, type: 'url', placeholder: 'https://example.com' },
                                        ].map(f => (
                                            <div key={f.name}>
                                                <label className="block text-md uppercase tracking-widest font-bold text-slate-600 font-sans mb-1.5">{f.label}</label>
                                                <div className="relative">
                                                    <f.Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
                                                    <input type={f.type} name={f.name} required value={formData[f.name]}
                                                        onChange={handleChange} className={inputCls + 'text-sm font-mono'} placeholder={f.placeholder} />
                                                </div>
                                            </div>
                                        ))}

                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-md uppercase tracking-widest font-bold text-slate-600 font-sans mb-1.5">Theme Color</label>
                                                <div className="relative">
                                                    <Palette className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
                                                    <input type="text" name="themeColor" value={formData.themeColor}
                                                        onChange={handleChange}
                                                        className={inputCls + ' pr-12 font-mono uppercase'} />
                                                    <div className="absolute right-1 top-1/2 -translate-y-1/2 w-8 h-8 border border-gray-100 overflow-hidden">
                                                        <input type="color" name="themeColor" value={formData.themeColor}
                                                            onChange={handleChange} className="absolute inset-[-8px] w-[200%] h-[200%] cursor-pointer" />
                                                    </div>
                                                </div>
                                            </div>
                                            <div>
                                                <label className="block text-md uppercase tracking-widest font-bold text-slate-600 font-sans mb-1.5">Tone</label>
                                                <div className="relative">
                                                    <MessageSquare className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
                                                    <select name="companyTone" value={formData.companyTone} onChange={handleChange}
                                                        className={inputCls + ' appearance-none text-sm font-mono'}>
                                                        <option value="Professional and helpful">Professional</option>
                                                        <option value="Friendly and casual">Friendly</option>
                                                        <option value="Technical and concise">Technical</option>
                                                    </select>
                                                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-600 pointer-events-none" />
                                                </div>
                                            </div>
                                        </div>

                                        <button type="submit" disabled={isLoading}
                                            className="w-full flex items-center justify-center gap-2 py-3 min-h-[44px] bg-slate-900 text-white text-md uppercase tracking-widest font-bold font-sans hover:bg-slate-800 transition-colors active:scale-[0.99] disabled:opacity-50">
                                            {isLoading
                                                ? <><div className="w-3 h-3 border-2 border-white/30 border-t-white animate-spin" /> Provisioning...</>
                                                : <>Create Tenant <ArrowRight className="w-4 h-4" /></>
                                            }
                                        </button>
                                    </form>
                                </div>
                            </div>
                        </motion.div>
                    ) : (
                        <motion.div key="success"
                            className="flex flex-col h-full bg-[#E8EBF0] overflow-hidden"
                        >

                            <div className="bg-white px-8 py-6 flex items-center gap-6 border-b border-gray-100 shrink-0">
                                <div className="w-12 h-12 border-2 border-emerald-900 bg-white flex items-center justify-center shrink-0">
                                    <CheckCircle className="w-6 h-6 text-emerald-900" />
                                </div>
                                <div>
                                    <h2 className="text-xl md:text-2xl font-display font-bold text-slate-900 uppercase">{registrationData.companyName}</h2>
                                    <p className="text-md font-display text-slate-500 leading-relaxed mt-1">Provision successful. Credentials active.</p>
                                </div>
                                <div className="ml-auto flex gap-4">
                                    <button onClick={() => navigate('/app/train')}
                                        className="px-6 py-2.5 bg-slate-900 text-white text-md uppercase tracking-widest font-bold font-sans hover:bg-slate-800 transition-all flex items-center gap-2 active:scale-95 shadow-lg">
                                        Train AI <ArrowRight className="w-4 h-4" />
                                    </button>
                                    <button onClick={handleReset}
                                        className="px-6 py-2.5 border border-gray-100 text-slate-900 text-md uppercase tracking-widest font-bold font-sans hover:bg-[#FAFAFA] transition-all active:scale-95">
                                        New Tenant
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-[#E8EBF0] border-b border-gray-100">
                                <div className="bg-white p-8">
                                    <div className="flex items-center gap-2 mb-4">
                                        <Key className="w-3.5 h-3.5 text-slate-600" />
                                        <p className="text-md uppercase tracking-widest font-bold text-slate-600 font-sans">Secure API Key</p>
                                    </div>
                                    <div className="flex items-center gap-3 p-4 bg-[#FAFAFA] border border-gray-100 font-mono text-sm text-slate-900 font-medium">
                                        <span className="flex-1 truncate">{registrationData.apiKey}</span>
                                        <button onClick={() => handleCopy(registrationData.apiKey)}
                                            className="p-2 bg-white border border-slate-100 text-slate-900 hover:border-slate-400 transition-colors shadow-sm">
                                            {copied ? <CheckCircle className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                                        </button>
                                    </div>
                                </div>
                                <div className="bg-white p-8">
                                    <div className="flex items-center gap-2 mb-4">
                                        <Code2 className="w-3.5 h-3.5 text-slate-600" />
                                        <p className="text-md uppercase tracking-widest font-bold text-slate-600 font-display">Quick Embed</p>
                                    </div>
                                    <div className="relative">
                                        <pre className="p-4 bg-slate-900 text-indigo-300 border border-slate-900 text-md font-mono overflow-x-auto leading-relaxed h-[88px] flex items-center">
                                            <code>{`<script src="${frontendUrl}/widget.js" data-api-key="${registrationData.apiKey}" defer></script>`}</code>
                                        </pre>
                                        <button onClick={() => handleCopy(`<script src="${frontendUrl}/widget.js" data-api-key="${registrationData.apiKey}" defer></script>`)}
                                            className="absolute top-2 right-2 p-2 bg-white/10 hover:bg-white/20 text-white border border-white/20 transition-colors">
                                            {copied ? <CheckCircle className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Integration Guides accordion */}
                            <div className={`${cardCls} p-0! overflow-hidden`}>
                                <div className="p-4 border-b border-slate-100 flex items-center gap-2">
                                    <BookOpen className="w-3.5 h-3.5 text-slate-600" />
                                    <h3 className="text-md uppercase tracking-widest font-display text-slate-600">Integration Guides</h3>
                                </div>
                                {integrationGuides.map((guide, i) => (
                                    <div key={i} className="border-b last:border-0 border-slate-100">
                                        <button
                                            onClick={() => setOpenAccordion(openAccordion === i ? -1 : i)}
                                            className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 transition-colors text-left"
                                        >
                                            <span className="text-sm font-display text-slate-700">{guide.title}</span>
                                            <ChevronDown className={`w-3.5 h-3.5 text-slate-600 transition-transform ${openAccordion === i ? 'rotate-180' : ''}`} />
                                        </button>
                                        <AnimatePresence>
                                            {openAccordion === i && (
                                                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                                                    <div className="px-5 pb-4">
                                                        <pre className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-md font-mono text-indigo-600 overflow-x-auto leading-relaxed">
                                                            <code>{guide.code}</code>
                                                        </pre>
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                ))}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </SignedIn>

            <Alert isOpen={alert.open} type={alert.type} message={alert.msg} onClose={() => setAlert(p => ({ ...p, open: false }))} />
        </div>
    );
};

export default AppRegistration;
