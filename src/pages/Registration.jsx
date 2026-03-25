import React, { useState } from 'react';
import { SignedIn, SignedOut, SignUp, useUser, useAuth } from "@clerk/clerk-react";
import { Building2, Globe, Palette, MessageSquare, Copy, CheckCircle, Code2, Sparkles, ShieldCheck, Loader2, ArrowRight, Key, Zap, BookOpen, ChevronRight,Shield } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Alert from '../components/alert';

const Registration = () => {
    const { user, isLoaded } = useUser();
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

    const { getToken } = useAuth();

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.companyName.trim() || !formData.allowedOrigin.trim()) {
            showAlert('error', 'Company Name and Allowed Origin are required.');
            return;
        }

        setIsLoading(true);

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

    // Card styling mixin for consistency
    const bentoCardStyle = "bg-white/60 dark:bg-slate-900/40 backdrop-blur-2xl border border-slate-200 dark:border-slate-800/60 rounded-[2rem] p-6 lg:p-8 group relative overflow-hidden flex flex-col";

    return (
        <div className="w-full min-h-[calc(100vh-80px)] bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-50 pt-28 pb-12 px-4 sm:px-6 lg:px-8 font-sans tracking-tight relative overflow-x-hidden flex justify-center">

            {/* Soft Ambient Background Orbs */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-blue-500/10 dark:bg-blue-500/5 blur-[120px]"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-red-500/10 dark:bg-red-500/5 blur-[100px]"></div>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80%] max-w-7xl h-[80%] border border-indigo-200/20 dark:border-indigo-800/10 rounded-[4rem] opacity-50 blur-[2px]"></div>
            </div>

            <div className="max-w-7xl mx-auto w-full relative z-10">
                <AnimatePresence mode="wait">
                    <SignedOut>
                        <motion.div
                            key="signed-out"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="flex flex-col items-center justify-center min-h-[60vh] py-12"
                        >
                            <div className="mb-8 text-center bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl p-8 rounded-[3rem] border border-slate-200 dark:border-slate-800 shadow-xl max-w-2xl w-full">
                                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-100 dark:bg-indigo-900/50 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 text-sm font-bold uppercase tracking-wider mb-6">
                                    <Sparkles className="w-4 h-4" />
                                    <span>Welcome to SaPyBase</span>
                                </div>
                                <h1 className="text-4xl md:text-5xl font-black mb-6 leading-tight">Start Your <span className="text-transparent bg-clip-text bg-linear-to-r from-red-600 to-indigo-600 dark:from-red-400 dark:to-indigo-500">SaaS Journey</span></h1>
                                <p className="text-slate-600 dark:text-slate-400 text-lg mb-8 max-w-md mx-auto font-medium">Create an account to provision your first AI chatbot and access the developer dashboard.</p>
                                <div className="flex justify-center">
                                    <SignUp routing="hash" signInUrl="/login" />
                                </div>
                            </div>
                        </motion.div>
                    </SignedOut>

                    <SignedIn>
                        <motion.div
                            key="signed-in"
                            variants={containerVariants}
                            initial="hidden"
                            animate="visible"
                            className="grid grid-cols-1 lg:grid-cols-12 gap-8"
                        >
                            {/* Left Column: Promotion/Details (Spans 5 cols) */}
                            <motion.div variants={itemVariants} className="lg:col-span-5 space-y-6">
                                <div className={`${bentoCardStyle} bg-linear-to-br from-indigo-500 to-blue-700 text-white border-none shadow-2xl shadow-indigo-500/20`}>
                                    <div className="relative z-10">
                                        <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/20 backdrop-blur-sm rounded-full text-[10px] font-bold uppercase tracking-wider mb-6">
                                            <Sparkles className="w-3 h-3" />
                                            <span>Hey {user?.firstName || 'Innovator'}!</span>
                                        </div>
                                        <h1 className="text-4xl font-extrabold tracking-tight mb-4 leading-tight">
                                            Launch Your <br />AI Agent Today
                                        </h1>
                                        <p className="text-indigo-100 text-sm font-medium leading-relaxed mb-8 opacity-90">
                                            Provision your tenant, get your API key, and start conversing with your customers using the power of Gemini.
                                        </p>
                                        
                                        <div className="space-y-4">
                                            {[
                                                { icon: Zap, text: "Instant Provisioning", sub: "Get your key in seconds" },
                                                { icon: Shield, text: "Enterprise Security", sub: "Domain-locked API access" },
                                                { icon: Code2, text: "Easy Integration", sub: "One-line snippet install" }
                                            ].map((feat, i) => (
                                                <div key={i} className="flex items-center gap-4 p-3 bg-white/10 rounded-2xl backdrop-blur-xs">
                                                    <div className="p-2 bg-white/20 rounded-xl">
                                                        <feat.icon className="w-5 h-5" />
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-bold">{feat.text}</p>
                                                        <p className="text-[10px] text-white/60">{feat.sub}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    
                                    {/* Abstract decoration */}
                                    <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
                                </div>
                                
                                <div className={`${bentoCardStyle} bg-white/80 dark:bg-slate-900/40`}>
                                    <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                                        <MessageSquare className="w-5 h-5 text-indigo-500" />
                                        Custom Instructions
                                    </h3>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                                        Your AI assistant will follow these parameters to ensure brand consistency and helpfulness across all interactions.
                                    </p>
                                </div>
                            </motion.div>

                            {/* Right Column: The Form/Success (Spans 7 cols) */}
                            <motion.div variants={itemVariants} className="lg:col-span-7">
                                <div className={`${bentoCardStyle} h-full min-h-[500px] shadow-xl border-slate-200/60 dark:border-slate-800/60 bg-white/90 dark:bg-slate-900/60`}>
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
                                                    <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white">Tenant Configuration</h2>
                                                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Fill in details to generate your unique integration credentials.</p>
                                                </div>

                                                <form onSubmit={handleSubmit} className="space-y-6 flex-1">
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                        <div className="space-y-2">
                                                            <label className="text-xs font-bold uppercase tracking-wider text-slate-500 ml-1">Company Name</label>
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
                                                            <label className="text-xs font-bold uppercase tracking-wider text-slate-500 ml-1">Allowed Origin</label>
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
                                                            <label className="text-xs font-bold uppercase tracking-wider text-slate-500 ml-1">Theme Color</label>
                                                            <div className="flex gap-3">
                                                                <div className="relative flex-1 group">
                                                                    <Palette className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                                                    <input
                                                                        type="text"
                                                                        name="themeColor"
                                                                        value={formData.themeColor}
                                                                        onChange={handleChange}
                                                                        className="w-full pl-12 pr-4 py-3.5 bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 outline-none uppercase font-mono text-xs"
                                                                    />
                                                                </div>
                                                                <div className="w-14 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden relative shadow-inner">
                                                                    <input 
                                                                        type="color" 
                                                                        name="themeColor" 
                                                                        value={formData.themeColor} 
                                                                        onChange={handleChange} 
                                                                        className="absolute inset-0 w-full h-[200%] cursor-pointer -translate-y-1/4" 
                                                                    />
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <div className="space-y-2">
                                                            <label className="text-xs font-bold uppercase tracking-wider text-slate-500 ml-1">Tone of Voice</label>
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
                                                            className="w-full group relative flex items-center justify-center gap-3 py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl font-bold transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-70 disabled:hover:scale-100 shadow-xl shadow-slate-900/10 dark:shadow-white/5"
                                                        >
                                                            {isLoading ? (
                                                                <Loader2 className="w-5 h-5 animate-spin" />
                                                            ) : (
                                                                <>
                                                                    Create Tenant
                                                                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                                                                </>
                                                            )}
                                                        </button>
                                                    </div>
                                                </form>
                                            </motion.div>
                                        ) : (
                                            <motion.div
                                                key="success-view"
                                                initial={{ opacity: 0, scale: 0.95 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                className="h-full flex flex-col items-center justify-center text-center space-y-8"
                                            >
                                                <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-3xl flex items-center justify-center text-green-600 shadow-inner">
                                                    <CheckCircle className="w-10 h-10" />
                                                </div>
                                                
                                                <div>
                                                    <h2 className="text-3xl font-black text-slate-900 dark:text-white">{registrationData.companyName} Ready</h2>
                                                    <p className="text-slate-500 mt-2 font-medium">Your credentials have been generated and secured.</p>
                                                </div>

                                                <div className="w-full space-y-4 text-left">
                                                    <div className="space-y-2">
                                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">API Key</label>
                                                        <div className="flex items-center gap-2 p-3.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl font-mono text-xs text-indigo-600 dark:text-indigo-400 break-all transition-all hover:border-indigo-500/30">
                                                            <Key className="w-4 h-4 shrink-0 text-slate-400" />
                                                            {registrationData.apiKey}
                                                        </div>
                                                    </div>

                                                    <div className="space-y-2">
                                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Embed Script</label>
                                                        <div className="relative group">
                                                            <pre className="p-4 bg-slate-900 rounded-2xl border border-slate-800 overflow-x-auto text-[10px] text-indigo-300 font-mono leading-relaxed max-h-[120px] scrollbar-hide">
                                                                <code>{embedCode}</code>
                                                            </pre>
                                                            <button
                                                                onClick={() => handleCopy(embedCode)}
                                                                className="absolute top-2 right-2 p-2 bg-slate-800/80 hover:bg-slate-700 rounded-xl text-white transition-all border border-slate-700/50"
                                                            >
                                                                {copied ? <CheckCircle className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>

                                                <button
                                                    onClick={handleReset}
                                                    className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
                                                >
                                                    <ArrowRight className="w-4 h-4 rotate-180" />
                                                    Provision Another
                                                </button>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            </motion.div>
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
