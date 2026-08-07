'use client';

import React from 'react';
import HeroHorizonCanvas from './HeroHorizonCanvas';

export default function HeroHorizonField({ className = '' }: { className?: string }) {
  return <HeroHorizonCanvas className={className} />;
}
