# Contextual teaser bubble — plan

## Problem

The chat launcher (`FabButton` in [ChatWidget.tsx:189](../src/components/chat/ChatWidget.tsx)) sits silent in the corner until a visitor decides to click it.
The `greeting` we already have only shows *inside* the chat once it is open ([BotSettingsContext.tsx:66](../src/lib/context/BotSettingsContext.tsx)).
There is nothing that proactively invites the visitor to engage, and nothing that adapts the invitation to what the visitor is looking at.

**Goal:** a small, dismissible teaser bubble that pops above the launcher a few seconds after load, showing a short message that nudges the visitor to open the chat — and that message adapts to the current page (product, pricing, contact, …) so it matches visitor intent.

## The feature in one sentence

An avatar + two-line contextual teaser bubble that appears above the launcher ~5s after load, shows intent-matched copy driven by owner-authored URL rules, appears once per visit, and stays silent once the visitor opens the chat or dismisses it.

## Decisions (locked)

### Appearance
- Avatar (theme color) + bold title line + muted subtext line.
- `16px` radius, `0.5px` hairline border, soft drop shadow, tail pointing down at the launcher.
- Dismiss `✕` (aria-labelled) overhanging the top-right corner.
- Width `250px` (wraps to 2 lines; never a single wide strip).

### Position
- Right-aligned to the launcher (`right: 24px`, matching `sm:bottom-6 sm:right-6`).
- `12px` above the `56px` FAB (bottom ≈ `92px`).
- Tail offset `~26px` from the right so it lands over the FAB center.

### Trigger
- Time delay only: appears ~5s after page load. Configurable.
- No scroll-depth / exit-intent / idle triggers in v1 (edge cases, low marginal value).

### Frequency
- Shows **once per session** (`sessionStorage`).
- **Hard-suppressed** the moment the visitor opens the chat OR clicks `✕` (`localStorage`) — stays silent afterwards.
- A returning visitor on a later visit sees it again; an engaged visitor never gets nagged.

### Content model
- One always-present **default** teaser (owner-editable single string, reuses the bot name).
- Plus an ordered **URL rule registry**: `{ match, title, subtext }[]`. First match wins; no match → default.
- Purely client-side. No backend call, no model cost at runtime.
- Config-driven, no hardcoded `if page === 'products'` — same pattern as the pack registry.

