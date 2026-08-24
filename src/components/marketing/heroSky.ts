// Galaxy-sky renderer (nebula wash + starfield) for HeroHorizonCanvas's
// dark-mode sky region, above the terrain grid.

export interface SkyStar {
  x: number;
  y: number;
  r: number;
  alpha: number;
  big: boolean;
  baseAlpha: number;
  twinkleSpeed: number;
  twinklePhase: number;
  driftX: number;
  driftY: number;
  colorRgb: string;
}

export interface SkyNebula {
  x: number;
  y: number;
  r: number;
  rgb: string;
  alpha: number;
  pulsePhase: number;
  pulseSpeed: number;
}

export interface ShootingStar {
  x: number;
  y: number;
  length: number;
  speed: number;
  dx: number;
  dy: number;
  life: number;
  maxLife: number;
  colorRgb: string;
}

export interface GalaxySky {
  stars: SkyStar[];
  nebulae: SkyNebula[];
  shootingStar: ShootingStar | null;
  lastSpawnTime: number;
  width: number;
  height: number;
}

// Deterministic PRNG so the field base structure is identical on every redraw
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

const STAR_COLORS = [
  '226, 232, 240', // Crisp Blue-White
  '186, 230, 253', // Cyan Tint
  '253, 230, 138', // Soft Gold
  '221, 214, 254', // Cosmic Lavender
  '248, 250, 252', // Pure Starlight
];

export function generateGalaxySky(
  seed: number,
  width: number,
  height: number,
  starCount: number = 160
): GalaxySky {
  const rand = mulberry32(seed);

  const stars: SkyStar[] = Array.from({ length: starCount }, () => {
    const y = Math.pow(rand(), 1.4) * height;
    const big = rand() < 0.08;
    const baseAlpha = 0.3 + rand() * 0.55;
    const colorRgb = STAR_COLORS[Math.floor(rand() * STAR_COLORS.length)];

    return {
      x: rand() * width,
      y,
      r: big ? 1.4 + rand() * 1.1 : 0.4 + rand() * 0.65,
      alpha: baseAlpha,
      big,
      baseAlpha,
      twinkleSpeed: 0.8 + rand() * 1.8,
      twinklePhase: rand() * Math.PI * 2,
      driftX: 0.6 + rand() * 1.2, // Pixels per second horizontal cosmic drift
      driftY: 0.2 + rand() * 0.4,
      colorRgb,
    };
  });

  // Nebulae array kept empty to remove indigo/blue blobs from the sky as requested
  const nebulae: SkyNebula[] = [];

  return {
    stars,
    nebulae,
    shootingStar: null,
    lastSpawnTime: 0,
    width,
    height,
  };
}

// `fadeHeight` lets the horizon-blend fade toward the bottom of the sky region
export function drawGalaxySky(
  ctx: CanvasRenderingContext2D,
  sky: GalaxySky,
  fadeHeight: number | null,
  timeSec: number = 0,
  isDark: boolean = true
) {
  // Dark sky wash overlay for dark mode
  if (isDark) {
    const skyGrad = ctx.createLinearGradient(0, 0, 0, fadeHeight ?? sky.height);
    skyGrad.addColorStop(0, 'rgba(0, 0, 0, 0.65)');
    skyGrad.addColorStop(1, 'rgba(0, 0, 0, 0.1)');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, sky.width, fadeHeight ?? sky.height);
  }

  // 1. NEBULAE WASH (Disabled/Empty per request)
  if (sky.nebulae.length > 0) {
    ctx.globalCompositeOperation = 'lighter';
    sky.nebulae.forEach((n) => {
      const pAlpha = n.alpha * (0.85 + 0.15 * Math.sin(timeSec * n.pulseSpeed + n.pulsePhase));
      const cx = n.x + Math.sin(timeSec * 0.15 + n.pulsePhase) * 14;
      const cy = n.y + Math.cos(timeSec * 0.2 + n.pulsePhase) * 8;

      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, n.r);
      grad.addColorStop(0, `rgba(${n.rgb}, ${pAlpha.toFixed(3)})`);
      grad.addColorStop(1, `rgba(${n.rgb}, 0)`);
      ctx.fillStyle = grad;
      ctx.fillRect(cx - n.r, cy - n.r, n.r * 2, n.r * 2);
    });
    ctx.globalCompositeOperation = 'source-over';
  }

  // 2. STARFIELD ANIMATION
  sky.stars.forEach((s) => {
    // Horizontal drift wrapping
    let sx = (s.x + s.driftX * timeSec) % sky.width;
    if (sx < 0) sx += sky.width;

    // Gentle vertical bobbing
    const sy = s.y + Math.sin(timeSec * 0.4 + s.twinklePhase) * s.driftY * 3;

    const fade = fadeHeight ? 0.12 + 0.88 * Math.max(0, (fadeHeight - sy) / fadeHeight) : 1;
    const twinkle = 0.65 + 0.35 * Math.sin(timeSec * s.twinkleSpeed + s.twinklePhase);
    const a = s.baseAlpha * twinkle * fade;

    if (a <= 0.02) return;

    const starRgb = isDark ? s.colorRgb : '71, 85, 105';

    if (s.big) {
      ctx.save();
      ctx.shadowColor = `rgba(${starRgb}, ${(a * 0.85).toFixed(3)})`;
      ctx.shadowBlur = isDark ? 5 : 2;
    }

    ctx.beginPath();
    ctx.arc(sx, sy, s.r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${starRgb}, ${a.toFixed(3)})`;
    ctx.fill();

    if (s.big) {
      ctx.restore();
    }
  });

  // 3. SHOOTING STAR (Occasional subtle meteor streak)
  const spawnInterval = 7.5; // Every ~7.5 seconds
  if (!sky.shootingStar && timeSec - sky.lastSpawnTime > spawnInterval) {
    const angle = (Math.PI / 180) * (25 + Math.random() * 20); // 25-45 deg streak
    const speed = 400 + Math.random() * 300;
    sky.shootingStar = {
      x: (0.1 + Math.random() * 0.6) * sky.width,
      y: (0.05 + Math.random() * 0.25) * sky.height,
      length: 70 + Math.random() * 50,
      speed,
      dx: Math.cos(angle) * speed,
      dy: Math.sin(angle) * speed,
      life: 0,
      maxLife: 0.6 + Math.random() * 0.4, // Lives for ~0.8s
      colorRgb: Math.random() > 0.4 ? '226, 232, 240' : '186, 230, 253',
    };
    sky.lastSpawnTime = timeSec;
  }

  if (sky.shootingStar) {
    const m = sky.shootingStar;
    m.life += 0.016; // approximate frame delta

    if (m.life >= m.maxLife) {
      sky.shootingStar = null;
    } else {
      const progress = m.life / m.maxLife;
      const alpha = Math.sin(progress * Math.PI) * 0.8;

      const currentX = m.x + (m.dx * m.life);
      const currentY = m.y + (m.dy * m.life);
      const tailX = currentX - (m.dx / m.speed) * m.length;
      const tailY = currentY - (m.dy / m.speed) * m.length;

      const grad = ctx.createLinearGradient(currentX, currentY, tailX, tailY);
      grad.addColorStop(0, `rgba(${m.colorRgb}, ${alpha.toFixed(3)})`);
      grad.addColorStop(1, `rgba(${m.colorRgb}, 0)`);

      ctx.save();
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = grad;
      ctx.beginPath();
      ctx.moveTo(currentX, currentY);
      ctx.lineTo(tailX, tailY);
      ctx.stroke();
      ctx.restore();
    }
  }
}
