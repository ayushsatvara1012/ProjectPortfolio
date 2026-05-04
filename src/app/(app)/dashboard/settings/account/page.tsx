'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { useUser, UserButton, useAuth } from '@clerk/nextjs';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Zap, Rocket, AlertCircle, ExternalLink } from 'lucide-react';
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
  { id: 'apikeys', label: 'API Keys', icon: 'vpn_key' },
];

const ProfileTab = () => {
  const { user } = useUser();
  const { userRole } = useUserRole();

  const roleDisplay = userRole === 'SUPER_ADMIN'
    ? { label: 'Platform Owner', cls: 'bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-900/40' }
    : userRole === 'ADMIN'
      ? { label: 'Admin', cls: 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-900/40' }
      : { label: 'Member', cls: 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700' };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 p-6 bg-gradient-to-br from-slate-50 to-white dark:from-slate-900 dark:to-slate-950 border border-gray-100 dark:border-slate-800 transition-colors">
        <div className="relative shrink-0">
          <UserButton appearance={{ elements: { avatarBox: 'w-16 h-16' } }} />
          <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 border-2 border-white dark:border-slate-950 rounded-full" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-lg sm:text-xl md:text-2xl font-display font-bold text-slate-900 dark:text-slate-100 truncate">
            {user?.fullName || 'Developer'}
          </h3>
          <p className="text-md font-display text-slate-500 dark:text-slate-400 mt-0.5 truncate">
            {user?.primaryEmailAddress?.emailAddress}
          </p>
          <span className={`inline-flex items-center gap-1.5 mt-2 px-2.5 py-1 border text-[10px] uppercase tracking-widest font-bold font-sans transition-colors ${roleDisplay.cls}`}>
            <span className="material-symbols-outlined text-[11px]">
              {userRole === 'SUPER_ADMIN' ? 'verified_user' : userRole === 'ADMIN' ? 'shield_person' : 'person'}
            </span>
            {roleDisplay.label}
          </span>
        </div>
      </div>

      <div className="p-5 border border-dashed border-gray-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 flex items-start gap-3">
        <span className="material-symbols-outlined text-[18px] text-slate-400 dark:text-slate-500 mt-0.5 shrink-0">info</span>
        <div>
          <p className="text-md font-display font-semibold text-slate-700 dark:text-slate-300">Click your avatar to manage your profile</p>
          <p className="text-md font-display text-slate-500 dark:text-slate-500 mt-0.5 leading-relaxed">
            Update your name, password, and social accounts from the Clerk panel.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-gray-100 dark:bg-slate-800">
        <div className="bg-white dark:bg-slate-950 p-5">
          <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400 dark:text-slate-500 font-sans mb-1.5">Full Name</p>
          <p className="text-md font-display font-semibold text-slate-800 dark:text-slate-200 truncate">{user?.fullName || '—'}</p>
        </div>
        <div className="bg-white dark:bg-slate-950 p-5">
          <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400 dark:text-slate-500 font-sans mb-1.5">Primary Email</p>
          <p className="text-md font-display font-semibold text-slate-800 dark:text-slate-200 truncate">{user?.primaryEmailAddress?.emailAddress || '—'}</p>
        </div>
        <div className="bg-white dark:bg-slate-950 p-5">
          <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400 dark:text-slate-500 font-sans mb-1.5">Account Created</p>
          <p className="text-md font-display font-semibold text-slate-800 dark:text-slate-200">
            {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : '—'}
          </p>
        </div>
        <div className="bg-white dark:bg-slate-950 p-5">
          <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400 dark:text-slate-500 font-sans mb-1.5">Role</p>
          <p className={`text-md font-display font-semibold ${userRole === 'SUPER_ADMIN' ? 'text-rose-600' : userRole === 'ADMIN' ? 'text-amber-600' : 'text-slate-800 dark:text-slate-200'}`}>
            {roleDisplay.label}
          </p>
        </div>
      </div>
    </div>
  );
};

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
      showAlert('warning', 'Cancellation Scheduled', 'Ends at close of billing period.');
      await refreshUser();
    } catch {
      showAlert('error', 'Error', 'Cancellation failed.');
    } finally { setProcessing(null); }
  };

  const btnBase = 'py-3 px-4 text-[10px] uppercase tracking-[0.15em] font-bold font-display transition-all flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-50 min-h-[44px]';

  if (isLoading) return <div className="space-y-4 animate-pulse"><SkeletonBase className="h-20 w-full" /></div>;

  return (
    <div className="space-y-6">
      <div className="p-6 bg-gradient-to-br from-slate-50 to-white dark:from-slate-900 dark:to-slate-950 border border-gray-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-1">Current Plan</p>
          <div className="flex items-center gap-2.5">
            <TierIcon className={`w-5 h-5 ${meta.color}`} />
            <span className={`text-2xl font-display font-bold ${meta.color}`}>{meta.label}</span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <span className={`px-3 py-1 text-[10px] uppercase tracking-widest font-bold border ${meta.badge}`}>{meta.label}</span>
          <span className="text-[10px] uppercase tracking-widest font-bold text-emerald-600">{subscriptionStatus || 'Active'}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-px bg-gray-100 dark:bg-slate-800">
        <div className="bg-white dark:bg-slate-950 p-5 text-center">
          <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-1.5">Status</p>
          <p className="text-lg font-display font-bold">{subscriptionStatus || 'Active'}</p>
        </div>
        <div className="bg-white dark:bg-slate-950 p-5 text-center">
          <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-1.5">Renews</p>
          <p className="text-lg font-display font-bold">{formattedPeriodEnd || 'N/A'}</p>
        </div>
        <div className="bg-white dark:bg-slate-950 p-5 text-center">
          <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-1.5">Days Left</p>
          <p className="text-lg font-display font-bold">{daysRemaining ?? '—'}</p>
        </div>
      </div>

      <div className="flex flex-col gap-2.5">
        {isPaid && (
          <button onClick={handleBillingPortal} disabled={!!processing} className={`${btnBase} bg-gradient-to-r from-blue-600 to-green-600 text-white w-full`}>
            <ExternalLink className="w-4 h-4" /> Manage Billing
          </button>
        )}
        {tier === 'FREE' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <button onClick={handleUpgrade('BASIC')} className={`${btnBase} bg-blue-600 text-white`}>Upgrade Basic — $9</button>
            <button onClick={handleUpgrade('STARTER')} className={`${btnBase} border border-slate-200 text-slate-700`}>Upgrade Starter — $19</button>
          </div>
        )}
        {isPaid && !isCanceled && (
          <button onClick={handleCancel} disabled={!!processing} className={`${btnBase} border border-red-200 text-red-600 w-full`}>Cancel Subscription</button>
        )}
      </div>

      <Alert isOpen={alert.open} type={alert.type} title={alert.title} message={alert.msg} onClose={() => setAlert(prev => ({ ...prev, open: false }))} />
    </div>
  );
};

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
      // Centralized auth + 401/403/402/429 handling via useAuthenticatedFetch.
      const data = await authFetch<{ status: string; new_key: string }>(
        '/api/company/rotate-key',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bot_id: selectedBotId }),
        }
      );
      if (!data?.new_key) {
        // Defensive: backend contract requires new_key on success. If it ever
        // changes, fail loud rather than showing a green "rotated!" with no key.
        throw new Error('Rotation succeeded but no key was returned. Try again.');
      }
      setNewKey(data.new_key);
      setShowKey(true);
      setAlert({ open: true, type: 'success', msg: 'Key rotated. Copy it now — it will not be shown again.' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Rotation failed.';
      // Treat the standard rate-limit error from useAuthenticatedFetch
      // ("Request failed (429)") as a user-friendly message.
      const friendly = /429/.test(msg)
        ? 'Too many rotations. Try again in an hour.'
        : msg;
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
    <div className="space-y-6">
      <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-900/40 flex gap-3">
        <span className="material-symbols-outlined text-amber-500 shrink-0">warning</span>
        <div className="text-md text-amber-800 dark:text-amber-300 space-y-1">
          <p className="font-semibold">Rotation invalidates the current key immediately.</p>
          <p className="text-[11px] opacity-80">Embedded widgets using the old key will stop working until you replace the snippet on every site.</p>
        </div>
      </div>

      {botsLoading && <SkeletonBase className="h-24" />}

      {!botsLoading && bots.length === 0 && (
        <div className="p-8 text-center bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800">
          <p className="text-md text-slate-500 dark:text-slate-400">You don&apos;t have any bots yet.</p>
        </div>
      )}

      {!botsLoading && bots.length > 0 && (
        <div className="space-y-px bg-gray-100 dark:bg-slate-800">
          {bots.map((bot) => (
            <button
              key={bot.id}
              onClick={() => { setSelectedBotId(bot.id); setNewKey(''); setCopied(false); }}
              className={`w-full bg-white dark:bg-slate-900 px-5 py-4 flex items-center justify-between border-l-2 transition-colors ${selectedBotId === bot.id ? 'border-blue-600' : 'border-transparent hover:bg-slate-50 dark:hover:bg-slate-800'}`}
            >
              <div className="text-left min-w-0">
                <p className="text-md font-bold truncate">{bot.bot_name || bot.company_name}</p>
                <p className="text-[10px] text-slate-400 truncate">{bot.allowed_origin}</p>
              </div>
              {selectedBotId === bot.id && (
                <span className="material-symbols-outlined text-[16px] text-blue-600 shrink-0">check_circle</span>
              )}
            </button>
          ))}
        </div>
      )}

      {selectedBot && (
        <div className="p-4 bg-slate-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400 space-y-1">
          <p>
            <span className="font-bold uppercase tracking-widest text-slate-600 dark:text-slate-300">Created:</span>{' '}
            {selectedBot.created_at ? new Date(selectedBot.created_at).toLocaleDateString() : '—'}
          </p>
          <p className="opacity-80">The current key value is never stored — only its SHA-256 hash. Lost keys can&apos;t be recovered, only rotated.</p>
        </div>
      )}

      {newKey && (
        <div className="p-5 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-900/40">
          <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 mb-2 uppercase tracking-widest">New Key — shown once</p>
          <div className="flex gap-2 bg-white dark:bg-slate-950 border border-gray-100 dark:border-slate-800 p-3 font-mono text-sm">
            <span className="flex-1 truncate select-all">{showKey ? newKey : '•'.repeat(Math.min(newKey.length, 48))}</span>
            <button
              onClick={() => setShowKey(s => !s)}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 shrink-0"
              aria-label={showKey ? 'Hide key' : 'Show key'}
              type="button"
            >
              <span className="material-symbols-outlined text-[16px]">{showKey ? 'visibility_off' : 'visibility'}</span>
            </button>
            <button
              onClick={handleCopy}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 shrink-0"
              aria-label="Copy key"
              type="button"
            >
              <span className={`material-symbols-outlined text-[16px] ${copied ? 'text-emerald-600' : ''}`}>
                {copied ? 'check' : 'content_copy'}
              </span>
            </button>
          </div>
          <p className="text-[10px] text-emerald-700 dark:text-emerald-400 mt-2 opacity-80">
            Save this somewhere safe before leaving this page.
          </p>
        </div>
      )}

      <button
        onClick={handleRotate}
        disabled={isRotating || !selectedBotId}
        className="w-full py-3 bg-gradient-to-r from-blue-600 to-green-600 text-white font-bold uppercase tracking-widest text-[10px] disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isRotating ? 'Rotating...' : 'Rotate Key'}
      </button>

      <Alert isOpen={alert.open} type={alert.type} message={alert.msg} onClose={() => setAlert(p => ({ ...p, open: false }))} />
    </div>
  );
};

export default function AccountPage() {
  const [activeTab, setActiveTab] = useState('profile');

  return (
    <div className="min-h-dvh bg-white dark:bg-slate-900">
      <div className="px-4 py-4 sm:px-6 sm:py-6 border-b border-gray-100 dark:border-slate-800">
        <h2 className="text-lg sm:text-xl md:text-2xl font-display font-bold">Account</h2>
        <p className="text-md text-slate-500">Manage profile and billing.</p>
      </div>

      <div className="flex border-b px-4 sm:px-6 gap-1 overflow-x-auto">
        {ACCOUNT_TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-3.5 text-[11px] uppercase tracking-widest font-bold border-b-2 transition-all ${activeTab === tab.id ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-400 hover:text-slate-700'}`}
          >
            <span className="material-symbols-outlined text-[16px]">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      <div className="px-4 py-4 sm:px-6 sm:py-6 max-w-3xl">
        <AnimatePresence mode="wait">
          <motion.div key={activeTab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
            {activeTab === 'profile' && <ProfileTab />}
            {activeTab === 'billing' && <BillingTab />}
            {activeTab === 'apikeys' && <ApiKeysTab />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
