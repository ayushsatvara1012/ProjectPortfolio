/**
 * Phase 5a — Pipeline KPI fold (pure logic).
 *
 * The chemical Pipeline tab leads with a quote+sample headline strip derived
 * client-side from records the panels below already fetched. We test the pure
 * `computePipelineKpis` fold (no rendering) — the same convention as
 * chatwidget_hub.test.ts. Guarantees that matter:
 *   1. POR (price-on-request) quotes are counted separately and NEVER add to
 *      the quoted value (there is no price to sum — a money bug here would
 *      mislead the owner).
 *   2. Missing / NaN subtotals don't poison the sum.
 *   3. Samples are counted independently of quotes.
 *   4. Empty / non-array input is safe (early dashboard state).
 */
import { describe, it, expect } from 'vitest';
import { computePipelineKpis } from '@/src/app/components/PipelineKpis';

describe('computePipelineKpis', () => {
  it('sums only priced quotes and counts POR separately', () => {
    const k = computePipelineKpis(
      [
        { is_por: false, subtotal: 5682, currency: 'INR' },
        { is_por: false, subtotal: 1200, currency: 'INR' },
        { is_por: true, subtotal: null, currency: 'INR' }, // POR — no price
      ],
      [],
    );
    expect(k.quotes).toBe(3);
    expect(k.priced).toBe(2);
    expect(k.por).toBe(1);
    expect(k.quotedValue).toBe(6882);
    expect(k.currency).toBe('INR');
  });

  it('never adds a POR subtotal to quoted value even if one leaks in', () => {
    const k = computePipelineKpis(
      [{ is_por: true, subtotal: 9999, currency: 'INR' }],
      [],
    );
    expect(k.por).toBe(1);
    expect(k.priced).toBe(0);
    expect(k.quotedValue).toBe(0);
  });

  it('treats missing / NaN subtotals as zero without breaking the sum', () => {
    const k = computePipelineKpis(
      [
        { is_por: false, subtotal: undefined },
        { is_por: false, subtotal: NaN },
        { is_por: false, subtotal: 500 },
      ],
      [],
    );
    expect(k.priced).toBe(3);
    expect(k.quotedValue).toBe(500);
  });

  it('counts sample requests independently of quotes', () => {
    const k = computePipelineKpis(
      [{ is_por: false, subtotal: 100 }],
      [{ kind: 'sample' }, { kind: 'sample' }],
    );
    expect(k.quotes).toBe(1);
    expect(k.samples).toBe(2);
  });

  it('is safe on empty / non-array input and defaults currency to INR', () => {
    const k = computePipelineKpis([], []);
    expect(k).toEqual({ quotes: 0, priced: 0, por: 0, samples: 0, quotedValue: 0, currency: 'INR' });
    // @ts-expect-error — guard against undefined slipping in from a loading query
    const k2 = computePipelineKpis(undefined, undefined);
    expect(k2.quotes).toBe(0);
    expect(k2.samples).toBe(0);
  });

  it('picks up the currency from the first priced quote that carries one', () => {
    const k = computePipelineKpis(
      [
        { is_por: true, subtotal: null, currency: 'USD' }, // POR ignored for currency
        { is_por: false, subtotal: 10, currency: 'USD' },
      ],
      [],
    );
    expect(k.currency).toBe('USD');
  });
});