### Page detection
- Match on `window.location.pathname` (starts-with / contains; glob optional later).
- Optional explicit hint `window.SapybaseConfig.page = "product"` **overrides** the URL match (for technical installs whose URLs don't reveal page type).
- Precedence: **page-tag → URL rule → default.**

### Who authors the text — owner decides, AI only assists
- **Owner-authored, deterministic rules.** The owner owns brand voice and the exact hook. Fast, free, testable, safe. Consistent with the rule that customer-facing content is controlled, not free-form LLM output at runtime.
- **NOT AI-at-runtime.** No model call on page load — it would add latency + cost before the bubble can show and produce un-QA'd wording.
- **AI as an authoring assistant (Phase 3, optional):** a "Suggest copy" button in the rule editor offers teaser lines the owner accepts/edits. AI helps write; the owner approves; it never runs on the visitor's page.

### Rule sourcing — seeded but editable
- Ship a **per-vertical default rule set** (chemical: `/products`, `/pricing`, `/contact`) so it works with zero setup on day one.
- Expose the rules as an **editable list on the Customize page** so owners can tune wording, add pages, reorder.
- Not defaults-only (too rigid) and not owner-only (most owners never configure — empty teaser wastes the feature).

### Dismiss scope — silent for the whole visit
- Once dismissed, silent for the **entire visit**. Do **not** re-surface on a higher-intent page.
- Re-surfacing after an explicit close is the fastest way to feel spammy; conversion upside is marginal. Start conservative; revisit only if data shows dismiss-then-convert-elsewhere.

### Mobile
- Collapse the `250px` card to a **slim one-line pill** (title only) above the launcher, so the contextual value survives on phones without crowding the screen.
- Pill is capped to `max-width: calc(100vw - 32px)` so it can never run past the viewport edge; the launcher and `✕` stay fully visible.

### Overflow behavior — horizontal auto-scroll (decided 2026-07-11)
- When a teaser text line is wider than its container, it **auto-scrolls horizontally** (marquee) — it does NOT wrap or hard-truncate. Applies uniformly (mobile pill and any constrained line).
- **Only scrolls on real overflow:** measure `scrollWidth > clientWidth`; if the text fits, it stays static.
- **Gentle, readable motion:** slide to reveal the end, pause, slide back, loop (ping-pong), not a fast continuous marquee. Speed scales with overflow distance. Soft edge-fade mask signals more text off-screen.
- **`prefers-reduced-motion` fallback:** no movement — falls back to a static ellipsis truncation.
- Implemented via measure + Web Animations API in the loader (host-context DOM), so it works inside the shadow-root pill.

### Accessibility & architecture
- Pop-in animation respects `prefers-reduced-motion`.
- Whole card tappable to open chat; `✕` has an aria-label; text uses theme-aware tokens (light/dark).
- Non-modal: must NOT steal focus. Announce via `role="status"` / `aria-live="polite"` (never assertive). `Esc` dismisses when focused. `✕` tap target `≥24px`.
- RTL: mirror layout + tail for right-to-left locales.

### Architecture — the teaser lives in the LOADER, not ChatWidget (corrected 2026-07-11)

The original draft said "lives in ChatWidget.tsx (single source of truth)". That is **wrong for the production embed**. Real architecture:

- The launcher FAB is drawn by **`public/sapybase-loader.js`** in a **closed shadow DOM on the host page** (`fixed; bottom:16px; right|left:16px`, 56×56). `data-position` supports `bottom-right` and `bottom-left`.
- **`ChatWidget.tsx` runs inside a separate `/embed/{botId}` iframe** that is `display:none` until the chat opens.

Therefore the teaser MUST be implemented in the loader, because:
1. A bubble rendered inside the iframe is invisible (iframe hidden when closed) and clipped by the iframe box.
2. Page detection is impossible from the iframe — `ChatWidget` only sees `/embed/{botId}`, not the host URL. URL rules and `SapybaseConfig.page` can only be read in the loader (host context). The whole contextual mechanism depends on this.
3. Config already reaches the loader via `GET /api/config` (bot name, color, shape). Teaser text/rules must be added to that payload.

**Surface:** primary implementation in the loader, fed by `/api/config`; `ChatWidget` / `BotPreview` render a preview-only teaser for the dashboard Customize preview (same data). This mirrors the FAB, which is already duplicated loader↔widget for the same reason. Extract rule-matching as a pure ES5 function so it is unit-testable (the loader has no ES modules).

### Edge-case & device matrix (added 2026-07-11)

Positioning / device:
- **bottom-left** bots: mirror bubble, tail, and `✕`.
- **Fullscreen/mobile** (panel goes fullscreen under 468px wide OR 468px tall): teaser hides when chat opens (loader already does `:host(.chat-open) .fab-wrap{display:none}` — hang the teaser off `.fab-wrap` so it inherits this); suppress or use slim pill on fullscreen breakpoints.
- **iOS safe areas**: add `env(safe-area-inset-bottom)` so the pill clears the home indicator/notch.
- Landscape-short viewports and very narrow (<300px) screens: pill or suppress; overflowing pill text auto-scrolls (see Overflow behavior).
- Host CSS isolation: render inside the shadow root so host styles can't break it.

Navigation / state:
- **SPA route change** on host (`pushState` / `popstate`): re-evaluate the URL rule; update text if still showing; do NOT re-trigger if dismissed.
- **Chat opened before the 5s delay**: cancel the pending teaser.
- **Storage blocked** (Safari private, consent gating): wrap `sessionStorage`/`localStorage` in try/catch with in-memory fallback (show-once-per-page-load). Note: this is the HOST site's first-party storage (loader runs in host context).
- URL normalization: handle trailing slash, case, query string, hash-router paths (`#/products`), and locale prefixes (`/en/products`).

Security / content:
- **XSS**: loader builds DOM via `innerHTML` strings — owner-authored teaser text MUST be set via `textContent`, never interpolated into HTML.
- Empty bot name → `{botName}` fallback.

### Analytics (added 2026-07-11)
- Emit **impression**, **dismiss**, and **click-through** events (which rule fired). Without these you cannot tell whether the teaser converts or which rules work — the point of contextual copy. Decide sink during Phase 1 (reuse existing widget event pipeline if present).

## Example rule config (shape only)

```
teaser = {
  default: { title: "Hi, I'm {botName}", subtext: "Need help getting started?" },
  rules: [
    { match: "/products", title: "Looking for a product?", subtext: "Ask me for grades, pack sizes or a quote." },
    { match: "/pricing",  title: "Want the best price?",    subtext: "Tell me your quantity — I'll check for you." },
    { match: "/contact",  title: "Prefer to talk?",         subtext: "I can take your details right here." },
  ],
  delayMs: 5000,
}
```

## Phased rollout (each independently shippable, suite green between)

- **Phase 1 — Static teaser (loader).** Default bubble in `public/sapybase-loader.js` hung off `.fab-wrap`; 5s delay (cancel-on-open), once-per-session with in-memory fallback, suppress-on-open/dismiss, left/right mirror, mobile/fullscreen pill + safe-area + `max-width: calc(100vw - 32px)`, horizontal auto-scroll-on-overflow (measure + Web Animations, reduced-motion → static ellipsis, edge-fade mask), `textContent` injection, `role=status`, impression/dismiss/click events. Teaser text added to `/api/config`; single owner-editable default field on the Customize page. `BotPreview`/`ChatWidget` render a preview-only copy. Ships value immediately.
- **Phase 2 — Contextual rules.** URL rule registry (pure ES5 matcher: trailing-slash/case/query/hash/locale-normalized) + per-vertical seeded defaults + `SapybaseConfig.page` override + SPA route-change re-evaluation. Contextual text goes live with zero owner effort.
- **Phase 3 — Owner rule editor.** Customize-page UI to add/edit/reorder rules, plus optional AI "Suggest copy" assist (authoring-time only). Gives owners the ceiling once the mechanism is proven.

## Open items before build

- Exact per-vertical default rule sets (wording) for the seeded registry.
- ~~`/api/config` teaser payload shape~~ — DECIDED (Phase 1): `teaser: { enabled, title, subtext, delay_ms }`, sanitized + `{botName}`-substituted server-side (`services/teaser.py`); persisted in `companies.teaser_config` JSONB (Phase 2 adds `rules` to the same column, no new migration).
- ~~Analytics sink~~ — DECIDED (Phase 1): no generic widget event pipeline exists, so a dedicated minimal sink: `teaser_events` table (company_id, event, rule_id, created_at — no PII) + `POST /api/widget/teaser-event` (verify_api_key_and_origin, per-IP + per-key rate limits); loader fires via `fetch` keepalive (sendBeacon can't carry the x-api-key header).

## Phase 1 — BUILT 2026-07-11

- Migration `0033_teaser_config_and_events` (additive, idempotent) — applied dark to the prod control DB via Supabase MCP; safe no-op + stamp when Alembic runs on deploy.
- Backend: `services/teaser.py` (sanitize/merge/payload + event validation, 25 tests), `/api/config` ships `teaser`, PATCH `/api/company` folds `teaser_enabled/title/subtext` into the JSONB, `/api/company/details` returns the raw editable view (placeholder intact), new `POST /api/widget/teaser-event`.
- Loader (`public/sapybase-loader.js` + `@1` copy, kept in sync): teaser card hung off `.fab-wrap`; 5s configurable delay, cancel + hard-suppress on open; once-per-session (sessionStorage) + permanent suppress (localStorage) with in-memory fallback; left/right mirror (card, tail, ✕); mobile/fullscreen slim pill w/ `max-width: calc(100vw - 32px)` + safe-area margin; ping-pong marquee on real overflow via Web Animations w/ edge-fade mask, reduced-motion → static ellipsis; `textContent`-only injection; `role="status"`, Esc/Enter/Space keyboard handling, 24px ✕ target; impression/dismiss/click events.
- Customize page: "Teaser bubble" section (Appearance tab) — toggle + title/subtext inputs (length-capped) + inline bubble preview. Deviation from the draft: the preview lives inline in the section rather than in `ChatWidget`/`BotPreview`, because the dashboard's live widget preview renders the chat OPEN — a state in which the teaser never shows by definition.

## Phase 2 — BUILT 2026-07-11

Contextual URL rules go live with zero owner effort (seeded per-vertical); owner editor is still Phase 3.

- Schema: `TeaserRule(id, match, title, subtext, page)` added to `packs/schema.py` + `Pack.teaser_rules` field + `teaser_rules_payload()`. Chemical pack seeds ordered rules for `/pricing`, `/products`, `/contact` (each with a `page` tag for `SapybaseConfig.page` override). No `if vertical` — pure pack config.
- Backend `services/teaser.py`: `coerce_rules` / `_clean_rule` / `_norm_match` / `_derive_rule_id` sanitize a rule list (leading-slash normalization, unique [a-z0-9_-] ids, cap `RULES_MAX=40`, drop title-less or target-less rules); `rules` now round-trips through `coerce_teaser_config` (same `teaser_config` JSONB, no new migration). `build_teaser_rules(raw, pack_rules, bot_name)` resolves owner-rules-win-else-pack-seeds and `{botName}`-substitutes. `/api/config` ships `teaser.rules` (empty for generic/no-pack bots). 12 new tests (37 total in `test_teaser.py`).
- Loader: pure ES5 matcher in a delimited `TEASER-MATCHER` block — `normalizeTeaserPath` (trailing-slash/case/query/hash + hash-router `#/` + locale-prefix) + `teaserRuleMatchesPath` (segment-aware substring, guards both edges) + `matchTeaserRule` (precedence page-tag → URL rule → null). Extracted + unit-tested by `src/__tests__/teaser-match.test.js` (19 tests) so the shipped code is the tested code. `_showTeaser` resolves copy at display time; `_teaserActiveRuleId` feeds per-rule analytics. SPA route-change re-eval: `_bindTeaserSpa` patches `history.pushState/replaceState` once + listens `popstate`/`hashchange`, `_onTeaserRouteChange` swaps copy in place via `_updateTeaserText` (no re-fired impression, no re-animated pop-in) only while visible + not dismissed. `SapybaseConfig.page` override read host-side. Both loader files kept in sync.
- No Customize-page change (owner rule editor is Phase 3). Suite green (backend 1444, frontend 376, tsc 0, lint clean).

## Phase 3 — BUILT 2026-07-11

Owner rule editor on the Customize page, plus an AI "Suggest copy" authoring assist. No new migration — everything still round-trips through the existing `teaser_config` JSONB column.

- Backend `services/teaser.py`: `merge_teaser_update` now accepts a `rules` key (full-list replacement; `[]` or all-invalid clears the override back to the pack's seeded rules, mirroring how `sample_form` is replaced wholesale). `owner_teaser_view` now returns `rules` (the owner's own list only — empty doesn't mean "no rules at all", the pack seeds may still apply). New pure helpers `build_suggest_prompt(bot_name, vertical, match, page)` and `parse_suggested_copy(raw_text)` (strips markdown fences, sanitizes/caps via the same `_clean_text`) — no network I/O in this module, so both are unit-tested directly. 18 new tests (55 total in `test_teaser.py`).
- Backend `main.py` / `db/models.py`: `CompanyUpdate.teaser_rules` (full replacement list) folds into the same `teaser_config` JSONB via `merge_teaser_update`. New `POST /api/company/teaser/suggest-copy` (`require_premium_tier`, `20/minute`) resolves the target bot's `bot_name`/`vertical`, builds the prompt, calls `gemini-2.5-flash-lite` (`max_output_tokens=150`, cheap/fast — authoring-time only, never runs on the visitor's page), and returns `{title, subtext}` or a `502` the owner can retry. `/api/config`'s existing 5-minute cache invalidation on any `PATCH /api/company` (already generic) covers `teaser_rules` too — no extra invalidation needed. Endpoint covered by `tests/test_teaser_suggest_endpoint.py` (TestClient + fake DB cursor + fake Gemini model, mirroring `test_vertical_lock.py`'s pattern): success, default-bot resolution, 404/403 ownership, 502 on model failure or unparseable output.
- Frontend: `TeaserRuleEditor.tsx` (new, modeled on `SampleFormEditor.tsx`) — add/remove/reorder rows (title, subtext, URL match, page tag), inline validation mirroring the backend's drop rules (needs a title; needs a match or page tag to fire), capped at `RULES_MAX=40`. Exports `TeaserSuggestButton`, reused both per-rule and next to the default title/subtext fields. `BotSettingsContext.tsx` gained `teaserRules: TeaserRuleField[]`, mapped from `company.teaser.rules` and sent as `teaser_rules` on every save (not gated to vertical bots — generic bots can author rules too). Mounted in the Customize page's existing "Teaser bubble" section as a new "Page rules" subsection; save is blocked with an inline error if any rule fails validation. Suite green (backend 1472, frontend 394, tsc 0, lint clean — 0 errors).
- Deviation from the draft: rule ids are preserved across edits (not just derived fresh each save) so an owner tweaking a rule's copy or URL match doesn't silently orphan its `teaser_events` analytics history.
- Gap found + fixed during self-review: a vertical bot's editor initially showed an EMPTY rule list even though the pack's seeded rules (e.g. chemical's pricing/products/contact) were already live on the widget — the owner had no way to see or tune them, only to add net-new rules that would wholesale replace the seeds on save. Fixed with `services/teaser.py::effective_teaser_rules(raw, pack_rules)` (owner rules if any, else pack seeds — no `{botName}` substitution, this is the raw editable form), wired into `get_company_by_clerk_id`'s existing pack-aware block in `main.py` right alongside `effective_sample_form`, which already does exactly this for the sample-request form. Same accepted tradeoff as `sample_form`: because the Customize page always sends `teaser_rules` on save, the first save after opening the editor freezes the pack's current seed wording into a permanent owner override (future pack-seed wording changes won't reach that bot). 4 new tests.
