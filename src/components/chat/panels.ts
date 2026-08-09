/**
 * Pure decision logic for the widget's full-screen panels — which one a hub card
 * opens, and what the COA panel shows.
 *
 * A separate module rather than exports on ChatWidget.tsx for two reasons: a file
 * that exports both a component and plain values drops out of Fast Refresh (every
 * edit to the widget then forces a full page reload), and these rules are the ones
 * worth testing directly instead of mirroring in a test file.
 */

// One certificate row from GET /api/widget/coa (coa-finder-plan Phase 3), or from
// the {coa:{...}} side-channel the get_coa tool emits — the SAME payload either
// way. `display` is the cleaned-up filename and the only text there is: nothing
// was ever parsed into labelled code/batch fields (D2), so there is nothing else
// to show. `download_url` is the direct-download form, never the viewer page (H8).
export type CoaRow = {
  id: string;
  display: string;
  modified_at?: string | null;
  view_url?: string;
  download_url?: string;
};

// "form" opens a structured intake form; "sds_picker" (get-sds-crash-fix-plan
// Phase 5, D10) opens the deterministic Get-SDS product picker instead of the
// conversational mini-form; "coa_picker" (coa-finder-plan Phase 3) opens the
// certificate search panel. Both pickers fall back to "tool" when their flag is off.
// "spec_picker" (spec-finder-plan Phase 3) opens the specification search panel.
export type HubCardAction = 'tool' | 'chat' | 'form' | 'sds_picker' | 'coa_picker' | 'spec_picker';

// Config-registry gates from /api/config — never a hardcoded vertical check.
export type WidgetFeatures = {
  sds_picker?: boolean;
  coa_picker?: boolean;
  spec_picker?: boolean;
};

// The single refusal (coa-confidential-access C3). Nothing found, several found and
// too little typed all end here, byte-identical, because a refusal that varies is an
// oracle telling a guesser when they are warm. The message never mentions the query,
// a count, or the library.
export const COA_REFUSED_MESSAGE =
  "We couldn't find that certificate. Please contact our support team and we'll help you.";

// The lockout (C4/§5.1). Deliberately DIFFERENT from the refusal: it describes our
// rate limit, which says nothing about any certificate, and hiding it left a customer
// who had mistyped three times pressing Request against a system that could no longer
// answer. No countdown — the route offered is support, not patience.
export const COA_LOCKED_MESSAGE =
  "Too many unsuccessful attempts. Please contact our support team and we'll help you.";

// A Drive outage stays distinct from the refusal (§6). A deliberate exception to C3:
// it does not depend on what was typed, so it is not an oracle, and collapsing it
// would tell a customer their certificate does not exist when in fact Drive is down.
// "or ask us in the chat" was the route out while the panel had no button; L2 gave
// it one, and leaving the sentence in put two instructions next to two buttons.
export const COA_OUTAGE_MESSAGE =
  "We couldn't reach the document library. Please try again in a moment.";

// How long the field stays disabled when the server locks a visitor out, if it did
// not say. The server's own window is authoritative — this is only what the panel
// falls back to, and it is the interface re-enabling itself, never permission to ask
// again: the backend refuses a locked-out request whatever the interface shows (§5.1).
export const COA_LOCKOUT_FALLBACK_MS = 15 * 60 * 1000;
const COA_LOCKOUT_MAX_MS = 60 * 60 * 1000;

// `retry_after` seconds off a 429 → milliseconds. Capped, because a garbled or
// hostile value must not be able to disable the field for a day, and floored onto the
// fallback for anything that is not a usable positive number.
export function coaLockoutMs(payload: unknown): number {
  const body = payload as { retry_after?: unknown; detail?: { retry_after?: unknown } } | null;
  const raw = body?.detail?.retry_after ?? body?.retry_after;
  const seconds = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(seconds) || seconds <= 0) return COA_LOCKOUT_FALLBACK_MS;
  return Math.min(seconds * 1000, COA_LOCKOUT_MAX_MS);
}

// One HTTP response from GET /api/widget/coa → what the panel does about it. Pure,
// because this mapping is the rule and not the plumbing: a 429 that fell through to
// the outage branch would leave a locked-out visitor pressing Request against a
// backend that has already stopped answering, and a green suite would not notice.
export type CoaOutcome =
  | { kind: 'locked'; lockoutMs: number }
  | { kind: 'outage' }
  | { kind: 'released'; row: CoaRow; configured: boolean }
  | { kind: 'refused'; configured: boolean };

export function coaOutcome(status: number, body: unknown): CoaOutcome {
  if (status === 429) return { kind: 'locked', lockoutMs: coaLockoutMs(body) };
  if (status < 200 || status >= 300) return { kind: 'outage' };
  const data = (body ?? {}) as { results?: unknown; configured?: unknown };
  const configured = data.configured !== false;
  // One row or none — the endpoint cannot return more (§4 step 5). Anything else is
  // a payload we do not understand, and a refusal is the safe reading of it.
  const rows = Array.isArray(data.results) ? data.results : [];
  if (rows.length !== 1) return { kind: 'refused', configured };
  return { kind: 'released', row: rows[0] as CoaRow, configured };
}

