'use client';

import React, { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useClerk } from '@clerk/nextjs';
import Link from 'next/link';
import Logo from '@/src/app/components/Logo';
import { isTrained, resetDemo } from '@/src/lib/demo/demoStorage';

const DEMO_NAV = [
    { label: 'My Bots',    icon: 'smart_toy',   path: '/demo/bots' },
    { label: 'Create Bot', icon: 'domain',       path: '/demo/register' },
    { label: 'Train AI',   icon: 'psychology',   path: '/demo/train' },
    { label: 'Insights',   icon: 'insights',     path: '/demo/insights' },
    { label: 'Customize',  icon: 'palette',      path: '/demo/customize' },
    { label: 'Chat',       icon: 'chat',         path: '/demo/chat' },
];

const PATH_LABELS: Record<string, string> = {
    '/demo/bots':      'My Bots',
    '/demo/register':  'Create Bot Identity',
    '/demo/train':     'Train AI',
    '/demo/insights':  'Insights Dashboard',
    '/demo/customize': 'Customize Bot',
    '/demo/chat':      'Live Chat Demo',
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

const SidebarItem = ({ label, icon, path, expanded, trained }: any) => {
    const pathname = usePathname();
    const isActive = pathname === path;
    const isChatLocked = path === '/demo/chat' && !trained;

    return (
        <Link
            href={isChatLocked ? '#' : path}
            title={!expanded ? label : undefined}
            className={`flex items-center gap-3 px-4 py-2.5 text-sm transition-all min-h-[44px] border-l-2 w-full overflow-hidden ${
                isChatLocked
                    ? 'border-transparent text-slate-300 dark:text-slate-600 cursor-not-allowed'
                    : isActive
                    ? 'border-slate-900 dark:border-slate-100 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-bold'
                    : 'border-transparent text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
        >
            <span className={`material-symbols-outlined text-[20px] shrink-0 ${
                isChatLocked ? 'text-slate-300 dark:text-slate-600'
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

export default function DemoLayout({ children }: { children: React.ReactNode }) {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [sidebarExpanded, setSidebarExpanded] = useState(false);
    const pathname = usePathname();
    const router = useRouter();
    const trained = isTrained();

    useEffect(() => { setSidebarOpen(false); }, [pathname]);

    const handleReset = () => {
        if (!confirm('Reset the demo?')) return;
        resetDemo();
        router.push('/demo/train');
    };

    return (
        <div className="flex w-full min-h-screen bg-white dark:bg-slate-950 antialiased overflow-x-hidden">
            <div className="fixed top-0 left-0 right-0 z-50"><DemoBanner /></div>
            
            <header className="fixed top-8 left-0 right-0 h-12 bg-white dark:bg-slate-950 border-b border-gray-100 dark:border-slate-800 flex items-center px-4 gap-4 z-40">
                <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2 hover:bg-gray-50 dark:hover:bg-slate-800 min-h-[44px] min-w-[44px] flex items-center justify-center transition-colors"><span className="material-symbols-outlined text-[20px] text-slate-600 dark:text-slate-400">menu</span></button>
                <Link href="/" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
                    <Logo className="h-5 w-auto" />
                    <span className="text-md uppercase tracking-widest font-bold text-slate-900 dark:text-slate-100 transition-colors">SaPyBase</span>
                </Link>
                <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-500 text-sm">
                    <span className="material-symbols-outlined text-[16px]">chevron_right</span>
                    <span className="font-bold text-slate-900 dark:text-slate-200">{PATH_LABELS[pathname] || 'Demo'}</span>
                </div>
            </header>

            <aside
                onMouseEnter={() => setSidebarExpanded(true)}
                onMouseLeave={() => setSidebarExpanded(false)}
                className={`hidden lg:flex flex-col fixed left-0 bottom-0 border-r border-gray-100 dark:border-slate-800 bg-[#FAFAFA] dark:bg-slate-900 transition-all duration-300 ${sidebarExpanded ? 'w-64' : 'w-16'}`}
                style={{ top: '5rem' }}
            >
                <nav className="flex-1 overflow-y-auto py-2">
                    {DEMO_NAV.map(item => <SidebarItem key={item.path} {...item} expanded={sidebarExpanded} trained={trained} />)}
                </nav>
                <div className="px-4 py-3 border-t border-gray-100 dark:border-slate-800 overflow-hidden">
                    <button
                        onClick={handleReset}
                        title={!sidebarExpanded ? 'Reset Demo' : undefined}
                        className="flex items-center gap-3 w-full py-2 text-red-400 hover:text-red-600 dark:hover:text-red-400 transition-colors min-h-[44px]"
                    >
                        <span className="material-symbols-outlined text-[20px] shrink-0">restart_alt</span>
                        <span className={`text-xs font-bold uppercase tracking-widest transition-all duration-200 ${sidebarExpanded ? 'opacity-100 w-auto' : 'opacity-0 w-0 pointer-events-none'}`}>Reset Demo</span>
                    </button>
                </div>
            </aside>

            <main className={`flex-1 flex flex-col transition-all duration-300 ${sidebarExpanded ? 'lg:ml-64' : 'lg:ml-16'}`} style={{ marginTop: '5rem' }}>
                <div className="flex-1 relative p-8">{children}</div>
            </main>

            <AnimatePresence>
                {sidebarOpen && (
                    <div className="fixed inset-0 z-50 lg:hidden" style={{ top: '2rem' }}>
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
                        <motion.aside initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }} className="absolute top-0 left-0 bottom-0 w-64 bg-[#FAFAFA] dark:bg-slate-900 border-r border-gray-100 dark:border-slate-800">
                           <nav className="py-4">
                               {DEMO_NAV.map(item => <SidebarItem key={item.path} {...item} expanded={true} trained={trained} />)}
                           </nav>
                        </motion.aside>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
