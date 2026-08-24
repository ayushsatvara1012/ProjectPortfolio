// Mesh-gradient backdrops, kept as data so a new one is an entry here rather
// than another bitmap in public/ and another request on the page.
//
// Figma builds these as hard-edged rects melted together by one large Gaussian.
// A radial gradient is already soft, so a preset records the blobs the export
// drew and MeshBackdrop paints them with no filter: no request, no decode, no
// blur pass, sharp at any resolution and free to follow the theme.

export type MeshBlob = {
  // Space-separated sRGB channels, so the alpha can be applied per theme via
  // rgb(... / <alpha>) instead of being baked into a hex.
  color: string;
  // Centre and radii as a share of the backdrop, which is what makes a preset
  // independent of the frame it ends up in.
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  // Weight on the preset's theme alpha, for a blob that has to carry more than
  // its neighbours. Defaults to 1.
  a?: number;
};

export type MeshPreset = {
  // The colour under the blobs, pre-composited rather than layered.
  base: { light: string; dark: string };
  // Blob strength per theme. Dark pages need less, or the blobs read as glare.
  alpha: { light: number; dark: number };
  // In the source export's paint order: first drawn sits furthest back.
  blobs: MeshBlob[];
};

export const MESH_PRESETS = {
  // From public/noisy-gradients.svg. Its base was white under #EE46D3 at 15.3%,
  // resolved here to a single colour.
  customTool: {
    base: { light: '#fce3f8', dark: '#17141f' },
    alpha: { light: 0.85, dark: 0.55 },
    blobs: [
      { color: '24 160 251', cx: 59.8, cy: 41.0, rx: 59.5, ry: 58.4 },
      { color: '144 124 255', cx: 66.9, cy: 74.4, rx: 60.6, ry: 61.5 },
      { color: '242 55 31', cx: 78.0, cy: 31.3, rx: 61.7, ry: 57.1 },
      { color: '144 124 255', cx: 42.1, cy: 64.7, rx: 57.3, ry: 68.9 },
    ],
  },

  // From public/Chat_Background.webp. The blobs are a numeric fit to that
  // bitmap rather than a transcription - it is a photographic mesh with no
  // vector source - so the colours are the ones the image already had. The fit
  // lands within ~6/255 per channel, which is under the banding the WebP
  // itself showed on these ramps.
  chat: {
    base: { light: '#94cbf1', dark: '#0f1b2a' },
    alpha: { light: 1, dark: 0.6 },
    blobs: [
      { color: '255 204 190', cx: 79.6, cy: 4.4, rx: 112.4, ry: 123.0, a: 0.83 },
      { color: '221 255 255', cx: 22.0, cy: 105.6, rx: 53.6, ry: 178.1, a: 0.97 },
      { color: '11 105 178', cx: -5.1, cy: -9.8, rx: 148.5, ry: 201.4, a: 0.66 },
      { color: '230 183 103', cx: 103.5, cy: 165.5, rx: 221.9, ry: 12.0, a: 0.95 },
    ],
  },
} satisfies Record<string, MeshPreset>;

export type MeshPresetName = keyof typeof MESH_PRESETS;
