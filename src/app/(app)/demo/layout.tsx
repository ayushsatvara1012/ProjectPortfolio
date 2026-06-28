'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useClerk } from '@clerk/nextjs';
import Link from 'next/link';
import VaayuLogo from '@/src/components/ui/VaayuLogo';
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



const SidebarItem = ({ label, icon: iconName, path, expanded, trained, onClick }: any) => {
    const pathname = usePathname();
    const isActive = pathname === path;
    const isChatLocked = path === '/demo/chat' && !trained;

    return (
        <Link
            href={isChatLocked ? '#' : path}
            onClick={isChatLocked ? undefined : onClick}
            title={!expanded ? label : undefined}
            className={`flex items-center gap-3 px-3 py-2 text-sm tracking-normal font-display font-medium transition-all min-h-[38px] w-full overflow-hidden rounded-lg ${isChatLocked
                ? 'text-slate-400 dark:text-slate-600 cursor-not-allowed'
                : isActive
                    ? 'bg-slate-100 dark:bg-slate-900 text-slate-900 dark:text-slate-100'
                    : 'text-slate-800 dark:text-slate-200 hover:bg-slate-100/50 dark:hover:bg-slate-900/30'
                }`}
        >
            <span className={`material-symbols-outlined text-sm shrink-0 ${isChatLocked ? 'text-slate-300 dark:text-slate-600'
                : isActive ? 'text-slate-900 dark:text-slate-100'
                    : 'text-slate-600 dark:text-slate-400'
                }`}>{isChatLocked ? 'lock' : iconName}</span>
            <span className={`flex-1 truncate transition-all duration-200 ${expanded ? 'opacity-100 w-auto' : 'opacity-0 w-0 pointer-events-none'}`}>
                {label}
                {isChatLocked && <span className="ml-1.5 px-1.5 py-0.5 text-[9px] uppercase tracking-widest font-bold bg-amber-500/10 text-amber-500 rounded-full">lock</span>}
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
        <div className="flex flex-col h-full bg-[#f8f9fa] dark:bg-slate-950 transition-colors duration-500">
            {/* Mobile close row */}
            {onClose && (
                <div className="flex items-center justify-between px-4 py-3 lg:hidden transition-colors">
                    <div className="flex items-center gap-2" />
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-slate-900 min-h-[44px] min-w-[44px] flex items-center justify-center transition-colors"
                    >
                        <span className="material-symbols-outlined text-[20px] text-slate-500 dark:text-slate-400 transition-colors">close</span>
                    </button>
                </div>
            )}

            {/* Nav */}
            <nav className="flex-1 overflow-y-auto py-2 px-2 flex flex-col gap-0.5">
                {TOP_NAV.map(item => (
                    <SidebarItem key={item.path} {...item} onClick={onClose} expanded={expanded} trained={trained} />
                ))}

                {/* Settings group */}
                <div>
                    <button
                        onClick={(e) => { e.stopPropagation(); expanded && setSettingsOpen(p => !p); }}
                        title={!expanded ? 'Settings' : undefined}
                        className={`flex items-center gap-3 px-3 py-2 text-sm font-display font-medium transition-all min-h-[38px] w-full overflow-hidden rounded-lg ${onSettings
                            ? 'bg-slate-100 dark:bg-slate-900 text-slate-900 dark:text-slate-100'
                            : 'text-slate-800 dark:text-slate-200 hover:bg-slate-100/50 dark:hover:bg-slate-900/30'
                            }`}
                    >
                        <span className={`material-symbols-outlined text-sm shrink-0 ${onSettings ? 'text-slate-900 dark:text-slate-100' : 'text-slate-600 dark:text-slate-400'}`}>
                            settings
                        </span>
                        <span className={`flex-1 text-left transition-all duration-200 ${expanded ? 'opacity-100 w-auto' : 'opacity-0 w-0 pointer-events-none'}`}>
                            Settings
                        </span>
                        <span className={`material-symbols-outlined text-[16px] text-slate-400 dark:text-slate-500 transition-all duration-200 ${settingsOpen ? 'rotate-180' : ''} ${expanded ? 'opacity-100' : 'opacity-0 w-0'}`}>
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
                                className="ml-[21px] pl-3 py-1 flex flex-col gap-0.5 my-0.5 border-l border-slate-200 dark:border-slate-800"
                            >
                                {SETTINGS_SUB.map(item => {
                                    const isActive = pathname === item.path;
                                    return (
                                        <Link
                                            key={item.path}
                                            href={item.path}
                                            onClick={(e) => { e.stopPropagation(); onClose?.(); }}
                                            className={`flex items-center gap-2 px-3 py-1.5 text-sm font-display font-medium transition-colors min-h-[32px] w-full rounded-md ${isActive
                                                ? 'bg-slate-100 dark:bg-slate-900 text-slate-900 dark:text-slate-100'
                                                : 'text-slate-800 dark:text-slate-200 hover:bg-slate-100/30 dark:hover:bg-slate-900/10'
                                                }`}
                                        >
                                            <span className="material-symbols-outlined text-sm shrink-0">{item.icon}</span>
                                            {item.label}
                                        </Link>
                                    );
                                })}

                                <button
                                    onClick={(e) => { e.stopPropagation(); handleReset(); }}
                                    className="flex items-center gap-2 px-3 py-1.5 text-sm font-display font-medium transition-colors min-h-[32px] w-full rounded-md text-red-500 dark:text-red-400 hover:bg-red-50/50 dark:hover:bg-red-500/[0.04]"
                                >
                                    <span className="material-symbols-outlined text-sm shrink-0">restart_alt</span>
                                    Reset Demo
                                </button>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </nav>

            {/* Back to Sapybase home */}
            <div className="px-2 py-1 border-t border-slate-200/50 dark:border-slate-800/50">
                <SidebarItem
                    label="Back to Sapybase"
                    icon="home"
                    path="/"
                    onClick={onClose}
                    expanded={expanded}
                    trained={trained}
                />
            </div>

            {/* User footer */}
            <div className="px-5 py-4 border-t border-slate-200/50 dark:border-slate-800/50 flex items-center gap-3 min-h-[64px] bg-[#f8f9fa] dark:bg-slate-950 transition-colors duration-500 overflow-hidden">
                <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-white text-[10px] font-bold shrink-0">JD</div>
                <div className={`flex-1 min-w-0 transition-all duration-200 ${expanded ? 'opacity-100 w-auto' : 'opacity-0 w-0 pointer-events-none'}`}>
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate transition-colors">
                        Jane Doe (Demo)
                    </p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 truncate transition-colors mt-0.5">
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
    const { openSignUp } = useClerk();

    const handleSignUp = () => {
        try {
            openSignUp({ fallbackRedirectUrl: '/dashboard' });
        } catch {
            router.push('/');
        }
    };

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
    const isFullHeightPane = pathname === '/demo/customize' || pathname === '/demo/insights';

    return (
        <div className="flex min-h-screen w-full overflow-x-hidden bg-[#f8f9fa] dark:bg-slate-950 antialiased transition-colors duration-500">
            <header className="fixed top-0 left-0 right-0 h-14 bg-[#f8f9fa] dark:bg-slate-950 flex items-center px-4 gap-2 z-60 transition-colors duration-500">
                <div className="flex items-center gap-2 lg:w-12">
                    <button
                        onClick={() => setSidebarOpen(true)}
                        className="lg:hidden p-2 hover:bg-gray-100 dark:hover:bg-slate-900 min-h-[44px] min-w-[44px] flex items-center justify-center transition-colors"
                        aria-label="Open menu"
                    >
                        <span className="material-symbols-outlined text-[20px] text-slate-600 dark:text-slate-400 transition-colors">menu</span>
                    </button>
                    <Link href="/" aria-label="Vaayu home" className="flex items-center hover:opacity-80 transition-opacity">
                        <VaayuLogo iconOnly size={26} className="text-slate-900 dark:text-slate-100" />
                    </Link>
                </div>

                {/* Breadcrumb */}
                <div className="flex items-center gap-1.5 text-[13px] text-slate-500 dark:text-slate-500 min-w-0 flex-1 transition-colors">
                    <div className="hidden sm:flex items-center gap-1.5 min-w-0">
                        <span className="truncate max-w-[140px] text-slate-600 dark:text-slate-400 font-google text-[13px] transition-colors">
                            Jane Doe (Demo)
                        </span>
                        <span className="shrink-0 px-2 py-0.5 text-xs font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 rounded-full transition-colors">
                            DEMO
                        </span>
                        <span className="material-symbols-outlined text-[16px] shrink-0 text-slate-400 dark:text-slate-600">chevron_right</span>
                    </div>
                    <span className="truncate text-slate-800 dark:text-slate-200 font-google text-[13px] font-medium transition-colors">{pageLabel}</span>
                </div>

                {/* Demo Mode indicator & Sign Up Button */}
                <div className="flex items-center gap-3 shrink-0 ml-auto mr-2">
                    <div className="hidden md:flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 rounded-full border border-amber-500/20">
                        <span className="material-symbols-outlined text-[16px]">experiment</span>
                        <span className="text-[10px] uppercase tracking-widest font-bold">Demo Mode — No data is saved</span>
                    </div>
                    <button
                        onClick={handleSignUp}
                        className="px-4 py-1.5 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white text-[11px] uppercase tracking-widest font-bold rounded-lg shadow-sm hover:shadow-md transition-all duration-200"
                    >
                        Sign Up Free →
                    </button>
                </div>
            </header>

            {/* Mobile sidebar overlay */}
            <AnimatePresence>
                {sidebarOpen && (
                    <div className="fixed inset-0 z-50 lg:hidden" aria-modal="true">
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
                            className="absolute top-0 left-0 bottom-0 w-64 shadow-none transition-colors"
                        >
                            <SidebarContent onClose={() => setSidebarOpen(false)} expanded={true} trained={trained} handleReset={handleReset} />
                        </motion.aside>
                    </div>
                )}
            </AnimatePresence>

            {/* Desktop sidebar */}
            <aside
                onMouseEnter={() => setSidebarExpanded(true)}
                onMouseLeave={() => setSidebarExpanded(false)}
                className={`hidden lg:flex lg:flex-col fixed top-14 left-0 bottom-0 z-30 bg-[#f8f9fa] dark:bg-slate-950 transition-all duration-300 ease-in-out ${sidebarExpanded ? 'w-64' : 'w-16'}`}
            >
                <SidebarContent onClose={null} expanded={sidebarExpanded} trained={trained} handleReset={handleReset} />
            </aside>

            {/* Main content */}
            <main className={`flex-1 relative mt-14 min-w-0 overflow-x-hidden bg-[#f8f9fa] dark:bg-slate-950 flex flex-col transition-all duration-300 ease-in-out ${sidebarExpanded ? 'lg:ml-64' : 'lg:ml-16'} ${isFullHeightPane ? 'lg:h-[calc(100vh-3.5rem)] lg:min-h-0 lg:overflow-hidden' : 'min-h-[calc(100vh-3.5rem)]'}`}>
                <div className={`flex-1 flex flex-col pt-0 ${isFullHeightPane ? 'lg:min-h-0 lg:overflow-hidden' : ''}`}>
                    <Suspense fallback={null}>
                        <div className={`flex-1 relative ${isFullHeightPane ? 'flex flex-col lg:min-h-0 lg:overflow-hidden' : ''}`}>{children}</div>
                    </Suspense>
                </div>

                {/* Bottom spacer — matches the dashboard shell (footer text removed) */}
                {!isFullHeightPane && <footer aria-hidden="true" className="bg-[#f8f9fa] dark:bg-slate-950 py-4 mt-auto transition-colors duration-500" />}
            </main>
        </div>
    );
}
