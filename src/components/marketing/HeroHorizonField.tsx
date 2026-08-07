import React from 'react';

/* Hero horizon field — the decorative line work behind the hero copy.
   Generated rather than authored: every path below is computed from the
   projection at module load, so the layout is reproducible and a change is a
   number in this file, not a redrawn asset.

   THE PROJECTION IS PERSPECTIVE, NOT ISOMETRIC. That is the whole design: an
   isometric grid covers the frame uniformly and would run straight through
   the headline, whereas a converging grid empties out above its horizon. The
   copy sits in that emptiness. The composition is what keeps the type legible
   — the mask below only softens the seam, it is not doing the work.

   Two vanishing points, not one: the grid is rotated THETA about the vertical
   before projection, so neither line family runs parallel to the screen edge.
   At THETA = 0 the cross-lines would be dead horizontal and the whole thing
   would read as a floor tile pattern.

   THE DRAWING IS HIDDEN-LINE-REMOVED. Every sample is tested against a
   floating horizon before it is drawn, so nothing behind a ridge shows
   through it. Without that the two line families cross each other freely over
   the massif and the whole left flank reads as tangled wire rather than as a
   surface. See the occlusion block for why a height field makes this cheap.

   COLOUR IS NOT AUTHORED HERE. Every stroke is `currentColor` and the caller
   sets it per theme, because no single stroke colour clears contrast on both
   the light and the dark ground. Depth is carried by stroke-opacity alone,
   held inside 0.05–0.30 — above ~0.34 the lines start competing with the
   headline, below ~0.05 they are lost. THE MASSIF IS THE ONE EXEMPTION,
   reaching 0.38 on its brightest crests. Relief is confined to x < 545 and
   the headline starts near 480 behind a mask hole, so nothing bright is ever
   near the type. Do not read the exemption as licence to raise the plane's
   own strokes.

   Decorative only; `aria-hidden` at the call site. */

const W = 1600;
const H = 900;

/* Horizon at a third of the height. The grid can only cover what is below it,
   so this single number decides how much of the frame is drawn at all. */
const HORIZON = 300;
const FOCAL = 520;
const CAM_H = 1.6; // camera height above the plane, in grid units
const CX = W / 2;
/* Nothing closer than this is drawn. It is what stops the near rows exploding
   toward infinity as depth approaches zero. At 0.9 the nearest row lands at
   y = 1224, comfortably past the bottom edge, so the grid runs off-frame
   rather than terminating inside it. */
const NEAR = 0.9;
const THETA = (22 * Math.PI) / 180;
const ST = Math.sin(THETA);
const CT = Math.cos(THETA);
const Z_OFF = 1.2;
/* Half-extent of the grid in cells. Must be large enough that the far rows
   still reach both frame edges: at depth 40 the frame spans |x| < 62 world
   units, which 45 cells of half-extent plus the rotation just covers. */
const EXT = 45;

/* Radius of the hole `hf-clear` punches for the copy, centred on (CX, 0.46H).
   IT IS THIS NUMBER, NOT THE PROJECTION, THAT CAPS HOW MUCH ROOM ANYTHING ON
   THE PLANE HAS. Its left edge sits at x 380, so the massif's right shoulder
   past there is progressively erased — which is why relief is allowed to run
   out to 545 at all: the tail is half gone by the time it gets there and
   reads as haze rather than as terrain. */
const CLEAR_R = 420;

type Pt = readonly [number, number];

const depthAt = (u: number, v: number) => -u * ST + v * CT + Z_OFF;

function project(u: number, v: number, y = 0): Pt {
  const d = depthAt(u, v);
  const x = u * CT + v * ST;
  return [CX + (FOCAL * x) / d, HORIZON + (FOCAL * (CAM_H - y)) / d];
}

const n1 = (n: number) => n.toFixed(1);
const line = (a: Pt, b: Pt) => `M${n1(a[0])} ${n1(a[1])}L${n1(b[0])} ${n1(b[1])}`;

type Stroke = { d: string; o: number; w: number };

/* Every fifth line is a major one. Without that beat the grid reads as noise;
   with it, it reads as a measured plane. Half-integers are the subdivision the
   massif carries and are never major. */
