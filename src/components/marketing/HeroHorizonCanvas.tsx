'use client';

import React, { useEffect, useRef } from 'react';

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

    let animationFrameId: number;

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

    interface TechTower {
      u: number;
      v: number;
      height: number;
    }

    const TOWERS: TechTower[] = [
      { u: 8, v: 8, height: 1.6 },
      { u: 14, v: 12, height: 2.4 },
      { u: 10, v: 16, height: 2.0 },
      { u: 18, v: 15, height: 3.0 },
      { u: 13, v: 22, height: 2.6 },
      { u: 21, v: 20, height: 3.4 },
      { u: 17, v: 26, height: 3.1 },
    ];

    const TOWER_NODES = TOWERS.map((t) => {
      const baseH = terrainHeight(t.u, t.v);
      const topH = baseH + t.height;
      const [bx, by] = project(t.u, t.v, baseH);
      const [tx, ty, td] = project(t.u, t.v, topH);
      return { ...t, bx, by, tx, ty, d: td };
    });

    interface NetworkLink {
      fromIdx: number;
      toIdx: number;
      pulseOffset: number;
      speed: number;
    }

    const LINKS: NetworkLink[] = [];
    for (let i = 0; i < TOWER_NODES.length; i++) {
      for (let j = i + 1; j < TOWER_NODES.length; j++) {
        const du = TOWER_NODES[i].u - TOWER_NODES[j].u;
        const dv = TOWER_NODES[i].v - TOWER_NODES[j].v;
        if (Math.hypot(du, dv) < 11) {
          LINKS.push({
            fromIdx: i,
            toIdx: j,
            pulseOffset: Math.random(),
            speed: 0.2 + Math.random() * 0.3,
          });
        }
      }
    }

    const handleResize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    let startTime = performance.now();

    const render = (now: number) => {
      const elapsed = (now - startTime) / 1000;
      const rect = canvas.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;

      ctx.clearRect(0, 0, width, height);

      const scaleX = width / W;
      const scaleY = height / H;

      const isDarkMode = document.documentElement.classList.contains('dark');

      const strokeRGB = isDarkMode ? '56, 189, 248' : '30, 64, 175';
      const accentRGB = isDarkMode ? '14, 165, 233' : '37, 99, 235';

      ctx.save();
      ctx.scale(scaleX, scaleY);

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
            const lift = Math.round(elevationShade * 18);
            ctx.fillStyle = `rgba(${11 + lift}, ${15 + lift}, ${25 + lift}, ${glassAlpha.toFixed(3)})`;
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

      // --- 2. TECH TOWERS & NETWORK NODES ---
      TOWER_NODES.forEach((node) => {
        const alpha = Math.min(0.7, Math.max(0.15, (30 - node.d) / 25));

        ctx.beginPath();
        ctx.moveTo(node.bx, node.by);
        ctx.lineTo(node.tx, node.ty);
        ctx.strokeStyle = `rgba(${strokeRGB}, ${(alpha * 1.1).toFixed(3)})`;
        ctx.lineWidth = 1.3;
        ctx.setLineDash([3, 3]);
        ctx.stroke();
        ctx.setLineDash([]);

        const radius = Math.max(2.5, 26 / node.d);
        ctx.beginPath();
        ctx.arc(node.tx, node.ty, radius, 0, Math.PI * 2);
        ctx.fillStyle = isDarkMode ? '#0284c7' : '#2563eb';
        ctx.fill();
        ctx.strokeStyle = `rgba(${accentRGB}, ${alpha.toFixed(3)})`;
        ctx.lineWidth = 1.4;
        ctx.stroke();
      });

      // --- 3. CONNECTED NETWORK BEAMS & ANIMATED PULSES ---
      LINKS.forEach((link) => {
        const n1 = TOWER_NODES[link.fromIdx];
        const n2 = TOWER_NODES[link.toIdx];

        const midX = (n1.tx + n2.tx) / 2;
        const midY = (n1.ty + n2.ty) / 2 - 12;

        const alpha = Math.min(0.4, Math.max(0.1, (30 - (n1.d + n2.d) / 2) / 25));

        ctx.beginPath();
        ctx.moveTo(n1.tx, n1.ty);
        ctx.quadraticCurveTo(midX, midY, n2.tx, n2.ty);
        ctx.strokeStyle = `rgba(${accentRGB}, ${alpha.toFixed(3)})`;
        ctx.lineWidth = 1.1;
        ctx.stroke();

        const t = (elapsed * link.speed + link.pulseOffset) % 1;
        const px = (1 - t) * (1 - t) * n1.tx + 2 * (1 - t) * t * midX + t * t * n2.tx;
        const py = (1 - t) * (1 - t) * n1.ty + 2 * (1 - t) * t * midY + t * t * n2.ty;

        ctx.beginPath();
        ctx.arc(px, py, 2.2, 0, Math.PI * 2);
        ctx.fillStyle = isDarkMode ? '#38bdf8' : '#1d4ed8';
        ctx.fill();
      });

      ctx.restore();

      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
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
