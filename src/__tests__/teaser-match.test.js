/**
 * Contextual teaser matcher (Phase 2) — unit tests.
 *
 * The pure ES5 matcher ships INSIDE public/sapybase-loader.js (the loader has no
 * ES modules). To keep a single source of truth we extract the delimited
 * TEASER-MATCHER block from the shipped file and evaluate it here, so these tests
 * exercise the exact code that runs on host pages.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const here = path.dirname(fileURLToPath(import.meta.url));
const loaderSrc = readFileSync(path.resolve(here, '../../public/sapybase-loader.js'), 'utf8');
const block = loaderSrc.split('// TEASER-MATCHER-START')[1].split('// TEASER-MATCHER-END')[0];
const { matchTeaserRule, normalizeTeaserPath } = new Function(
  block +
    '\nreturn { matchTeaserRule: matchTeaserRule, normalizeTeaserPath: normalizeTeaserPath };'
)();

const RULES = [
  { id: 'pricing', match: '/pricing', page: 'pricing', title: 'Want the best price?' },
  { id: 'products', match: '/products', page: 'products', title: 'Looking for a product?' },
  { id: 'contact', match: '/contact', page: 'contact', title: 'Prefer to talk?' },
];

const loc = (pathname, hash = '', search = '') => ({ pathname, hash, search });

describe('normalizeTeaserPath', () => {
  it('lowercases and strips a trailing slash', () => {
    expect(normalizeTeaserPath(loc('/Products/'))).toBe('/products');
  });
  it('keeps the root path', () => {
    expect(normalizeTeaserPath(loc('/'))).toBe('/');
  });
  it('strips query and hash', () => {
    expect(normalizeTeaserPath('/pricing?ref=ad#top')).toBe('/pricing');
  });
  it('uses a hash-router path over the pathname', () => {
    expect(normalizeTeaserPath(loc('/', '#/contact'))).toBe('/contact');
  });
  it('defaults empty input to root', () => {
    expect(normalizeTeaserPath(loc(''))).toBe('/');
  });
});

describe('matchTeaserRule — URL rules', () => {
  it('matches an exact path', () => {
    expect(matchTeaserRule(RULES, loc('/products')).id).toBe('products');
  });
  it('is case- and trailing-slash-insensitive', () => {
    expect(matchTeaserRule(RULES, loc('/Products/')).id).toBe('products');
  });
  it('ignores the query string', () => {
    expect(matchTeaserRule(RULES, loc('/pricing', '', '?q=1')).id).toBe('pricing');
  });
  it('fires on a locale-prefixed path', () => {
    expect(matchTeaserRule(RULES, loc('/en/products')).id).toBe('products');
  });
  it('fires on a sub-path', () => {
    expect(matchTeaserRule(RULES, loc('/products/acetone')).id).toBe('products');
  });
  it('is segment-aware: does not match a partial segment', () => {
    expect(matchTeaserRule(RULES, loc('/myproducts'))).toBeNull();
    expect(matchTeaserRule(RULES, loc('/productsxyz'))).toBeNull();
  });
  it('returns null when no rule matches', () => {
    expect(matchTeaserRule(RULES, loc('/about'))).toBeNull();
  });
  it('honors a hash-router route', () => {
    expect(matchTeaserRule(RULES, loc('/app', '#/pricing')).id).toBe('pricing');
  });
  it('first match wins (order preserved)', () => {
    const ordered = [
      { id: 'catalog', match: '/products', title: 'a' },
      { id: 'special', match: '/products/special', title: 'b' },
    ];
    expect(matchTeaserRule(ordered, loc('/products/special')).id).toBe('catalog');
  });
});

describe('matchTeaserRule — page-tag override', () => {
  it('page hint wins over the URL', () => {
    expect(matchTeaserRule(RULES, loc('/products'), 'pricing').id).toBe('pricing');
  });
  it('page hint is case-insensitive', () => {
    expect(matchTeaserRule(RULES, loc('/about'), 'Contact').id).toBe('contact');
  });
  it('falls back to the URL rule when the hint matches nothing', () => {
    expect(matchTeaserRule(RULES, loc('/products'), 'unknown').id).toBe('products');
  });
});

describe('matchTeaserRule — guards', () => {
  it('returns null for no rules', () => {
    expect(matchTeaserRule([], loc('/products'))).toBeNull();
    expect(matchTeaserRule(null, loc('/products'))).toBeNull();
  });
  it('ignores a rule with no match token and no matching page', () => {
    expect(matchTeaserRule([{ id: 'x', title: 't' }], loc('/products'))).toBeNull();
  });
});
