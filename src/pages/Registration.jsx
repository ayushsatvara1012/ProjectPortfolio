import React, { useState } from 'react';
import { Building2, Globe, Palette, MessageSquare, Copy, CheckCircle, Code, Sparkles, ShieldCheck, Loader2, ArrowRight, Key } from 'lucide-react';
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
            const apiUrl = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api/register` : 'http://localhost:8000/api/register';

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
    const backendUrl = import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace(/\/$/, "") : 'http://localhost:8000';

    const embedCode = `<!-- SaPyBase AI Assistant -->
<script src="${frontendUrl}/widget.js" 
  defer
  data-api-key="${registrationData?.apiKey}"
  data-api-url="${backendUrl}"
></script>`;

    return (
        <div className="w-full min-h-[calc(100vh-80px)] bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-50 py-16 px-4 sm:px-6 lg:px-8 font-sans tracking-tight relative overflow-hidden flex items-center">
            {/* Background Decorations */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-500/10 dark:bg-indigo-500/5 blur-[120px]"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[30%] h-[30%] rounded-full bg-purple-500/10 dark:bg-purple-500/5 blur-[100px]"></div>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-7xl h-full border border-slate-200/50 dark:border-slate-800/30 rounded-[3rem] opacity-50"></div>
            </div>

            <div className="max-w-7xl mx-auto w-full relative z-10">
                <div className="flex flex-col lg:flex-row gap-12 lg:gap-20 items-center">
                    
                    {/* Left Column: Visuals & Value Prop */}
                    <div className="flex-1 flex flex-col justify-center space-y-8 lg:pr-8 pl-4 lg:pl-0 pt-8 lg:pt-0">
                        <motion.div 
                            initial={{ opacity: 0, y: 30 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.6, ease: "easeOut" }}
                        >
                            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-100 dark:bg-indigo-900/50 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 text-sm font-semibold mb-6 shadow-sm">
                                <Sparkles className="w-4 h-4" />
                                <span>Client Onboarding</span>
                            </div>
                            <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight mb-6 leading-[1.1]">
                                Generate <br/>
                                <span className="text-transparent bg-clip-text bg-linear-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-500">
                                    Integration Keys
                                </span>
                            </h1>
                            <p className="text-lg text-slate-600 dark:text-slate-400 leading-relaxed max-w-xl">
                                Provision new clients instantly. Generate a highly secure API key and custom HTML snippet they can copy-paste directly into their website's head tag.
                            </p>
                        </motion.div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-8">
                            <motion.div 
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ duration: 0.5, delay: 0.2 }}
                                className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors"
                            >
                                <ShieldCheck className="w-8 h-8 text-indigo-500 mb-4" />
                                <h3 className="font-bold text-slate-900 dark:text-white mb-2">Unguessable Tokens</h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400">Keys are generated using Python's ultra-secure secrets module to prevent unauthorized access.</p>
                            </motion.div>
                            <motion.div 
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ duration: 0.5, delay: 0.3 }}
                                className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 hover:border-purple-300 dark:hover:border-purple-700 transition-colors"
                            >
                                <Code className="w-8 h-8 text-purple-500 mb-4" />
                                <h3 className="font-bold text-slate-900 dark:text-white mb-2">Zero-Config Embed</h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400">Clients receive a pristine, logo-enforced HTML snippet completely customized for their domain.</p>
                            </motion.div>
                        </div>
                    </div>

                    {/* Right Column: Form or Success State */}
                    <div className="flex-1 w-full max-w-lg lg:max-w-xl mx-auto lg:mx-0 relative">
                        <AnimatePresence mode="wait">
                            {!registrationData ? (
                                <motion.div 
                                    key="registration-form"
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, y: -20, filter: "blur(10px)" }}
                                    transition={{ duration: 0.5, ease: "backOut" }}
                                    className="bg-white dark:bg-slate-900/90 backdrop-blur-2xl shadow-2xl rounded-3xl border border-slate-200/60 dark:border-slate-800/60 overflow-hidden relative"
                                >
                                    <div className="absolute top-0 inset-x-0 h-1 bg-linear-to-r from-indigo-500 to-purple-500"></div>
                                    
                                    <div className="p-8 sm:p-10 relative z-10">
                                        <h2 className="text-2xl font-bold mb-8 text-slate-900 dark:text-white flex items-center gap-3">
                                            <div className="p-2 bg-indigo-100 dark:bg-indigo-900/50 rounded-lg">
                                                <Building2 className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                                            </div>
                                            New Tenant Setup
                                        </h2>
                                        
                                        <form onSubmit={handleSubmit} className="space-y-5">
                                            <div>
                                                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                                                    Company Name <span className="text-red-500">*</span>
                                                </label>
                                                <div className="relative rounded-xl shadow-sm group">
                                                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                                        <Building2 className="h-5 w-5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                                                    </div>
                                                    <input
                                                        type="text"
                                                        name="companyName"
                                                        required
                                                        value={formData.companyName}
                                                        onChange={handleChange}
                                                        className="block w-full pl-11 pr-4 py-3.5 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-all bg-slate-50 dark:bg-slate-950/50 text-slate-900 dark:text-white hover:bg-white dark:hover:bg-slate-900 focus:bg-white dark:focus:bg-slate-900"
                                                        placeholder="Acme Corp"
                                                    />
                                                </div>
                                            </div>

                                            <div>
                                                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                                                    Allowed Origin <span className="text-red-500">*</span>
                                                </label>
                                                <div className="relative rounded-xl shadow-sm group">
                                                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                                        <Globe className="h-5 w-5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                                                    </div>
                                                    <input
                                                        type="url"
                                                        name="allowedOrigin"
                                                        required
                                                        value={formData.allowedOrigin}
                                                        onChange={handleChange}
                                                        className="block w-full pl-11 pr-4 py-3.5 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-all bg-slate-50 dark:bg-slate-950/50 text-slate-900 dark:text-white hover:bg-white dark:hover:bg-slate-900 focus:bg-white dark:focus:bg-slate-900"
                                                        placeholder="https://www.acmecorp.com"
                                                    />
                                                </div>
                                                <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">The exact root domain where the widget will be hosted.</p>
                                            </div>

                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                                                        Theme Color
                                                    </label>
                                                    <div className="relative rounded-xl shadow-sm group flex items-center">
                                                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                                            <Palette className="h-5 w-5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                                                        </div>
                                                        <input
                                                            type="text"
                                                            name="themeColor"
                                                            value={formData.themeColor}
                                                            onChange={handleChange}
                                                            className="block w-full pl-11 pr-12 py-3.5 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-all bg-slate-50 dark:bg-slate-950/50 text-slate-900 dark:text-white hover:bg-white dark:hover:bg-slate-900 focus:bg-white dark:focus:bg-slate-900"
                                                        />
                                                        <div 
                                                            className="absolute right-3 w-6 h-6 rounded-md border border-slate-200 dark:border-slate-700 shadow-sm"
                                                            style={{ backgroundColor: formData.themeColor }}
                                                        ></div>
                                                    </div>
                                                </div>
                                                
                                                <div>
                                                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                                                        Bot Tone
                                                    </label>
                                                    <div className="relative rounded-xl shadow-sm group flex items-center">
                                                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                                            <MessageSquare className="h-5 w-5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                                                        </div>
                                                        <select
                                                            name="companyTone"
                                                            value={formData.companyTone}
                                                            onChange={handleChange}
                                                            className="block w-full pl-11 pr-8 py-3.5 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-all bg-slate-50 dark:bg-slate-950/50 text-slate-900 dark:text-white hover:bg-white dark:hover:bg-slate-900 focus:bg-white dark:focus:bg-slate-900 appearance-none"
                                                        >
                                                            <option value="Professional and helpful">Professional</option>
                                                            <option value="Friendly and casual">Friendly</option>
                                                            <option value="Technical and concise">Technical</option>
                                                            <option value="Enthusiastic and kind">Enthusiastic</option>
                                                        </select>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Submit Button */}
                                            <div className="pt-4">
                                                <button
                                                    type="submit"
                                                    disabled={isLoading}
                                                    className={`w-full flex justify-center items-center py-4 px-4 border border-transparent rounded-xl shadow-lg text-base font-bold text-white bg-linear-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all transform active:scale-[0.98] ${isLoading ? 'opacity-80 cursor-not-allowed shadow-none' : 'hover:shadow-indigo-500/25'}`}
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
                                                </button>
                                            </div>
                                        </form>
                                    </div>
                                </motion.div>
                            ) : (
                                <motion.div 
                                    key="success-card"
                                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    transition={{ duration: 0.6, ease: "easeOut" }}
                                    className="bg-white dark:bg-slate-900/90 backdrop-blur-2xl shadow-2xl rounded-3xl border border-green-200 dark:border-green-800/60 overflow-hidden relative"
                                >
                                    <div className="absolute top-0 inset-x-0 h-2 bg-linear-to-r from-green-400 to-emerald-500"></div>
                                    
                                    <div className="p-8 sm:p-10 relative z-10">
                                        <div className="flex items-center justify-center w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 text-green-500 mb-6 mx-auto">
                                            <Sparkles className="w-8 h-8" />
                                        </div>
                                        
                                        <h2 className="text-2xl font-bold mb-2 text-slate-900 dark:text-white text-center">
                                            {registrationData.companyName} is Live!
                                        </h2>
                                        <p className="text-center text-slate-500 dark:text-slate-400 text-sm mb-8">
                                            Here is the highly secure generated payload for the client.
                                        </p>

                                        <div className="space-y-6">
                                            {/* API Key Box */}
                                            <div>
                                                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                                                    Live API Key
                                                </label>
                                                <div className="flex items-center p-4 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 break-all font-mono text-sm text-indigo-600 dark:text-indigo-400">
                                                    <Key className="w-5 h-5 mr-3 shrink-0 text-slate-400" />
                                                    <span className="flex-1">{registrationData.apiKey}</span>
                                                </div>
                                            </div>

                                            {/* HTML Script Box */}
                                            <div>
                                                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                                                    Widget Embed Code
                                                </label>
                                                <div className="relative group">
                                                    <pre className="p-4 bg-slate-900 rounded-xl border border-slate-800 overflow-x-auto text-xs text-blue-300 font-mono leading-relaxed">
                                                        <code>{embedCode}</code>
                                                    </pre>
                                                    <button
                                                        onClick={() => handleCopy(embedCode)}
                                                        className="absolute top-3 right-3 p-2 bg-slate-800/80 hover:bg-slate-700 rounded-lg text-slate-300 transition-colors backdrop-blur-sm"
                                                        title="Copy Code"
                                                    >
                                                        {copied ? <CheckCircle className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                                                    </button>
                                                </div>
                                                <p className="text-xs text-slate-500 mt-2">
                                                    <span className="font-semibold text-amber-500">Note:</span> There is no logo configuration. It strictly defaults to the SaPyBase logo.
                                                </p>
                                            </div>

                                            <button
                                                onClick={handleReset}
                                                className="w-full mt-8 py-3.5 px-4 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                                            >
                                                Register Another Tenant
                                            </button>
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
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
