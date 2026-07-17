# Train AI + Super Admin Manage UI Refactor Plan

Status: PLANNED (2026-07-16). No code changed yet.
Scope: `src/app/(app)/dashboard/train/page.tsx` and `src/app/(app)/dashboard/settings/admin/page.tsx` (ManageModal + Users tab controls).
Goal: fix the "everything is horizontally wide" problem - constrain widths, add columnar structure, increase density, and make both screens fully responsive from 360px phones to ultrawide desktops.

## Problem summary (from 2026-07-16 audit)

Both screens are single-column layouts where inputs, buttons, dropzones, and toggles stretch edge-to-edge.

Train AI page:
- `inputCls` is `w-full` inside an unconstrained card, so URL/label inputs become ~1200px wide.
- Add knowledge and Manage knowledge are stacked vertically although they are two halves of one workflow.
- PDF/CSV dropzones are wide flat strips with click-only upload (no drag-and-drop).
- Source picker is a native `<select>` with 44-char truncated labels - does not scale past a few sources.
- Segment list is capped at `max-h-[260px]` while the page wastes vertical space elsewhere.
- Submit button is detached from its form fields; bot selector is a small header afterthought.

ManageModal (super admin):
- Fullscreen (`w-full h-full`) but content is one phone-width column stretched to ~1350px controls.
- `px-4 py-3 text-base` control sizing - too large for an internal admin tool.
- 8 feature-flag rows with the toggle pinned to the far right edge (label and control up to 1200px apart).
- Account status is a full-width action-worded button (confusing affordance).
- Footer Cancel/Save are `flex-1` (two ~650px buttons).
- No internal sectioning despite fullscreen real estate.

## Design principles (apply everywhere)

1. Reading/control width: text inputs and selects get `max-w` caps (roughly `max-w-xl` for single-line fields). A field's width should suggest its expected content length.
2. Label-control proximity: a toggle or button sits directly adjacent to its label group, never edge-pinned across a wide row.
3. Density for tools: dashboard/admin surfaces use the 13-13.5px input language already established on the Train page, not `text-base`.
4. Columnar use of wide screens: >= `lg` gets 2-column layouts; content never stretches to fill width just because it can.
5. Actions live with their context: primary submit right-aligned in a form footer next to its quota/consequence hint.
6. Responsive means both directions: no horizontal page scroll at 360px AND no absurdly stretched controls at 1440px+. Tables scroll inside their own `overflow-x-auto` container.
7. Touch targets >= 40px on mobile; keyboard focus rings (`focus-visible:ring-2`) preserved on every interactive element.
8. Preserve the existing visual language: Insights card surfaces, Plus Jakarta Sans, Material Symbols, existing tone tokens, dark mode parity on every new class.

## Implementation rules for the AI agent (hard guardrails)

- Do NOT hallucinate: no new API endpoints, no new response fields, no invented props. Every data field rendered must already exist in the API responses these pages consume today. If a redesign seems to need new data, stop and flag it - do not fabricate.
- Do NOT change any behavior: mutations, queries, cache keys, validation (zod schemas), polling logic, confirm dialogs, and gating (isFree / isLockedOut / SUPER_ADMIN) all stay byte-for-byte semantically identical. This is a layout/density refactor only.
- Do NOT fabricate metrics, trends, placeholder numbers, or example rows. Empty states stay honest ("No knowledge sources yet"), never seeded with fake data.
- Do NOT invent design tokens: reuse `Card`, `SectionHeader`, `Badge`, `ProgressBar`, `EmptyState`, `cx`, `fmtNum` from `insights/ui` and the existing TONE/TIER_STYLE maps. New shared primitives only when two+ call sites need them.
- Verify, don't assume: after each slice run `npx tsc --noEmit`, `npm run lint`, `npm run test`, and check the rendered page in the browser at mobile (375px), tablet (768px), and desktop (1280px+) widths in BOTH light and dark mode before calling the slice done.
- Accessibility is non-negotiable: keep/extend aria-labels, role=tablist/dialog, aria-modal, sr-only text; new toggles keep `role="switch"` + `aria-checked`; color is never the only status signal (badges keep text).
- Work in small slices, suite green between each. Commit only when the user says to.