// What the COA panel is showing. A pure function because a 7-deep ternary is where a
// rule like C3 goes to die.
//
// `result` holds the one released certificate and `refused` says a submission came
// back with nothing — they are mutually exclusive by construction, since a submission
// clears both before it fires. `refused` cannot be inferred from `result === null`:
// that is also the state of a panel nobody has pressed Request on yet, and showing
// the refusal there would greet every visitor with a failure.
export type CoaPanelInputs = {
  configured: boolean;
  lockedOut: boolean;
  error: string | null;
  searching: boolean;
  result: CoaRow | null;
  refused: boolean;
};

export function coaPanelState(
  s: CoaPanelInputs,
): 'unconfigured' | 'locked' | 'error' | 'searching' | 'released' | 'refused' | 'prompt' {
  if (!s.configured) return 'unconfigured';
  // Above the outage copy on purpose: a locked-out visitor cannot send the request
  // that would discover Drive is down, so "try again" would be the wrong instruction.
  if (s.lockedOut) return 'locked';
  if (s.error) return 'error';
  if (s.searching) return 'searching';
  if (s.result) return 'released';
  return s.refused ? 'refused' : 'prompt';
}

// Which behaviour a hub card tap takes. Pure so the fallback contract is testable:
// a "*_picker" card whose feature flag is off degrades to the "tool" mini-form
// rather than opening a panel that cannot work.
export function hubCardTarget(
  action: HubCardAction,
  features: WidgetFeatures | undefined,
): 'chat' | 'form' | 'sds_picker' | 'coa_picker' | 'spec_picker' | 'tool' {
  if (action === 'chat') return 'chat';
  if (action === 'form') return 'form';
  if (action === 'sds_picker' && features?.sds_picker) return 'sds_picker';
  if (action === 'coa_picker' && features?.coa_picker) return 'coa_picker';
  if (action === 'spec_picker' && features?.spec_picker) return 'spec_picker';
  return 'tool';
}

// The {coa:{...}} side-channel from the get_coa tool → the one certificate to open
// the panel on, or null when there is nothing to open it for. The statuses that
// carry no rows (not_found, not_configured, unavailable) never emit this event at
// all, so a missing or empty `results` means the visitor stays in the conversation.
//
// One row is now the only shape there is: `resolve` releases a certificate or
// nothing, so anything else is a payload we do not understand and refusing to guess
// at it is safer than showing the visitor its first row.
//
// The payload's `query` is deliberately dropped: it is whatever the model passed
// into the tool's free-text slot, which in practice is the visitor's whole sentence,
// and putting that in the field shows the tail of a question instead of an identifier.
export function parseCoaEvent(parsed: unknown): CoaRow | null {
  const coa = (parsed as { coa?: { results?: unknown } })?.coa;
  if (!coa || !Array.isArray(coa.results) || coa.results.length !== 1) return null;
  return coa.results[0] as CoaRow;
}

// The same side-channel carrying a lockout instead of a certificate (§7). The chat
// path shares the panel's counters, so a visitor can be locked out by a conversation
// and must find the field already disabled when they reach the panel — rather than
// discovering it by pressing Request against a backend that has stopped answering.
export function parseCoaLockout(parsed: unknown): number | null {
  const coa = (parsed as { coa?: { status?: unknown } })?.coa;
  if (!coa || coa.status !== 'locked_out') return null;
  return coaLockoutMs(coa);
}

// ───────────────────────── specification sheets (spec-finder-plan Phase 3) ────
//
// Everything below is the OPPOSITE of the COA rules above, and that is the design
// (D1): specifications are public documents meant to be browsed, so this panel shows
// a ranked list, tells "you typed too little" apart from "we have nothing", and has
// no throttle, no lockout and no single refusal to keep uniform.

// One row from GET /api/widget/spec. Structurally identical to CoaRow and kept as its
// own type on purpose: the two panels are allowed to diverge, and an alias would make
// a change to the certificate payload silently change this one.
export type SpecRow = {
  id: string;
  display: string;
  modified_at?: string | null;
  view_url?: string;
  download_url?: string;
  // §15 — the source file's extension, so a .docx specification is not saved under a
  // .pdf name. `display` has it stripped and the download URL carries a file ID, so
  // the server is the only place this can come from.
  ext?: string;
};

// What the last search did, straight from the server. `null` means nothing has been
// asked yet, which is not the same as any answer the server can give.
export type SpecSearchStatus = 'ok' | 'empty' | 'too_broad' | 'too_short';

export const SPEC_PROMPT_MESSAGE =
  'Start typing a product name to find its specification sheet.';

// The §4.1 selectivity guard tripped: the query matched most of the library, so it
// selected nothing meaningful. The instruction is to type MORE — which is exactly the
// instruction the empty state must not give.
export const SPEC_TOO_BROAD_MESSAGE =
  'That matches too many documents. Keep typing the product name to narrow it down.';

