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
import VaayuLogo from '../ui/VaayuLogo';
import { BotSettingsProvider } from '@/src/lib/context/BotSettingsContext';
import { useUserRole } from '@/src/lib/context/UserContext';
import { useBotSwitcher } from '@/src/lib/context/BotSwitcherContext';
import NavigationProgress from './NavigationProgress';



// ── Route maps ────────────────────────────────────────────────────────────────

const SETTINGS_SUB = [
  { label: 'Account', icon: 'person', path: '/dashboard/settings/account' },
  { label: 'Customize Bot', icon: 'palette', path: '/dashboard/settings/customize' },
];

const TOP_NAV = [
  { label: 'My Bots', icon: 'smart_toy', path: '/dashboard/bots' },
  { label: 'Train AI', icon: 'psychology', path: '/dashboard/train' },
  { label: 'Insights', icon: 'insights', path: '/dashboard/insights' },
  { label: 'Pricing', icon: 'payments', path: '/dashboard/pricing' },
];

const PATH_LABELS: Record<string, string> = {
  '/dashboard/bots': 'My Bots',
  '/dashboard/register': 'Create Bot Identity',
  '/dashboard/train': 'Train AI',
  '/dashboard/insights': 'Insights Dashboard',
  '/dashboard/database': 'My Database',
  '/dashboard/pricing': 'Pricing',
  '/dashboard/settings/account': 'Account',
  '/dashboard/settings/customize': 'Customize Bot',
  '/dashboard/settings/admin': 'Super Admin',
};

