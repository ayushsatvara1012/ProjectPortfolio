'use client';

import React, { useCallback, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@clerk/nextjs';
import { useAuthenticatedFetch } from '@/src/lib/hooks/useAuthenticatedFetch';

// ── Types (mirror GET /api/admin/byod/tenants) ─────────────────────────────────
export type ByodTenant = {
  company_id: string;
  clerk_id: string | null;
  company_name: string | null;
  status: string;
  schema_version: string | null;
  provisioned: boolean;
  routing_enabled: boolean;
  routing_active: boolean;
  // Phase 5: the client's open change request (the fleet-list flag) + last health.
  pending_change_kind: 'reconnect' | 'leave' | null;
  pending_change_at: string | null;
  last_health_at: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type PendingChange = {
  kind: 'reconnect' | 'leave';
  note: string | null;
  requested_at: string | null;
};

// The connection block returned by GET /api/admin/users/{clerk_id}/byod (read-only).
type ByodAdminView = {
  clerk_id: string;
  company_id: string | null;
  tier: string;
  byo_database: boolean;
  pending_change: PendingChange | null; // Phase 5: the client's open change request
  connection: {
    masked_url: string;
    status: string;
    is_live: boolean;
    provisioned: boolean;
    routing_enabled: boolean;
    schema_version: string | null;
    key_id: string;
    created_at: string | null;
    updated_at: string | null;
    last_health_at: string | null;
  } | null;
};

type TestResult =
  | { ok: true; host: string; port: number; dbname: string; sslmode: string; pgvector_version: string; server_version: string; embedding_dimensions: number }
  | { ok: false; error: string };

// ── Sensitive-admin fetch: force a fresh JWT (iat < 10 min) + retry once ─────────
// The shared useAuthenticatedFetch turns every 401 into a global "auth-required"
// redirect — wrong for a merely-stale step-up token (require_fresh_admin rejects a
// JWT whose iat is > 10 min old). For the BYOD lifecycle mutations we mint a fresh
// token up front (skipCache → new iat = now) so a long-idle panel can still act,
// and retry once on a 401 before giving up. Read queries keep the shared hook.
export function useFreshAdminFetch() {
  const { getToken } = useAuth();
  return useCallback(async <T = unknown>(url: string, options: RequestInit = {}): Promise<T> => {
    const attempt = async (): Promise<Response> => {
      const token = await getToken({ skipCache: true });
      if (!token) throw new Error('AUTH_NOT_READY');
      return fetch(url, {
        ...options,
        headers: { Authorization: `Bearer ${token}`, ...(options.headers || {}) },
      });
    };
    let res = await attempt();
    if (res.status === 401) res = await attempt(); // stale step-up token → re-mint + retry once

    let data: unknown = null;
    if ((res.headers.get('content-type') || '').includes('application/json')) {
      data = await res.json();
    }
    if (!res.ok) {
      const detail = (data as { detail?: unknown })?.detail;
      let msg =
        typeof detail === 'string'
          ? detail
          : (detail as { message?: string })?.message || `Request failed (${res.status})`;
      if (res.status === 401) msg = 'Admin session expired — please reload and sign in again.';
      throw new Error(msg);
    }
    return data as T;
  }, [getToken]);
}

// ── Status styling (the 6 lifecycle states, §1) ────────────────────────────────
const STATUS_STYLE: Record<string, string> = {
  PENDING:         'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  PROVISIONING:    'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  LIVE:            'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  NEEDS_RECONNECT: 'bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  DISABLED:        'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
  ERROR:           'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

const STATUS_DOT: Record<string, string> = {
  PENDING: 'bg-amber-500', PROVISIONING: 'bg-blue-500', LIVE: 'bg-emerald-500',
  NEEDS_RECONNECT: 'bg-orange-500', DISABLED: 'bg-slate-400', ERROR: 'bg-red-500',
};

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'requests', label: 'Requests' }, // Phase 5: open client change requests
  { key: 'LIVE', label: 'Live' },
  { key: 'PENDING', label: 'Pending' },
  { key: 'NEEDS_RECONNECT', label: 'Reconnect' },
  { key: 'ERROR', label: 'Error' },
] as const;

const fmtDate = (iso: string | null) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

const fmtRelative = (iso: string | null) => {
  if (!iso) return '—';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '—';
  const s = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};

const toast = (kind: 'success' | 'error', message: string) =>
  window.dispatchEvent(new CustomEvent('Sapybase:toast', { detail: { kind, message } }));

const StatusPill = ({ status }: { status: string }) => (
  <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-medium font-google rounded-full ${STATUS_STYLE[status] || STATUS_STYLE.DISABLED}`}>
    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_DOT[status] || 'bg-slate-400'}`} />
    {status?.replace(/_/g, ' ') || 'Unknown'}
  </span>
);

