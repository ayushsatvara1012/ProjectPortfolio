'use client';

// Phase 4a (Transact) — owner view of quote / price-on-request records created by
// the chemical vertical agent. Self-hiding: a bot with no quote_requests (every
// non-chemical bot, and a chemical bot before its first quote) renders NOTHING, so
// the panel needs no vertical flag plumbed through the dashboard — it simply
// appears once real quotes exist. Read-only in 4a (status mgmt is a later slice).

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Badge, Card } from '@/src/app/components/insights/ui';

type QuoteRequest = {
  id: string;
  product?: string;
  grade?: string;
  pack_size?: string;
  quantity?: number;
  unit_price?: number | null;
  subtotal?: number | null;
  gst_rate?: number | null;
  currency?: string;
  is_por?: boolean;
  contact_name?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  status?: string;
  created_at?: string;
};

const STATUS_TONE: Record<string, 'new' | 'neutral' | 'won' | 'lost'> = {
  new: 'new', sent: 'neutral', won: 'won', lost: 'lost',
};

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
}

const QuoteRequestsPanel = ({ selectedBotId, authFetch, isAuthorized }: Props) => {
  const { data, isLoading } = useQuery({
    queryKey: ['quote-requests', selectedBotId],
    queryFn: () => authFetch(`/api/companies/${selectedBotId}/quote-requests?limit=100`) as Promise<{ items: QuoteRequest[]; count: number }>,
    enabled: !!selectedBotId && isAuthorized,
  });

  const items = data?.items ?? [];
  // Self-hide: nothing to show -> render nothing (keeps non-chemical dashboards clean).
  if (isLoading || items.length === 0) return null;

  return (
    <Card className="p-5 md:p-6 w-full min-w-0">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-[15px] font-semibold text-slate-800 dark:text-slate-100">Quote requests</h3>
          <p className="text-[12px] text-slate-500 dark:text-slate-400">Prices and price-on-request enquiries from your chemical agent.</p>
        </div>
        <Badge tone="neutral">{items.length}</Badge>
      </div>

      <div className="overflow-x-auto -mx-1">
          <table className="w-full min-w-[640px] text-[13px]">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-slate-400 dark:text-slate-500">
                <th className="py-2 px-2 font-medium">Product</th>
                <th className="py-2 px-2 font-medium">Pack</th>
                <th className="py-2 px-2 font-medium text-right">Qty</th>
                <th className="py-2 px-2 font-medium text-right">Subtotal</th>
                <th className="py-2 px-2 font-medium">Contact</th>
                <th className="py-2 px-2 font-medium">Status</th>
                <th className="py-2 px-2 font-medium text-right">When</th>
              </tr>
            </thead>
            <tbody>
              {items.map((q) => (
                <tr key={q.id} className="border-t border-slate-100 dark:border-slate-800 text-slate-700 dark:text-slate-200">
                  <td className="py-2.5 px-2">
                    <div className="font-medium">{q.product}</div>
                    {q.grade && <div className="text-[11px] text-slate-400">{q.grade}</div>}
                  </td>
                  <td className="py-2.5 px-2">{q.pack_size || '—'}</td>
                  <td className="py-2.5 px-2 text-right">{q.quantity ?? '—'}</td>
                  <td className="py-2.5 px-2 text-right">
                    {q.is_por
                      ? <span className="text-[12px] text-amber-600 dark:text-amber-400">On request</span>
                      : fmtINR(q.subtotal, q.currency)}
                  </td>
                  <td className="py-2.5 px-2">
                    {q.contact_email || q.contact_phone
                      ? <div className="text-[12px]">{q.contact_name && <div>{q.contact_name}</div>}<div className="text-slate-400">{q.contact_email || q.contact_phone}</div></div>
                      : <span className="text-slate-300 dark:text-slate-600">—</span>}
                  </td>
                  <td className="py-2.5 px-2"><Badge tone={STATUS_TONE[q.status || 'new'] || 'neutral'}>{q.status || 'new'}</Badge></td>
                  <td className="py-2.5 px-2 text-right text-[12px] text-slate-400">{fmtDate(q.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
      </div>
    </Card>
  );
};

export default QuoteRequestsPanel;