const major = (i: number) => Number.isInteger(i) && i % 5 === 0;
const half = (i: number) => !Number.isInteger(i);

const sstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/* ── Noise ──────────────────────────────────────────────────────────────────

   GRADIENT noise, not value noise. Value noise interpolates a scalar per
   lattice point, which pins its extrema to the integer grid and gives the
   whole field a faint square weave; under a ridge operator that weave becomes
   visible as ridges that prefer to run at 0/45/90 degrees. Gradient noise
   pins zeroes to the lattice instead, and its extrema fall between cells, so
   the ridges wander.

   The hash is integer-mixed rather than trigonometric. `sin(x)*43758.5453` is
   the usual shorthand and it is not reproducible — it bottoms out differently
   depending on the platform's sin. The 32-direction table below does call
   sin/cos, but only 32 times and without amplifying the result, so a last-ulp
   difference cannot change a single stroke. */
function hash2(i: number, j: number) {
  let n = Math.imul(i, 374761393) + Math.imul(j, 668265263);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return (n ^ (n >>> 16)) >>> 0;
}

const NG = 32;
const GX = new Float64Array(NG);
const GY = new Float64Array(NG);
for (let k = 0; k < NG; k++) {
  const a = (k / NG) * Math.PI * 2;
  GX[k] = Math.cos(a);
  GY[k] = Math.sin(a);
}

function pnoise(x: number, y: number) {
  const i = Math.floor(x);
  const j = Math.floor(y);
  const fx = x - i;
  const fy = y - j;
  // quintic fade: its second derivative vanishes at the cell edges, so the
  // surface has no creases along lattice lines for the ridge operator to find
  const u = fx * fx * fx * (fx * (fx * 6 - 15) + 10);
  const v = fy * fy * fy * (fy * (fy * 6 - 15) + 10);
  let k = hash2(i, j) & (NG - 1);
  const n00 = GX[k] * fx + GY[k] * fy;
  k = hash2(i + 1, j) & (NG - 1);
  const n10 = GX[k] * (fx - 1) + GY[k] * fy;
  k = hash2(i, j + 1) & (NG - 1);
  const n01 = GX[k] * fx + GY[k] * (fy - 1);
  k = hash2(i + 1, j + 1) & (NG - 1);
  const n11 = GX[k] * (fx - 1) + GY[k] * (fy - 1);
  const a0 = n00 + (n10 - n00) * u;
  const a1 = n01 + (n11 - n01) * u;
  return (a0 + (a1 - a0) * v) * 1.4142135623730951;
}

/* ── Terrain ────────────────────────────────────────────────────────────────

   Ridged multifractal: `1 - |n|` creases at the zero crossing, and the crease
   is what reads as a watershed; ordinary fBm gives dunes, not mountains.

   FOUR OCTAVES, AND THE COUNT IS A SAMPLING CONSTRAINT RATHER THAN A TASTE
   ONE. Grid lines sit 0.5 world units apart, so the surface is only sampled
   at that pitch across the line family; the finest octave here has wavelength
   SCALE/LAC^3 = 2.6 units, about five samples per period. Adding a fifth
   octave puts the finest at 1.3 units — under three samples per period, past
   the point where neighbouring lines pick up incoherent phases of it. That is
   exactly what the old five-octave field at SCALE 12 was doing, and it is the
   arithmetic behind the tangled crests: the detail was never resolvable by
   the grid drawing it, so it showed up as noise between lines rather than as
   shape along them. Detail lost to the lower octave count is bought back by
   the ridge crease and the domain warp, neither of which aliases.

   The warp displaces the sample point by a second, much longer-wavelength
   noise before the octaves are summed. It bends ridge lines out of the
   lattice's preferred directions for free — cheaper and more natural-looking
   than another octave, and it adds no new frequency content.

   The per-octave weighting is Musgrave's: each octave is attenuated by the
   previous octave's value, so detail accumulates on ridges and valleys stay
   smooth. Without it, fine detail is sprayed evenly and the crests read as
   fuzzy rather than sharp. */
