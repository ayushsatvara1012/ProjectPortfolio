'use client';

/**
 * BYOD client self-serve onboarding (UI plan Phase 4).
 *
 * The page a BYOD-entitled customer uses to bring their own Postgres database:
 *   1. see the requirements + egress IPs to allowlist,
 *   2. paste their DSN and **Test** it (live SSRF/TLS/pgvector probe, stores nothing),
 *   3. submit → stored encrypted, status PENDING, awaiting super-admin review.
 *
 * All routes are own-company-only and entitlement-gated server-side
 * (`/api/byod/me*`). The connection is editable ONLY while onboarding (no row /
 * PENDING / NEEDS_RECONNECT); a LIVE connection is frozen here — a change is an
 * admin-driven re-onboarding (plan §0). The client can also request a reconnect
 * or to leave; both are admin-run (no mutation from this page).
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthenticatedFetch, useIsAuthReady } from '@/src/lib/hooks/useAuthenticatedFetch';
import { useUserRole } from '@/src/lib/context/UserContext';

// ── Types (mirror GET /api/byod/me) ────────────────────────────────────────────
type Requirements = {
  egress_ip_ranges: string[];
  tls_required: boolean;
  min_pgvector_version: string;
  embedding_dimensions: number;
  dsn_format: string;
  checklist: string[];
};

type Connection = {
  masked_url: string;
  status: string;
  is_live: boolean;
  provisioned: boolean;
  schema_version: string | null;
  created_at: string | null;
  updated_at: string | null;
  last_health_at: string | null;
};

type PendingChange = {
  kind: 'reconnect' | 'leave';
  note: string | null;
  requested_at: string | null;
};

type MeView = {
  company_id: string | null;
  status: string | null; // null = not started
  can_edit_connection: boolean;
  connection: Connection | null;
  pending_change: PendingChange | null;
  requirements: Requirements;
};

type TestOk = {
  ok: true;
  host: string;
  port: number;
  dbname: string;
  sslmode: string;
  pgvector_version: string;
  server_version: string;
  embedding_dimensions: number;
};

// ── Status presentation ─────────────────────────────────────────────────────────
const STATUS_STYLE: Record<string, string> = {
  PENDING:         'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  PROVISIONING:    'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  LIVE:            'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  NEEDS_RECONNECT: 'bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  DISABLED:        'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
  ERROR:           'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

const STATUS_COPY: Record<string, string> = {
  PENDING: 'Submitted — our team is reviewing your database connection.',
  PROVISIONING: 'We are setting up your database. This usually takes a moment.',
  LIVE: 'Your database is connected and serving your assistant.',
  NEEDS_RECONNECT: 'We could not authenticate to your database — re-enter your connection string below to reconnect.',
  DISABLED: 'Your database connection is paused. Contact support to resume.',
  ERROR: 'Something went wrong with your database. Request a reconnect and we will help.',
};

const fmtDate = (iso: string | null) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLE[status] ?? STATUS_STYLE.DISABLED}`}>
      {status}
    </span>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────────
export default function MyDatabasePage() {
  const { entitlements, isLoading: userLoading } = useUserRole();
  const authReady = useIsAuthReady();
  const authedFetch = useAuthenticatedFetch();
  const queryClient = useQueryClient();

  const { data, isLoading, isError, error } = useQuery<MeView>({
    queryKey: ['byod', 'me'],
    queryFn: () => authedFetch<MeView>('/api/byod/me'),
    enabled: authReady && entitlements.canUseByoDatabase,
  });

  // ── Not entitled (defensive — the nav item is hidden, but direct URLs reach here)
  if (!userLoading && !entitlements.canUseByoDatabase) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <span className="material-symbols-outlined text-4xl text-slate-400">database</span>
        <h1 className="mt-4 text-xl font-display font-semibold text-slate-900 dark:text-slate-100">
          Bring Your Own Database
        </h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          This feature is part of the BYOD plan. Contact us to connect your own PostgreSQL database.
        </p>
      </div>
    );
  }

  if (isLoading || userLoading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <div className="h-8 w-48 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
        <div className="mt-6 h-40 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-800" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-300">
          Couldn’t load your database status{error instanceof Error ? `: ${error.message}` : '.'}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:py-10">
      <header className="mb-6">
        <h1 className="text-2xl font-display font-bold text-slate-900 dark:text-slate-100">My Database</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Connect your own PostgreSQL database. You provide a connection string — we handle the rest.
        </p>
      </header>

      <StatusCard view={data} />

      {data.can_edit_connection ? (
        <OnboardingWizard
          view={data}
          onSubmitted={() => queryClient.invalidateQueries({ queryKey: ['byod', 'me'] })}
        />
      ) : (
        <LivePanel view={data} />
      )}
    </div>
  );
}

// ── Status card ───────────────────────────────────────────────────────────────
const REQUEST_COPY: Record<PendingChange['kind'], string> = {
  reconnect: 'You’ve requested a reconnect. Our team will re-provision your database and update the status here.',
  leave: 'You’ve requested to leave BYOD. Our team will safely move your data back and follow up — your database is never deleted.',
};

function StatusCard({ view }: { view: MeView }) {
  const { status, connection, pending_change } = view;
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-slate-400">database</span>
          <h2 className="text-sm font-display font-semibold text-slate-900 dark:text-slate-100">Connection status</h2>
        </div>
        {status ? <StatusBadge status={status} /> : (
          <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-400">
            Not started
          </span>
        )}
      </div>

      <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">
        {status ? (STATUS_COPY[status] ?? '') : 'You haven’t connected a database yet. Follow the steps below to get started.'}
      </p>

      {connection && (
        <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-xs text-slate-400">Connection</dt>
            <dd className="font-mono text-slate-700 dark:text-slate-300">{connection.masked_url}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-400">Schema version</dt>
            <dd className="text-slate-700 dark:text-slate-300">{connection.schema_version ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-400">Last health check</dt>
            <dd className="text-slate-700 dark:text-slate-300">{fmtDate(connection.last_health_at)}</dd>
          </div>
        </dl>
      )}

      {/* Persistent open-request banner (server truth — survives reloads). */}
      {pending_change && (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800 dark:border-blue-900/40 dark:bg-blue-900/20 dark:text-blue-300">
          <span className="material-symbols-outlined mt-0.5 text-[18px]">hourglass_top</span>
          <div>
            <p>{REQUEST_COPY[pending_change.kind]}</p>
            {pending_change.requested_at && (
              <p className="mt-0.5 text-xs text-blue-700/70 dark:text-blue-400/70">
                Requested {fmtDate(pending_change.requested_at)}
              </p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

// ── Requirements ────────────────────────────────────────────────────────────────
function CopyableIp({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch { /* clipboard unavailable — no-op */ }
      }}
      className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 font-mono text-xs text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
    >
      {value}
      <span className="material-symbols-outlined text-[14px]">{copied ? 'check' : 'content_copy'}</span>
    </button>
  );
}

function RequirementsCard({ requirements }: { requirements: Requirements }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <h3 className="text-sm font-display font-semibold text-slate-900 dark:text-slate-100">Before you start</h3>

      <div className="mt-4">
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
          Allowlist our egress IP ranges on your database firewall:
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {requirements.egress_ip_ranges.map((ip) => (
            <CopyableIp key={ip} value={ip} />
          ))}
        </div>
      </div>

      <ul className="mt-4 space-y-2 text-sm text-slate-600 dark:text-slate-400">
        {requirements.checklist.map((item) => (
          <li key={item} className="flex items-start gap-2">
            <span className="material-symbols-outlined mt-0.5 text-[16px] text-emerald-500">check_circle</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>

      <p className="mt-4 rounded-lg bg-slate-50 p-3 font-mono text-xs text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
        {requirements.dsn_format}
      </p>
    </div>
  );
}

// ── Onboarding wizard (paste → test → submit) ──────────────────────────────────
function OnboardingWizard({ view, onSubmitted }: { view: MeView; onSubmitted: () => void }) {
  const authedFetch = useAuthenticatedFetch();
  const [dsn, setDsn] = useState('');
  const [tested, setTested] = useState<TestOk | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const testMutation = useMutation({
    mutationFn: (db_url: string) =>
      authedFetch<TestOk>('/api/byod/me/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ db_url }),
      }),
    onSuccess: (res) => setTested(res),
  });

  const submitMutation = useMutation({
    mutationFn: (db_url: string) =>
      authedFetch('/api/byod/me/connection', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ db_url }),
      }),
    onSuccess: () => {
      setSubmitted(true);
      onSubmitted();
    },
  });

  // Editing the DSN invalidates a prior Test result (can't submit a stale probe).
  const onDsnChange = (v: string) => {
    setDsn(v);
    if (tested) setTested(null);
    if (testMutation.isError) testMutation.reset();
  };

  const isReconnect = view.status === 'NEEDS_RECONNECT';

  if (submitted) {
    return (
      <motion.section
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center dark:border-emerald-900/40 dark:bg-emerald-900/20"
      >
        <span className="material-symbols-outlined text-3xl text-emerald-500">task_alt</span>
        <h3 className="mt-2 text-base font-display font-semibold text-emerald-800 dark:text-emerald-300">
          Submitted for review
        </h3>
        <p className="mt-1 text-sm text-emerald-700 dark:text-emerald-400">
          We’ve securely stored your connection and our team will provision it shortly.
          You’ll see the status update here.
        </p>
      </motion.section>
    );
  }

  return (
    <div className="mt-6 space-y-6">
      <RequirementsCard requirements={view.requirements} />

      <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <h3 className="text-sm font-display font-semibold text-slate-900 dark:text-slate-100">
          {isReconnect ? 'Reconnect your database' : 'Connect your database'}
        </h3>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Paste your PostgreSQL connection string. It’s validated, stored encrypted, and shown only masked.
        </p>

        <label className="mt-4 block">
          <span className="sr-only">Database connection string</span>
          <input
            type="password"
            autoComplete="off"
            spellCheck={false}
            value={dsn}
            onChange={(e) => onDsnChange(e.target.value)}
            placeholder="postgresql://user:password@host:5432/dbname?sslmode=require"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-900 shadow-sm outline-none transition-colors focus:border-slate-500 focus:ring-1 focus:ring-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          />
        </label>

        {/* Test result / error */}
        <AnimatePresence>
          {testMutation.isError && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-300"
            >
              {testMutation.error instanceof Error ? testMutation.error.message : 'Test failed.'}
            </motion.div>
          )}
          {tested && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-900/20 dark:text-emerald-300"
            >
              <div className="flex items-center gap-1.5 font-medium">
                <span className="material-symbols-outlined text-[18px]">check_circle</span>
                Connection looks good
              </div>
              <div className="mt-1 grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs text-emerald-800/80 dark:text-emerald-400/80">
                <span>Host: {tested.host}</span>
                <span>Database: {tested.dbname}</span>
                <span>pgvector: {tested.pgvector_version}</span>
                <span>Embeddings: {tested.embedding_dimensions}-dim</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
          <button
            type="button"
            disabled={!dsn || testMutation.isPending}
            onClick={() => testMutation.mutate(dsn)}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            {testMutation.isPending ? 'Testing…' : 'Test connection'}
          </button>
          <button
            type="button"
            disabled={!tested || submitMutation.isPending}
            onClick={() => submitMutation.mutate(dsn)}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
          >
            {submitMutation.isPending ? 'Submitting…' : 'Submit for review'}
          </button>
          {!tested && <span className="text-xs text-slate-400">Run a successful test to enable submit.</span>}
        </div>

        {submitMutation.isError && (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-300">
            {submitMutation.error instanceof Error ? submitMutation.error.message : 'Submit failed.'}
          </div>
        )}
      </section>
    </div>
  );
}