const TIER_LABEL: Record<string, string> = {
  FREE: 'Free',
  STARTER: 'Starter',
  PRO: 'Growth',
  BUSINESS: 'Scale',
  ENTERPRISE: 'Enterprise',
  CUSTOM: 'Custom',
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
      className={`flex items-center gap-3 px-3 py-2 text-sm tracking-normal font-display font-medium transition-all min-h-[38px] w-full overflow-hidden rounded-lg ${isActive
        ? 'bg-slate-100 dark:bg-slate-900 text-slate-900 dark:text-slate-100'
        : 'text-slate-800 dark:text-slate-200 hover:bg-slate-100/50 dark:hover:bg-slate-900/30'
        }`}
    >
      <span className={`material-symbols-outlined text-sm shrink-0 ${isActive ? 'text-slate-900 dark:text-slate-100' : 'text-slate-600 dark:text-slate-400'}`}>
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
  const { userRole, entitlements } = useUserRole();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);
  const onSettings = !!pathname && pathname.startsWith('/dashboard/settings');
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
          <SidebarItem key={item.path} {...item} onClick={onClose} expanded={expanded} />
        ))}

        {/* BYOD: client self-serve "My Database" — only for byo_database-entitled
            users (UI plan Phase 4). The route itself also re-gates server-side. */}
        {entitlements.canUseByoDatabase && (
          <SidebarItem
            label="My Database"
            icon="database"
            path="/dashboard/database"
            onClick={onClose}
            expanded={expanded}
          />
        )}

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

                {userRole === 'SUPER_ADMIN' && (
                  <Link
                    href="/dashboard/settings/admin"
                    onClick={(e) => { e.stopPropagation(); onClose?.(); }}
                    className={`flex items-center gap-2 px-3 py-1.5 text-sm font-display font-medium transition-colors min-h-[32px] w-full rounded-md ${pathname === '/dashboard/settings/admin'
                      ? 'bg-slate-100 dark:bg-slate-900 text-slate-900 dark:text-slate-100'
                      : 'text-slate-800 dark:text-slate-200 hover:bg-slate-100/30 dark:hover:bg-slate-900/10'
                      }`}
                  >
                    <span className="material-symbols-outlined text-sm shrink-0">verified_user</span>
                    Super Admin
                  </Link>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </nav>

      {/* Back to Sapybase home — same look as the nav items above. On the product
          subdomain the marketing site lives on www, and "/" here would just be
          rewritten back into the dashboard, so link out to www explicitly. The
          `mounted` guard keeps SSR/localhost/preview on a relative "/". */}
      <div className="px-2 py-1 border-t border-slate-200/50 dark:border-slate-800/50">
        <SidebarItem
          label="Back to Sapybase"
          icon="home"
          path={mounted && window.location.host === 'vaayu.sapybase.com' ? 'https://www.sapybase.com/' : '/'}
          onClick={onClose}
          expanded={expanded}
        />
      </div>

      {/* User footer */}
      <div className="px-5 py-4 border-t border-slate-200/50 dark:border-slate-800/50 flex items-center gap-3 min-h-[64px] bg-[#f8f9fa] dark:bg-slate-950 transition-colors duration-500 overflow-hidden">
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

// Vercel-style bot switcher that lives in the global breadcrumb. Renders only on
// the customize route (where the page has populated the switcher context); a
// native <select> overlay keeps it keyboard- and mobile-accessible. Collapses to
// a static pill when the workspace has a single bot.
const PreviewToggle = () => {
  const { bots, showPreview, setShowPreview } = useBotSwitcher();
  if (bots.length === 0) return null;

  return (
    <button
      onClick={() => setShowPreview(!showPreview)}
      className={`shrink-0 flex items-center gap-1.5 px-2.5 py-1 text-[12px] font-semibold font-google rounded-lg transition-all active:scale-[0.97] ${
        showPreview
          ? 'bg-slate-900 dark:bg-white text-white dark:text-black'
          : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800'
      }`}
      aria-pressed={showPreview}
    >
      <span className="material-symbols-outlined text-[15px]">{showPreview ? 'visibility_off' : 'visibility'}</span>
      <span className="hidden sm:inline">{showPreview ? 'Hide' : 'Preview'}</span>
    </button>
  );
};

const BotSwitcher = () => {
  const { bots, selectedBotId, setSelectedBotId } = useBotSwitcher();
  if (bots.length === 0) return null;

  const selected = bots.find((b) => b.id === selectedBotId) || bots[0];
  const single = bots.length === 1;

  return (
    <>
      <span className="material-symbols-outlined text-[16px] shrink-0 text-slate-400 dark:text-slate-600">chevron_right</span>
      <div className="relative shrink-0 min-w-0">
        <div className="flex items-center gap-1.5 pl-2 pr-1.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 max-w-[160px] sm:max-w-[200px] transition-colors">
          <span className="material-symbols-outlined text-[15px] text-slate-400 shrink-0">smart_toy</span>
          <span className="truncate text-[13px] font-google font-medium text-slate-800 dark:text-slate-200">
            {selected?.bot_name || 'Unnamed bot'}
          </span>
          {!single && (
            <span className="material-symbols-outlined text-[16px] text-slate-400 shrink-0">unfold_more</span>
          )}
        </div>
        {!single && (
          <select
            value={selectedBotId}
            onChange={(e) => setSelectedBotId(e.target.value)}
            className="absolute inset-0 w-full opacity-0 cursor-pointer"
            aria-label="Switch bot"
          >
            {bots.map((b) => (
              <option key={b.id} value={b.id}>
                {b.bot_name || 'Unnamed bot'}
              </option>
            ))}
          </select>
        )}
      </div>
    </>
  );
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
  const isCustomize = pathname === '/dashboard/settings/customize';

  return (
    <header className="fixed top-0 left-0 right-0 h-14 bg-[#f8f9fa] dark:bg-slate-950 flex items-center px-4 gap-2 z-60 transition-colors duration-500">
      {/* Left: hamburger (mobile) + brand */}
      <div className="flex items-center gap-2 lg:w-12">
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 hover:bg-gray-100 dark:hover:bg-slate-900 min-h-[44px] min-w-[44px] flex items-center justify-center transition-colors"
          aria-label="Open menu"
        >
          <span className="material-symbols-outlined text-[20px] text-slate-600 dark:text-slate-400 transition-colors">menu</span>
        </button>
        <Link href="/dashboard" aria-label="Vaayu dashboard" className="flex items-center hover:opacity-80 transition-opacity">
          <VaayuLogo iconOnly size={26} />
        </Link>
      </div>

      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-[13px] text-slate-500 dark:text-slate-500 min-w-0 flex-1 transition-colors">
        <div className="hidden sm:flex items-center gap-1.5 min-w-0">
          <span className="truncate max-w-[140px] text-slate-600 dark:text-slate-400 font-google text-[13px] transition-colors">
            {mounted ? (user?.fullName || user?.firstName || 'My Workspace') : ''}
          </span>
          {tierLabel && (
            <span className="shrink-0 px-2 py-0.5 text-xs font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 rounded-full transition-colors">
              {tierLabel}
            </span>
          )}
          <span className="material-symbols-outlined text-[16px] shrink-0 text-slate-400 dark:text-slate-600">chevron_right</span>
        </div>
        <span className="truncate text-slate-800 dark:text-slate-200 font-google text-[13px] font-medium transition-colors">{pageLabel}</span>
        {isCustomize && <BotSwitcher />}
      </div>
      {isCustomize && (
        <div className="shrink-0">
          <PreviewToggle />
        </div>
      )}
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
  const isFullHeightPane = pathname === '/dashboard/settings/customize' || pathname === '/dashboard/insights';

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
    <div className="flex min-h-screen bg-[#f8f9fa] dark:bg-slate-950 antialiased transition-colors duration-500">

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
        className={`hidden lg:flex lg:flex-col fixed top-14 left-0 bottom-0 z-30 bg-[#f8f9fa] dark:bg-slate-950 transition-all duration-300 ease-in-out ${sidebarExpanded ? 'w-64' : 'w-16'}`}
      >
        <SidebarContent user={user} onClose={null} expanded={sidebarExpanded} />
      </aside>
      {/* Main content */}
      <main className={`flex-1 relative mt-14 min-w-0 overflow-x-hidden bg-[#f8f9fa] dark:bg-slate-950 flex flex-col transition-all duration-300 ease-in-out ${sidebarExpanded ? 'lg:ml-64' : 'lg:ml-16'} ${isFullHeightPane ? 'lg:h-[calc(100vh-3.5rem)] lg:min-h-0 lg:overflow-hidden' : 'min-h-[calc(100vh-3.5rem)]'}`}>
        <div className={`flex-1 flex flex-col pt-0 ${isFullHeightPane ? 'lg:min-h-0 lg:overflow-hidden' : ''}`}>
          <DashboardErrorBoundary>
            <Suspense fallback={null}>
              {children}
            </Suspense>
          </DashboardErrorBoundary>
        </div>
        {/* Bottom spacer — footer text removed; empty container kept for breathing room */}
        {!isFullHeightPane && <footer aria-hidden="true" className="bg-[#f8f9fa] dark:bg-slate-950 py-4 mt-auto transition-colors duration-500" />}
      </main>
    </div>
  );
}