const OCT = 4;
const SCALE = 22;
const LAC = 2.03; // non-integer, or every octave crests on the same cells
const GAIN = 2.0;
const WARP = 2.6;
const WSCALE = 34;
const AMP = 6.0;
const FLOOR = 0.2;
const SHARP = 1.5;
/* Chosen from a sweep of candidate offsets: it is the one that puts the
   summit near x 250 with a secondary ridge to its left. Anything that lands
   the summit under x ~180 is cropped away on a tall narrow window, where
   `slice` shows only the middle of the frame. */
const SEED_X = -155;
const SEED_Y = -41;

function ridged(x0: number, y0: number) {
  const x = x0 + SEED_X;
  const y = y0 + SEED_Y;
  const wx = x + WARP * pnoise(x / WSCALE + 31.7, y / WSCALE - 12.3);
  const wy = y + WARP * pnoise(x / WSCALE - 57.1, y / WSCALE + 9.4);
  let s = 0;
  let amp = 1;
  let norm = 0;
  let f = 1 / SCALE;
  let w = 1;
  for (let o = 0; o < OCT; o++) {
    let r = 1 - Math.abs(pnoise(wx * f + o * 23.1, wy * f - o * 17.9));
    r *= r;
    r *= w;
    w = Math.min(1, r * GAIN);
    s += amp * r;
    norm += amp;
    amp *= 0.5;
    f *= LAC;
  }
  return s / norm;
}

const groundX = (u: number, v: number) => CX + (FOCAL * (u * CT + v * ST)) / depthAt(u, v);

/* TWO ENVELOPES, BOTH COMPOSITIONAL RATHER THAN PHYSICAL.

   X, because height never moves a point sideways — the x term carries no h —
   so fading amplitude on the projected ground x is an EXACT promise that
   terrain cannot reach the copy. A world-space bound cannot promise that:
   u = -16 sits at x 507 by v = 12 and x 652 by v = 20, well under the
   headline.

   DEPTH, because amplitude has to ramp with distance: a rolling near plain,
   the range behind it, fading out beyond. Besides matching how a real range
   reads, it is the only way to get relief into the lower-left corner at all —
   that corner is depth 2.7, where a 3-unit peak throws a 270-unit spike up
   into the headline.

   EVERY EDGE OF BOTH ENVELOPES IS SMOOTH, INCLUDING THE NEAR ONE. A hard cut
   at the near limit is not invisible just because the amplitude there is
   small: the cut runs diagonally across the foreground and the grid lines
   crossing it all kink on the same line, which draws a distinct crease and a
   step in the lower-left corner. D_NEAR_A/B ramp it in instead. */
const X_FULL = 255;
const X_OUT = 545;
const X_IN = -340;
const X_IN2 = 0;
const X_CENTRE = 270;
const X_WIDTH = 320;
const D_PLAIN = 0.1;
const D_A = 4;
const D_B = 14;
const D_OUT_A = 26;
const D_OUT_B = 38;
const D_NEAR_A = 1.5;
const D_NEAR_B = 3.6;

function env(u: number, v: number) {
  const d = depthAt(u, v);
  if (d < D_NEAR_A) return 0;
  const x = groundX(u, v);
  if (x > X_OUT || x < X_IN) return 0;
  /* The bump is placement, and it has to be explicit — left to itself the
     noise put its highest peak hard against the frame edge, half cropped. */
  const fx =
    sstep(X_OUT, X_FULL, x) *
    sstep(X_IN, X_IN2, x) *
    Math.exp(-Math.pow((x - X_CENTRE) / X_WIDTH, 2));
  if (fx <= 0) return 0;
  return (
    fx *
    sstep(D_NEAR_A, D_NEAR_B, d) *
    (D_PLAIN + (1 - D_PLAIN) * sstep(D_A, D_B, d)) *
    (1 - sstep(D_OUT_A, D_OUT_B, d))
  );
}

function height(u: number, v: number) {
  const e = env(u, v);
  if (e <= 0.001) return 0;
  const r = (ridged(u, v) - FLOOR) / (1 - FLOOR);
  return r <= 0 ? 0 : AMP * e * Math.pow(r, SHARP);
}

