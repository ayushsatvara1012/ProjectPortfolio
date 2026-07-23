import { MetadataRoute } from 'next'
import { allPosts } from '@/src/content/blog'
import { architectureRegistry } from '@/src/content/architecture/registry'

const baseUrl = 'https://www.sapybase.com'

// Real content-update dates. Bump a route's date only when its CONTENT
// meaningfully changes — this is the signal Google uses for crawl priority.
const routes: { path: string; lastModified: string; priority: number }[] = [
  { path: '',                      lastModified: '2026-06-04', priority: 1.0 },
  { path: '/vaayu',                lastModified: '2026-06-04', priority: 0.9 },
  { path: '/pricing',              lastModified: '2026-06-02', priority: 0.8 },
  { path: '/about',                lastModified: '2026-06-02', priority: 0.8 },
  { path: '/contact',              lastModified: '2026-05-30', priority: 0.8 },
  { path: '/services',             lastModified: '2026-05-30', priority: 0.8 },
  { path: '/docs',                 lastModified: '2026-05-30', priority: 0.8 },
  { path: '/blog',                 lastModified: '2026-06-02', priority: 0.7 },
  { path: '/architecture',         lastModified: '2026-07-22', priority: 0.7 },
  { path: '/privacy-policy',       lastModified: '2026-05-30', priority: 0.5 },
  { path: '/terms-and-conditions', lastModified: '2026-05-30', priority: 0.5 },
]

export default function sitemap(): MetadataRoute.Sitemap {
  const staticEntries = routes.map(({ path, lastModified, priority }) => ({
    url: `${baseUrl}${path}`,
    lastModified: new Date(lastModified),
    changeFrequency: 'weekly' as const,
    priority,
  }))

  // Each blog article, using its own content-update date.
  const blogEntries = allPosts.map((post) => ({
    url: `${baseUrl}/blog/${post.slug}`,
    lastModified: new Date(post.dateModified),
    changeFrequency: 'monthly' as const,
    priority: 0.6,
  }))

  // Every /architecture/[feature] route, derived from the registry (single
  // source of truth): a new feature entry appears here with zero extra wiring.
  const architectureEntries = architectureRegistry.map((f) => ({
    url: `${baseUrl}/architecture/${f.id}`,
    lastModified: new Date('2026-07-22'),
    changeFrequency: 'monthly' as const,
    priority: 0.6,
  }))

  return [...staticEntries, ...blogEntries, ...architectureEntries]
}
