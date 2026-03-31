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
import { useUserRole } from '../context/UserContext';

const AppRegistration = () => {
    const { user } = useUser();
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

    const inputCls = "w-full pl-10 pr-3 py-2.5 bg-transparent border border-gray-100 dark:border-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-900/20 dark:focus:ring-indigo-500/50 focus:border-slate-400 dark:focus:border-indigo-400 text-sm text-slate-900 dark:text-slate-200 transition-colors";
    const cardCls = "bg-white dark:bg-slate-950 p-6 transition-colors duration-500";
    const cellCls = "bg-white dark:bg-slate-950 transition-colors duration-500";
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
        <div className="flex flex-col h-full bg-[#E8EBF0] dark:bg-slate-900 overflow-hidden transition-colors duration-500">
            {/* Header */}
            <div className="bg-white dark:bg-slate-950 px-8 py-6 shrink-0 border-b border-gray-100 dark:border-slate-800 transition-colors duration-500">
                <div className="flex items-center gap-2 mb-1">
                    <Bot className="w-5 h-5 text-slate-600 dark:text-slate-400 transition-colors" />
                    <h1 className="text-xl md:text-2xl font-display font-bold text-slate-900 dark:text-slate-200 transition-colors">Bot Identity</h1>
                </div>
                <p className="text-md font-display text-slate-500 dark:text-slate-400 leading-relaxed transition-colors">Configure your tenant and get your API integration credentials.</p>
            </div>

            <SignedOut>
                <div className="bg-white dark:bg-slate-950 p-8 text-center max-w-md mx-auto border border-gray-100 dark:border-slate-800 transition-colors duration-500 mt-10">
                    <Sparkles className="w-8 h-8 text-slate-600 dark:text-slate-400 mx-auto mb-4 transition-colors" />
                    <h2 className="text-xl md:text-2xl font-display font-bold text-slate-900 dark:text-slate-200 mb-2 transition-colors">Sign in to continue</h2>
                    <p className="text-md font-display text-slate-500 dark:text-slate-400 leading-relaxed mb-5 transition-colors">Create an account to provision your first AI chatbot.</p>
                    <div className="flex justify-center"><SignUp routing="hash" signInUrl="/sign-in" /></div>
                </div>
            </SignedOut>

            <SignedIn>
                <AnimatePresence mode="wait" initial={false}>
                    {!registrationData ? (
                        <motion.div key="form"
                            exit={{ opacity: 0, y: -8 }}
                            className="grid grid-cols-1 lg:grid-cols-12 gap-px bg-[#E8EBF0] dark:bg-slate-800 flex-1 overflow-hidden transition-colors duration-500"
                        >

                            <div className={`lg:col-span-5 ${cellCls} p-10 overflow-y-auto custom-scrollbar`}>
                                <div className="inline-flex items-center gap-2 px-2 py-1 border border-slate-100 dark:border-slate-800 bg-[#FAFAFA] dark:bg-slate-900 text-md uppercase tracking-widest font-bold text-slate-500 dark:text-slate-400 font-sans mb-6 transition-colors">
                                    <Sparkles className="w-3 h-3" />
                                    Account provisioned
                                </div>
                                <h2 className="text-4xl md:text-5xl font-display font-bold tracking-tight text-slate-900 dark:text-slate-200 mb-4 transition-colors">
                                    Identity &{' '}
                                    <span className="bg-gradient-to-r from-indigo-600 to-indigo-400 bg-clip-text text-transparent">Deployment</span>
                                </h2>
                                <p className="text-md font-display text-slate-500 dark:text-slate-400 leading-relaxed mb-8 transition-colors">Provision your tenant, get your API key, and start chatting.</p>
                                <div className="space-y-4">
                                    {[
                                        { icon: Zap, text: 'Instant Provisioning', sub: 'Active immediately' },
                                        { icon: Shield, text: 'Enterprise Security', sub: 'Domain-locked access' },
                                        { icon: Code2, text: 'Easy Integration', sub: 'Zero-config snippet' },
                                    ].map((f, i) => (
                                        <div key={i} className="flex text-md font-display items-center gap-4 p-4 border border-gray-100 dark:border-slate-800 bg-[#FAFAFA] dark:bg-slate-900 group hover:border-slate-300 dark:hover:border-slate-600 transition-all">
                                            <div className="w-10 h-10 border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-950 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                                                <f.icon className="w-4 h-4 text-slate-900 dark:text-slate-200 transition-colors" />
                                            </div>
                                            <div>
                                                <p className="text-sm text-slate-900 dark:text-slate-200 font-medium transition-colors">{f.text}</p>
                                                <p className="text-md uppercase tracking-widest font-bold text-slate-600 dark:text-slate-400 font-sans mt-0.5 transition-colors">{f.sub}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Right: Form card */}
                            <div className={`lg:col-span-7 ${cellCls} p-10 overflow-y-auto custom-scrollbar border-l border-gray-100 dark:border-slate-800 relative`}>

                                {isLocked && (
                                    <div className="absolute inset-0 z-50 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center border-t border-gray-100 dark:border-slate-800 transition-colors">
                                        <Lock className="w-8 h-8 text-slate-600 dark:text-slate-500 mb-4 transition-colors" />
                                        <h3 className="text-md uppercase tracking-widest font-bold text-slate-900 dark:text-slate-200 font-sans mb-2 transition-colors">Upgrade Required</h3>
                                        <p className="text-md font-display text-slate-500 dark:text-slate-400 leading-relaxed max-w-[260px] mb-6 transition-colors">Provisioning a new tenant requires an active subscription.</p>
                                        <Link to="/app/pricing" className="px-6 py-3 bg-slate-900 dark:bg-indigo-600 text-white text-md uppercase tracking-widest font-bold font-sans hover:bg-slate-800 dark:hover:bg-indigo-500 transition-colors shadow-sm">
                                            View Plans
                                        </Link>
                                    </div>
                                )}

                                <div className={isLocked ? 'opacity-30 pointer-events-none' : ''}>
                                    <h3 className="text-xl md:text-2xl font-display font-bold text-slate-900 dark:text-slate-200 mb-1 transition-colors">Tenant Config</h3>
                                    <p className="text-md font-display text-slate-500 dark:text-slate-400 leading-relaxed mb-8 transition-colors">Fill in details to generate your unique credentials.</p>

                                    <form onSubmit={handleSubmit} className="space-y-5">
                                        {[
                                            { name: 'companyName', label: 'Company Name', Icon: Building2, type: 'text', placeholder: 'Acme Inc.' },
                                            { name: 'allowedOrigin', label: 'Allowed Origin', Icon: Globe, type: 'url', placeholder: 'https://example.com' },
                                        ].map(f => (
                                            <div key={f.name}>
                                                <label className="block text-md uppercase tracking-widest font-bold text-slate-600 dark:text-slate-400 font-sans mb-1.5 transition-colors">{f.label}</label>
                                                <div className="relative">
                                                    <f.Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600 dark:text-slate-500 transition-colors" />
                                                    <input type={f.type} name={f.name} required value={formData[f.name]}
                                                        onChange={handleChange} className={inputCls + ' text-sm font-mono'} placeholder={f.placeholder} />
                                                </div>
                                            </div>
                                        ))}

                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-md uppercase tracking-widest font-bold text-slate-600 dark:text-slate-400 font-sans mb-1.5 transition-colors">Theme Color</label>
                                                <div className="relative">
                                                    <Palette className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600 dark:text-slate-500 transition-colors" />
                                                    <input type="text" name="themeColor" value={formData.themeColor}
                                                        onChange={handleChange}
                                                        className={inputCls + ' pr-12 font-mono uppercase'} />
                                                    <div className="absolute right-1 top-1/2 -translate-y-1/2 w-8 h-8 border border-gray-100 dark:border-slate-700 overflow-hidden transition-colors">
                                                        <input type="color" name="themeColor" value={formData.themeColor}
                                                            onChange={handleChange} className="absolute inset-[-8px] w-[200%] h-[200%] cursor-pointer" />
                                                    </div>
                                                </div>
                                            </div>
                                            <div>
                                                <label className="block text-md uppercase tracking-widest font-bold text-slate-600 dark:text-slate-400 font-sans mb-1.5 transition-colors">Tone</label>
                                                <div className="relative">
                                                    <MessageSquare className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600 dark:text-slate-500 transition-colors" />
                                                    <select name="companyTone" value={formData.companyTone} onChange={handleChange}
                                                        className={inputCls + ' appearance-none text-sm font-mono'}>
                                                        <option value="Professional and helpful">Professional</option>
                                                        <option value="Friendly and casual">Friendly</option>
                                                        <option value="Technical and concise">Technical</option>
                                                    </select>
                                                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-600 dark:text-slate-500 pointer-events-none transition-colors" />
                                                </div>
                                            </div>
                                        </div>

                                        <button type="submit" disabled={isLoading}
                                            className="w-full flex items-center justify-center gap-2 py-3 min-h-[44px] bg-slate-900 dark:bg-indigo-600 text-white text-md uppercase tracking-widest font-bold font-sans hover:bg-slate-800 dark:hover:bg-indigo-500 transition-colors active:scale-[0.99] disabled:opacity-50">
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
                            className="flex flex-col h-full bg-[#E8EBF0] dark:bg-slate-900 overflow-hidden transition-colors duration-500"
                        >

                            <div className="bg-white dark:bg-slate-950 px-8 py-6 flex items-center gap-6 border-b border-gray-100 dark:border-slate-800 shrink-0 transition-colors duration-500">
                                <div className="w-12 h-12 border-2 border-emerald-900 dark:border-emerald-500 bg-white dark:bg-slate-900 flex items-center justify-center shrink-0 transition-colors">
                                    <CheckCircle className="w-6 h-6 text-emerald-900 dark:text-emerald-500 transition-colors" />
                                </div>
                                <div>
                                    <h2 className="text-xl md:text-2xl font-display font-bold text-slate-900 dark:text-slate-200 uppercase transition-colors">{registrationData.companyName}</h2>
                                    <p className="text-md font-display text-slate-500 dark:text-slate-400 leading-relaxed mt-1 transition-colors">Provision successful. Credentials active.</p>
                                </div>
                                <div className="ml-auto flex gap-4">
                                    <button onClick={() => navigate('/app/train')}
                                        className="px-6 py-2.5 bg-slate-900 dark:bg-indigo-600 text-white text-md uppercase tracking-widest font-bold font-sans hover:bg-slate-800 dark:hover:bg-indigo-500 transition-all flex items-center gap-2 active:scale-95 shadow-md">
                                        Train AI <ArrowRight className="w-4 h-4" />
                                    </button>
                                    <button onClick={handleReset}
                                        className="px-6 py-2.5 border border-gray-100 dark:border-slate-700 text-slate-900 dark:text-slate-200 text-md uppercase tracking-widest font-bold font-sans hover:bg-[#FAFAFA] dark:hover:bg-slate-800 transition-all active:scale-95">
                                        New Tenant
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-[#E8EBF0] dark:bg-slate-800 border-b border-gray-100 dark:border-slate-800 transition-colors">
                                <div className="bg-white dark:bg-slate-950 p-8 transition-colors">
                                    <div className="flex items-center gap-2 mb-4">
                                        <Key className="w-3.5 h-3.5 text-slate-600 dark:text-slate-500 transition-colors" />
                                        <p className="text-md uppercase tracking-widest font-bold text-slate-600 dark:text-slate-400 font-sans transition-colors">Secure API Key</p>
                                    </div>
                                    <div className="flex items-center gap-3 p-4 bg-[#FAFAFA] dark:bg-slate-900 border border-gray-100 dark:border-slate-800 font-mono text-sm text-slate-900 dark:text-slate-200 font-medium transition-colors">
                                        <span className="flex-1 truncate">{registrationData.apiKey}</span>
                                        <button onClick={() => handleCopy(registrationData.apiKey)}
                                            className="p-2 bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-700 text-slate-900 dark:text-slate-200 hover:border-slate-400 dark:hover:border-slate-500 transition-colors shadow-sm">
                                            {copied ? <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> : <Copy className="w-4 h-4" />}
                                        </button>
                                    </div>
                                </div>
                                <div className="bg-white dark:bg-slate-950 p-8 transition-colors">
                                    <div className="flex items-center gap-2 mb-4">
                                        <Code2 className="w-3.5 h-3.5 text-slate-600 dark:text-slate-500 transition-colors" />
                                        <p className="text-md uppercase tracking-widest font-bold text-slate-600 dark:text-slate-400 font-display transition-colors">Quick Embed</p>
                                    </div>
                                    <div className="relative">
                                        <pre className="p-4 bg-slate-900 border border-slate-900 text-indigo-300 text-md font-mono overflow-x-auto leading-relaxed h-[88px] flex items-center">
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
                            <div className={`${cardCls} p-0! overflow-hidden border-t-0`}>
                                <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2 transition-colors">
                                    <BookOpen className="w-3.5 h-3.5 text-slate-600 dark:text-slate-500 transition-colors" />
                                    <h3 className="text-md uppercase tracking-widest font-display text-slate-600 dark:text-slate-400 transition-colors">Integration Guides</h3>
                                </div>
                                {integrationGuides.map((guide, i) => (
                                    <div key={i} className="border-b last:border-0 border-slate-100 dark:border-slate-800 transition-colors">
                                        <button
                                            onClick={() => setOpenAccordion(openAccordion === i ? -1 : i)}
                                            className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors text-left"
                                        >
                                            <span className="text-sm font-display text-slate-700 dark:text-slate-300 transition-colors">{guide.title}</span>
                                            <ChevronDown className={`w-3.5 h-3.5 text-slate-600 dark:text-slate-500 transition-transform ${openAccordion === i ? 'rotate-180' : ''}`} />
                                        </button>
                                        <AnimatePresence>
                                            {openAccordion === i && (
                                                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                                                    <div className="px-5 pb-4">
                                                        <pre className="p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-md font-mono text-indigo-600 dark:text-indigo-400 overflow-x-auto leading-relaxed transition-colors">
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