/* THE DEPTH FADE HAS TO BE BAKED IN, NOT LEFT TO THE MASK. `hf-depth` ramps on
   screen y, which is a sound proxy for distance only while the ground is flat:
   a peak at depth 9 draws at y 154, up where that ramp reads zero, so the mask
   deletes the nearest and brightest part of the massif. Relief therefore moves
   to the air layer and carries its own attenuation.

   This is the mask's own ramp, evaluated at the FLAT-ground y for a depth
   rather than at the point's real y — fade by distance, which is what the ramp
   was always for, instead of by height. A line with no relief comes out
   identical to what the mask would have produced, so there is no seam where the
   massif meets the plain. */
function ramp(d: number) {
  const t = (FOCAL * CAM_H) / d / (H - HORIZON);
  return t < 0.16 ? (t / 0.16) * 0.5 : t < 0.5 ? 0.5 + ((t - 0.16) / 0.34) * 0.5 : 1;
}

/* Ramer-Douglas-Peucker, at 0.55 units — about half a pixel once the frame is
   scaled to a desktop viewport. SPACING IS THE WRONG MEASURE HERE and a
   distance filter was tried first: samples on a steep near face are already
   far apart so it dropped nothing, while a flat far run needs no interior
   points at all. Simplifying on deviation instead is what lets the lines be
   sampled at two-pixel intervals without the path data exploding. */
const EPS = 0.55;

function rdp(p: Pt[], eps: number): Pt[] {
  if (p.length < 3) return p;
  const a = p[0];
  const b = p[p.length - 1];
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy);
  let idx = 0;
  let max = 0;
  for (let i = 1; i < p.length - 1; i++) {
    const q =
      len < 1e-9
        ? Math.hypot(p[i][0] - a[0], p[i][1] - a[1])
        : Math.abs(dy * (p[i][0] - a[0]) - dx * (p[i][1] - a[1])) / len;
    if (q > max) {
      max = q;
      idx = i;
    }
  }
  return max > eps ? [...rdp(p.slice(0, idx + 1), eps).slice(0, -1), ...rdp(p.slice(idx), eps)] : [a, b];
}

/* Depth is monotonic along a line of constant u or constant v, so cutting each
   one at these thresholds splits it into runs of near-uniform distance — which
   is what lets a per-path opacity stand in for a per-point one. */
const BANDS = [2.4, 3, 3.8, 4.8, 6, 7.6, 9.6, 12, 15, 19, 24, 30, 38, Infinity];
const PAD = 110;
const BOOST = 2.3;
const CREST_MAX = 0.38;
const MIN_LEN = 5;

const onFrame = (p: Pt) => p[0] >= -PAD && p[0] <= W + PAD && p[1] >= -PAD && p[1] <= H + PAD;

type Sample = { p: Pt; d: number; h: number };

