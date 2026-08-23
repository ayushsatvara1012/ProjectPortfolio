// Dark-theme colours for the three card artworks, keyed by the role an element
// plays rather than by the card it belongs to.
//
// Each class carries only the `dark:` half of the pair. The Figma export's
// colours stay on the elements as presentation attributes and remain the light
// value, so light mode renders exactly as it did before; a CSS rule beats a
// presentation attribute, so under `prefers-color-scheme: dark` these win. That
// keeps the swap free of a theme hook, a provider or a hydration flash.
export const ART = {
  // The frosted backdrop the whole card sits on. Its fillOpacity stays on the
  // element, so this is a tint rather than a solid.
  panel: 'dark:fill-slate-900',

  // Raised surfaces on top of the panel: the result card body, and the search
  // field and pills, which pair a fill with their own border.
  surface: 'dark:fill-slate-800',
  field: 'dark:fill-slate-800 dark:stroke-slate-600',
  pill: 'dark:fill-slate-800 dark:stroke-blue-400',

  // The header strip across a result card. It carries white label text in both
  // themes, so it has to stay dark enough to keep that legible while still
  // separating from the surface underneath.
  band: 'dark:fill-blue-600',

  // Accent-coloured labels and glyphs - the Open/Download actions - which sit
  // on a surface and so have to invert with it.
  accent: 'dark:fill-blue-300',

  // The COA request button, the one accent-filled control.
  action: 'dark:fill-blue-600 dark:stroke-blue-400',

  textPrimary: 'dark:fill-slate-100',
  textMuted: 'dark:fill-slate-400',

  iconMuted: 'dark:fill-slate-500',
  iconStrong: 'dark:fill-slate-200',

  // The showcase glyphs are drawn at a quarter opacity and rely on the surface
  // behind them to do the muting. Dropping them to a dark grey the way the
  // other icons go would leave them all but invisible against a dark panel, so
  // they invert to a light tone instead and let the opacity keep them faint.
  // The stroke-carrying variants are kept separate on purpose: `stroke`
  // defaults to `none`, so setting it on a fill-only glyph would paint an
  // outline that the light theme never had.
  iconFaint: 'dark:fill-slate-300',
  iconFaintOutline: 'dark:fill-slate-300 dark:stroke-slate-300',
  iconFaintStroke: 'dark:stroke-slate-300',
} as const;
