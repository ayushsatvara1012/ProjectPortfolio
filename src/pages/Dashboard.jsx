import React, { useState, useRef } from 'react';
import { UploadCloud, Link as LinkIcon, Key, Loader2, FileText, X, BrainCircuit, Sparkles, Database, Eye, EyeOff, Boxes, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Alert from '../components/alert';

const Dashboard = () => {
    const [apiKey, setApiKey] = useState('');
    const [showApiKey, setShowApiKey] = useState(false);
    const [url, setUrl] = useState('');
    const [file, setFile] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [alertConfig, setAlertConfig] = useState({ open: false, type: 'success', msg: '' });

    const fileInputRef = useRef(null);

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

        setAlertConfig(prev => ({ ...prev, open: false }));

        if (!apiKey.trim()) {
            showAlert('error', 'Company API Key is required.');
            return;
        }

        if (!url.trim() && !file) {
            showAlert('error', 'You must provide either a URL or a PDF file.');
            return;
        }

        setIsLoading(true);

        try {
            const formData = new FormData();

            if (url.trim()) {
                formData.append('url', url.trim());
            }

            if (file) {
                formData.append('file', file);
            }

            const apiUrl = import.meta.env.VITE_API_URL
                ? `${import.meta.env.VITE_API_URL.replace(/\/$/, "")}/api/train`
                : '/api/train';

            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'x-api-key': apiKey
                },
                body: formData
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.detail || data.message || 'Failed to train the model.');
            }

            showAlert('success', data.message || 'Training successful!');

            // Optional: reset fields after success
            setUrl('');
            clearFile();

        } catch (error) {
            console.error('Training Error:', error);
            showAlert('error', error.message || 'An unexpected error occurred during training.');
        } finally {
            setIsLoading(false);
        }
    };

    // Animation Variants
    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: { staggerChildren: 0.1 }
        }
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 30, scale: 0.95 },
        visible: {
            opacity: 1,
            y: 0,
            scale: 1,
            transition: { type: "spring", stiffness: 90, damping: 14 }
        }
    };

    // Card styling mixin for consistency
    const bentoCardStyle = "bg-white/60 dark:bg-slate-900/40 backdrop-blur-2xl border border-slate-200 dark:border-slate-800/60 rounded-3xl p-5 lg:p-6 group relative overflow-hidden flex flex-col";

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
                    className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 auto-rows-auto"
                >
                    {/* Hero Title & Value Prop (Spans 2 cols) */}
                    <motion.div variants={itemVariants} className={`${bentoCardStyle} md:col-span-2 lg:col-span-2 flex justify-center bg-linear-to-br from-indigo-50/50 to-white/60 dark:from-indigo-950/20 dark:to-slate-900/40 min-h-[240px]`}>
                        <div className="absolute inset-0 bg-linear-to-b from-white/40 to-transparent dark:from-white/5 opacity-50 pointer-events-none rounded-4xl"></div>

                        {/* Huge Decorative Background Icon */}
                        <Sparkles className="absolute -right-12 -bottom-12 w-64 h-64 text-indigo-500/10 dark:text-indigo-400/5 -rotate-12 pointer-events-none" />

                        <div className="relative z-10 gap-4 flex flex-col justify-center">
                            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-100 dark:bg-indigo-900/50 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold uppercase tracking-wider mb-4 w-fit transition-all">
                                <Sparkles className="w-3.5 h-3.5" />
                                <span>Engine Active</span>
                            </div>
                            <h1 className="text-2xl md:text-3xl lg:text-4xl font-extrabold tracking-tight mb-3 leading-tight text-slate-900 dark:text-white">
                                Train Your <br />
                                <span className="text-transparent bg-clip-text bg-linear-to-r from-red-600 to-indigo-600 dark:from-red-400 dark:to-indigo-500">
                                    AI Chatbot in Minutes
                                </span>
                            </h1>
                            <p className="text-xs md:text-sm text-slate-600 dark:text-slate-400 leading-relaxed font-medium max-w-md">
                                Empower your AI with proprietary data. Scrape documentation or upload PDF manuals to update the vector database instantly.
                            </p>
                            <ul className='mt-4 space-y-2 text-xs text-slate-600 dark:text-slate-400 font-medium'>
                                <li className="flex items-center gap-2"><span className="text-sm">📄</span>  Smart Ingestion : Instantly memorize docs, FAQs, and manuals with vector embeddings.</li>
                                <li className="flex items-center gap-2"><span className="text-sm">🌐</span>  Web Crawling : Auto-scrape your domain for full site knowledge.</li>
                                <li className="flex items-center gap-2"><span className="text-sm">🧠</span>  Secure Vectors : Isolated, private storage for your proprietary data.</li>
                                <li className="flex items-center gap-2"><span className="text-sm">🎭</span>  AI Persona : Custom tone and role tailored to your business and feels like your own brand.</li>
                                <li className="flex items-center gap-2"><span className="text-sm">⚡</span>  Live Sync : Instant brain updates as you add or delete files.</li>
                            </ul>
                        </div>
                    </motion.div>

                    {/* Data Ingestion Form (Spans 2 cols) - Compacted */}
                    <motion.div variants={itemVariants} className={`${bentoCardStyle} md:col-span-2 lg:col-span-2 bg-white/80 dark:bg-slate-900/80 overflow-hidden p-0 relative`}>
                        {/* Large Decorative Form Icon */}
                        <UploadCloud className="absolute -right-12 -bottom-12 w-64 h-64 text-indigo-500/5 dark:text-indigo-400/5 -rotate-6 pointer-events-none" />

                        <div className="h-full flex flex-col relative z-10">
                            <h2 className="text-lg font-bold mb-3 text-slate-900 dark:text-white flex items-center gap-3 p-4 sm:p-5 pb-0">
                                <div className="p-1.5 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg text-indigo-600 dark:text-indigo-400">
                                    <UploadCloud className="w-4 h-4" />
                                </div>
                                Ingest Data
                            </h2>

                            <form onSubmit={handleTrain} className="space-y-3 flex-1 flex flex-col px-4 sm:p-5 pt-0 pb-5">
                                {/* API Key Input */}
                                <div>
                                    <label htmlFor="apiKey" className="block text-sm font-bold text-slate-700 dark:text-slate-200 mb-1.5 ml-1">
                                        Admin API Key <span className="text-red-500">*</span>
                                    </label>
                                    <div className="relative rounded-2xl shadow-xs group/input">
                                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                            <Key className="h-5 w-5 text-slate-400 group-focus-within/input:text-indigo-500 transition-colors" />
                                        </div>
                                        <input
                                            type={showApiKey ? "text" : "password"}
                                            id="apiKey"
                                            required
                                            value={apiKey}
                                            onChange={(e) => setApiKey(e.target.value)}
                                            className="block w-full pl-11 pr-12 py-3.5 border border-slate-200 dark:border-slate-800 rounded-2xl focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 sm:text-sm transition-all bg-slate-50/50 dark:bg-slate-950/50 text-slate-900 dark:text-white hover:bg-slate-100 dark:hover:bg-slate-900 focus:bg-white dark:focus:bg-slate-900 font-medium font-mono"
                                            placeholder="sk_sapy_..."
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowApiKey(!showApiKey)}
                                            className="absolute inset-y-0 right-0 pr-4 flex justify-center items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors focus:outline-none"
                                        >
                                            {showApiKey ? (
                                                <EyeOff className="h-5 w-5" />
                                            ) : (
                                                <Eye className="h-5 w-5" />
                                            )}
                                        </button>
                                    </div>
                                </div>

                                <div className="relative py-1">
                                    <div className="absolute inset-0 flex items-center" aria-hidden="true">
                                        <div className="w-full border-t border-slate-200 dark:border-slate-800" />
                                    </div>
                                    <div className="relative flex justify-center">
                                        <span className="px-4 bg-white dark:bg-slate-900 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest rounded-full border border-slate-200 dark:border-slate-800">
                                            Sources
                                        </span>
                                    </div>
                                </div>

                                {/* URL Input */}
                                <div>
                                    <label htmlFor="url" className="block text-sm font-bold text-slate-700 dark:text-slate-200 mb-1.5 ml-1">
                                        Website URL
                                    </label>
                                    <div className="relative rounded-2xl shadow-xs group/input">
                                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                            <LinkIcon className="h-5 w-5 text-slate-400 group-focus-within/input:text-indigo-500 transition-colors" />
                                        </div>
                                        <input
                                            type="url"
                                            id="url"
                                            value={url}
                                            onChange={(e) => setUrl(e.target.value)}
                                            className="block w-full pl-11 pr-4 py-3.5 border border-slate-200 dark:border-slate-800 rounded-2xl focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 sm:text-sm transition-all bg-slate-50/50 dark:bg-slate-950/50 text-slate-900 dark:text-white hover:bg-slate-100 dark:hover:bg-slate-900 focus:bg-white dark:focus:bg-slate-900 font-medium"
                                            placeholder="https://docs.acmecorp.com"
                                        />
                                    </div>
                                </div>

                                {/* Custom File Dropzone */}
                                <div>
                                    <label className="flex items-center justify-between text-sm font-bold text-slate-700 dark:text-slate-200 mb-1.5 ml-1">
                                        <span>PDF Document</span>
                                        <span className="text-slate-400 font-semibold text-xs uppercase tracking-wider">Optional</span>
                                    </label>

                                    <AnimatePresence mode="wait">
                                        {!file ? (
                                            <motion.div
                                                key="dropzone"
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                exit={{ opacity: 0 }}
                                                className="flex items-center gap-4 px-4 py-3 border-2 border-slate-200 dark:border-slate-700 border-dashed rounded-xl hover:border-indigo-500 dark:hover:border-indigo-400 hover:bg-indigo-50/50 dark:hover:bg-indigo-500/10 transition-all group/dropzone cursor-pointer bg-slate-50/50 dark:bg-slate-950/30"
                                                onClick={() => fileInputRef.current?.click()}
                                            >
                                                <FileText className="h-5 w-5 text-slate-400 dark:text-slate-500 group-hover/dropzone:text-indigo-500 dark:group-hover/dropzone:text-indigo-400 transition-colors" />
                                                <div className="flex-1 text-xs">
                                                    <span className="font-bold text-indigo-600 dark:text-indigo-400">Upload PDF</span>
                                                    <span className="text-slate-400 dark:text-slate-500 ml-1 font-medium italic">(Max 10MB)</span>
                                                </div>
                                                <input
                                                    id="file-upload"
                                                    name="file-upload"
                                                    type="file"
                                                    className="sr-only"
                                                    accept=".pdf,application/pdf"
                                                    onChange={handleFileChange}
                                                    ref={fileInputRef}
                                                />
                                            </motion.div>
                                        ) : (
                                            <motion.div
                                                key="file-ready"
                                                initial={{ opacity: 0, scale: 0.95 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                exit={{ opacity: 0, scale: 0.95 }}
                                                className="flex items-center justify-between p-4 border border-indigo-200 dark:border-indigo-800/60 bg-indigo-50/80 dark:bg-indigo-900/20 rounded-2xl"
                                            >
                                                <div className="flex items-center space-x-4 overflow-hidden">
                                                    <div className="bg-white dark:bg-indigo-800/60 p-2.5 rounded-xl shrink-0 shadow-sm border border-indigo-100 dark:border-indigo-700">
                                                        <FileText className="h-6 w-6 text-indigo-600 dark:text-indigo-300" />
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <p className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                                                            {file.name}
                                                        </p>
                                                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
                                                            {(file.size / 1024 / 1024).toFixed(2)} MB
                                                        </p>
                                                    </div>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={(e) => { e.stopPropagation(); clearFile(); }}
                                                    className="ml-4 shrink-0 bg-white dark:bg-slate-800 p-2 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/20 focus:outline-none transition-colors border border-slate-200 dark:border-slate-700 shadow-sm"
                                                >
                                                    <X className="h-4 w-4" />
                                                </button>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>

                                <div className="mt-auto pt-2">
                                    <button
                                        type="submit"
                                        disabled={isLoading}
                                        className={`relative overflow-hidden w-full flex justify-center py-4 px-4 rounded-2xl text-base font-bold text-white bg-linear-to-r from-blue-800 to-blue-600 hover:from-blue-500 hover:to-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/30 transition-all duration-300 transform active:scale-[0.98] ${isLoading ? 'opacity-80 cursor-not-allowed shadow-none' : 'hover:shadow-blue-600/40'}`}
                                    >
                                        {isLoading ? (
                                            <>
                                                <Loader2 className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" />
                                                Ingesting Knowledge...
                                            </>
                                        ) : (
                                            'Initialize Training Sequence'
                                        )}
                                        {/* Button soft glow overlay */}
                                        <div className="absolute inset-0 bg-white/20 opacity-0 hover:opacity-100 transition-opacity"></div>
                                    </button>
                                </div>
                            </form>
                        </div>
                    </motion.div>

                    {/* Stats Card (New - Bento filling) */}
                    <motion.div variants={itemVariants} className={`${bentoCardStyle} col-span-1 lg:col-span-1 bg-white/40 dark:bg-slate-900/40 border-dashed relative min-h-[180px]`}>
                        {/* Decorative Icon */}
                        <Boxes className="absolute -right-6 -bottom-6 w-32 h-32 text-blue-500/10 dark:text-blue-400/5 rotate-12 pointer-events-none" />

                        <div className="flex flex-col h-full justify-between relative z-10">
                            <div className="p-3 bg-blue-50 dark:bg-blue-900/30 rounded-2xl text-blue-600 dark:text-blue-400 w-fit mb-4">
                                <Boxes className="w-6 h-6" />
                            </div>
                            <div>
                                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Storage</h4>
                                <div className="flex items-end gap-1 mb-2">
                                    <span className="text-3xl font-black text-slate-900 dark:text-white">12.4</span>
                                    <span className="text-sm font-bold text-slate-500 mb-1">GB</span>
                                </div>
                                <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                    <div className="h-full bg-blue-500 rounded-full w-[65%]" />
                                </div>
                            </div>
                        </div>
                    </motion.div>

                    {/* Quick Link Card (Small filler) - Themed to match Storage */}
                    <motion.div variants={itemVariants} className={`${bentoCardStyle} col-span-1 lg:col-span-1 bg-white/40 dark:bg-slate-900/40 border-dashed relative min-h-[180px]`}>
                        {/* Decorative Icon */}
                        <Zap className="absolute -right-6 -bottom-6 w-32 h-32 text-indigo-500/10 dark:text-indigo-400/5 rotate-12 pointer-events-none" />

                        <div className="flex flex-col h-full justify-between relative z-10">
                            <div className="p-3 bg-indigo-50 dark:bg-indigo-900/30 rounded-2xl text-indigo-600 dark:text-indigo-400 w-fit mb-4">
                                <Zap className="w-6 h-6" />
                            </div>
                            <div>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Status</p>
                                <h4 className="text-xl font-black text-slate-900 dark:text-white leading-tight">
                                    Ready to <br />
                                    <span className="text-indigo-500 dark:text-indigo-400">Initialize</span>
                                </h4>
                            </div>
                        </div>
                    </motion.div>

                    {/* Features Row - Feature 1 */}
                    <motion.div variants={itemVariants} className={`${bentoCardStyle} col-span-1 md:col-span-1 lg:col-span-1 relative min-h-[180px]`}>
                        {/* Decorative Icon */}
                        <BrainCircuit className="absolute -right-4 -bottom-4 w-24 h-24 text-indigo-500/10 dark:text-indigo-400/5 -rotate-12 pointer-events-none" />

                        <div className="relative z-10">
                            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 text-indigo-500 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-300">
                                <BrainCircuit className="w-5 h-5" />
                            </div>
                            <h3 className="font-bold text-base text-slate-900 dark:text-white mb-1 tracking-tight">Semantic Chunking</h3>
                            <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
                                Content is automatically segmented into optimal vectors for maximum retrieval accuracy.
                            </p>
                        </div>
                    </motion.div>

                    {/* Features Row - Feature 2 */}
                    <motion.div variants={itemVariants} className={`${bentoCardStyle} col-span-1 md:col-span-1 lg:col-span-1 relative min-h-[180px]`}>
                        {/* Decorative Icon */}
                        <Database className="absolute -right-4 -bottom-4 w-24 h-24 text-purple-500/10 dark:text-purple-400/5 rotate-12 pointer-events-none" />

                        <div className="relative z-10">
                            <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-900/30 text-purple-500 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-300">
                                <Database className="w-5 h-5" />
                            </div>
                            <h3 className="font-bold text-base text-slate-900 dark:text-white mb-1 tracking-tight">Isolated Storage</h3>
                            <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
                                Embeddings are stored in a secure Neon DB instance, protected by your Ironclad API key.
                            </p>
                        </div>
                    </motion.div>



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

export default Dashboard;