const { PLANE, RELIEF, TICKS } = (() => {
  /* ── Floating horizon ─────────────────────────────────────────────────────

     Hidden-line removal, and it is nearly free here for one specific reason:
     HEIGHT NEVER MOVES A POINT SIDEWAYS. The projected x carries no h term at
     all, so a column of the screen is exactly one view ray, and "is this point
     behind something?" collapses from a 3-D visibility query to a 1-D running
     minimum per column — a point is hidden iff something NEARER in its own
     column already drew at or above it.

     Bins are uniform in 1/d rather than in d. Flat-ground y is affine in 1/d,
     so a uniform-in-1/d bin is a constant number of pixels tall (about 1.7 at
     these settings) everywhere from the near edge to the far one; binning in
     d instead would be sub-pixel at the horizon and tens of pixels wide in the
     foreground.

     Each bin stores the running minimum over strictly NEARER bins, never
     including its own, so the error is one-sided: the buffer can only ever
     fail to hide something, never hide something it shouldn't. A crest is
     therefore always drawn — it is the nearest thing in its own column.

     Bounded to the massif's x range because flat ground cannot occlude
     anything: on a flat plane a farther point always projects higher than a
     nearer one, so the test would pass everywhere by construction. */
  const OCC_X0 = -150;
  const OCC_X1 = X_OUT + 120;
  const COL = 1.5;
  const NCOL = Math.ceil((OCC_X1 - OCC_X0) / COL);
  const T_MAX = 1 / 0.8;
  const T_MIN = 1 / 56;
  const TBINS = 768;
  const DT = (T_MAX - T_MIN) / TBINS;
  const horizon = new Float32Array(NCOL * TBINS);

  for (let c = 0; c < NCOL; c++) {
    const sx = (OCC_X0 + (c + 0.5) * COL - CX) / FOCAL;
    const base = c * TBINS;
    let run = Infinity;
    for (let k = 0; k < TBINS; k++) {
      horizon[base + k] = run;
      // two sub-samples per bin: a thin crest must not slip between bins
      for (let q = 0; q < 2; q++) {
        const t = T_MAX - (k + 0.25 + q * 0.5) * DT;
        if (t <= 0) continue;
        const d = 1 / t;
        const s = sx * d;
        const w = d - Z_OFF;
        const y = HORIZON + FOCAL * (CAM_H - height(s * CT - w * ST, s * ST + w * CT)) * t;
        if (y < run) run = y;
      }
    }
  }

  const visible = (x: number, y: number, d: number) => {
    if (x < OCC_X0 || x >= OCC_X1 || d <= 0.8) return true;
    const k = Math.floor((T_MAX - 1 / d) / DT);
    const c = ((x - OCC_X0) / COL) | 0;
    return y < horizon[c * TBINS + (k < 0 ? 0 : k >= TBINS ? TBINS - 1 : k)] + 0.4;
  };

  const plane: Stroke[] = [];
  const relief: Stroke[] = [];
  const band = (d: number) => BANDS.findIndex((b) => d <= b);

  const emit = (s: Sample[], base: number, w: number) => {
    let run: Pt[] = [];
    let cur: number | null = null;
    let peak = 0;
    let dSum = 0;

    const flush = () => {
      if (run.length < 2) return;
      /* Clamped, because `ramp` returns 1 for anything nearer than depth 2.77
         and the boost then multiplies an already-full major stroke to 0.79 —
         four times what the plane beside it is drawn at. The ceiling is the
         measured value of the composition this was signed off at. */
      const o = Math.min(CREST_MAX, base * ramp(dSum / run.length) * (1 + BOOST * Math.min(1, peak / 2.2)));
      if (o < 0.012) return;

      /* SPLIT on leaving the frame, never filter. Dropping the off-frame
         points from one list welds the surviving ends together and draws a
         straight chord across the gap — a line that was never on the
         surface. */
      const parts: Pt[][] = [];
      let seg: Pt[] = [];
      for (const p of run) {
        if (onFrame(p)) seg.push(p);
        else {
          if (seg.length > 1) parts.push(seg);
          seg = [];
        }
      }
      if (seg.length > 1) parts.push(seg);

      for (const part of parts) {
        const q = rdp(part, EPS);
        if (q.length < 2) continue;
        let len = 0;
        for (let i = 1; i < q.length; i++) len += Math.hypot(q[i][0] - q[i - 1][0], q[i][1] - q[i - 1][1]);
        /* A grid line that clears a ridge for only a few pixels leaves a
           detached dash with nothing around it to say what it belongs to; it
           reads as a speck of dirt on the drawing rather than as geometry. */
        if (len < MIN_LEN) continue;
        relief.push({ d: `M${q.map((p) => `${n1(p[0])} ${n1(p[1])}`).join('L')}`, o: +o.toFixed(3), w });
      }
    };

    for (const { p, d, h } of s) {
      const b = band(d);
      if (cur === null) {
        cur = b;
        run = [p];
        peak = h;
        dSum = d;
        continue;
      }
      if (b !== cur) {
        run.push(p);
        dSum += d;
        flush();
        run = [p];
        cur = b;
        peak = h;
        dSum = d;
      } else {
        run.push(p);
        peak = Math.max(peak, h);
        dSum += d;
      }
    }
    flush();
  };

  /* SCREEN-ADAPTIVE STEPPING. A world step of Δ spans Δ·FOCAL/d pixels, so
     Δ = STEP_PX·d/FOCAL walks every line at a near-constant pixel rate.
     Stepping uniformly in world units instead — as this did — oversamples the
     far end of a line by orders of magnitude while undersampling the near end,
     which is where the surface is largest on screen and needs the samples. */
  const STEP_PX = 2.6;

  const sampleLine = (from: number, to: number, at: (p: number) => [number, number]) => {
    const runs: Sample[][] = [];
    let cur: Sample[] | null = null;
    let clipped = false;

    const evalAt = (p: number) => {
      const [u, v] = at(p);
      const d = depthAt(u, v);
      const h = height(u, v);
      const pt = project(u, v, h);
      return { p: pt, d, h, vis: visible(pt[0], pt[1], d) };
    };

    /* A run must END ON THE SILHOUETTE, not on whichever sample happened to
       straddle it. Left to the sampling grid the ends land up to a full step
       short or long, which leaves stubs hanging past a ridge and gaps where a
       line should meet the crest it disappears behind. Seven halvings put the
       boundary inside 1/128 of a step, well under the buffer's own column
       width — so this is as exact as the horizon it resolves against. */
    const bisect = (loP: number, hiP: number, loVis: boolean) => {
      let lo = loP;
      let hi = hiP;
      for (let k = 0; k < 7; k++) {
        const m = (lo + hi) / 2;
        if (evalAt(m).vis === loVis) lo = m;
        else hi = m;
      }
      return evalAt(loVis ? lo : hi);
    };

    let p = from;
    let prevP = from;
    let prevVis: boolean | null = null;
    let guard = 0;
    for (; ;) {
      const s = evalAt(p);
      if (prevVis !== null && s.vis !== prevVis) {
        const edge = bisect(prevP, p, prevVis);
        if (prevVis) {
          cur!.push(edge);
          cur = null;
        } else {
          cur = [edge];
          runs.push(cur);
        }
      }
      if (s.vis) {
        if (!cur) {
          cur = [];
          runs.push(cur);
        }
        cur.push(s);
      } else {
        clipped = true;
        cur = null;
      }
      prevVis = s.vis;
      prevP = p;
      if (p >= to || guard++ > 20000) break;
      p = Math.min(to, p + Math.min(1.4, Math.max(0.035, (STEP_PX * s.d) / FOCAL)));
    }
    return { runs, clipped };
  };

  /* A line only pays for banding if it actually carries relief or was cut by
     the horizon. Everything else stays a two-point stroke in the masked plane
     layer, which is both cheaper and smoother than banding it — the gradient
     mask attenuates per pixel where a band can only do it per path. */
  const walk = (runs: Sample[][], clipped: boolean, flatA: Pt, flatB: Pt, i: number) => {
    let peak = 0;
    for (const r of runs) for (const s of r) peak = Math.max(peak, s.h);
    if (peak < 0.02 && !clipped) {
      if (half(i)) return;
      plane.push({ d: line(flatA, flatB), o: major(i) ? 0.22 : 0.12, w: major(i) ? 1.2 : 0.9 });
      return;
    }
    if (half(i) && peak < 0.4) return;
    const base = half(i) ? 0.075 : major(i) ? 0.22 : 0.12;
    const w = half(i) ? 0.7 : major(i) ? 1.2 : 0.9;
    for (const r of runs) emit(r, base, w);
  };

  // Lines of constant u, running away from the camera toward a vanishing point.
  for (let u = -EXT; u <= EXT; u += 0.5) {
    const vNear = Math.max((NEAR + u * ST - Z_OFF) / CT, -EXT);
    if (vNear >= EXT) continue;
    const { runs, clipped } = sampleLine(vNear, EXT, (v) => [u, v]);
    walk(runs, clipped, project(u, vNear), project(u, EXT), u);
  }

  // Lines of constant v, running across toward the second vanishing point.
  for (let v = -EXT; v <= EXT; v += 0.5) {
    const uFar = Math.min((v * CT + Z_OFF - NEAR) / ST, EXT);
    if (uFar <= -EXT) continue;
    const { runs, clipped } = sampleLine(-EXT, uFar, (u) => [u, v]);
    walk(runs, clipped, project(-EXT, v), project(uFar, v), v);
  }

  /* Drafting ticks at the near intersections. They only survive to depth 4.6 —
     past that the crosses collapse into the grid lines themselves and just
     thicken them. The bounds test is not an optimisation but a necessity: at
     low depth the horizontal spread is enormous and most intersections land
     thousands of pixels off-frame. */
  const ticks: string[] = [];
  for (let u = -EXT; u <= EXT; u++) {
    for (let v = -EXT; v <= EXT; v++) {
      const d = depthAt(u, v);
      if (d < NEAR || d > 4.6) continue;
      // Rides the displaced surface, not the flat plane it used to assume.
      const [x, y] = project(u, v, height(u, v));
      if (x < -80 || x > W + 80 || y > H + 80) continue;
      if (!visible(x, y, d)) continue;
      const t = Math.max(3, 26 / d);
      ticks.push(`M${n1(x - t)} ${n1(y)}h${n1(2 * t)}M${n1(x)} ${n1(y - t)}v${n1(2 * t)}`);
    }
  }

  return { PLANE: plane, RELIEF: relief, TICKS: ticks };
})();

