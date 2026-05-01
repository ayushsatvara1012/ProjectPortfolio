'use client';

import { useState, useEffect, useRef, useMemo } from 'react';

const InteractiveSchematic = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mouseRef = useRef({ active: false, x: 0, y: 0, w: 1, h: 1 });
  const timeRef = useRef(0);
  const positionsRef = useRef<number[]>([]);

  const dotsConfig = useMemo(() => [
    { id: 1, isX: false, linePos: '8%', offset: 0.1, speed: 0.1, color: 'fill-indigo-500', r: 2.5 },
    { id: 2, isX: false, linePos: '35%', offset: 0.4, speed: 0.15, color: 'fill-blue-500', r: 2.5 },
    { id: 3, isX: true, linePos: '15%', offset: 0.7, speed: 0.12, color: 'fill-emerald-500', r: 3 },
    { id: 4, isX: true, linePos: '85%', offset: 0.2, speed: 0.18, color: 'fill-violet-500', r: 2.5 },
    { id: 5, isX: false, linePos: '70%', offset: 0.5, speed: 0.14, color: 'fill-amber-500', r: 3 },
    { id: 6, isX: true, linePos: '40%', offset: 0.8, speed: 0.16, color: 'fill-rose-500', r: 2.5 },
    { id: 7, isX: false, linePos: '85%', offset: 0.3, speed: 0.11, color: 'fill-cyan-500', r: 2 },
    { id: 8, isX: true, linePos: '65%', offset: 0.9, speed: 0.13, color: 'fill-fuchsia-500', r: 2.5 },
    { id: 9, isX: false, linePos: '8%', offset: 0.6, speed: 0.17, color: 'fill-teal-500', r: 2 },
    { id: 10, isX: true, linePos: '15%', offset: 0.05, speed: 0.19, color: 'fill-orange-500', r: 2 },
    { id: 11, isX: false, linePos: '70%', offset: 0.25, speed: 0.13, color: 'fill-sky-500', r: 2 },
    { id: 12, isX: true, linePos: '85%', offset: 0.55, speed: 0.16, color: 'fill-pink-500', r: 3 },
  ], []);

  const [dotsData, setDotsData] = useState(dotsConfig.map(d => ({ ...d, pos: 0 })));

  useEffect(() => {
    positionsRef.current = dotsConfig.map(d => d.offset);
    let frame: number;

    const loop = () => {
      timeRef.current += 0.01;

      const newPos = dotsConfig.map((dot, i) => {
        const baseAbsolute = timeRef.current * dot.speed + dot.offset;
        const localBase = baseAbsolute % 1;
        let targetAbsolute = baseAbsolute;

        const m = mouseRef.current;
        if (m.active && m.w > 0) {
          const mouseLocal = dot.isX ? m.x / m.w : m.y / m.h;
          const dist = Math.abs(mouseLocal - localBase);
          if (dist < 0.2) {
            const pullFactor = 1 - dist / 0.2;
            targetAbsolute = baseAbsolute + (mouseLocal - localBase) * pullFactor * 0.9;
          }
        }

        positionsRef.current[i] += (targetAbsolute - positionsRef.current[i]) * 0.1;
        return { ...dot, pos: ((positionsRef.current[i] % 1) + 1) % 1 };
      });

      setDotsData(newPos);
      frame = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(frame);
  }, [dotsConfig]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    mouseRef.current = { active: true, x: e.clientX - rect.left, y: e.clientY - rect.top, w: rect.width, h: rect.height };
  };

  const handleMouseLeave = () => { mouseRef.current.active = false; };

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 z-0 overflow-hidden"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <svg className="w-full h-full pointer-events-none" xmlns="http://www.w3.org/2000/svg">
        <line x1="8%" y1="0" x2="8%" y2="100%" className="stroke-slate-200 dark:stroke-slate-800 stroke-[1px] transition-colors" />
        <line x1="35%" y1="0" x2="35%" y2="100%" className="stroke-slate-200 dark:stroke-slate-800 stroke-[1px] transition-colors" />
        <line x1="0" y1="15%" x2="100%" y2="15%" className="stroke-slate-200 dark:stroke-slate-800 stroke-[1px] transition-colors" />
        <line x1="0" y1="85%" x2="100%" y2="85%" className="stroke-slate-200 dark:stroke-slate-800 stroke-[1px] transition-colors" />
        <line x1="70%" y1="15%" x2="70%" y2="100%" className="stroke-slate-200 dark:stroke-slate-800 stroke-[1px] transition-colors" />
        <line x1="85%" y1="15%" x2="85%" y2="100%" className="stroke-slate-200 dark:stroke-slate-800 stroke-[1px] transition-colors" />
        <line x1="70%" y1="40%" x2="100%" y2="40%" className="stroke-slate-200 dark:stroke-slate-800 stroke-[1px] transition-colors" />
        <line x1="70%" y1="65%" x2="100%" y2="65%" className="stroke-slate-200 dark:stroke-slate-800 stroke-[1px] transition-colors" />
        <g className="stroke-slate-300 dark:stroke-slate-700 stroke-[1px] transition-colors">
          <line x1="7.5%" y1="15%" x2="8.5%" y2="15%" />
          <line x1="8%" y1="13%" x2="8%" y2="17%" />
          <line x1="34.5%" y1="50%" x2="35.5%" y2="50%" />
          <line x1="35%" y1="48%" x2="35%" y2="52%" />
        </g>
        {dotsData.map((d, i) => (
          <circle
            key={i}
            cx={d.isX ? `${d.pos * 100}%` : d.linePos}
            cy={d.isX ? d.linePos : `${d.pos * 100}%`}
            r={d.r}
            className={d.color}
          />
        ))}
      </svg>
    </div>
  );
};

export default InteractiveSchematic;
