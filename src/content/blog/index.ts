import type { BlogPost } from './types';
import { post as addChatbot10Min } from './posts/add-ai-chatbot-website-10-minutes';
import { post as measureRoi } from './posts/measure-chatbot-roi';
import { post as preventHallucinations } from './posts/prevent-chatbot-hallucinations';

// Source registry. Add new posts here.
const registry: BlogPost[] = [addChatbot10Min, measureRoi, preventHallucinations];

/** All posts, newest first by publication date. */
export const allPosts: BlogPost[] = [...registry].sort((a, b) =>
  b.datePublished.localeCompare(a.datePublished)
);

/** Look up a single post by slug (undefined if not found). */
export function getPostBySlug(slug: string): BlogPost | undefined {
  return allPosts.find((p) => p.slug === slug);
}

/** All slugs — used by generateStaticParams and the sitemap. */
export function getAllSlugs(): string[] {
  return allPosts.map((p) => p.slug);
}

export type { BlogPost };
