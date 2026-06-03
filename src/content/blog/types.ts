// Typed blog content registry — see ./index.ts for the aggregated list + helpers.
// Posts are plain TS objects (zero-dependency, fully type-safe, statically
// generated). The `body` field is Markdown rendered with react-markdown.

export interface BlogPost {
  /** URL slug — must be unique and kebab-case. */
  slug: string;
  /** <title> + H1 + og:title. */
  title: string;
  /** Meta description + og:description (~150–160 chars). */
  description: string;
  /** Target search keywords for this article. */
  keywords: string[];
  /** First publication date, 'YYYY-MM-DD'. */
  datePublished: string;
  /** Last meaningful content update, 'YYYY-MM-DD' (drives sitemap lastModified). */
  dateModified: string;
  /** Author display name. */
  author: string;
  /** Approximate reading time in minutes (shown in the UI). */
  readingTimeMinutes: number;
  /** Article body as Markdown. */
  body: string;
}
