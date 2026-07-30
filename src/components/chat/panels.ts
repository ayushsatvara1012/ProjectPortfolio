/**
 * Pure decision logic for the widget's full-screen panels — which one a hub card
 * opens, and what the COA panel's list area shows.
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

// Mirrors the server's MIN_QUERY_CHARS: below it there is nothing to ask for, so
// the panel keeps its empty state instead of firing a request or flashing "no
// matches" at someone who has typed one character.
export const COA_MIN_QUERY_CHARS = 2;

// The COA list area has six mutually exclusive states. A pure function because a
// 6-deep ternary is where a rule like D1 goes to die.
//
// D1 is enforced by what can put rows in `results` — only a >=2-character query or
// an explicit chat-typed request, never a listing — not by the query itself. The
// query is therefore NOT a precondition for showing rows: a chat-typed request
// arrives with rows and an empty search box, because the model passes conversational
// prose into the tool's free-text slot (§7.1) and prefilling the box with
// "…batch 100.26R016. Can I get the COA?" reads as broken. Editing the box below the
// floor clears the rows, so an emptied box always falls back to the prompt.
export function coaListState(
  configured: boolean,
  error: string | null,
  query: string,
  results: CoaRow[] | null,
): 'unconfigured' | 'error' | 'prompt' | 'searching' | 'empty' | 'results' {
  if (!configured) return 'unconfigured';
  if (error) return 'error';
  if (results !== null) return results.length === 0 ? 'empty' : 'results';
  if (query.trim().length < COA_MIN_QUERY_CHARS) return 'prompt';
  return 'searching';
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

// The {coa:{...}} side-channel from the get_coa tool → what the panel needs, or
// null when there is nothing to open a panel for. The statuses that carry no rows
// (not_found, not_configured, unavailable) never emit this event at all, so a
// missing or empty `results` means the visitor stays in the conversation.
//
// The payload's `query` is deliberately dropped: it is whatever the model passed
// into the tool's free-text slot, which in practice is the visitor's whole sentence
// (§7.1), and putting that in the search box shows the tail of a question instead
// of a search term.
export function parseCoaEvent(parsed: unknown): { rows: CoaRow[]; truncated: boolean } | null {
  const coa = (parsed as { coa?: { results?: unknown; truncated?: unknown } })?.coa;
  if (!coa || !Array.isArray(coa.results) || coa.results.length === 0) return null;
  return { rows: coa.results as CoaRow[], truncated: Boolean(coa.truncated) };
}

// One match pins immediately; several stay a list for the visitor to choose from
// (D5 — we never pick a grade on their behalf).
export function coaPinnedRow(rows: CoaRow[]): CoaRow | null {
  return rows.length === 1 ? rows[0] : null;
}
