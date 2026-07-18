'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSignUp } from '@clerk/nextjs/legacy';
import { isClerkAPIResponseError } from '@clerk/nextjs/errors';

import {
  BrandHeader,
  GoogleIcon,
  OrDivider,
  Spinner,
  btnPrimary,
  btnSocial,
  card,
  inputCls,
  labelCls,
  linkCls,
  PasswordInput,
} from './auth-ui';

const AFTER_SIGN_UP = process.env.NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL || '/dashboard';

function clerkMessage(err: unknown, fallback = 'Something went wrong. Please try again.') {
  if (isClerkAPIResponseError(err)) {
    return err.errors[0]?.longMessage || err.errors[0]?.message || fallback;
  }
  return fallback;
}

export default function SignUpForm() {
  const { isLoaded, signUp, setActive } = useSignUp();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* ── Google OAuth ──────────────────────────────────────────────────────── */
  async function signUpWithGoogle() {
    if (!isLoaded) return;
    setError(null);
    try {
      await signUp.authenticateWithRedirect({
        strategy: 'oauth_google',
        redirectUrl: '/sso-callback',
        redirectUrlComplete: AFTER_SIGN_UP,
      });
    } catch (err) {
      setError(clerkMessage(err));
    }
  }

  /* ── Create account → session goes live immediately, no email verification ── */
  async function createAccount(e: React.FormEvent) {
    e.preventDefault();
    if (!isLoaded || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await signUp.create({ emailAddress: email, password });
      if (res.status === 'complete') {
        await setActive({ session: res.createdSessionId });
        router.push(AFTER_SIGN_UP);
      } else {
        setError('Unable to complete sign up. Please try again.');
      }
    } catch (err) {
      setError(clerkMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const errorBanner = error && (
    <div className="mb-4 rounded-lg bg-rose-50 dark:bg-rose-950/40 px-3 py-2 text-[12.5px] font-medium text-rose-600 dark:text-rose-400">
      {error}
    </div>
  );

  /* ── Create-account screen ─────────────────────────────────────────────── */
  return (
    <div className={card}>
      <BrandHeader title="Create your account" subtitle="Start building with Sapybase" />
      {errorBanner}

      <button type="button" onClick={signUpWithGoogle} className={btnSocial} disabled={!isLoaded}>
        <GoogleIcon />
        Continue with Google
      </button>

      <OrDivider />

      <form onSubmit={createAccount} className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="su-email" className={labelCls}>Email</label>
          <input
            id="su-email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            className={inputCls}
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="su-password" className={labelCls}>Password</label>
          <PasswordInput
            id="su-password"
            autoComplete="new-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
        </div>

        {/* Clerk Smart CAPTCHA / bot-protection mount point */}
        <div id="clerk-captcha" className="empty:hidden" />

        <button type="submit" className={btnPrimary} disabled={busy || !isLoaded}>
          {busy && <Spinner />}
          Create account
        </button>
      </form>

      <p className="mt-6 text-center text-[13px] text-slate-500 dark:text-slate-400">
        Already have an account?{' '}
        <Link href="/sign-in" className={linkCls}>Sign in</Link>
      </p>
    </div>
  );
}
