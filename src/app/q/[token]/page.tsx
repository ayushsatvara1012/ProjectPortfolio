import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

// Phase 4 (chemical agent hardening): the branded, read-only page a buyer opens
// from a shared quote link (widget's "View & share quote" button). No auth — the
// unguessable token in the URL IS the scope, mirrored by the backend endpoint.

type QuoteData = {
  status: 'quoted' | 'price_on_request';
  product?: string;
  grade?: string;
  pack_size?: string;
  quantity?: number;
  unit_price?: number | null;
  subtotal?: number | null;
  currency?: string;
  gst_note?: string | null;
  expires_at?: string | null;
  company: {
    name: string;
    logo_url?: string | null;
    theme_color?: string;
    bot_name?: string;
    contact_email?: string | null;
  };
};

type FetchResult =
  | { ok: true; data: QuoteData }
  | { ok: false; code: 404 | 410 | 500 };

async function fetchQuote(token: string): Promise<FetchResult> {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'https://www.sapybase.com';
  try {
    const res = await fetch(`${baseUrl}/api/public/quote/${encodeURIComponent(token)}`, {
      cache: 'no-store',
    });
    if (res.status === 404) return { ok: false, code: 404 };
    if (res.status === 410) return { ok: false, code: 410 };
    if (!res.ok) return { ok: false, code: 500 };
    return { ok: true, data: await res.json() };
  } catch {
    return { ok: false, code: 500 };
  }
}

// Same deterministic formatting as the widget's quote card (fmtINR in ChatWidget.tsx).
function fmtMoney(value: number | null | undefined, currency: string): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  const symbol = currency === 'INR' ? '₹' : `${currency} `;
  return `${symbol}${value.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  const result = await fetchQuote(token);
  if (!result.ok) {
    return { title: 'Quote | Sapybase', robots: { index: false, follow: false } };
  }
  const { data } = result;
  return {
    title: `Quote for ${data.product ?? 'your order'} | ${data.company.name}`,
    description: `A quote from ${data.company.name}, shared via Sapybase.`,
    robots: { index: false, follow: false },
  };
}

export default async function PublicQuotePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const result = await fetchQuote(token);

  if (!result.ok && result.code === 404) notFound();

  if (!result.ok) {
    // 410 expired (or a transient upstream error) — same friendly message either way.
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
        <div className="max-w-sm w-full text-center font-google">
          <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-slate-200 flex items-center justify-center">
            <span className="material-symbols-outlined text-slate-500" style={{ fontSize: 24 }}>
              schedule
            </span>
          </div>
          <h1 className="text-lg font-bold text-slate-800">This quote link is no longer available</h1>
          <p className="mt-2 text-sm text-slate-500">
            Quote links expire after a while — ask the team for a fresh quote.
          </p>
        </div>
      </main>
    );
  }

  const { data } = result;
  const theme = data.company.theme_color || '#5730F5';
  const currency = data.currency || 'INR';
  const isPor = data.status === 'price_on_request';

  return (
    <main className="min-h-screen bg-slate-50 flex items-start justify-center px-4 py-10 sm:py-16">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden font-google">
        <div className="flex items-center gap-3 px-5 py-4 text-white" style={{ backgroundColor: theme }}>
          {data.company.logo_url && (
            // eslint-disable-next-line @next/next/no-img-element -- external, owner-controlled logo URL
            <img
              src={data.company.logo_url}
              alt=""
              className="w-8 h-8 rounded-full object-cover bg-white/20"
            />
          )}
          <div>
            <div className="text-[13px] font-bold leading-tight">{data.company.name}</div>
            <div className="text-[11px] opacity-80 leading-tight">
              {isPor ? 'Quote requested' : 'Quote'}
            </div>
          </div>
        </div>

        <div className="px-5 py-5">
          <div className="text-lg font-bold text-slate-800">{data.product}</div>
          <div className="text-sm text-slate-500">
            {[data.grade, data.pack_size].filter(Boolean).join(' · ')}
          </div>

          {isPor ? (
            <div className="mt-4 rounded-xl bg-slate-50 border border-slate-200 px-4 py-3 text-sm text-slate-600">
              This pack is priced on request — the team will follow up with a price.
            </div>
          ) : (
            <div className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between text-slate-600">
                <span>Unit price</span>
                <span>{fmtMoney(data.unit_price, currency)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Quantity</span>
                <span>× {data.quantity}</span>
              </div>
              <div className="flex justify-between font-bold text-slate-800 pt-2 border-t border-slate-200">
                <span>Subtotal</span>
                <span>{fmtMoney(data.subtotal, currency)}</span>
              </div>
              <div className="text-[11px] text-slate-400 pt-1">
                {data.gst_note || 'GST extra as applicable'} · subject to confirmation
              </div>
            </div>
          )}

          {data.expires_at && (
            <div className="mt-4 text-[11px] text-slate-400">
              Valid until{' '}
              {new Date(data.expires_at).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
            </div>
          )}

          {data.company.contact_email && (
            <a
              href={`mailto:${data.company.contact_email}`}
              className="mt-5 inline-flex items-center gap-2 px-4 py-2 rounded-full text-[13px] font-bold text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: theme }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                mail
              </span>
              Contact {data.company.name}
            </a>
          )}
        </div>
      </div>
    </main>
  );
}
