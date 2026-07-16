'use client';

// Fleet-wide counterpart to RequestsInboxPanel (owner dashboard): every chemical-agent
// handoff request (quote/sample/consult) across every tenant, joined with the owning
// company. Mirrors the ByodTab fleet pattern — same step-up-gated admin fetch, same
// filter-pill + table/card layout — since GET /api/admin/agent-requests carries visitor
// contact PII across the whole fleet, not just one company's own bot.

import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useFreshAdminFetch } from './ByodTab';

type AgentRequestFleetItem = {
  id: string;
  kind: string;
  product: string | null;
  cas_number: string | null;
  grade: string | null;
  pack_size: string | null;
  quantity: number | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  note: string | null;
  status: string;
  created_at: string;
  session_id: string | null;
  company_id: string;
  company_name: string | null;
  bot_name: string | null;
};

// MUST mirror the backend's AGENT_REQUEST_STATUSES or the PATCH will 400.
const AGENT_STATUSES = ['new', 'handled', 'won', 'lost'];

const STATUS_STYLE: Record<string, string> = {
  new:     'bg-sky-50 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
  handled: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  won:     'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  lost:    'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
};

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'new', label: 'New' },
  { key: 'handled', label: 'Handled' },
  { key: 'won', label: 'Won' },
  { key: 'lost', label: 'Lost' },
] as const;

const fmtDate = (iso: string | null) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const kindLabel = (kind: string) => kind ? kind.charAt(0).toUpperCase() + kind.slice(1) : 'Request';

const StatusPill = ({ status }: { status: string }) => (
  <span className={`inline-flex items-center px-2.5 py-0.5 text-xs font-medium font-google rounded-full ${STATUS_STYLE[status] || STATUS_STYLE.new}`}>
    {status}
  </span>
);