const RoutingPill = ({ active }: { active: boolean }) => (
  <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-medium font-google rounded-full ${active
    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
    : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}>
    <span className="material-symbols-outlined text-[13px]">{active ? 'cloud_done' : 'cloud_off'}</span>
    {active ? 'Routing' : 'Off'}
  </span>
);

// Phase 5: a client's open change request — the at-a-glance flag on the fleet list.
const ChangeRequestPill = ({ kind }: { kind: 'reconnect' | 'leave' }) => (
  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-medium font-google rounded-full bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
    <span className="material-symbols-outlined text-[13px]">{kind === 'leave' ? 'logout' : 'sync'}</span>
    {kind === 'leave' ? 'Leave requested' : 'Reconnect requested'}
  </span>
);

const DetailRow = ({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) => (
  <div className="flex gap-3 text-sm font-google py-1.5">
    <span className="text-slate-400 dark:text-slate-500 w-32 shrink-0">{label}</span>
    <span className={`text-slate-700 dark:text-slate-300 font-medium break-all ${mono ? 'font-mono text-xs' : ''}`}>{value}</span>
  </div>
);

// Shared button classes.
const btnNeutral = 'inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-sm font-semibold font-google rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed';
const btnPrimary = 'inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-sm font-semibold font-google rounded-xl bg-blue-600 text-white hover:bg-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed';
const btnDanger = 'inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-sm font-semibold font-google rounded-xl bg-red-600 text-white hover:bg-red-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed';
const Spinner = () => <span className="material-symbols-outlined text-[15px] animate-spin">progress_activity</span>;

// ── Action drawer (read overview + wired lifecycle actions) ─────────────────────
const ByodDetailDrawer = ({ tenant, onClose }: { tenant: ByodTenant; onClose: () => void }) => {
  const authFetch = useAuthenticatedFetch();
  const adminFetch = useFreshAdminFetch();
  const queryClient = useQueryClient();
  const clerkId = tenant.clerk_id;

  const [dsn, setDsn] = useState('');
  const [reason, setReason] = useState('');
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [confirming, setConfirming] = useState<'switch-out' | 'offboard' | 'disable' | null>(null);

  const detailQuery = useQuery({
    queryKey: ['admin', 'byod', 'detail', clerkId],
    queryFn: () => authFetch(`/api/admin/users/${clerkId}/byod`) as Promise<ByodAdminView>,
    enabled: !!clerkId,
  });

  const view = detailQuery.data;
  const conn = view?.connection;
  const status = conn?.status;

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['admin', 'byod', 'tenants'] });
    queryClient.invalidateQueries({ queryKey: ['admin', 'byod', 'detail', clerkId] });
  };

  // One mutation factory for the reason-taking + simple lifecycle endpoints.
  // Named like a hook (and called unconditionally in fixed order below) so it
  // satisfies the rules of hooks.
  const useAction = (
    path: string,
    method: 'POST' | 'PUT',
    body: () => Record<string, unknown> | undefined,
    successMsg: string,
  ) =>
    useMutation({
      mutationFn: () =>
        adminFetch(`/api/admin/users/${clerkId}${path}`, {
          method,
          ...(body() ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body()) } : {}),
        }),
      onSuccess: () => { refresh(); toast('success', successMsg); },
      onError: (e: Error) => toast('error', e.message || 'Action failed.'),
    });

  const reasonBody = () => (reason.trim() ? { reason: reason.trim() } : {});

  const enrollM = useAction('/byod/enroll', 'POST', () => undefined, 'Enrolled in BYOD (plan seeded).');
  const saveConnM = useMutation({
    mutationFn: () =>
      adminFetch(`/api/admin/users/${clerkId}/byod/connection`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ db_url: dsn, ...(reason.trim() ? { reason: reason.trim() } : {}) }),
      }),
    onSuccess: () => { setDsn(''); setTestResult(null); refresh(); toast('success', 'Connection stored (PENDING review).'); },
    onError: (e: Error) => toast('error', e.message || 'Could not store connection.'),
  });
  const testM = useMutation({
    mutationFn: () =>
      adminFetch(`/api/admin/users/${clerkId}/byod/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ db_url: dsn }),
      }) as Promise<TestResult>,
    onSuccess: (r) => { setTestResult(r); toast('success', 'Connection test passed.'); },
    onError: (e: Error) => { setTestResult({ ok: false, error: e.message || 'Test failed.' }); },
  });
  const provisionM = useAction('/byod/provision', 'POST', reasonBody, 'Provisioning complete — tenant is LIVE.');
  const healthM = useAction('/byod/health', 'POST', () => undefined, 'Health check complete.');
  const enableM = useAction('/byod/enable', 'POST', reasonBody, 'Routing enabled — tenant now serves from its own DB.');
  const disableM = useAction('/byod/disable', 'POST', reasonBody, 'Routing disabled — tenant cut back to the shared DB.');
  const switchInM = useAction('/byod/switch-in', 'POST', reasonBody, 'Switch-in complete — data migrated to tenant DB.');
  const switchOutM = useAction('/byod/switch-out', 'POST', reasonBody, 'Switch-out complete — data returned to shared DB.');
  const offboardM = useAction('/byod/offboard', 'POST', reasonBody, 'Offboarded — routing + credentials removed.');
  const clearRequestM = useAction('/byod/clear-request', 'POST', () => undefined, 'Change request dismissed.');

  const mutations = [enrollM, saveConnM, testM, provisionM, healthM, enableM, disableM, switchInM, switchOutM, offboardM, clearRequestM];
  const busy = mutations.some(m => m.isPending);

  return (
    <div className="fixed inset-0 z-[100] flex" role="dialog" aria-modal="true">
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/40 dark:bg-slate-950/80 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="ml-auto relative z-[110] flex flex-col w-full sm:max-w-lg h-full bg-white dark:bg-slate-950 shadow-2xl overflow-y-auto sm:rounded-l-2xl"
        data-lenis-prevent
      >
        {/* Header */}
        <div className="flex items-start justify-between p-5 sm:p-6 sticky top-0 bg-white dark:bg-slate-950 z-10 border-b border-slate-100 dark:border-slate-800">
          <div className="flex-1 min-w-0 pr-4">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <StatusPill status={tenant.status} />
              <RoutingPill active={tenant.routing_active} />
              {tenant.pending_change_kind && <ChangeRequestPill kind={tenant.pending_change_kind} />}
            </div>
            <p className="text-base font-semibold font-google text-slate-900 dark:text-slate-100 truncate" title={tenant.company_name || undefined}>
              {tenant.company_name || 'Unnamed company'}
            </p>
            <p className="text-xs font-mono text-slate-400 dark:text-slate-500 mt-0.5 truncate">{tenant.company_id}</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors rounded-lg shrink-0">
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 p-5 sm:p-6 space-y-6">
          {!clerkId ? (
            <p className="text-sm font-google text-slate-400 py-6 text-center">
              No owner account linked — actions unavailable for this tenant.
            </p>
          ) : detailQuery.isLoading ? (
            <p className="text-sm font-google text-slate-400 py-6 text-center">Loading connection…</p>
          ) : detailQuery.isError ? (
            <div className="text-center py-6">
              <p className="text-sm font-google text-red-500 mb-3">Failed to load connection detail.</p>
              <button onClick={() => detailQuery.refetch()} className={btnNeutral}>Retry</button>
            </div>
          ) : (
            <>
              {/* Change request (Phase 5) — the client's open reconnect/leave signal */}
              {view?.pending_change && (
                <section className="rounded-xl border border-blue-200 dark:border-blue-900/50 bg-blue-50/60 dark:bg-blue-900/10 p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <ChangeRequestPill kind={view.pending_change.kind} />
                    {view.pending_change.requested_at && (
                      <span className="text-xs font-google text-slate-400">{fmtRelative(view.pending_change.requested_at)}</span>
                    )}
                  </div>
                  <p className="text-sm font-google text-slate-700 dark:text-slate-300">
                    {view.pending_change.kind === 'leave'
                      ? 'Client requested to leave BYOD. Run switch-out (reverse-migrate) or offboard below — the client DB is never deleted.'
                      : 'Client requested a reconnect (e.g. their DB password rotated). Re-provision below; the request clears automatically when the tenant is LIVE again.'}
                  </p>
                  {view.pending_change.note && (
                    <p className="text-xs font-google text-slate-500 dark:text-slate-400 rounded-lg bg-white/70 dark:bg-slate-900/50 p-2.5 break-words">
                      “{view.pending_change.note}”
                    </p>
                  )}
                  <button onClick={() => clearRequestM.mutate()} disabled={busy} className={btnNeutral}>
                    {clearRequestM.isPending ? <Spinner /> : <span className="material-symbols-outlined text-[15px]">check</span>}
                    Dismiss request
                  </button>
                </section>
              )}

              {/* Plan / entitlement */}
              <section>
                <p className="text-xs font-medium font-google text-slate-400 mb-1">Plan</p>
                <DetailRow label="Tier" value={view?.tier || '—'} />
                <DetailRow label="BYO database" value={view?.byo_database ? 'Entitled' : 'Not entitled'} />
                <DetailRow label="Clerk ID" value={view?.clerk_id || clerkId} mono />
                {!view?.byo_database && (
                  <button onClick={() => enrollM.mutate()} disabled={busy} className={`${btnPrimary} mt-2`}>
                    {enrollM.isPending ? <Spinner /> : <span className="material-symbols-outlined text-[15px]">person_add</span>}
                    Enroll in BYOD
                  </button>
                )}
              </section>

              {/* Connection (masked — never the real DSN) */}
              <section>
                <p className="text-xs font-medium font-google text-slate-400 mb-1">Connection</p>
                {conn ? (
                  <>
                    <DetailRow label="DSN" value={conn.masked_url} mono />
                    <DetailRow label="Status" value={<StatusPill status={conn.status} />} />
                    <DetailRow label="Provisioned" value={conn.provisioned ? 'Yes' : 'No'} />
                    <DetailRow label="Schema version" value={conn.schema_version || '—'} />
                    <DetailRow label="KMS key" value={conn.key_id} mono />
                    <DetailRow label="Last health" value={conn.last_health_at ? `${fmtDate(conn.last_health_at)} (${fmtRelative(conn.last_health_at)})` : '—'} />
                    <DetailRow label="Updated" value={`${fmtDate(conn.updated_at)} (${fmtRelative(conn.updated_at)})`} />
                  </>
                ) : (
                  <p className="text-sm font-google text-slate-400 py-2">No connection stored yet.</p>
                )}
              </section>

              {/* Set / update connection + Test */}
              <section className="space-y-3">
                <p className="text-xs font-medium font-google text-slate-400">
                  {conn ? 'Update connection (rotate DSN)' : 'Set connection'}
                </p>
                <input
                  type="password"
                  autoComplete="off"
                  value={dsn}
                  onChange={e => { setDsn(e.target.value); setTestResult(null); }}
                  placeholder={conn ? conn.masked_url : 'postgresql://user:pass@host:5432/db?sslmode=require'}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm font-mono text-slate-800 dark:text-slate-200 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-blue-500/30"
                />
                <p className="text-xs font-google text-slate-400">
                  The DSN is validated, encrypted, and never logged or returned. Storing it leaves the tenant <span className="font-medium">PENDING</span> for review.
                </p>
                <div className="flex gap-2">
                  <button onClick={() => testM.mutate()} disabled={busy || !dsn.trim()} className={btnNeutral}>
                    {testM.isPending ? <Spinner /> : <span className="material-symbols-outlined text-[15px]">network_check</span>}
                    Test
                  </button>
                  <button onClick={() => saveConnM.mutate()} disabled={busy || !dsn.trim()} className={btnPrimary}>
                    {saveConnM.isPending ? <Spinner /> : <span className="material-symbols-outlined text-[15px]">save</span>}
                    {conn ? 'Update' : 'Save'} connection
                  </button>
                </div>

                {testResult && (
                  <div className={`rounded-xl p-3 text-xs font-google ${testResult.ok
                    ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400'
                    : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'}`}>
                    {testResult.ok ? (
                      <div className="space-y-0.5">
                        <p className="font-semibold flex items-center gap-1.5"><span className="material-symbols-outlined text-[14px]">check_circle</span>Reachable & compatible</p>
                        <p>{testResult.host}:{testResult.port}/{testResult.dbname} · ssl {testResult.sslmode}</p>
                        <p>pgvector {testResult.pgvector_version} · pg {testResult.server_version} · dims {testResult.embedding_dimensions}</p>
                      </div>
                    ) : (
                      <p className="flex items-start gap-1.5"><span className="material-symbols-outlined text-[14px] mt-0.5">error</span>{testResult.error}</p>
                    )}
                  </div>
                )}
              </section>

              {/* Routing switch (Phase 3 — the one-click on/off, no redeploy) */}
              <section>
                <p className="text-xs font-medium font-google text-slate-400 mb-2">Engine routing</p>
                <div className="rounded-xl bg-slate-50 dark:bg-slate-900 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-google text-slate-700 dark:text-slate-300">
                        Switch is <span className="font-semibold">{conn?.routing_enabled ? 'ON' : 'OFF'}</span>
                      </p>
                      <p className="text-xs font-google text-slate-400 mt-0.5">
                        Effective routing: {tenant.routing_active ? 'tenant DB' : 'shared DB'}
                        {conn?.routing_enabled && !tenant.routing_active && ' (blocked by global kill or status)'}
                      </p>
                    </div>
                    <RoutingPill active={tenant.routing_active} />
                  </div>

                  {confirming === 'disable' ? (
                    <div className="rounded-lg border border-amber-200 dark:border-amber-900/50 bg-amber-50/60 dark:bg-amber-900/10 p-3 space-y-3">
                      <p className="text-sm font-google text-amber-700 dark:text-amber-400">
                        Disable routing? This cuts the tenant back to the shared DB immediately (credentials are kept).
                      </p>
                      <div className="flex gap-2">
                        <button onClick={() => { disableM.mutate(); setConfirming(null); }} disabled={busy} className={btnDanger}>
                          {disableM.isPending ? <Spinner /> : <span className="material-symbols-outlined text-[15px]">toggle_off</span>}
                          Confirm disable
                        </button>
                        <button onClick={() => setConfirming(null)} disabled={busy} className={btnNeutral}>Cancel</button>
                      </div>
                    </div>
                  ) : conn?.routing_enabled ? (
                    <button onClick={() => setConfirming('disable')} disabled={busy} className={btnNeutral}>
                      <span className="material-symbols-outlined text-[15px]">toggle_off</span>
                      Disable routing
                    </button>
                  ) : (
                    <button onClick={() => enableM.mutate()} disabled={busy || status !== 'LIVE'} className={btnPrimary}
                      title={status !== 'LIVE' ? 'Tenant must be LIVE to enable routing' : undefined}>
                      {enableM.isPending ? <Spinner /> : <span className="material-symbols-outlined text-[15px]">toggle_on</span>}
                      Enable routing
                    </button>
                  )}
                </div>
              </section>

              {/* Shared audit reason */}
              <section>
                <label className="text-xs font-medium font-google text-slate-400">Audit reason (optional)</label>
                <input
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  maxLength={500}
                  placeholder="Why are you running this action?"
                  className="mt-1.5 w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm font-google text-slate-800 dark:text-slate-200 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-blue-500/30"
                />
              </section>

              {/* Lifecycle actions */}
              <section>
                <p className="text-xs font-medium font-google text-slate-400 mb-2">Lifecycle</p>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => provisionM.mutate()} disabled={busy || !conn || status === 'LIVE'} className={btnPrimary}
                    title={status === 'LIVE' ? 'Already LIVE' : !conn ? 'Set a connection first' : undefined}>
                    {provisionM.isPending ? <Spinner /> : <span className="material-symbols-outlined text-[15px]">rocket_launch</span>}
                    Provision
                  </button>
                  <button onClick={() => healthM.mutate()} disabled={busy || !conn?.provisioned} className={btnNeutral}
                    title={!conn?.provisioned ? 'Provision first' : undefined}>
                    {healthM.isPending ? <Spinner /> : <span className="material-symbols-outlined text-[15px]">favorite</span>}
                    Health check
                  </button>
                  <button onClick={() => switchInM.mutate()} disabled={busy || status !== 'LIVE'} className={`${btnNeutral} col-span-2`}
                    title={status !== 'LIVE' ? 'Tenant must be LIVE' : undefined}>
                    {switchInM.isPending ? <Spinner /> : <span className="material-symbols-outlined text-[15px]">login</span>}
                    Switch-in (migrate shared → tenant)
                  </button>
                </div>
              </section>

              {/* Destructive actions */}
              <section>
                <p className="text-xs font-medium font-google text-slate-400 mb-2">Danger zone</p>
                {confirming ? (
                  <div className="rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-900/10 p-4 space-y-3">
                    <p className="text-sm font-google text-red-700 dark:text-red-400">
                      {confirming === 'switch-out'
                        ? 'Reverse-migrate this tenant back to the shared DB and offboard it? The client DB is left read-only and untouched.'
                        : 'Offboard WITHOUT a reverse migration? Tenant history beyond the shared DB is forfeited (documented loss). The client DB is never touched.'}
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => { (confirming === 'switch-out' ? switchOutM : offboardM).mutate(); setConfirming(null); }}
                        disabled={busy}
                        className={btnDanger}
                      >
                        {(switchOutM.isPending || offboardM.isPending) ? <Spinner /> : <span className="material-symbols-outlined text-[15px]">warning</span>}
                        Confirm {confirming === 'switch-out' ? 'switch-out' : 'offboard'}
                      </button>
                      <button onClick={() => setConfirming(null)} disabled={busy} className={btnNeutral}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => setConfirming('switch-out')} disabled={busy || status !== 'LIVE'} className={btnNeutral}
                      title={status !== 'LIVE' ? 'Tenant must be LIVE' : undefined}>
                      <span className="material-symbols-outlined text-[15px]">logout</span>
                      Switch-out
                    </button>
                    <button onClick={() => setConfirming('offboard')} disabled={busy || !conn} className={btnNeutral}>
                      <span className="material-symbols-outlined text-[15px]">delete_forever</span>
                      Offboard
                    </button>
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
};

