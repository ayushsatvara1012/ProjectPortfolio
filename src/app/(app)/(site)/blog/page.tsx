import type { Metadata } from 'next';
import Link from 'next/link';
import { buildMetadata } from '@/src/seo/buildMetadata';
import BreadcrumbJsonLd from '@/src/components/seo/BreadcrumbJsonLd';
import { allPosts } from '@/src/content/blog';

export const metadata: Metadata = buildMetadata('blog');

function formatDate(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export default function BlogIndexPage() {
  return (
    <div className="bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-200 min-h-screen transition-colors duration-500">
      <BreadcrumbJsonLd trail={[{ name: 'Blog', path: '/blog' }]} />

      <div className="max-w-3xl mx-auto px-6 py-16 sm:py-24">
        <header className="mb-12">
          <p className="text-[11px] uppercase tracking-widest font-bold text-blue-500 dark:text-blue-400 font-google mb-3">
            Sapybase Blog
          </p>
          <h1 className="text-4xl sm:text-5xl font-display font-bold tracking-tight mb-4">
            Guides for building AI support that works
          </h1>
          <p className="text-lg font-display text-slate-500 dark:text-slate-400 leading-relaxed">
            Practical, no-fluff guides on launching AI chatbots, measuring ROI, capturing leads,
            and keeping answers accurate — written for non-technical teams.
          </p>
        </header>

        <ul className="flex flex-col divide-y divide-gray-100 dark:divide-slate-800">
          {allPosts.map((post) => (
            <li key={post.slug}>
              <Link
                href={`/blog/${post.slug}`}
                className="group block py-7 transition-colors"
              >
                <div className="flex items-center gap-3 mb-2 text-[11px] uppercase tracking-widest font-bold text-slate-400 dark:text-slate-500 font-google">
                  <time dateTime={post.datePublished}>{formatDate(post.datePublished)}</time>
                  <span aria-hidden="true">·</span>
                  <span>{post.readingTimeMinutes} min read</span>
                </div>
                <h2 className="text-2xl font-display font-bold tracking-tight mb-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                  {post.title}
                </h2>
                <p className="text-md font-display text-slate-500 dark:text-slate-400 leading-relaxed">
                  {post.description}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
