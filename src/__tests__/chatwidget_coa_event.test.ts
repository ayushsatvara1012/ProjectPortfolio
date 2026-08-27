/**
 * ChatWidget — COA Contact-support analytics beacon (logic in isolation).
 *
 * Following the convention in chatwidget_hub.test.ts / chatwidget_handoff.test.ts,
 * we mirror the pure decision logic extracted from `logCoaContactSupport` /
 * `contactSupportFromCoa` in ChatWidget.tsx rather than rendering the full
 * component and mocking `fetch`.
 *
 * coa-split-lookup-fields-plan Phase 5 (§7): the lookup shape itself (strict /
 * tolerant / refused) is logged server-side where it is already known; this is
 * the one COA event only the browser can see — whether a visitor who reached
 * the panel clicked through to a human — fired via POST /api/widget/coa-event.
 * When the mirrored logic in ChatWidget.tsx changes, update these helpers.
 */
import { describe, it, expect } from 'vitest';

type CoaEventSource = 'panel' | 'chat';

// Mirrors logCoaContactSupport's source selection: whichever way the panel got
// into its current state — opened from the hub card, or from a chat-resolved
// or chat-locked result — is what the event is tagged with.
function resolveCoaEventSource(coaFromChat: boolean): CoaEventSource {
  return coaFromChat ? 'chat' : 'panel';
}

// Mirrors the guard at the top of logCoaContactSupport: no API key, no beacon.
// Every other widget analytics call in this component guards the same way.
function shouldFireCoaEvent(activeApiKey: string | null | undefined): boolean {
  return Boolean(activeApiKey);
}

// Mirrors the fetch body — shape only, never an identifier, a filename or a count.
function coaEventBody(source: CoaEventSource): Record<string, unknown> {
  return { source };
}

describe('COA contact-support beacon — source attribution', () => {
  it('tags a panel-opened contact click as panel', () => {
    expect(resolveCoaEventSource(false)).toBe('panel');
  });

  it('tags a chat-resolved or chat-locked panel as chat', () => {
    expect(resolveCoaEventSource(true)).toBe('chat');
  });
});

describe('COA contact-support beacon — fires only with a real API key', () => {
  it('does not fire without an API key', () => {
    expect(shouldFireCoaEvent(undefined)).toBe(false);
    expect(shouldFireCoaEvent(null)).toBe(false);
    expect(shouldFireCoaEvent('')).toBe(false);
  });

  it('fires once a key is present', () => {
    expect(shouldFireCoaEvent('sk_live_abc')).toBe(true);
  });
});

describe('COA contact-support beacon — body shape', () => {
  it('carries only the source, never an identifier or a count', () => {
    expect(coaEventBody('panel')).toEqual({ source: 'panel' });
    expect(Object.keys(coaEventBody('chat'))).toEqual(['source']);
  });
});
