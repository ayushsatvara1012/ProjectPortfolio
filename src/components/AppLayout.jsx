import React, { useState, useEffect, Suspense } from 'react';
import { NavLink, Outlet, useLocation, Link } from 'react-router-dom';
import { UserButton, useUser } from '@clerk/clerk-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Bot, BrainCircuit, CreditCard, Settings, Building2,
    ChevronRight, User, Palette, KeyRound,
    ChevronDown, Menu, X, ShieldCheck
} from 'lucide-react';
import Logo from './Logo';
import { BotSettingsProvider } from '../context/BotSettingsContext';
import FloatingBotWidget from './FloatingBotWidget';
import { useUserRole } from '../context/UserContext';

const SETTINGS_SUB = [
    { label: 'Account', icon: User, path: '/app/settings/account' },
    { label: 'Billing', icon: CreditCard, path: '/app/settings/billing' },
    { label: 'Customize', icon: Palette, path: '/app/settings/customize' },
    { label: 'API Keys', icon: KeyRound, path: '/app/settings/apikeys' },
];

const TOP_NAV = [
    { label: 'My Bots',      icon: Bot,         path: '/app/bots' },
    { label: 'Bot Identity', icon: Building2,    path: '/app/register' },
    { label: 'Train AI',     icon: BrainCircuit, path: '/app/train' },
    { label: 'Pricing',      icon: CreditCard,   path: '/app/pricing' },
];

const PATH_LABELS = {
    '/app/bots': 'My Bots',
    '/app/register': 'Bot Identity',
    '/app/train': 'Train AI',
    '/app/pricing': 'Pricing',
    '/app/settings/account': 'Account',
    '/app/settings/billing': 'Billing',
    '/app/settings/customize': 'Customize',
    '/app/settings/apikeys': 'API Keys',
    '/app/settings/admin': 'Super Admin',
};

const TIER_LABEL = { FREE: 'Free', BASIC: 'Basic', STARTER: 'Starter', PRO: 'Pro' };

// ── Sidebar nav item (sharp left-border active state) ─────────────────────────
const SidebarItem = ({ label, icon: Icon, path, onClick }) => (
    <NavLink
        to={path}
        onClick={onClick}
        className={({ isActive }) =>
            `flex items-center gap-3 px-4 py-2.5 text-md font-display transition-colors min-h-[44px] border-l-2 w-full ${isActive
                ? 'border-slate-900 dark:border-slate-100 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-bold'
                : 'border-transparent text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-slate-200'
            }`
        }
    >
        {({ isActive }) => (
            <>
                <Icon className={`w-5 h-5 shrink-0 ${isActive ? 'text-slate-900 dark:text-slate-100' : 'text-slate-400 dark:text-slate-500'}`} />
                <span className="flex-1 truncate">{label}</span>
            </>
        )}
    </NavLink>
);

