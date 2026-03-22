import React, { useState, useRef } from 'react';
import { UploadCloud, Link as LinkIcon, Key, Loader2, FileText, X, BrainCircuit, Sparkles, Database, Eye, EyeOff } from 'lucide-react';
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

            const apiUrl = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api/train` : 'http://localhost:8000/api/train';

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

        } catch (error) {
            console.error('Training Error:', error);
            showAlert('error', error.message || 'An unexpected error occurred during training.');
        } finally {
            setIsLoading(false);
        }
    };

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
                                <span>Knowledge Engine 2.0</span>
                            </div>
                            <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight mb-6 leading-[1.1]">
                                Train Your AI <br />
                                <span className="text-transparent bg-clip-text bg-linear-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-500">
                                    In Real-Time
                                </span>
                            </h1>
                            <p className="text-lg text-slate-600 dark:text-slate-400 leading-relaxed max-w-xl">
                                Empower your chatbot with proprietary data. Supply a URL to instantly scrape your documentation, or securely upload PDF manuals. Your custom vector database updates instantly.
                            </p>
                        </motion.div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-8">
                            <motion.div
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ duration: 0.5, delay: 0.2 }}
                                className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors"
                            >
                                <BrainCircuit className="w-8 h-8 text-indigo-500 mb-4" />
                                <h3 className="font-bold text-slate-900 dark:text-white mb-2">Semantic Chunking</h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400">Content is automatically segmented into optimal vectors for maximum retrieval accuracy.</p>
                            </motion.div>
                            <motion.div
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ duration: 0.5, delay: 0.3 }}
                                className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 hover:border-purple-300 dark:hover:border-purple-700 transition-colors"
                            >
                                <Database className="w-8 h-8 text-purple-500 mb-4" />
                                <h3 className="font-bold text-slate-900 dark:text-white mb-2">Isolated Storage</h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400">Your embeddings are stored in a secure Neon DB instance, protected by your Ironclad API key.</p>
                            </motion.div>
                        </div>
                    </div>

                    {/* Right Column: The Form Card */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.7, ease: "backOut", delay: 0.1 }}
                        className="flex-1 w-full max-w-lg lg:max-w-xl mx-auto lg:mx-0"
                    >
                        <div className="bg-white dark:bg-slate-900/90 backdrop-blur-2xl shadow-2xl rounded-3xl border border-slate-200/60 dark:border-slate-800/60 overflow-hidden relative">
                            {/* Decorative form highlight */}
                            <div className="absolute top-0 inset-x-0 h-1 bg-linear-to-r from-indigo-500 to-purple-500"></div>

                            <div className="p-8 sm:p-10 relative z-10">
                                <h2 className="text-2xl font-bold mb-8 text-slate-900 dark:text-white flex items-center gap-3">
                                    <div className="p-2 bg-indigo-100 dark:bg-indigo-900/50 rounded-lg">
                                        <UploadCloud className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                                    </div>
                                    Ingest Data
                                </h2>

                                <form onSubmit={handleTrain} className="space-y-6">
                                    {/* API Key Input */}
                                    <div>
                                        <label htmlFor="apiKey" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                                            Admin API Key <span className="text-red-500">*</span>
                                        </label>
                                        <div className="relative rounded-xl shadow-sm group">
                                            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                                <Key className="h-5 w-5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                                            </div>
                                            <input
                                                type={showApiKey ? "text" : "password"}
                                                id="apiKey"
                                                required
                                                value={apiKey}
                                                onChange={(e) => setApiKey(e.target.value)}
                                                className="block w-full pl-11 pr-12 py-3.5 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-all bg-slate-50 dark:bg-slate-950/50 text-slate-900 dark:text-white hover:bg-white dark:hover:bg-slate-900 focus:bg-white dark:focus:bg-slate-900"
                                                placeholder="sk_sapy_..."
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowApiKey(!showApiKey)}
                                                className="absolute inset-y-0 right-0 pr-3.5 flex justify-center items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors focus:outline-none"
                                            >
                                                {showApiKey ? (
                                                    <EyeOff className="h-5 w-5" />
                                                ) : (
                                                    <Eye className="h-5 w-5" />
                                                )}
                                            </button>
                                        </div>
                                    </div>

                                    <div className="relative py-2">
                                        <div className="absolute inset-0 flex items-center" aria-hidden="true">
                                            <div className="w-full border-t border-slate-200 dark:border-slate-800" />
                                        </div>
                                        <div className="relative flex justify-center">
                                            <span className="px-4 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest rounded-full border border-slate-200 dark:border-slate-800">
                                                Knowledge Sources
                                            </span>
                                        </div>
                                    </div>

                                    {/* URL Input */}
                                    <div>
                                        <label htmlFor="url" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                                            Website URL
                                        </label>
                                        <div className="relative rounded-xl shadow-sm group">
                                            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                                <LinkIcon className="h-5 w-5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                                            </div>
                                            <input
                                                type="url"
                                                id="url"
                                                value={url}
                                                onChange={(e) => setUrl(e.target.value)}
                                                className="block w-full pl-11 pr-4 py-3.5 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-all bg-slate-50 dark:bg-slate-950/50 text-slate-900 dark:text-white hover:bg-white dark:hover:bg-slate-900 focus:bg-white dark:focus:bg-slate-900"
                                                placeholder="https://docs.acmecorp.com"
                                            />
                                        </div>
                                    </div>

                                    {/* Custom File Dropzone */}
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2 flex justify-between">
                                            <span>PDF Document</span>
                                            <span className="text-slate-400 font-normal">Optional</span>
                                        </label>

                                        <AnimatePresence mode="wait">
                                            {!file ? (
                                                <motion.div
                                                    key="dropzone"
                                                    initial={{ opacity: 0 }}
                                                    animate={{ opacity: 1 }}
                                                    exit={{ opacity: 0 }}
                                                    className="mt-1 flex justify-center px-6 pt-7 pb-8 border-2 border-slate-300 dark:border-slate-700 border-dashed rounded-xl hover:border-indigo-500 dark:hover:border-indigo-400 hover:bg-indigo-50/50 dark:hover:bg-indigo-500/10 transition-all group cursor-pointer bg-slate-50 dark:bg-slate-950/30"
                                                    onClick={() => fileInputRef.current?.click()}
                                                >
                                                    <div className="space-y-2 text-center">
                                                        <FileText className="mx-auto h-10 w-10 text-slate-400 dark:text-slate-500 group-hover:text-indigo-500 dark:group-hover:text-indigo-400 transition-colors" />
                                                        <div className="flex text-sm text-slate-600 dark:text-slate-400 justify-center">
                                                            <span className="relative cursor-pointer rounded-md font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 focus-within:outline-none">
                                                                <span>Upload a file</span>
                                                                <input
                                                                    id="file-upload"
                                                                    name="file-upload"
                                                                    type="file"
                                                                    className="sr-only"
                                                                    accept=".pdf,application/pdf"
                                                                    onChange={handleFileChange}
                                                                    ref={fileInputRef}
                                                                />
                                                            </span>
                                                            <p className="pl-1">or drag and drop</p>
                                                        </div>
                                                        <p className="text-xs text-slate-500 dark:text-slate-500 font-medium">
                                                            PDF only (Max 10MB)
                                                        </p>
                                                    </div>
                                                </motion.div>
                                            ) : (
                                                <motion.div
                                                    key="file-ready"
                                                    initial={{ opacity: 0, scale: 0.95 }}
                                                    animate={{ opacity: 1, scale: 1 }}
                                                    exit={{ opacity: 0, scale: 0.95 }}
                                                    className="mt-1 flex items-center justify-between p-4 border border-indigo-200 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-900/20 rounded-xl"
                                                >
                                                    <div className="flex items-center space-x-4 overflow-hidden">
                                                        <div className="bg-indigo-100 dark:bg-indigo-800/60 p-2.5 rounded-lg shrink-0">
                                                            <FileText className="h-6 w-6 text-indigo-600 dark:text-indigo-300" />
                                                        </div>
                                                        <div className="min-w-0 flex-1">
                                                            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
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
                                                        className="ml-4 shrink-0 bg-white dark:bg-slate-800 p-2 rounded-full text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/20 focus:outline-none transition-colors border border-slate-200 dark:border-slate-700 shadow-sm"
                                                    >
                                                        <X className="h-4 w-4" />
                                                    </button>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>

                                    {/* Submit Button */}
                                    <div className="pt-6">
                                        <button
                                            type="submit"
                                            disabled={isLoading}
                                            className={`w-full flex justify-center py-4 px-4 border border-transparent rounded-xl shadow-lg text-base font-bold text-white bg-linear-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all transform active:scale-[0.98] ${isLoading ? 'opacity-80 cursor-not-allowed shadow-none' : 'hover:shadow-indigo-500/25'
                                                }`}
                                        >
                                            {isLoading ? (
                                                <>
                                                    <Loader2 className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" />
                                                    Ingesting Knowledge...
                                                </>
                                            ) : (
                                                'Initialize Training Sequence'
                                            )}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </motion.div>
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

export default Dashboard;
