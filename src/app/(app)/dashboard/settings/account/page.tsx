'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { useUser, UserButton, useAuth } from '@clerk/nextjs';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Zap, Rocket } from 'lucide-react';
import { useUserRole } from '@/src/lib/context/UserContext';
import { useAuthenticatedFetch, useIsAuthReady } from '@/src/lib/hooks/useAuthenticatedFetch';
import Alert from '@/src/app/components/Alert';
import { SkeletonBase } from '@/src/app/components/SkeletonLoader';

// ── Tier metadata ──
const TIER_META: Record<string, any> = {
  FREE: { label: 'Free', color: 'text-slate-500', badge: 'bg-slate-100 dark:bg-slate-800 text-slate-500', icon: Shield },
  BASIC: { label: 'Basic', color: 'text-blue-600', badge: 'bg-blue-50 dark:bg-blue-900/30 text-blue-600', icon: Zap },
  STARTER: { label: 'Professional', color: 'text-emerald-600', badge: 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600', icon: Rocket },
  PRO: { label: 'Enterprise', color: 'text-cyan-600', badge: 'bg-cyan-50 dark:bg-cyan-900/30 text-cyan-600', icon: Shield },
};

const POLAR_URLS: Record<string, string | undefined> = {
  BASIC: process.env.NEXT_PUBLIC_POLAR_BASIC_URL,
  STARTER: process.env.NEXT_PUBLIC_POLAR_STARTER_URL,
  PRO: process.env.NEXT_PUBLIC_POLAR_PRO_URL,
  BUSINESS: process.env.NEXT_PUBLIC_POLAR_BUSINESS_URL,
};

const ACCOUNT_TABS = [
  { id: 'profile', label: 'Profile', icon: 'person' },
  { id: 'billing', label: 'Billing', icon: 'credit_card' },
  { id: 'apikeys', label: 'API keys', icon: 'vpn_key' },
];

const cellCls = 'bg-white dark:bg-white/[0.02] rounded-2xl transition-colors duration-500';

// ── Profile Tab ───────────────────────────────────────────────────────────────
const ProfileTab = () => {
  const { user } = useUser();
  const { userRole } = useUserRole();

  const roleDisplay = userRole === 'SUPER_ADMIN'
    ? { label: 'Platform owner', cls: 'bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400' }
    : userRole === 'ADMIN'
      ? { label: 'Admin', cls: 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400' }
      : { label: 'Member', cls: 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400' };

  return (
    <div className="space-y-5">
      {/* Avatar card */}
      <div className={`${cellCls} flex flex-col sm:flex-row items-start sm:items-center gap-5 p-6`}>
        <div className="relative shrink-0">
          <UserButton appearance={{ elements: { avatarBox: 'w-16 h-16' } }} />
          <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 border-2 border-white dark:border-slate-950 rounded-full" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-lg sm:text-xl font-semibold font-google text-slate-900 dark:text-slate-100 truncate">
            {user?.fullName || 'Developer'}
          </h3>
          <p className="text-sm font-google text-slate-500 dark:text-slate-400 mt-0.5 truncate">
            {user?.primaryEmailAddress?.emailAddress}
          </p>
          <span className={`inline-flex items-center gap-1.5 mt-2.5 px-2.5 py-1 text-xs font-medium font-google rounded-full transition-colors ${roleDisplay.cls}`}>
            <span className="material-symbols-outlined text-[12px]">
              {userRole === 'SUPER_ADMIN' ? 'verified_user' : userRole === 'ADMIN' ? 'shield_person' : 'person'}
            </span>
            {roleDisplay.label}
          </span>
        </div>
      </div>

      {/* Info notice */}
      <div className="flex items-start gap-3 px-5 py-4 bg-slate-50 dark:bg-white/[0.02] rounded-2xl border border-dashed border-slate-200 dark:border-white/[0.08]">
        <span className="material-symbols-outlined text-[18px] text-slate-400 dark:text-slate-500 mt-0.5 shrink-0">info</span>
        <div>
          <p className="text-sm font-semibold font-google text-slate-700 dark:text-slate-300">Click your avatar to manage your profile</p>
          <p className="text-sm font-google text-slate-500 dark:text-slate-500 mt-0.5 leading-relaxed">
            Update your name, password, and social accounts from the Clerk panel.
          </p>
        </div>
      </div>

      {/* Detail grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[
          { label: 'Full name', value: user?.fullName || '—' },
          { label: 'Primary email', value: user?.primaryEmailAddress?.emailAddress || '—' },
          { label: 'Account created', value: user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : '—' },
          { label: 'Role', value: roleDisplay.label },
        ].map(({ label, value }) => (
          <div key={label} className={`${cellCls} p-5`}>
            <p className="text-xs font-medium font-google text-slate-400 dark:text-slate-500 mb-1.5">{label}</p>
            <p className="text-sm font-semibold font-google text-slate-800 dark:text-slate-200 truncate">{value}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

// ── Billing Tab ───────────────────────────────────────────────────────────────
const BillingTab = () => {
  const { getToken } = useAuth();
  const { userTier, subscriptionStatus, billingPeriodEnd, isLoading, refreshUser } = useUserRole();
  const [alert, setAlert] = useState({ open: false, type: 'success' as 'success' | 'error' | 'warning', title: '', msg: '' });
  const [processing, setProcessing] = useState<string | null>(null);

  const tier = userTier || 'FREE';
  const meta = TIER_META[tier] || TIER_META.FREE;
  const TierIcon = meta.icon;

  const isPaid = tier !== 'FREE';
  const isCanceled = subscriptionStatus === 'CANCELED';

  const formattedPeriodEnd = billingPeriodEnd ? new Date(billingPeriodEnd).toLocaleDateString() : null;
  const daysRemaining = billingPeriodEnd ? Math.max(0, Math.ceil((new Date(billingPeriodEnd).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))) : null;

  const showAlert = useCallback((type: any, title: string, msg: string) => {
    setAlert({ open: true, type, title, msg });
    setTimeout(() => setAlert(prev => ({ ...prev, open: false })), 8000);
  }, []);

  const baseUrl = (typeof window !== 'undefined' ? '' : (process.env.NEXT_PUBLIC_API_URL?.trim() || ''));

  const handleUpgrade = (targetTier: string) => async () => {
    setProcessing(targetTier.toLowerCase());
    try {
      const token = await getToken();
      if (!token) throw new Error('No token');
      const payload = JSON.parse(atob(token.split('.')[1]));
      const userId = payload.sub;
      const returnUrl = `${window.location.origin}/dashboard/register?payment=success`;
      const checkoutUrl = `${POLAR_URLS[targetTier]}?customer_external_id=${userId}&success_url=${encodeURIComponent(returnUrl)}`;
      window.location.href = checkoutUrl;
    } catch {
      showAlert('error', 'Error', 'Could not initiate checkout.');
      setProcessing(null);
    }
  };

  const handleBillingPortal = async () => {
    setProcessing('portal');
    try {
      const token = await getToken();
      const res = await fetch(`${baseUrl}/api/billing/portal`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await res.json();
      window.open(data.url || 'https://polar.sh/Sapybase-llc/portal', '_blank');
    } catch {
      window.open('https://polar.sh/Sapybase-llc/portal', '_blank');
    } finally { setProcessing(null); }
  };

  const handleCancel = async () => {
    if (!window.confirm('Are you sure?')) return;
    setProcessing('cancel');
    try {
      const token = await getToken();
      const res = await fetch(`${baseUrl}/api/user/subscription/cancel`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed');
      showAlert('warning', 'Cancellation scheduled', 'Ends at close of billing period.');
      await refreshUser();
    } catch {
      showAlert('error', 'Error', 'Cancellation failed.');
    } finally { setProcessing(null); }
  };

  if (isLoading) return <div className="space-y-4 animate-pulse"><SkeletonBase className="h-20 w-full rounded-2xl" /></div>;

  return (
    <div className="space-y-5">
      {/* Current plan card */}
      <div className={`${cellCls} p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4`}>
        <div>
          <p className="text-xs font-medium font-google text-slate-400 dark:text-slate-500 mb-2">Current plan</p>
          <div className="flex items-center gap-2.5">
            <TierIcon className={`w-5 h-5 ${meta.color}`} />
            <span className={`text-2xl font-semibold font-google ${meta.color}`}>{meta.label}</span>
          </div>
        </div>
        <div className="flex flex-col items-start sm:items-end gap-2">
          <span className={`px-2.5 py-1 text-xs font-medium font-google rounded-full ${meta.badge}`}>{meta.label}</span>
          <span className="text-xs font-medium font-google text-emerald-600 dark:text-emerald-400">{subscriptionStatus || 'Active'}</span>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'Status', value: subscriptionStatus || 'Active' },
          { label: 'Renews', value: formattedPeriodEnd || 'N/A' },
          { label: 'Days left', value: daysRemaining ?? '—' },
        ].map(({ label, value }) => (
          <div key={label} className={`${cellCls} p-5 text-center`}>
            <p className="text-xs font-medium font-google text-slate-400 dark:text-slate-500 mb-1.5">{label}</p>
            <p className="text-lg font-semibold font-google text-slate-900 dark:text-slate-100">{value}</p>
          </div>
        ))}
      </div>

      {/* Action buttons */}
      <div className="flex flex-col gap-3">
        {isPaid && (
          <button
            onClick={handleBillingPortal}
            disabled={!!processing}
            className="w-full py-3 px-5 text-sm font-semibold font-google rounded-xl bg-slate-900 dark:bg-white text-white dark:text-black hover:bg-slate-700 dark:hover:bg-slate-200 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 active:scale-[0.98]"
          >
            <span className="material-symbols-outlined text-[16px]">open_in_new</span>
            Manage billing
          </button>
        )}
        {tier === 'FREE' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              onClick={handleUpgrade('BASIC')}
              disabled={!!processing}
              className="py-3 px-5 text-sm font-semibold font-google rounded-xl bg-slate-900 dark:bg-white text-white dark:text-black hover:bg-slate-700 dark:hover:bg-slate-200 transition-colors disabled:opacity-50 active:scale-[0.98]"
            >
              Upgrade to Basic — $9
            </button>
            <button
              onClick={handleUpgrade('STARTER')}
              disabled={!!processing}
              className="py-3 px-5 text-sm font-semibold font-google rounded-xl bg-slate-100 dark:bg-white/[0.06] text-slate-900 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-white/[0.10] transition-colors disabled:opacity-50 active:scale-[0.98]"
            >
              Upgrade to Starter — $19
            </button>
          </div>
        )}
        {isPaid && !isCanceled && (
          <button
            onClick={handleCancel}
            disabled={!!processing}
            className="w-full py-3 px-5 text-sm font-semibold font-google rounded-xl bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors disabled:opacity-50 active:scale-[0.98]"
          >
            Cancel subscription
          </button>
        )}
      </div>

      <Alert isOpen={alert.open} type={alert.type} title={alert.title} message={alert.msg} onClose={() => setAlert(prev => ({ ...prev, open: false }))} />
    </div>
  );
};

