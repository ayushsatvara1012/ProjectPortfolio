'use client';

// Phase 3.2 (owner workflow) — one inbox that merges quote requests and agent
// requests (samples, …) into a single operable table. Replaces the separate
// QuoteRequestsPanel + AgentRequestsPanel views. Adds:
//   • a kind filter (All / Quotes / Samples),
//   • per-row status management wired to the Phase 3.1 PATCH endpoints,
//   • a "View chat" link back to the originating session transcript.
// Reuses the SAME react-query keys as before (['quote-requests', …] /
// ['agent-requests', …]) so PipelineKpis and cache invalidation stay in sync.
// Self-hiding: a bot with neither quotes nor agent requests renders NOTHING.

import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Badge, Card } from '@/src/components/dashboard/insights/ui';

type QuoteRequest = {
  id: string; product?: string; grade?: string; pack_size?: string;
  quantity?: number; subtotal?: number | null; currency?: string;
  is_por?: boolean; contact_name?: string | null; contact_email?: string | null;
  contact_phone?: string | null; status?: string; created_at?: string;
  session_id?: string | null;
};

type AgentRequest = {
  id: string; kind?: string; product?: string; grade?: string | null;
  pack_size?: string | null; quantity?: number | null; note?: string | null;
  contact_name?: string | null; contact_email?: string | null;
  contact_phone?: string | null; status?: string; created_at?: string;
  session_id?: string | null;
};

type Row = {
  id: string;
  source: 'quote' | 'agent';
  kind: string;              // 'quote' | 'sample' | other agent kinds
  product?: string;
  grade?: string | null;
  pack_size?: string | null;
  quantity?: number | null;
  value: React.ReactNode;    // subtotal / "On request" / "—"
  contact_name?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  status: string;
  created_at?: string;
  session_id?: string | null;
};

// Per-source status vocab — MUST mirror the backend allowed sets
// (QUOTE_REQUEST_STATUSES / AGENT_REQUEST_STATUSES) or the PATCH will 400.
const QUOTE_STATUSES = ['new', 'sent', 'won', 'lost'];
const AGENT_STATUSES = ['new', 'handled', 'won', 'lost'];

const STATUS_TONE: Record<string, 'new' | 'neutral' | 'contacted' | 'won' | 'lost'> = {
  new: 'new', sent: 'neutral', handled: 'contacted', won: 'won', lost: 'lost',
};

const KIND_LABEL: Record<string, string> = { quote: 'Quote', sample: 'Sample' };

