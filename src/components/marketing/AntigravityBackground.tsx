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

const styleToInt: Record<WaveStyle, number> = {
  classic: 0,
  ripples: 1,
  vortex: 2,
  matrix: 3,
  dome: 4,
  flat: 5,
  globe: 6,
  water_drop: 7,
  drifting_dust: 8,
  standing_ripple: 9,
};

const PARTICLE_VERTEX_SHADER = `
  #include <fog_pars_vertex>

  uniform float uTime;
  uniform int uEffectStyle;
  uniform float uParticleCount;
  uniform float uParticleSeparation;
  uniform float uRandomness;
  uniform vec2 uPointer;
  uniform float uRevealProgress;
  uniform int uInteractive;
  uniform float uMorphProgress;
  uniform vec3 uColors[10];
  uniform int uColorsLength;
  uniform vec3 uCameraPosition;
  uniform sampler2D uLandMask;
  uniform bool uHasLandMask;

  attribute vec2 aIxIy;
  attribute vec2 aRandom;
  attribute float aRevealThreshold;

  varying vec3 vColor;

  // Helper to rotate vector by quaternion
  vec3 rotateVectorByQuaternion(vec3 v, vec4 q) {
    return v + 2.0 * cross(q.xyz, cross(q.xyz, v) + q.w * v);
  }

  // Helper to interpolate between colors
  vec3 getInterpolatedColor(float normalizedY) {
    float segment = normalizedY * float(uColorsLength - 1);
    int index1 = int(floor(segment));
    int index2 = index1 + 1;
    if (index2 > uColorsLength - 1) {
      index2 = uColorsLength - 1;
    }
    float fraction = segment - float(index1);
    
    vec3 c1 = vec3(1.0);
    vec3 c2 = vec3(1.0);
    
    // Static loop for compatibility with WebGL 1 & 2
    for (int j = 0; j < 10; j++) {
      if (j == index1) c1 = uColors[j];
      if (j == index2) c2 = uColors[j];
    }
    return mix(c1, c2, fraction);
  }

  void main() {
    float ix = aIxIy.x;
    float iy = aIxIy.y;
    
    float randX = aRandom.x;
    float randZ = aRandom.y;
    
    float x = ix * uParticleSeparation - (uParticleCount * uParticleSeparation) / 2.0 + randX * uRandomness;
    float z = iy * uParticleSeparation - (uParticleCount * uParticleSeparation) / 2.0 + randZ * uRandomness;
    float y = 0.0;
    
    vec4 q = vec4(0.0, 0.0, 0.0, 1.0);
    float scale = 1.0;
    
    // 0: classic
    if (uEffectStyle == 0) {
      float wave1 = sin(ix * 0.2 + uTime * 1.2) * 1.5;
      float wave2 = sin(iy * 0.3 + uTime * 0.8) * 1.5;
      float wave3 = cos((ix + iy) * 0.1 + uTime * 0.5) * 1.0;
      y = wave1 + wave2 + wave3;
      scale = max(0.2, 1.0 + y * 0.15);
    }
    // 1: ripples
    else if (uEffectStyle == 1) {
      float distCenter = length(vec2(x, z));
      y = sin(distCenter * 0.5 - uTime * 3.0) * 2.0;
      scale = max(0.2, 1.0 + y * 0.15);
    }
    // 2: vortex
    else if (uEffectStyle == 2) {
      float distCenter = length(vec2(x, z));
      float angle = atan(z, x);
      float swirl = sin(angle * 4.0 + distCenter * 0.2 - uTime * 2.0) * 2.0;
      y = swirl + (distCenter * 0.1) - 2.0;
      scale = max(0.2, 1.0 + y * 0.15);
    }
    // 3: matrix
    else if (uEffectStyle == 3) {
      float wave1 = sin(ix * 0.4 + uTime * 2.0) * 1.5;
      float wave2 = cos(iy * 0.4 - uTime * 1.0) * 1.5;
      y = floor(wave1 + wave2 + 0.5);
      scale = max(0.2, 1.0 + y * 0.2);
    }
    // 4: dome
    else if (uEffectStyle == 4) {
      float distCenter = length(vec2(x, z));
      float dome = -pow(distCenter, 2.0) * 0.02 + 10.0;
      float breathe = sin(uTime * 1.5) * 2.0;
      float surfaceRipple = sin(distCenter * 0.4 - uTime) * 0.5;
      y = dome + breathe + surfaceRipple - 8.0;
      scale = max(0.2, 1.0 + y * 0.15);
    }
    // 5: flat
    else if (uEffectStyle == 5) {
      y = -2.0;
      scale = max(0.2, 1.0 + y * 0.15);
    }
    // 6: globe
    else if (uEffectStyle == 6) {
      float R = 15.0;
      float u = ix / (uParticleCount - 1.0);
      float v = iy / (uParticleCount - 1.0);
      
      float val_to_mod = sin(ix * 12.9898 + iy * 78.233) * 43758.5453;
      float noise = sign(val_to_mod) * fract(abs(val_to_mod));
      
      float rotationSpeed = uTime * 0.15;
      float theta = u * 3.14159265359 * 2.0 + rotationSpeed + noise * 0.02;
      float phi = v * 3.14159265359;
      
      x = R * sin(phi) * cos(theta);
      y = R * cos(phi);
      z = R * sin(phi) * sin(theta);
      
      if (uHasLandMask) {
        float maskVal = texture2D(uLandMask, vec2(u, 1.0 - v)).r;
        if (maskVal <= 0.0) {
          scale = 0.0;
        } else {
          scale = 0.4 + noise * 0.4;
          y += sin(uTime + ix * 0.5) * 0.15;
        }
      } else {
        scale = 0.4 + noise * 0.4;
      }
    }
    // 7: water_drop
    else if (uEffectStyle == 7) {
      float R_wd = 9.0;
      float idx = ix * uParticleCount + iy;
      float n = uParticleCount * uParticleCount;
      
      float phi = acos(1.0 - 2.0 * (idx + 0.5) / n);
      float theta = 3.14159265359 * (1.0 + sqrt(5.0)) * idx + uTime * 0.12;
      
      float rx = sin(phi) * cos(theta);
      float ry = cos(phi);
      float rz = sin(phi) * sin(theta);
      
      float breath = 1.0 + sin(uTime * 0.55) * 0.032;
      float slosh = sin(uTime * 0.82 + 0.4) * 0.042;
      float scaleY = breath * (1.0 + slosh);
      float scaleXZ = breath * (1.0 - slosh * 0.5);
      
      float ripple =
        sin(phi * 4.0 - uTime * 1.6) * 0.020 +
        sin(phi * 7.5 + uTime * 1.0) * 0.009 +
        cos(theta * 3.0 - uTime * 0.65) * 0.013;
        
      float rSurf = R_wd * (1.0 + ripple);
      
      x = rx * rSurf * scaleXZ;
      y = ry * rSurf * scaleY + sin(uTime * 0.38) * 0.9;
      z = rz * rSurf * scaleXZ;
      
      vec3 normal_wd = vec3(rx, ry, rz);
      vec3 up_wd = vec3(0.0, 1.0, 0.0);
      float dot_val_wd = dot(up_wd, normal_wd);
      if (dot_val_wd < -0.99999) {
        q = vec4(1.0, 0.0, 0.0, 0.0);
      } else {
        q = vec4(cross(up_wd, normal_wd), 1.0 + dot_val_wd);
        q = normalize(q);
      }
      
      float poleCapAngle = 0.4;
      float tN = min(1.0, phi / poleCapAngle);
      float tS = min(1.0, (3.14159265359 - phi) / poleCapAngle);
      float smN = tN * tN * (3.0 - 2.0 * tN);
      float smS = tS * tS * (3.0 - 2.0 * tS);
      float poleFade = sqrt(smN * smS);
      
      float cameraZ = uCameraPosition.z;
      float dotZ = rz * (cameraZ > 0.0 ? 1.0 : -1.0);
      float layerFade = max(0.0, min(1.0, (dotZ + 0.25) / 0.25));
      
      float rim = 1.0 + max(0.0, 0.3 - abs(dotZ)) * 0.5;
      
      float baseScale = uParticleCount < 35.0 ? 2.5 : 1.0;
      scale = baseScale * (0.30 + abs(ripple) * 4.5) * poleFade * layerFade * rim;
    }
    // 8: drifting_dust
    else if (uEffectStyle == 8) {
      float seed = sin(ix * 45.32 + iy * 89.21);
      float speedFactor = 0.3 + abs(seed) * 0.4;
      float heightRange = 36.0;
      float startY = -18.0;
      y = startY + mod(uTime * speedFactor + abs(seed) * heightRange, heightRange);
      
      float randShiftX = sin(ix * 12.9898 + iy * 78.233 + seed * 100.0);
      float randShiftZ = cos(ix * 39.346 + iy * 11.135 + seed * 100.0);
      x = (ix - uParticleCount / 2.0) * (uParticleSeparation * 1.5) + randShiftX * 3.0;
      z = (iy - uParticleCount / 2.0) * (uParticleSeparation * 1.5) + randShiftZ * 3.0;
      
      x += sin(uTime * 0.5 + seed * 10.0) * 2.0;
      z += cos(uTime * 0.4 + seed * 10.0) * 2.0;
      
      float distanceToEdge = min(y - startY, (startY + heightRange) - y);
      float fadeZone = 5.0;
      scale = max(0.0, min(1.0, distanceToEdge / fadeZone)) * (0.8 + abs(seed) * 0.6);
    }
    // 9: standing_ripple
    else if (uEffectStyle == 9) {
      x = ix * uParticleSeparation - (uParticleCount * uParticleSeparation) / 2.0;
      z = iy * uParticleSeparation - (uParticleCount * uParticleSeparation) / 2.0;
      
      float d = length(vec2(x, z));
      float waveFreq = 0.25;
      float waveSpeed = 1.2;
      float waveVal = cos(d * waveFreq - uTime * waveSpeed);
      y = waveVal * 1.5;
      
      if (d > 0.05) {
        vec3 dir = normalize(vec3(x, y, z));
        vec3 up = vec3(0.0, 1.0, 0.0);
        float dot_val = dot(up, dir);
        if (dot_val < -0.99999) {
          q = vec4(1.0, 0.0, 0.0, 0.0);
        } else {
          q = vec4(cross(up, dir), 1.0 + dot_val);
          q = normalize(q);
        }
      } else {
        q = vec4(0.0, 0.0, 0.0, 1.0);
      }
      
      float baseScale = uParticleCount < 35.0 ? 2.5 : 1.2;
      float maxRadius = (uParticleCount * uParticleSeparation) * 0.5;
      float centerRadius = 2.0;
      float centerFadeZone = 3.5;
      float edgeFadeZone = 6.0;
      
      float centerFade = max(0.0, min(1.0, (d - centerRadius) / centerFadeZone));
      float edgeFade = max(0.0, min(1.0, (maxRadius - d) / edgeFadeZone));
      scale = baseScale * centerFade * edgeFade;
    }
    
    // 10: Morphing ripples -> water_drop
    float idx = ix * uParticleCount + iy;
    if (uEffectStyle == 1 && uMorphProgress > 0.0) {
      float mp = uMorphProgress;
      float ease = mp < 0.5
        ? 4.0 * mp * mp * mp
        : 1.0 - pow(-2.0 * mp + 2.0, 3.0) / 2.0;
        
      float R_morph = 9.0;
      float n_morph = uParticleCount * uParticleCount;
      float gPhi = acos(1.0 - 2.0 * (idx + 0.5) / n_morph);
      float gTheta = 3.14159265359 * (1.0 + sqrt(5.0)) * idx + uTime * 0.12;
      
      float wRx = sin(gPhi) * cos(gTheta);
      float wRy = cos(gPhi);
      float wRz = sin(gPhi) * sin(gTheta);
      
      float breath_m = 1.0 + sin(uTime * 0.55) * 0.032;
      float slosh_m = sin(uTime * 0.82 + 0.4) * 0.042;
      float scaleY_m = breath_m * (1.0 + slosh_m);
      float scaleXZ_m = breath_m * (1.0 - slosh_m * 0.5);
      float ripple_m =
        sin(gPhi * 4.0 - uTime * 1.6) * 0.020 +
        sin(gPhi * 7.5 + uTime * 1.0) * 0.009 +
        cos(gTheta * 3.0 - uTime * 0.65) * 0.013;
      float rSurf_m = R_morph * (1.0 + ripple_m);
      
      float gX = wRx * rSurf_m * scaleXZ_m;
      float gY = wRy * rSurf_m * scaleY_m + sin(uTime * 0.38) * 0.9;
      float gZ = wRz * rSurf_m * scaleXZ_m;
      
      float pCap = 0.4;
      float tN = min(1.0, gPhi / pCap);
      float tS = min(1.0, (3.14159265359 - gPhi) / pCap);
      float pFade = sqrt((tN * tN * (3.0 - 2.0 * tN)) * (tS * tS * (3.0 - 2.0 * tS)));
      
      float newX = x + ease * (gX - x);
      float newY = y + ease * (gY - y);
      float newZ = z + ease * (gZ - z);
      
      float curRz = newZ / R_morph;
      float layerFade = max(0.0, min(1.0, (curRz + 0.25) / 0.25));
      float rim = 1.0 + max(0.0, 0.3 - abs(curRz)) * 0.5;
      
      x = newX; y = newY; z = newZ;
      scale = scale + ease * ((0.30 + abs(ripple_m) * 4.5) * pFade * layerFade * rim - scale);
      
      vec3 normal_m = vec3(wRx, wRy, wRz);
      vec3 up_m = vec3(0.0, 1.0, 0.0);
      float dot_val_m = dot(up_m, normal_m);
      vec4 q_target;
      if (dot_val_m < -0.99999) {
        q_target = vec4(1.0, 0.0, 0.0, 0.0);
      } else {
        q_target = vec4(cross(up_m, normal_m), 1.0 + dot_val_m);
        q_target = normalize(q_target);
      }
      q = normalize(mix(vec4(0.0, 0.0, 0.0, 1.0), q_target, ease));
    }
    
    // Pointer lift interaction
    bool isDropStyle = (uEffectStyle == 7) || (uEffectStyle == 1 && uMorphProgress > 0.0);
    if (!isDropStyle && uInteractive == 1 && uEffectStyle != 8 && uEffectStyle != 9) {
      float dist = length(vec2(x - uPointer.x, z - uPointer.y));
      y += max(0.0, 4.0 - dist) * 0.8;
    }
    
    // Color calculation
    float normalizedY = (y - (-2.5)) / (3.5 - (-2.5));
    if (uEffectStyle == 3) {
      normalizedY = (y - (-2.0)) / (3.0 - (-2.0));
    } else if (uEffectStyle == 6) {
      normalizedY = (y + 15.0) / 30.0;
    } else if (uEffectStyle == 7) {
      normalizedY = (y + 12.0) / 24.0;
    } else if (uEffectStyle == 8) {
      normalizedY = (y + 18.0) / 36.0;
    } else if (uEffectStyle == 9) {
      float d_sr = length(vec2(x, z));
      float waveFreq_sr = 0.25;
      float waveSpeed_sr = 1.2;
      float waveVal_sr = cos(d_sr * waveFreq_sr - uTime * waveSpeed_sr);
      normalizedY = waveVal_sr * 0.5 + 0.5;
    }
    normalizedY = max(0.0, min(1.0, normalizedY));
    vColor = getInterpolatedColor(normalizedY);
    
    // Staggered reveal progress
    float revealFade = 0.0;
    if (uRevealProgress >= aRevealThreshold) {
      revealFade = min(1.0, (uRevealProgress - aRevealThreshold) / 0.06);
    }
    scale *= revealFade;
    
    // Scale, rotate, translate geometry vertices
    vec3 scaledPosition = position * scale;
    vec3 transformedPosition = rotateVectorByQuaternion(scaledPosition, q);
    transformedPosition += vec3(x, y, z);
    
    vec4 mvPosition = modelViewMatrix * vec4(transformedPosition, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    
    #include <fog_vertex>
  }
`;

