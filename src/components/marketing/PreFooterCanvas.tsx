'use client';

import React, { useEffect, useRef } from 'react';

const FOCAL_LENGTH = 460;

// Floor for the perspective divisor. Points that swing close enough to the
// camera drive `FOCAL_LENGTH / (FOCAL_LENGTH + z + cameraDepth)` toward zero and
// project hundreds of thousands of pixels out, which visibly shatters the shape.
// Oversized staging makes that reachable, so the divisor is clamped, not trusted.
const MIN_DIVISOR = 90;

// Square dot lattice, aligned row by row. Illumination cost is independent of
// spacing (see the cell-range maths in the render loop), so resolution is
// bounded by draw cost alone — which is why the colour palette is cached below.
const DOT_SPACING = 7;
const DOT_RADIUS = 0.5;

// Illumination reach and kernel width. These set how crisp the bubble reads: a
// wide reach smears every virtual point across many dots and the outline goes
// soft. Tightening them sharpens the edge but opens gaps between points, which
// is why POINT_COUNT rises alongside.
const INFLUENCE = 10;
const KERNEL_FALLOFF = 26;

// A fine dense field carries the shapes through texture rather than contrast,
// which keeps the hero headline and CTAs readable over the top of it.
const AMBIENT_ALPHA_LIGHT = 0.09;
const AMBIENT_ALPHA_DARK = 0.06;
const ACTIVE_ALPHA_MAX = 0.5;

// Colour lookup, quantised and built once per theme. The draw loop runs ~20k
// times a frame, and assigning a freshly built `rgba(...)` string each time
// means 20k string allocations plus 20k CSS colour parses per frame — enough to
// dominate the whole render. Quantising to these steps is imperceptible at
// these alphas and reduces that to a table read.
const ALPHA_STEPS = 40;
const TONE_STEPS = 12;

// Tone is the blue channel: 0 = neutral slate, 1 = brand blue. The bubble's
// outline carries tone 1 so the border reads blue, while the message lines
// inside stay near-neutral. Depth is expressed as brightness (via alpha), not
// hue, because a face-on bubble has little depth range to spend on colour.
const NEUTRAL_LIGHT = [30, 41, 59]; // slate-800
const NEUTRAL_DARK = [203, 213, 225]; // slate-300
const BLUE_LIGHT = [29, 78, 216]; // blue-700, holds up on the off-white ground
const BLUE_DARK = [110, 151, 255]; // #6E97FF, the showcase accent

const buildPalette = (dark: boolean): string[] => {
  const table = new Array<string>(ALPHA_STEPS * TONE_STEPS);
  const neutral = dark ? NEUTRAL_DARK : NEUTRAL_LIGHT;
  const blue = dark ? BLUE_DARK : BLUE_LIGHT;

  for (let a = 0; a < ALPHA_STEPS; a++) {
    const alpha = ((a / (ALPHA_STEPS - 1)) * ACTIVE_ALPHA_MAX).toFixed(3);
    for (let t = 0; t < TONE_STEPS; t++) {
      const tone = t / (TONE_STEPS - 1);
      const r = neutral[0] + (blue[0] - neutral[0]) * tone;
      const g = neutral[1] + (blue[1] - neutral[1]) * tone;
      const b = neutral[2] + (blue[2] - neutral[2]) * tone;
      table[a * TONE_STEPS + t] =
        `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${alpha})`;
    }
  }
  return table;
};

const ambientColor = (dark: boolean): string =>
  dark
    ? `rgba(51, 65, 85, ${(AMBIENT_ALPHA_DARK * 1.2).toFixed(3)})`
    : `rgba(203, 213, 225, ${(AMBIENT_ALPHA_LIGHT * 1.5).toFixed(3)})`;

// The outline is a 1D curve, so it is cheap to oversample — and oversampling is
// exactly what removes any gap or stair-stepping from the border.
const POINT_COUNT = 16000;
const OUTLINE_SHARE = 0.62;

