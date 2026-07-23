/**
 * ChatWidget — Phase 3 pack-driven hub (logic in isolation).
 *
 * Following the convention in chatwidget_streaming.test.ts, we test the pure
 * decision logic extracted from ChatWidget.tsx rather than rendering the full
 * component. Two guarantees matter most:
 *   1. The hub is vertical-gated: no hub_cards => no hub => a generic bot opens
 *      straight to chat, exactly as before (the no-regression gate).
 *   2. A tool card composes the right message from its prompt_template + the
 *      mini-form value, which drives the existing agent loop to that tool.
 *
 * When the mirrored logic in ChatWidget.tsx changes, update these helpers.
 */
import { describe, it, expect } from 'vitest';

type HubCard = {
  id: string;
  label: string;
  icon: string;
  action: 'tool' | 'chat';
  subtitle?: string;
  input_label?: string;
  prompt_template?: string;
};

// Mirrors the JSX gate: hub strip shows on a fresh convo when the pack supplied
// cards; otherwise quick_questions; otherwise nothing.
function starterMode(
  messagesLen: number,
  input: string,
  hubCards: HubCard[] | undefined,
  quickQuestions: unknown[],
): 'hub' | 'quick' | 'none' {
  const fresh = messagesLen === 1 && !input.trim();
  if (!fresh) return 'none';
  if ((hubCards?.length ?? 0) > 0) return 'hub';
  if (quickQuestions.length > 0) return 'quick';
  return 'none';
}

// Mirrors submitHubCard's message composition.
function composeHubMessage(card: HubCard, value: string): string {
  return (card.prompt_template || '{value}').replace('{value}', value.trim());
}

const CARDS: HubCard[] = [
  { id: 'sds', label: 'Request SDS', icon: 'file-certificate', action: 'tool',
    input_label: 'Product name or CAS number', prompt_template: 'I need the Safety Data Sheet for {value}.' },
  { id: 'spec', label: 'Product specs', icon: 'flask', action: 'tool',
    input_label: 'Product name or CAS number', prompt_template: 'What grade and packaging is available for {value}?' },
  { id: 'ask', label: 'Ask a question', icon: 'message-circle', action: 'chat' },
];

describe('Phase 3 hub — vertical gating', () => {
  it('shows the hub on a fresh conversation when the pack supplies cards', () => {
    expect(starterMode(1, '', CARDS, [])).toBe('hub');
  });

  it('a generic bot (no hub_cards) is unchanged — never shows a hub', () => {
    // No-regression gate: undefined and [] both fall through to today's behaviour.
    expect(starterMode(1, '', undefined, [])).toBe('none');
    expect(starterMode(1, '', [], [])).toBe('none');
    expect(starterMode(1, '', undefined, ['How much?'])).toBe('quick');
  });

  it('hub takes precedence over quick_questions when both exist', () => {
    expect(starterMode(1, '', CARDS, ['Other question'])).toBe('hub');
  });

  it('disappears once the conversation has progressed or input is typed', () => {
    expect(starterMode(2, '', CARDS, [])).toBe('none');
    expect(starterMode(1, 'acetone', CARDS, [])).toBe('none');
  });
});

describe('Phase 3 hub — card message composition', () => {
  it('substitutes {value} into a tool card template', () => {
    expect(composeHubMessage(CARDS[0], 'Acetone')).toBe(
      'I need the Safety Data Sheet for Acetone.');
    expect(composeHubMessage(CARDS[1], '67-64-1')).toBe(
      'What grade and packaging is available for 67-64-1?');
  });

  it('trims the mini-form value before sending', () => {
    expect(composeHubMessage(CARDS[0], '  Toluene  ')).toBe(
      'I need the Safety Data Sheet for Toluene.');
  });

  it('the chat card carries no tool template (just opens the input)', () => {
    expect(CARDS[2].action).toBe('chat');
    expect(CARDS[2].prompt_template).toBeUndefined();
  });
});