// ── Sidebar content ───────────────────────────────────────────────────────────
const SidebarContent = ({ user, onClose }) => {
    const { userRole } = useUserRole();
    const { pathname } = useLocation();
    const onSettings = pathname.startsWith('/app/settings');
    const [settingsOpen, setSettingsOpen] = useState(onSettings);

    useEffect(() => { if (onSettings) setSettingsOpen(true); }, [onSettings]);

    return (
        <div className="flex flex-col h-full bg-[#FAFAFA] dark:bg-slate-900 transition-colors duration-500">
            {/* Mobile close row */}
            {onClose && (
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-slate-800 lg:hidden transition-colors">
                    <div className="flex items-center gap-2" />
                    <button onClick={onClose} className="p-2 hover:bg-white dark:hover:bg-slate-800 min-h-[44px] min-w-[44px] flex items-center justify-center transition-colors">
                        <X className="w-5 h-5 text-slate-500 dark:text-slate-400 transition-colors" />
                    </button>
                </div>
            )}



            {/* Nav */}
            <nav className="flex-1 overflow-y-auto py-2">
                {TOP_NAV.map(item => (
                    <SidebarItem key={item.path} {...item} onClick={onClose} />
                ))}

                {/* Settings group */}
                <div>
                    <button
                        onClick={() => setSettingsOpen(p => !p)}
                        className={`flex items-center gap-3 px-4 py-2.5 text-md font-display transition-colors min-h-[44px] border-l-2 w-full ${onSettings
                            ? 'border-slate-900 dark:border-slate-100 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-bold'
                            : 'border-transparent text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-slate-200'
                            }`}
                    >
                        <Settings className={`w-5 h-5 shrink-0 ${onSettings ? 'text-slate-900 dark:text-slate-100' : 'text-slate-400 dark:text-slate-500'}`} />
                        <span className="flex-1 text-left">Settings</span>
                        <ChevronDown className={`w-3.5 h-3.5 text-slate-400 dark:text-slate-500 transition-transform ${settingsOpen ? 'rotate-180' : ''}`} />
                    </button>

                    <AnimatePresence>
                        {settingsOpen && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
                                style={{ overflow: 'hidden' }}
                            >
                                {SETTINGS_SUB.map(item => (
                                    <NavLink
                                        key={item.path}
                                        to={item.path}
                                        onClick={onClose}
                                        className={({ isActive }) =>
                                            `flex items-center gap-2 pl-10 pr-4 py-2 text-sm font-display transition-colors min-h-[36px] border-l-2 w-full ${isActive
                                                ? 'border-slate-900 dark:border-slate-100 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-semibold'
                                                : 'border-transparent text-slate-500 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-300'
                                            }`
                                        }
                                    >
                                        <item.icon className="w-3.5 h-3.5 shrink-0" />
                                        {item.label}
                                    </NavLink>
                                ))}

                                {/* Super Admin child — guarded by role */}
                                {userRole === 'SUPER_ADMIN' && (
                                    <NavLink
                                        to="/app/settings/admin"
                                        onClick={onClose}
                                        className={({ isActive }) =>
                                            `flex items-center gap-2 pl-10 pr-4 py-2 text-sm font-display transition-colors min-h-[36px] border-l-2 w-full ${isActive
                                                ? 'border-slate-900 dark:border-slate-100 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-semibold'
                                                : 'border-transparent text-slate-400 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-300'
                                            }`
                                        }
                                    >
                                        <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                                        Super Admin
                                    </NavLink>
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </nav>

            {/* User footer */}
            <div className="px-4 py-3 border-t border-gray-100 dark:border-slate-800 flex items-center gap-2.5 min-h-[56px] bg-[#FAFAFA] dark:bg-slate-900 transition-colors duration-500">
                <UserButton appearance={{ elements: { avatarBox: 'w-7 h-7' } }} />
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate transition-colors">
                        {user?.fullName || user?.firstName || 'My Account'}
                    </p>
                    <p className="text-md uppercase tracking-widest font-bold text-slate-400 dark:text-slate-500 truncate transition-colors">Profile &amp; Billing</p>
                </div>
            </div>
        </div>
    );
};

// ── Top Navbar ────────────────────────────────────────────────────────────────
const TopNav = ({ user, onMenuClick }) => {
    const { pathname } = useLocation();
    const pageLabel = PATH_LABELS[pathname] || 'Dashboard';
    const { userTier } = useUserRole();
    const tierLabel = userTier ? TIER_LABEL[userTier] ?? userTier : null;

    return (
        <header className="fixed top-0 left-0 right-0 h-12 bg-white dark:bg-slate-950 border-b border-gray-100 dark:border-slate-800 flex items-center px-4 gap-2 z-40 transition-colors duration-500">
            {/* Left section: Hamburger (mobile) + Brand (all) */}
            <div className="flex items-center gap-2 lg:w-[calc(208px-1rem)]">
                <button
                    onClick={onMenuClick}
                    className="lg:hidden p-2 hover:bg-gray-50 dark:hover:bg-slate-800 min-h-[44px] min-w-[44px] flex items-center justify-center transition-colors"
                    aria-label="Open menu"
                >
                    <Menu className="w-5 h-5 text-slate-600 dark:text-slate-400 transition-colors" />
                </button>
                <Link to="/" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
                    <Logo className="h-5 w-auto" />
                    <span className="text-md uppercase tracking-widest font-bold text-slate-900 dark:text-slate-100 transition-colors">SaPyBase</span>
                </Link>
            </div>

            {/* Breadcrumb */}
            <div className="flex items-center gap-1.5 text-md text-slate-400 dark:text-slate-500 min-w-0 flex-1 transition-colors">
                <ChevronRight className="w-3.5 h-3.5 shrink-0 hidden sm:block text-slate-300 dark:text-slate-600 transition-colors" />
                <span className="truncate max-w-[140px] text-slate-700 dark:text-slate-300 font-medium hidden sm:block transition-colors">
                    {user?.fullName || user?.firstName || 'My Workspace'}
                </span>
                {tierLabel && (
                    <span className="hidden sm:inline-flex shrink-0 px-1.5 py-0.5 border border-gray-200 dark:border-slate-700 text-md uppercase tracking-widest font-bold text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900 transition-colors">
                        {tierLabel}
                    </span>
                )}
                <ChevronRight className="w-3.5 h-3.5 shrink-0 hidden sm:block text-slate-300 dark:text-slate-600 transition-colors" />
                <span className="truncate text-slate-800 dark:text-slate-200 font-medium text-md transition-colors">{pageLabel}</span>
            </div>
        </header>
    );
};

// ── App Layout ────────────────────────────────────────────────────────────────
const AppLayout = () => {
    const { user } = useUser();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const { pathname } = useLocation();

    useEffect(() => { setSidebarOpen(false); }, [pathname]);
    useEffect(() => {
        document.body.style.overflow = sidebarOpen ? 'hidden' : '';
        return () => { document.body.style.overflow = ''; };
    }, [sidebarOpen]);

    return (
        <BotSettingsProvider>
            <div className="flex min-h-screen bg-white dark:bg-slate-950 antialiased transition-colors duration-500">

                <TopNav user={user} onMenuClick={() => setSidebarOpen(true)} />

                {/* ── Mobile sidebar overlay ──────────────────────── */}
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
                                className="absolute top-0 left-0 bottom-0 w-52 border-r border-gray-100 dark:border-slate-800 shadow-none transition-colors"
                            >
                                <SidebarContent user={user} onClose={() => setSidebarOpen(false)} />
                            </motion.aside>
                        </div>
                    )}
                </AnimatePresence>

                {/* ── Desktop sidebar ──────────────────────────────── */}
                <aside className="hidden lg:flex lg:flex-col fixed top-12 left-0 bottom-0 w-52 border-r border-gray-100 dark:border-slate-800 z-30 bg-[#FAFAFA] dark:bg-slate-900 transition-colors duration-500">
                    <SidebarContent user={user} onClose={null} />
                </aside>

                {/* ── Main Content (Flush Architectural Area) ─────────── */}
                <main className="flex-1 mt-12 lg:ml-52 min-h-[calc(100vh-3rem)] bg-white dark:bg-slate-950 overflow-hidden flex flex-col transition-colors duration-500">
                    <div className="flex-1 flex flex-col pt-0">
                        <Suspense fallback={null}>
                            <Outlet />
                        </Suspense>
                    </div>
                </main>

                <FloatingBotWidget />
            </div>
        </BotSettingsProvider>
    );
};

export default AppLayout;
