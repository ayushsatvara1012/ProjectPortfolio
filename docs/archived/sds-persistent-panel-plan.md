# Persistent, Isolated SDS Panel (Option A) Plan

## Goal

Make every SDS lookup - whether started from the "Request SDS" hub card or typed into chat ("SDS for acetone") - land in one self-contained panel that stays open across multiple searches, instead of closing after a single pick or posting a card into the chat transcript.

Builds directly on `docs/archived/get-sds-crash-fix-plan.md` (Option B, shipped `c5fa1718`/`90333df2`), which already gave the picker its search box, product list, and inline-preview card. This plan changes only what happens *after* a pick, and adds a second entry point (the conversational path) into the same panel.

## Problem (user-reported, 2026-07-23)

Picking a product in the SDS picker closes the panel and drops an SDS card into the chat feed (`selectSdsProduct`). Getting a second product's sheet means leaving the panel entirely - back to Home, then re-tap "Request SDS". Typing "SDS for X" in chat has the same dead end: the agent's `get_sds` tool result renders inline in the chat bubble with no search box at all.

## Locked decisions (user, 2026-07-23, confirmed against a visual mockup of 3 options)

- **D1 - Selection stays in-panel (Option A).** Picking a result pins it above the search box; the box and results list stay mounted underneath so the next lookup is immediate. Nothing is written to the chat transcript - SDS lookups are a static search, not a chat exchange.
- **D2 - Exit is an explicit "Back to chat" button only.** No auto-exit on typing or other implicit dismissal.
- **D3 - The conversational path routes into the same panel.** When `get_sds` resolves a product mid-chat, the widget still streams the agent's short text reply into the transcript as today, then auto-opens the panel with that product pre-pinned and the search box pre-filled - isolating the result from the chat feed instead of attaching a card to it.
- **D4 - Not-found/ambiguous `get_sds` results are unchanged.** The agent keeps asking a clarifying question inline in chat (main.py only emits the `sds` marker on `status: "found"`); auto-opening the panel on a miss is out of scope.

## Architecture

### Frontend (`src/components/chat/ChatWidget.tsx` - single source of truth)

- `SdsPicker` (currently 1211-1273) gains a `selected: SdsResult | null` prop. When set, it renders the product card - relocated verbatim from the chat-bubble renderer (today at 2684-2718, including the `SdsPreview` iframe reuse) - above the still-live search box and results list. `onSelect` pins the new result instead of closing the panel.
- New `SdsResult` type replaces the `sds` field on `Message` (line 506): the result is no longer a chat side-effect, so it no longer lives on a message.
- New `sdsSelected` state holds the pinned card.
- `selectSdsProduct` (1933-1941) now only calls `setSdsSelected(...)` - no `setSdsPickerOpen(false)`, no `setMessages(...)`.
- `openSdsPicker` (hub-card entry, 1886-1894) resets `sdsSelected` to `null` so a fresh tap opens blank.
- New `openSdsPickerWithResult(sds)` (same shape as the existing `openSampleForm`, 1808-1814): closes other overlays, seeds the search box with the resolved product name, pins the result, opens the panel.
- Stream handler (2177-2330): the `pendingSds` capture (2306-2307) now also keeps `cas_number`/`updated_at` (the backend already sends both; the frontend was silently dropping them). At `[DONE]`, `sds` is removed from the message-merge spread (2265) and `if (pendingSds) openSdsPickerWithResult(pendingSds);` is added alongside the existing `pendingForm` → `openSampleForm` call (2272) - same "text reply lands, then the panel opens" pattern `request_sample` already established.
- Panel header (D2): back control relabeled from an icon-only arrow to `"‹ Back to chat"`, so a visitor who arrived via a typed message has an obvious way back to the conversation, not just a functional one - `hubView` is `'chat'` on both entry paths, so closing the panel always returns to the live transcript, never Home.
- Dead-code cleanup once the above lands: the inline SDS card block in the message-bubble renderer (2684-2718) and the `if (m.sds) { content += ... }` history-serialization branch (~2148-2150) become unreachable and are removed, not left as dead paths.

### Backend

No functional change. `sapybase_ai_engine/main.py:3600-3615` already sends `{url, product, cas_number, updated_at, label}` on the `sds` SSE marker for `status: "found"` - the gap was the frontend dropping two of those fields. Optional copy-only tweak: `get_sds`'s model-facing `message` string (`services/agent.py:416-419`, "shown an 'Open SDS' button") updated to reflect the panel opening, so the model's framing of what the visitor sees stays accurate.

## Edge cases

- Selecting a second, then a third product in one panel session -> pinned card swaps each time; search box/list never unmount.
- Chat-typed SDS request while the panel is already open from a prior hub-card visit -> still routes through `openSdsPickerWithResult`, overwriting the pinned card and query (last request wins).
- `get_sds` returns `no_sheet_on_file` / `ambiguous` / `not_found` mid-chat -> no `sds` marker emitted (unchanged backend behavior) -> panel does not auto-open; agent's clarifying text handles it in chat, as today (D4).
- Visitor closes the panel via "Back to chat" immediately after an auto-open -> lands in the transcript with the bot's text reply visible, no orphaned SDS card anywhere.
- Hub-card entry with no prior selection -> `selected` is `null`; panel renders exactly as before (search box + list only).

## Test cases

**Frontend (vitest, `src/__tests__/chatwidget_hub.test.ts`):**

- SSE-shape mirror test extended to also capture `cas_number`/`updated_at` on the `sds` event.
- Selecting a product does not close the panel and does not append a message (behavior-level assertion replacing the old "closes + posts message" coverage).
- A `pendingSds` captured at `[DONE]` routes to the panel-open path, not the message-merge path.

**End-to-end / live (browser walk):**

- Home -> "Request SDS" -> search "acetone" -> select -> pinned card (Open/Download/preview) with search box + list still visible -> search "toluene" -> select -> pinned card swaps, panel still open -> "Back to chat" -> lands in normal chat, no stray messages.
- Type "can I get the SDS for acetone" in chat -> text reply streams into the transcript -> panel auto-opens with Acetone pre-pinned and the search box pre-filled -> transcript itself carries no SDS card.

## Verification

- `npx tsc --noEmit`, `npm run lint`, `npm run test`.
- Browser-verify both entry points (hub card, chat-typed) in light and dark mode.

## Out of scope

- Auto-opening the panel on `no_sheet_on_file` / `ambiguous` / `not_found` (D4) - the agent's existing conversational clarification is left as-is.
- Option C (full SDS library page) - already out of scope per `docs/archived/get-sds-crash-fix-plan.md`.
- Any change to `get_sds` resolution logic itself (grade-agnostic, newest-https-wins) - unchanged from the crash-fix plan.