// Mirrors hubProductMatches: filter the catalog by name OR cas, collapse to one
// row per product (the catalog has a row per grade -> same name+CAS), cap the list.
type ProductOption = { name: string; cas_number?: string; grade?: string };
function filterProducts(opts: ProductOption[], query: string): ProductOption[] {
  const q = query.trim().toLowerCase();
  const list = q
    ? opts.filter(p =>
        p.name.toLowerCase().includes(q) ||
        (p.cas_number || '').toLowerCase().includes(q))
    : opts;
  const seen = new Set<string>();
  const distinct: ProductOption[] = [];
  for (const p of list) {
    const k = `${p.name.toLowerCase()}|${p.cas_number || ''}`;
    if (seen.has(k)) continue;
    seen.add(k);
    distinct.push(p);
    if (distinct.length >= 50) break;
  }
  return distinct;
}

const CATALOG: ProductOption[] = [
  { name: 'Acetone', cas_number: '67-64-1', grade: 'Industrial' },
  { name: 'Acetic Acid', cas_number: '64-19-7', grade: 'Glacial' },
  { name: 'Toluene', cas_number: '108-88-3', grade: 'Industrial' },
];

describe('Phase 3 hub — product picker filter', () => {
  it('empty query returns the full catalog (browse)', () => {
    expect(filterProducts(CATALOG, '')).toHaveLength(3);
    expect(filterProducts(CATALOG, '  ')).toHaveLength(3);
  });

  it('matches on product name, case-insensitively', () => {
    expect(filterProducts(CATALOG, 'acet').map(p => p.name)).toEqual(['Acetone', 'Acetic Acid']);
    expect(filterProducts(CATALOG, 'TOLU').map(p => p.name)).toEqual(['Toluene']);
  });

  it('matches on CAS number too', () => {
    expect(filterProducts(CATALOG, '108-88-3').map(p => p.name)).toEqual(['Toluene']);
  });

  it('collapses multiple grades of one product to a single row (dup-key fix)', () => {
    const multiGrade: ProductOption[] = [
      { name: 'Acetonitrile', cas_number: '75-05-8', grade: 'LR' },
      { name: 'Acetonitrile', cas_number: '75-05-8', grade: 'AR' },
      { name: 'Acetonitrile', cas_number: '75-05-8', grade: 'HPLC' },
    ];
    expect(filterProducts(multiGrade, 'aceto')).toHaveLength(1);
  });

  it('returns nothing for a non-match', () => {
    expect(filterProducts(CATALOG, 'xylene')).toEqual([]);
  });
});

// Mirrors the onmessage SSE handler: an {sds:{url}}, {quote:{...}} or {form:{...}}
// event is captured as a pending action; a normal {token} event is streamed text.
type SdsEvent = { url: string; product?: string; cas_number?: string; updated_at?: string; label?: string };
function parseSseEvent(raw: string): {
  sds?: SdsEvent; quote?: { status: string };
  form?: { form_id: string; prefill: Record<string, string> }; token?: string;
} {
  const parsed = JSON.parse(raw);
  if (parsed.sds && typeof parsed.sds.url === 'string') {
    return { sds: { url: parsed.sds.url, product: parsed.sds.product, cas_number: parsed.sds.cas_number, updated_at: parsed.sds.updated_at, label: parsed.sds.label } };
  }
  if (parsed.quote && (parsed.quote.status === 'quoted' || parsed.quote.status === 'price_on_request')) {
    return { quote: parsed.quote };
  }
  if (parsed.form && typeof parsed.form.form_id === 'string') {
    return { form: { form_id: parsed.form.form_id, prefill: parsed.form.prefill || {} } };
  }
  return { token: parsed.token || parsed.content || parsed.text || '' };
}

