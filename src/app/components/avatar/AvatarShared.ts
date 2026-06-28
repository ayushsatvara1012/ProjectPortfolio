/**
 * AvatarShared.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Single source of truth for all bot avatar rendering constants.
 * Import from this file in: LogoCustomizer, ChatWidget, BotPreview.
 * Adding a new shape or gradient? Edit here — nowhere else.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type AvatarSize = 'sm' | 'md' | 'lg';
export type AvatarShape = 'circle' | 'squircle' | 'bento' | 'sharp' | 'rounded-square';

// ── Gradient catalogue ────────────────────────────────────────────────────────
// null = no gradient (solid fill)

export const AVATAR_GRADIENTS: Record<string, [string, string] | null> = {
  none: null,
  cosmic: ['#c026d3', '#3b82f6'],
  sunset: ['#f97316', '#eab308'],
  ocean: ['#06b6d4', '#3b82f6'],
  hacker: ['#22c55e', '#14b8a6'],
};

// ── Avatar background resolver ────────────────────────────────────────────────
// `avatar_bg_style` historically stored a gradient name ('none', 'sunset', …).
// As of the customise-page refactor it stores a solid hex string ('#ffffff').
// This resolver handles BOTH during the transition so existing bots keep their
// gradients while new bots get an exact solid colour. Edit the catalogue above;
// the renderers (LogoCustomizer, ChatWidget, BotPreview) consume this resolver.

export type ResolvedAvatarBg =
  | { kind: 'none' }
  | { kind: 'gradient'; colors: [string, string] }
  | { kind: 'solid'; color: string };

const HEX_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export function resolveAvatarBg(bgStyle?: string | null): ResolvedAvatarBg {
  if (!bgStyle || bgStyle === 'none') return { kind: 'none' };
  const grad = AVATAR_GRADIENTS[bgStyle];
  if (grad) return { kind: 'gradient', colors: grad };
  if (HEX_RE.test(bgStyle)) return { kind: 'solid', color: bgStyle };
  return { kind: 'none' };
}

// ── FAB shape SVG paths ───────────────────────────────────────────────────────
// All paths use a 0 0 100 100 viewBox coordinate space.
// `x` and `y` are offsets applied to image/text content within the shape
// to visually centre content (accounting for tails that shift the centroid).

export const FAB_SHAPES: Record<string, { path: string; x: number; y: number }> = {
  circle: {
    path: 'M 50 4 C 75.5 4 96 24.5 96 50 C 96 75.5 75.5 96 50 96 C 24.5 96 4 75.5 4 50 C 4 24.5 24.5 4 50 4 Z',
    x: 0,
    y: 0,
  },
  squircle: {
    // Rounded rectangle with a small speech-bubble tail at bottom-left
    path: 'M 22 4 H 78 Q 96 4 96 22 V 62 Q 96 80 78 80 H 36 L 18 96 L 22 80 H 22 Q 4 80 4 62 V 22 Q 4 4 22 4 Z',
    x: 0,
    y: -8,
  },
  bento: {
    // Tall pill with a prominent speech-bubble tail at bottom-centre-left
    path: 'M39.5 0H60.5A39.5 39.5 0 0160.5 79H46Q40 79 27 90 35 79 32 78A39.5 39.5 0 0139.5 0Z',
    x: 0,
    y: -10.5,
  },
  sharp: {
    // Asymmetric blob with a pointed tail at bottom-left
    path: 'M50 3C77 3 97 23 97 50 97 77 77 97 50 97 35 97 26 90 26 90L9 97 15 83C6 71 3 61 3 50 3 23 23 3 50 3Z',
    x: 0,
    y: 0,
  },
  'rounded-square': {
    // Simple rounded rectangle — no tail. Used for navbar avatars.
    path: 'M20 0H80A20 20 0 0 1 100 20V80A20 20 0 0 1 80 100H20A20 20 0 0 1 0 80V20A20 20 0 0 1 20 0Z',
    x: 0,
    y: 0,
  },
};

// ── CSS class map (for any CSS-only fallbacks) ────────────────────────────────
// Not used in the SVG clipPath renderer but kept for reference / legacy code.

export const SHAPE_CLASS_MAP: Record<string, string> = {
  circle: 'rounded-full',
  squircle: 'rounded-[2rem]',
  bento: 'rounded-2xl',
  sharp: 'rounded-lg',
  'rounded-square': 'rounded-2xl',
};