function fmtINR(n?: number | null, currency?: string): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  const sym = (currency || 'INR') === 'INR' ? '₹' : `${currency} `;
  return `${sym}${n.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function fmtDate(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

interface Props {
  selectedBotId: string;
  authFetch: (url: string, init?: RequestInit) => Promise<unknown>;
  isAuthorized: boolean;
  onViewSession?: (sessionId: string) => void;
}

const RequestsInboxPanel = ({ selectedBotId, authFetch, isAuthorized, onViewSession }: Props) => {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<'all' | 'quote' | 'sample'>('all');

  const quoteQ = useQuery({
    queryKey: ['quote-requests', selectedBotId],
    queryFn: () => authFetch(`/api/companies/${selectedBotId}/quote-requests?limit=100`) as Promise<{ items: QuoteRequest[] }>,
    enabled: !!selectedBotId && isAuthorized,
  });
  const agentQ = useQuery({
    queryKey: ['agent-requests', selectedBotId],
    queryFn: () => authFetch(`/api/companies/${selectedBotId}/agent-requests?limit=100`) as Promise<{ items: AgentRequest[] }>,
    enabled: !!selectedBotId && isAuthorized,
  });

  const statusMutation = useMutation({
    mutationFn: ({ source, id, status }: { source: 'quote' | 'agent'; id: string; status: string }) =>
      authFetch(`/api/companies/${selectedBotId}/${source === 'quote' ? 'quote-requests' : 'agent-requests'}/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quote-requests', selectedBotId] });
      queryClient.invalidateQueries({ queryKey: ['agent-requests', selectedBotId] });
    },
  });

  const rows = useMemo<Row[]>(() => {
    const quotes: Row[] = (quoteQ.data?.items ?? []).map((q) => ({
      id: q.id, source: 'quote', kind: 'quote',
      product: q.product, grade: q.grade, pack_size: q.pack_size, quantity: q.quantity,
      value: q.is_por
        ? <span className="text-[12px] text-amber-600 dark:text-amber-400">On request</span>
        : fmtINR(q.subtotal, q.currency),
      contact_name: q.contact_name, contact_email: q.contact_email, contact_phone: q.contact_phone,
      status: q.status || 'new', created_at: q.created_at, session_id: q.session_id,
    }));
    const agents: Row[] = (agentQ.data?.items ?? []).map((r) => ({
      id: r.id, source: 'agent', kind: r.kind || 'request',
      product: r.product, grade: r.grade, pack_size: r.pack_size, quantity: r.quantity,
      value: <span className="text-slate-300 dark:text-slate-600">—</span>,
      contact_name: r.contact_name, contact_email: r.contact_email, contact_phone: r.contact_phone,
      status: r.status || 'new', created_at: r.created_at, session_id: r.session_id,
    }));
    return [...quotes, ...agents].sort((a, b) =>
      (b.created_at || '').localeCompare(a.created_at || ''));
  }, [quoteQ.data, agentQ.data]);

  const isLoading = quoteQ.isLoading || agentQ.isLoading;
  // Self-hide: nothing to show -> render nothing (keeps non-chemical dashboards clean).
  if (isLoading || rows.length === 0) return null;

  const hasQuotes = rows.some((r) => r.source === 'quote');
  const hasSamples = rows.some((r) => r.source === 'agent');
  const visible = rows.filter((r) =>
    filter === 'all' ? true : filter === 'quote' ? r.source === 'quote' : r.source === 'agent');

  const FilterBtn = ({ id, label }: { id: 'all' | 'quote' | 'sample'; label: string }) => (
    <button
      type="button"
      onClick={() => setFilter(id)}
      className={
        'px-2.5 py-1 rounded-full text-[12px] font-medium transition-colors ' +
        (filter === id
          ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900'
          : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800')
      }
    >
      {label}
    </button>
  );

  return (
    <Card className="p-5 md:p-6 w-full min-w-0">
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div>
          <h3 className="text-[15px] font-semibold text-slate-800 dark:text-slate-100">Requests</h3>
          <p className="text-[12px] text-slate-500 dark:text-slate-400">Quotes and sample requests captured by your agent — update status as you work them.</p>
        </div>
        <div className="flex items-center gap-1.5">
          {(hasQuotes && hasSamples) && (
            <div className="flex items-center gap-0.5">
              <FilterBtn id="all" label="All" />
              <FilterBtn id="quote" label="Quotes" />
              <FilterBtn id="sample" label="Samples" />
            </div>
          )}
          <Badge tone="neutral">{visible.length}</Badge>
        </div>
      </div>

      <div className="overflow-x-auto -mx-1">
        <table className="w-full min-w-[720px] text-[13px]">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wide text-slate-400 dark:text-slate-500">
              <th className="py-2 px-2 font-medium">Type</th>
              <th className="py-2 px-2 font-medium">Product</th>
              <th className="py-2 px-2 font-medium">Pack</th>
              <th className="py-2 px-2 font-medium text-right">Qty</th>
              <th className="py-2 px-2 font-medium text-right">Value</th>
              <th className="py-2 px-2 font-medium">Contact</th>
              <th className="py-2 px-2 font-medium">Status</th>
              <th className="py-2 px-2 font-medium text-right">When</th>
              <th className="py-2 px-2 font-medium" />
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => {
              const options = r.source === 'quote' ? QUOTE_STATUSES : AGENT_STATUSES;
              return (
                <tr key={`${r.source}:${r.id}`} className="border-t border-slate-100 dark:border-slate-800 text-slate-700 dark:text-slate-200">
                  <td className="py-2.5 px-2">{KIND_LABEL[r.kind] || r.kind}</td>
                  <td className="py-2.5 px-2">
                    <div className="font-medium">{r.product || '—'}</div>
                    {r.grade && <div className="text-[11px] text-slate-400">{r.grade}</div>}
                  </td>
                  <td className="py-2.5 px-2">{r.pack_size || '—'}</td>
                  <td className="py-2.5 px-2 text-right">{r.quantity ?? '—'}</td>
                  <td className="py-2.5 px-2 text-right">{r.value}</td>
                  <td className="py-2.5 px-2">
                    {r.contact_email || r.contact_phone
                      ? <div className="text-[12px]">{r.contact_name && <div>{r.contact_name}</div>}<div className="text-slate-400">{r.contact_email || r.contact_phone}</div></div>
                      : <span className="text-slate-300 dark:text-slate-600">—</span>}
                  </td>
                  <td className="py-2.5 px-2">
                    <div className="flex items-center gap-1.5">
                      <Badge tone={STATUS_TONE[r.status] || 'neutral'}>{r.status}</Badge>
                      <label className="sr-only" htmlFor={`status-${r.source}-${r.id}`}>Change status</label>
                      <select
                        id={`status-${r.source}-${r.id}`}
                        aria-label={`Change status for ${KIND_LABEL[r.kind] || r.kind} ${r.product || ''}`.trim()}
                        value={r.status}
                        disabled={statusMutation.isPending}
                        onChange={(e) => statusMutation.mutate({ source: r.source, id: r.id, status: e.target.value })}
                        className="text-[11px] rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-1 py-0.5 text-slate-600 dark:text-slate-300"
                      >
                        {options.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>
                  </td>
                  <td className="py-2.5 px-2 text-right text-[12px] text-slate-400">{fmtDate(r.created_at)}</td>
                  <td className="py-2.5 px-2 text-right">
                    {r.session_id && onViewSession && (
                      <button
                        type="button"
                        onClick={() => onViewSession(r.session_id as string)}
                        className="text-[12px] font-medium text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap"
                      >
                        View chat
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
};

export default RequestsInboxPanel;
