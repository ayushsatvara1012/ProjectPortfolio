import React from 'react';

/* Animated mesh gradient: a few soft radial-gradient blobs drifting behind a
   film-grain overlay. Server Component — no JS ships for it, the motion is
   pure CSS (see globals.css) and pauses under prefers-reduced-motion there.

   Weighs nothing: no image download, no canvas, no WebGL. Decorative only. */
export default function MeshGradientBackground({ className = '' }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
    >
      <div className="mesh-blob mesh-blob--a" />
      <div className="mesh-blob mesh-blob--b" />
      <div className="mesh-blob mesh-blob--c" />
      <div className="mesh-grain" />
    </div>
  );
}
