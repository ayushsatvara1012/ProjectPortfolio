import { describe, it, expect } from 'vitest';
import { allPosts, getPostBySlug, getAllSlugs } from '@/src/content/blog';
import { buildPostMetadata } from '@/src/seo/buildMetadata';
import { buildBlogPostingLd } from '@/src/components/seo/BlogPostingJsonLd';

describe('blog content registry', () => {
  it('has at least the seed posts', () => {
    expect(allPosts.length).toBeGreaterThanOrEqual(3);
  });

  it('exposes unique, kebab-case, non-empty slugs', () => {
    const slugs = getAllSlugs();
    expect(new Set(slugs).size).toBe(slugs.length); // unique
    for (const s of slugs) {
      expect(s).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    }
  });

  it('is sorted newest-first by datePublished', () => {
    for (let i = 1; i < allPosts.length; i++) {
      expect(allPosts[i - 1].datePublished >= allPosts[i].datePublished).toBe(true);
    }
  });

  it('every post has the required non-empty fields', () => {
    for (const p of allPosts) {
      expect(p.title.length).toBeGreaterThan(0);
      expect(p.description.length).toBeGreaterThan(0);
      expect(p.body.length).toBeGreaterThan(0);
      expect(p.author.length).toBeGreaterThan(0);
      expect(p.keywords.length).toBeGreaterThan(0);
      expect(p.readingTimeMinutes).toBeGreaterThan(0);
    }
  });

  it('uses valid YYYY-MM-DD dates with modified >= published', () => {
    const re = /^\d{4}-\d{2}-\d{2}$/;
    for (const p of allPosts) {
      expect(p.datePublished).toMatch(re);
      expect(p.dateModified).toMatch(re);
      expect(p.dateModified >= p.datePublished).toBe(true);
    }
  });
});

describe('getPostBySlug', () => {
  it('returns the matching post', () => {
    const slug = getAllSlugs()[0];
    expect(getPostBySlug(slug)?.slug).toBe(slug);
  });

  it('returns undefined for an unknown slug', () => {
    expect(getPostBySlug('does-not-exist')).toBeUndefined();
  });
});

describe('buildPostMetadata', () => {
  const post = allPosts[0];
  const meta = buildPostMetadata(post);

  it('sets a canonical URL matching the slug', () => {
    expect(meta.alternates?.canonical).toBe(`https://www.sapybase.com/blog/${post.slug}`);
  });

  it('uses the article OpenGraph type with dates', () => {
    const og = meta.openGraph as any;
    expect(og.type).toBe('article');
    expect(og.publishedTime).toBe(post.datePublished);
    expect(og.modifiedTime).toBe(post.dateModified);
  });

  it('carries the post title, description, and keywords', () => {
    expect(meta.title).toBe(post.title);
    expect(meta.description).toBe(post.description);
    expect(meta.keywords).toEqual(post.keywords);
  });
});

describe('buildBlogPostingLd', () => {
  const post = allPosts[0];
  const ld = buildBlogPostingLd(post);

  it('produces a schema.org BlogPosting', () => {
    expect(ld['@context']).toBe('https://schema.org');
    expect(ld['@type']).toBe('BlogPosting');
  });

  it('includes headline, dates, author, and canonical url', () => {
    expect(ld.headline).toBe(post.title);
    expect(ld.datePublished).toBe(post.datePublished);
    expect(ld.dateModified).toBe(post.dateModified);
    expect(ld.author.name).toBe(post.author);
    expect(ld.url).toBe(`https://www.sapybase.com/blog/${post.slug}`);
  });

  it('serializes to valid JSON', () => {
    expect(() => JSON.parse(JSON.stringify(ld))).not.toThrow();
  });
});