const PARTICLE_FRAGMENT_SHADER = `
  varying vec3 vColor;
  uniform float uOpacity;

  #include <fog_pars_fragment>

  void main() {
    gl_FragColor = vec4(vColor, uOpacity);
    #include <fog_fragment>
  }
`;

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
  const shaderMaterialRef = useRef<THREE.ShaderMaterial>(null);

  const colors = useMemo(() => colorPalette.map(c => new THREE.Color(c)), [colorPalette]);
  const colorArray = useMemo(() => {
    const arr = colors.map(c => new THREE.Vector3(c.r, c.g, c.b));
    while (arr.length < 10) {
      arr.push(new THREE.Vector3(1, 1, 1));
    }
    return arr;
  }, [colors]);

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
            mask[i] = pixels[i * 4] < 100 ? 255 : 0;
          }
          setLandMask(mask);
        }
      });
    }
  }, [effectStyle]);

  const landMaskTexture = useMemo(() => {
    if (!landMask) return null;
    const texture = new THREE.DataTexture(
      landMask,
      maskRes.w,
      maskRes.h,
      THREE.RedFormat,
      THREE.UnsignedByteType
    );
    texture.minFilter = THREE.NearestFilter;
    texture.magFilter = THREE.NearestFilter;
    texture.needsUpdate = true;
    return texture;
  }, [landMask]);

  // Initialize and update instanced geometry attributes
  useEffect(() => {
    if (!meshRef.current) return;
    const geom = meshRef.current.geometry;
    if (!geom) return;

    const ixIyArr = new Float32Array(numParticles * 2);
    const randomArr = new Float32Array(numParticles * 2);
    const revealThresholdArr = new Float32Array(numParticles);

    let i = 0;
    for (let ix = 0; ix < particleCount; ix++) {
      for (let iy = 0; iy < particleCount; iy++) {
        ixIyArr[i * 2] = ix;
        ixIyArr[i * 2 + 1] = iy;

        const randX = ((Math.sin(ix * 12.9898 + iy * 78.233) * 43758.5453) % 1) * 2 - 1;
        const randZ = ((Math.sin(ix * 39.346 + iy * 11.135) * 43758.5453) % 1) * 2 - 1;
        randomArr[i * 2] = randX;
        randomArr[i * 2 + 1] = randZ;

        revealThresholdArr[i] = particleRevealThresholds[i];
        i++;
      }
    }

    geom.setAttribute('aIxIy', new THREE.InstancedBufferAttribute(ixIyArr, 2));
    geom.setAttribute('aRandom', new THREE.InstancedBufferAttribute(randomArr, 2));
    geom.setAttribute('aRevealThreshold', new THREE.InstancedBufferAttribute(revealThresholdArr, 1));

    // Populate initial identity matrices for InstancedMesh to satisfy rendering pipeline
    const dummyMatrix = new THREE.Matrix4();
    for (let idx = 0; idx < numParticles; idx++) {
      meshRef.current.setMatrixAt(idx, dummyMatrix);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
  }, [meshRef.current, particleCount, particleType, numParticles, particleRevealThresholds]);

  const uniforms = useMemo(() => {
    const fogUniforms = THREE.UniformsUtils.clone(THREE.UniformsLib.fog);
    return {
      ...fogUniforms,
      uTime: { value: 0 },
      uEffectStyle: { value: styleToInt[effectStyle] },
      uParticleCount: { value: particleCount },
      uParticleSeparation: { value: particleSeparation },
      uRandomness: { value: randomness },
      uPointer: { value: new THREE.Vector2(0, 0) },
      uRevealProgress: { value: 0 },
      uInteractive: { value: interactive ? 1 : 0 },
      uMorphProgress: { value: 0 },
      uColors: { value: colorArray },
      uColorsLength: { value: colors.length },
      uCameraPosition: { value: new THREE.Vector3(0, 0, 0) },
      uLandMask: { value: landMaskTexture || new THREE.Texture() },
      uHasLandMask: { value: !!landMaskTexture },
      uOpacity: { value: 1.0 },
    };
  }, [effectStyle, particleCount, particleSeparation, randomness, interactive, colorArray, colors.length, landMaskTexture]);

  // Handle uniforms update when component props change dynamically
  useEffect(() => {
    if (shaderMaterialRef.current) {
      const matUniforms = shaderMaterialRef.current.uniforms;
      matUniforms.uEffectStyle.value = styleToInt[effectStyle];
      matUniforms.uParticleCount.value = particleCount;
      matUniforms.uParticleSeparation.value = particleSeparation;
      matUniforms.uRandomness.value = randomness;
      matUniforms.uInteractive.value = interactive ? 1 : 0;
      matUniforms.uColors.value = colorArray;
      matUniforms.uColorsLength.value = colors.length;
      matUniforms.uLandMask.value = landMaskTexture || new THREE.Texture();
      matUniforms.uHasLandMask.value = !!landMaskTexture;
    }
  }, [effectStyle, particleCount, particleSeparation, randomness, interactive, colorArray, colors.length, landMaskTexture]);

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

    if (shaderMaterialRef.current) {
      const matUniforms = shaderMaterialRef.current.uniforms;
      matUniforms.uTime.value = time;
      matUniforms.uPointer.value.set(pointerX, pointerY);
      matUniforms.uRevealProgress.value = revealProgress;
      matUniforms.uMorphProgress.value = morphProgressRef?.current ?? 0;
      matUniforms.uCameraPosition.value.copy(state.camera.position);
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
      <shaderMaterial
        ref={shaderMaterialRef}
        vertexShader={PARTICLE_VERTEX_SHADER}
        fragmentShader={PARTICLE_FRAGMENT_SHADER}
        uniforms={uniforms}
        transparent
        blending={THREE.NormalBlending}
        fog={true}
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
