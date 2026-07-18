/**
 * ChatWidget — "Talk to a human" handoff decision (logic in isolation).
 *
 * Following the convention in chatwidget_hub.test.ts / chatwidget_streaming.test.ts,
 * we mirror the pure decision logic extracted from handleHandoff in ChatWidget.tsx
 * rather than rendering the full component. When that logic changes, update this
 * mirror too.
 *
 * Guarantees:
 *   1. A configured contact link (wa.me/etc, only ever populated when the plan's
 *      human_handoff_enabled is true) skips the name/email form entirely.
 *   2. No link configured => today's form flow, unchanged (no-regression gate).
 *   3. The form flow still respects the existing "already sent" guard.
 */
import { describe, it, expect } from 'vitest';

// Mirrors handleHandoff's branching.
function resolveHandoffAction(
  handoffRedirectUrl: string | undefined,
  handoffSent: boolean,
): 'open_redirect' | 'show_form' | 'noop' {
  if (handoffRedirectUrl) return 'open_redirect';
  if (handoffSent) return 'noop';
  return 'show_form';
}

// Mirrors the fetchConfig mapping: handoff_redirect_url is only ever surfaced
// to the widget when the plan actually grants human_handoff_enabled.
function resolveConfiguredHandoffUrl(
  humanHandoffEnabled: boolean,
  handoffRedirectUrl: string | undefined,
): string {
  return humanHandoffEnabled ? (handoffRedirectUrl || '') : '';
}

describe('Talk to a human — instant-connect vs form', () => {
  it('opens the configured link directly, bypassing the contact form', () => {
    expect(resolveHandoffAction('https://wa.me/15551234567', false)).toBe('open_redirect');
  });

  it('opens the link even if a previous handoff was already sent (no cooldown)', () => {
    expect(resolveHandoffAction('https://wa.me/15551234567', true)).toBe('open_redirect');
  });

  it('no link configured => unchanged form flow (no-regression gate)', () => {
    expect(resolveHandoffAction('', false)).toBe('show_form');
    expect(resolveHandoffAction(undefined, false)).toBe('show_form');
  });

  it('no link configured, already sent => the existing guard still no-ops', () => {
    expect(resolveHandoffAction('', true)).toBe('noop');
  });
});

describe('handoff_redirect_url exposure respects the plan gate', () => {
  it('surfaces the configured URL when human handoff is enabled', () => {
    expect(resolveConfiguredHandoffUrl(true, 'https://wa.me/15551234567')).toBe('https://wa.me/15551234567');
  });

  it('withholds the URL when human handoff is not enabled, even if one is stored', () => {
    // e.g. a downgraded account with a stale value still in the DB column.
    expect(resolveConfiguredHandoffUrl(false, 'https://wa.me/15551234567')).toBe('');
  });

  it('is empty when nothing is configured', () => {
    expect(resolveConfiguredHandoffUrl(true, undefined)).toBe('');
    expect(resolveConfiguredHandoffUrl(true, '')).toBe('');
  });
});