export const SPEC_EMPTY_MESSAGE =
  "We don't have a specification sheet for that. Ask us in the chat and our team can help.";

export const SPEC_OUTAGE_MESSAGE =
  "We couldn't reach the document library. Please try again in a moment.";

export const SPEC_UNCONFIGURED_MESSAGE =
  "Specification sheets aren't set up yet. Ask us in the chat and our team will send one over.";

// The shortest query worth a request. Mirrors MIN_QUERY_CHARS in services/spec_drive.py
// so a single keystroke never leaves the browser; the server enforces it regardless.
export const SPEC_MIN_QUERY_CHARS = 2;

// How long the panel waits after a keystroke before searching. Long enough that typing
// a product name is one request rather than seven, short enough that the list feels
// like it is following along.
export const SPEC_DEBOUNCE_MS = 300;

// One HTTP response from GET /api/widget/spec → what the panel does about it. Pure for
// the same reason coaOutcome is: the mapping IS the rule. There is no 429 branch
// because there is no throttle, and the status comes from the body rather than being
// re-derived from results.length — "matched nothing" and "matched too much" are both
// zero rows and need opposite instructions (R4).
export type SpecOutcome =
  | { kind: 'unconfigured' }
  | { kind: 'outage' }
  | { kind: 'results'; rows: SpecRow[]; totalMatched: number }
  | { kind: 'status'; status: SpecSearchStatus };

export function specOutcome(status: number, body: unknown): SpecOutcome {
  if (status < 200 || status >= 300) return { kind: 'outage' };
  const data = (body ?? {}) as {
    status?: unknown; results?: unknown; total_matched?: unknown; configured?: unknown;
  };
  if (data.configured === false) return { kind: 'unconfigured' };
  const rows = Array.isArray(data.results) ? (data.results as SpecRow[]) : [];
  if (data.status === 'ok' && rows.length > 0) {
    const total = typeof data.total_matched === 'number' ? data.total_matched : rows.length;
    return { kind: 'results', rows, totalMatched: Math.max(total, rows.length) };
  }
  // R1 — `too_short` is a real server status and renders as the prompt, so it stays a
  // status here rather than being flattened: the panel decides the copy, not the wire.
  if (data.status === 'too_broad' || data.status === 'empty' || data.status === 'too_short') {
    return { kind: 'status', status: data.status };
  }
  // A body we do not understand, or "ok" with no rows. Neither is an error worth
  // showing an outage for, and the prompt is the only honest thing left to say.
  return { kind: 'status', status: 'too_short' };
}

// What the specification panel's RESULT AREA is showing.
//
// `pinned` is deliberately absent. §6 lists it as a state, but a pinned document
// renders ABOVE a search box that stays live — that is the whole point of pinning
// (proven in SdsPicker by the sds-persistent-panel work), so it coexists with every
// state here rather than replacing them. Making it exclusive would close the search
// the moment a visitor found their first sheet, which is exactly the dead end the
// pattern exists to avoid.
export type SpecPanelInputs = {
  configured: boolean;
  error: string | null;
  searching: boolean;
  rows: SpecRow[];
  status: SpecSearchStatus | null;
};

// The {spec_doc:{...}} side-channel the chat path emits (§7) → what to open the panel
// on. `spec_doc` and not `spec`: the latter is the catalog path's key on the server
// and feeds session titles and the sales funnel.
//
// Unlike the certificate event, this carries a LIST and a query: a product with six
// standards has no single "the" specification, so the panel opens on the ranked rows
// with the product name in the field, and pins one only when the server says exactly
// one sheet matched. Pinning an arbitrary row would answer a question nobody asked.
export type SpecDocEvent = { query: string; rows: SpecRow[]; pinned: SpecRow | null };

export function parseSpecDocEvent(parsed: unknown): SpecDocEvent | null {
  const doc = (parsed as { spec_doc?: { query?: unknown; results?: unknown; pinned_id?: unknown } })?.spec_doc;
  if (!doc || !Array.isArray(doc.results) || doc.results.length === 0) return null;
  const rows = doc.results as SpecRow[];
  const pinned = rows.find(r => r.id === doc.pinned_id) ?? null;
  return { query: typeof doc.query === 'string' ? doc.query : '', rows, pinned };
}

export function specPanelState(
  s: SpecPanelInputs,
): 'unconfigured' | 'error' | 'results' | 'searching' | 'too_broad' | 'empty' | 'prompt' {
  if (!s.configured) return 'unconfigured';
  if (s.error) return 'error';
  // Above `searching` on purpose: the rows from the last query stay on screen while
  // the next one is in flight, and the spinner in the input is what says we are
  // working. Swapping the list for "Searching…" on every debounce would make the
  // panel flash on each word a visitor types.
  if (s.rows.length > 0) return 'results';
  if (s.searching) return 'searching';
  if (s.status === 'too_broad') return 'too_broad';
  if (s.status === 'empty') return 'empty';
  return 'prompt';
}
