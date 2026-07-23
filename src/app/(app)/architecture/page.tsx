import type { Metadata } from 'next';
import Link from 'next/link';
import LazyOverviewCanvas from '@/src/components/architecture/LazyOverviewCanvas';
import { architectureRegistry } from '@/src/content/architecture/registry';

export const metadata: Metadata = {
  title: 'Architecture | Vaayu by Sapybase',
  description:
    'An interactive map of how Vaayu works — RAG retrieval, the vertical AI agent, knowledge ingestion, BI and cost metering, BYOD, and the embeddable widget.',
  alternates: { canonical: '/architecture' },
  robots: 'index, follow',
};

// Server Component shell (title/meta for LCP + SEO). The interactive canvas is a
// lazy client component so React Flow never enters the server HTML or shared bundle.
export default function ArchitecturePage() {
  return (
    <main className="relative h-full w-full">
      <div className="pointer-events-none absolute left-1/2 top-[max(1.25rem,env(safe-area-inset-top))] z-10 -translate-x-1/2 text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
          Vaayu architecture
        </p>
        <h1 className="mt-1 text-lg font-semibold text-slate-700 dark:text-slate-200">
          Interactive system map
        </h1>
      </div>
      <LazyOverviewCanvas />

      {/* The canvas is unreadable to assistive tech and its node links are not
          crawlable, so mirror the map as a real link list: keyboard + screen
          reader reachable, and internal links for SEO. Visually hidden. */}
      <nav aria-label="Vaayu features" className="sr-only">
        <ul>
          {architectureRegistry.map((f) => (
            <li key={f.id}>
              <Link href={`/architecture/${f.id}`}>
                {f.name} — {f.tagline}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </main>
  );
}
