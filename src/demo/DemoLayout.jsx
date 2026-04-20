import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useLocation, Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useClerk } from '@clerk/clerk-react';
import Logo from '../components/Logo';
import { isTrained, resetDemo } from './demoStorage';

const DEMO_NAV = [
    { label: 'My Bots',    icon: 'smart_toy',   path: '/demo/bots' },
    { label: 'Create Bot', icon: 'domain',       path: '/demo/register' },
    { label: 'Train AI',   icon: 'psychology',   path: '/demo/train' },
    { label: 'Insights',   icon: 'insights',     path: '/demo/insights' },
    { label: 'Customize',  icon: 'palette',      path: '/demo/customize' },
    { label: 'Chat',       icon: 'chat',         path: '/demo/chat' },
];

const PATH_LABELS = {
    '/demo/bots':      'My Bots',
    '/demo/register':  'Create Bot Identity',
    '/demo/train':     'Train AI',
    '/demo/insights':  'Insights Dashboard',
    '/demo/customize': 'Customize Bot',
    '/demo/chat':      'Live Chat Demo',
};

// ── Demo Banner ────────────────────────────────────────────────────────────────
const DemoBanner = () => {
    const { openSignUp } = useClerk();
    const navigate = useNavigate();
    const handleSignUp = () => {
        try {
            openSignUp({ afterSignUpUrl: '/app' });
        } catch {
            navigate('/');
        }
    };
    return (
        <div className="bg-amber-500 text-white text-center py-1.5 px-3 sm:px-4 h-8 flex items-center justify-center gap-1.5 sm:gap-2 shrink-0 z-50">
            <span className="material-symbols-outlined text-[14px] shrink-0">experiment</span>
            <span className="text-[9px] sm:text-[10px] uppercase tracking-widest font-bold font-sans truncate">
                Demo Mode — No data is saved
            </span>
            <button
                onClick={handleSignUp}
                className="hidden sm:inline-block shrink-0 ml-2 sm:ml-4 px-3 py-0.5 bg-white text-amber-700 text-[10px] uppercase tracking-widest font-bold font-sans hover:bg-amber-50 transition-colors"
            >
                Sign Up Free →
            </button>
        </div>
    );
};

