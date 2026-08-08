'use client';

import React, { useEffect, useRef } from 'react';
import { generateGalaxySky, drawGalaxySky } from './heroSky';

interface HeroHorizonCanvasProps {
  className?: string;
}

export default function HeroHorizonCanvas({ className = '' }: HeroHorizonCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Viewport Virtual Canvas Dimensions
    const W = 1600;
    const H = 900;
    const HORIZON = 350;
    const FOCAL = 580;
    const CAM_H = 2.2;
    const CX = W / 2;
    const Z_OFF = 1.0;

    // Grid Bounds
    const U_MIN = -24;
    const U_MAX = 24;
    const U_STEP = 1.5;
    const V_MIN = 1.2;
    const V_MAX = 30;
    const V_STEP = 1.2;

    const depthAt = (u: number, v: number) => v + Z_OFF;

    function terrainHeight(u: number, v: number): number {
      const d = depthAt(u, v);
      if (d < 1.5 || d > 28) return 0;

      if (u < -2) {
        const dist = Math.abs(u + 12) / 9;
        const gaussian = Math.exp(-dist * dist);
        const ridge = Math.pow(Math.sin(u * 0.45) * Math.cos(v * 0.35), 2);
        const depthRamp = Math.sin(Math.min(Math.PI, (d - 2) / 24 * Math.PI));
        return (gaussian * 4.8 + ridge * 2.2) * depthRamp;
      }

      if (u > 6) {
        const dist = Math.abs(u - 14) / 8;
        const plateau = Math.exp(-dist * dist);
        const techStep = (Math.floor(u) % 2 === 0 ? 0.6 : 0.2) + Math.sin(v * 0.4) * 0.3;
        const depthRamp = Math.sin(Math.min(Math.PI, (d - 3) / 22 * Math.PI));
        return Math.max(0, (plateau * 1.8 + techStep) * depthRamp);
      }

      return 0;
    }

    function project(u: number, v: number, h: number = 0): [number, number, number] {
      const d = depthAt(u, v);
      const px = CX + (FOCAL * u) / d;
      const py = HORIZON + (FOCAL * (CAM_H - h)) / d;
      return [px, py, d];
    }

    // Sky region is everything above HORIZON, i.e. exactly where the grid
    // has ended - stars only need to live there.
    const SKY = generateGalaxySky(1337, W, HORIZON, 220);

    // No theme provider and no `dark` class in this project - `dark:` resolves
    // to the media query, so the canvas has to read it the same way.
    const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const draw = () => {
      const rect = canvas.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;

      ctx.clearRect(0, 0, width, height);

      const scaleX = width / W;
      const scaleY = height / H;

      const isDarkMode = darkQuery.matches;

      // Near-neutral on dark so the warm gradient tints the lines itself rather
      // than a saturated accent competing with it.
      const strokeRGB = isDarkMode ? '100, 116, 139' : '30, 64, 175';

      ctx.save();
      ctx.scale(scaleX, scaleY);

      // --- 0. GALAXY SKY: nebula wash + starfield, dark mode only. Drawn
      // before the terrain so the facet erase-pass below naturally occludes
      // stars sitting behind the mountain silhouette. ---
      if (isDarkMode) {
        drawGalaxySky(ctx, SKY, HORIZON);
      }

      // --- 1. PAINTER'S ALGORITHM: NAVBAR-MATCHED FROSTED GLASS FACETS ---
      for (let v = V_MAX; v >= V_MIN; v -= V_STEP) {
        for (let u = U_MIN; u < U_MAX; u += U_STEP) {
          const uNext = u + U_STEP;
          const vNext = v - V_STEP;

          const h00 = terrainHeight(u, v);
          const h10 = terrainHeight(uNext, v);
          const h11 = terrainHeight(uNext, vNext);
          const h01 = terrainHeight(u, vNext);

          const [p00x, p00y, d00] = project(u, v, h00);
          const [p10x, p10y] = project(uNext, v, h10);
          const [p11x, p11y] = project(uNext, vNext, h11);
          const [p01x, p01y] = project(u, vNext, h01);

          const midX = (p00x + p10x + p11x + p01x) / 4;
          const midY = (p00y + p10y + p11y + p01y) / 4;
          const distToText = Math.hypot(midX - CX, midY - 420);
          const textClearance = Math.min(1, Math.max(0, (distToText - 180) / 220));

          const depthAlpha = Math.min(0.45, Math.max(0.05, (32 - d00) / 28));
          const alpha = depthAlpha * (0.2 + 0.8 * textClearance);

          ctx.beginPath();
          ctx.moveTo(p00x, p00y);
          ctx.lineTo(p10x, p10y);
          ctx.lineTo(p11x, p11y);
          ctx.lineTo(p01x, p01y);
          ctx.closePath();

          // Every facet is opaque to whatever sits behind it: erase first, then lay
          // down the translucent glass so only the page gradient shows through.
          ctx.globalCompositeOperation = 'destination-out';
          ctx.fillStyle = '#000';
          ctx.fill();
          ctx.globalCompositeOperation = 'source-over';

          const avgH = (h00 + h10 + h11 + h01) / 4;
          const elevationShade = Math.min(1, avgH / 5);
          const glassAlpha = Math.min(0.82, 0.42 + (28 - d00) / 60 + elevationShade * 0.18);

          if (isDarkMode) {
            // Navbar's glass: #0B0F19 at 0.70 over backdrop-blur-xl. Depth scales
            // it down so far facets sink into the gradient instead of slabbing it.
            const darkAlpha = Math.min(0.7, 0.28 + (28 - d00) / 70 + elevationShade * 0.12);
            ctx.fillStyle = `rgba(11, 15, 25, ${darkAlpha.toFixed(3)})`;
          } else {
            const shade = Math.round(elevationShade * 26);
            ctx.fillStyle = `rgba(${255 - shade}, ${255 - shade}, ${255 - Math.round(shade * 0.6)}, ${glassAlpha.toFixed(3)})`;
          }
          ctx.fill();

          if (alpha <= 0.01) continue;

          ctx.strokeStyle = `rgba(${strokeRGB}, ${alpha.toFixed(3)})`;
          ctx.lineWidth = Math.abs(u) % 6 === 0 || Math.floor(v) % 6 === 0 ? 1.3 : 0.85;
          ctx.stroke();
        }
      }

      ctx.restore();
    };

    const handleResize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
      draw();
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    darkQuery.addEventListener('change', draw);

    return () => {
      window.removeEventListener('resize', handleResize);
      darkQuery.removeEventListener('change', draw);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={`horizon-canvas w-full h-full pointer-events-none backdrop-blur-xl saturate-150 ${className}`}
    />
  );
}
