'use client';

import React, { useLayoutEffect, useRef, useState } from 'react';
import DashboardMock, { MOCK_WIDTH } from './DashboardMock';

/* Scales the fixed-width dashboard to exactly fill its container at any width.
 *
 * This needs a measurement rather than CSS: a scale factor is a unitless
 * number, and calc() cannot divide a length by a length, so there is no way to
 * express `containerWidth / 1152` in a stylesheet. Breakpoint steps were the
 * alternative and they read as uneven between the steps.
 *
 * The class-based scale stays as the pre-hydration baseline, so the first paint
 * is already close and this only nudges it to exact. It is applied through the
 * `scale` property rather than `transform` on purpose: Tailwind's `scale-*`
 * utility sets `scale`, and `transform` is a separate property that would
 * multiply with it instead of overriding it. Height is measured from the
 * content, never assumed, so the mock cannot be clipped. */

const MAX_RENDER_WIDTH = 1600;

export default function ScaledDashboard() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState<{ scale: number; height: number } | null>(null);

  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    const inner = innerRef.current;
    if (!wrap || !inner) return;

    const measure = () => {
      const width = Math.min(wrap.clientWidth, MAX_RENDER_WIDTH);
      if (!width) return;
      const scale = width / MOCK_WIDTH;
      // offsetHeight is the untransformed layout height, so this stays correct
      // no matter what scale is currently applied.
      const height = Math.round(inner.offsetHeight * scale);

      setFit((prev) =>
        prev && Math.abs(prev.scale - scale) < 0.0005 && prev.height === height
          ? prev
          : { scale, height }
      );
    };

    measure();

    // Icon and display webfonts land after first layout and change the content
    // height, so the first measurement alone would leave the box short.
    document.fonts?.ready.then(measure).catch(() => {});

    // Observing the wrapper would also fire on the height we set below; box
    // observation on the parent keeps the loop from feeding itself.
    const target = wrap.parentElement ?? wrap;
    const observer = new ResizeObserver(measure);
    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={wrapRef}
      className="mx-auto w-full max-w-[1600px] h-[124px] min-[360px]:h-[140px] min-[400px]:h-[155px] min-[480px]:h-[190px] sm:h-[255px] md:h-[310px] lg:h-[420px] xl:h-[530px] min-[1440px]:h-[600px] min-[1648px]:h-[690px]"
      style={fit ? { height: fit.height } : undefined}
    >
      <div
        ref={innerRef}
        className="origin-top-left scale-[0.25] min-[360px]:scale-[0.28] min-[400px]:scale-[0.31] min-[480px]:scale-[0.38] sm:scale-[0.51] md:scale-[0.62] lg:scale-[0.84] xl:scale-[1.06] min-[1440px]:scale-[1.20] min-[1648px]:scale-[1.38]"
        style={{ width: MOCK_WIDTH, ...(fit ? { scale: String(fit.scale) } : {}) }}
      >
        <DashboardMock />
      </div>
    </div>
  );
}
