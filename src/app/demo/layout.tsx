'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useClerk } from '@clerk/nextjs';
import Link from 'next/link';
import Logo from '@/src/app/components/Logo';
import { isTrained, resetDemo } from '@/src/lib/demo/demoStorage';

const TOP_NAV = [
    { label: 'My Bots', icon: 'smart_toy', path: '/demo/bots' },
    { label: 'Create Bot', icon: 'domain', path: '/demo/register' },
    { label: 'Train AI', icon: 'psychology', path: '/demo/train' },
    { label: 'Insights', icon: 'insights', path: '/demo/insights' },
    { label: 'Chat', icon: 'chat', path: '/demo/chat' },
];

const SETTINGS_SUB = [
    { label: 'Customize Bot', icon: 'palette', path: '/demo/customize' },
];

const PATH_LABELS: Record<string, string> = {
    '/demo/bots': 'My Bots',
    '/demo/register': 'Create Bot Identity',
    '/demo/train': 'Train AI',
    '/demo/insights': 'Insights Dashboard',
    '/demo/customize': 'Customize Bot',
    '/demo/chat': 'Live Chat Demo',
};

const DemoBanner = () => {
    const { openSignUp } = useClerk();
    const router = useRouter();
    const handleSignUp = () => {
        try {
            openSignUp({ fallbackRedirectUrl: '/dashboard' });
        } catch {
            router.push('/');
        }
    };
    return (
        <div className="bg-amber-500 text-white text-center py-1.5 px-4 h-8 flex items-center justify-center gap-2 shrink-0 z-50">
            <span className="material-symbols-outlined text-[14px]">experiment</span>
            <span className="text-[10px] uppercase tracking-widest font-bold">Demo Mode — No data is saved</span>
            <button onClick={handleSignUp} className="ml-4 px-3 py-0.5 bg-white text-amber-700 text-[10px] uppercase tracking-widest font-bold hover:bg-amber-50">Sign Up Free →</button>
        </div>
    );
};

