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
        const depthRamp = Math.sin(Math.min(Math.PI, ((d - 2) / 24) * Math.PI));
        return (gaussian * 4.8 + ridge * 2.2) * depthRamp;
      }

      if (u > 6) {
        const dist = Math.abs(u - 14) / 8;
        const plateau = Math.exp(-dist * dist);
        const techStep = (Math.floor(u) % 2 === 0 ? 0.6 : 0.2) + Math.sin(v * 0.4) * 0.3;
        const depthRamp = Math.sin(Math.min(Math.PI, ((d - 3) / 22) * Math.PI));
        return Math.max(0, (plateau * 1.8 + techStep) * depthRamp);
      }

      return 0;
    }

    // 3D Y-axis horizontal rotation: left mountain recedes into depth
    const YAW_ANGLE = (-14 * Math.PI) / 180;
    const COS_YAW = Math.cos(YAW_ANGLE);
    const SIN_YAW = Math.sin(YAW_ANGLE);

    function project(u: number, v: number, h: number = 0): [number, number, number] {
      // Horizontal Y-axis rotation around pivot v = 12
      const vPivot = v - 12;
      const uRot = u * COS_YAW - vPivot * SIN_YAW;
      const vRot = u * SIN_YAW + vPivot * COS_YAW + 12;

      const d = Math.max(0.8, vRot + Z_OFF);
      const px = CX + (FOCAL * uRot) / d;
      const py = HORIZON + (FOCAL * (CAM_H - h)) / d;
      return [px, py, d];
    }

    // Sky region is everything above HORIZON, i.e. exactly where the grid ended
    const SKY = generateGalaxySky(1337, W, HORIZON, 160);

    const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');
    let animId: number;
    let startTime: number | null = null;

    // Cache static terrain facets once to avoid re-allocating inside the 60fps render loop
    type Facet = { u: number; v: number };
    const facets: Facet[] = [];
    for (let v = V_MAX; v >= V_MIN; v -= V_STEP) {
      for (let u = U_MIN; u < U_MAX; u += U_STEP) {
        facets.push({ u, v });
      }
    }

    const renderFrame = (timestamp: number) => {
      if (startTime === null) startTime = timestamp;
      const elapsedSec = (timestamp - startTime) / 1000;

      const rect = canvas.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;

      if (width > 0 && height > 0) {
        ctx.clearRect(0, 0, width, height);

        const scaleX = width / W;
        const scaleY = height / H;

        ctx.save();
        ctx.scale(scaleX, scaleY);

        // 0. GALAXY SKY: dynamic starfield on pitch dark background
        drawGalaxySky(ctx, SKY, HORIZON, elapsedSec);

        // 1. PAINTER'S ALGORITHM FACET RENDERING
        for (const facet of facets) {
          const u = facet.u;
          const v = facet.v;
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

          const depthAlpha = Math.min(0.55, Math.max(0.08, (32 - d00) / 26));
          const alpha = depthAlpha * (0.3 + 0.7 * textClearance);

          ctx.beginPath();
          ctx.moveTo(p00x, p00y);
          ctx.lineTo(p10x, p10y);
          ctx.lineTo(p11x, p11y);
          ctx.lineTo(p01x, p01y);
          ctx.closePath();

          ctx.globalCompositeOperation = 'destination-out';
          ctx.fillStyle = '#000';
          ctx.fill();
          ctx.globalCompositeOperation = 'source-over';

          const avgH = (h00 + h10 + h11 + h01) / 4;
          const elevationShade = Math.min(1, avgH / 5);

          // Darker deep space navy facet fill
          const facetAlpha = Math.min(0.8, 0.32 + (28 - d00) / 65 + elevationShade * 0.15);
          ctx.fillStyle = `rgba(14, 20, 34, ${facetAlpha.toFixed(3)})`;
          ctx.fill();

          if (alpha <= 0.01) continue;

          // Subtle slate/starlight wireframe stroke so terrain grid is clearly visible & brighter
          ctx.strokeStyle = `rgba(148, 163, 184, ${(alpha * 0.45).toFixed(3)})`;
          ctx.lineWidth = Math.abs(u) % 6 === 0 || Math.floor(v) % 6 === 0 ? 1.3 : 0.85;
          ctx.stroke();
        }

        ctx.restore();
      }

      animId = requestAnimationFrame(renderFrame);
    };

    const handleResize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
    };

    handleResize();
    animId = requestAnimationFrame(renderFrame);

    window.addEventListener('resize', handleResize);
    darkQuery.addEventListener('change', handleResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      darkQuery.removeEventListener('change', handleResize);
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