export default function AgentRequestsTab() {
  const freshFetch = useFreshAdminFetch();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['key']>('all');
  const [search, setSearch] = useState('');

  const requestsQuery = useQuery({
    queryKey: ['admin', 'agent-requests', filter],
    queryFn: () => freshFetch(`/api/admin/agent-requests?limit=200&status=${filter}`) as Promise<{ items: AgentRequestFleetItem[]; count: number }>,
  });

  const statusMutation = useMutation({
    mutationFn: ({ companyId, id, status }: { companyId: string; id: string; status: string }) =>
      freshFetch(`/api/companies/${companyId}/agent-requests/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'agent-requests'] }),
  });

  const all = useMemo(() => requestsQuery.data?.items || [], [requestsQuery.data]);
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return all;
    return all.filter(r =>
      (r.company_name || '').toLowerCase().includes(term) ||
      (r.product || '').toLowerCase().includes(term) ||
      (r.contact_name || '').toLowerCase().includes(term) ||
      (r.contact_email || '').toLowerCase().includes(term));
  }, [all, search]);

  if (requestsQuery.isLoading) {
    return <div className="p-12 text-center text-base font-google text-slate-400">Loading agent requests…</div>;
  }
  if (requestsQuery.isError) {
    return (
      <div className="p-12 text-center">
        <p className="text-base font-google text-red-500 mb-3">Failed to load agent requests.</p>
        <button onClick={() => requestsQuery.refetch()}
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
            {FILTERS.map(f => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`px-3.5 py-1.5 text-sm font-medium font-google rounded-lg whitespace-nowrap transition-all ${
                  filter === f.key
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search company, product, or contact…"
          className="flex-1 sm:max-w-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2 text-sm font-google text-slate-800 dark:text-slate-200 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-blue-500/30"
        />
      </div>

      {/* Empty state */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
          <span className="material-symbols-outlined text-[32px] text-slate-300 dark:text-slate-600 mb-2 block">inbox</span>
          <p className="text-base font-google text-slate-400">
            {all.length === 0 ? 'No agent requests yet.' : 'No requests match this filter.'}
          </p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block bg-white dark:bg-slate-900 rounded-2xl overflow-hidden transition-colors duration-500">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800">
                  <th className="py-4 px-5 text-xs font-medium font-google text-slate-400">Company</th>
                  <th className="py-4 px-5 text-xs font-medium font-google text-slate-400">Type</th>
                  <th className="py-4 px-5 text-xs font-medium font-google text-slate-400">Product</th>
                  <th className="py-4 px-5 text-xs font-medium font-google text-slate-400">Contact</th>
                  <th className="py-4 px-5 text-xs font-medium font-google text-slate-400">Status</th>
                  <th className="py-4 px-5 text-xs font-medium font-google text-slate-400">When</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                {filtered.map(r => (
                  <tr key={r.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900 transition-colors">
                    <td className="py-4 px-5 min-w-0">
                      <p className="text-base font-google text-slate-900 dark:text-slate-100 truncate max-w-[200px]">{r.company_name || 'Unnamed'}</p>
                      <p className="text-xs font-google text-slate-400 dark:text-slate-500 truncate max-w-[200px] mt-0.5">{r.bot_name || ''}</p>
                    </td>
                    <td className="py-4 px-5 text-sm font-google text-slate-600 dark:text-slate-300 whitespace-nowrap">{kindLabel(r.kind)}</td>
                    <td className="py-4 px-5 min-w-0">
                      <p className="text-sm font-google text-slate-800 dark:text-slate-200 truncate max-w-[220px]">{r.product || '—'}</p>
                      {r.grade && <p className="text-xs font-google text-slate-400 dark:text-slate-500">{r.grade}</p>}
                    </td>
                    <td className="py-4 px-5 min-w-0">
                      {r.contact_email || r.contact_phone ? (
                        <div className="text-xs font-google">
                          {r.contact_name && <p className="text-slate-700 dark:text-slate-300">{r.contact_name}</p>}
                          <p className="text-slate-400 dark:text-slate-500 truncate max-w-[200px]">{r.contact_email || r.contact_phone}</p>
                        </div>
                      ) : <span className="text-slate-300 dark:text-slate-600">—</span>}
                    </td>
                    <td className="py-4 px-5">
                      <div className="flex items-center gap-1.5">
                        <StatusPill status={r.status} />
                        <label className="sr-only" htmlFor={`status-${r.id}`}>Change status</label>
                        <select
                          id={`status-${r.id}`}
                          value={r.status}
                          disabled={statusMutation.isPending}
                          onChange={e => statusMutation.mutate({ companyId: r.company_id, id: r.id, status: e.target.value })}
                          className="text-xs font-google rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-1 py-0.5 text-slate-600 dark:text-slate-300"
                        >
                          {AGENT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                    </td>
                    <td className="py-4 px-5 text-xs font-google text-slate-500 dark:text-slate-400 whitespace-nowrap">{fmtDate(r.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden flex flex-col gap-4">
            {filtered.map(r => (
              <div key={r.id} className="bg-white dark:bg-slate-900 rounded-2xl p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-base font-google text-slate-900 dark:text-slate-100 truncate">{r.company_name || 'Unnamed'}</p>
                    <p className="text-xs font-google text-slate-400 dark:text-slate-500">{kindLabel(r.kind)} · {r.product || '—'}</p>
                  </div>
                  <StatusPill status={r.status} />
                </div>
                {(r.contact_email || r.contact_phone) && (
                  <p className="text-xs font-google text-slate-500 dark:text-slate-400">{r.contact_name ? `${r.contact_name} · ` : ''}{r.contact_email || r.contact_phone}</p>
                )}
                <div className="flex items-center justify-between gap-3 pt-1">
                  <select
                    value={r.status}
                    disabled={statusMutation.isPending}
                    onChange={e => statusMutation.mutate({ companyId: r.company_id, id: r.id, status: e.target.value })}
                    className="text-xs font-google rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-slate-600 dark:text-slate-300"
                  >
                    {AGENT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <span className="text-xs font-google text-slate-400 dark:text-slate-500">{fmtDate(r.created_at)}</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
