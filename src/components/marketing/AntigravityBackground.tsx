'use client';

import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export type WaveStyle = 'classic' | 'ripples' | 'vortex' | 'matrix' | 'dome' | 'flat';
export type ParticleType = 'capsule' | 'box' | 'dot';

export interface AntigravityBackgroundProps {
  effectStyle?: WaveStyle;
  colorPalette?: string[];
  particleType?: ParticleType;
  particleCount?: number;
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
}

const defaultColors = ['#FF0000', '#0035FF', '#F7FF00', '#FF6A00'];

const WaveParticles = ({
  effectStyle,
  colorPalette,
  particleType,
  particleCount,
  particleSeparation,
  parallaxX,
  parallaxY,
  parallaxBaseY,
  randomness,
  speed
}: {
  effectStyle: WaveStyle;
  colorPalette: string[];
  particleType: ParticleType;
  particleCount: number;
  particleSeparation: number;
  parallaxX: number;
  parallaxY: number;
  parallaxBaseY: number;
  randomness: number;
  speed: number;
}) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);

  const dummy = useMemo(() => new THREE.Object3D(), []);
  const dummyColor = useMemo(() => new THREE.Color(), []);
  const colors = useMemo(() => colorPalette.map(c => new THREE.Color(c)), [colorPalette]);

  const numParticles = particleCount * particleCount;
  const plane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), []);
  const target = useMemo(() => new THREE.Vector3(), []);

  useFrame((state) => {
    if (!meshRef.current) return;
    const time = state.clock.getElapsedTime() * speed;

    state.raycaster.setFromCamera(state.pointer, state.camera);
    state.raycaster.ray.intersectPlane(plane, target);

    const pointerX = target ? target.x : 0;
    const pointerY = target ? target.z : 0;

    let i = 0;
    for (let ix = 0; ix < particleCount; ix++) {
      for (let iy = 0; iy < particleCount; iy++) {
        const randX = ((Math.sin(ix * 12.9898 + iy * 78.233) * 43758.5453) % 1) * 2 - 1;
        const randZ = ((Math.sin(ix * 39.346 + iy * 11.135) * 43758.5453) % 1) * 2 - 1;

        const x = ix * particleSeparation - (particleCount * particleSeparation) / 2 + randX * randomness;
        const z = iy * particleSeparation - (particleCount * particleSeparation) / 2 + randZ * randomness;

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
          y = -2; // Flat grid, set base y
        }

        const dist = Math.sqrt(Math.pow(x - pointerX, 2) + Math.pow(z - pointerY, 2));
        const hoverEffect = Math.max(0, 4 - dist) * 0.8;
        y += hoverEffect;

        const scale = Math.max(0.2, 1 + y * (effectStyle === 'matrix' ? 0.2 : 0.15));

        let normalizedY = (y - (-2.5)) / (3.5 - (-2.5));
        if (effectStyle === 'matrix') {
          normalizedY = (y - (-2)) / (3 - (-2));
        }
        normalizedY = Math.max(0, Math.min(1, normalizedY));

        const segment = normalizedY * (colors.length - 1);
        const index1 = Math.floor(segment);
        const index2 = Math.min(colors.length - 1, index1 + 1);
        const fraction = segment - index1;

        dummyColor.lerpColors(colors[index1], colors[index2], fraction);
        meshRef.current.setColorAt(i, dummyColor);

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

    state.camera.position.x += (state.pointer.x * parallaxX - state.camera.position.x) * 0.05;
    state.camera.position.y += (parallaxBaseY + state.pointer.y * parallaxY - state.camera.position.y) * 0.05;
    state.camera.lookAt(0, 0, 0);
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, numParticles]}>
      {particleType === 'capsule' ? (
        <capsuleGeometry args={[0.04, 0.15, 2, 8]} />
      ) : particleType === 'dot' ? (
        <sphereGeometry args={[0.03, 16, 16]} />
      ) : (
        <boxGeometry args={[0.4, 0.4, 0.4]} />
      )}
      <meshBasicMaterial
        color="#ffffff"
        transparent
        opacity={0.8}
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
  particleSeparation = 4,
  cameraPosition = [0, 15, 30],
  parallaxX = 15,
  parallaxY = 5,
  parallaxBaseY = 15,
  randomness = 0,
  speed = 1.0,
  fog = { color: '#0f172a', near: 15, far: 50 },
  className = "",
  containerClassName = "absolute inset-0 w-full h-full z-0 bg-transparent overflow-hidden pointer-events-auto"
}) => {
  return (
    <div
      className={containerClassName}
      style={{ touchAction: 'none' }}
    >
      {className && <div className={className} />}

      <Canvas camera={{ position: cameraPosition, fov: 60 }} dpr={[1, 2]}>
        {fog && <fog attach="fog" args={[fog.color, fog.near, fog.far]} />}
        <WaveParticles
          effectStyle={effectStyle}
          colorPalette={colorPalette}
          particleType={particleType}
          particleCount={particleCount}
          particleSeparation={particleSeparation}
          parallaxX={parallaxX}
          parallaxY={parallaxY}
          parallaxBaseY={parallaxBaseY}
          randomness={randomness}
          speed={speed}
        />
      </Canvas>
    </div>
  );
};

export default AntigravityBackground;
