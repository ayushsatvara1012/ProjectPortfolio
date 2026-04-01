import React, { useState } from 'react';
import { Copy, CheckCircle, Code2, Globe, Laptop } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const BotIntegrationDocs = ({ apiKey, apiUrl = 'https://sapyai.onrender.com' }) => {
    const [activeTab, setActiveTab] = useState('vanilla'); // 'vanilla' or 'react'
    const [copiedStates, setCopiedStates] = useState({});

    const handleCopy = (id, text) => {
        navigator.clipboard.writeText(text);
        setCopiedStates(prev => ({ ...prev, [id]: true }));
        setTimeout(() => {
            setCopiedStates(prev => ({ ...prev, [id]: false }));
        }, 2000);
    };

    const vanillaSnippet = `<script>
  window.SaPyBaseConfig = {
    apiKey: "${apiKey}",
    apiUrl: "${apiUrl}"
  };
</script>
<script src="https://www.sapybase.com/widget.js" defer></script>`;

    const reactSnippet = `// app/layout.tsx
import Script from 'next/script';

declare global {
  interface Window {
    SaPyBaseConfig?: { apiKey?: string; apiUrl?: string; };
  }
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <Script id="sapybase-config" strategy="beforeInteractive">
          {\`window.SaPyBaseConfig = { apiKey: "${apiKey}", apiUrl: "${apiUrl}" };\`}
        </Script>
        <Script src="https://www.sapybase.com/widget.js" strategy="lazyOnload" />
      </body>
    </html>
  );
}`;

    const tabs = [
        { id: 'vanilla', label: 'Vanilla HTML', icon: Globe },
        { id: 'react', label: 'Next.js / React', icon: Laptop },
    ];

    return (
        <div className="bg-white border border-gray-200 shadow-sm rounded-xl p-6 transition-all duration-300">
            <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-indigo-50 rounded-lg">
                    <Code2 className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                    <h3 className="text-lg font-display font-bold text-slate-900">Integration Guide</h3>
                    <p className="text-sm font-sans text-slate-500 font-medium">Follow these steps to embed the chatbot on your site.</p>
                </div>
            </div>

            {/* Tab Swticher */}
            <div className="flex p-1 bg-slate-100 rounded-lg mb-6 w-fit">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-2 px-4 py-2 text-sm font-sans font-bold transition-all duration-200 rounded-md ${
                            activeTab === tab.id
                                ? 'bg-white text-indigo-600 shadow-sm'
                                : 'text-slate-500 hover:text-slate-700'
                        }`}
                    >
                        <tab.icon className="w-4 h-4" />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Code Content */}
            <AnimatePresence mode="wait">
                <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                    className="relative"
                >
                    <div className="absolute top-4 right-4 z-10">
                        <button
                            onClick={() => handleCopy(activeTab, activeTab === 'vanilla' ? vanillaSnippet : reactSnippet)}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-md border text-xs font-sans font-bold transition-all duration-200 ${
                                copiedStates[activeTab]
                                    ? 'bg-emerald-50 border-emerald-200 text-emerald-600'
                                    : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                            }`}
                        >
                            {copiedStates[activeTab] ? (
                                <>
                                    <CheckCircle className="w-3.5 h-3.5" />
                                    Copied!
                                </>
                            ) : (
                                <>
                                    <Copy className="w-3.5 h-3.5" />
                                    Copy
                                </>
                            )}
                        </button>
                    </div>

                    <div className="group relative">
                        <div className="absolute -inset-2 bg-gradient-to-r from-indigo-500/20 to-purple-500/20 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity blur-xl" />
                        <pre className="relative p-6 bg-slate-900 rounded-xl overflow-x-auto text-sm font-mono leading-relaxed custom-scrollbar border border-slate-800">
                            <code className="text-slate-50">
                                {activeTab === 'vanilla' ? vanillaSnippet : reactSnippet}
                            </code>
                        </pre>
                    </div>
                </motion.div>
            </AnimatePresence>

            <div className="mt-6 flex flex-col gap-3">
                <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-100 rounded-lg">
                    <div className="mt-0.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                    </div>
                    <p className="text-sm font-sans text-amber-800 font-medium leading-relaxed">
                        Ensure your <span className="font-bold underline">Allowed Origin</span> in Tenant Config exactly matches the URL where the widget is deployed (e.g., <code className="bg-amber-100 px-1 rounded">https://example.com</code>).
                    </p>
                </div>
            </div>
        </div>
    );
};

export default BotIntegrationDocs;
