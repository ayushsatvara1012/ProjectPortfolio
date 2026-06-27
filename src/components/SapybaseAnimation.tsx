import React, { useEffect, useRef, useId } from 'react';

interface SapybaseAnimationProps extends React.SVGProps<SVGSVGElement> {
  size?: number;
  duration?: number; // Shimmer cycle duration in ms
  logoOpacity?: number; // Opacity of the background static logo (0 = transparent)
  shimmerColor?: string; // Color of the shimmer wave
  strokeWidth?: number; // Line thickness / weight of the logo outline
  shimmerWidth?: number; // Width of the shimmer gradient band
  shimmerOpacity?: number; // Max opacity of the shimmer beam
}

export default function SapybaseAnimation({
  size = 120,
  duration = 1200,
  logoOpacity = 0.05, // Defaults to 0.05
  shimmerColor = 'currentColor', // Defaults to inherit parent text color (responsive theme)
  strokeWidth = 1, // Defaults to 1
  shimmerWidth = 4, // Defaults to 4
  shimmerOpacity = 1, // Softer fade peak
  className = '',
  ...props
}: SapybaseAnimationProps) {
  const shimmerGradRef = useRef<SVGLinearGradientElement>(null);
  const idPrefix = useId().replace(/:/g, ''); // Ensure safe ID selector characters

  const gradId = `g-${idPrefix}`;
  const shimmerGradId = `sg-${idPrefix}`;
  const maskId = `m-${idPrefix}`;

  useEffect(() => {
    const shimmerGrad = shimmerGradRef.current;
    if (!shimmerGrad) return;

    let animId: number;
    const tick = (ts: number) => {
      const sp = (ts % duration) / duration;
      // Start completely outside left, end completely outside right
      const sx = -shimmerWidth + sp * (12 + shimmerWidth * 2);
      shimmerGrad.setAttribute('x1', String(sx));
      shimmerGrad.setAttribute('x2', String(sx + shimmerWidth));
      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(animId);
    };
  }, [duration, shimmerWidth]);

  // Width = size, Height scales proportionally (ratio 7/12 = 0.583)
  const width = size;
  const height = size * (7 / 12);

  const pathD = "M0.273834 1.90274L2.70212 4.18322L4.38778 0.939321L6.27383 5.40274L7.77383 1.40274L9.57041 4.18322L11.2738 0.939318";

  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 12 7"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...props}
    >
      <defs>
        {/* Static logo color gradient */}
        <linearGradient id={gradId} x1="2.49142" y1="0.256391" x2="2.49952" y2="4.97093" gradientUnits="userSpaceOnUse">
          <stop stopColor="currentColor" stopOpacity={0.4} />
          <stop offset="1" stopColor="currentColor" stopOpacity={0.8} />
        </linearGradient>

        {/* Shimmer sweep gradient */}
        <linearGradient
          ref={shimmerGradRef}
          id={shimmerGradId}
          gradientUnits="userSpaceOnUse"
          x1="0"
          y1="0"
          x2={shimmerWidth}
          y2="0"
        >
          <stop offset="0" stopColor={shimmerColor} stopOpacity="0" />
          <stop offset="0.5" stopColor={shimmerColor} stopOpacity={shimmerOpacity} />
          <stop offset="1" stopColor={shimmerColor} stopOpacity="0" />
        </linearGradient>

        {/* Mask to clip shimmer strictly to path shape */}
        <mask id={maskId}>
          <path
            d={pathD}
            stroke="white"
            strokeWidth={strokeWidth}
          />
        </mask>
      </defs>

      {/* Static full logo */}
      <path
        d={pathD}
        stroke={`url(#${gradId})`}
        strokeWidth={strokeWidth}
        strokeOpacity={logoOpacity}
      />

      {/* Shimmer beam, clipped to path shape */}
      <path
        d={pathD}
        stroke={`url(#${shimmerGradId})`}
        strokeWidth={strokeWidth}
        mask={`url(#${maskId})`}
      />
    </svg>
  );
}
