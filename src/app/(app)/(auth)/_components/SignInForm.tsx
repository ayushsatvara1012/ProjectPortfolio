'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSignIn } from '@clerk/nextjs/legacy';
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

const AFTER_SIGN_IN = process.env.NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL || '/dashboard';

/** Pull a human message out of a Clerk error (or anything else). */
function clerkMessage(err: unknown, fallback = 'Something went wrong. Please try again.') {
  if (isClerkAPIResponseError(err)) {
    return err.errors[0]?.longMessage || err.errors[0]?.message || fallback;
  }
  return fallback;
}

type Mode = 'password' | 'forgot' | 'reset';

export default function SignInForm() {
  const { isLoaded, signIn, setActive } = useSignIn();
  const router = useRouter();

  const [mode, setMode] = useState<Mode>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* ── Google OAuth ──────────────────────────────────────────────────────── */
  async function signInWithGoogle() {
    if (!isLoaded) return;
    setError(null);
    try {
      await signIn.authenticateWithRedirect({
        strategy: 'oauth_google',
        redirectUrl: '/sso-callback',
        redirectUrlComplete: AFTER_SIGN_IN,
      });
    } catch (err) {
      setError(clerkMessage(err));
    }
  }

  /* ── Email + password ──────────────────────────────────────────────────── */
  async function submitPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!isLoaded || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await signIn.create({ identifier: email, password });
      if (res.status === 'complete') {
        await setActive({ session: res.createdSessionId });
        router.push(AFTER_SIGN_IN);
      } else {
        setError('Additional verification is required to sign in.');
      }
    } catch (err) {
      setError(clerkMessage(err, 'Incorrect email or password.'));
    } finally {
      setBusy(false);
    }
  }

  /* ── Forgot password: send reset code ──────────────────────────────────── */
  async function sendResetCode(e: React.FormEvent) {
    e.preventDefault();
    if (!isLoaded || busy) return;
    setBusy(true);
    setError(null);
    try {
      await signIn.create({ strategy: 'reset_password_email_code', identifier: email });
      setMode('reset');
    } catch (err) {
      setError(clerkMessage(err, "We couldn't send a reset code to that email."));
    } finally {
      setBusy(false);
    }
  }

  /* ── Reset password: verify code + set new password ────────────────────── */
  async function resetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!isLoaded || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await signIn.attemptFirstFactor({
        strategy: 'reset_password_email_code',
        code,
        password: newPassword,
      });
      if (res.status === 'complete') {
        await setActive({ session: res.createdSessionId });
        router.push(AFTER_SIGN_IN);
      } else {
        setError('Could not reset password. Please try again.');
      }
    } catch (err) {
      setError(clerkMessage(err, 'Invalid or expired code.'));
    } finally {
      setBusy(false);
    }
  }

  const errorBanner = error && (
    <div className="mb-4 rounded-lg bg-rose-50 dark:bg-rose-950/40 px-3 py-2 text-[12.5px] font-medium text-rose-600 dark:text-rose-400">
      {error}
    </div>
  );

  /* ── Forgot-password screen ────────────────────────────────────────────── */
  if (mode === 'forgot') {
    return (
      <div className={card}>
        <BrandHeader title="Reset your password" subtitle="We'll email you a reset code" />
        {errorBanner}
        <form onSubmit={sendResetCode} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="reset-email" className={labelCls}>Email</label>
            <input
              id="reset-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              className={inputCls}
            />
          </div>
          <button type="submit" className={btnPrimary} disabled={busy || !isLoaded}>
            {busy && <Spinner />}
            Send reset code
          </button>
        </form>
        <button
          type="button"
          onClick={() => { setMode('password'); setError(null); }}
          className="mt-6 mx-auto block text-[13px] text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
        >
          ← Back to sign in
        </button>
      </div>
    );
  }

  /* ── Reset-password screen ─────────────────────────────────────────────── */
  if (mode === 'reset') {
    return (
      <div className={card}>
        <BrandHeader title="Choose a new password" subtitle="Enter the code we emailed and a new password" />
        {errorBanner}
        <form onSubmit={resetPassword} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="reset-code" className={labelCls}>Reset code</label>
            <input
              id="reset-code"
              inputMode="numeric"
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className={`${inputCls} text-center tracking-[0.4em] font-semibold`}
              placeholder="······"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="reset-new-pw" className={labelCls}>New password</label>
            <PasswordInput
              id="reset-new-pw"
              autoComplete="new-password"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>
          <button type="submit" className={btnPrimary} disabled={busy || !isLoaded}>
            {busy && <Spinner />}
            Update password
          </button>
        </form>
      </div>
    );
  }

  /* ── Default: password sign-in ─────────────────────────────────────────── */
  return (
    <div className={card}>
      <BrandHeader title="Welcome back" subtitle="Sign in to your Sapybase account" />
      {errorBanner}

      <button type="button" onClick={signInWithGoogle} className={btnSocial} disabled={!isLoaded}>
        <GoogleIcon />
        Continue with Google
      </button>

      <OrDivider />

      <form onSubmit={submitPassword} className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="email" className={labelCls}>Email</label>
          <input
            id="email"
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
          <div className="flex items-center justify-between">
            <label htmlFor="password" className={labelCls}>Password</label>
            <button
              type="button"
              onClick={() => { setMode('forgot'); setError(null); }}
              className={`text-[12px] ${linkCls}`}
            >
              Forgot password?
            </button>
          </div>
          <PasswordInput
            id="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
        </div>

        <button type="submit" className={btnPrimary} disabled={busy || !isLoaded}>
          {busy && <Spinner />}
          Sign in
        </button>
      </form>

      <p className="mt-6 text-center text-[13px] text-slate-500 dark:text-slate-400">
        Don&apos;t have an account?{' '}
        <Link href="/sign-up" className={linkCls}>Sign up</Link>
      </p>
    </div>
  );
}
