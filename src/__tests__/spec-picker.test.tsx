/**
 * The widget's specification panel (spec-finder-plan Phase 3).
 *
 * These import the real helpers out of components/chat/panels.ts and render the real
 * SpecPicker, following the coa-picker.test.tsx convention: a mirrored copy of the
 * rules would happily keep passing after the component stopped agreeing with them.
 *
 * What is being protected is the set of differences from the certificate panel, all
 * of which are decisions rather than omissions:
 *   - D1: a ranked LIST, no throttle, no lockout, no single uniform refusal.
 *   - §6: `too_broad` and `empty` say opposite things. A visitor who typed one common
 *     word must be told to type more; one who named a product we do not stock must be
 *     told we have nothing. One copy for both would misinform half of them.
 *   - R7: picking a sheet PINS it above a search box that stays live, so comparing
 *     USP against BP never means going back to Home.
 *   - R3: a capped list says how many matched, or it reads as the whole answer.
 *   - H8: Open spec targets view_url, never a blob download - Drive's uc?export=download
 *     endpoint sends no CORS headers, so a client-side Download always degraded to
 *     opening Drive's own page anyway.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { SpecPicker } from '@/src/components/chat/ChatWidget';
import {
  SPEC_EMPTY_MESSAGE,
  SPEC_MIN_QUERY_CHARS,
  SPEC_PROMPT_MESSAGE,
  SPEC_TOO_BROAD_MESSAGE,
  SPEC_UNCONFIGURED_MESSAGE,
  hubCardTarget,
  parseSpecDocEvent,
  specOutcome,
  specPanelState,
  type SpecRow,
} from '@/src/components/chat/panels';

const ROW = (id: string, display: string, over: Partial<SpecRow> = {}): SpecRow => ({
  id,
  display,
  modified_at: '2026-05-01T10:00:00.000Z',
  view_url: `https://drive.google.com/file/d/${id}/view`,
  download_url: `https://drive.google.com/uc?export=download&id=${id}`,
  ext: 'pdf',
  ...over,
});

const USP = ROW('id-usp', 'Acetone · USP-NF · Spec');
const BP = ROW('id-bp', 'Acetone · BP · Spec');

const STATE = (over: Partial<Parameters<typeof specPanelState>[0]> = {}) => ({
  configured: true, error: null, searching: false, rows: [], status: null, ...over,
});

const PANEL = (over: Partial<Parameters<typeof SpecPicker>[0]> = {}) => ({
  rows: [] as SpecRow[],
  pinned: null,
  searching: false,
  configured: true,
  error: null,
  query: '',
  status: null,
  totalMatched: 0,
  themeColor: '#14B8A6',
  fromChat: false,
  onQueryChange: vi.fn(),
  onSelect: vi.fn(),
  onRetry: vi.fn(),
  onCancel: vi.fn(),
  onAskInChat: vi.fn(),
  ...over,
});

describe('specOutcome — one response mapped to what the panel does', () => {
  it('reads the status off the body rather than counting rows', () => {
    // R4 — the certificate panel can infer everything from results.length because it
    // returns one row or none. Here zero rows means two opposite things.
    const broad = specOutcome(200, { status: 'too_broad', results: [], total_matched: 0, configured: true });
    const empty = specOutcome(200, { status: 'empty', results: [], total_matched: 0, configured: true });
    expect(broad).toEqual({ kind: 'status', status: 'too_broad' });
    expect(empty).toEqual({ kind: 'status', status: 'empty' });
    expect(broad).not.toEqual(empty);
  });

  it('carries the ranked rows and how many matched in total', () => {
    const outcome = specOutcome(200, {
      status: 'ok', results: [USP, BP], total_matched: 41, configured: true,
    });
    expect(outcome).toEqual({ kind: 'results', rows: [USP, BP], totalMatched: 41 });
  });

  it('never reports fewer matches than rows it was given', () => {
    // A garbled total must not make the panel say "showing 2 of 0".
    const outcome = specOutcome(200, { status: 'ok', results: [USP, BP], configured: true });
    expect(outcome).toEqual({ kind: 'results', rows: [USP, BP], totalMatched: 2 });
  });

  it('treats a folder that went away as unconfigured, not as an error', () => {
    // /api/config is cached, so the flag can be stale by minutes. The panel says the
    // library is not set up rather than showing an empty list nobody can explain.
    expect(specOutcome(200, { status: 'unconfigured', results: [], configured: false }))
      .toEqual({ kind: 'unconfigured' });
  });

  it('maps every non-2xx to an outage', () => {
    for (const status of [400, 404, 429, 500, 503]) {
      expect(specOutcome(status, { detail: { message: 'nope' } })).toEqual({ kind: 'outage' });
    }
  });

  it('falls back to the prompt for a body it does not understand', () => {
    // Not an outage: the request succeeded. There is simply nothing to render, and
    // "start typing" is the only honest instruction left.
    for (const body of [null, {}, { status: 'ok', results: [] }, { results: 'nope' }]) {
      expect(specOutcome(200, body)).toEqual({ kind: 'status', status: 'too_short' });
    }
  });
});

describe('specPanelState — what the result area is showing', () => {
  it('opens on the prompt rather than on an emptiness nobody caused', () => {
    expect(specPanelState(STATE())).toBe('prompt');
  });

  it('keeps the last rows on screen while the next query is in flight', () => {
    // The panel would otherwise flash "Searching…" once per word typed. The spinner
    // in the input is what says we are working.
    expect(specPanelState(STATE({ rows: [USP], searching: true }))).toBe('results');
    expect(specPanelState(STATE({ searching: true }))).toBe('searching');
  });

  it('distinguishes a query that failed to select from one we have nothing for', () => {
    expect(specPanelState(STATE({ status: 'too_broad' }))).toBe('too_broad');
    expect(specPanelState(STATE({ status: 'empty' }))).toBe('empty');
  });

  it('renders too_short as the prompt', () => {
    // R1 — a visitor who typed one character and one who typed nothing need the same
    // instruction, and a fourth kind of nothing on screen teaches neither anything.
    expect(specPanelState(STATE({ status: 'too_short' }))).toBe('prompt');
  });

  it('puts unconfigured and error above everything they would contradict', () => {
    expect(specPanelState(STATE({ configured: false, rows: [USP], searching: true }))).toBe('unconfigured');
    expect(specPanelState(STATE({ error: 'down', searching: true }))).toBe('error');
  });

  it('has no pinned state at all', () => {
    // R7 — a pinned sheet renders ABOVE a live search box, so it coexists with every
    // state here. Making it exclusive would close the search the moment a visitor
    // found their first sheet, which is the dead end pinning exists to avoid.
    const states = new Set([
      specPanelState(STATE()),
      specPanelState(STATE({ rows: [USP] })),
      specPanelState(STATE({ status: 'empty' })),
      specPanelState(STATE({ status: 'too_broad' })),
      specPanelState(STATE({ searching: true })),
      specPanelState(STATE({ error: 'x' })),
      specPanelState(STATE({ configured: false })),
    ]);
    expect(states.has('pinned' as never)).toBe(false);
    expect(states.size).toBe(7);
  });
});

describe('a chat-typed spec_doc attaches to the reply and does not auto-open the panel', () => {
  // 2026-08-09 fix (plan §15.1.3): get_product_spec is the GENERAL product tool, so
  // it answers packaging and grade questions too. The panel used to force-open on
  // every one of those, replacing the chat body for a question that was never about
  // a document. Rendering the full SSE stream isn't this repo's pattern for
  // ChatWidget (chatwidget_hub.test.ts mirrors logic instead), so — matching
  // test_coa_endpoint.py's test_both_paths_call_the_same_search and coa-picker's own
  // MIcon-registry check — this pins the wiring at the source.
  const source = readFileSync(resolve(__dirname, '../components/chat/ChatWidget.tsx'), 'utf8');
  const doneStart = source.indexOf("msg.data === '[DONE]'");
  const doneBlock = source.slice(
    doneStart,
    source.indexOf('requestAnimationFrame', doneStart),
  );

  it('does not call openSpecPickerWithResults from the [DONE] handler', () => {
    expect(doneBlock).not.toContain('openSpecPickerWithResults');
  });

  it('attaches pendingSpecDoc onto the message the same way pendingQuote does', () => {
    expect(doneBlock).toMatch(/pendingSpecDoc \? \{ specDoc: pendingSpecDoc \}/);
  });

  it('still opens the SDS and COA panels automatically — only spec changed', () => {
    // The regression this guards: fixing spec must not silently flip the other two.
    expect(doneBlock).toContain('openSdsPickerWithResult(pendingSds)');
    expect(doneBlock).toContain('openCoaPickerWithResult(pendingCoa)');
  });

  it('renders a tappable card that opens the panel from msg.specDoc', () => {
    expect(source).toMatch(/msg\.specDoc &&/);
    expect(source).toContain('openSpecPickerWithResults(msg.specDoc!)');
  });
});

describe('parseSpecDocEvent — sheets found from a chat question', () => {
  const EVENT = (over: Record<string, unknown> = {}) => ({
    spec_doc: { query: 'Acetone', results: [USP, BP], pinned_id: null, ...over },
  });

  it('opens the panel on the ranked rows with the product name in the field', () => {
    expect(parseSpecDocEvent(EVENT())).toEqual({ query: 'Acetone', rows: [USP, BP], pinned: null });
  });

  it('pins the sheet the server identified', () => {
    // R8 — the server pins only when the product matched exactly one sheet, so this
    // is the "acetone has one spec" case rather than a choice made in the browser.
    expect(parseSpecDocEvent(EVENT({ results: [USP], pinned_id: USP.id })))
      .toEqual({ query: 'Acetone', rows: [USP], pinned: USP });
  });

  it('pins nothing when the server names a row it did not send', () => {
    // Trusting the id blindly would put `undefined` in the pinned card.
    expect(parseSpecDocEvent(EVENT({ pinned_id: 'id-missing' }))?.pinned).toBeNull();
  });

  it('stays out of the way when there is nothing to open the panel for', () => {
    for (const body of [null, {}, { spec_doc: {} }, { spec_doc: { results: [] } }, { coa: { results: [USP] } }]) {
      expect(parseSpecDocEvent(body)).toBeNull();
    }
  });
});

describe('hubCardTarget — the spec card', () => {
  it('opens the panel only when the bot has a folder saved', () => {
    expect(hubCardTarget('spec_picker', { spec_picker: true })).toBe('spec_picker');
  });

  it('degrades to the mini-form with the flag off', () => {
    // D3's zero-regression contract: no existing bot changes behaviour on deploy.
    expect(hubCardTarget('spec_picker', { spec_picker: false })).toBe('tool');
    expect(hubCardTarget('spec_picker', {})).toBe('tool');
    expect(hubCardTarget('spec_picker', undefined)).toBe('tool');
  });

  it('does not answer to another panel\'s flag', () => {
    expect(hubCardTarget('spec_picker', { coa_picker: true })).toBe('tool');
    expect(hubCardTarget('coa_picker', { spec_picker: true })).toBe('tool');
  });
});

describe('SpecPicker — the rendered panel', () => {
  it('greets a visitor with an instruction, not a failure', () => {
    render(<SpecPicker {...PANEL()} />);
    expect(screen.getByText(SPEC_PROMPT_MESSAGE)).toBeInTheDocument();
  });

  it('lists the ranked matches and pins the one that is tapped', () => {
    const onSelect = vi.fn();
    render(<SpecPicker {...PANEL({ rows: [USP, BP], status: 'ok', totalMatched: 2, onSelect })} />);
    fireEvent.click(screen.getByText(USP.display));
    expect(onSelect).toHaveBeenCalledWith(USP);
  });

  it('keeps the search box live under a pinned sheet', () => {
    // The comparison flow (§6): pick USP, then pick BP without going back to Home.
    render(<SpecPicker {...PANEL({ pinned: USP, rows: [USP, BP], status: 'ok', totalMatched: 2 })} />);
    expect(screen.getByLabelText('Search product specifications')).not.toBeDisabled();
    expect(screen.getByText('Other matches')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /open spec/i })).toHaveAttribute('href', USP.view_url);
  });

  it('says how many matched when the list is capped', () => {
    render(<SpecPicker {...PANEL({ rows: [USP, BP], status: 'ok', totalMatched: 41 })} />);
    expect(screen.getByText(/showing 2 of 41/i)).toBeInTheDocument();
  });

  it('does not claim a total when nothing was cut off', () => {
    render(<SpecPicker {...PANEL({ rows: [USP, BP], status: 'ok', totalMatched: 2 })} />);
    expect(screen.queryByText(/showing/i)).not.toBeInTheDocument();
  });

  it('tells a too-broad query and an empty one different things', () => {
    const { unmount } = render(<SpecPicker {...PANEL({ status: 'too_broad' })} />);
    expect(screen.getByText(SPEC_TOO_BROAD_MESSAGE)).toBeInTheDocument();
    expect(screen.queryByText(SPEC_EMPTY_MESSAGE)).not.toBeInTheDocument();
    unmount();
    render(<SpecPicker {...PANEL({ status: 'empty' })} />);
    expect(screen.getByText(SPEC_EMPTY_MESSAGE)).toBeInTheDocument();
    expect(screen.queryByText(SPEC_TOO_BROAD_MESSAGE)).not.toBeInTheDocument();
  });

  it('offers the chat when there is nothing to show', () => {
    const onAskInChat = vi.fn();
    render(<SpecPicker {...PANEL({ status: 'empty', onAskInChat })} />);
    fireEvent.click(screen.getByRole('button', { name: /ask in the chat/i }));
    expect(onAskInChat).toHaveBeenCalled();
  });

  it('offers the chat rather than an error when no folder is configured', () => {
    render(<SpecPicker {...PANEL({ configured: false })} />);
    expect(screen.getByText(SPEC_UNCONFIGURED_MESSAGE)).toBeInTheDocument();
    expect(screen.getByLabelText('Search product specifications')).toBeDisabled();
  });

  it('offers a retry on an outage', () => {
    const onRetry = vi.fn();
    render(<SpecPicker {...PANEL({ error: 'We couldn\'t reach the document library.', onRetry })} />);
    fireEvent.click(screen.getByRole('button', { name: /retry/i }));
    expect(onRetry).toHaveBeenCalled();
  });

  it('offers only Open spec, no separate Download button', () => {
    // Drive's uc?export=download endpoint sends no CORS headers, so a client-side
    // Download always degraded to opening Drive's own page anyway - Open spec
    // takes the visitor straight to view_url instead of via a second button.
    const docx = ROW('id-docx', 'Toluene · Spec', { ext: 'docx' });
    render(<SpecPicker {...PANEL({ pinned: docx })} />);
    expect(screen.getByRole('link', { name: /open spec/i })).toHaveAttribute('href', docx.view_url);
    expect(screen.queryByRole('button', { name: /download/i })).not.toBeInTheDocument();
  });

  it('omits the date rather than rendering an empty one', () => {
    render(<SpecPicker {...PANEL({ pinned: ROW('id-x', 'Xylene · Spec', { modified_at: null }) })} />);
    expect(screen.queryByText(/updated/i)).not.toBeInTheDocument();
  });

  it('reports keystrokes so the parent can debounce them', () => {
    // The panel has no Request button: a specification search costs a visitor
    // nothing, and a list that follows along is what narrows "acetone" to
    // "acetone USP". The floor lives with the parent and mirrors the server's.
    const onQueryChange = vi.fn();
    render(<SpecPicker {...PANEL({ onQueryChange })} />);
    fireEvent.change(screen.getByLabelText('Search product specifications'), {
      target: { value: 'acetone' },
    });
    expect(onQueryChange).toHaveBeenCalledWith('acetone');
    expect(SPEC_MIN_QUERY_CHARS).toBeGreaterThan(0);
  });
});
