// ─────────────────────────────────────────────────────────────────────────────
// Brand constants — single source of truth for the Sapybase ⇄ Vaayu split.
//
// Model: "Vaayu by Sapybase" (endorsed brand architecture, Anthropic ⇄ Claude style)
//   • SAPYBASE = the company (corporate layer: about, legal, founder, footer).
//   • VAAYU    = the product (the Business Intelligence console: leads, funnel,
//                ROI, conversations) that businesses log into and deploy.
//
// IMPORTANT (multi-tenant / white-label): Vaayu is the PLATFORM brand, not the
// name every deployed bot says. Each customer's bot keeps its own `bot_name` /
// `company_name`. Do NOT use these constants to override per-tenant bot identity.
// ─────────────────────────────────────────────────────────────────────────────

/** The company. Corporate layer. */
export const COMPANY = {
  name: 'Sapybase',
  legalName: 'Sapybase',
  url: 'https://www.sapybase.com',
} as const;

/** The product. Vaayu — the Business Intelligence console. */
export const PRODUCT = {
  name: 'Vaayu',
  tagline: 'Vaayu — A Business Intelligence',
  /** Path to the product mark in /public. */
  logo: '/nav_brand.svg',
  /** Short endorsement suffix, e.g. for footers and lockups. */
  endorsement: 'by Sapybase',
  /** Full endorsed lockup string. */
  lockup: 'Vaayu by Sapybase',
} as const;

/**
 * Brand accent for the product — taken from the vaayu_logo.svg gradient
 * (#004DE8 → #002B82). Mirrors the `vaayu` color scale in tailwind.config.js;
 * keep these two in sync.
 */
export const VAAYU_ACCENT = {
  base: '#004DE8', // primary product accent (logo gradient start)
  light: '#3B82F6',
  dark: '#002B82', // logo gradient end
} as const;

/**
 * COMPANY profiles — wired into Organization `sameAs` (entity graph for Google
 * + AI answer engines). These are Sapybase/Vaayu listings, not personal pages.
 * Any empty string is auto-filtered out of the schema, so blanks are safe.
 */
export const SOCIAL_LINKS = {
  productHunt: 'https://www.producthunt.com/products/sapybase',
  fazier: 'https://fazier.com/launches/sapybase',
} as const;

/** Non-empty company social URLs, ready to drop into schema.org `sameAs`. */
export const SAME_AS: string[] = Object.values(SOCIAL_LINKS).filter(Boolean);

/**
 * The person behind Sapybase — strengthens authorship / E-E-A-T signals.
 * `sameAs` holds the founder's PERSONAL profiles (attached to the Person, not
 * the Organization, so the entity graph stays accurate).
 */
export const FOUNDER = {
  name: 'Ayush Satvara',
  jobTitle: 'Founder',
  url: 'https://www.linkedin.com/in/ayushsatvara/',
  sameAs: [
    'https://www.linkedin.com/in/ayushsatvara/',
    'https://x.com/Ayush54458896',
    'https://github.com/ayushsatvara1012',
  ],
} as const;

/** Topics the company is an authority on — consumed by AI engines (knowsAbout). */
export const KNOWS_ABOUT = [
  'Business Intelligence',
  'AI chatbots',
  'Lead generation',
  'Conversion rate optimization',
  'Retrieval-Augmented Generation',
  'Customer support automation',
  'Marketing analytics',
] as const;

export const BRAND = { COMPANY, PRODUCT, VAAYU_ACCENT, SOCIAL_LINKS, SAME_AS, FOUNDER, KNOWS_ABOUT } as const;
export default BRAND;
