import { describe, it, expect, vi } from 'vitest';
import { retrieveChunks } from '@/src/lib/demo/demoRag';

// retrieveChunks is the exported pure function we can test without network
describe('retrieveChunks', () => {
  const chunks = [
    'The quick brown fox jumps over the lazy dog.',
    'Machine learning models require large datasets for training.',
    'Natural language processing enables computers to understand text.',
    'React is a JavaScript library for building user interfaces.',
    'FastAPI is a modern Python web framework for building APIs.',
    'PostgreSQL is a powerful open source relational database.',
  ];

  it('returns at most TOP_K (4) results', () => {
    const result = retrieveChunks(chunks, 'machine learning models');
    expect(result.length).toBeLessThanOrEqual(4);
  });

  it('returns most relevant chunk first for specific query', () => {
    const result = retrieveChunks(chunks, 'machine learning');
    expect(result[0].toLowerCase()).toContain('machine learning');
  });

  it('returns empty array when no chunks provided', () => {
    expect(retrieveChunks([], 'anything')).toEqual([]);
  });

  it('handles single-word query', () => {
    const result = retrieveChunks(chunks, 'PostgreSQL');
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]).toContain('PostgreSQL');
  });

  it('does not mutate original chunks array', () => {
    const original = [...chunks];
    retrieveChunks(chunks, 'query');
    expect(chunks).toEqual(original);
  });

  it('handles query with no matching chunks gracefully', () => {
    const result = retrieveChunks(chunks, 'xyzzy foobarbaz quux');
    expect(Array.isArray(result)).toBe(true);
  });

  it('returns results for multi-word query', () => {
    const result = retrieveChunks(chunks, 'web framework API');
    expect(result.some(c => c.includes('FastAPI'))).toBe(true);
  });
});
