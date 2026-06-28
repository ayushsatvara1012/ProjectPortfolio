'use client';

// Phase 4b (Transact) — owner view of record-and-route requests created by the
// chemical vertical agent (samples today; consult/callback later via `kind`). The
// generic counterpart to QuoteRequestsPanel. Self-hiding: a bot with no
// agent_requests (every non-chemical bot, and a chemical bot before its first
// sample) renders NOTHING, so the panel needs no vertical flag plumbed through the
// dashboard — it appears once real requests exist. Read-only (status mgmt later).

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Badge, Card } from '@/src/components/dashboard/insights/ui';

type AgentRequest = {
  id: string;
  kind?: string;
  product?: string;
  cas_number?: string | null;
  grade?: string | null;
  pack_size?: string | null;
  quantity?: number | null;
  contact_name?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  note?: string | null;
  status?: string;
  created_at?: string;
};

const KIND_LABEL: Record<string, string> = { sample: 'Sample' };

function fmtDate(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

interface Props {
  selectedBotId: string;
  authFetch: (url: string, init?: RequestInit) => Promise<unknown>;
  isAuthorized: boolean;
}

const AgentRequestsPanel = ({ selectedBotId, authFetch, isAuthorized }: Props) => {
  const { data, isLoading } = useQuery({
    queryKey: ['agent-requests', selectedBotId],
    queryFn: () => authFetch(`/api/companies/${selectedBotId}/agent-requests?limit=100`) as Promise<{ items: AgentRequest[]; count: number }>,
    enabled: !!selectedBotId && isAuthorized,
  });

  const items = data?.items ?? [];
  // Self-hide: nothing to show -> render nothing (keeps non-chemical dashboards clean).
  if (isLoading || items.length === 0) return null;

  return (
    <Card className="p-5 md:p-6 w-full min-w-0">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-[15px] font-semibold text-slate-800 dark:text-slate-100">Sample &amp; other requests</h3>
          <p className="text-[12px] text-slate-500 dark:text-slate-400">Sample requests and follow-ups captured by your chemical agent.</p>
        </div>
        <Badge tone="neutral">{items.length}</Badge>
      </div>

      <div className="overflow-x-auto -mx-1">
        <table className="w-full min-w-[640px] text-[13px]">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wide text-slate-400 dark:text-slate-500">
              <th className="py-2 px-2 font-medium">Type</th>
              <th className="py-2 px-2 font-medium">Product</th>
              <th className="py-2 px-2 font-medium">Pack</th>
              <th className="py-2 px-2 font-medium text-right">Qty</th>
              <th className="py-2 px-2 font-medium">Contact</th>
              <th className="py-2 px-2 font-medium">Status</th>
              <th className="py-2 px-2 font-medium text-right">When</th>
            </tr>
          </thead>
          <tbody>
            {items.map((r) => (
              <tr key={r.id} className="border-t border-slate-100 dark:border-slate-800 text-slate-700 dark:text-slate-200">
                <td className="py-2.5 px-2">{KIND_LABEL[r.kind || ''] || (r.kind || '—')}</td>
                <td className="py-2.5 px-2">
                  <div className="font-medium">{r.product}</div>
                  {r.grade && <div className="text-[11px] text-slate-400">{r.grade}</div>}
                </td>
                <td className="py-2.5 px-2">{r.pack_size || '—'}</td>
                <td className="py-2.5 px-2 text-right">{r.quantity ?? '—'}</td>
                <td className="py-2.5 px-2">
                  {r.contact_email || r.contact_phone
                    ? <div className="text-[12px]">{r.contact_name && <div>{r.contact_name}</div>}<div className="text-slate-400">{r.contact_email || r.contact_phone}</div></div>
                    : <span className="text-slate-300 dark:text-slate-600">—</span>}
                </td>
                <td className="py-2.5 px-2"><Badge tone="new">{r.status || 'new'}</Badge></td>
                <td className="py-2.5 px-2 text-right text-[12px] text-slate-400">{fmtDate(r.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
};

export default AgentRequestsPanel;
