/**
 * COA finder Phase 3 — the widget's certificate panel.
 *
 * These import the real helpers out of components/chat/panels.ts rather than
 * mirroring them (the older chatwidget_*.test.ts convention), because the rules
 * being tested are the ones the plan actually guarantees and a mirrored copy would
 * happily keep passing after the component stopped agreeing with it:
 *   - D1: the panel is search-first, so rows only ever come from a real query or an
 *     explicit chat request — never from a listing.
 *   - The flag-off fallback: a picker card with its feature flag off degrades to
 *     the mini-form, never to a panel that can only say "not set up".
 *   - The chat path opens a panel only when there are rows in it, and pins only
 *     when the match is unambiguous (D5).
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, it, expect } from 'vitest';

import {
  COA_MIN_QUERY_CHARS,
  coaListState,
  coaPinnedRow,
  hubCardTarget,
  parseCoaEvent,
} from '@/src/components/chat/panels';

const ROW = (id: string) => ({
  id,
  display: `100RG · 100.26R016 · ACETONE RG`,
  modified_at: '2026-07-01T10:00:00.000Z',
  view_url: `https://drive.google.com/file/d/${id}/view`,
  download_url: `https://drive.google.com/uc?export=download&id=${id}`,
});

describe('coaListState — D1, search-first and never browsable', () => {
  it('shows the prompt, not a list, when it is holding nothing', () => {
    expect(coaListState(true, null, '', null)).toBe('prompt');
    expect(coaListState(true, null, '1', null)).toBe('prompt');
    expect(coaListState(true, null, '   ', null)).toBe('prompt');
  });

  it('shows rows the visitor asked for in chat, where the box is empty by design', () => {
    // The chat path opens the panel with rows and NO query, because the tool's slot
    // holds the visitor's whole sentence (§7.1) and prefilling it reads as broken.
    // D1 is enforced by what can fill `results` - a real query or an explicit chat
    // request, never a listing - not by requiring text in the box.
    expect(coaListState(true, null, '', [ROW('a')])).toBe('results');
  });

  it('agrees with the server on the minimum query length', () => {
    expect(COA_MIN_QUERY_CHARS).toBe(2);
    expect(coaListState(true, null, 'EP', null)).not.toBe('prompt');
  });

  it('falls back to the prompt when the visitor clears the box', () => {
    // onCoaQueryChange nulls `results` below the floor, so this pair is what the
    // panel actually goes through - rows do not linger under an emptied box.
    expect(coaListState(true, null, '100RG', [ROW('a')])).toBe('results');
    expect(coaListState(true, null, '', null)).toBe('prompt');
  });

  it('distinguishes "still searching" from "nothing matched"', () => {
    // null = no response yet; [] = the server answered and found nothing. Collapsing
    // these tells a visitor their batch does not exist while the request is in flight.
    expect(coaListState(true, null, '100RG', null)).toBe('searching');
    expect(coaListState(true, null, '100RG', [])).toBe('empty');
  });

  it('renders rows once there are any', () => {
    expect(coaListState(true, null, '100RG', [ROW('a')])).toBe('results');
  });

  it('an error outranks any result state', () => {
    // H15 — a Drive outage must not read as "no certificate exists", including when
    // a previous query left rows on screen.
    expect(coaListState(true, 'unreachable', '100RG', [ROW('a')])).toBe('error');
    expect(coaListState(true, 'unreachable', '100RG', [])).toBe('error');
  });

  it('an unconfigured folder outranks everything', () => {
    // /api/config is cached, so the folder can disappear under an open panel.
    expect(coaListState(false, 'unreachable', '100RG', [ROW('a')])).toBe('unconfigured');
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
  it('carries the rows and the cap flag', () => {
    const parsed = parseCoaEvent({
      coa: { status: 'multiple', results: [ROW('a'), ROW('b')], query: '100.26R016', truncated: true },
    });
    expect(parsed).toEqual({ rows: [ROW('a'), ROW('b')], truncated: true });
  });

  it('drops the query, which is the visitor\'s whole sentence and not a search term', () => {
    // Found in the browser: the panel showed "…batch 100.26R016. Can I get the COA?"
    // scrolled to its tail in the search box. The rows are the answer; the box stays
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

  it('tolerates a payload missing the optional fields', () => {
    const parsed = parseCoaEvent({ coa: { results: [ROW('a')] } });
    expect(parsed).toEqual({ rows: [ROW('a')], truncated: false });
  });
});

describe('coaPinnedRow — D5, the visitor picks', () => {
  it('pins an unambiguous match', () => {
    expect(coaPinnedRow([ROW('a')])).toEqual(ROW('a'));
  });

  it('pins nothing when a batch spans several grades (F1)', () => {
    // 100.26R016 exists as 100LR / 100PU / 100RG — choosing one for the visitor
    // would be guessing at the grade they are holding.
    expect(coaPinnedRow([ROW('a'), ROW('b'), ROW('c')])).toBeNull();
    expect(coaPinnedRow([])).toBeNull();
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
    expect(panel).toContain('downloadDocument(selected.download_url!');
    expect(panel).not.toContain('downloadDocument(selected.view_url');
  });

  it('the panel still opens the viewer page for Open', () => {
    expect(panel).toContain('href={selected.view_url}');
  });
});