const SidebarItem = ({ label, icon, path, expanded, trained, onClick }: any) => {
    const pathname = usePathname();
    const isActive = pathname === path;
    const isChatLocked = path === '/demo/chat' && !trained;

    return (
        <Link
            href={isChatLocked ? '#' : path}
            onClick={onClick}
            title={!expanded ? label : undefined}
            className={`flex items-center gap-3 px-4 py-2.5 text-md font-display transition-all min-h-[44px] border-l-2 w-full overflow-hidden ${isChatLocked
                    ? 'border-transparent text-slate-300 dark:text-slate-600 cursor-not-allowed'
                    : isActive
                        ? 'border-slate-900 dark:border-slate-100 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-bold'
                        : 'border-transparent text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
        >
            <span className={`material-symbols-outlined text-[20px] shrink-0 ${isChatLocked ? 'text-slate-300 dark:text-slate-600'
                    : isActive ? 'text-slate-900 dark:text-slate-100'
                        : 'text-slate-400 dark:text-slate-500'
                }`}>{isChatLocked ? 'lock' : icon}</span>
            <span className={`flex-1 truncate transition-all duration-200 ${expanded ? 'opacity-100 w-auto' : 'opacity-0 w-0 pointer-events-none'}`}>
                {label}
                {isChatLocked && <span className="ml-1 text-[9px] uppercase tracking-widest font-bold text-amber-500"> (train first)</span>}
            </span>
        </Link>
    );
};

const SidebarContent = ({ onClose, expanded = true, trained, handleReset }: any) => {
    const pathname = usePathname();
    const onSettings = !!pathname && pathname.startsWith('/demo/customize');
    const [settingsOpen, setSettingsOpen] = useState(onSettings);

    useEffect(() => { if (onSettings) setSettingsOpen(true); }, [onSettings]);
    useEffect(() => { if (!expanded) setSettingsOpen(false); }, [expanded]);

    return (
        <div className="flex flex-col h-full bg-[#FAFAFA] dark:bg-slate-900 transition-colors duration-500">
            {/* Mobile close row */}
            {onClose && (
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-slate-800 lg:hidden transition-colors">
                    <div className="flex items-center gap-2" />
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-white dark:hover:bg-slate-800 min-h-[44px] min-w-[44px] flex items-center justify-center transition-colors"
                    >
                        <span className="material-symbols-outlined text-[20px] text-slate-500 dark:text-slate-400 transition-colors">close</span>
                    </button>
                </div>
            )}

            {/* Nav */}
            <nav className="flex-1 overflow-y-auto py-2">
                {TOP_NAV.map(item => (
                    <SidebarItem key={item.path} {...item} onClick={onClose} expanded={expanded} trained={trained} />
                ))}

                {/* Settings group */}
                <div>
                    <button
                        onClick={() => expanded && setSettingsOpen(p => !p)}
                        title={!expanded ? 'Settings' : undefined}
                        className={`flex items-center gap-3 px-4 py-2.5 text-md font-display transition-all min-h-[44px] border-l-2 w-full overflow-hidden ${onSettings
                                ? 'border-slate-900 dark:border-slate-100 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-bold'
                                : 'border-transparent text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-slate-200'
                            }`}
                    >
                        <span className={`material-symbols-outlined text-[20px] shrink-0 ${onSettings ? 'text-slate-900 dark:text-slate-100' : 'text-slate-400 dark:text-slate-500'}`}>
                            settings
                        </span>
                        <span className={`flex-1 text-left transition-all duration-200 ${expanded ? 'opacity-100 w-auto' : 'opacity-0 w-0 pointer-events-none'}`}>
                            Settings
                        </span>
                        <span className={`material-symbols-outlined text-[18px] text-slate-400 dark:text-slate-500 transition-all duration-200 ${settingsOpen ? 'rotate-180' : ''} ${expanded ? 'opacity-100' : 'opacity-0 w-0'}`}>
                            expand_more
                        </span>
                    </button>

                    <AnimatePresence>
                        {settingsOpen && expanded && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
                                style={{ overflow: 'hidden' }}
                            >
                                {SETTINGS_SUB.map(item => (
                                    <SidebarItem key={item.path} {...item} onClick={onClose} expanded={expanded} trained={trained} />
                                ))}

                                <button
                                    onClick={handleReset}
                                    className="flex items-center gap-2 pl-10 pr-4 py-2 text-sm font-display transition-colors min-h-[36px] border-l-2 w-full border-transparent text-red-400 hover:bg-white dark:hover:bg-slate-800 hover:text-red-600"
                                >
                                    <span className="material-symbols-outlined text-[18px] shrink-0">restart_alt</span>
                                    Reset Demo
                                </button>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </nav>

            {/* User footer */}
            <div className="px-4 py-3 border-t border-gray-100 dark:border-slate-800 flex items-center gap-2.5 min-h-[56px] bg-[#FAFAFA] dark:bg-slate-900 transition-colors duration-500 overflow-hidden">
                <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-white text-[10px] font-bold">JD</div>
                <div className={`flex-1 min-w-0 transition-all duration-200 ${expanded ? 'opacity-100 w-auto' : 'opacity-0 w-0 pointer-events-none'}`}>
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate transition-colors">
                        Jane Doe (Demo)
                    </p>
                    <p className="text-md uppercase tracking-widest font-bold text-slate-400 dark:text-slate-500 truncate transition-colors">
                        Guest Workspace
                    </p>
                </div>
            </div>
        </div>
    );
};

export default function DemoLayout({ children }: { children: React.ReactNode }) {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [sidebarExpanded, setSidebarExpanded] = useState(false);
    const [trained, setTrained] = useState(false);
    const pathname = usePathname();
    const router = useRouter();

    useEffect(() => {
        setTrained(isTrained());
    }, [pathname]);

    useEffect(() => { setSidebarOpen(false); }, [pathname]);

    const handleReset = () => {
        if (!confirm('Reset the demo?')) return;
        resetDemo();
        router.push('/demo/train');
    };

    const pageLabel = (pathname && PATH_LABELS[pathname]) || 'Demo Dashboard';

    return (
        <div className="flex min-h-screen bg-white dark:bg-slate-950 antialiased transition-colors duration-500">
            <div className="fixed top-0 left-0 right-0 z-70"><DemoBanner /></div>

            <header className="fixed top-8 left-0 right-0 h-12 bg-white dark:bg-slate-950 border-b border-gray-100 dark:border-slate-800 flex items-center px-4 gap-2 z-60 transition-colors duration-500">
                <div className="flex items-center gap-2 lg:w-[calc(256px-1rem)]">
                    <button
                        onClick={() => setSidebarOpen(true)}
                        className="lg:hidden p-2 hover:bg-gray-50 dark:hover:bg-slate-800 min-h-[44px] min-w-[44px] flex items-center justify-center transition-colors"
                        aria-label="Open menu"
                    >
                        <span className="material-symbols-outlined text-[20px] text-slate-600 dark:text-slate-400 transition-colors">menu</span>
                    </button>
                    <Link href="/" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
                        <Logo className="h-5 w-auto" />
                        <span className="text-md uppercase tracking-widest font-bold text-slate-900 dark:text-slate-100 transition-colors">Sapybase</span>
                    </Link>
                </div>

                {/* Breadcrumb */}
                <div className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-500 min-w-0 flex-1 transition-colors border-l border-gray-100 dark:border-slate-800 ml-2 pl-4">
                    <div className="hidden sm:flex items-center gap-1.5 min-w-0">
                        <span className="truncate max-w-[140px] text-slate-700 dark:text-slate-300 font-google transition-colors">
                            Jane Doe (Demo)
                        </span>
                        <span className="shrink-0 px-1.5 py-0.5 border border-gray-200 dark:border-slate-700 text-md uppercase tracking-widest font-bold text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900 transition-colors">
                            DEMO
                        </span>
                        <span className="material-symbols-outlined text-[16px] shrink-0 text-slate-400 dark:text-slate-600">chevron_right</span>
                    </div>
                    <span className="truncate text-slate-800 dark:text-slate-200 font-google text-md transition-colors">{pageLabel}</span>
                </div>
            </header>

            {/* Mobile sidebar overlay */}
            <AnimatePresence>
                {sidebarOpen && (
                    <div className="fixed inset-0 z-50 lg:hidden" style={{ top: '2rem' }} aria-modal="true">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                            onClick={() => setSidebarOpen(false)}
                        />
                        <motion.aside
                            initial={{ x: '-100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '-100%' }}
                            transition={{ type: 'spring', damping: 28, stiffness: 280, mass: 0.8 }}
                            className="absolute top-0 left-0 bottom-0 w-64 border-r border-gray-100 dark:border-slate-800 shadow-none transition-colors"
                        >
                            <SidebarContent onClose={() => setSidebarOpen(false)} expanded={true} trained={trained} handleReset={handleReset} />
                        </motion.aside>
                    </div>
                )}
            </AnimatePresence>

            {/* Desktop sidebar (hover-expand) */}
            <aside
                onMouseEnter={() => setSidebarExpanded(true)}
                onMouseLeave={() => setSidebarExpanded(false)}
                className={`hidden lg:flex lg:flex-col fixed left-0 bottom-0 border-r border-gray-100 dark:border-slate-800 z-30 bg-[#FAFAFA] dark:bg-slate-900 transition-all duration-300 ease-in-out ${sidebarExpanded ? 'w-64' : 'w-16'}`}
                style={{ top: '5rem' }}
            >
                <SidebarContent onClose={null} expanded={sidebarExpanded} trained={trained} handleReset={handleReset} />
            </aside>

            {/* Main content */}
            <main className={`flex-1 relative mt-12 min-h-[calc(100vh-3rem)] bg-white dark:bg-slate-950 flex flex-col transition-all duration-300 ease-in-out ${sidebarExpanded ? 'lg:ml-64' : 'lg:ml-16'}`} style={{ marginTop: '5rem' }}>
                <div className="flex-1 flex flex-col pt-0">
                    <Suspense fallback={null}>
                        <div className="flex-1 relative">{children}</div>
                    </Suspense>
                </div>

                {/* Demo Dashboard Footer */}
                <footer className="md:col-span-12 bg-white dark:bg-slate-950 py-4 px-8 md:px-10 border-t border-gray-100 dark:border-slate-800 flex flex-col md:flex-row justify-between items-center gap-6 mt-auto transition-colors duration-500">
                    <div className="flex flex-col md:flex-row items-center gap-6 text-sm uppercase tracking-widest font-bold text-slate-600 dark:text-slate-400 font-sans">
                        <p className="text-center">© 2026 Sapybase LLC — ENGINEERED WITH PRECISION.</p>
                        <div className="hidden md:block h-px w-6 bg-gray-200 dark:bg-slate-800" />
                        <div className="flex gap-6">
                            <Link href="/privacy-policy" className="hover:text-slate-900 dark:hover:text-slate-200 transition-colors">PRIVACY</Link>
                            <Link href="/terms-and-conditions" className="hover:text-slate-900 dark:hover:text-slate-200 transition-colors">TERMS</Link>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="material-symbols-outlined text-[16px] text-emerald-500">browse_activity</span>
                        <span className="text-sm uppercase tracking-widest font-bold text-slate-900 dark:text-slate-200 font-sans">
                            Status: <span className="text-emerald-600 font-bold">Demo Live</span>
                        </span>
                    </div>
                </footer>
            </main>
        </div>
    );
}