// Scale is a multiple of the container's half-min-dimension. cameraDepth sets
// how much perspective divergence the wobble reveals.
const BUBBLE_SCALE = 0.78;
const CAMERA_DEPTH = 240;

// Normalise to a unit envelope so the proportions in the generator stay purely
// about form, and scale alone sets final on-screen size.
const normalize = (points: Virtual3DPoint[], target: number): Virtual3DPoint[] => {
  let dMax = 0;
  for (const p of points) {
    dMax = Math.max(dMax, Math.sqrt(p.x * p.x + p.y * p.y + p.z * p.z));
  }
  if (dMax === 0) return points;
  const s = target / dMax;
  return points.map((p) => ({ x: p.x * s, y: p.y * s, z: p.z * s, tone: p.tone }));
};

interface FixedDot {
  // Stationary 2D screen position
  x: number;
  y: number;
  // Ambient flickering parameters
  baseRadius: number;
  flickerSpeed: number;
  flickerPhase: number;
  // Animated Target Values
  targetIntensity: number; // 0 (ambient) to 1 (fully lit by 3D shape)
  currentIntensity: number;
  targetDepthScale: number; // Front-face vs Back-face multiplier
  currentDepthScale: number;
  targetTone: number; // 0 neutral slate, 1 brand blue
  currentTone: number;
}

interface Virtual3DPoint {
  x: number;
  y: number;
  z: number;
  tone: number;
}

// -------------------------------------------------------------
// 1. Chat Bubble Geometry
// -------------------------------------------------------------

// Even-density samplers. The bubble outline is built from straight runs and
// quarter arcs; points are allocated to each by arc length so the border has
// uniform density all the way round, with no bunching at the corners.
const sampleLine = (
  out: Virtual3DPoint[],
  x1: number, y1: number, x2: number, y2: number,
  n: number, tone: number,
) => {
  for (let i = 0; i < n; i++) {
    const t = i / n;
    out.push({ x: x1 + (x2 - x1) * t, y: y1 + (y2 - y1) * t, z: 0, tone });
  }
};

const sampleArc = (
  out: Virtual3DPoint[],
  cx: number, cy: number, r: number, a0: number, a1: number,
  n: number, tone: number,
) => {
  for (let i = 0; i < n; i++) {
    const a = a0 + (a1 - a0) * (i / n);
    out.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r, z: 0, tone });
  }
};

