'use client';

import React, { useRef, useMemo, useEffect, Component, type ReactNode } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

class WebGLErrorBoundary extends Component<{ children: ReactNode; fallback?: ReactNode }, { error: boolean }> {
  state = { error: false };
  static getDerivedStateFromError() { return { error: true }; }
  render() {
    return this.state.error ? (this.props.fallback ?? null) : this.props.children;
  }
}

export type WaveStyle = 'classic' | 'ripples' | 'vortex' | 'matrix' | 'dome' | 'flat' | 'globe' | 'water_drop' | 'drifting_dust' | 'standing_ripple';
export type ParticleType = 'capsule' | 'box' | 'dot';

export interface AntigravityBackgroundProps {
  effectStyle?: WaveStyle;
  colorPalette?: string[];
  particleType?: ParticleType;
  particleCount?: number;
  particleSize?: number;
  particleSeparation?: number;
  cameraPosition?: [number, number, number];
  parallaxX?: number;
  parallaxY?: number;
  parallaxBaseY?: number;
  randomness?: number;
  speed?: number;
  fog?: { color: string; near: number; far: number } | null;
  className?: string; // For CSS overlays
  containerClassName?: string;
  morphProgressRef?: { current: number };
  interactive?: boolean;
}

const defaultColors = ['#FF0000', '#0035FF', '#F7FF00', '#FF6A00'];

