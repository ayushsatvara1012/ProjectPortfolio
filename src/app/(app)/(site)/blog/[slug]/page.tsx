import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize from 'rehype-sanitize';
import type { Components } from 'react-markdown';
import { buildPostMetadata } from '@/src/seo/buildMetadata';
import BreadcrumbJsonLd from '@/src/components/seo/BreadcrumbJsonLd';
import BlogPostingJsonLd from '@/src/components/seo/BlogPostingJsonLd';
import { getPostBySlug, getAllSlugs } from '@/src/content/blog';

export function generateStaticParams() {
  return getAllSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) return {};
  return buildPostMetadata(post);
}

function formatDate(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

// Tailwind-styled renderers (no external typography plugin needed).
const MD: Components = {
  h2: ({ children }) => (
    <h2 className="text-2xl font-display font-bold tracking-tight mt-12 mb-4">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-xl font-display font-bold tracking-tight mt-8 mb-3">{children}</h3>
  ),
  p: ({ children }) => (
    <p className="text-md font-display text-slate-700 dark:text-slate-300 leading-relaxed my-4">{children}</p>
  ),
  ul: ({ children }) => <ul className="list-disc pl-6 my-4 flex flex-col gap-2">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal pl-6 my-4 flex flex-col gap-2">{children}</ol>,
  li: ({ children }) => (
    <li className="text-md font-display text-slate-700 dark:text-slate-300 leading-relaxed">{children}</li>
  ),
  a: ({ href, children }) => (
    <Link href={href || '#'} className="text-blue-600 dark:text-blue-400 underline underline-offset-2 hover:opacity-80">
      {children}
    </Link>
  ),
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-blue-300 dark:border-blue-800 pl-4 my-6 text-slate-500 dark:text-slate-400 italic">
      {children}
    </blockquote>
  ),
  code: ({ children }) => (
    <code className="font-mono text-sm bg-slate-100 dark:bg-slate-800 rounded px-1.5 py-0.5">{children}</code>
  ),
  pre: ({ children }) => (
    <pre className="bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 my-6 overflow-x-auto text-sm">
      {children}
    </pre>
  ),
  strong: ({ children }) => <strong className="font-bold text-slate-900 dark:text-slate-100">{children}</strong>,
  table: ({ children }) => (
    <div className="w-full overflow-x-auto my-8 border border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-950">
      <table className="w-full text-sm text-left border-collapse min-w-[600px]">{children}</table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-700 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-800 text-[11px] uppercase tracking-wider">{children}</thead>
  ),
  tbody: ({ children }) => <tbody className="divide-y divide-slate-200 dark:divide-slate-800">{children}</tbody>,
  tr: ({ children }) => <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-900/10 transition-colors">{children}</tr>,
  th: ({ children }) => <th className="px-6 py-4 font-google font-bold text-slate-900 dark:text-slate-100">{children}</th>,
  td: ({ children }) => <td className="px-6 py-4 font-google text-slate-700 dark:text-slate-300 leading-relaxed">{children}</td>,
};

export default async function BlogArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) notFound();

  return (
    <div className="bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-200 min-h-screen transition-colors duration-500">
      <BreadcrumbJsonLd
        trail={[
          { name: 'Blog', path: '/blog' },
          { name: post.title, path: `/blog/${post.slug}` },
        ]}
      />
      <BlogPostingJsonLd post={post} />

      <article className="max-w-3xl mx-auto px-6 py-16 sm:py-24">
        <Link
          href="/blog"
          className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-widest font-bold text-slate-400 dark:text-slate-500 hover:text-blue-500 dark:hover:text-blue-400 font-google mb-8 transition-colors"
        >
          ← All articles
        </Link>

        <header className="mb-8">
          <div className="flex items-center gap-3 mb-4 text-[11px] uppercase tracking-widest font-bold text-slate-400 dark:text-slate-500 font-google">
            <time dateTime={post.datePublished}>{formatDate(post.datePublished)}</time>
            <span aria-hidden="true">·</span>
            <span>{post.readingTimeMinutes} min read</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-display font-bold tracking-tight leading-[1.1] mb-4">
            {post.title}
          </h1>
          <p className="text-lg font-display text-slate-500 dark:text-slate-400 leading-relaxed">
            {post.description}
          </p>
          <p className="mt-4 text-sm font-google text-slate-400 dark:text-slate-500">By {post.author}</p>
        </header>

        <div>
          <ReactMarkdown 
            remarkPlugins={[remarkGfm]} 
            rehypePlugins={[rehypeSanitize]} 
            components={MD}
          >
            {post.body}
          </ReactMarkdown>
        </div>
      </article>
    </div>
  );
}
