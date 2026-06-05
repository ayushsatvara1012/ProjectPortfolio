import { MetadataRoute } from 'next'

// Private / non-indexable areas — kept out of every crawler.
const DISALLOW = [
  '/dashboard/',
  '/demo/',
  '/embed/',
  '/sign-in/',
  '/sign-up/',
  '/sso-callback',
  '/api/',
]

// AI / answer-engine crawlers we explicitly welcome (GEO/AEO). Listing them
// individually makes the intent unambiguous and lets us allow citation/search
// agents even where a publisher might otherwise block training bots.
const AI_AGENTS = [
  'GPTBot',            // OpenAI — training/index
  'OAI-SearchBot',     // OpenAI — ChatGPT Search
  'ChatGPT-User',      // OpenAI — live browsing on user request
  'ClaudeBot',         // Anthropic — index
  'Claude-User',       // Anthropic — Claude live fetch
  'Claude-SearchBot',  // Anthropic — Claude search
  'anthropic-ai',      // Anthropic — legacy
  'Google-Extended',   // Google — Gemini/Vertex grounding
  'PerplexityBot',     // Perplexity — index
  'Perplexity-User',   // Perplexity — live fetch
  'Applebot',          // Apple — Siri/Spotlight/Safari
  'Applebot-Extended', // Apple Intelligence
  'Bingbot',           // Microsoft / Copilot
  'DuckAssistBot',     // DuckDuckGo AI
  'Amazonbot',         // Amazon / Alexa
  'Meta-ExternalAgent',// Meta AI
  'cohere-ai',         // Cohere
  'YouBot',            // You.com
  'Bytespider',        // ByteDance / Doubao
  'CCBot',             // Common Crawl (feeds many LLMs)
]

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      // Default: everything indexable except private areas.
      { userAgent: '*', allow: '/', disallow: DISALLOW },
      // Explicitly welcome each AI / answer engine to the public site.
      ...AI_AGENTS.map((userAgent) => ({ userAgent, allow: '/', disallow: DISALLOW })),
    ],
    sitemap: 'https://www.sapybase.com/sitemap.xml',
    host: 'https://www.sapybase.com',
  }
}
