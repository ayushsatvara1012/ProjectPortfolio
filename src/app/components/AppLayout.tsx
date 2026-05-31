'use client';

import React, { useState, useEffect, useRef, Suspense, Component } from 'react';
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
        <div className="flex flex-col items-center justify-center flex-1 min-h-[50vh] gap-4 p-8 text-center">
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
      className={`flex items-center gap-3.5 px-5 py-3.5 text-sm font-display transition-all min-h-[48px] w-full overflow-hidden ${isActive
        ? 'text-slate-900 dark:text-slate-100 font-semibold'
        : 'text-slate-500 dark:text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 font-normal'
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
  const pathname = usePathname();
  const { userRole } = useUserRole();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);
  const onSettings = !!pathname && pathname.startsWith('/dashboard/settings');
  const [settingsOpen, setSettingsOpen] = useState(onSettings);

  useEffect(() => { if (onSettings) setSettingsOpen(true); }, [onSettings]);
  useEffect(() => { if (!expanded) setSettingsOpen(false); }, [expanded]);

  return (
    <div className="flex flex-col h-full bg-[#f8f9fa] dark:bg-slate-900/40 transition-colors duration-500">
      {/* Mobile close row */}
      {onClose && (
        <div className="flex items-center justify-between px-4 py-3 lg:hidden transition-colors">
          <div className="flex items-center gap-2" />
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-white/[0.02] min-h-[44px] min-w-[44px] flex items-center justify-center transition-colors"
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
            onClick={(e) => { e.stopPropagation(); expanded && setSettingsOpen(p => !p); }}
            title={!expanded ? 'Settings' : undefined}
            className={`flex items-center gap-3.5 px-5 py-3.5 text-sm font-display transition-all min-h-[48px] w-full overflow-hidden ${onSettings
              ? 'text-slate-900 dark:text-slate-100 font-semibold'
              : 'text-slate-500 dark:text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 font-normal'
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
                      onClick={(e) => { e.stopPropagation(); onClose?.(); }}
                      className={`flex items-center gap-2 pl-12 pr-5 py-2.5 text-sm font-display transition-colors min-h-[40px] w-full ${isActive
                        ? 'text-slate-900 dark:text-slate-100 font-semibold'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 font-normal'
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
                    onClick={(e) => { e.stopPropagation(); onClose?.(); }}
                    className={`flex items-center gap-2 pl-12 pr-5 py-2.5 text-sm font-display transition-colors min-h-[40px] w-full ${pathname === '/dashboard/settings/admin'
                      ? 'text-slate-900 dark:text-slate-100 font-semibold'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 font-normal'
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
      <div className="px-5 py-4 flex items-center gap-3 min-h-[64px] bg-[#f8f9fa] dark:bg-slate-900/40 transition-colors duration-500 overflow-hidden">
        {mounted && <UserButton appearance={{ elements: { avatarBox: 'w-7 h-7' } }} />}
        <div className={`flex-1 min-w-0 transition-all duration-200 ${expanded ? 'opacity-100 w-auto' : 'opacity-0 w-0 pointer-events-none'}`}>
          <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate transition-colors">
            {mounted ? (user?.fullName || user?.firstName || 'My Account') : ''}
          </p>
          <p className="text-xs text-slate-400 dark:text-slate-500 truncate transition-colors mt-0.5">
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
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const pageLabel = (pathname && PATH_LABELS[pathname]) || 'Dashboard';
  const tierLabel = userTier ? (TIER_LABEL[userTier] ?? userTier) : null;

  return (
    <header className="fixed top-0 left-0 right-0 h-16 bg-[#f8f9fa] dark:bg-[#05070a] flex items-center px-4 gap-2 z-60 transition-colors duration-500">
      {/* Left: hamburger (mobile) + brand */}
      <div className="flex items-center gap-2 lg:w-[calc(256px-1rem)]">
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 hover:bg-gray-100 dark:hover:bg-white/[0.02] min-h-[44px] min-w-[44px] flex items-center justify-center transition-colors"
          aria-label="Open menu"
        >
          <span className="material-symbols-outlined text-[20px] text-slate-600 dark:text-slate-400 transition-colors">menu</span>
        </button>
        <Link href="/" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
          <Logo className="h-6 w-auto" />
          <span className="text-sm font-semibold tracking-wide text-slate-900 dark:text-slate-100 transition-colors">Sapybase</span>
        </Link>
      </div>

      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-500 min-w-0 flex-1 transition-colors ml-4 pl-4">
        <div className="hidden sm:flex items-center gap-1.5 min-w-0">
          <span className="truncate max-w-[140px] text-slate-600 dark:text-slate-400 font-google text-sm transition-colors">
            {mounted ? (user?.fullName || user?.firstName || 'My Workspace') : ''}
          </span>
          {tierLabel && (
            <span className="shrink-0 px-2 py-0.5 text-xs font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-white/[0.04] rounded-full transition-colors">
              {tierLabel}
            </span>
          )}
          <span className="material-symbols-outlined text-[16px] shrink-0 text-slate-400 dark:text-slate-600">chevron_right</span>
        </div>
        <span className="truncate text-slate-800 dark:text-slate-200 font-google text-sm font-medium transition-colors">{pageLabel}</span>
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
  const desktopAsideRef = useRef<HTMLElement>(null);
  const isFullHeightPane = pathname === '/dashboard/settings/customize';

  useEffect(() => { setSidebarOpen(false); }, [pathname]);
  useEffect(() => {
    document.body.style.overflow = sidebarOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [sidebarOpen]);

  // Click-outside to collapse desktop sidebar on touch devices (replaces bubbling-tap behavior).
  useEffect(() => {
    const handleOutsideTap = (e: MouseEvent) => {
      if (!window.matchMedia('(hover: none)').matches) return;
      if (!sidebarExpanded) return;
      if (desktopAsideRef.current && !desktopAsideRef.current.contains(e.target as Node)) {
        setSidebarExpanded(false);
      }
    };
    document.addEventListener('click', handleOutsideTap);
    return () => document.removeEventListener('click', handleOutsideTap);
  }, [sidebarExpanded]);

  return (
    <div className="flex min-h-screen bg-[#f8f9fa] dark:bg-[#05070a] antialiased transition-colors duration-500">

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
              className="absolute top-0 left-0 bottom-0 w-64 shadow-none transition-colors"
            >
              <SidebarContent user={user} onClose={() => setSidebarOpen(false)} expanded={true} />
            </motion.aside>
          </div>
        )}
      </AnimatePresence>
      {/* Desktop sidebar (hover-expand; touch-tap collapsed rail to expand on iPad) */}
      <aside
        ref={desktopAsideRef}
        onMouseEnter={() => setSidebarExpanded(true)}
        onMouseLeave={() => { if (!window.matchMedia('(hover: none)').matches) setSidebarExpanded(false); }}
        onClick={(e) => {
          // Only toggle when tapping the aside chrome itself on touch devices.
          // Inner interactive elements stop propagation so they don't collapse the sidebar.
          if (e.target === e.currentTarget && window.matchMedia('(hover: none)').matches)
            setSidebarExpanded(p => !p);
        }}
        className={`hidden lg:flex lg:flex-col fixed top-16 left-0 bottom-0 z-30 bg-[#f8f9fa] dark:bg-slate-900/40 transition-all duration-300 ease-in-out ${sidebarExpanded ? 'w-64' : 'w-16'}`}
      >
        <SidebarContent user={user} onClose={null} expanded={sidebarExpanded} />
      </aside>
      {/* Main content */}
      <main className={`flex-1 relative mt-16 min-h-[calc(100vh-4rem)] bg-[#f8f9fa] dark:bg-[#05070a] flex flex-col min-w-0 overflow-x-hidden transition-all duration-300 ease-in-out ${sidebarExpanded ? 'lg:ml-64' : 'lg:ml-16'} ${isFullHeightPane ? 'lg:h-[calc(100vh-4rem)] lg:overflow-hidden' : ''}`}>
        <div className={`flex-1 flex flex-col pt-0 ${isFullHeightPane ? 'lg:min-h-0 lg:overflow-hidden' : ''}`}>
          <DashboardErrorBoundary>
            <Suspense fallback={null}>
              {children}
            </Suspense>
          </DashboardErrorBoundary>
        </div>
        {/* Dashboard Footer */}
        {!isFullHeightPane && <footer className="bg-[#f8f9fa] dark:bg-[#05070a] px-6 py-5 md:px-8 md:py-6 flex flex-col md:flex-row justify-between items-center gap-4 mt-auto transition-colors duration-500">
          <div className="flex flex-col md:flex-row items-center gap-6 text-sm text-slate-500 dark:text-slate-400 font-sans">
            <p className="text-center">© 2026 Sapybase LLC — Engineered with precision.</p>
            <div className="flex gap-5">
              <Link href="/privacy-policy" className="hover:text-slate-900 dark:hover:text-slate-200 transition-colors">Privacy</Link>
              <Link href="/terms-and-conditions" className="hover:text-slate-900 dark:hover:text-slate-200 transition-colors">Terms</Link>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[14px] text-emerald-500">browse_activity</span>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-sans">
              Status: <span className="text-emerald-600 font-medium">Operational</span>
            </span>
          </div>
        </footer>}
      </main>
      <FloatingBotWidget />
    </div>
  );
}
