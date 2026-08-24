import { MESH_PRESETS, type MeshBlob, type MeshPresetName } from './meshPresets';

// Paints a mesh preset as stacked radial gradients. See meshPresets.ts for why
// this is CSS rather than a bitmap or the Figma SVG it replaces.

// A single hard stop would read as a disc with an edge. Carrying the colour at
// half weight to the midpoint before it drops out approximates the Gaussian
// shoulder closely enough that neighbouring blobs still blend into each other.
function blobLayer({ color, cx, cy, rx, ry, a = 1 }: MeshBlob) {
  const peak = `calc(var(--mesh-alpha) * ${a})`;
  return [
    `radial-gradient(ellipse ${rx}% ${ry}% at ${cx}% ${cy}%,`,
    `rgb(${color} / ${peak}) 0%,`,
    `rgb(${color} / calc(${peak} * 0.5)) 42%,`,
    `rgb(${color} / 0) 72%)`,
  ].join(' ');
}

// Figma's own noise layer exports as a no-op - overlay blend against 50% grey
// returns the base unchanged, because the real texture is flattened away. This
// is a 120px tile rasterised once and repeated, which costs nothing and dithers
// the ramps so large gradients do not band.
const NOISE =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3'/%3E%3C/filter%3E%3Crect width='120' height='120' filter='url(%23n)'/%3E%3C/svg%3E\")";

type Props = {
  preset: MeshPresetName;
  // Off for a backdrop small enough that its ramps cannot band, where the tile
  // would only add texture the design did not ask for.
  noise?: boolean;
  className?: string;
};

export default function MeshBackdrop({ preset, noise = true, className = '' }: Props) {
  const { base, alpha, blobs } = MESH_PRESETS[preset];

  // CSS paints the first background layer on top; the export drew back to
  // front, so the preset's order is reversed here rather than in the data.
  const layers = [...blobs].reverse().map(blobLayer).join(', ');

  return (
    <div
      aria-hidden="true"
      // Both themes' values are handed over as custom properties and a static
      // pair of classes picks between them. Tailwind only emits the classes it
      // can see in the source, so the `dark:` half cannot carry a preset's
      // colour directly - it has to indirect through a variable.
      className={`absolute inset-0 [--mesh-alpha:var(--mesh-alpha-light)] [--mesh-base:var(--mesh-base-light)] dark:[--mesh-alpha:var(--mesh-alpha-dark)] dark:[--mesh-base:var(--mesh-base-dark)] ${className}`}
      style={{
        ['--mesh-base-light' as string]: base.light,
        ['--mesh-base-dark' as string]: base.dark,
        ['--mesh-alpha-light' as string]: String(alpha.light),
        ['--mesh-alpha-dark' as string]: String(alpha.dark),
        backgroundColor: 'var(--mesh-base)',
      }}
    >
      <div className="absolute inset-0" style={{ backgroundImage: layers }} />
      {noise && (
        <div
          className="absolute inset-0 opacity-[0.14] mix-blend-overlay"
          style={{ backgroundImage: NOISE, backgroundSize: '120px 120px' }}
        />
      )}
    </div>
  );
}
