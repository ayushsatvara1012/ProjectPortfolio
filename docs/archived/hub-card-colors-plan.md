# Per-Feature Hub Card Colors + Request COA Plan

## Goal

Give each Home hub tile a distinct accent color (light gradient + noise grain, icon-tinted only - not the text) so the 6 chemical-vertical features read as visually distinct at a glance, and add a 6th "Request COA" tile in a disabled "Coming soon" state.

## Locked decisions (user, 2026-07-23, confirmed against a visual mockup)

- **Scope: Home buttons only.** The color stays on the grid tile; the feature's own screen (SDS panel, sample form, quote card) keeps the single brand `THEME_COLOR` as today. Smaller, lower-risk change.
- **Palette:** amber `#F59E0B` (SDS - safety), teal `#14B8A6` (specs - science), indigo `#6366F1` (quote - commerce), violet `#8B5CF6` (sample - product), sky `#0EA5E9` (ask - conversation), emerald `#10B981` (COA - certified/quality).
- **COA card is non-interactive.** Dimmed (`opacity-60`), a "Coming soon" badge, no `onClick`, renders as a `<div>` not a `<button>` - no tap feedback at all.
- Fields added generically to the shared `HubCard` schema (`color`, `disabled`), not hardcoded to chemical - any future pack can opt in; an unset `color` renders exactly as before (no gradient, theme-var icon).

## Architecture

- `sapybase_ai_engine/packs/schema.py` `HubCard`: two new fields, `color: str = ""` and `disabled: bool = False`.
- `sapybase_ai_engine/packs/chemical.py` `_HUB_CARDS`: each of the 5 existing cards gets its `color=`; new 6th card `id="coa"`, `icon="certificate"`, `action="chat"` (inert placeholder - a real action lands with the feature), `disabled=True`.
- `src/components/chat/ChatWidget.tsx`:
  - `HubCard` type gains `color?`/`disabled?`.
  - `HUB_ICON` maps `certificate` → `verified`; new `verified` path added to `ICON_PATHS` (checkmark-in-seal).
  - `MIcon` gains an optional `style` prop (merged into its existing fixed sizing style) so a tile can tint just its icon.
  - `hubTileGradient(hex)` + `hubTileRing(hex)` + `HUB_NOISE_URI` port the dashboard's `MetricCard` surface treatment (`src/components/dashboard/insights/ui.tsx` - the Insights "Pipeline"/"Financial impact" stat cards): tinted gradient fading to the base surface, an inset ring + soft shadow in the tone color, `mix-blend-soft-light` grain on top. Implemented with inline hex math (not MetricCard's static Tailwind tone classes) since a card's color is pack config - a runtime hex, not a fixed enum Tailwind can generate a class for. A tile without a color renders unchanged (flat surface, neutral border, theme-var icon).
  - The grid tile is a `<button>` normally, a non-interactive `<div>` (no `onClick`, `aria-disabled`) when `card.disabled`, with a small "Coming soon" badge pinned top-right and reduced opacity.

## Verification

- `npx tsc --noEmit`, `npm run lint`, `npm run test`, `pytest sapybase_ai_engine/tests/ -q`.
- Browser: Home grid shows 6 tinted tiles in a 3x2 grid, COA visibly dimmed/non-tappable with its badge, both themes.
