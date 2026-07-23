# Reopenable product picker for tool hub cards (quote / spec)

## Problem

Tapping "Get a quote" (or "Product specs") opens the hub mini-form with the
searchable product list (`hubProductMatches`) above the input.
The instant a product is picked, `submitHubValue` nulls `activeHubCard` and
hands off to plain chat — there is no way to pick a second product without
manually going back to Home and re-tapping the tile.

## Decision (confirmed with user 2026-07-23)

- Clicking the new search icon reopens the same simple drop-up list
  (`hubProductMatches` inside the existing mini-form), not a new persistent
  panel like `SdsPicker`.
- Each product pick starts its own separate quote/spec request — no
  multi-item quote. No backend change.
- The icon stays visible for the rest of the "tool session" (until the
  visitor leaves back to Home or starts/resumes a session), not just once.
- Entry is tile-only. Free-text quote-like messages do NOT surface the icon
  (unlike the SDS picker's `openSdsPickerWithResult` precedent).

Scope is **not** hardcoded to the `quote` card. Any hub card with
`action: 'tool'` and `input_source: 'products'` gets this behavior for free
(currently `quote` and `spec` in `chemical.py`), per the project's
config-registry convention — no vertical-specific branching.

## Implementation (single file: `src/components/chat/ChatWidget.tsx`)

1. New state: `const [reopenableHubCard, setReopenableHubCard] = useState<HubCard | null>(null);`
   near `activeHubCard` (~line 1577).
2. In `handleHubCardTap` (~line 1850), when a card falls through to the
   generic `setActiveHubCard(card)` branch and `card.input_source === 'products'`,
   also `setReopenableHubCard(card)`.
3. New handler `reopenProductPicker = () => { if (reopenableHubCard) { setActiveHubCard(reopenableHubCard); setHubInput(''); } }`.
4. Main chat input form (~line 3041): render a search-icon button before the
   textarea, only when `reopenableHubCard` is set (i.e. only inside a
   quote/spec session — never in plain chat). Clicking it calls
   `reopenProductPicker`.
5. Clear `reopenableHubCard` (set to `null`) at the same three points that
   already reset hub state:
   - Back-to-Home button (~line 2526)
   - `startNewSession` (~line 2075)
   - `resumeSession` (~line 2089)

No backend changes, no new tests beyond existing widget behavior (manual
browser verification — the dev server is currently blocked by another
session per `hub-card-colors` memory; verify with static review + a fresh
`preview_start` attempt).

## Out of scope

- Multi-product quote payloads.
- Reopening from a detected free-text quote intent.
- The `SdsPicker` persistent-panel pattern (SDS keeps its own richer flow;
  this stays lightweight, matching the existing mini-form).