// ── Live / frozen panel: request reconnect or leave (admin-run) ────────────────
function LivePanel({ view }: { view: MeView }) {
  const authedFetch = useAuthenticatedFetch();
  const queryClient = useQueryClient();
  const [confirmLeave, setConfirmLeave] = useState(false);

  const requestMutation = useMutation({
    mutationFn: (kind: 'reconnect' | 'leave') =>
      authedFetch('/api/byod/me/request-change', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind }),
      }),
    onSuccess: () => {
      setConfirmLeave(false);
      // The open request now lives on the server — refetch so the persistent banner
      // (StatusCard) reflects it. No purely-local "requested" state to drift.
      queryClient.invalidateQueries({ queryKey: ['byod', 'me'] });
    },
  });

  // An already-open request (server truth) is surfaced by StatusCard's banner; here
  // we just collapse the action buttons into a muted line so there's no double UI.
  if (view.pending_change) {
    return (
      <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <h3 className="text-sm font-display font-semibold text-slate-900 dark:text-slate-100">Manage your connection</h3>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Your request is pending review (see above). Our team will follow up — there’s nothing more you need to do right now.
        </p>
      </section>
    );
  }

  return (
    <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <h3 className="text-sm font-display font-semibold text-slate-900 dark:text-slate-100">Manage your connection</h3>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
        Your connection is managed by our team for safety. Request a change and we’ll handle it without downtime.
      </p>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            disabled={requestMutation.isPending}
            onClick={() => requestMutation.mutate('reconnect')}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <span className="material-symbols-outlined text-[18px]">sync</span>
            Request reconnect
          </button>

          {confirmLeave ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={requestMutation.isPending}
                onClick={() => requestMutation.mutate('leave')}
                className="inline-flex items-center justify-center rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
              >
                Confirm leave
              </button>
              <button
                type="button"
                onClick={() => setConfirmLeave(false)}
                className="rounded-lg px-3 py-2 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmLeave(true)}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 dark:border-red-900/40 dark:bg-slate-900 dark:text-red-400 dark:hover:bg-red-900/20"
            >
              <span className="material-symbols-outlined text-[18px]">logout</span>
              Request to leave
            </button>
          )}
      </div>

      {requestMutation.isError && (
        <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-300">
          {requestMutation.error instanceof Error ? requestMutation.error.message : 'Request failed.'}
        </div>
      )}
    </section>
  );
}