## Phase 1 - Train AI page layout

1. Constrain form fields: wrap URL / source-label inputs in `max-w-xl`; textarea stays wide (`max-w-3xl`).
2. Two-column workspace at `lg+`: grid `lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]` (or 3/2) - left = Add knowledge, right = Manage knowledge. Below `lg`, stack as today. Catalog + catalog warnings + danger zone remain full-width below the grid.
3. Form footer bar inside Add knowledge: `Start training` right-aligned, quota/lockout hint on the left of the same row; stacks to full-width button on mobile.
4. Dropzone: taller (~py-12) in the narrower column, add real drag-and-drop (dragover highlight + drop handler reusing the existing file validation), keep click-to-browse.
5. Promote bot selector: labeled control ("Training bot:") at the top of the content area, always visible when any bot exists; remove the conditional header-only select.
6. Segment list height: raise to `max-h-[min(48vh,520px)]` so the audit surface uses available height.

## Phase 2 - Train AI source browser upgrade

1. Replace the source `<select>` with a source list panel: vertical list of source rows (icon, name, segment count, per-source delete icon) with the segment list beside/below it. On mobile the list collapses to the select-like compact picker.
2. Keep all existing delete flows (selected chunks, entire source, purge all) and their window.confirm guards unchanged.
3. Add a lightweight client-side filter input over sources when count > 8 (pure client filter, no new API).

## Phase 3 - ManageModal structure + density

1. Cap content width: keep fullscreen shell, wrap header/body/footer content in `max-w-5xl mx-auto w-full`.
2. Two-column body at `lg+`: left column = access tier, account status, deployed bots + vertical editor; right column = custom plan builder, Polar checkout block. Single column below `lg`.
3. Density pass: new modal-local `inputCls`/`selectCls`/`labelCls` at `px-3.5 py-2.5 text-[13.5px]` (mirror Train page tokens); labels `text-[12.5px] font-semibold`.
4. Feature flags: `sm:grid-cols-2` grid of compact rows; toggle immediately follows the label/desc group (justify-between inside a ~half-width cell is fine - the cell is narrow).
5. Account status: replace action-worded full-width button with a labeled row - "Account status" + StatusBadge + a Suspend/Activate compact button (explicit verb, small, right of the badge).
6. Footer: compact right-aligned Cancel + Save (`px-5`, auto width) on `sm+`, full-width stacked on mobile; Polar provision button keeps its own width, left-aligned in the same bar on desktop.
7. QuickActionModal: inherit the same density tokens; it is already `max-w-md`, only control sizing changes.

## Phase 4 - Admin page shell polish

1. Users tab: no width bugs, but apply density tokens to the search input and Manage buttons for consistency; keep mobile card variant.
2. Verify the pill tab bar, stats strip, metrics tab, and all tables at 360/768/1280/1920 - fix any horizontal page overflow found (tables scroll internally only).

## Phase 5 - Responsive + a11y verification sweep

1. Browser pass on both pages at 375px, 768px, 1280px, 1920px in light + dark (resize_window + screenshots as proof).
2. Keyboard-only walk of every form and both modals (focus order, visible rings, Escape closes modals if it does today - do not add new behavior silently).
3. Full suite: `npm run test`, `npx tsc --noEmit`, `npm run lint` - zero errors.

## Explicit non-goals

- No backend changes, no API changes, no schema/migration changes.
- No new dependencies.
- No behavior changes to training, deletion, provisioning, or plan-save flows.
- No redesign of ExploreEnquiriesTab / ByodTab / AgentRequestsTab internals (only the shell around them).
