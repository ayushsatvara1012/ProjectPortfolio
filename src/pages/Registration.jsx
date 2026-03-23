import React, { useState } from 'react';
import { Building2, Globe, Palette, MessageSquare, Copy, CheckCircle, Code, Sparkles, ShieldCheck, Loader2, ArrowRight, Key, Zap, BookOpen, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Alert from '../components/alert';

const Registration = () => {
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

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.companyName.trim() || !formData.allowedOrigin.trim()) {
            showAlert('error', 'Company Name and Allowed Origin are required.');
            return;
        }

        setIsLoading(true);

        try {
            const apiUrl = import.meta.env.VITE_API_URL
                ? `${import.meta.env.VITE_API_URL.replace(/\/$/, "")}/api/register`
                : 'https://sapyai.onrender.com/api/register';

            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
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

            <div className="max-w-340 mx-auto w-full relative z-10">
                <motion.div
                    variants={containerVariants}
                    initial="hidden"
                    animate="visible"
                    className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 auto-rows-auto"
                >
                    {/* Hero Title & Value Prop (Spans 2 cols) */}
                    <motion.div variants={itemVariants} className={`${bentoCardStyle} md:col-span-2 lg:col-span-2 flex justify-center bg-linear-to-br from-indigo-50/50 to-white/60 dark:from-indigo-950/20 dark:to-slate-900/40`}>
                        <div className="absolute inset-0 bg-linear-to-b from-white/40 to-transparent dark:from-white/5 opacity-50 pointer-events-none rounded-4xl"></div>
                        <div className="relative z-10">
                            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-100 dark:bg-indigo-900/50 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 text-sm font-semibold mb-6 transparent transition-all">
                                <Sparkles className="w-4 h-4" />
                                <span>Client Onboarding</span>
                            </div>
                            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4 leading-[1.15]">
                                Generate <br />
                                <span className="text-transparent bg-clip-text bg-linear-to-r from-red-600 to-indigo-600 dark:from-red-400 dark:to-indigo-500">
                                    Integration Keys
                                </span>
                            </h1>
                            <p className="text-base sm:text-lg text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
                                Provision new clients instantly. Generate a highly secure API key and custom HTML snippet they can embed directly into their website's head tag.
                            </p>
                        </div>
                    </motion.div>

                    {/* Registration / Success Form (Spans 2 cols, 2 rows) */}
                    <motion.div variants={itemVariants} className={`${bentoCardStyle} md:col-span-2 lg:col-span-2 lg:row-span-2 bg-white/80 dark:bg-slate-900/80 overflow-visible p-0`}>
                        {/* Soft header glow line */}

                        <div className="h-full flex flex-col relative z-10">
                            <AnimatePresence mode="wait">
                                {!registrationData ? (
                                    <motion.div
                                        key="form"
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: -20, filter: "blur(5px)" }}
                                        transition={{ duration: 0.4 }}
                                        className="h-full flex flex-col"
                                    >
                                        <h2 className="text-2xl font-bold mb-6 text-slate-900 dark:text-white flex items-center gap-3">
                                            <div className="p-2.5 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl text-indigo-600 dark:text-indigo-400">
                                                <Building2 className="w-5 h-5" />
                                            </div>
                                            New Tenant Setup
                                        </h2>

                                        <form onSubmit={handleSubmit} className="space-y-5 flex-1 flex flex-col">
                                            <div>
                                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-200 mb-1.5 ml-1">
                                                    Company Name <span className="text-red-500">*</span>
                                                </label>
                                                <div className="relative rounded-2xl shadow-xs group/input">
                                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                                        <Building2 className="h-5 w-5 text-slate-400 group-focus-within/input:text-indigo-500 transition-colors" />
                                                    </div>
                                                    <input
                                                        type="text"
                                                        name="companyName"
                                                        required
                                                        value={formData.companyName}
                                                        onChange={handleChange}
                                                        className="block w-full pl-11 pr-4 py-3.5 border border-slate-200 dark:border-slate-800 rounded-2xl focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 sm:text-sm transition-all bg-slate-50/50 dark:bg-slate-950/50 text-slate-900 dark:text-white hover:bg-slate-100 dark:hover:bg-slate-900 focus:bg-white dark:focus:bg-slate-900 font-medium"
                                                        placeholder="Acme Corp"
                                                    />
                                                </div>
                                            </div>

                                            <div>
                                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-200 mb-1.5 ml-1">
                                                    Allowed Origin <span className="text-red-500">*</span>
                                                </label>
                                                <div className="relative rounded-2xl shadow-xs group/input">
                                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                                        <Globe className="h-5 w-5 text-slate-400 group-focus-within/input:text-indigo-500 transition-colors" />
                                                    </div>
                                                    <input
                                                        type="url"
                                                        name="allowedOrigin"
                                                        required
                                                        value={formData.allowedOrigin}
                                                        onChange={handleChange}
                                                        className="block w-full pl-11 pr-4 py-3.5 border border-slate-200 dark:border-slate-800 rounded-2xl focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 sm:text-sm transition-all bg-slate-50/50 dark:bg-slate-950/50 text-slate-900 dark:text-white hover:bg-slate-100 dark:hover:bg-slate-900 focus:bg-white dark:focus:bg-slate-900 font-medium"
                                                        placeholder="https://www.acmecorp.com"
                                                    />
                                                </div>
                                                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 ml-1 font-medium">The exact root domain where the widget will be hosted.</p>
                                            </div>

                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-200 mb-1.5 ml-1">
                                                        Theme Color
                                                    </label>
                                                    <div className="relative rounded-2xl shadow-xs group/input flex items-center">
                                                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                                            <Palette className="h-5 w-5 text-slate-400 group-focus-within/input:text-indigo-500 transition-colors" />
                                                        </div>
                                                        <input
                                                            type="text"
                                                            name="themeColor"
                                                            value={formData.themeColor}
                                                            onChange={handleChange}
                                                            className="block w-full pl-11 pr-14 py-3.5 border border-slate-200 dark:border-slate-800 rounded-2xl focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 sm:text-sm transition-all bg-slate-50/50 dark:bg-slate-950/50 text-slate-900 dark:text-white hover:bg-slate-100 dark:hover:bg-slate-900 focus:bg-white dark:focus:bg-slate-900 font-mono text-sm uppercase"
                                                        />
                                                        <div className="absolute right-2.5 w-7 h-7 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 shadow-sm cursor-pointer hover:scale-105 transition-transform focus-within:ring-2 focus-within:ring-indigo-500 focus-within:ring-offset-1 dark:focus-within:ring-offset-slate-900">
                                                            <input
                                                                type="color"
                                                                name="themeColor"
                                                                value={formData.themeColor}
                                                                onChange={handleChange}
                                                                className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
                                                            />
                                                            <div
                                                                className="w-full h-full pointer-events-none"
                                                                style={{ backgroundColor: formData.themeColor }}
                                                            ></div>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div>
                                                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-200 mb-1.5 ml-1">
                                                        Bot Tone
                                                    </label>
                                                    <div className="relative rounded-2xl shadow-xs group/input flex items-center">
                                                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                                            <MessageSquare className="h-5 w-5 text-slate-400 group-focus-within/input:text-indigo-500 transition-colors" />
                                                        </div>
                                                        <select
                                                            name="companyTone"
                                                            value={formData.companyTone}
                                                            onChange={handleChange}
                                                            className="block w-full pl-11 pr-8 py-3.5 border border-slate-200 dark:border-slate-800 rounded-2xl focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 sm:text-sm transition-all bg-slate-50/50 dark:bg-slate-950/50 text-slate-900 dark:text-white hover:bg-slate-100 dark:hover:bg-slate-900 focus:bg-white dark:focus:bg-slate-900 appearance-none font-medium"
                                                        >
                                                            <option value="Professional and helpful">Professional</option>
                                                            <option value="Friendly and casual">Friendly</option>
                                                            <option value="Technical and concise">Technical</option>
                                                            <option value="Enthusiastic and kind">Enthusiastic</option>
                                                        </select>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Spacer to push button to bottom if needed */}
                                            <div className="flex-1"></div>

                                            {/* Submit Button */}
                                            <div className="pt-2">
                                                <button
                                                    type="submit"
                                                    disabled={isLoading}
                                                    className={`relative overflow-hidden w-full flex justify-center items-center py-4 px-4 rounded-2xl text-base font-bold text-white bg-linear-to-r from-blue-800 to-blue-600 hover:from-blue-500 hover:to-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/30 transition-all duration-300 transform active:scale-[0.98] ${isLoading ? 'opacity-80 cursor-not-allowed shadow-none' : 'hover:shadow-blue-600/40'}`}
                                                >
                                                    {isLoading ? (
                                                        <>
                                                            <Loader2 className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" />
                                                            Generating Payload...
                                                        </>
                                                    ) : (
                                                        <>
                                                            Create Tenant <ArrowRight className="ml-2 w-5 h-5" />
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
                                        key="success"
                                        initial={{ opacity: 0, scale: 0.95 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        transition={{ duration: 0.4, type: "spring", stiffness: 120 }}
                                        className="h-full flex flex-col justify-center"
                                    >
                                        <div className="flex flex-col items-center justify-center mb-6 text-center">
                                            <div className="w-16 h-16 rounded-3xl bg-green-100 dark:bg-green-900/30 text-green-500 flex items-center justify-center mb-4 shadow-inner">
                                                <CheckCircle className="w-8 h-8" />
                                            </div>
                                            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                                                {registrationData.companyName} is Ready
                                            </h2>
                                            <p className="text-slate-500 dark:text-slate-400 text-sm mt-1 font-medium">
                                                Highly secure payload generated.
                                            </p>
                                        </div>

                                        <div className="space-y-5">
                                            {/* API Key Box */}
                                            <div>
                                                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                                                    Live API Key
                                                </label>
                                                <div className="flex items-center p-3.5 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 break-all font-mono text-sm text-indigo-600 dark:text-indigo-400 shadow-inner">
                                                    <Key className="w-5 h-5 mr-3 shrink-0 text-slate-400" />
                                                    <span className="flex-1">{registrationData.apiKey}</span>
                                                </div>
                                            </div>

                                            {/* Dynamic Framework Integration Box */}
                                            <div>
                                                <div className="flex items-center justify-between mb-2">
                                                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                                        Integration Code
                                                    </label>
                                                </div>

                                                {/* Platform Tabs */}
                                                <div className="flex flex-wrap gap-1.5 mb-3">
                                                    {[
                                                        { id: 'html', label: 'HTML / Shopify' },
                                                        { id: 'react', label: 'React / Vite' },
                                                        { id: 'nextjs', label: 'Next.js' },
                                                        { id: 'wordpress', label: 'WordPress' }
                                                    ].map((tab) => (
                                                        <button
                                                            key={tab.id}
                                                            type="button"
                                                            onClick={() => setActivePlatform(tab.id)}
                                                            className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all ${
                                                                activePlatform === tab.id
                                                                ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300 ring-1 ring-indigo-500/30'
                                                                : 'bg-slate-100 text-slate-600 dark:bg-slate-800/50 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                                                            }`}
                                                        >
                                                            {tab.label}
                                                        </button>
                                                    ))}
                                                </div>

                                                {/* macOS-style Code Window */}
                                                <div className="relative group/code">
                                                    <div className="absolute top-0 left-0 w-full h-7 bg-slate-800/70 rounded-t-xl border-b border-slate-700/80 flex items-center px-3 gap-1.5">
                                                        <div className="w-2.5 h-2.5 rounded-full bg-red-500/80"></div>
                                                        <div className="w-2.5 h-2.5 rounded-full bg-amber-500/80"></div>
                                                        <div className="w-2.5 h-2.5 rounded-full bg-green-500/80"></div>
                                                        <span className="ml-auto text-[10px] text-slate-500 font-mono">
                                                            {activePlatform === 'nextjs' ? 'layout.jsx' : activePlatform === 'react' ? 'App.jsx' : activePlatform === 'wordpress' ? 'functions.php' : 'index.html'}
                                                        </span>
                                                    </div>
                                                    <pre className="pt-9 pb-4 px-4 bg-slate-900 rounded-xl border border-slate-800 overflow-x-auto text-xs text-blue-300 font-mono leading-relaxed shadow-inner min-h-[100px]">
                                                        <code>{embedCode}</code>
                                                    </pre>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleCopy(embedCode)}
                                                        className="absolute top-[2.1rem] right-2 p-1.5 bg-slate-700/80 hover:bg-slate-600 rounded-lg text-slate-300 transition-colors border border-slate-600/50"
                                                        title="Copy Code"
                                                    >
                                                        {copied ? <CheckCircle className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                                                    </button>
                                                </div>
                                            </div>

                                            <button
                                                onClick={handleReset}
                                                className="w-full mt-6 py-3.5 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-bold transition-all"
                                            >
                                                Register Another Tenant
                                            </button>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </motion.div>

                    {/* Features Row - Feature 1 */}
                    <motion.div variants={itemVariants} className={`${bentoCardStyle} col-span-1 lg:col-span-1`}>
                        <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-900/30 text-indigo-500 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300">
                            <ShieldCheck className="w-6 h-6" />
                        </div>
                        <h3 className="font-bold text-lg text-slate-900 dark:text-white mb-2 tracking-tight">Unguessable Tokens</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
                            Keys are generated using secure Python secrets modules to prevent unauthorized brute-force entries.
                        </p>
                    </motion.div>

                    {/* Features Row - Feature 2 */}
                    <motion.div variants={itemVariants} className={`${bentoCardStyle} col-span-1 lg:col-span-1`}>
                        <div className="w-12 h-12 rounded-2xl bg-purple-50 dark:bg-purple-900/30 text-purple-500 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300">
                            <Code className="w-6 h-6" />
                        </div>
                        <h3 className="font-bold text-lg text-slate-900 dark:text-white mb-2 tracking-tight">Zero-Config Embed</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
                            Clients receive a pristine, highly-optimized HTML snippet immediately customized for their domain.
                        </p>
                    </motion.div>

                    {/* Documentation Card — Full width on mobile, 4-cols on lg */}
                    <motion.div variants={itemVariants} className={`${bentoCardStyle} col-span-1 md:col-span-2 lg:col-span-4 p-6 sm:p-8`}>
                        {/* Header */}
                        <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6">
                            <div className="p-3 bg-indigo-50 dark:bg-indigo-900/30 rounded-2xl text-indigo-600 dark:text-indigo-400 w-fit">
                                <BookOpen className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="font-bold text-xl text-slate-900 dark:text-white tracking-tight">Integration Guide</h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mt-0.5">Follow the steps below for your platform to embed the AI widget.</p>
                            </div>
                        </div>

                        {/* Professional Documentation Layout: Sidebar + Content */}
                        <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-0 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-white/30 dark:bg-slate-900/30 backdrop-blur-sm">

                            {/* Left Sidebar - Platform Navigation */}
                            <div className="border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20 p-4">
                                <div className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-x-visible pb-2 lg:pb-0 no-scrollbar">
                                    {[
                                        { id: 'html', name: 'HTML / Shopify', icon: <Globe className="w-3.5 h-3.5" /> },
                                        { id: 'react', name: 'React / Vite', icon: <Code className="w-3.5 h-3.5" /> },
                                        { id: 'nextjs', name: 'Next.js', icon: <Zap className="w-3.5 h-3.5" /> },
                                        { id: 'wordpress', name: 'WordPress', icon: <Building2 className="w-3.5 h-3.5" /> }
                                    ].map((item) => (
                                        <button
                                            key={item.id}
                                            onClick={() => setActivePlatformDocs(item.id)}
                                            className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap lg:whitespace-normal ${
                                                activePlatformDocs === item.id
                                                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 dark:shadow-none translate-x-1 lg:translate-x-2'
                                                : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-white'
                                            }`}
                                        >
                                            <span className={activePlatformDocs === item.id ? 'text-white' : 'text-slate-400 group-hover:text-slate-600 transition-colors'}>
                                                {item.icon}
                                            </span>
                                            {item.name}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Right Content Area */}
                            <div className="p-6 sm:p-8 min-h-[400px]">
                                <AnimatePresence mode="wait">
                                    <motion.div
                                        key={activePlatformDocs}
                                        initial={{ opacity: 0, x: 10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: -10 }}
                                        transition={{ duration: 0.2 }}
                                        className="h-full flex flex-col"
                                    >
                                        {/* Content Header */}
                                        <div className="mb-8">
                                            <div className="flex items-center gap-2 text-indigo-500 font-bold text-[10px] uppercase tracking-[0.2em] mb-1">
                                                <div className="w-4 h-px bg-indigo-500"></div>
                                                Platform Specific
                                            </div>
                                            <h4 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight capitalize">
                                                {activePlatformDocs.replace('nextjs', 'Next.js').replace('html', 'HTML / Shopify')} Integration
                                            </h4>
                                        </div>

                                        {/* Detailed Steps */}
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12 pb-8 grow">
                                            {[
                                                {
                                                    id: 'html',
                                                    sections: [
                                                        { title: '1. Script Placement', body: 'Copy your unique script tag from the "Snippet" tab. For optimal performance, we recommend placing it just before the closing </body> tag in your main layout file.' },
                                                        { title: '2. Shopify Integration', body: 'Navigate to Online Store → Themes → Edit Code. Open layout/theme.liquid and paste the tag at the very bottom. This ensures the widget appears on every page.' }
                                                    ]
                                                },
                                                {
                                                    id: 'react',
                                                    sections: [
                                                        { title: '1. Component Setup', body: 'In your root component (App.jsx), use the React useEffect hook to inject the widget script. This allows the widget to load only after your app has mounted.' },
                                                        { title: '2. Environment Variables', body: 'Make sure your VITE_API_URL and VITE_FRONT_URL are properly configured in your .env file for the widget to connect to our servers.' }
                                                    ]
                                                },
                                                {
                                                    id: 'nextjs',
                                                    sections: [
                                                        { title: '1. Root Layout', body: 'Integration is easiest in the Next.js App Router. Add the <Script /> component into app/layout.js, ensuring it is outside the main content wrapper.' },
                                                        { title: '2. Zero-Impact Strategy', body: 'Utilize strategy="lazyOnload" to defer the widget until the page is fully interactive, protecting your Core Web Vitals and SEO performance.' }
                                                    ]
                                                },
                                                {
                                                    id: 'wordpress',
                                                    sections: [
                                                        { title: '1. Theme Editor', body: 'Access your WordPress Admin Dashboard, then go to Appearance → Theme File Editor. Select your active theme\'s functions.php file.' },
                                                        { title: '2. Hook Injection', body: 'Append our provided PHP snippet to add an action to wp_footer. This securely injects the script into your footer without editing theme templates directly.' }
                                                    ]
                                                }
                                            ].find(p => p.id === activePlatformDocs).sections.map((section, idx) => (
                                                <div key={idx} className="relative pl-6 border-l border-slate-100 dark:border-slate-800">
                                                    <div className="absolute -left-px top-0 w-px h-6 bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.6)]"></div>
                                                    <h5 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                                                        {section.title}
                                                    </h5>
                                                    <p className="text-sm text-slate-500 dark:text-slate-400 font-medium leading-[1.6]">
                                                        {section.body}
                                                    </p>
                                                </div>
                                            ))}
                                        </div>

                                        {/* Context-aware code teaser */}
                                        <div className="mt-auto pt-6 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between group cursor-help" onClick={() => window.scrollTo({ top: document.querySelector('#embed-snippet-section')?.offsetTop - 100, behavior: 'smooth' })}>
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 group-hover:text-indigo-500 transition-colors">
                                                    <Copy className="w-4 h-4" />
                                                </div>
                                                <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
                                                    Ready to deploy? Get your <span className="text-slate-900 dark:text-white">live {activePlatformDocs === 'html' ? 'HTML tag' : 'React code'}</span> above.
                                                </p>
                                            </div>
                                            <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-500 group-hover:translate-x-1 transition-all" />
                                        </div>
                                    </motion.div>
                                </AnimatePresence>
                            </div>
                        </div>

                        {/* Note footer */}
                        <div className="mt-5 flex flex-col sm:flex-row items-start sm:items-center gap-2 p-3.5 bg-amber-50 dark:bg-amber-900/10 border border-amber-200/60 dark:border-amber-800/30 rounded-xl">
                            <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0 mt-0.5 sm:mt-0"></span>
                            <p className="text-xs text-amber-700 dark:text-amber-400 font-medium leading-relaxed">
                                <strong>Important:</strong> Never expose your API Key publicly in a client-side repo. For server-side frameworks, pass it via environment variables (e.g. <code className="bg-amber-100 dark:bg-amber-900/30 px-1 py-0.5 rounded font-mono">NEXT_PUBLIC_SAPY_API_KEY</code>).
                            </p>
                        </div>
                    </motion.div>

                    {/* Decorative Card (Spans 2 cols, bottom row) or visual aid */}
                    {/* <motion.div variants={itemVariants} className={`${bentoCardStyle} md:col-span-2 lg:col-span-2 bg-indigo-600 text-white overflow-hidden p-0 border-indigo-500/50`}>
                        <div className="absolute inset-0 bg-size-[14px_14px] bg-[linear-gradient(to_right,#ffffff15_1px,transparent_1px),linear-gradient(to_bottom,#ffffff15_1px,transparent_1px)] mask-[radial-gradient(ellipse_60%_60%_at_50%_50%,#000_10%,transparent_100%)]"></div>
                        <div className="relative p-6 sm:p-8 h-full flex flex-col justify-between z-10">
                            <div className="flex justify-between items-start">
                                <div className="p-2.5 bg-white/20 rounded-xl backdrop-blur-sm">
                                    <Zap className="w-6 h-6 text-white" />
                                </div>
                                <div className="px-3 py-1 bg-white/20 backdrop-blur-sm rounded-full text-xs font-bold uppercase tracking-wider text-white">
                                    System Active
                                </div>
                            </div>
                            <div className="mt-6">
                                <h3 className="text-2xl font-bold mb-2">Lightning Fast Provisioning</h3>
                                <p className="text-indigo-100 font-medium text-sm max-w-sm">
                                    Sub-second tenant creation. Database and API mappings handle instantaneous configuration behind the scenes.
                                </p>
                            </div>
                        </div>
                    </motion.div> */}

                </motion.div>
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
