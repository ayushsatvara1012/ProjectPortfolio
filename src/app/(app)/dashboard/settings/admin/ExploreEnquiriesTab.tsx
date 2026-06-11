'use client';

import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthenticatedFetch } from '@/src/lib/hooks/useAuthenticatedFetch';

export type Enquiry = {
  id: string;
  email: string;
  name: string | null;
  company_name: string | null;
  use_case: string | null;
  email_class: string | null;
  status: string;
  created_at: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  review_note: string | null;
};

const STATUS_STYLE: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  approved: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  rejected: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

const CLASS_STYLE: Record<string, string> = {
  business: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  personal: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
};

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Declined' },
] as const;

function relativeTime(iso: string | null): string {
  if (!iso) return '—';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '—';
  const s = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export default function ExploreEnquiriesTab() {
  const authFetch = useAuthenticatedFetch();
  const queryClient = useQueryClient();

  const [filter, setFilter] = useState<(typeof FILTERS)[number]['key']>('pending');
  const [search, setSearch] = useState('');
  const [decliningId, setDecliningId] = useState<string | null>(null);
  const [reason, setReason] = useState('');

  // Shares the cache key with the parent's badge query (react-query dedupes).
  const enquiriesQuery = useQuery({
    queryKey: ['admin', 'explore-enquiries'],
    queryFn: () => authFetch('/api/admin/explore/enquiries') as Promise<{ enquiries: Enquiry[]; pending_count: number }>,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['admin', 'explore-enquiries'] });
    queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] });
  };

  const toast = (kind: 'success' | 'error', message: string) =>
    window.dispatchEvent(new CustomEvent('Sapybase:toast', { detail: { kind, message } }));

  const approveMutation = useMutation({
    mutationFn: (id: string) =>
      authFetch(`/api/admin/explore/enquiries/${id}/approve`, { method: 'POST' }),
    onSuccess: () => { invalidate(); toast('success', 'Enquiry approved — Explore access granted.'); },
    onError: (e: any) => toast('error', e?.message || 'Approve failed.'),
  });

  const declineMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      authFetch(`/api/admin/explore/enquiries/${id}/decline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      }),
    onSuccess: () => {
      invalidate();
      setDecliningId(null);
      setReason('');
      toast('success', 'Enquiry declined.');
    },
    onError: (e: any) => toast('error', e?.message || 'Decline failed.'),
  });

  const all = enquiriesQuery.data?.enquiries || [];
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return all.filter(e => {
      const matchesStatus = filter === 'all' || e.status === filter;
      const matchesTerm =
        !term ||
        e.email?.toLowerCase().includes(term) ||
        (e.company_name || '').toLowerCase().includes(term);
      return matchesStatus && matchesTerm;
    });
  }, [all, filter, search]);

  if (enquiriesQuery.isLoading) {
    return <div className="p-12 text-center text-base font-google text-slate-400">Loading enquiries…</div>;
  }
  if (enquiriesQuery.isError) {
    return <div className="p-12 text-center text-base font-google text-red-500">Failed to load enquiries.</div>;
  }

  return (
    <div className="space-y-4">
      {/* Filters + search */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="overflow-x-auto scrollbar-hide -mx-1 px-1">
        <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-xl p-1 w-fit">
          {FILTERS.map(f => {
            const count = f.key === 'all' ? all.length : all.filter(e => e.status === f.key).length;
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
          placeholder="Search email or company…"
          className="flex-1 sm:max-w-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2 text-sm font-google text-slate-800 dark:text-slate-200 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-blue-500/30"
        />
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="p-12 text-center text-base font-google text-slate-400 dark:text-slate-500">
          No enquiries here.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(e => {
            const isPending = e.status === 'pending';
            const busy =
              (approveMutation.isPending && approveMutation.variables === e.id) ||
              (declineMutation.isPending && (declineMutation.variables as any)?.id === e.id);
            return (
              <div
                key={e.id}
                className="bg-white dark:bg-slate-900 rounded-2xl p-5 transition-colors duration-300 border border-transparent hover:border-slate-200 dark:hover:border-slate-800"
              >
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                  {/* Identity + details */}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-1.5">
                      <span className="text-base font-semibold font-google text-slate-900 dark:text-slate-100 truncate">
                        {e.name || e.email}
                      </span>
                      <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium font-google rounded-full ${STATUS_STYLE[e.status] || STATUS_STYLE.pending}`}>
                        {e.status === 'rejected' ? 'declined' : e.status}
                      </span>
                      {e.email_class && (
                        <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium font-google rounded-full ${CLASS_STYLE[e.email_class] || CLASS_STYLE.personal}`}>
                          {e.email_class}
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-google text-slate-500 dark:text-slate-400 truncate">{e.email}</p>
                    {e.company_name && (
                      <p className="text-sm font-google text-slate-500 dark:text-slate-400">
                        <span className="text-slate-400 dark:text-slate-500">Company:</span> {e.company_name}
                      </p>
                    )}
                    {e.use_case && (
                      <p className="mt-1.5 text-sm font-google text-slate-600 dark:text-slate-300 leading-relaxed">
                        {e.use_case}
                      </p>
                    )}
                    <p className="mt-2 text-xs font-google text-slate-400 dark:text-slate-500">
                      Applied {relativeTime(e.created_at)}
                      {e.reviewed_at && ` · reviewed by ${e.reviewed_by || 'admin'} ${relativeTime(e.reviewed_at)}`}
                    </p>
                    {e.status === 'rejected' && e.review_note && (
                      <p className="mt-1 text-xs font-google text-red-500 dark:text-red-400">
                        Reason: {e.review_note}
                      </p>
                    )}
                  </div>

                  {/* Actions (pending only) */}
                  {isPending && (
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        disabled={busy}
                        onClick={() => approveMutation.mutate(e.id)}
                        className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium font-google rounded-full bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-60 transition-colors"
                      >
                        <span className="material-symbols-outlined text-[16px]">check</span>
                        Approve
                      </button>
                      <button
                        disabled={busy}
                        onClick={() => { setDecliningId(e.id); setReason(''); }}
                        className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium font-google rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-60 transition-colors"
                      >
                        Decline
                      </button>
                    </div>
                  )}
                </div>

                {/* Inline decline reason */}
                {isPending && decliningId === e.id && (
                  <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                    <label className="text-sm font-google font-medium text-slate-700 dark:text-slate-300">
                      Reason for declining <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      value={reason}
                      onChange={ev => setReason(ev.target.value)}
                      rows={2}
                      placeholder="e.g. not a genuine business use case"
                      className="mt-1.5 w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-sm font-google text-slate-800 dark:text-slate-200 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-red-500/30 resize-none"
                    />
                    <div className="mt-2 flex items-center gap-2">
                      <button
                        disabled={reason.trim().length < 3 || declineMutation.isPending}
                        onClick={() => declineMutation.mutate({ id: e.id, reason: reason.trim() })}
                        className="px-4 py-2 text-sm font-medium font-google rounded-full bg-red-600 hover:bg-red-500 text-white disabled:opacity-50 transition-colors"
                      >
                        Confirm decline
                      </button>
                      <button
                        onClick={() => { setDecliningId(null); setReason(''); }}
                        className="px-4 py-2 text-sm font-medium font-google rounded-full text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