describe('Phase 3 hub — SDS action event', () => {
  it('captures an sds event as a structured action, not text', () => {
    const out = parseSseEvent(JSON.stringify({ sds: { url: 'https://sds.example.com/a.pdf', product: 'Acetone', label: 'Open SDS' } }));
    expect(out.sds?.url).toBe('https://sds.example.com/a.pdf');
    expect(out.token).toBeUndefined();
  });

  it('captures cas_number and updated_at alongside the url (sds-persistent-panel plan)', () => {
    const out = parseSseEvent(JSON.stringify({ sds: { url: 'https://sds.example.com/a.pdf', product: 'Acetone', cas_number: '67-64-1', updated_at: '2026-06-01T00:00:00Z' } }));
    expect(out.sds?.cas_number).toBe('67-64-1');
    expect(out.sds?.updated_at).toBe('2026-06-01T00:00:00Z');
  });

  it('still treats token events as streamed text', () => {
    const out = parseSseEvent(JSON.stringify({ token: 'The sheet is ready.' }));
    expect(out.token).toBe('The sheet is ready.');
    expect(out.sds).toBeUndefined();
  });

  it('ignores a malformed sds event with no url', () => {
    const out = parseSseEvent(JSON.stringify({ sds: { product: 'Acetone' } }));
    expect(out.sds).toBeUndefined();
  });
});

// Mirrors the persistent SDS panel (sds-persistent-panel plan, Option A): a
// pick pins the result and the panel stays open — no chat message, no close.
// Also mirrors the [DONE] handler's split: pendingSds now drives a panel-open
// side effect instead of attaching to the bot message.
type SdsPanelState = { open: boolean; selected: SdsEvent | null };

function pickSdsProduct(state: SdsPanelState, p: SdsEvent): SdsPanelState {
  return { open: state.open, selected: p };
}

function applyStreamDone(pendingSds: SdsEvent | null): { messageHasSds: boolean; opensPanel: boolean } {
  return { messageHasSds: false, opensPanel: pendingSds !== null };
}

describe('sds-persistent-panel — selection stays in-panel (Option A)', () => {
  const acetone: SdsEvent = { url: 'https://sds.example.com/acetone.pdf', product: 'Acetone', cas_number: '67-64-1' };
  const toluene: SdsEvent = { url: 'https://sds.example.com/toluene.pdf', product: 'Toluene', cas_number: '108-88-3' };

  it('picking a product pins it without closing the panel', () => {
    const state = pickSdsProduct({ open: true, selected: null }, acetone);
    expect(state.open).toBe(true);
    expect(state.selected).toEqual(acetone);
  });

  it('picking a second product swaps the pinned card, panel still open', () => {
    const afterFirst = pickSdsProduct({ open: true, selected: null }, acetone);
    const afterSecond = pickSdsProduct(afterFirst, toluene);
    expect(afterSecond.open).toBe(true);
    expect(afterSecond.selected).toEqual(toluene);
  });
});

describe('sds-persistent-panel — chat-typed request routes to the panel, not the message', () => {
  it('a resolved get_sds result never attaches to the bot chat message', () => {
    const acetone: SdsEvent = { url: 'https://sds.example.com/acetone.pdf', product: 'Acetone' };
    expect(applyStreamDone(acetone)).toEqual({ messageHasSds: false, opensPanel: true });
  });

  it('no sds event means no panel auto-open', () => {
    expect(applyStreamDone(null)).toEqual({ messageHasSds: false, opensPanel: false });
  });
});

