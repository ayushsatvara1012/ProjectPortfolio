'use client';

import { useState, useEffect, Suspense, Component } from 'react';
import type { ReactNode, ErrorInfo } from 'react';
import Link from 'next/link';

// ── Dashboard error boundary ──────────────────────────────────────────────────

class DashboardErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[DashboardErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 p-8 text-center">
          <span className="material-symbols-outlined text-[48px] text-slate-300 dark:text-slate-600">error</span>
          <p className="text-slate-600 dark:text-slate-400 text-sm font-display">Something went wrong loading this page.</p>
          <button
            onClick={() => this.setState({ error: null })}
            className="px-4 py-2 text-sm font-display border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
import { usePathname } from 'next/navigation';
import { UserButton, useUser } from '@clerk/nextjs';
import { motion, AnimatePresence } from 'framer-motion';
import Logo from './Logo';
import { BotSettingsProvider } from '@/src/lib/context/BotSettingsContext';
import FloatingBotWidget from './FloatingBotWidget';
import { useUserRole } from '@/src/lib/context/UserContext';
import NavigationProgress from './NavigationProgress';

// ── Route maps ────────────────────────────────────────────────────────────────

const SETTINGS_SUB = [
  { label: 'Account', icon: 'person', path: '/dashboard/settings/account' },
  { label: 'Customize Bot', icon: 'palette', path: '/dashboard/settings/customize' },
];

const TOP_NAV = [
  { label: 'My Bots', icon: 'smart_toy', path: '/dashboard/bots' },
  { label: 'Create Bot', icon: 'domain', path: '/dashboard/register' },
  { label: 'Train AI', icon: 'psychology', path: '/dashboard/train' },
  { label: 'Insights', icon: 'insights', path: '/dashboard/insights' },
  { label: 'Pricing', icon: 'payments', path: '/dashboard/pricing' },
];

const PATH_LABELS: Record<string, string> = {
  '/dashboard/bots': 'My Bots',
  '/dashboard/register': 'Create Bot Identity',
  '/dashboard/train': 'Train AI',
  '/dashboard/insights': 'Insights Dashboard',
  '/dashboard/pricing': 'Pricing',
  '/dashboard/settings/account': 'Account',
  '/dashboard/settings/customize': 'Customize Bot',
  '/dashboard/settings/admin': 'Super Admin',
};

const TIER_LABEL: Record<string, string> = {
  FREE: 'Free',
  BASIC: 'Basic',
  STARTER: 'Starter',
  PRO: 'Pro',
};

// ── Sidebar nav item ──────────────────────────────────────────────────────────

type SidebarItemProps = {
  label: string;
  icon: string;
  path: string;
  onClick?: (() => void) | null;
  expanded: boolean;
};

const SidebarItem = ({ label, icon: iconName, path, onClick, expanded }: SidebarItemProps) => {
  const pathname = usePathname();
  const isActive = pathname === path;

  return (
    <Link
      href={path}
      onClick={onClick ?? undefined}
      title={!expanded ? label : undefined}
      className={`flex items-center gap-3 px-4 py-2.5 text-md font-display transition-all min-h-[44px] border-l-2 w-full overflow-hidden ${
        isActive
          ? 'border-slate-900 dark:border-slate-100 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-bold'
          : 'border-transparent text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-slate-200'
      }`}
    >
      <span className={`material-symbols-outlined text-[20px] shrink-0 ${isActive ? 'text-slate-900 dark:text-slate-100' : 'text-slate-400 dark:text-slate-500'}`}>
        {iconName}
      </span>
      <span className={`flex-1 truncate transition-all duration-200 ${expanded ? 'opacity-100 w-auto' : 'opacity-0 w-0 pointer-events-none'}`}>
        {label}
      </span>
    </Link>
  );
};

// ── Sidebar content ───────────────────────────────────────────────────────────

type SidebarContentProps = {
  user: ReturnType<typeof useUser>['user'];
  onClose: (() => void) | null;
  expanded?: boolean;
};

const SidebarContent = ({ user, onClose, expanded = true }: SidebarContentProps) => {
  const { userRole } = useUserRole();
  const pathname = usePathname();
  const onSettings = !!pathname && pathname.startsWith('/dashboard/settings');
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
          <SidebarItem key={item.path} {...item} onClick={onClose} expanded={expanded} />
        ))}

        {/* Settings group */}
        <div>
          <button
            onClick={() => expanded && setSettingsOpen(p => !p)}
            title={!expanded ? 'Settings' : undefined}
            className={`flex items-center gap-3 px-4 py-2.5 text-md font-display transition-all min-h-[44px] border-l-2 w-full overflow-hidden ${
              onSettings
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
                {SETTINGS_SUB.map(item => {
                  const isActive = pathname === item.path;
                  return (
                    <Link
                      key={item.path}
                      href={item.path}
                      onClick={onClose ?? undefined}
                      className={`flex items-center gap-2 pl-10 pr-4 py-2 text-sm font-display transition-colors min-h-[36px] border-l-2 w-full ${
                        isActive
                          ? 'border-slate-900 dark:border-slate-100 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-semibold'
                          : 'border-transparent text-slate-500 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-300'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[18px] shrink-0">{item.icon}</span>
                      {item.label}
                    </Link>
                  );
                })}

                {userRole === 'SUPER_ADMIN' && (
                  <Link
                    href="/dashboard/settings/admin"
                    onClick={onClose ?? undefined}
                    className={`flex items-center gap-2 pl-10 pr-4 py-2 text-sm font-display transition-colors min-h-[36px] border-l-2 w-full ${
                      pathname === '/dashboard/settings/admin'
                        ? 'border-slate-900 dark:border-slate-100 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-semibold'
                        : 'border-transparent text-slate-400 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-300'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[18px] shrink-0">verified_user</span>
                    Super Admin
                  </Link>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </nav>

      {/* User footer */}
      <div className="px-4 py-1.5 border-t border-gray-100 dark:border-slate-800 flex items-center gap-2.5 min-h-[56px] bg-[#FAFAFA] dark:bg-slate-900 transition-colors duration-500 overflow-hidden">
        <UserButton appearance={{ elements: { avatarBox: 'w-6 h-6' } }} />
        <div className={`flex-1 min-w-0 transition-all duration-200 ${expanded ? 'opacity-100 w-auto' : 'opacity-0 w-0 pointer-events-none'}`}>
          <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate transition-colors">
            {user?.fullName || user?.firstName || 'My Account'}
          </p>
          <p className="text-md uppercase tracking-widest font-bold text-slate-400 dark:text-slate-500 truncate transition-colors">
            Profile &amp; Billing
          </p>
        </div>
      </div>
    </div>
  );
};

// ── Top Navbar ────────────────────────────────────────────────────────────────

type TopNavProps = {
  user: ReturnType<typeof useUser>['user'];
  onMenuClick: () => void;
};

const TopNav = ({ user, onMenuClick }: TopNavProps) => {
  const pathname = usePathname();
  const { userTier } = useUserRole();
  const pageLabel = (pathname && PATH_LABELS[pathname]) || 'Dashboard';
  const tierLabel = userTier ? (TIER_LABEL[userTier] ?? userTier) : null;

  return (
    <header className="fixed top-0 left-0 right-0 h-12 bg-white dark:bg-slate-950 border-b border-gray-100 dark:border-slate-800 flex items-center px-4 gap-2 z-60 transition-colors duration-500">
      {/* Left: hamburger (mobile) + brand */}
      <div className="flex items-center gap-2 lg:w-[calc(256px-1rem)]">
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 hover:bg-gray-50 dark:hover:bg-slate-800 min-h-[44px] min-w-[44px] flex items-center justify-center transition-colors"
          aria-label="Open menu"
        >
          <span className="material-symbols-outlined text-[20px] text-slate-600 dark:text-slate-400 transition-colors">menu</span>
        </button>
        <Link href="/" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
          <Logo className="h-5 w-auto" />
          <span className="text-md uppercase tracking-widest font-bold text-slate-900 dark:text-slate-100 transition-colors">SaPyBase</span>
        </Link>
      </div>

      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-500 min-w-0 flex-1 transition-colors border-l border-gray-100 dark:border-slate-800 ml-2 pl-4">
        <div className="hidden sm:flex items-center gap-1.5 min-w-0">
          <span className="truncate max-w-[140px] text-slate-700 dark:text-slate-300 font-google transition-colors">
            {user?.fullName || user?.firstName || 'My Workspace'}
          </span>
          {tierLabel && (
            <span className="shrink-0 px-1.5 py-0.5 border border-gray-200 dark:border-slate-700 text-md uppercase tracking-widest font-bold text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900 transition-colors">
              {tierLabel}
            </span>
          )}
          <span className="material-symbols-outlined text-[16px] shrink-0 text-slate-400 dark:text-slate-600">chevron_right</span>
        </div>
        <span className="truncate text-slate-800 dark:text-slate-200 font-google text-md transition-colors">{pageLabel}</span>
      </div>
    </header>
  );
};

// ── AppLayout shell (wraps dashboard children) ────────────────────────────────

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user } = useUser();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const pathname = usePathname();

  useEffect(() => { setSidebarOpen(false); }, [pathname]);
  useEffect(() => {
    document.body.style.overflow = sidebarOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [sidebarOpen]);

  return (
      <div className="flex min-h-screen bg-white dark:bg-slate-950 antialiased transition-colors duration-500">
        <TopNav user={user} onMenuClick={() => setSidebarOpen(true)} />
        <NavigationProgress />
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
                className="absolute top-0 left-0 bottom-0 w-64 border-r border-gray-100 dark:border-slate-800 shadow-none transition-colors"
              >
                <SidebarContent user={user} onClose={() => setSidebarOpen(false)} expanded={true} />
              </motion.aside>
            </div>
          )}
        </AnimatePresence>
        {/* Desktop sidebar (hover-expand) */}
        <aside
          onMouseEnter={() => setSidebarExpanded(true)}
          onMouseLeave={() => setSidebarExpanded(false)}
          className={`hidden lg:flex lg:flex-col fixed top-12 left-0 bottom-0 border-r border-gray-100 dark:border-slate-800 z-30 bg-[#fafafa] dark:bg-slate-900 transition-all duration-300 ease-in-out ${sidebarExpanded ? 'w-64' : 'w-16'}`}
        >
          <SidebarContent user={user} onClose={null} expanded={sidebarExpanded} />
        </aside>
        {/* Main content */}
        <main className={`flex-1 relative mt-12 min-h-[calc(100vh-3rem)] bg-white dark:bg-slate-950 flex flex-col transition-all duration-300 ease-in-out ${sidebarExpanded ? 'lg:ml-64' : 'lg:ml-16'}`}>
          <div className="flex-1 flex flex-col pt-0">
            <DashboardErrorBoundary>
              <Suspense fallback={null}>
                {children}
              </Suspense>
            </DashboardErrorBoundary>
          </div>
          {/* Dashboard Footer */}
          <footer className="md:col-span-12 bg-white dark:bg-slate-950 px-6 py-4 md:px-8 md:py-4 border-t border-gray-100 dark:border-slate-800 flex flex-col md:flex-row justify-between items-center gap-6 mt-auto transition-colors duration-500">
            <div className="flex flex-col md:flex-row items-center gap-6 text-sm uppercase tracking-widest font-bold text-slate-600 dark:text-slate-400 font-sans">
              <p className="text-center">© 2026 SAPYBASE LLC — ENGINEERED WITH PRECISION.</p>
              <div className="hidden md:block h-px w-6 bg-gray-200 dark:bg-slate-800" />
              <div className="flex gap-6">
                <Link href="/privacy-policy" className="hover:text-slate-900 dark:hover:text-slate-200 transition-colors">PRIVACY</Link>
                <Link href="/terms-and-conditions" className="hover:text-slate-900 dark:hover:text-slate-200 transition-colors">TERMS</Link>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-[16px] text-emerald-500">browse_activity</span>
              <span className="text-sm uppercase tracking-widest font-bold text-slate-900 dark:text-slate-200 font-sans">
                Status: <span className="text-emerald-600">Operational</span>
              </span>
            </div>
          </footer>
        </main>
        <FloatingBotWidget />
      </div>
  );
}
