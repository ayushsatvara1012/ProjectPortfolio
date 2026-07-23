import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { architectureRegistry, getFeature } from '@/src/content/architecture/registry';
import DetailDiagrams from '@/src/components/architecture/DetailDiagrams';

const SITE_URL = 'https://www.sapybase.com';

// Every detail route is known at build time from the registry, so these pages
// are statically generated (best LCP + crawlability).
export function generateStaticParams() {
  return architectureRegistry.map((f) => ({ feature: f.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ feature: string }>;
}): Promise<Metadata> {
  const { feature } = await params;
  const f = getFeature(feature);
  if (!f) return {};

  const title = `${f.name} — Architecture | Vaayu by Sapybase`;
  const description = f.narrative ?? f.tagline;
  const url = `${SITE_URL}/architecture/${f.id}`;
  return {
    title,
    description,
    alternates: { canonical: `/architecture/${f.id}` },
    robots: 'index, follow',
    openGraph: {
      type: 'website',
      siteName: 'Sapybase',
      url,
      title,
      description,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  };
}

const STATUS_STYLE: Record<'live' | 'planned', string> = {
  live: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/70 dark:bg-emerald-950/40 dark:text-emerald-300',
  planned:
    'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800/70 dark:bg-amber-950/40 dark:text-amber-300',
};

// Empty state for features without authored diagrams yet (hasDetail:false, or a
// hasDetail:true entry whose diagrams land in a later phase). Never a broken canvas.
function ComingSoon({ tagline }: { tagline: string }) {
  return (
    <div className="mt-10 flex flex-col items-center rounded-2xl border border-dashed border-slate-300 bg-white/60 px-6 py-14 text-center dark:border-slate-700 dark:bg-slate-900/40">
      <span className="material-symbols-outlined text-4xl text-slate-300 dark:text-slate-600" aria-hidden>
        architecture
      </span>
      <p className="mt-4 max-w-md text-sm text-slate-500 dark:text-slate-400">{tagline}</p>
      <p className="mt-2 text-sm font-medium text-slate-700 dark:text-slate-300">
        A detailed diagram for this feature is coming soon.
      </p>
    </div>
  );
}

// Server Component shell (title/meta for SEO + LCP). Interactive diagrams mount
// via the client wrapper so React Flow / Mermaid never enter the server HTML.
export default async function FeatureDetailPage({
  params,
}: {
  params: Promise<{ feature: string }>;
}) {
  const { feature } = await params;
  const f = getFeature(feature);
  if (!f) notFound();

  const hasDiagrams = Boolean(f.dataFlow || f.mermaid);

  return (
    <main className="h-full w-full overflow-y-auto">
      <div className="mx-auto max-w-5xl px-4 pt-20 sm:px-6 sm:pt-24">
        <header>
          <div className="flex items-center gap-3">
            <span
              className="material-symbols-outlined text-3xl text-slate-400 dark:text-slate-500"
              aria-hidden
            >
              {f.overview.icon}
            </span>
            <span
              className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${STATUS_STYLE[f.status]}`}
            >
              {f.status}
            </span>
          </div>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
            {f.name}
          </h1>
          <p className="mt-2 max-w-2xl text-base text-slate-500 dark:text-slate-400">{f.tagline}</p>
        </header>

        {f.narrative ? (
          <p className="mt-6 max-w-2xl text-[15px] leading-relaxed text-slate-600 dark:text-slate-300">
            {f.narrative}
          </p>
        ) : null}
      </div>

      {/* Full-bleed section: the diagrams get the whole viewport width (just a
          little padding) for an immersive canvas, matching the overview map's
          full-viewport feel, while the surrounding text stays readable-width. */}
      <div className="w-full px-3 py-10 sm:px-6">
        {hasDiagrams ? (
          <DetailDiagrams dataFlow={f.dataFlow} mermaid={f.mermaid} />
        ) : (
          <div className="mx-auto max-w-5xl">
            <ComingSoon tagline={f.tagline} />
          </div>
        )}
      </div>

      <div className="mx-auto max-w-5xl px-4 pb-24 sm:px-6">
        {f.guardrails && f.guardrails.length > 0 ? (
          <section aria-labelledby="arch-guardrails-heading">
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-6 dark:border-slate-800 dark:bg-slate-900/50">
              <div className="flex items-center gap-2">
                <span
                  className="material-symbols-outlined text-[20px] text-emerald-600 dark:text-emerald-400"
                  aria-hidden
                >
                  verified_user
                </span>
                <h2
                  id="arch-guardrails-heading"
                  className="text-sm font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300"
                >
                  Operating guardrails
                </h2>
              </div>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Constraints enforced in code, described at category level.
              </p>
              <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                {f.guardrails.map((g, i) => (
                  <li key={i} className="flex gap-2.5 text-sm text-slate-600 dark:text-slate-300">
                    <span
                      className="material-symbols-outlined mt-0.5 text-[18px] text-emerald-600 dark:text-emerald-400"
                      aria-hidden
                    >
                      check_circle
                    </span>
                    <span>{g}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}
