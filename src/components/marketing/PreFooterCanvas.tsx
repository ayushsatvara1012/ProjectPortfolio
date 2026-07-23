'use client';

import React, { useEffect, useRef } from 'react';

// Virtual 3D Shape Types
type ShapeType = 'vaayu' | 'sphere' | 'pyramid' | 'torus' | 'wave';

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
}

interface Virtual3DPoint {
  x: number;
  y: number;
  z: number;
}

export default function PreFooterCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Zero-re-render performance refs for 60fps canvas loop
  const stateRef = useRef({
    dots: [] as FixedDot[],
    gridCols: 0,
    gridRows: 0,
    rotX: 0,
    rotY: 0,
    rotZ: 0,
    mouseRotX: 0,
    mouseRotY: 0,
    targetMouseRotX: 0,
    targetMouseRotY: 0,
    time: 0,
    isVisible: true,
    lastFrameTime: 0,
    currentShapeIdx: 0,
    morphProgress: 1, // 0 to 1 smooth morphing lerp between shapes
    prevVirtualPoints: [] as Virtual3DPoint[],
    currVirtualPoints: [] as Virtual3DPoint[],
  });

  // -------------------------------------------------------------
  // 1. Virtual 3D Shape Geometries
  // -------------------------------------------------------------

  // Fibonacci Sphere (3D) - 100% Deterministic Uniform Grid
  const createSpherePoints = (count: number, radius: number): Virtual3DPoint[] => {
    const points: Virtual3DPoint[] = [];
    const phi = (1 + Math.sqrt(5)) / 2; // Golden ratio

    for (let i = 0; i < count; i++) {
      const theta = (2 * Math.PI * i) / phi;
      const z = 1 - (2 * i + 1) / count;
      const radiusAtZ = Math.sqrt(Math.max(0, 1 - z * z));
      points.push({
        x: Math.cos(theta) * radiusAtZ * radius,
        y: Math.sin(theta) * radiusAtZ * radius,
        z: z * radius,
      });
    }
    return points;
  };

  // 3D Pyramid - 100% Deterministic Wireframe & Face Grid
  const createPyramidPoints = (count: number, size: number): Virtual3DPoint[] => {
    const points: Virtual3DPoint[] = [];
    const vertices = [
      { x: 0, y: -size * 1.0, z: 0 }, // Top Apex
      { x: -size * 0.95, y: size * 0.75, z: -size * 0.8 },
      { x: size * 0.95, y: size * 0.75, z: -size * 0.8 },
      { x: 0, y: size * 0.75, z: size * 1.0 },
    ];

    // 6 Edges of 3D Pyramid
    const edges = [
      [vertices[0], vertices[1]],
      [vertices[0], vertices[2]],
      [vertices[0], vertices[3]],
      [vertices[1], vertices[2]],
      [vertices[2], vertices[3]],
      [vertices[3], vertices[1]],
    ];

    // Deterministic edge grid (50% of points)
    const edgeCount = Math.floor(count * 0.5);
    const stepsPerEdge = Math.floor(edgeCount / 6);
    for (let e = 0; e < 6; e++) {
      const edge = edges[e];
      for (let s = 0; s < stepsPerEdge; s++) {
        const t = s / (stepsPerEdge - 1 || 1);
        points.push({
          x: edge[0].x + (edge[1].x - edge[0].x) * t,
          y: edge[0].y + (edge[1].y - edge[0].y) * t,
          z: edge[0].z + (edge[1].z - edge[0].z) * t,
        });
      }
    }

    // Deterministic face grid (50% of points)
    const faces = [
      [vertices[0], vertices[1], vertices[2]],
      [vertices[0], vertices[2], vertices[3]],
      [vertices[0], vertices[3], vertices[1]],
      [vertices[1], vertices[2], vertices[3]],
    ];

    const faceCount = count - points.length;
    const pointsPerFace = Math.floor(faceCount / 4);
    const gridN = Math.floor(Math.sqrt(pointsPerFace * 2));

    for (let f = 0; f < 4; f++) {
      const face = faces[f];
      for (let i = 0; i <= gridN; i++) {
        for (let j = 0; j <= gridN - i; j++) {
          const u = i / (gridN || 1);
          const v = j / (gridN || 1);
          const w = 1 - u - v;
          points.push({
            x: u * face[0].x + v * face[1].x + w * face[2].x,
            y: u * face[0].y + v * face[1].y + w * face[2].y,
            z: u * face[0].z + v * face[1].z + w * face[2].z,
          });
        }
      }
    }
    return points;
  };

  // 3D Torus Ring - 100% Deterministic Parametric Grid
  const createTorusPoints = (count: number, R: number, r: number): Virtual3DPoint[] => {
    const points: Virtual3DPoint[] = [];
    const nU = Math.floor(Math.sqrt(count * 2.2));
    const nV = Math.floor(count / nU);

    const tilt = 0.55; // ~31 degrees
    const cosTilt = Math.cos(tilt);
    const sinTilt = Math.sin(tilt);

    for (let i = 0; i < nU; i++) {
      const u = (i / nU) * Math.PI * 2;
      const cosU = Math.cos(u);
      const sinU = Math.sin(u);

      for (let j = 0; j < nV; j++) {
        const v = (j / nV) * Math.PI * 2;
        const cosV = Math.cos(v);
        const sinV = Math.sin(v);

        const rawX = (R + r * cosV) * cosU;
        const rawY = (R + r * cosV) * sinU;
        const rawZ = r * sinV;

        const y = rawY * cosTilt - rawZ * sinTilt;
        const z = rawY * sinTilt + rawZ * cosTilt;

        points.push({ x: rawX, y, z });
      }
    }
    return points;
  };

  // 3D Wave Grid Surface - 100% Deterministic Grid
  const createWavePoints = (count: number, width: number, height: number): Virtual3DPoint[] => {
    const points: Virtual3DPoint[] = [];
    const cols = Math.ceil(Math.sqrt(count * 1.5));
    const rows = Math.ceil(count / cols);
    const spacingX = width / cols;
    const spacingY = height / rows;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = (c - cols / 2) * spacingX;
        const y = (r - rows / 2) * spacingY;
        const dist = Math.sqrt(x * x + y * y);
        const z = Math.sin(dist * 0.016) * 55;
        points.push({ x, y, z });
      }
    }
    return points;
  };

  // 3D Vaayu SVG Logo Path Sampler
  const createVaayuLogoPoints = (count: number, targetSize: number): Virtual3DPoint[] => {
    const points: Virtual3DPoint[] = [];

    // Path Vertices from public/vaayu_logo.svg (ViewBox 36 x 23)
    const rawVertices = [
      { x: 0.902634, y: 0.430403 },
      { x: 6.27567, y: 11.6987 },
      { x: 9.8577, y: 4.1865 },
      { x: 10.5408, y: 14.2424 },
      { x: 15.2307, y: 6.33284 },
      { x: 18.8128, y: 15.4548 },
      { x: 22.3948, y: 5.25967 },
      { x: 22.3948, y: 22.4304 },
      { x: 28.6633, y: 6.33284 },
      { x: 31.2898, y: 14.2424 },
      { x: 34.9026, y: 4.1865 },
    ];

    // Center & Scale normalization (Wider aspect ratio & larger span)
    const scaleFactorX = (targetSize / 32) * 1.65; // 65% wider span
    const scaleFactorY = targetSize / 32;
    const centerX = 17.9;
    const centerY = 11.4;

    const normalizedVertices = rawVertices.map((v) => ({
      x: (v.x - centerX) * scaleFactorX,
      y: (v.y - centerY) * scaleFactorY,
    }));

    // Calculate total length of 10 line segments
    const segmentLengths: number[] = [];
    let totalLength = 0;

    for (let i = 0; i < normalizedVertices.length - 1; i++) {
      const p1 = normalizedVertices[i];
      const p2 = normalizedVertices[i + 1];
      const len = Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
      segmentLengths.push(len);
      totalLength += len;
    }

    // Sample deterministic points along SVG outline + 3D depth extrusion
    const depthLayers = 5;
    const pointsPerLayer = Math.floor(count / depthLayers);

    for (let layer = 0; layer < depthLayers; layer++) {
      const zOffset = (layer - (depthLayers - 1) / 2) * 14; // 3D depth volume thickness

      for (let s = 0; s < segmentLengths.length; s++) {
        const p1 = normalizedVertices[s];
        const p2 = normalizedVertices[s + 1];
        const segLen = segmentLengths[s];
        const numSamples = Math.max(2, Math.floor(pointsPerLayer * (segLen / totalLength)));

        for (let i = 0; i < numSamples; i++) {
          const t = i / (numSamples - 1 || 1);
          points.push({
            x: p1.x + (p2.x - p1.x) * t,
            y: p1.y + (p2.y - p1.y) * t,
            z: zOffset + Math.sin(t * Math.PI) * 8,
          });
        }
      }
    }
    return points;
  };

  // Helper to generate 3D points for shape index
  const getShapePoints = (shapeIdx: number, minDim: number): Virtual3DPoint[] => {
    const count = 2400;
    const shapes: ShapeType[] = ['vaayu', 'sphere', 'pyramid', 'torus', 'wave'];
    const shape = shapes[shapeIdx % shapes.length];

    switch (shape) {
      case 'vaayu':
        return createVaayuLogoPoints(count, minDim * 1.85);
      case 'pyramid':
        return createPyramidPoints(count, minDim * 0.62);
      case 'torus':
        return createTorusPoints(count, minDim * 0.52, minDim * 0.18);
      case 'wave':
        return createWavePoints(count, minDim * 2.0, minDim * 1.4);
      case 'sphere':
      default:
        return createSpherePoints(count, minDim * 0.58);
    }
  };

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

    // Build Stationary 2D Dot Matrix
    const initGrid = (width: number, height: number) => {
      // Optimal spacing: ~21px for ideal clarity & dot matrix density
      const spacing = 15;
      const cols = Math.floor(width / spacing);
      const rows = Math.floor(height / spacing);
      const startX = (width - cols * spacing) / 2 + spacing / 2;
      const startY = (height - rows * spacing) / 2 + spacing / 2;

      const dots: FixedDot[] = [];

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          dots.push({
            x: startX + c * spacing,
            y: startY + r * spacing,
            baseRadius: 1.0, // Sleek fine base dot size
            flickerSpeed: 0.6 + Math.random() * 2.0,
            flickerPhase: Math.random() * Math.PI * 2,
            targetIntensity: 0,
            currentIntensity: 0,
            targetDepthScale: 0.2,
            currentDepthScale: 0.2,
          });
        }
      }

      stateRef.current.dots = dots;
      stateRef.current.gridCols = cols;
      stateRef.current.gridRows = rows;

      const minDim = Math.min(width, height);
      stateRef.current.prevVirtualPoints = getShapePoints(0, minDim);
      stateRef.current.currVirtualPoints = getShapePoints(0, minDim);
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
      const centerX = width / 2;
      const centerY = height / 2;

      ctx.clearRect(0, 0, width, height);

      // Multi-axis 3D Rotation angles for continuous 3D perspective spin
      const rotSpeed = isReducedMotion ? 0.1 : 0.45;
      stateRef.current.rotY += rotSpeed * dt;
      stateRef.current.rotX += rotSpeed * 0.55 * dt;
      stateRef.current.rotZ += rotSpeed * 0.25 * dt;

      // Mouse tilt inertia
      stateRef.current.targetMouseRotX += (stateRef.current.mouseRotX - stateRef.current.targetMouseRotX) * 0.08;
      stateRef.current.targetMouseRotY += (stateRef.current.mouseRotY - stateRef.current.targetMouseRotY) * 0.08;

      // Check if current active shape is Vaayu Logo (index % 5 === 0)
      const isVaayuLogo = stateRef.current.currentShapeIdx % 5 === 0;

      // Add isometric pitch tilt angle (~0.45 rad = ~26 deg) so viewer looks at 3D shapes from perspective view
      // Keep Vaayu logo completely STABLE (0 rotation angles) so it stays upright and clear
      const pitchTilt = isVaayuLogo ? 0 : 0.45;
      const totalRotX = isVaayuLogo ? 0 : stateRef.current.rotX + stateRef.current.targetMouseRotX + pitchTilt;
      const totalRotY = isVaayuLogo ? 0 : stateRef.current.rotY + stateRef.current.targetMouseRotY;
      const totalRotZ = isVaayuLogo ? 0 : stateRef.current.rotZ;

      const cosX = Math.cos(totalRotX), sinX = Math.sin(totalRotX);
      const cosY = Math.cos(totalRotY), sinY = Math.sin(totalRotY);
      const cosZ = Math.cos(totalRotZ), sinZ = Math.sin(totalRotZ);

      const focalLength = 460;

      // Get Current Virtual 3D Points (Morph Interpolated)
      const prevPts = stateRef.current.prevVirtualPoints;
      const currPts = stateRef.current.currVirtualPoints;
      const morphProgress = stateRef.current.morphProgress;

      // Update morph progress lerp (0 to 1 over ~1.6 seconds)
      if (stateRef.current.morphProgress < 1) {
        stateRef.current.morphProgress = Math.min(1, stateRef.current.morphProgress + dt * 0.65);
      }

      const pointCount = Math.min(prevPts.length, currPts.length);
      const projectedVirtualPoints: { sx: number; sy: number; sz: number }[] = [];

      for (let i = 0; i < pointCount; i++) {
        const p1 = prevPts[i];
        const p2 = currPts[i];

        // Smooth Lerp between previous and current virtual shape
        const vx = p1.x + (p2.x - p1.x) * morphProgress;
        const vy = p1.y + (p2.y - p1.y) * morphProgress;
        let vz = p1.z + (p2.z - p1.z) * morphProgress;

        // Wave motion for dynamic rest wave
        if (stateRef.current.currentShapeIdx % 4 === 3) {
          const dist = Math.sqrt(vx * vx + vy * vy);
          vz += Math.sin(dist * 0.02 - time * 2) * 12;
        }

        // Full 3D Matrix Rotation (Yaw -> Pitch -> Roll)
        // 1. Rotate Y
        const x1 = vx * cosY + vz * sinY;
        const y1 = vy;
        const z1 = -vx * sinY + vz * cosY;

        // 2. Rotate X
        const x2 = x1;
        const y2 = y1 * cosX - z1 * sinX;
        const z2 = y1 * sinX + z1 * cosX;

        // 3. Rotate Z
        const x3 = x2 * cosZ - y2 * sinZ;
        const y3 = x2 * sinZ + y2 * cosZ;
        const z3 = z2;

        // 3D Perspective Scale
        const scale = focalLength / (focalLength + z3 + 220);
        if (scale > 0) {
          projectedVirtualPoints.push({
            sx: centerX + x3 * scale,
            sy: centerY + y3 * scale,
            sz: z3, // Z-depth for front vs back face lighting calculation
          });
        }
      }

      // Project virtual 3D shape onto Fixed 2D Grid Dots
      const dots = stateRef.current.dots;
      const influenceRadiusSq = 22 * 22; // Illumination threshold radius squared (22px)

      // Spatial Illumination Map Reset
      for (let i = 0; i < dots.length; i++) {
        dots[i].targetIntensity = 0;
        dots[i].targetDepthScale = 0.15;
      }

      // Compute Proximity & Depth Lighting for each Virtual Projected Point
      for (let k = 0; k < projectedVirtualPoints.length; k++) {
        const vp = projectedVirtualPoints[k];

        // Quick bounding box filter for performance
        const minX = vp.sx - 22;
        const maxX = vp.sx + 22;
        const minY = vp.sy - 22;
        const maxY = vp.sy + 22;

        for (let i = 0; i < dots.length; i++) {
          const dot = dots[i];
          if (dot.x < minX || dot.x > maxX || dot.y < minY || dot.y > maxY) continue;

          const dx = dot.x - vp.sx;
          const dy = dot.y - vp.sy;
          const distSq = dx * dx + dy * dy;

          if (distSq < influenceRadiusSq) {
            // Smooth Gaussian spatial field kernel (zero spatial discretization noise / zero blinking)
            const proximityFactor = Math.exp(-distSq / 160);

            // Enhanced Depth Contrast (1.0 full brightness for Vaayu logo, depth contrast for 3D shapes)
            const normZ = Math.min(1, Math.max(0, (vp.sz + 220) / 440)); // 0 (front) to 1 (back)
            const depthLighting = isVaayuLogo ? 1.0 : Math.max(0.12, Math.pow(1.0 - normZ, 1.3));

            const intensity = proximityFactor * (isVaayuLogo ? 1.15 : depthLighting);

            if (intensity > dot.targetIntensity) {
              dot.targetIntensity = Math.min(1.0, intensity);
              dot.targetDepthScale = isVaayuLogo ? 1.0 : depthLighting;
            }
          }
        }
      }

      // Render Fixed 2D Grid Dots (Pure Grayscale, Solid & Non-Blinking)
      for (let i = 0; i < dots.length; i++) {
        const dot = dots[i];

        // Ultra-smooth lerp for fluid intensity transitions (no rapid blinking)
        const lerpFactor = 1 - Math.exp(-5.0 * dt);
        dot.currentIntensity += (dot.targetIntensity - dot.currentIntensity) * lerpFactor;
        dot.currentDepthScale += (dot.targetDepthScale - dot.currentDepthScale) * lerpFactor;

        // Steady base ambient opacity (blinking & flickering disabled)
        const baseAmbientOpacity = 0.085; // Steady 8.5% background grid opacity

        // Illuminated Opacity (Pure Grayscale White)
        // Active dots scale smoothly from ambient 0.085 to bright white 0.96
        const activeOpacity = dot.currentIntensity * 0.88 * dot.currentDepthScale;
        const finalAlpha = Math.min(0.96, Math.max(baseAmbientOpacity, baseAmbientOpacity + activeOpacity));

        // Minimal radius scale (from 1.0px ambient to 1.2px front-face max)
        const dotRadius = dot.baseRadius + dot.currentIntensity * dot.currentDepthScale * 0.2;

        ctx.beginPath();
        ctx.arc(dot.x, dot.y, dotRadius, 0, Math.PI * 2);

        // Pure Grayscale Rendering (High contrast crisp white)
        if (dot.currentIntensity > 0.1) {
          const brightness = Math.floor(210 + dot.currentDepthScale * 45); // 210 to 255 grayscale
          ctx.fillStyle = `rgba(${brightness}, ${brightness}, ${brightness}, ${finalAlpha.toFixed(3)})`;
        } else {
          // Ambient dim gray dots (matching image grid pattern)
          ctx.fillStyle = `rgba(215, 225, 240, ${finalAlpha.toFixed(3)})`;
        }
        ctx.fill();
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

  // -------------------------------------------------------------
  // 4. Auto Shape Morphing Timer (Every 7 Seconds)
  // -------------------------------------------------------------
  useEffect(() => {
    const timer = setInterval(() => {
      const container = containerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const minDim = Math.min(rect.width, rect.height);

      const nextShapeIdx = stateRef.current.currentShapeIdx + 1;
      stateRef.current.prevVirtualPoints = getShapePoints(stateRef.current.currentShapeIdx, minDim);
      stateRef.current.currVirtualPoints = getShapePoints(nextShapeIdx, minDim);
      stateRef.current.currentShapeIdx = nextShapeIdx;
      stateRef.current.morphProgress = 0;
    }, 7000);

    return () => clearInterval(timer);
  }, []);

  // -------------------------------------------------------------
  // 5. Interactive Mouse Rotation Inertia
  // -------------------------------------------------------------
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const nx = (e.clientX - rect.left) / rect.width - 0.5;
    const ny = (e.clientY - rect.top) / rect.height - 0.5;

    stateRef.current.mouseRotY = nx * 0.65;
    stateRef.current.mouseRotX = -ny * 0.65;
  };

  const handleMouseLeave = () => {
    stateRef.current.mouseRotX = 0;
    stateRef.current.mouseRotY = 0;
  };

  return (
    <section
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="relative w-full min-h-screen h-screen bg-slate-950 text-white overflow-hidden select-none border-t border-b border-slate-900 flex items-center justify-center"
      style={{
        // Smooth top and bottom fade mask for seamless dark theme integration
        WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 12%, black 88%, transparent 100%)',
        maskImage: 'linear-gradient(to bottom, transparent 0%, black 12%, black 88%, transparent 100%)',
      }}
    >
      {/* HTML5 Fixed Dot Matrix Canvas Layer */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full block z-0 cursor-default" />
    </section>
  );
}