const WaveParticles = ({
  effectStyle,
  colorPalette,
  particleType,
  particleCount,
  particleSize,
  particleSeparation,
  parallaxX,
  parallaxY,
  parallaxBaseY,
  randomness,
  speed,
  morphProgressRef,
  isInViewportRef,
  interactive = true,
}: {
  effectStyle: WaveStyle;
  colorPalette: string[];
  particleType: ParticleType;
  particleCount: number;
  particleSize: number;
  particleSeparation: number;
  parallaxX: number;
  parallaxY: number;
  parallaxBaseY: number;
  randomness: number;
  speed: number;
  morphProgressRef?: { current: number };
  isInViewportRef: { current: boolean };
  interactive?: boolean;
}) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);

  const dummy = useMemo(() => new THREE.Object3D(), []);
  const dummyColor = useMemo(() => new THREE.Color(), []);
  const colors = useMemo(() => colorPalette.map(c => new THREE.Color(c)), [colorPalette]);

  const numParticles = particleCount * particleCount;
  const plane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), []);
  const target = useMemo(() => new THREE.Vector3(), []);

  const enterTimeRef = useRef<number | null>(null);
  const particleRevealThresholds = useMemo(() => {
    const arr = new Float32Array(numParticles);
    for (let i = 0; i < numParticles; i++) arr[i] = Math.random();
    return arr;
  }, [numParticles]);

  // Detailed World Map Sampling for Globe Style
  const [landMask, setLandMask] = React.useState<Uint8Array | null>(null);
  const maskRes = { w: 128, h: 64 };

  React.useEffect(() => {
    if (effectStyle === 'globe') {
      const loader = new THREE.TextureLoader();
      // Using a standard high-contrast earth mask
      loader.load('https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/earth_specular_2048.jpg', (texture) => {
        const canvas = document.createElement('canvas');
        canvas.width = maskRes.w;
        canvas.height = maskRes.h;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(texture.image, 0, 0, maskRes.w, maskRes.h);
          const pixels = ctx.getImageData(0, 0, maskRes.w, maskRes.h).data;
          const mask = new Uint8Array(maskRes.w * maskRes.h);
          for (let i = 0; i < mask.length; i++) {
            // Earth specular map is bright on water, dark on land. 
            // We want land to be bright for visibility.
            mask[i] = pixels[i * 4] < 100 ? 255 : 0;
          }
          setLandMask(mask);
        }
      });
    }
  }, [effectStyle]);

  useFrame((state) => {
    if (!meshRef.current) return;

    // Halt GPU loop entirely when off-screen
    if (!isInViewportRef.current) {
      enterTimeRef.current = null;
      return;
    }

    const elapsed = state.clock.getElapsedTime();

    // Track first in-viewport frame for staggered particle reveal
    if (enterTimeRef.current === null) enterTimeRef.current = elapsed;
    const revealProgress = Math.min(1, (elapsed - enterTimeRef.current) / 2.0);

    const time = elapsed * speed;

    state.raycaster.setFromCamera(state.pointer, state.camera);
    state.raycaster.ray.intersectPlane(plane, target);

    const pointerX = target ? target.x : 0;
    const pointerY = target ? target.z : 0;

    let i = 0;
    for (let ix = 0; ix < particleCount; ix++) {
      for (let iy = 0; iy < particleCount; iy++) {
        dummy.quaternion.set(0, 0, 0, 1);
        const randX = ((Math.sin(ix * 12.9898 + iy * 78.233) * 43758.5453) % 1) * 2 - 1;
        const randZ = ((Math.sin(ix * 39.346 + iy * 11.135) * 43758.5453) % 1) * 2 - 1;

        let x = ix * particleSeparation - (particleCount * particleSeparation) / 2 + randX * randomness;
        let z = iy * particleSeparation - (particleCount * particleSeparation) / 2 + randZ * randomness;

        let y = 0;

        if (effectStyle === 'classic') {
          const wave1 = Math.sin(ix * 0.2 + time * 1.2) * 1.5;
          const wave2 = Math.sin(iy * 0.3 + time * 0.8) * 1.5;
          const wave3 = Math.cos((ix + iy) * 0.1 + time * 0.5) * 1;
          y = wave1 + wave2 + wave3;
        } else if (effectStyle === 'ripples') {
          const distCenter = Math.sqrt(x * x + z * z);
          y = Math.sin(distCenter * 0.5 - time * 3) * 2.0;
        } else if (effectStyle === 'vortex') {
          const distCenter = Math.sqrt(x * x + z * z);
          const angle = Math.atan2(z, x);
          const swirl = Math.sin(angle * 4 + distCenter * 0.2 - time * 2) * 2;
          y = swirl + (distCenter * 0.1) - 2;
        } else if (effectStyle === 'matrix') {
          const wave1 = Math.sin(ix * 0.4 + time * 2) * 1.5;
          const wave2 = Math.cos(iy * 0.4 - time * 1) * 1.5;
          y = Math.round(wave1 + wave2);
        } else if (effectStyle === 'dome') {
          const distCenter = Math.sqrt(x * x + z * z);
          const dome = -Math.pow(distCenter, 2) * 0.02 + 10;
          const breathe = Math.sin(time * 1.5) * 2;
          const surfaceRipple = Math.sin(distCenter * 0.4 - time) * 0.5;
          y = dome + breathe + surfaceRipple - 8;
        } else if (effectStyle === 'flat') {
          y = -2;
        } else if (effectStyle === 'drifting_dust') {
          const seed = Math.sin(ix * 45.32 + iy * 89.21);
          const speedFactor = 0.3 + Math.abs(seed) * 0.4;
          const heightRange = 36;
          const startY = -18;
          y = startY + ((time * speedFactor + Math.abs(seed) * heightRange) % heightRange);
          const randShiftX = Math.sin(ix * 12.9898 + iy * 78.233 + seed * 100);
          const randShiftZ = Math.cos(ix * 39.346 + iy * 11.135 + seed * 100);
          x = (ix - particleCount / 2) * (particleSeparation * 1.5) + randShiftX * 3;
          z = (iy - particleCount / 2) * (particleSeparation * 1.5) + randShiftZ * 3;
          x += Math.sin(time * 0.5 + seed * 10) * 2.0;
          z += Math.cos(time * 0.4 + seed * 10) * 2.0;
        } else if (effectStyle === 'standing_ripple') {
          x = ix * particleSeparation - (particleCount * particleSeparation) / 2;
          z = iy * particleSeparation - (particleCount * particleSeparation) / 2;

          const d = Math.sqrt(x * x + z * z);
          const waveFreq = 0.25;
          const waveSpeed = 1.2;
          const waveVal = Math.cos(d * waveFreq - time * waveSpeed);

          y = waveVal * 1.5;

          if (d > 0.05) {
            const dir = new THREE.Vector3(x, y, z).normalize();
            const up = new THREE.Vector3(0, 1, 0);
            dummy.quaternion.setFromUnitVectors(up, dir);
          } else {
            dummy.quaternion.set(0, 0, 0, 1);
          }
        }

        let scale = Math.max(0.2, 1 + y * (effectStyle === 'matrix' ? 0.2 : ((effectStyle === 'drifting_dust' || effectStyle === 'standing_ripple') ? 0 : 0.15)));
        if (effectStyle === 'drifting_dust') {
          const seed = Math.sin(ix * 45.32 + iy * 89.21);
          const startY = -18;
          const heightRange = 36;
          const distanceToEdge = Math.min(y - startY, (startY + heightRange) - y);
          const fadeZone = 5;
          scale = Math.max(0.0, Math.min(1.0, distanceToEdge / fadeZone)) * (0.8 + Math.abs(seed) * 0.6);
        } else if (effectStyle === 'standing_ripple') {
          const d = Math.sqrt(x * x + z * z);
          const baseScale = particleCount < 35 ? 2.5 : 1.2;

          const maxRadius = (particleCount * particleSeparation) * 0.5;
          const centerRadius = 2.0;
          const centerFadeZone = 3.5;
          const edgeFadeZone = 6.0;

          const centerFade = Math.max(0.0, Math.min(1.0, (d - centerRadius) / centerFadeZone));
          const edgeFade = Math.max(0.0, Math.min(1.0, (maxRadius - d) / edgeFadeZone));

          scale = baseScale * centerFade * edgeFade;
        }

        if (effectStyle === 'globe') {
          const R = 15;
          const u = ix / (particleCount - 1);
          const v = iy / (particleCount - 1);

          // Asymmetric distribution noise
          const noise = ((Math.sin(ix * 12.9898 + iy * 78.233) * 43758.5453) % 1);
          const rotationSpeed = time * 0.15;
          const theta = u * Math.PI * 2 + rotationSpeed + noise * 0.02;
          const phi = v * Math.PI;

          x = R * Math.sin(phi) * Math.cos(theta);
          y = R * Math.cos(phi);
          z = R * Math.sin(phi) * Math.sin(theta);

          // Sampling the land mask
          if (landMask) {
            const mx = Math.floor(u * (maskRes.w - 1));
            const my = Math.floor(v * (maskRes.h - 1));
            const isLand = landMask[my * maskRes.w + mx] > 0;

            if (!isLand) {
              scale = 0; // Hide sea particles for country detail
            } else {
              scale = 0.4 + noise * 0.4; // Tiny, asymmetric particles
              y += Math.sin(time + ix * 0.5) * 0.15; // Subtle terrain ripple
            }
          }
        } else if (effectStyle === 'water_drop') {
          const R = 9;
          const idx = i;
          const n = numParticles;

          const phi = Math.acos(1 - 2 * (idx + 0.5) / n);
          const theta = Math.PI * (1 + Math.sqrt(5)) * idx + time * 0.12;

          const rx = Math.sin(phi) * Math.cos(theta);
          const ry = Math.cos(phi);
          const rz = Math.sin(phi) * Math.sin(theta);

          // Layer 1 — slow global breath: whole drop inhales/exhales uniformly.
          const breath = 1 + Math.sin(time * 0.55) * 0.032;

          // Layer 2 — directional slosh: Y squashes while XZ expands (incompressible).
          const slosh = Math.sin(time * 0.82 + 0.4) * 0.042;
          const scaleY = breath * (1 + slosh);
          const scaleXZ = breath * (1 - slosh * 0.5);

          // Layer 3 — travelling surface ripples (smooth on Fibonacci lattice).
          const ripple =
            Math.sin(phi * 4.0 - time * 1.6) * 0.020 +
            Math.sin(phi * 7.5 + time * 1.0) * 0.009 +
            Math.cos(theta * 3.0 - time * 0.65) * 0.013;

          const rSurf = R * (1 + ripple);

          x = rx * rSurf * scaleXZ;
          y = ry * rSurf * scaleY + Math.sin(time * 0.38) * 0.9;
          z = rz * rSurf * scaleXZ;

          const normal = new THREE.Vector3(rx, ry, rz);
          const up = new THREE.Vector3(0, 1, 0);
          dummy.quaternion.setFromUnitVectors(up, normal);

          // Smoothstep pole-cap at 0.4 rad ≈ 23°: gentler than linear fade.
          const poleCapAngle = 0.4;
          const tN = Math.min(1, phi / poleCapAngle);
          const tS = Math.min(1, (Math.PI - phi) / poleCapAngle);
          const smN = tN * tN * (3 - 2 * tN);
          const smS = tS * tS * (3 - 2 * tS);
          const poleFade = Math.sqrt(smN * smS);

          // Soft front-culling: 0.25-wide transition zone.
          const cameraZ = state.camera.position.z;
          const dotZ = rz * (cameraZ > 0 ? 1 : -1);
          const layerFade = Math.max(0, Math.min(1, (dotZ + 0.25) / 0.25));

          // Rim: silhouette-edge particles appear fractionally larger.
          const rim = 1 + Math.max(0, 0.3 - Math.abs(dotZ)) * 0.5;

          const baseScale = particleCount < 35 ? 2.5 : 1.0;
          scale = baseScale * (0.30 + Math.abs(ripple) * 4.5) * poleFade * layerFade * rim;
        }

        // Ripple → water_drop morph — driven by morphProgressRef (zero React re-renders).
        if (effectStyle === 'ripples') {
          const mp = morphProgressRef?.current ?? 0;
          if (mp > 0) {
            const ease = mp < 0.5
              ? 4 * mp * mp * mp
              : 1 - Math.pow(-2 * mp + 2, 3) / 2;

            const R = 9;
            const n = numParticles;
            const gPhi = Math.acos(1 - 2 * (i + 0.5) / n);
            const gTheta = Math.PI * (1 + Math.sqrt(5)) * i + time * 0.12;

            const wRx = Math.sin(gPhi) * Math.cos(gTheta);
            const wRy = Math.cos(gPhi);
            const wRz = Math.sin(gPhi) * Math.sin(gTheta);

            // Mirror the water_drop physics exactly.
            const breath = 1 + Math.sin(time * 0.55) * 0.032;
            const slosh = Math.sin(time * 0.82 + 0.4) * 0.042;
            const scaleY = breath * (1 + slosh);
            const scaleXZ = breath * (1 - slosh * 0.5);
            const ripple =
              Math.sin(gPhi * 4.0 - time * 1.6) * 0.020 +
              Math.sin(gPhi * 7.5 + time * 1.0) * 0.009 +
              Math.cos(gTheta * 3.0 - time * 0.65) * 0.013;
            const rSurf = R * (1 + ripple);

            const gX = wRx * rSurf * scaleXZ;
            const gY = wRy * rSurf * scaleY + Math.sin(time * 0.38) * 0.9;
            const gZ = wRz * rSurf * scaleXZ;

            // Smoothstep pole-cap — matches water_drop.
            const pCap = 0.4;
            const tN = Math.min(1, gPhi / pCap);
            const tS = Math.min(1, (Math.PI - gPhi) / pCap);
            const pFade = Math.sqrt(
              (tN * tN * (3 - 2 * tN)) * (tS * tS * (3 - 2 * tS))
            );

            // Lerp first, then derive layerFade from the ACTUAL current z.
            // Using the target's rz caused the bump: back-face particles near the pole
            // had rz≈0 so layerFade≈1 and were fully visible during the transition.
            const newX = x + ease * (gX - x);
            const newY = y + ease * (gY - y);
            const newZ = z + ease * (gZ - z);

            const curRz = newZ / R;
            const layerFade = Math.max(0, Math.min(1, (curRz + 0.25) / 0.25));
            const rim = 1 + Math.max(0, 0.3 - Math.abs(curRz)) * 0.5;

            x = newX; y = newY; z = newZ;
            scale = scale + ease * ((0.30 + Math.abs(ripple) * 4.5) * pFade * layerFade * rim - scale);
          }
        }

        // water_drop (and ripples morphing into it) must skip the pointer lift:
        // with pointer-events-none the pointer defaults to (0,0) world, which
        // pushes north-pole particles (x≈0, z≈0) upward and creates the bump.
        const isDropStyle = effectStyle === 'water_drop' ||
          (effectStyle === 'ripples' && (morphProgressRef?.current ?? 0) > 0);
        if (!isDropStyle && interactive && effectStyle !== 'drifting_dust' && effectStyle !== 'standing_ripple') {
          const dist = Math.sqrt(Math.pow(x - pointerX, 2) + Math.pow(z - pointerY, 2));
          y += Math.max(0, 4 - dist) * 0.8;
        }

        let normalizedY = (y - (-2.5)) / (3.5 - (-2.5));
        if (effectStyle === 'matrix') {
          normalizedY = (y - (-2)) / (3 - (-2));
        } else if (effectStyle === 'globe') {
          normalizedY = (y + 15) / 30;
        } else if (effectStyle === 'water_drop') {
          normalizedY = (y + 12) / 24; // Blue-ish gradients for water
        } else if (effectStyle === 'drifting_dust') {
          normalizedY = (y + 18) / 36;
        } else if (effectStyle === 'standing_ripple') {
          const d = Math.sqrt(x * x + z * z);
          const waveFreq = 0.25;
          const waveSpeed = 1.2;
          const waveVal = Math.cos(d * waveFreq - time * waveSpeed);
          normalizedY = waveVal * 0.5 + 0.5;
        }
        normalizedY = Math.max(0, Math.min(1, normalizedY));

        const segment = normalizedY * (colors.length - 1);
        const index1 = Math.floor(segment);
        const index2 = Math.min(colors.length - 1, index1 + 1);
        const fraction = segment - index1;

        dummyColor.lerpColors(colors[index1], colors[index2], fraction);
        meshRef.current.setColorAt(i, dummyColor);

        // Staggered entrance: each particle fades in when revealProgress crosses its threshold
        const revealFade = revealProgress < particleRevealThresholds[i]
          ? 0
          : Math.min(1, (revealProgress - particleRevealThresholds[i]) / 0.06);
        scale *= revealFade;

        dummy.position.set(x, y, z);
        dummy.scale.set(scale, scale, scale);
        dummy.updateMatrix();

        meshRef.current.setMatrixAt(i, dummy.matrix);
        i++;
      }
    }

    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) {
      meshRef.current.instanceColor.needsUpdate = true;
    }

    if (effectStyle === 'standing_ripple') {
      state.camera.position.set(0, 20, 6);
      state.camera.lookAt(0, 0, 0);
    } else if (effectStyle === 'water_drop' && particleCount < 35) {
      state.camera.position.set(0, 0, 22);
      state.camera.lookAt(0, 0, 0);
    } else {
      state.camera.position.x += (state.pointer.x * parallaxX - state.camera.position.x) * 0.05;
      state.camera.position.y += (parallaxBaseY + state.pointer.y * parallaxY - state.camera.position.y) * 0.05;
      state.camera.lookAt(0, 0, 0);
    }
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, numParticles]}>
      {particleType === 'capsule' ? (
        <capsuleGeometry args={[particleSize * 0.04 / 0.03, 0.15, 2, 8]} />
      ) : particleType === 'dot' ? (
        <sphereGeometry args={[particleSize, 12, 12]} />
      ) : (
        <boxGeometry args={[particleSize * 0.4 / 0.03, particleSize * 0.4 / 0.03, particleSize * 0.4 / 0.03]} />
      )}
      <meshBasicMaterial
        color="#ffffff"
        transparent
        opacity={1.0}
        blending={THREE.NormalBlending}
      />
    </instancedMesh>
  );
};

