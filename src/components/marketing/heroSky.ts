// Galaxy-sky renderer (nebula wash + starfield) for HeroHorizonCanvas's
// dark-mode sky region, above the terrain grid.

export interface SkyStar {
  x: number;
  y: number;
  r: number;
  alpha: number;
  big: boolean;
}

export interface SkyNebula {
  x: number;
  y: number;
  r: number;
  rgb: string;
  alpha: number;
}

export interface GalaxySky {
  stars: SkyStar[];
  nebulae: SkyNebula[];
}

// Deterministic PRNG so the field is identical on every redraw (resize,
// theme toggle) instead of reshuffling.
function mulberry32(seed: number) {
  let s = seed;
  return () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function generateGalaxySky(
  seed: number,
  width: number,
  height: number,
  starCount: number
): GalaxySky {
  const rand = mulberry32(seed);

  const stars: SkyStar[] = Array.from({ length: starCount }, () => {
    const y = Math.pow(rand(), 1.5) * height;
    const big = rand() < 0.07;
    return {
      x: rand() * width,
      y,
      r: big ? 1.3 + rand() * 1.2 : 0.35 + rand() * 0.65,
      alpha: 0.3 + rand() * 0.6,
      big,
    };
  });

  const nebulae: SkyNebula[] = [
    { x: width * 0.2, y: height * 0.32, r: width * 0.27, rgb: '99, 102, 241', alpha: 0.1 },
    { x: width * 0.82, y: height * 0.45, r: width * 0.21, rgb: '56, 120, 190', alpha: 0.07 },
    { x: width * 0.55, y: height * 0.15, r: width * 0.24, rgb: '139, 92, 246', alpha: 0.06 },
  ];

  return { stars, nebulae };
}

// `fadeHeight` lets the horizon-blend fade toward the bottom of the sky
// region (the full-terrain canvas, where the grid picks up right after);
// pass null to keep density uniform (the standalone mobile patch, which has
// no grid underneath it to hand off to).
export function drawGalaxySky(
  ctx: CanvasRenderingContext2D,
  sky: GalaxySky,
  fadeHeight: number | null
) {
  ctx.globalCompositeOperation = 'lighter';
  sky.nebulae.forEach((n) => {
    const grad = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r);
    grad.addColorStop(0, `rgba(${n.rgb}, ${n.alpha})`);
    grad.addColorStop(1, `rgba(${n.rgb}, 0)`);
    ctx.fillStyle = grad;
    ctx.fillRect(n.x - n.r, n.y - n.r, n.r * 2, n.r * 2);
  });
  ctx.globalCompositeOperation = 'source-over';

  sky.stars.forEach((s) => {
    const fade = fadeHeight ? 0.12 + 0.88 * Math.max(0, (fadeHeight - s.y) / fadeHeight) : 1;
    const a = s.alpha * fade;
    if (a <= 0.02) return;

    if (s.big) {
      ctx.save();
      ctx.shadowColor = `rgba(226, 232, 240, ${(a * 0.8).toFixed(3)})`;
      ctx.shadowBlur = 4;
    }
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(226, 232, 240, ${a.toFixed(3)})`;
    ctx.fill();
    if (s.big) ctx.restore();
  });
}
