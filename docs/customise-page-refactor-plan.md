# Customise Page Refactor Plan

**Date**: 2026-06-28
**Branch**: `agentic-ai` (merge to `MainV2` after testing)
**Goal**: Make the bot customise page professional, intuitive, and pixel-perfect.

## Problems identified (user audit)

1. **BotPreview diverges from real widget** — 244-line hand-written mirror of 2,203-line ChatWidget. Drifts on every widget change.
2. **Settings layout is a long unsorted column** — 9+ cards stacked linearly, confusing for normal users.
3. **Avatar shape picker is unnecessary** — circle is the only professional option; 4 shapes add clutter.
4. **Avatar background uses fixed gradient swatches** — not flexible enough; users need exact color control.

## Decisions locked (2026-06-28)

| # | Decision | Chosen option |
|---|----------|---------------|
| 1 | Preview fix | Reuse the real ChatWidget in `previewMode` (single source of truth) |
| 2 | Settings layout | Tabbed sections: Appearance / Behavior / Leads & Integrations |
| 3 | Avatar shape | Lock to circle, remove shape picker entirely |
| 4 | Avatar background | Replace gradient swatches with a solid-color picker (independent from theme color) |

## Implementation order

### Phase 1: Avatar cleanup (#3 + #4) — low risk
**Files**: `LogoCustomizer.tsx`, `BotSettingsContext.tsx`, `avatar/AvatarShared.tsx`

- Delete the `SHAPES` grid and its Pro-gate from `LogoCustomizer.tsx`.
- Hardcode `shapeId="circle"` in `BotAvatar` and `FabWidgetPreview`.
- Coerce any saved non-circle `logoShape` to `'circle'` on load in `BotSettingsContext`.
- Replace `AVATAR_GRADIENTS` swatch UI with a single `<input type="color">` for avatar background.
- Reuse `avatarBgStyle` column to store the hex string (no migration needed).
- Keep the existing `primaryColor` picker as the separate brand/theme color.

**Verify**: Preview shows circle avatar with custom bg color. Existing bots render unchanged.

### Phase 2: Tabbed sections (#2) — medium risk
**Files**: `customize/page.tsx`

- Add a segmented control at the top of the settings panel.
- Group cards into three tabs:
  - **Appearance**: bot name, greeting, branding toggle, logo & avatar color
  - **Behavior**: industry vertical, tone, system prompt, quick questions, vertical agent sample-form editor
  - **Leads & Integrations**: webhooks, human handoff, lead alerts & notifications
- Save button stays global (saves entire `botSettings`).
- Pure presentational regrouping — no data or API changes.

**Verify**: Each tab shows only its cards. Save works from any tab. No settings lost.

### Phase 3: Real ChatWidget preview (#1) — highest risk
**Files**: `ChatWidget.tsx`, `BotPreview.tsx`, `customize/page.tsx`

- Add an optional `previewConfig` prop to `ChatWidget.tsx`.
  - When present: skip `/api/config` fetch and SSE, seed state from injected config, render canned messages.
  - When absent: zero behavior change (the safety net).
- Rewrite `BotPreview.tsx` to render `<ChatWidget previewConfig={...} />` driven by `botSettings`.
- Delete the duplicated mirror markup (most of the 244 lines).

**Verify**: 
- Real widget on embed pages is byte-for-byte unchanged (test a generic + chemical bot).
- Preview in customize page matches the real widget pixel-for-pixel.
- Preview updates live as settings change.

## Risk notes

- Phase 3 modifies the production widget (`ChatWidget.tsx`). The `previewConfig` prop is strictly additive — absence = no change. Test both generic and chemical bots before merging.
- `avatarBgStyle` column reuse: existing values are gradient names ('none', 'sunset', etc.). New values will be hex strings ('#ffffff'). Code must handle both during transition.

## Success criteria

- [ ] Avatar is always circle, bg color picker works
- [ ] Settings grouped in tabs, nothing lost
- [ ] Preview matches real widget exactly
- [ ] All tests pass (frontend + backend + tsc)
- [ ] No regression on generic (non-chemical) bots
