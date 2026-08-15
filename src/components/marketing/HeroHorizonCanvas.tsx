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

    const U_CENTER = 0;
    const V_CENTER = 15;

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

    function projectRotated(u: number, v: number, h: number = 0, angle: number = 0): [number, number, number] {
      if (Math.abs(angle) < 0.0001) {
        const d = depthAt(u, v);
        const px = CX + (FOCAL * u) / d;
        const py = HORIZON + (FOCAL * (CAM_H - h)) / d;
        return [px, py, d];
      }

      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);

      const uOffset = u - U_CENTER;
      const vOffset = v - V_CENTER;

      // Y-axis 3D rotation: positive angle recedes left terrain into depth, brings right terrain forward
      const uRot = uOffset * cosA + vOffset * sinA + U_CENTER;
      const vRot = -uOffset * sinA + vOffset * cosA + V_CENTER;

      const d = depthAt(uRot, Math.max(0.1, vRot));
      const px = CX + (FOCAL * uRot) / d;
      const py = HORIZON + (FOCAL * (CAM_H - h)) / d;
      return [px, py, d];
    }

    // Sky region is everything above HORIZON, i.e. exactly where the grid ended
    const SKY = generateGalaxySky(1337, W, HORIZON, 220);

    const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

    // Scroll progress & smooth lerping state
    let targetAngle = 0;
    let currentAngle = 0;
    let animFrameId: number | null = null;

    const draw = () => {
      const rect = canvas.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;

      if (width === 0 || height === 0) return;

      ctx.clearRect(0, 0, width, height);

      const scaleX = width / W;
      const scaleY = height / H;

      ctx.save();
      ctx.scale(scaleX, scaleY);

      // 0. GALAXY SKY: nebula wash + starfield (Static, unaffected by rotation)
      drawGalaxySky(ctx, SKY, HORIZON);

      // 1. PAINTER'S ALGORITHM FACET RENDERING WITH DYNAMIC Y-AXIS 3D ROTATION
      const cosA = Math.cos(currentAngle);
      const sinA = Math.sin(currentAngle);

      type Facet = { u: number; v: number; avgVRot: number };
      const facets: Facet[] = [];

      for (let v = V_MAX; v >= V_MIN; v -= V_STEP) {
        for (let u = U_MIN; u < U_MAX; u += U_STEP) {
          const uCenter = u + U_STEP * 0.5 - U_CENTER;
          const vCenter = v - V_STEP * 0.5 - V_CENTER;
          const avgVRot = -uCenter * sinA + vCenter * cosA + V_CENTER;
          facets.push({ u, v, avgVRot });
        }
      }

      // Sort farthest facets to nearest (largest avgVRot first)
      facets.sort((a, b) => b.avgVRot - a.avgVRot);

      for (const facet of facets) {
        const u = facet.u;
        const v = facet.v;
        const uNext = u + U_STEP;
        const vNext = v - V_STEP;

        const h00 = terrainHeight(u, v);
        const h10 = terrainHeight(uNext, v);
        const h11 = terrainHeight(uNext, vNext);
        const h01 = terrainHeight(u, vNext);

        const [p00x, p00y, d00] = projectRotated(u, v, h00, currentAngle);
        const [p10x, p10y] = projectRotated(uNext, v, h10, currentAngle);
        const [p11x, p11y] = projectRotated(uNext, vNext, h11, currentAngle);
        const [p01x, p01y] = projectRotated(u, vNext, h01, currentAngle);

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

        ctx.globalCompositeOperation = 'destination-out';
        ctx.fillStyle = '#000';
        ctx.fill();
        ctx.globalCompositeOperation = 'source-over';

        const avgH = (h00 + h10 + h11 + h01) / 4;
        const elevationShade = Math.min(1, avgH / 5);

        const darkAlpha = Math.min(0.7, 0.28 + (28 - d00) / 70 + elevationShade * 0.12);
        ctx.fillStyle = `rgba(11, 15, 25, ${darkAlpha.toFixed(3)})`;
        ctx.fill();

        if (alpha <= 0.01) continue;

        ctx.strokeStyle = 'transparent';
        ctx.lineWidth = Math.abs(u) % 6 === 0 || Math.floor(v) % 6 === 0 ? 1.3 : 0.85;
        ctx.stroke();
      }

      ctx.restore();
    };

    const updateScrollProgress = () => {
      if (reducedMotionQuery.matches) {
        targetAngle = 0;
        return;
      }

      const homeEl = document.getElementById('home');
      const chatbotsEl = document.getElementById('chatbots');

      if (!homeEl || !chatbotsEl) {
        targetAngle = 0;
        return;
      }

      const chatbotsRect = chatbotsEl.getBoundingClientRect();
      const vh = window.innerHeight;

      // Target completion: ChatbotShowcase is 80% visible (top is at vh * 0.20)
      const currentScrollY = window.scrollY;
      const targetScrollY = chatbotsRect.top + currentScrollY - (vh * 0.20);

      if (targetScrollY <= 0) {
        targetAngle = 0;
      } else {
        const rawProgress = currentScrollY / targetScrollY;
        const progress = Math.min(1, Math.max(0, rawProgress));
        // Max rotation angle theta = 0.42 radians (~24 degrees)
        const MAX_ROTATION_RAD = 0.42;
        targetAngle = progress * MAX_ROTATION_RAD;
      }
    };

    const renderLoop = () => {
      updateScrollProgress();
      // Smooth lerp (0.08) for butter-smooth animation
      const diff = targetAngle - currentAngle;
      if (Math.abs(diff) > 0.0001) {
        currentAngle += diff * 0.08;
        draw();
      } else if (currentAngle !== targetAngle) {
        currentAngle = targetAngle;
        draw();
      }
      animFrameId = requestAnimationFrame(renderLoop);
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
    renderLoop();

    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', updateScrollProgress, { passive: true });
    darkQuery.addEventListener('change', draw);

    return () => {
      if (animFrameId !== null) cancelAnimationFrame(animFrameId);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', updateScrollProgress);
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