// Mirrors the INR formatter used by the quote card (deterministic figures only).
function fmtINR(n?: number | null, currency?: string): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  const sym = (currency || 'INR') === 'INR' ? '₹' : `${currency} `;
  return `${sym}${n.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

describe('Phase 4a — quote action event', () => {
  it('captures a priced quote event as a structured card, not text', () => {
    const out = parseSseEvent(JSON.stringify({ quote: { status: 'quoted', product: 'Acetone', subtotal: 5682 } }));
    expect(out.quote?.status).toBe('quoted');
    expect(out.token).toBeUndefined();
  });

  it('captures a price-on-request event as a card', () => {
    const out = parseSseEvent(JSON.stringify({ quote: { status: 'price_on_request', product: 'Acetone' } }));
    expect(out.quote?.status).toBe('price_on_request');
  });

  it('ignores a non-terminal quote status (e.g. needs_grade is text-only)', () => {
    const out = parseSseEvent(JSON.stringify({ quote: { status: 'needs_grade' } }));
    expect(out.quote).toBeUndefined();
  });

  it('formats INR figures and dashes nulls', () => {
    expect(fmtINR(5682, 'INR')).toBe('₹5,682');
    expect(fmtINR(null)).toBe('—');
    expect(fmtINR(undefined)).toBe('—');
  });
});

describe('Phase 4b — open-form action event', () => {
  it('captures a {form} event as an open-form action (with prefill), not text', () => {
    const out = parseSseEvent(JSON.stringify({ form: { form_id: 'sample', prefill: { product: 'Acetone', grade: 'AR' } } }));
    expect(out.form?.form_id).toBe('sample');
    expect(out.form?.prefill.product).toBe('Acetone');
    expect(out.token).toBeUndefined();
  });

  it('defaults prefill to empty when omitted', () => {
    const out = parseSseEvent(JSON.stringify({ form: { form_id: 'sample' } }));
    expect(out.form?.prefill).toEqual({});
  });

  it('ignores a malformed form event with no form_id', () => {
    const out = parseSseEvent(JSON.stringify({ form: { prefill: {} } }));
    expect(out.form).toBeUndefined();
  });
});

// The form's required-field validation (mirrors SampleForm's `missing` computation
// and the server's required_form_fields check — they must agree).
function missingRequired(schema: { name: string; required?: boolean }[], values: Record<string, string>): string[] {
  return schema.filter(f => f.required && !(values[f.name] || '').trim()).map(f => f.name);
}

describe('Phase 4b — sample form validation', () => {
  const schema = [
    { name: 'product', required: true },
    { name: 'grade', required: true },
    { name: 'contact_email', required: true },
    { name: 'notes', required: false },
  ];

  it('flags every empty required field', () => {
    expect(missingRequired(schema, {})).toEqual(['product', 'grade', 'contact_email']);
  });

  it('passes when required fields are filled (optional may be blank)', () => {
    expect(missingRequired(schema, { product: 'Acetone', grade: 'AR', contact_email: 'a@b.com' })).toEqual([]);
  });

  it('treats whitespace-only as missing', () => {
    expect(missingRequired(schema, { product: '  ', grade: 'AR', contact_email: 'a@b.com' })).toEqual(['product']);
  });
});

// Mirrors the hybrid bottom-region gate: a mini-form shows whenever a card is
// active (even mid-conversation, when launched from the Home screen); otherwise
// the card strip on a fresh convo; otherwise quick_questions; otherwise nothing.
function hubRegionMode(
  hasHub: boolean, activeCard: boolean, messagesLen: number, input: string, quickLen: number,
): 'miniform' | 'strip' | 'quick' | 'none' {
  if (hasHub && (activeCard || (messagesLen === 1 && !input.trim()))) {
    return activeCard ? 'miniform' : 'strip';
  }
  if (messagesLen === 1 && !input.trim() && quickLen > 0) return 'quick';
  return 'none';
}

// Mirrors the nav: the back arrow (→ Home) shows only for a hub bot on chat view.
function backArrowVisible(hasHub: boolean, view: 'chat' | 'home'): boolean {
  return hasHub && view === 'chat';
}

describe('Phase 3 hybrid — Chat/Home navigation', () => {
  it('mini-form can open mid-conversation (launched from Home)', () => {
    // Card active + 6 messages deep => still shows the mini-form (the old gate
    // only allowed it on messages.length === 1).
    expect(hubRegionMode(true, true, 6, '', 0)).toBe('miniform');
  });

  it('fresh chat with a pack shows the card strip', () => {
    expect(hubRegionMode(true, false, 1, '', 0)).toBe('strip');
  });

  it('a generic bot never shows hub UI, only quick_questions if present', () => {
    expect(hubRegionMode(false, false, 1, '', 0)).toBe('none');
    expect(hubRegionMode(false, false, 1, '', 3)).toBe('quick');
  });

  it('after the visitor types, the fresh strip gives way (no card active)', () => {
    expect(hubRegionMode(true, false, 1, 'acetone', 0)).toBe('none');
  });

  it('back arrow shows only for a hub bot on the chat screen', () => {
    expect(backArrowVisible(true, 'chat')).toBe(true);
    expect(backArrowVisible(true, 'home')).toBe(false); // on Home, bottom tabs navigate
    expect(backArrowVisible(false, 'chat')).toBe(false); // generic bot: no nav arrow
  });
});
