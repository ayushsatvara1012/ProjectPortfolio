'use client';

import React from 'react';
import { useUser, useClerk } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';

/**
 * GetVaayuButton — primary CTA used on the /vaayu hero and closing band.
 * Mirrors the homepage hero behaviour: signed-in → dashboard, else → sign-up.
 */
export default function GetVaayuButton({
  label = 'Get Vaayu',
  variant = 'solid',
}: {
  label?: string;
  variant?: 'solid' | 'invert';
}) {
  const router = useRouter();
  const { isSignedIn } = useUser();
  const { openSignUp } = useClerk();

  const base =
    'group inline-flex items-center justify-center gap-2 px-8 py-4 text-lg font-google font-medium rounded-full transition-colors cursor-pointer';
  const styles =
    variant === 'invert'
      ? 'bg-white text-slate-900 hover:bg-slate-100'
      : 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100';

  return (
    <button
      onClick={() => (isSignedIn ? router.push('/dashboard') : openSignUp())}
      className={`${base} ${styles}`}
    >
      {label}
      <span className="material-symbols-outlined transition-transform group-hover:translate-x-1">arrow_forward</span>
    </button>
  );
}