/* Agent nodes as [u, v, height]. Hand-placed rather than seeded: the single
   right-hand cluster and the far trio are the composition, and a generator
   that respected that constraint would be more code than the nine literals.

   THERE IS NO LEFT FLANK BY CHOICE. One existed and was removed: `hf-clear`
   erases a 420-unit radius around (800, 414), which swallows everything from
   x 380 to x 1220 near the horizon, so a left cluster either sits inside that
   hole and is wiped, or is pushed out past x ~330 where it collides with the
   massif. Nothing added on that side should be assumed visible without
   checking it against both. */
const NODES: ReadonlyArray<readonly [number, number, number]> = [
  [8, 3, 0.75], [12, 7, 1.2], [7, 11, 0.45], [14, 14, 1.25], [6, 18, 0.85], [11, 23, 1.1],
  [-3, 28, 1.45], [4, 33, 1.3], [0, 41, 1.55],
];

type Node = { stem: string; pad: string; x: number; y: number; r: number };

const PLACED: Node[] = NODES.map(([u, v, h]) => {
  const p = project(u, v, h);
  const g = project(u, v, 0);
  const q = [project(u - 0.4, v), project(u, v - 0.4), project(u + 0.4, v), project(u, v + 0.4)];
  return {
    stem: line(p, g),
    pad: `M${q.map((c) => `${n1(c[0])} ${n1(c[1])}`).join('L')}Z`,
    x: p[0],
    y: p[1],
    // Node size is 1/depth like everything else, floored so the far three
    // stay visible as marks rather than dissolving into single pixels.
    r: Math.max(2, 22 / depthAt(u, v)),
  };
});