// ── Sidebar item ───────────────────────────────────────────────────────────────
const SidebarItem = ({ label, icon, path, onClick, expanded, trained }) => {
    const isChatLocked = path === '/demo/chat' && !trained;
    return (
        <NavLink
            to={path}
            onClick={e => { if (isChatLocked) { e.preventDefault(); return; } onClick?.(); }}
            title={!expanded ? label : undefined}
            className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-2.5 text-md font-display transition-all min-h-[44px] border-l-2 w-full overflow-hidden ${
                    isChatLocked
                        ? 'border-transparent text-slate-300 dark:text-slate-600 cursor-not-allowed'
                        : isActive
                        ? 'border-slate-900 dark:border-slate-100 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-bold'
                        : 'border-transparent text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-slate-200'
                }`
            }
        >
            {({ isActive }) => (
                <>
                    <span className={`material-symbols-outlined text-[20px] shrink-0 ${
                        isChatLocked ? 'text-slate-300 dark:text-slate-600'
                        : isActive ? 'text-slate-900 dark:text-slate-100'
                        : 'text-slate-400 dark:text-slate-500'
                    }`}>
                        {isChatLocked ? 'lock' : icon}
                    </span>
                    <span className={`flex-1 truncate transition-all duration-200 ${expanded ? 'opacity-100 w-auto' : 'opacity-0 w-0 pointer-events-none'}`}>
                        {label}
                        {isChatLocked && <span className="ml-1 text-[9px] uppercase tracking-widest font-bold text-amber-500"> (train first)</span>}
                    </span>
                </>
            )}
        </NavLink>
    );
};

// ── Sidebar Content ────────────────────────────────────────────────────────────
const SidebarContent = ({ onClose, expanded = true }) => {
    const trained = isTrained();
    const navigate = useNavigate();

    const handleReset = () => {
        if (!window.confirm('Reset the demo? This clears all uploaded knowledge and chat history.')) return;
        resetDemo();
        navigate('/demo/train');
        onClose?.();
    };

    return (
        <div className="flex flex-col h-full bg-[#FAFAFA] dark:bg-slate-900 transition-colors duration-500">
            {onClose && (
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-slate-800 lg:hidden transition-colors">
                    <div />
                    <button onClick={onClose} className="p-2 hover:bg-white dark:hover:bg-slate-800 min-h-[44px] min-w-[44px] flex items-center justify-center transition-colors">
                        <span className="material-symbols-outlined text-[20px] text-slate-500 dark:text-slate-400">close</span>
                    </button>
                </div>
            )}
            <nav className="flex-1 overflow-y-auto py-2">
                {DEMO_NAV.map(item => (
                    <SidebarItem key={item.path} {...item} onClick={onClose} expanded={expanded} trained={trained} />
                ))}
            </nav>
            <div className="px-4 py-3 border-t border-gray-100 dark:border-slate-800 transition-colors overflow-hidden">
                <button
                    onClick={handleReset}
                    title={!expanded ? 'Reset Demo' : undefined}
                    className="flex items-center gap-3 w-full py-2 text-red-400 hover:text-red-600 dark:hover:text-red-400 transition-colors min-h-[44px]"
                >
                    <span className="material-symbols-outlined text-[20px] shrink-0">restart_alt</span>
                    <span className={`text-md font-sans font-bold uppercase tracking-widest transition-all duration-200 ${expanded ? 'opacity-100 w-auto' : 'opacity-0 w-0 pointer-events-none'}`}>
                        Reset Demo
                    </span>
                </button>
            </div>
        </div>
    );
};

// ── Top Navbar ─────────────────────────────────────────────────────────────────
const TopNav = ({ onMenuClick }) => {
    const { pathname } = useLocation();
    const pageLabel = PATH_LABELS[pathname] || 'Demo';
    return (
        <header className="fixed top-8 left-0 right-0 h-12 bg-white dark:bg-slate-950 border-b border-gray-100 dark:border-slate-800 flex items-center px-3 sm:px-4 gap-2 z-40 transition-colors duration-500">
            <div className="flex items-center gap-2 lg:w-[calc(256px-1rem)] shrink-0">
                <button
                    onClick={onMenuClick}
                    className="lg:hidden p-2 hover:bg-gray-50 dark:hover:bg-slate-800 min-h-[44px] min-w-[44px] flex items-center justify-center transition-colors"
                >
                    <span className="material-symbols-outlined text-[20px] text-slate-600 dark:text-slate-400">menu</span>
                </button>
                <Link to="/" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
                    <Logo className="h-5 w-auto" />
                    <span className="text-md uppercase tracking-widest font-bold text-slate-900 dark:text-slate-100 transition-colors">SaPyBase</span>
                </Link>
            </div>
            <div className="flex items-center gap-1.5 text-sm text-slate-500 min-w-0 flex-1 transition-colors">
                <div className="hidden sm:flex items-center gap-1.5 shrink-0 min-w-0">
                    <span className="material-symbols-outlined text-[16px] shrink-0 text-slate-400">chevron_right</span>
                    <span className="truncate max-w-[120px] text-slate-700 dark:text-slate-300 font-google">Demo Workspace</span>
                    <span className="shrink-0 px-1.5 py-0.5 border border-amber-200 dark:border-amber-800 text-[10px] uppercase tracking-widest font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20">
                        DEMO
                    </span>
                    <span className="material-symbols-outlined text-[16px] shrink-0 text-slate-400">chevron_right</span>
                </div>
                <span className="material-symbols-outlined text-[16px] shrink-0 sm:hidden text-slate-400">chevron_right</span>
                <span className="truncate min-w-0 text-slate-800 dark:text-slate-200 font-google text-md">{pageLabel}</span>
            </div>
        </header>
    );
};

// ── Demo Layout ────────────────────────────────────────────────────────────────
const DemoLayout = () => {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [sidebarExpanded, setSidebarExpanded] = useState(false);
    const { pathname } = useLocation();

    useEffect(() => { setSidebarOpen(false); }, [pathname]);
    useEffect(() => {
        document.body.style.overflow = sidebarOpen ? 'hidden' : '';
        return () => { document.body.style.overflow = ''; };
    }, [sidebarOpen]);

    return (
        <div className="flex w-full max-w-[100vw] min-h-screen bg-white dark:bg-slate-950 antialiased transition-colors duration-500 overflow-x-hidden">
            {/* sticky banner at very top */}
            <div className="fixed top-0 left-0 right-0 z-50">
                <DemoBanner />
            </div>

            <TopNav onMenuClick={() => setSidebarOpen(true)} />

            {/* Mobile sidebar overlay */}
            <AnimatePresence>
                {sidebarOpen && (
                    <div className="fixed inset-0 z-50 lg:hidden" style={{ top: '2rem' }}>
                        <motion.div
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                            onClick={() => setSidebarOpen(false)}
                        />
                        <motion.aside
                            initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }}
                            transition={{ type: 'spring', damping: 28, stiffness: 280, mass: 0.8 }}
                            className="absolute top-0 left-0 bottom-0 w-64 border-r border-gray-100 dark:border-slate-800"
                        >
                            <SidebarContent onClose={() => setSidebarOpen(false)} expanded={true} />
                        </motion.aside>
                    </div>
                )}
            </AnimatePresence>

            {/* Desktop sidebar */}
            <aside
                onMouseEnter={() => setSidebarExpanded(true)}
                onMouseLeave={() => setSidebarExpanded(false)}
                className={`hidden lg:flex lg:flex-col fixed left-0 bottom-0 border-r border-gray-100 dark:border-slate-800 z-30 bg-[#fafafa] dark:bg-slate-900 transition-all duration-300 ease-in-out ${sidebarExpanded ? 'w-64' : 'w-16'}`}
                style={{ top: '5rem' /* banner(2rem) + topnav(3rem) */ }}
            >
                <SidebarContent onClose={null} expanded={sidebarExpanded} />
            </aside>

            {/* Main content */}
            <main
                className={`flex-1 bg-white dark:bg-slate-950 flex flex-col overflow-x-hidden max-w-full transition-all duration-300 ease-in-out ${sidebarExpanded ? 'lg:ml-64' : 'lg:ml-16'}`}
                style={{ marginTop: '5rem' /* banner + topnav */ }}
            >
                <div className="flex-1 flex flex-col relative">
                    <Outlet />
                </div>
            </main>
        </div>
    );
};

export default DemoLayout;
