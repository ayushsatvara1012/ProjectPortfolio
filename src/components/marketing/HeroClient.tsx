'use client';

import React from 'react';
import Link from 'next/link';
import { SignUpButton } from '@clerk/nextjs';
import { ExperimentIcon, ArrowRightIcon } from '../icons';

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

export function GetStartedButton() {
  return (
    <SignUpButton mode="redirect">
      <button className="overflow-hidden relative bg-slate-900 dark:bg-slate-900 text-lg font-google text-white border-none font-medium cursor-pointer z-10 group flex items-center justify-center gap-2 px-8 py-4 rounded-full border border-slate-200/50 dark:border-slate-800">
        Get Started
        <span>
          <ArrowRightIcon size={20} className="shrink-0" />
        </span>

        <span className="absolute w-40 h-32 -top-14 -left-2 bg-blue-200 rotate-12 transform scale-x-0 group-hover:scale-x-150 transition-transform group-hover:duration-500 duration-1000 origin-left" />
        <span className="absolute w-40 h-36 -top-15 -left-2 bg-blue-600 rotate-12 transform scale-x-0 group-hover:scale-x-[120%] transition-transform group-hover:duration-700 duration-700 origin-left" />
        <span className="absolute w-36 h-32 -top-8 -left-2 bg-blue-800 rotate-12 transform scale-x-0 group-hover:scale-x-75 transition-transform group-hover:duration-1000 duration-500 origin-left" />
        <span aria-hidden="true" className="group-hover:opacity-100 group-hover:duration-1000 duration-100 opacity-0 absolute left-6 z-10 whitespace-nowrap">Explore Now !</span>
      </button>
    </SignUpButton>
  );
}