const AntigravityBackground: React.FC<AntigravityBackgroundProps> = ({
  effectStyle = 'classic',
  colorPalette = defaultColors,
  particleType = 'capsule',
  particleCount = 50,
  particleSize = 0.03,
  particleSeparation = 4,
  cameraPosition = [0, 15, 30],
  parallaxX = 15,
  parallaxY = 5,
  parallaxBaseY = 15,
  randomness = 0,
  speed = 1.0,
  fog = { color: '#0f172a', near: 15, far: 50 },
  className = "",
  containerClassName = "absolute inset-0 w-full h-full z-0 bg-transparent overflow-hidden pointer-events-auto",
  morphProgressRef,
  interactive = true,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const isInViewportRef = useRef(true);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => { isInViewportRef.current = entry.isIntersecting; },
      { threshold: 0 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={containerRef}
      className={containerClassName}
      style={{ touchAction: 'none' }}
    >
      {className && <div className={className} />}

      <WebGLErrorBoundary>
        <Canvas camera={{ position: cameraPosition, fov: 60 }} dpr={[1, 2]}>
          {fog && <fog attach="fog" args={[fog.color, fog.near, fog.far]} />}
          <WaveParticles
            effectStyle={effectStyle}
            colorPalette={colorPalette}
            particleType={particleType}
            particleCount={particleCount}
            particleSize={particleSize}
            particleSeparation={particleSeparation}
            parallaxX={parallaxX}
            parallaxY={parallaxY}
            parallaxBaseY={parallaxBaseY}
            randomness={randomness}
            speed={speed}
            morphProgressRef={morphProgressRef}
            isInViewportRef={isInViewportRef}
            interactive={interactive}
          />
        </Canvas>
      </WebGLErrorBoundary>
    </div>
  );
};

export default AntigravityBackground;
