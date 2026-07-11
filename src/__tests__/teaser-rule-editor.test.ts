/**
 * Contextual teaser (Phase 3) — rule editor pure validation logic.
 *
 * Mirrors services/teaser.py's `_clean_rule` drop rules (no title, or neither
 * match nor page) client-side so the owner sees the same thing the server will
 * enforce. We test the pure helper (no rendering), per the
 * sample-form-editor.test.ts convention.
 */
import { describe, it, expect } from 'vitest';
import { validateTeaserRules } from '@/src/components/dashboard/TeaserRuleEditor';
import type { TeaserRuleField } from '@/src/lib/context/BotSettingsContext';

const rule = (over: Partial<TeaserRuleField> = {}): TeaserRuleField => ({
  match: '', page: '', title: '', subtext: '', ...over,
});

describe('validateTeaserRules', () => {
  it('passes a clean rule with a match and a title', () => {
    const v = validateTeaserRules([rule({ match: '/pricing', title: 'Want the best price?' })]);
    expect(v.valid).toBe(true);
    expect(v.missingTitleRows).toEqual([]);
    expect(v.noTargetRows).toEqual([]);
  });

  it('passes a page-only rule (no URL match needed)', () => {
    const v = validateTeaserRules([rule({ page: 'pricing', title: 'Want the best price?' })]);
    expect(v.valid).toBe(true);
  });

  it('flags a rule with no title', () => {
    const v = validateTeaserRules([rule({ match: '/pricing' })]);
    expect(v.valid).toBe(false);
    expect(v.missingTitleRows).toEqual([0]);
  });

  it('flags a rule with neither match nor page', () => {
    const v = validateTeaserRules([rule({ title: 'Orphan' })]);
    expect(v.valid).toBe(false);
    expect(v.noTargetRows).toEqual([0]);
  });

  it('treats whitespace-only fields as empty', () => {
    const v = validateTeaserRules([rule({ title: '  ', match: '   ' })]);
    expect(v.missingTitleRows).toEqual([0]);
    expect(v.noTargetRows).toEqual([0]);
  });

  it('reports each invalid row independently', () => {
    const v = validateTeaserRules([
      rule({ match: '/a', title: 'Good' }),
      rule({ title: 'No target' }),
      rule({ match: '/c' }),
    ]);
    expect(v.valid).toBe(false);
    expect(v.noTargetRows).toEqual([1]);
    expect(v.missingTitleRows).toEqual([2]);
  });

  it('is safe on empty / non-array input', () => {
    expect(validateTeaserRules([]).valid).toBe(true);
    // @ts-expect-error guard
    expect(validateTeaserRules(undefined).valid).toBe(true);
  });
});