// A rounded speech bubble with a tail at the bottom-left, plus three message
// lines inside. +y is down, matching screen space.
const createChatBubblePoints = (count: number, size: number): Virtual3DPoint[] => {
  const points: Virtual3DPoint[] = [];

  const w = size;           // half width
  const h = size * 0.68;    // half height
  const r = size * 0.26;    // corner radius
  const tailD = r * 0.8;    // how far the tail drops below the body

  const tailLeft = -w + r * 0.95;
  const tailRight = -w + r * 2.35;
  const tailTipX = -w + r * 0.15;
  const tailTipY = h + tailD;

  const HALF_PI = Math.PI / 2;

  // Perimeter walked clockwise from the top-left corner.
  type Seg =
    | { kind: 'line'; x1: number; y1: number; x2: number; y2: number }
    | { kind: 'arc'; cx: number; cy: number; a0: number; a1: number };

  const segs: Seg[] = [
    { kind: 'line', x1: -w + r, y1: -h, x2: w - r, y2: -h },
    { kind: 'arc', cx: w - r, cy: -h + r, a0: -HALF_PI, a1: 0 },
    { kind: 'line', x1: w, y1: -h + r, x2: w, y2: h - r },
    { kind: 'arc', cx: w - r, cy: h - r, a0: 0, a1: HALF_PI },
    { kind: 'line', x1: w - r, y1: h, x2: tailRight, y2: h },
    { kind: 'line', x1: tailRight, y1: h, x2: tailTipX, y2: tailTipY },
    { kind: 'line', x1: tailTipX, y1: tailTipY, x2: tailLeft, y2: h },
    { kind: 'line', x1: tailLeft, y1: h, x2: -w + r, y2: h },
    { kind: 'arc', cx: -w + r, cy: h - r, a0: HALF_PI, a1: Math.PI },
    { kind: 'line', x1: -w, y1: h - r, x2: -w, y2: -h + r },
    { kind: 'arc', cx: -w + r, cy: -h + r, a0: Math.PI, a1: Math.PI * 1.5 },
  ];

  const segLength = (s: Seg) =>
    s.kind === 'line'
      ? Math.hypot(s.x2 - s.x1, s.y2 - s.y1)
      : Math.abs(s.a1 - s.a0) * r;

  const total = segs.reduce((sum, s) => sum + segLength(s), 0);
  const outlineCount = Math.floor(count * OUTLINE_SHARE);

  for (const s of segs) {
    const n = Math.max(2, Math.round((segLength(s) / total) * outlineCount));
    if (s.kind === 'line') sampleLine(points, s.x1, s.y1, s.x2, s.y2, n, 1);
    else sampleArc(points, s.cx, s.cy, r, s.a0, s.a1, n, 1);
  }

  // Three message lines inside, each a horizontal capsule a few rows deep so
  // they read as content rather than as hairlines. Lengths run full, full, then
  // short — the way a real wrapped message breaks on its last line.
  const barCount = count - points.length;
  const bars = [1.0, 0.9, 0.55];
  const barRows = 3;
  const perBar = Math.floor(barCount / (bars.length * barRows));
  const barInset = r * 0.95;
  const barLeft = -w + barInset;
  const barSpan = (w - barInset) * 2;
  const barGap = h * 0.44;
  const rowGap = size * 0.028;

  bars.forEach((frac, i) => {
    // Centred on the body, so the bubble does not sit top-heavy.
    const y = (i - (bars.length - 1) / 2) * barGap;
    const x2 = barLeft + barSpan * frac;
    for (let row = 0; row < barRows; row++) {
      const yr = y + (row - (barRows - 1) / 2) * rowGap;
      sampleLine(points, barLeft, yr, x2, yr, perBar, 0.18);
    }
  });

  // Gentle convex curvature. The bubble is near enough to face-on that this is
  // the only thing giving the wobble something to shade against.
  for (const p of points) {
    const nx = p.x / w;
    const ny = p.y / h;
    p.z = -size * 0.075 * Math.max(0, 1 - (nx * nx + ny * ny) * 0.5);
  }

  return points;
};

const getShapePoints = (minDim: number, scale: number): Virtual3DPoint[] =>
  normalize(createChatBubblePoints(POINT_COUNT, minDim), (minDim / 2) * BUBBLE_SCALE * scale);


type PreFooterCanvasProps = {
  className?: string;
  /** Where the bubble sits in the frame, 0-1. Lets the hero push it clear of
   *  the copy column without touching the shape's own proportions. */
  focusX?: number;
  focusY?: number;
  /** Multiplies the bubble's on-screen size for this placement. */
  scale?: number;
};

