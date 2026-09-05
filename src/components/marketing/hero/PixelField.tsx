import React from 'react';

/* The hero's pixel field: sparse rounded squares on a 36px lattice.
 *
 * Drawn as two <pattern> tiles rather than one rect per cell. A full-bleed
 * field is ~1000 nodes, which is too much markup to put in front of the LCP;
 * two tiles are ~90 nodes reused by the renderer. The tile widths are 12 and
 * 14 cells - coprime, so the combined field only repeats every 3024px and no
 * screen ever shows the seam. Both share the lattice origin, so every square
 * lands on the same grid and the two layers overlap into the darker cells the
 * reference has.
 */

const CELL = 36;
const SQUARE = 15;
const RADIUS = 2;

const ACCENT = '#EE6C1F';

/* Shared with anything that wants to sit a shape on the same lattice - the
   proof section's stat markers echo these exact metrics. */
export const PIXEL = { CELL, SQUARE, RADIUS, ACCENT } as const;

/* Seeded so the field is identical on the server and the client, and identical
 * between builds - a Math.random() field would hydrate mismatched. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Cell = { x: number; y: number; o: number };

function buildTile(cols: number, rows: number, seed: number, density: number): Cell[] {
  const rand = mulberry32(seed);
  const cells: Cell[] = [];

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (rand() > density) continue;
      // Most squares sit near the floor of visibility; a few carry enough
      // weight to give the field its texture.
      const roll = rand();
      const o = roll > 0.88 ? 0.1 : roll > 0.6 ? 0.06 : 0.035;
      cells.push({ x: col * CELL, y: row * CELL, o });
    }
  }

  return cells;
}

const TILE_A = { cols: 12, rows: 12, cells: buildTile(12, 12, 0x5a17, 0.26) };
const TILE_B = { cols: 14, rows: 14, cells: buildTile(14, 14, 0x91c3, 0.24) };

/* Lattice-aligned so the accents sit flush with their neighbours, and kept
 * clear of the centre column: the hero buttons carry a backdrop-blur, so an
 * accent behind one smears into a warm glow rather than reading as a square. */
const ACCENTS = [
  { x: 5 * CELL, y: 5 * CELL },
  { x: 9 * CELL, y: 17 * CELL },
  { x: 34 * CELL, y: 8 * CELL },
];

interface PixelFieldProps {
  className?: string;
  /* Two fields on one page would otherwise collide on the pattern ids. */
  id?: string;
  accents?: { x: number; y: number }[];
}

function tileCells(cells: Cell[], keyPrefix: string) {
  return cells.map((c) => (
    <rect
      key={`${keyPrefix}-${c.x}-${c.y}`}
      x={c.x}
      y={c.y}
      width={SQUARE}
      height={SQUARE}
      rx={RADIUS}
      fillOpacity={c.o}
      className="fill-slate-900 dark:fill-white"
    />
  ));
}

export default function PixelField({
  className = '',
  id = 'pixel-field',
  accents = ACCENTS,
}: PixelFieldProps) {
  return (
    <svg
      className={className}
      width="100%"
      height="100%"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <pattern
          id={`${id}-a`}
          patternUnits="userSpaceOnUse"
          width={TILE_A.cols * CELL}
          height={TILE_A.rows * CELL}
        >
          {tileCells(TILE_A.cells, `${id}-a`)}
        </pattern>

        <pattern
          id={`${id}-b`}
          patternUnits="userSpaceOnUse"
          width={TILE_B.cols * CELL}
          height={TILE_B.rows * CELL}
        >
          {tileCells(TILE_B.cells, `${id}-b`)}
        </pattern>
      </defs>

      <rect width="100%" height="100%" fill={`url(#${id}-a)`} />
      <rect width="100%" height="100%" fill={`url(#${id}-b)`} />

      {accents.map((a) => (
        <rect
          key={`${a.x}-${a.y}`}
          x={a.x}
          y={a.y}
          width={SQUARE}
          height={SQUARE}
          rx={RADIUS}
          fill={ACCENT}
        />
      ))}
    </svg>
  );
}
