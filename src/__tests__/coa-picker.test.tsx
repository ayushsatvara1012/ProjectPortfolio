/**
 * The widget's certificate panel, under coa-confidential-access.
 *
 * These import the real helpers out of components/chat/panels.ts and render the real
 * CoaPicker rather than mirroring either (the older chatwidget_*.test.ts convention),
 * because the rules being tested are the ones the plan actually guarantees and a
 * mirrored copy would happily keep passing after the component stopped agreeing:
 *   - C3: one identical refusal for every content outcome, and never a list.
 *   - C4/§5.1: the lockout is visible, disables the field, and shows no countdown.
 *   - C7: nothing is looked up until Request is pressed, so a customer correcting a
 *     typo mid-entry cannot burn their allowance.
 *   - §6: a Drive outage stays distinct from a refusal — the one deliberate exception
 *     to C3, because it does not depend on what was typed.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { CoaPicker } from '@/src/components/chat/ChatWidget';
import {
  COA_LOCKED_MESSAGE,
  COA_LOCKOUT_FALLBACK_MS,
  COA_OUTAGE_MESSAGE,
  COA_REFUSED_MESSAGE,
  coaLockoutMs,
  coaOutcome,
  coaPanelState,
  hubCardTarget,
  parseCoaEvent,
  parseCoaLockout,
  type CoaRow,
} from '@/src/components/chat/panels';

const ROW = (id: string): CoaRow => ({
  id,
  display: `100RG · 100.26R016 · ACETONE RG`,
  modified_at: '2026-07-01T10:00:00.000Z',
  view_url: `https://drive.google.com/file/d/${id}/view`,
  download_url: `https://drive.google.com/uc?export=download&id=${id}`,
});

const STATE = (over: Partial<Parameters<typeof coaPanelState>[0]> = {}) => ({
  configured: true, lockedOut: false, error: null, searching: false,
  result: null, refused: false, ...over,
});

describe('coaPanelState — what the panel is showing', () => {
  it('opens on the prompt, not on a failure nobody caused', () => {
    // `refused` cannot be inferred from a null result: that is also the state of a
    // panel nobody has pressed Request on, and greeting a visitor with "we couldn't
    // find that certificate" would be a failure they never asked for.
    expect(coaPanelState(STATE())).toBe('prompt');
  });

  it('distinguishes a lookup in flight from a lookup that released nothing', () => {
    expect(coaPanelState(STATE({ searching: true }))).toBe('searching');
    expect(coaPanelState(STATE({ refused: true }))).toBe('refused');
  });

  it('releases the one certificate that resolved', () => {
    expect(coaPanelState(STATE({ result: ROW('a') }))).toBe('released');
  });

  it('puts the lockout above the outage copy', () => {
    // A locked-out visitor cannot send the request that would discover Drive is
    // down, so "please try again" would be the wrong instruction to leave on screen.
    expect(coaPanelState(STATE({ lockedOut: true, error: COA_OUTAGE_MESSAGE }))).toBe('locked');
    expect(coaPanelState(STATE({ lockedOut: true, result: ROW('a') }))).toBe('locked');
  });

  it('an outage outranks a stale result', () => {
    // A Drive outage must not read as "no certificate exists", including when a
    // previous lookup left a certificate on screen.
    expect(coaPanelState(STATE({ error: COA_OUTAGE_MESSAGE, result: ROW('a') }))).toBe('error');
    expect(coaPanelState(STATE({ error: COA_OUTAGE_MESSAGE, refused: true }))).toBe('error');
  });

  it('an unconfigured folder outranks everything', () => {
    // /api/config is cached, so the folder can disappear under an open panel.
    expect(coaPanelState(STATE({ configured: false, lockedOut: true, result: ROW('a') }))).toBe('unconfigured');
  });
});

describe('coaOutcome — one response, one thing the panel does', () => {
  it('reads a 429 as the lockout, never as an outage', () => {
    // The defect this exists to prevent: a 429 falling through to the outage branch
    // leaves a locked-out visitor pressing Retry against a backend that has already
    // stopped answering, and the field never disables.
    expect(coaOutcome(429, { detail: { code: 'COA_LOCKED_OUT', retry_after: 900 } }))
      .toEqual({ kind: 'locked', lockoutMs: 900_000 });
  });

  it('reads every other failure as the outage', () => {
    expect(coaOutcome(503, { detail: { code: 'COA_UNAVAILABLE' } })).toEqual({ kind: 'outage' });
    expect(coaOutcome(404, null)).toEqual({ kind: 'outage' });
    expect(coaOutcome(500, null)).toEqual({ kind: 'outage' });
  });

  it('releases the one certificate the endpoint returned', () => {
    expect(coaOutcome(200, { results: [ROW('a')], configured: true }))
      .toEqual({ kind: 'released', row: ROW('a'), configured: true });
  });

  it('refuses an empty result set and an unparseable body alike', () => {
    expect(coaOutcome(200, { results: [], configured: true })).toEqual({ kind: 'refused', configured: true });
    expect(coaOutcome(200, null)).toEqual({ kind: 'refused', configured: true });
    // More than one row is a shape resolve() cannot produce; guessing at its first
    // row would be releasing a certificate nobody identified.
    expect(coaOutcome(200, { results: [ROW('a'), ROW('b')] })).toEqual({ kind: 'refused', configured: true });
  });

  it('carries the folder disappearing out from under an open panel', () => {
    expect(coaOutcome(200, { results: [], configured: false })).toEqual({ kind: 'refused', configured: false });
  });
});

describe('coaLockoutMs — how long the interface stays disabled', () => {
  it('takes the server\'s window, however the payload nests it', () => {
    expect(coaLockoutMs({ detail: { retry_after: 900 } })).toBe(900_000);
    expect(coaLockoutMs({ retry_after: 60 })).toBe(60_000);
    expect(coaLockoutMs({ detail: { retry_after: '120' } })).toBe(120_000);
  });

  it('falls back when the server said nothing usable', () => {
    // Guessing low costs a refusal, never an unearned certificate: the backend
    // refuses a locked-out request whatever the interface has re-enabled (§5.1).
    expect(coaLockoutMs(null)).toBe(COA_LOCKOUT_FALLBACK_MS);
    expect(coaLockoutMs({})).toBe(COA_LOCKOUT_FALLBACK_MS);
    expect(coaLockoutMs({ detail: { retry_after: 'soon' } })).toBe(COA_LOCKOUT_FALLBACK_MS);
    expect(coaLockoutMs({ retry_after: -5 })).toBe(COA_LOCKOUT_FALLBACK_MS);
  });

  it('caps a garbled window so the field cannot be disabled for a day', () => {
    expect(coaLockoutMs({ retry_after: 999_999 })).toBe(60 * 60 * 1000);
  });
});

describe('hubCardTarget — the flag-off fallback contract', () => {
  it('opens the COA panel only when the feature flag is on', () => {
    expect(hubCardTarget('coa_picker', { coa_picker: true })).toBe('coa_picker');
  });

  it('degrades a COA card to the mini-form when the bot has no Drive folder', () => {
    // The mini-form's message reaches get_coa, which answers not_configured and
    // offers a handoff — a conversation, not a dead panel.
    expect(hubCardTarget('coa_picker', { coa_picker: false })).toBe('tool');
    expect(hubCardTarget('coa_picker', {})).toBe('tool');
    expect(hubCardTarget('coa_picker', undefined)).toBe('tool');
  });

  it('leaves the existing card behaviours untouched', () => {
    expect(hubCardTarget('sds_picker', { sds_picker: true })).toBe('sds_picker');
    expect(hubCardTarget('sds_picker', { sds_picker: false })).toBe('tool');
    expect(hubCardTarget('chat', {})).toBe('chat');
    expect(hubCardTarget('form', {})).toBe('form');
    expect(hubCardTarget('tool', {})).toBe('tool');
  });

  it('does not let one feature flag open the other feature panel', () => {
    expect(hubCardTarget('coa_picker', { sds_picker: true })).toBe('tool');
    expect(hubCardTarget('sds_picker', { coa_picker: true })).toBe('tool');
  });
});

describe('parseCoaEvent — the {coa:{…}} side-channel', () => {
  it('carries the one released certificate', () => {
    expect(parseCoaEvent({ coa: { status: 'found', results: [ROW('a')], query: '100RG 100.26R016' } }))
      .toEqual(ROW('a'));
  });

  it('drops the query, which is whatever the model passed the tool', () => {
    // Found in the browser: the panel showed "…batch 100.26R016. Can I get the COA?"
    // scrolled to its tail in the box. The certificate is the answer; the field stays
    // empty and ready for the next lookup.
    const parsed = parseCoaEvent({
      coa: { results: [ROW('a')], query: 'I have a drum of acetone, batch 100.26R016. Can I get the COA?' },
    });
    expect(parsed).not.toHaveProperty('query');
  });

  it('opens no panel when there is nothing to put in it', () => {
    // not_found / not_configured / unavailable emit no rows at all: the visitor
    // stays in the conversation and gets the handoff the model offers.
    expect(parseCoaEvent({ coa: { status: 'not_found', results: [] } })).toBeNull();
    expect(parseCoaEvent({ coa: { status: 'unavailable' } })).toBeNull();
    expect(parseCoaEvent({ sds: { url: 'https://example.com/x.pdf' } })).toBeNull();
    expect(parseCoaEvent({})).toBeNull();
    expect(parseCoaEvent(null)).toBeNull();
  });

  it('carries a cooldown earned in the conversation', () => {
    // §7 — the chat shares the panel's counters, so a visitor can be locked out by a
    // conversation and has to find the field already disabled when they reach the
    // panel, rather than discovering it by pressing Request.
    expect(parseCoaLockout({ coa: { status: 'locked_out', results: [], retry_after: 900 } }))
      .toBe(900_000);
    expect(parseCoaLockout({ coa: { status: 'locked_out', results: [] } }))
      .toBe(COA_LOCKOUT_FALLBACK_MS);
  });

  it('locks nothing on the statuses that are not a lockout', () => {
    expect(parseCoaLockout({ coa: { status: 'found', results: [ROW('a')] } })).toBeNull();
    expect(parseCoaLockout({ coa: { status: 'not_found', results: [] } })).toBeNull();
    expect(parseCoaLockout({ sds: { url: 'https://example.com/x.pdf' } })).toBeNull();
    expect(parseCoaLockout(null)).toBeNull();
  });

  it('opens no panel for a lockout, which carries no certificate', () => {
    expect(parseCoaEvent({ coa: { status: 'locked_out', results: [], retry_after: 900 } })).toBeNull();
  });

  it('refuses a payload carrying more than one certificate', () => {
    // resolve() releases one certificate or nothing, so a multi-row payload is a
    // shape we do not understand — showing its first row would be guessing at which
    // grade the visitor is holding, on data that should not exist.
    expect(parseCoaEvent({ coa: { results: [ROW('a'), ROW('b')] } })).toBeNull();
  });
});

describe('CoaPicker — the panel a visitor sees', () => {
  const props = {
    result: null as CoaRow | null,
    refused: false,
    searching: false,
    lockedOut: false,
    configured: true,
    error: null as string | null,
    query: '',
    themeColor: '#2563eb',
    fromChat: false,
    supportSent: false,
    onQueryChange: vi.fn(),
    onSubmit: vi.fn(),
    onCancel: vi.fn(),
    onContactSupport: vi.fn(),
  };
  const field = () => screen.getByLabelText('Product code and batch number');
  const request = () => screen.getByRole('button', { name: 'Request' });

  it('looks nothing up until Request is pressed (C7)', () => {
    const onSubmit = vi.fn();
    const onQueryChange = vi.fn();
    render(<CoaPicker {...props} query="100RG" onSubmit={onSubmit} onQueryChange={onQueryChange} />);

    fireEvent.change(field(), { target: { value: '100RG 100.26R01' } });
    expect(onQueryChange).toHaveBeenCalled();
    expect(onSubmit).not.toHaveBeenCalled();

    fireEvent.click(request());
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('submits on Enter, exactly once', () => {
    const onSubmit = vi.fn();
    const { container } = render(<CoaPicker {...props} query="100RG 100.26R016" onSubmit={onSubmit} />);
    fireEvent.submit(container.querySelector('form')!);
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('has nothing to request until something is typed', () => {
    render(<CoaPicker {...props} query="   " />);
    expect(request()).toBeDisabled();
  });

  it('renders one refusal and never a list, and leaves the field usable (C3)', () => {
    render(<CoaPicker {...props} query="acetone" refused />);
    expect(screen.getByText(COA_REFUSED_MESSAGE)).toBeInTheDocument();
    // The refusal must say nothing about the library: no count, no near-miss, no
    // row a visitor could read a product code or batch off.
    expect(screen.queryByText(/100\.26R016/)).not.toBeInTheDocument();
    expect(field()).toBeEnabled();
    expect(request()).toBeEnabled();
  });

  it('releases the certificate with Open and Download', () => {
    render(<CoaPicker {...props} query="100RG 100.26R016" result={ROW('a')} />);
    expect(screen.getByText(ROW('a').display)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Open/ })).toHaveAttribute('href', ROW('a').view_url);
    expect(screen.getByRole('button', { name: /Download/ })).toBeInTheDocument();
    // The field stays available for the next lookup.
    expect(field()).toBeEnabled();
  });

  it('disables the field on a lockout and offers no countdown (§5.1)', () => {
    render(<CoaPicker {...props} query="100RG 100.26R999" lockedOut />);
    expect(screen.getByText(COA_LOCKED_MESSAGE)).toBeInTheDocument();
    expect(field()).toBeDisabled();
    expect(request()).toBeDisabled();
    // A live "try again in 14:32" hands over the exact window and invites the
    // visitor to wait it out. The route offered is support, not patience.
    expect(screen.queryByText(/\d+:\d\d/)).not.toBeInTheDocument();
    expect(screen.queryByText(/minutes?|seconds?|try again/i)).not.toBeInTheDocument();
  });

  it('re-enables itself once the lockout clears, without announcing it', () => {
    const { rerender } = render(<CoaPicker {...props} query="100RG" lockedOut />);
    expect(field()).toBeDisabled();
    rerender(<CoaPicker {...props} query="100RG" lockedOut={false} />);
    expect(field()).toBeEnabled();
    expect(screen.queryByText(COA_LOCKED_MESSAGE)).not.toBeInTheDocument();
  });

  it('shows the outage copy for a Drive failure, never the refusal (§6)', () => {
    const onSubmit = vi.fn();
    render(<CoaPicker {...props} query="100RG 100.26R016" error={COA_OUTAGE_MESSAGE} onSubmit={onSubmit} />);
    expect(screen.getByText(COA_OUTAGE_MESSAGE)).toBeInTheDocument();
    expect(screen.queryByText(COA_REFUSED_MESSAGE)).not.toBeInTheDocument();
    // An outage is our failure, not the visitor's: it never costs them the field.
    expect(field()).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('sends nobody to a lookup that was never set up', () => {
    render(<CoaPicker {...props} configured={false} query="100RG 100.26R016" />);
    expect(field()).toBeDisabled();
    expect(request()).toBeDisabled();
  });
});

describe('L2 — every dead end has a way out', () => {
  const props = {
    result: null as CoaRow | null,
    refused: false,
    searching: false,
    lockedOut: false,
    configured: true,
    error: null as string | null,
    query: '',
    themeColor: '#2563eb',
    fromChat: false,
    supportSent: false,
    onQueryChange: vi.fn(),
    onSubmit: vi.fn(),
    onCancel: vi.fn(),
    onContactSupport: vi.fn(),
  };
  const support = () => screen.getByRole('button', { name: 'Contact support' });

  it.each([
    ['refused', { refused: true }],
    ['locked out', { lockedOut: true }],
    ['a Drive outage', { error: COA_OUTAGE_MESSAGE }],
    ['never configured', { configured: false }],
  ])('offers the handoff when the lookup is %s', (_label, over) => {
    // "Contact our support team" used to be an instruction with no button attached,
    // so the visitor had to go back to the chat and ask again in their own words.
    const onContactSupport = vi.fn();
    render(<CoaPicker {...props} {...over} onContactSupport={onContactSupport} />);
    fireEvent.click(support());
    expect(onContactSupport).toHaveBeenCalledTimes(1);
  });

  it('is the only way forward from a lockout, where nothing else is pressable', () => {
    render(<CoaPicker {...props} lockedOut query="100RG 100.26R999" />);
    expect(screen.getByLabelText('Product code and batch number')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Request' })).toBeDisabled();
    expect(support()).toBeEnabled();
  });

  it('leaves the outage its Retry as well, since that failure may simply pass', () => {
    render(<CoaPicker {...props} error={COA_OUTAGE_MESSAGE} />);
    expect(screen.getByRole('button', { name: 'Retry' })).toBeEnabled();
    expect(support()).toBeEnabled();
  });

  it('does not offer it on a released certificate or an untouched panel', () => {
    // Nothing has gone wrong in either, and a support button under a certificate the
    // visitor just received reads as an apology for succeeding.
    const { rerender } = render(<CoaPicker {...props} result={ROW('a')} />);
    expect(screen.queryByRole('button', { name: 'Contact support' })).not.toBeInTheDocument();
    rerender(<CoaPicker {...props} />);
    expect(screen.queryByRole('button', { name: 'Contact support' })).not.toBeInTheDocument();
  });

  it('says the team is already notified rather than taking a second press', () => {
    // Same vocabulary as the ⋮ menu's own handoff button. A second press produces no
    // second form, so a button that still invited one would be a dead click.
    const onContactSupport = vi.fn();
    render(<CoaPicker {...props} refused supportSent onContactSupport={onContactSupport} />);
    const button = screen.getByRole('button', { name: /Team notified/ });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(onContactSupport).not.toHaveBeenCalled();
  });

  it('never turns the refusal into a hint about the library', () => {
    // The button is the only thing added to this state, and C3 still owns the words.
    render(<CoaPicker {...props} refused query="acetone" />);
    expect(screen.getByText(COA_REFUSED_MESSAGE)).toBeInTheDocument();
    expect(screen.queryByText(/certificate.*exist|match|found|\d+ result/i)).not.toBeInTheDocument();
  });
});

describe('H8 — the Download target', () => {
  // Both fields are strings, so TypeScript cannot tell them apart and swapping them
  // would look completely healthy: the customer just gets an HTML page saved under a
  // .pdf name. Asserted against the source the same way the backend asserts its
  // one-resolver invariant with inspect.getsource.
  const source = readFileSync(
    resolve(__dirname, '../components/chat/ChatWidget.tsx'), 'utf8');
  const panel = source.slice(source.indexOf('function CoaPicker'), source.indexOf('async function downloadDocument'));

  it('the panel downloads download_url, never the viewer page', () => {
    expect(panel).toContain('downloadDocument(released.download_url!');
    expect(panel).not.toContain('downloadDocument(released.view_url');
  });

  it('the panel still opens the viewer page for Open', () => {
    expect(panel).toContain('href={released.view_url}');
  });
});

describe('every MIcon the widget asks for actually resolves', () => {
  // Found in the browser: the lockout panel rendered the literal word "lock" at
  // 30px, because `MIcon` falls back to `<span>{name}</span>` for a name in neither
  // registry and the widget ships its own icon paths rather than the Material
  // Symbols font. Nothing in a query-by-role/text suite can see it - the icons are
  // aria-hidden, so the assertion has to be against the source.
  const source = readFileSync(
    resolve(__dirname, '../components/chat/ChatWidget.tsx'), 'utf8');

  const names = [...source.matchAll(/MIcon name="([a-z_0-9]+)"/g)].map((m) => m[1]);
  const paths = source.slice(source.indexOf('const ICON_PATHS'), source.indexOf('function MIcon'));

  it('finds a path or a component for every name in use', () => {
    expect(names.length).toBeGreaterThan(10);
    const missing = [...new Set(names)].filter((n) => !new RegExp(`^\\s{2}${n}:`, 'm').test(paths));
    expect(missing).toEqual([]);
  });
});
