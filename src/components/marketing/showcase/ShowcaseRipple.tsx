import { ART } from '../artTheme';

// The concentric echo behind the panel in the two showcase artworks. Both
// exports put an identical 385-wide, r=34 panel at the same spot in the same
// 723x542 viewBox, so this shares that space and every ring stays locked to the
// panel's own geometry rather than being re-measured at each breakpoint.
//
// PANEL mirrors that shared body.
// Each ring grows outward by RING_STEP on the left, right and top and keeps the
// panel's flat bottom, which the frame's own rounded clip cuts off.

const FRAME_HEIGHT = 542;
const PANEL = { x: 169, y: 84, w: 385, r: 34 };

const RING_COUNT = 8;
const RING_STEP = 8;

// Figma: fill #fff at 16%, drop shadow x0 y0 blur 2 #3D3D3D at 25%. Figma's
// blur is twice the Gaussian deviation, so blur 2 is stdDeviation 1.
const RING_FILL_OPACITY = 0.16;

// The stack fades outward. This rides on `opacity` rather than `fillOpacity`
// so it takes the drop shadow down with the fill, the way a Figma layer
// opacity does - fading only the fill would leave the outer rings reading as
// bare shadow outlines.
const RING_FADE_MIN = 0.05;

function ringFade(index: number) {
  const t = index / (RING_COUNT - 1);
  return 1 - t * (1 - RING_FADE_MIN);
}

function ringPath(step: number) {
  const x = PANEL.x - step;
  const y = PANEL.y - step;
  const w = PANEL.w + step * 2;
  const r = PANEL.r + step;

  return [
    `M${x} ${y + r}`,
    `A${r} ${r} 0 0 1 ${x + r} ${y}`,
    `H${x + w - r}`,
    `A${r} ${r} 0 0 1 ${x + w} ${y + r}`,
    `V${FRAME_HEIGHT}`,
    `H${x}`,
    'Z',
  ].join(' ');
}

// Each instance owns its filter: two copies of one id would be invalid markup,
// and these are server components, so useId is not available to generate one.
export default function ShowcaseRipple({ id }: { id: string }) {
  const shadowId = `${id}-ripple-shadow`;

  // Index 0 is the innermost ring, hugging the panel at full strength; the
  // last is the widest and all but invisible. Painted outermost first so the
  // brighter inner rings stack on top.
  const rings = Array.from({ length: RING_COUNT }, (_, i) => ({
    step: (i + 1) * RING_STEP,
    opacity: ringFade(i),
  })).reverse();

  return (
    <svg
      viewBox={`0 0 723 ${FRAME_HEIGHT}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 h-full w-full"
    >
      <defs>
        <filter id={shadowId} x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="0" dy="0" stdDeviation="1" floodColor="#3D3D3D" floodOpacity="0.25" />
        </filter>
      </defs>
      {rings.map((ring) => (
        <path
          key={ring.step}
          d={ringPath(ring.step)}
          className={ART.ripple}
          fill="#fff"
          fillOpacity={RING_FILL_OPACITY}
          opacity={ring.opacity}
          filter={`url(#${shadowId})`}
        />
      ))}
    </svg>
  );
}