// ── Main tab ───────────────────────────────────────────────────────────────────
export default function ByodTab() {
  const authFetch = useAuthenticatedFetch();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['key']>('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<ByodTenant | null>(null);

  const tenantsQuery = useQuery({
    queryKey: ['admin', 'byod', 'tenants'],
    queryFn: () => authFetch('/api/admin/byod/tenants') as Promise<{ tenants: ByodTenant[] }>,
  });

  const all = useMemo(() => tenantsQuery.data?.tenants || [], [tenantsQuery.data]);
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return all.filter(t => {
      const matchesStatus =
        filter === 'all' ||
        (filter === 'requests' ? !!t.pending_change_kind : t.status === filter);
      const matchesTerm =
        !term ||
        (t.company_name || '').toLowerCase().includes(term) ||
        (t.clerk_id || '').toLowerCase().includes(term) ||
        t.company_id.toLowerCase().includes(term);
      return matchesStatus && matchesTerm;
    });
  }, [all, filter, search]);

  if (tenantsQuery.isLoading) {
    return <div className="p-12 text-center text-base font-google text-slate-400">Loading BYOD tenants…</div>;
  }
  if (tenantsQuery.isError) {
    return (
      <div className="p-12 text-center">
        <p className="text-base font-google text-red-500 mb-3">Failed to load BYOD tenants.</p>
        <button onClick={() => tenantsQuery.refetch()}
          className="px-4 py-2.5 text-xs font-semibold font-google rounded-xl bg-slate-900 text-white hover:bg-slate-700 transition-colors">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters + search */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="overflow-x-auto scrollbar-hide -mx-1 px-1">
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-xl p-1 w-fit">
            {FILTERS.map(f => {
              const count =
                f.key === 'all'
                  ? all.length
                  : f.key === 'requests'
                    ? all.filter(t => !!t.pending_change_kind).length
                    : all.filter(t => t.status === f.key).length;
              return (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 text-sm font-medium font-google rounded-lg whitespace-nowrap transition-all ${
                    filter === f.key
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                  }`}
                >
                  {f.label}
                  <span className="text-xs text-slate-400 dark:text-slate-500">{count}</span>
                </button>
              );
            })}
          </div>
        </div>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search company, Clerk ID, or company ID…"
          className="flex-1 sm:max-w-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2 text-sm font-google text-slate-800 dark:text-slate-200 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-blue-500/30"
        />
      </div>

      {/* Empty state */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
          <span className="material-symbols-outlined text-[32px] text-slate-300 dark:text-slate-600 mb-2 block">database</span>
          <p className="text-base font-google text-slate-400">
            {all.length === 0 ? 'No BYOD tenants yet.' : 'No tenants match this filter.'}
          </p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block bg-white dark:bg-slate-900 rounded-2xl overflow-hidden transition-colors duration-500">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800">
                  <th className="py-4 px-5 text-xs font-medium font-google text-slate-400">Company / Owner</th>
                  <th className="py-4 px-5 text-xs font-medium font-google text-slate-400">Status</th>
                  <th className="py-4 px-5 text-xs font-medium font-google text-slate-400">Routing</th>
                  <th className="py-4 px-5 text-xs font-medium font-google text-slate-400">Schema</th>
                  <th className="py-4 px-5 text-xs font-medium font-google text-slate-400">Updated</th>
                  <th className="py-4 px-5 text-xs font-medium font-google text-slate-400 text-right">Manage</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                {filtered.map(t => (
                  <tr key={t.company_id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900 transition-colors">
                    <td className="py-4 px-5 min-w-0">
                      <p className="text-base font-google text-slate-900 dark:text-slate-100 truncate max-w-[220px]">{t.company_name || 'Unnamed'}</p>
                      <p className="text-xs font-mono text-slate-400 dark:text-slate-500 truncate max-w-[220px] mt-0.5">{t.clerk_id || 'no owner'}</p>
                    </td>
                    <td className="py-4 px-5">
                      <div className="flex flex-col items-start gap-1.5">
                        <StatusPill status={t.status} />
                        {t.pending_change_kind && <ChangeRequestPill kind={t.pending_change_kind} />}
                      </div>
                    </td>
                    <td className="py-4 px-5"><RoutingPill active={t.routing_active} /></td>
                    <td className="py-4 px-5 text-xs font-google text-slate-500 dark:text-slate-400 whitespace-nowrap">{t.schema_version || '—'}</td>
                    <td className="py-4 px-5 text-xs font-google text-slate-500 dark:text-slate-400 whitespace-nowrap">{fmtRelative(t.updated_at)}</td>
                    <td className="py-4 px-5 text-right">
                      <button onClick={() => setSelected(t)}
                        className="px-4 py-2 text-xs font-semibold font-google rounded-xl bg-slate-900 dark:bg-slate-800 text-white hover:bg-slate-700 dark:hover:bg-slate-700 transition-colors">
                        Manage
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden flex flex-col gap-4">
            {filtered.map(t => (
              <div key={t.company_id} className="bg-white dark:bg-slate-900 rounded-2xl p-5 flex flex-col gap-3 transition-colors duration-500">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-base font-semibold font-google text-slate-900 dark:text-slate-100 break-all">{t.company_name || 'Unnamed'}</p>
                    <p className="text-xs font-mono text-slate-400 break-all mt-0.5">{t.clerk_id || 'no owner'}</p>
                  </div>
                  <button onClick={() => setSelected(t)}
                    className="shrink-0 px-3 py-2 text-xs font-semibold font-google rounded-xl bg-slate-900 dark:bg-slate-800 text-white hover:bg-slate-700 dark:hover:bg-slate-700 transition-colors">
                    Manage
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusPill status={t.status} />
                  <RoutingPill active={t.routing_active} />
                  {t.pending_change_kind && <ChangeRequestPill kind={t.pending_change_kind} />}
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs font-google">
                  <div>
                    <p className="text-slate-400 mb-0.5">Schema</p>
                    <p className="text-slate-700 dark:text-slate-300">{t.schema_version || '—'}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 mb-0.5">Updated</p>
                    <p className="text-slate-700 dark:text-slate-300">{fmtRelative(t.updated_at)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Detail / actions drawer */}
      <AnimatePresence>
        {selected && <ByodDetailDrawer tenant={selected} onClose={() => setSelected(null)} />}
      </AnimatePresence>
    </div>
  );
}