/* Links only between nodes within 9 cells, which is what keeps the cluster and
   the far trio reading as two things instead of one mesh. The arc is a fixed
   10% of the chord perpendicular to it — straight lines between floating
   nodes read as a flat wireframe and lose the depth the grid just built. */
const LINKS: { d: string; pulse: boolean }[] = (() => {
  const out: { d: string; pulse: boolean }[] = [];
  for (let i = 0; i < NODES.length; i++) {
    for (let j = i + 1; j < NODES.length; j++) {
      const a = NODES[i];
      const b = NODES[j];
      if (Math.hypot(a[0] - b[0], a[1] - b[1]) > 9) continue;
      const pa = project(a[0], a[1], a[2]);
      const pb = project(b[0], b[1], b[2]);
      const dx = pb[0] - pa[0];
      const dy = pb[1] - pa[1];
      const cx = (pa[0] + pb[0]) / 2 - dy * 0.1;
      const cy = (pa[1] + pb[1]) / 2 + dx * 0.1;
      out.push({
        d: `M${n1(pa[0])} ${n1(pa[1])}Q${n1(cx)} ${n1(cy)} ${n1(pb[0])} ${n1(pb[1])}`,
        pulse: out.length % 4 === 0,
      });
    }
  }
  return out;
})();

export default function HeroHorizonField({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      focusable="false"
      className={`horizon-field ${className}`}
    >
      <defs>
        {/* Two masks, because the two layers need opposite treatments. The
            grid has to vanish INTO the horizon; the nodes float above it and
            would be erased by that same ramp. */}
        <linearGradient id="hf-depth" gradientUnits="userSpaceOnUse" x1="0" y1={HORIZON} x2="0" y2={H}>
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.16" stopColor="#fff" stopOpacity="0.5" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="1" />
          <stop offset="1" stopColor="#fff" stopOpacity="1" />
        </linearGradient>

        {/* Clearance behind the copy. Black in a mask hides, and this rect is
            painted over the ramp, so the hole wins wherever they overlap. */}
        <radialGradient id="hf-clear" gradientUnits="userSpaceOnUse" cx={W * 0.5} cy={H * 0.46} r={CLEAR_R}>
          <stop offset="0" stopColor="#000" stopOpacity="1" />
          <stop offset="0.6" stopColor="#000" stopOpacity="0.9" />
          <stop offset="1" stopColor="#000" stopOpacity="0" />
        </radialGradient>

        <mask id="hf-plane" maskUnits="userSpaceOnUse" x="0" y="0" width={W} height={H}>
          <rect x="0" y="0" width={W} height={H} fill="url(#hf-depth)" />
          <rect x="0" y="0" width={W} height={H} fill="url(#hf-clear)" />
        </mask>

        <mask id="hf-air" maskUnits="userSpaceOnUse" x="0" y="0" width={W} height={H}>
          <rect x="0" y="0" width={W} height={H} fill="#fff" />
          <rect x="0" y="0" width={W} height={H} fill="url(#hf-clear)" />
        </mask>
      </defs>

      {/* Stroke, fill and joins are hoisted here rather than repeated on ~700
          children — it roughly halves the markup this ships in the HTML. */}
      <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        <g mask="url(#hf-plane)">
          <path d={`M0 ${HORIZON}H${W}`} strokeOpacity="0.1" strokeWidth="1" />
          {PLANE.map((g, i) => (
            <path key={`g${i}`} d={g.d} strokeOpacity={g.o} strokeWidth={g.w} />
          ))}
          {TICKS.map((d, i) => (
            <path key={`t${i}`} d={d} strokeOpacity="0.16" strokeWidth="1" />
          ))}
        </g>

        <g mask="url(#hf-air)">
          {/* Relief carries its own depth attenuation and so cannot ride in the
              plane layer — see the note on `ramp`. Drawn first because it is
              scenery: the node cluster is content and reads over it. */}
          {RELIEF.map((g, i) => (
            <path key={`r${i}`} d={g.d} strokeOpacity={g.o} strokeWidth={g.w} />
          ))}

          {PLACED.map((n, i) => (
            <React.Fragment key={`n${i}`}>
              <path d={n.stem} strokeOpacity="0.14" strokeWidth="1" strokeDasharray="3 5" />
              <path d={n.pad} strokeOpacity="0.18" strokeWidth="1" />
              <circle cx={n1(n.x)} cy={n1(n.y)} r={n1(n.r)} strokeOpacity="0.3" strokeWidth="1.2" />
              <circle
                cx={n1(n.x)}
                cy={n1(n.y)}
                r={n1(Math.max(1.4, n.r * 0.28))}
                fill="currentColor"
                fillOpacity="0.28"
                stroke="none"
              />
            </React.Fragment>
          ))}

          {LINKS.map((l, i) => (
            <React.Fragment key={`l${i}`}>
              <path d={l.d} strokeOpacity="0.2" strokeWidth="1.1" />
              {l.pulse && (
                <path
                  d={l.d}
                  className="hf-pulse"
                  strokeOpacity="0.34"
                  strokeWidth="1.6"
                  strokeDasharray="2 92"
                  style={{ animationDelay: `${(i * 0.7).toFixed(1)}s` }}
                />
              )}
            </React.Fragment>
          ))}

        </g>
      </g>
    </svg>
  );
}
