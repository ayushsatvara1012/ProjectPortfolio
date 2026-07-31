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
export type HubCardAction = 'tool' | 'chat' | 'form' | 'sds_picker' | 'coa_picker';

// Config-registry gates from /api/config — never a hardcoded vertical check.
export type WidgetFeatures = { sds_picker?: boolean; coa_picker?: boolean };

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
): 'chat' | 'form' | 'sds_picker' | 'coa_picker' | 'tool' {
  if (action === 'chat') return 'chat';
  if (action === 'form') return 'form';
  if (action === 'sds_picker' && features?.sds_picker) return 'sds_picker';
  if (action === 'coa_picker' && features?.coa_picker) return 'coa_picker';
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
