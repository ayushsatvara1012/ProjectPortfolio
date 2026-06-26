'use client';

// Phase 5a (Analyze) — the chemical Pipeline tab's headline strip. It reuses the
// SAME react-query cache keys as QuoteRequestsPanel + AgentRequestsPanel, so it
// adds ZERO extra network calls — the KPIs are derived client-side from records
// the panels below already fetched. Read-only: no status mutation in 5a.
//
// Only rendered for chemical (vertical) bots; a generic bot never mounts this.

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { MetricCard, fmtNum, SkeletonBlock } from '@/src/app/components/insights/ui';

export type QuoteRow = {
  is_por?: boolean;
  subtotal?: number | null;
  currency?: string;
  status?: string;
};

export type SampleRow = {
  kind?: string;
  status?: string;
};

export interface PipelineKpis {
  quotes: number;       // total quote requests in the window
  priced: number;       // quotes with a real (non-POR) price
  por: number;          // price-on-request quotes routed to a human
  samples: number;      // sample requests
  quotedValue: number;  // sum of priced subtotals
  currency: string;     // currency of the quoted value (first non-empty seen)
}

/** Pure: fold raw quote + sample records into the Pipeline headline numbers. */
export function computePipelineKpis(quotes: QuoteRow[], samples: SampleRow[]): PipelineKpis {
  const q = Array.isArray(quotes) ? quotes : [];
  const s = Array.isArray(samples) ? samples : [];

  let priced = 0;
  let por = 0;
  let quotedValue = 0;
  let currency = '';

  for (const row of q) {
    if (row?.is_por) {
      por += 1;
    } else {
      priced += 1;
      const sub = typeof row?.subtotal === 'number' && !Number.isNaN(row.subtotal) ? row.subtotal : 0;
      quotedValue += sub;
      if (!currency && row?.currency) currency = row.currency;
    }
  }

  return {
    quotes: q.length,
    priced,
    por,
    samples: s.length,
    quotedValue,
    currency: currency || 'INR',
  };
}

function fmtMoney(n: number, currency: string): string {
  const sym = currency === 'INR' ? '₹' : `${currency} `;
  return `${sym}${n.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

interface Props {
  selectedBotId: string;
  authFetch: (url: string, init?: RequestInit) => Promise<unknown>;
  isAuthorized: boolean;
}

const PipelineKpisStrip = ({ selectedBotId, authFetch, isAuthorized }: Props) => {
  // Same queryKeys as the panels below → react-query serves these from one shared
  // cache entry instead of re-fetching.
  const { data: quoteData, isLoading: ql } = useQuery({
    queryKey: ['quote-requests', selectedBotId],
    queryFn: () => authFetch(`/api/companies/${selectedBotId}/quote-requests?limit=100`) as Promise<{ items: QuoteRow[] }>,
    enabled: !!selectedBotId && isAuthorized,
  });
  const { data: sampleData, isLoading: sl } = useQuery({
    queryKey: ['agent-requests', selectedBotId],
    queryFn: () => authFetch(`/api/companies/${selectedBotId}/agent-requests?limit=100`) as Promise<{ items: SampleRow[] }>,
    enabled: !!selectedBotId && isAuthorized,
  });

  if (ql || sl) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map((i) => <SkeletonBlock key={i} className="h-[110px]" />)}
      </div>
    );
  }

  const k = computePipelineKpis(quoteData?.items ?? [], sampleData?.items ?? []);

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <MetricCard label="Quote requests" value={fmtNum(k.quotes)} hint="all-time" icon="receipt_long" tone="accent" />
      <MetricCard label="Quoted value" value={fmtMoney(k.quotedValue, k.currency)} hint={`${fmtNum(k.priced)} priced`} icon="payments" tone="positive" />
      <MetricCard label="Price-on-request" value={fmtNum(k.por)} hint="routed to your team" icon="contact_support" tone="info" />
      <MetricCard label="Sample requests" value={fmtNum(k.samples)} hint="all-time" icon="science" tone="warn" />
    </div>
  );
};

export default PipelineKpisStrip;
