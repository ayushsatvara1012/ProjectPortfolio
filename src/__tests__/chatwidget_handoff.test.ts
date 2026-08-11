/**
 * ChatWidget — capture-then-connect (logic in isolation).
 *
 * Following the convention in chatwidget_hub.test.ts / chatwidget_streaming.test.ts,
 * we mirror the pure decision logic extracted from ChatWidget.tsx rather than
 * rendering the full component. When that logic changes, update this mirror too.
 *
 * agent-runtime-restructure plan §1.6 replaced the old branching here: a configured
 * contact link used to skip the form entirely, so the owner received a message from
 * an unidentified visitor with no name, no email and no transcript. Capture now
 * always precedes connect, and the redirect still opens the moment it is answered
 * or declined.
 */
import { describe, it, expect } from 'vitest';

type ConnectDestination = 'handoff' | 'lead_capture';

// Mirrors connectDestination(): entitlement, not the trigger, picks the endpoint.
// The same ordering the server applies in agent_runtime/escalation.destination().
function connectDestination(
  humanHandoffEnabled: boolean,
  leadCaptureEnabled: boolean,
): ConnectDestination | null {
  if (humanHandoffEnabled) return 'handoff';
  if (leadCaptureEnabled) return 'lead_capture';
  return null;
}

// Mirrors handleHandoff's branching.
function resolveHandoffAction(
  destination: ConnectDestination | null,
  handoffSent: boolean,
): 'show_form' | 'noop' {
  if (!destination) return 'noop';
  if (handoffSent) return 'noop';
  return 'show_form';
}

// Mirrors submitHandoff's tail and the form's onDismiss.
function resolveAfterForm(
  outcome: 'submitted' | 'dismissed',
  handoffRedirectUrl: string | undefined,
): { calledHandoff: boolean; openedRedirect: boolean } {
  return {
    calledHandoff: outcome === 'submitted',
    openedRedirect: Boolean(handoffRedirectUrl),
  };
}

// Mirrors the fetchConfig mapping: handoff_redirect_url is only ever surfaced
// to the widget when the plan actually grants human_handoff_enabled.
function resolveConfiguredHandoffUrl(
  humanHandoffEnabled: boolean,
  handoffRedirectUrl: string | undefined,
): string {
  return humanHandoffEnabled ? (handoffRedirectUrl || '') : '';
}

describe('Talk to a human — the form always comes first', () => {
  it('shows the form even when a contact link is configured', () => {
    expect(resolveHandoffAction(connectDestination(true, true), false)).toBe('show_form');
  });

  it('no link configured => the same form flow', () => {
    expect(resolveHandoffAction(connectDestination(true, false), false)).toBe('show_form');
  });

  it('already connected => the existing guard still no-ops', () => {
    expect(resolveHandoffAction(connectDestination(true, true), true)).toBe('noop');
  });

  it('a bot entitled to neither has nothing to offer', () => {
    expect(resolveHandoffAction(connectDestination(false, false), false)).toBe('noop');
  });
});

describe('the redirect path still reaches the owner', () => {
  it('submitting calls /api/handoff AND opens the link', () => {
    // The regression this whole change exists to fix: the link used to open with
    // no backend call at all.
    expect(resolveAfterForm('submitted', 'https://wa.me/15551234567')).toEqual({
      calledHandoff: true, openedRedirect: true,
    });
  });

  it('submitting with no link configured still calls /api/handoff', () => {
    expect(resolveAfterForm('submitted', '')).toEqual({
      calledHandoff: true, openedRedirect: false,
    });
  });

  it('declining costs the visitor nothing — the link still opens', () => {
    expect(resolveAfterForm('dismissed', 'https://wa.me/15551234567')).toEqual({
      calledHandoff: false, openedRedirect: true,
    });
  });
});

describe('connect destination follows entitlement', () => {
  it('human handoff wins when both are granted', () => {
    expect(connectDestination(true, true)).toBe('handoff');
  });

  it('a lead-capture-only plan still gets a form, pointed at the lead endpoint', () => {
    // It used to get the "Talk to a human" button and a POST that 402'd.
    expect(connectDestination(false, true)).toBe('lead_capture');
  });

  it('neither entitlement => no form at all', () => {
    expect(connectDestination(false, false)).toBeNull();
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
