'use client';

import React from 'react';
import Link from 'next/link';
import { ExperimentIcon } from '../icons';

export function DemoButton() {
  return (
    <Link
      href="/demo/train"
      className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-8 py-4 text-lg font-google text-amber-700 dark:text-yellow-400 hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors rounded-full flex items-center justify-center gap-1"
    >
      Try Demo
      <ExperimentIcon size={30} />
    </Link>
  );
}
