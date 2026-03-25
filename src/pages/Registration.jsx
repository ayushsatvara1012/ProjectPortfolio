import React, { useState, useEffect } from 'react';
import { SignedIn, SignedOut, SignUp, useUser, useAuth } from "@clerk/clerk-react";
import { Building2, Globe, Palette, MessageSquare, Copy, CheckCircle, Code2, Sparkles, ShieldCheck, ArrowRight, Key, Zap, BookOpen, ChevronRight, ChevronDown, Shield, Rocket } from 'lucide-react';
import Logo from '../components/Logo';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import Alert from '../components/alert';

const Registration = () => {
    const { user, isLoaded } = useUser();
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        companyName: '',
        allowedOrigin: '',
        themeColor: '#5730F5',
        companyTone: 'Professional and helpful'
    });

    const [isLoading, setIsLoading] = useState(false);
    const [registrationData, setRegistrationData] = useState(null);
    const [alertConfig, setAlertConfig] = useState({ open: false, type: 'success', msg: '' });
    const [copied, setCopied] = useState(false);
    const [userTier, setUserTier] = useState(null);
    const [isTierLoading, setIsTierLoading] = useState(true);
    const [openAccordion, setOpenAccordion] = useState(0);

    const { getToken, isLoaded: isAuthLoaded } = useAuth();

    // Check user tier on mount
    React.useEffect(() => {
        const checkTier = async () => {
            if (!isAuthLoaded) return;
            try {
                const token = await getToken();
                const baseUrl = import.meta.env.VITE_API_URL || '';
                const response = await fetch(`${baseUrl}/api/me`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (response.ok) {
                    const data = await response.json();
                    setUserTier(data.tier);
                }
            } catch (err) {
                console.error("Failed to check tier:", err);
            } finally {
                setIsTierLoading(false);
            }
        };
        checkTier();
    }, [isAuthLoaded, getToken]);

    // Redirect handled by ProtectedRoute

    // Platform tab state and embed code generator
    const [activePlatform, setActivePlatform] = useState('html');
    const [activePlatformDocs, setActivePlatformDocs] = useState('html');

    const generateEmbedCode = (platform, apiKey, apiUrl, frontUrl) => {
        const key = apiKey || 'YOUR_API_KEY';
        switch (platform) {
            case 'nextjs':
                return `import Script from "next/script";

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        {children}
        {/* SaPyBase AI Assistant */}
        <Script
          src="${frontUrl}/widget.js"
          strategy="lazyOnload"
          data-api-key="${key}"
          data-api-url="${apiUrl}"
        />
      </body>
    </html>
  );
}`;
            case 'react':
                return `// In your root component (e.g. App.jsx or index.jsx)
// Add this inside useEffect to dynamically load the widget:

import { useEffect } from 'react';

export default function App() {
  useEffect(() => {
    const script = document.createElement('script');
    script.src = '${frontUrl}/widget.js';
    script.defer = true;
    script.setAttribute('data-api-key', '${key}');
    script.setAttribute('data-api-url', '${apiUrl}');
    document.body.appendChild(script);
  }, []);

  return <YourApp />;
}`;
            case 'wordpress':
                return `// Add this to your theme's functions.php file

add_action('wp_footer', 'add_sapybase_widget');
function add_sapybase_widget() {
    ?>
    <script
      src="${frontUrl}/widget.js"
      defer
      data-api-key="${key}"
      data-api-url="${apiUrl}">
    </script>
    <?php
}`;
            case 'html':
            default:
                return `<!-- SaPyBase AI Assistant -->
<!-- Paste this just before the closing </body> tag -->

<script
  src="${frontUrl}/widget.js"
  defer
  data-api-key="${key}"
  data-api-url="${apiUrl}">
</script>`;
        }
    };

    const showAlert = (type, msg) => {
        setAlertConfig({ open: true, type, msg });
        setTimeout(() => setAlertConfig(prev => ({ ...prev, open: false })), 4000);
    };

    const handleCopy = (text) => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };


    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.companyName.trim() || !formData.allowedOrigin.trim()) {
            showAlert('error', 'Company Name and Allowed Origin are required.');
            return;
        }

        setIsLoading(true);

        // --- BYPASS START FOR TESTING ---
        setTimeout(() => {
            setRegistrationData({
                apiKey: 'sb_test_DEMO1234567890',
                companyName: formData.companyName,
                allowedOrigin: formData.allowedOrigin
            });
            showAlert('success', 'Demo successful! (Bypassed backend)');
            setIsLoading(false);
        }, 800);
        return;
        // --- BYPASS END FOR TESTING ---

        try {
            const token = await getToken();
            const baseUrl = import.meta.env.VITE_API_URL
                ? `${import.meta.env.VITE_API_URL.replace(/\/$/, "")}`
                : 'https://sapyai.onrender.com';

            const apiUrl = `${baseUrl}/api/register`;

            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    company_name: formData.companyName,
                    allowed_origin: formData.allowedOrigin,
                    theme_color: formData.themeColor,
                    company_tone: formData.companyTone,
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.detail || data.message || 'Failed to register the company.');
            }

            setRegistrationData({
                apiKey: data.api_key,
                companyName: formData.companyName,
                allowedOrigin: data.allowed_origin
            });
            showAlert('success', data.message || 'Registration successful!');

        } catch (error) {
            console.error('Registration Error:', error);
            showAlert('error', error.message || 'An unexpected error occurred during registration.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleReset = () => {
        setRegistrationData(null);
        setFormData({
            companyName: '',
            allowedOrigin: '',
            themeColor: '#5730F5',
            companyTone: 'Professional and helpful'
        });
    };

    const frontendUrl = window.location.origin;
    const backendUrl = import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace(/\/$/, "") : window.location.origin;

    // Dynamic embed code based on active platform
    const embedCode = generateEmbedCode(activePlatform, registrationData?.apiKey, backendUrl, frontendUrl);

    // Animation Variants
    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: { staggerChildren: 0.1 }
        }
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 20, scale: 0.95 },
        visible: {
            opacity: 1,
            y: 0,
            scale: 1,
            transition: { type: "spring", stiffness: 100, damping: 15 }
        }
    };

    // Card styling mixin for consistency - Technical Brutalism
    const bentoCardStyle = "bg-white dark:bg-[#111111] border border-slate-200 dark:border-slate-800 rounded-xl p-5 lg:p-6 group relative flex flex-col";

    if (!isLoaded || isTierLoading) {
        return (
            <div className="w-full h-[60vh] flex items-center justify-center">
                <div className="w-12 h-12 border-4 border-slate-200 border-t-indigo-600 rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="w-full min-h-[calc(100vh-80px)] bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-50 pt-28 pb-12 px-4 sm:px-6 lg:px-8 font-sans tracking-tight relative overflow-x-hidden flex justify-center">

            {/* Soft Ambient Background Orbs - COPY from Dashboard */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-500/10 dark:bg-indigo-500/5 blur-[120px]"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-purple-500/10 dark:bg-purple-500/5 blur-[100px]"></div>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80%] max-w-7xl h-[80%] border border-indigo-200/20 dark:border-indigo-800/10 rounded-[4rem] opacity-50 blur-[2px]"></div>
            </div>

            <div className="max-w-7xl mx-auto w-full relative z-10">
                <AnimatePresence mode="wait">
                    <SignedOut key="auth-signed-out">
                        <motion.div
                            key="signed-out-view"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="flex flex-col items-center justify-center min-h-[60vh] py-12"
                        >
                            <div className="mb-8 text-center bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl max-w-2xl w-full">
                                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-100 dark:bg-indigo-900/50 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 text-sm font-bold uppercase tracking-wider mb-6">
                                    <Sparkles className="w-4 h-4" />
                                    <span>Welcome to SaPyBase</span>
                                </div>
                                <h1 className="text-4xl md:text-5xl font-black mb-6 leading-tight text-slate-900 dark:text-white">Start Your <span className="text-transparent bg-clip-text bg-linear-to-r from-red-600 to-indigo-600 dark:from-red-400 dark:to-indigo-500">SaaS Journey</span></h1>
                                <p className="text-slate-600 dark:text-slate-400 text-lg mb-8 max-w-md mx-auto font-medium">Create an account to provision your first AI chatbot and access the developer dashboard.</p>
                                <div className="flex justify-center">
                                    <SignUp routing="hash" signInUrl="/login" />
                                </div>
                            </div>
                        </motion.div>
                    </SignedOut>

                    <SignedIn key="auth-signed-in">
                        <motion.div
                            key="registration-form-view"
                            variants={containerVariants}
                            initial="hidden"
                            animate="visible"
                            className="grid grid-cols-1 lg:grid-cols-12 gap-4"
                        >
                            {/* Left Column: Promotion/Details (Spans 5 cols) */}
                            <motion.div variants={itemVariants} className="lg:col-span-5 flex flex-col">
                                <div className={`${bentoCardStyle} h-full min-h-[500px] bg-linear-to-br from-indigo-50/50 to-white/60 dark:from-indigo-950/20 dark:to-slate-900/40 text-slate-900 dark:text-white border-slate-200 dark:border-slate-800/60 shadow-2xl shadow-indigo-500/5`}>
                                    <div className="relative z-10">
                                        <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/20 backdrop-blur-sm rounded-full text-[10px] font-bold uppercase tracking-wider mb-6">
                                            <Sparkles className="w-3 h-3" />
                                            <span>Hey {user?.firstName || 'Innovator'}!</span>
                                        </div>
                                        <h1 className="text-4xl font-black tracking-tight mb-4 leading-tight text-slate-900 dark:text-white">
                                            Launch Your <br />
                                            <span className="text-transparent bg-clip-text bg-linear-to-r from-red-600 to-indigo-600 dark:from-red-400 dark:to-indigo-500">
                                                AI Agent Today
                                            </span>
                                        </h1>
                                        <p className="text-slate-500 dark:text-indigo-100/80 text-sm font-medium leading-relaxed mb-8">
                                            Provision your tenant, get your API key, and start conversing with your customers using the power of Gemini.
                                        </p>

                                        <div className="space-y-4">
                                            {[
                                                { icon: Zap, text: "Instant Provisioning", sub: "Get your key in seconds" },
                                                { icon: Shield, text: "Enterprise Security", sub: "Domain-locked API access" },
                                                { icon: Code2, text: "Easy Integration", sub: "One-line snippet install" }
                                            ].map((feat, i) => (
                                                <div key={i} className="flex items-center gap-4 p-3 bg-white dark:bg-slate-900/40 rounded-2xl backdrop-blur-md border border-slate-200 dark:border-white/10 transition-all hover:bg-white/70 dark:hover:bg-white/20">
                                                    <div className="p-2 bg-indigo-50 dark:bg-white/20 rounded-xl shadow-sm">
                                                        <feat.icon className="w-5 h-5 text-indigo-600 dark:text-white" />
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">{feat.text}</p>
                                                        <p className="text-[10px] text-slate-500 dark:text-white/50 font-medium uppercase tracking-widest">{feat.sub}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Abstract decoration */}
                                    <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
                                </div>

                                {/* Custom Instructions block removed per Technical Brutalism redesign */}
                            </motion.div>

                            {/* Right Column: The Form/Success (Spans 7 cols) */}
                            <motion.div variants={itemVariants} className="lg:col-span-7">
                                <div className={`${bentoCardStyle} h-full min-h-[500px]`}>
                                    <AnimatePresence mode="wait">
                                        {!registrationData ? (
                                            <motion.div
                                                key="registration-form"
                                                initial={{ opacity: 0, x: 20 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                exit={{ opacity: 0, x: -20 }}
                                                className="h-full flex flex-col"
                                            >
                                                <div className="mb-8">
                                                    <h2 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">Tenant Configuration</h2>
                                                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 font-medium leading-relaxed">Fill in details to generate your unique integration credentials.</p>
                                                </div>

                                                <form onSubmit={handleSubmit} className="space-y-6 flex-1">
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                        <div className="space-y-2">
                                                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 ml-1">Company Name</label>
                                                            <div className="relative group">
                                                                <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                                                                <input
                                                                    type="text"
                                                                    name="companyName"
                                                                    required
                                                                    value={formData.companyName}
                                                                    onChange={handleChange}
                                                                    className="w-full pl-12 pr-4 py-3.5 bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all text-sm font-medium"
                                                                    placeholder="Acme Inc."
                                                                />
                                                            </div>
                                                        </div>

                                                        <div className="space-y-2">
                                                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 ml-1">Allowed Origin</label>
                                                            <div className="relative group">
                                                                <Globe className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                                                                <input
                                                                    type="url"
                                                                    name="allowedOrigin"
                                                                    required
                                                                    value={formData.allowedOrigin}
                                                                    onChange={handleChange}
                                                                    className="w-full pl-12 pr-4 py-3.5 bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all text-sm font-medium"
                                                                    placeholder="https://example.com"
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                        <div className="space-y-2">
                                                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 ml-1">Theme Color</label>
                                                            <div className="relative group">
                                                                <Palette className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                                                                <input
                                                                    type="text"
                                                                    name="themeColor"
                                                                    value={formData.themeColor}
                                                                    onChange={handleChange}
                                                                    className="w-full pl-12 pr-12 py-3.5 bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 outline-none uppercase font-mono text-xs transition-all"
                                                                />
                                                                <div className="absolute right-3 top-1/2 -translate-y-1/2 w-7 h-7 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm transition-all group-hover:scale-110 active:scale-95">
                                                                    <input
                                                                        type="color"
                                                                        name="themeColor"
                                                                        value={formData.themeColor}
                                                                        onChange={handleChange}
                                                                        className="absolute inset-[-10px] w-[200%] h-[200%] cursor-pointer"
                                                                    />
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <div className="space-y-2">
                                                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 ml-1">Tone of Voice</label>
                                                            <div className="relative">
                                                                <MessageSquare className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                                                <select
                                                                    name="companyTone"
                                                                    value={formData.companyTone}
                                                                    onChange={handleChange}
                                                                    className="w-full pl-12 pr-10 py-3.5 bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 outline-none appearance-none text-sm font-medium"
                                                                >
                                                                    <option value="Professional and helpful">Professional</option>
                                                                    <option value="Friendly and casual">Friendly</option>
                                                                    <option value="Technical and concise">Technical</option>
                                                                </select>
                                                                <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 rotate-90 pointer-events-none" />
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="pt-8">
                                                        <button
                                                            type="submit"
                                                            disabled={isLoading}
                                                            className={`relative overflow-hidden w-full flex justify-center py-4 px-4 rounded-2xl text-base font-bold text-white bg-linear-to-r from-blue-800 to-blue-600 hover:from-blue-500 hover:to-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/30 transition-all duration-300 transform active:scale-[0.98] ${isLoading ? 'opacity-80 cursor-not-allowed shadow-none' : 'hover:shadow-blue-600/40 shadow-xl'}`}
                                                        >
                                                            {isLoading ? (
                                                                <>
                                                                    Provisioning...
                                                                </>
                                                            ) : (
                                                                <>
                                                                    Create Tenant Knowledge
                                                                    <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                                                                </>
                                                            )}
                                                            {/* Button soft glow overlay */}
                                                            <div className="absolute inset-0 bg-white/20 opacity-0 hover:opacity-100 transition-opacity"></div>
                                                        </button>
                                                    </div>
                                                </form>
                                            </motion.div>
                                        ) : (
                                            <motion.div
                                                key="success-view"
                                                initial={{ opacity: 0, scale: 0.95 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                className="h-full flex-1 flex flex-col space-y-6"
                                            >
                                                {/* Header */}
                                                <div className="flex items-center gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
                                                    <div className="w-12 h-12 bg-indigo-50 dark:bg-[#111111] rounded-xl flex items-center justify-center text-indigo-600 dark:text-indigo-400 border border-slate-200 dark:border-slate-800">
                                                        <CheckCircle className="w-6 h-6" />
                                                    </div>
                                                    <div className="text-left">
                                                        <h2 className="text-xl font-bold tracking-tight text-transparent bg-clip-text bg-linear-to-r from-red-600 to-indigo-600 dark:from-red-400 dark:to-indigo-500">{registrationData.companyName} Ready</h2>
                                                        <p className="text-xs text-slate-500 font-medium mt-0.5">Your credentials have been generated and secured.</p>
                                                    </div>
                                                </div>

                                                {/* Top Row: Key and Script Grid */}
                                                <div className="grid grid-cols-1  gap-4 w-full">
                                                    {/* API Key Container */}
                                                    <div className="bg-white dark:bg-[#111111] border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col">
                                                        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-3 text-left">API Key</label>
                                                        <div className="flex-1 flex items-center justify-between p-3 bg-slate-50 dark:bg-[#0A0A0A] border border-slate-200 dark:border-slate-800 rounded-lg font-mono text-xs text-indigo-600 dark:text-indigo-400">
                                                            <div className="flex items-center gap-2 truncate">
                                                                <Key className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                                                                <span className="truncate">{registrationData.apiKey}</span>
                                                            </div>
                                                            <button onClick={() => handleCopy(registrationData.apiKey)} className="p-1.5 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md text-slate-500 transition-colors border border-slate-200 dark:border-slate-700 ml-2">
                                                                <Copy className="w-3.5 h-3.5" />
                                                            </button>
                                                        </div>
                                                    </div>

                                                    {/* Embed Script Container */}
                                                    <div className="bg-white dark:bg-[#111111] border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col">
                                                        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-3 text-left">Embed Script</label>
                                                        <div className="relative group/code flex-1">
                                                            <pre className="p-3 bg-slate-50 dark:bg-[#0A0A0A] rounded-lg border border-slate-200 dark:border-slate-800 overflow-x-auto text-[10px] text-indigo-600 dark:text-indigo-300 font-mono leading-relaxed h-full scrollbar-hide text-left">
                                                                <code>{embedCode}</code>
                                                            </pre>
                                                            <button
                                                                onClick={() => handleCopy(embedCode)}
                                                                className="absolute top-2 right-2 p-1.5 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md text-slate-500 transition-colors border border-slate-200 dark:border-slate-700"
                                                            >
                                                                {copied ? <CheckCircle className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>

                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </div>
                                    </motion.div>

                                    {/* Full Width Integration Guides - Shifted outside and spans 12 cols */}
                                    <AnimatePresence>
                                        {registrationData && (
                                            <motion.div
                                                variants={itemVariants}
                                                initial="hidden"
                                                animate="visible"
                                                exit="hidden"
                                                className="lg:col-span-12"
                                            >
                                                <div className="w-full bg-white dark:bg-[#111111] border border-slate-200 dark:border-slate-800 rounded-xl mt-2 overflow-hidden shadow-xl shadow-indigo-500/5">
                                                    <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0A0A] text-left">
                                                        <h3 className="text-sm font-bold flex items-center gap-2 text-slate-900 dark:text-white">
                                                            <BookOpen className="w-4 h-4 text-indigo-500" />
                                                            Integration Guides
                                                        </h3>
                                                    </div>
                                                    <div className="flex flex-col">
                                                        {[
                                                            {
                                                                title: "Next.js (App Router)",
                                                                desc: "Place the script in app/layout.tsx using the next/script component.",
                                                                code: `import Script from 'next/script';\n\nexport default function RootLayout({ children }) {\n  return (\n    <html lang="en">\n      <body>\n        {children}\n        <Script \n          src="${import.meta.env.VITE_API_URL || 'http://localhost:5173'}/widget.js" \n          data-api-key="${registrationData.apiKey}" \n          strategy="lazyOnload"\n        />\n      </body>\n    </html>\n  );\n}`
                                                            },
                                                            {
                                                                title: "React / Vite",
                                                                desc: "Drop the <script> tag inside public/index.html.",
                                                                code: `<!DOCTYPE html>\n<html lang="en">\n  <head>\n    <meta charset="UTF-8" />\n    <title>My App</title>\n  </head>\n  <body>\n    <div id="root"></div>\n    <script\n      src="${import.meta.env.VITE_API_URL || 'http://localhost:5173'}/widget.js"\n      data-api-key="${registrationData.apiKey}"\n      defer\n    ></script>\n  </body>\n</html>`
                                                            },
                                                            {
                                                                title: "Vanilla HTML / Webflow",
                                                                desc: "Paste the <script> directly above the closing </body> tag.",
                                                                code: `<!-- Add this just before your closing </body> tag -->\n<script\n  src="${import.meta.env.VITE_API_URL || 'http://localhost:5173'}/widget.js"\n  data-api-key="${registrationData.apiKey}"\n  defer\n></script>`
                                                            },
                                                            {
                                                                title: "Flutter (Mobile)",
                                                                desc: "Developer Note: Render the chat UI using the webview_flutter package to load the widget URL directly.",
                                                                code: `import 'package:webview_flutter/webview_flutter.dart';\n\n// Create a dedicated Chat Screen\nWebViewWidget(\n  controller: WebViewController()\n    ..setJavaScriptMode(JavaScriptMode.unrestricted)\n    ..loadRequest(Uri.parse('${import.meta.env.VITE_API_URL || 'http://localhost:5173'}/chat?key=${registrationData.apiKey}')),\n)`
                                                            }
                                                        ].map((item, index) => (
                                                            <div key={index} className="border-b last:border-0 border-slate-200 dark:border-slate-800">
                                                                <button
                                                                    onClick={() => setOpenAccordion(openAccordion === index ? -1 : index)}
                                                                    className="w-full flex items-center justify-between p-4 bg-white dark:bg-[#111111] hover:bg-slate-50 dark:hover:bg-[#0A0A0A] transition-colors text-left group"
                                                                >
                                                                    <span className="text-xs font-bold font-mono text-slate-700 dark:text-slate-300 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{item.title}</span>
                                                                    <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${openAccordion === index ? 'rotate-180' : ''}`} />
                                                                </button>
                                                                <AnimatePresence>
                                                                    {openAccordion === index && (
                                                                        <motion.div
                                                                            initial={{ height: 0, opacity: 0 }}
                                                                            animate={{ height: "auto", opacity: 1 }}
                                                                            exit={{ height: 0, opacity: 0 }}
                                                                            className="overflow-hidden"
                                                                        >
                                                                            <div className="p-4 pt-0 bg-white dark:bg-[#111111] text-left">
                                                                                <p className="text-[11px] text-slate-500 mb-3">{item.desc}</p>
                                                                                <pre className="p-3 bg-slate-50 dark:bg-[#0A0A0A] rounded-lg border border-slate-200 dark:border-slate-800 overflow-x-auto text-[10px] text-indigo-600 dark:text-indigo-300 font-mono leading-relaxed">
                                                                                    <code>{item.code}</code>
                                                                                </pre>
                                                                            </div>
                                                                        </motion.div>
                                                                    )}
                                                                </AnimatePresence>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>

                                                <div className="pt-6 flex flex-col sm:flex-row gap-4 w-full">
                                                    <button
                                                        onClick={() => navigate('/dashboard')}
                                                        className="flex-1 flex items-center justify-center gap-2 py-3.5 px-6 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs uppercase tracking-wider transition-all shadow-xl shadow-indigo-600/20"
                                                    >
                                                        Proceed to Dashboard
                                                        <ArrowRight className="w-4 h-4" />
                                                    </button>

                                                    <button
                                                        onClick={handleReset}
                                                        className="flex-1 flex items-center justify-center gap-2 py-3.5 px-6 bg-white dark:bg-[#111111] hover:bg-slate-50 dark:hover:bg-[#0A0A0A] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 rounded-xl font-bold text-xs uppercase tracking-wider transition-colors shadow-sm"
                                                    >
                                                        Provision Another
                                                    </button>
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </motion.div>
                    </SignedIn>
                </AnimatePresence>
            </div>

            <Alert
                isOpen={alertConfig.open}
                type={alertConfig.type}
                message={alertConfig.msg}
                onClose={() => setAlertConfig(prev => ({ ...prev, open: false }))}
            />
        </div>
    );
};

export default Registration;
