/**
 * Phase 5 (customise) — sample form editor pure logic.
 *
 * The editor mirrors the backend sanitiser (packs/overrides.py) client-side so the
 * owner sees the same key derivation + validation the server will enforce. We test
 * the pure helpers (no rendering), per the chatwidget_hub.test.ts convention.
 */
import { describe, it, expect } from 'vitest';
import { slugifyFieldName, validateSampleForm } from '@/src/components/dashboard/SampleFormEditor';

describe('slugifyFieldName', () => {
  it('lowercases and underscores spaces/dashes', () => {
    expect(slugifyFieldName('Delivery Address')).toBe('delivery_address');
    expect(slugifyFieldName('Contact-Email')).toBe('contact_email');
  });

  it('strips punctuation and collapses underscores', () => {
    expect(slugifyFieldName('Delivery Site!!!')).toBe('delivery_site');
    expect(slugifyFieldName('  Batch   No.  ')).toBe('batch_no');
  });

  it('returns empty for unusable input', () => {
    expect(slugifyFieldName('***')).toBe('');
    expect(slugifyFieldName('   ')).toBe('');
    // @ts-expect-error guard non-string
    expect(slugifyFieldName(null)).toBe('');
  });

  it('matches the backend key for the chemical defaults', () => {
    expect(slugifyFieldName('Email')).toBe('email');
    expect(slugifyFieldName('Quantity')).toBe('quantity');
  });
});

const field = (over: Partial<{ name: string; label: string; type: string; required: boolean }> = {}) => ({
  name: '', label: '', type: 'text', required: false, placeholder: '', ...over,
});

describe('validateSampleForm', () => {
  it('passes a clean unique-keyed form', () => {
    const v = validateSampleForm([
      field({ name: 'product', label: 'Product', type: 'product', required: true }),
      field({ name: 'contact_email', label: 'Email', type: 'email', required: true }),
    ]);
    expect(v.valid).toBe(true);
    expect(v.duplicateNames).toEqual([]);
    expect(v.emptyKeyRows).toEqual([]);
  });

  it('flags duplicate keys', () => {
    const v = validateSampleForm([
      field({ name: 'email', label: 'Email' }),
      field({ name: 'email', label: 'Email again' }),
    ]);
    expect(v.valid).toBe(false);
    expect(v.duplicateNames).toEqual(['email']);
  });

  it('treats keys that slugify identically as duplicates', () => {
    const v = validateSampleForm([
      field({ name: 'Delivery Site', label: 'A' }),
      field({ name: 'delivery-site', label: 'B' }),
    ]);
    expect(v.valid).toBe(false);
    expect(v.duplicateNames).toEqual(['delivery_site']);
  });

  it('flags rows with no usable key', () => {
    const v = validateSampleForm([field({ name: '***', label: '' })]);
    expect(v.valid).toBe(false);
    expect(v.emptyKeyRows).toEqual([0]);
  });

  it('is safe on empty / non-array input', () => {
    expect(validateSampleForm([]).valid).toBe(true);
    // @ts-expect-error guard
    expect(validateSampleForm(undefined).valid).toBe(true);
  });
});