// ── API Keys Tab ──────────────────────────────────────────────────────────────
type BotRow = {
  id: string;
  bot_name: string;
  company_name: string;
  allowed_origin: string;
  created_at: string | null;
};

const ApiKeysTab = () => {
  const authFetch = useAuthenticatedFetch();
  const isAuthReady = useIsAuthReady();
  const [isRotating, setIsRotating] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [copied, setCopied] = useState(false);
  const [selectedBotId, setSelectedBotId] = useState('');
  const [alert, setAlert] = useState({ open: false, type: 'success' as 'success' | 'error' | 'warning', msg: '' });

  const { data: botsData, isLoading: botsLoading } = useQuery({
    queryKey: ['bots'],
    queryFn: () => authFetch<{ bots: BotRow[] }>('/api/companies'),
    enabled: isAuthReady,
  });
  const bots: BotRow[] = botsData?.bots || [];
  const selectedBot = bots.find(b => b.id === selectedBotId) || null;

  useEffect(() => {
    if (bots.length > 0 && !selectedBotId) setSelectedBotId(bots[0].id);
  }, [bots, selectedBotId]);

  const handleRotate = async () => {
    if (!selectedBotId) return;
    if (!window.confirm(
      'Rotating will immediately invalidate the current API key. Any embedded widget using the old key will stop working until you replace it. Continue?'
    )) return;

    setIsRotating(true);
    setNewKey('');
    setCopied(false);
    try {
      const data = await authFetch<{ status: string; new_key: string }>(
        '/api/company/rotate-key',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bot_id: selectedBotId }),
        }
      );
      if (!data?.new_key) {
        throw new Error('Rotation succeeded but no key was returned. Try again.');
      }
      setNewKey(data.new_key);
      setShowKey(true);
      setAlert({ open: true, type: 'success', msg: 'Key rotated. Copy it now — it will not be shown again.' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Rotation failed.';
      const friendly = /429/.test(msg) ? 'Too many rotations. Try again in an hour.' : msg;
      setAlert({ open: true, type: 'error', msg: friendly });
    } finally {
      setIsRotating(false);
    }
  };

  const handleCopy = async () => {
    if (!newKey) return;
    try {
      await navigator.clipboard.writeText(newKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setAlert({ open: true, type: 'warning', msg: 'Clipboard unavailable. Select the key and copy manually.' });
    }
  };

  return (
    <div className="space-y-5">
      {/* Warning banner */}
      <div className="flex items-start gap-3 px-5 py-4 bg-amber-50 dark:bg-amber-900/20 rounded-2xl">
        <span className="material-symbols-outlined text-amber-500 shrink-0 mt-0.5">warning</span>
        <div className="space-y-0.5">
          <p className="text-sm font-semibold font-google text-amber-800 dark:text-amber-300">Rotation invalidates the current key immediately.</p>
          <p className="text-xs font-google text-amber-700 dark:text-amber-400 opacity-80">Embedded widgets using the old key will stop working until you replace the snippet on every site.</p>
        </div>
      </div>

      {botsLoading && <SkeletonBase className="h-24 rounded-2xl" />}

      {!botsLoading && bots.length === 0 && (
        <div className={`${cellCls} p-8 text-center`}>
          <p className="text-sm font-google text-slate-500 dark:text-slate-400">You don&apos;t have any bots yet.</p>
        </div>
      )}

      {/* Bot selector */}
      {!botsLoading && bots.length > 0 && (
        <div className={`${cellCls} overflow-hidden`}>
          {bots.map((bot, i) => (
            <button
              key={bot.id}
              onClick={() => { setSelectedBotId(bot.id); setNewKey(''); setCopied(false); }}
              className={`w-full px-5 py-4 flex items-center justify-between transition-colors ${i < bots.length - 1 ? 'border-b border-slate-100 dark:border-white/[0.04]' : ''} ${selectedBotId === bot.id ? 'bg-slate-50 dark:bg-white/[0.03]' : 'hover:bg-slate-50 dark:hover:bg-white/[0.02]'}`}
            >
              <div className="text-left min-w-0">
                <p className="text-sm font-semibold font-google text-slate-900 dark:text-slate-100 truncate">{bot.bot_name || bot.company_name}</p>
                <p className="text-xs font-google text-slate-400 dark:text-slate-500 truncate mt-0.5">{bot.allowed_origin}</p>
              </div>
              {selectedBotId === bot.id && (
                <span className="material-symbols-outlined text-[16px] text-slate-900 dark:text-slate-200 shrink-0">check_circle</span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Selected bot meta */}
      {selectedBot && (
        <div className="px-5 py-4 bg-slate-50 dark:bg-white/[0.02] rounded-2xl space-y-1">
          <p className="text-xs font-google text-slate-500 dark:text-slate-400">
            <span className="font-medium text-slate-600 dark:text-slate-300">Created: </span>
            {selectedBot.created_at ? new Date(selectedBot.created_at).toLocaleDateString() : '—'}
          </p>
          <p className="text-xs font-google text-slate-400 dark:text-slate-500 leading-relaxed">
            The current key value is never stored — only its SHA-256 hash. Lost keys can&apos;t be recovered, only rotated.
          </p>
        </div>
      )}

      {/* New key reveal */}
      {newKey && (
        <div className="p-5 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl">
          <p className="text-xs font-medium font-google text-emerald-600 dark:text-emerald-400 mb-3">New key — shown once</p>
          <div className="flex gap-2 bg-white dark:bg-white/[0.04] px-4 py-3 rounded-xl font-mono text-sm items-center">
            <span className="flex-1 truncate select-all text-slate-800 dark:text-slate-200">
              {showKey ? newKey : '•'.repeat(Math.min(newKey.length, 48))}
            </span>
            <button
              onClick={() => setShowKey(s => !s)}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 shrink-0 transition-colors"
              aria-label={showKey ? 'Hide key' : 'Show key'}
              type="button"
            >
              <span className="material-symbols-outlined text-[16px]">{showKey ? 'visibility_off' : 'visibility'}</span>
            </button>
            <button
              onClick={handleCopy}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 shrink-0 transition-colors"
              aria-label="Copy key"
              type="button"
            >
              <span className={`material-symbols-outlined text-[16px] ${copied ? 'text-emerald-600 dark:text-emerald-400' : ''}`}>
                {copied ? 'check' : 'content_copy'}
              </span>
            </button>
          </div>
          <p className="text-xs font-google text-emerald-700 dark:text-emerald-400 mt-2.5 opacity-80">
            Save this somewhere safe before leaving this page.
          </p>
        </div>
      )}

      {/* Rotate button */}
      <button
        onClick={handleRotate}
        disabled={isRotating || !selectedBotId}
        className="w-full py-3 px-5 text-sm font-semibold font-google rounded-xl bg-slate-900 dark:bg-white text-white dark:text-black hover:bg-slate-700 dark:hover:bg-slate-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 active:scale-[0.98]"
      >
        {isRotating
          ? <><div className="w-3.5 h-3.5 border-2 border-white/30 dark:border-black/30 border-t-white dark:border-t-black rounded-full animate-spin" /> Rotating…</>
          : <><span className="material-symbols-outlined text-[16px]">key</span> Rotate key</>
        }
      </button>

      <Alert isOpen={alert.open} type={alert.type} message={alert.msg} onClose={() => setAlert(p => ({ ...p, open: false }))} />
    </div>
  );
};

// ── Page ──────────────────────────────────────────────────────────────────────
export default function AccountPage() {
  const [activeTab, setActiveTab] = useState('profile');

  return (
    <div className="min-h-dvh bg-slate-50 dark:bg-slate-900 transition-colors duration-500">

      {/* Header */}
      <div className="px-6 md:px-8 pt-8 pb-6">
        <h1 className="text-2xl md:text-3xl font-semibold font-google text-slate-900 dark:text-slate-200 transition-colors">
          Account
        </h1>
        <p className="text-sm font-google text-slate-500 dark:text-slate-400 mt-1">
          Manage your profile, billing, and API keys.
        </p>

        {/* Pill tab bar */}
        <div className="mt-6 flex items-center bg-slate-100 dark:bg-white/[0.04] rounded-xl p-1 w-fit">
          {ACCOUNT_TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium font-google rounded-lg whitespace-nowrap transition-all ${
                activeTab === tab.id
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              <span className="material-symbols-outlined text-[14px]">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="px-6 md:px-8 pb-8 max-w-3xl">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
          >
            {activeTab === 'profile' && <ProfileTab />}
            {activeTab === 'billing' && <BillingTab />}
            {activeTab === 'apikeys' && <ApiKeysTab />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