export default function PreFooterCanvas({
  className,
  focusX = 0.5,
  focusY = 0.5,
  scale = 1,
}: PreFooterCanvasProps = {}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Read by the animation loop each frame. The loop is set up once and must not
  // be torn down to change placement, so it cannot close over these directly.
  const placementRef = useRef({ focusX, focusY, scale });
  useEffect(() => {
    placementRef.current = { focusX, focusY, scale };
  }, [focusX, focusY, scale]);

  // Zero-re-render performance refs for 60fps canvas loop
  const stateRef = useRef({
    dots: [] as FixedDot[],
    gridCols: 0,
    gridRows: 0,
    gridStartX: 0,
    gridStartY: 0,
    gridSpacing: DOT_SPACING,
    time: 0,
    isVisible: true,
    lastFrameTime: 0,
    points: [] as Virtual3DPoint[],
  });

  // -------------------------------------------------------------
  // 2. Initialization & Main Engine Setup
  // -------------------------------------------------------------
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    const isReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let animationFrameId: number;

    // Rebuilt only when the theme flips, not per frame.
    let paletteIsDark: boolean | null = null;
    let palette: string[] = [];
    let ambient = '';

    // Build Stationary 2D Dot Matrix
    const initGrid = (width: number, height: number) => {
      const spacing = DOT_SPACING;
      const cols = Math.floor(width / spacing);
      const rows = Math.floor(height / spacing);
      const startX = (width - cols * spacing) / 2 + spacing / 2;
      const startY = (height - rows * spacing) / 2 + spacing / 2;

      const dots: FixedDot[] = [];

      // Row-major, so the render loop can address a dot as `row * cols + col`.
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          dots.push({
            x: startX + c * spacing,
            y: startY + r * spacing,
            baseRadius: DOT_RADIUS,
            flickerSpeed: 0.6 + Math.random() * 2.0,
            flickerPhase: Math.random() * Math.PI * 2,
            targetIntensity: 0,
            currentIntensity: 0,
            targetDepthScale: 0.2,
            currentDepthScale: 0.2,
            targetTone: 0,
            currentTone: 0,
          });
        }
      }

      stateRef.current.gridStartX = startX;
      stateRef.current.gridStartY = startY;
      stateRef.current.gridSpacing = spacing;
      stateRef.current.dots = dots;
      stateRef.current.gridCols = cols;
      stateRef.current.gridRows = rows;

      stateRef.current.points = getShapePoints(
        Math.min(width, height),
        placementRef.current.scale,
      );
    };

    // Canvas Resize Handler with Retina DPR scaling
    const handleResize = () => {
      if (!canvas || !container) return;
      const rect = container.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);

      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;

      ctx.resetTransform();
      ctx.scale(dpr, dpr);

      initGrid(rect.width, rect.height);
    };

    handleResize();
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    // -------------------------------------------------------------
    // 3. Render Loop: Virtual 3D Projection onto Fixed 2D Grid
    // -------------------------------------------------------------
    const render = (timestamp: number) => {
      if (!stateRef.current.isVisible) {
        animationFrameId = requestAnimationFrame(render);
        return;
      }

      if (!stateRef.current.lastFrameTime) {
        stateRef.current.lastFrameTime = timestamp;
      }

      const dt = Math.min((timestamp - stateRef.current.lastFrameTime) / 1000, 0.05);
      stateRef.current.lastFrameTime = timestamp;
      stateRef.current.time += dt;

      const time = stateRef.current.time;
      const rect = container.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;
      const centerX = width * placementRef.current.focusX;
      const centerY = height * placementRef.current.focusY;

      ctx.clearRect(0, 0, width, height);

      // The bubble stays face-on and wobbles rather than spinning — a rotating
      // speech bubble stops reading as one. Two frequencies per axis: a slow
      // sway for life, and a small fast term for the shake.
      const amp = isReducedMotion ? 0.12 : 1;
      const totalRotX = (Math.sin(time * 0.44) * 0.070 + Math.cos(time * 3.1) * 0.010) * amp;
      const totalRotY = (Math.sin(time * 0.61) * 0.095 + Math.sin(time * 2.7) * 0.012) * amp;
      const totalRotZ = (Math.sin(time * 0.33) * 0.028 + Math.cos(time * 3.7) * 0.005) * amp;

      // Positional tremor, in camera space — a couple of pixels of unrest so the
      // bubble never looks pinned to the grid.
      const driftX = (Math.sin(time * 1.9) * 1.6 + Math.sin(time * 5.3) * 0.7) * amp;
      const driftY = (Math.cos(time * 1.6) * 1.3 + Math.cos(time * 4.7) * 0.6) * amp;

      const cosX = Math.cos(totalRotX), sinX = Math.sin(totalRotX);
      const cosY = Math.cos(totalRotY), sinY = Math.sin(totalRotY);
      const cosZ = Math.cos(totalRotZ), sinZ = Math.sin(totalRotZ);

      const focalLength = FOCAL_LENGTH;
      const cameraDepth = CAMERA_DEPTH;

      const pts = stateRef.current.points;
      const projectedVirtualPoints: { sx: number; sy: number; sz: number; tone: number }[] = [];

      for (let i = 0; i < pts.length; i++) {
        const p = pts[i];
        const vx = p.x;
        const vy = p.y;
        const vz = p.z;

        // Full 3D Matrix Rotation (Yaw -> Pitch -> Roll)
        // 1. Rotate Y
        const x1 = vx * cosY + vz * sinY;
        const y1 = vy;
        const z1 = -vx * sinY + vz * cosY;

        // 2. Rotate X
        const x2 = x1;
        const y2 = y1 * cosX - z1 * sinX;
        const z2 = y1 * sinX + z1 * cosX;

        // 3. Rotate Z, then drift in camera space so travel reads as movement
        // across the frame rather than the shape's own spin carrying it around.
        const x3 = x2 * cosZ - y2 * sinZ + driftX;
        const y3 = x2 * sinZ + y2 * cosZ + driftY;
        const z3 = z2;

        // 3D Perspective Scale. The divisor is floored, not merely tested for
        // sign: points that swing close to the camera would otherwise project
        // hundreds of thousands of pixels off-canvas.
        const divisor = focalLength + z3 + cameraDepth;
        if (divisor < MIN_DIVISOR) continue;

        // Named `persp`, not `scale` — `scale` is the placement prop.
        const persp = focalLength / divisor;
        const sx = centerX + x3 * persp;
        const sy = centerY + y3 * persp;

        // Cull off-canvas points before the dot pass.
        if (sx < -INFLUENCE || sx > width + INFLUENCE) continue;
        if (sy < -INFLUENCE || sy > height + INFLUENCE) continue;

        projectedVirtualPoints.push({
          sx,
          sy,
          sz: z3, // Z-depth for front vs back face lighting calculation
          tone: p.tone,
        });
      }

      // Project virtual 3D shape onto Fixed 2D Grid Dots
      const dots = stateRef.current.dots;
      const influenceRadiusSq = INFLUENCE * INFLUENCE;
      const { gridStartX, gridStartY, gridSpacing, gridCols, gridRows } = stateRef.current;

      // Spatial Illumination Map Reset
      for (let i = 0; i < dots.length; i++) {
        dots[i].targetIntensity = 0;
        dots[i].targetTone = 0;
        dots[i].targetDepthScale = 0.15;
      }

      // Compute Proximity & Depth Lighting for each Virtual Projected Point.
      // The dots form a regular lattice, so the cells within the influence
      // radius are computed arithmetically rather than found by scanning every
      // dot. That makes this pass cost points x ~25 cells instead of
      // points x dots, and independent of how dense the grid is.
      for (let k = 0; k < projectedVirtualPoints.length; k++) {
        const vp = projectedVirtualPoints[k];

        const cMin = Math.max(0, Math.ceil((vp.sx - INFLUENCE - gridStartX) / gridSpacing));
        const cMax = Math.min(gridCols - 1, Math.floor((vp.sx + INFLUENCE - gridStartX) / gridSpacing));
        if (cMin > cMax) continue;

        const rMin = Math.max(0, Math.ceil((vp.sy - INFLUENCE - gridStartY) / gridSpacing));
        const rMax = Math.min(gridRows - 1, Math.floor((vp.sy + INFLUENCE - gridStartY) / gridSpacing));

        // Depth contrast is per-point, not per-dot — hoisted out of the inner loop.
        const normZ = Math.min(1, Math.max(0, (vp.sz + 220) / 440)); // 0 (front) to 1 (back)
        const depthLighting = Math.max(0.12, Math.pow(1.0 - normZ, 1.3));

        for (let r = rMin; r <= rMax; r++) {
          const rowBase = r * gridCols;
          for (let c = cMin; c <= cMax; c++) {
            const dot = dots[rowBase + c];

            const dx = dot.x - vp.sx;
            const dy = dot.y - vp.sy;
            const distSq = dx * dx + dy * dy;
            if (distSq >= influenceRadiusSq) continue;

            // Smooth Gaussian spatial field kernel (zero spatial discretization noise / zero blinking)
            const intensity = Math.exp(-distSq / KERNEL_FALLOFF) * depthLighting;

            if (intensity > dot.targetIntensity) {
              dot.targetIntensity = Math.min(1.0, intensity);
              dot.targetDepthScale = depthLighting;
              dot.targetTone = vp.tone;
            }
          }
        }
      }

      // Render Fixed 2D Grid Dots (Theme-Aware, High-Performance Canvas Loop)
      const isDark = typeof window !== 'undefined' && (
        document.documentElement.classList.contains('dark') ||
        document.body.classList.contains('dark') ||
        window.matchMedia('(prefers-color-scheme: dark)').matches
      );

      if (paletteIsDark !== isDark) {
        palette = buildPalette(isDark);
        ambient = ambientColor(isDark);
        paletteIsDark = isDark;
      }

      // Hoisted out of the per-dot loop: constant for the whole frame.
      const lerpFactor = 1 - Math.exp(-5.0 * dt);
      const baseAmbientOpacity = isDark ? AMBIENT_ALPHA_DARK : AMBIENT_ALPHA_LIGHT;

      for (let i = 0; i < dots.length; i++) {
        const dot = dots[i];

        // Ultra-smooth lerp for fluid intensity transitions (no rapid blinking)
        dot.currentIntensity += (dot.targetIntensity - dot.currentIntensity) * lerpFactor;
        dot.currentDepthScale += (dot.targetDepthScale - dot.currentDepthScale) * lerpFactor;
        dot.currentTone += (dot.targetTone - dot.currentTone) * lerpFactor;

        // Illuminated Opacity
        const activeOpacity = dot.currentIntensity * 0.88 * dot.currentDepthScale;
        const finalAlpha = Math.min(
          ACTIVE_ALPHA_MAX,
          Math.max(baseAmbientOpacity, baseAmbientOpacity + activeOpacity),
        );

        // Minimal radius scale
        const dotRadius = dot.baseRadius + dot.currentIntensity * dot.currentDepthScale * 0.3;

        if (dot.currentIntensity > 0.08) {
          const a = Math.round((finalAlpha / ACTIVE_ALPHA_MAX) * (ALPHA_STEPS - 1));
          const t = Math.round(Math.max(0, Math.min(1, dot.currentTone)) * (TONE_STEPS - 1));
          ctx.fillStyle = palette[a * TONE_STEPS + t];
        } else {
          ctx.fillStyle = ambient;
        }

        // fillRect, not arc: at these sub-pixel radii the two are visually
        // indistinguishable, and this runs ~20k times per frame on the fine grid.
        const size = dotRadius * 2;
        ctx.fillRect(dot.x - dotRadius, dot.y - dotRadius, size, size);
      }

      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);

    // Visibility Observer
    const observer = new IntersectionObserver(
      (entries) => {
        stateRef.current.isVisible = entries[0].isIntersecting;
      },
      { threshold: 0.05 }
    );
    observer.observe(container);

    const handleVisibilityChange = () => {
      stateRef.current.isVisible = !document.hidden;
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
      observer.disconnect();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  return (
    <section
      ref={containerRef}
      aria-hidden="true"
      className={className ?? "relative w-full min-h-screen h-screen bg-[#FAFAFC] dark:bg-[#0B0F19] text-[#0F172A] dark:text-white overflow-hidden select-none flex items-center justify-center transition-colors duration-500"}
    >
      {/* HTML5 Fixed Dot Matrix Canvas Layer */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full block z-0 cursor-default" />
    </section>
  );
}
