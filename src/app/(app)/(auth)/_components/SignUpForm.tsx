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

function LegalConsentCheckbox({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-2.5 text-[12.5px] text-slate-500 dark:text-slate-400">
      <input
        type="checkbox"
        required
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-2 focus:ring-blue-500/30 focus:ring-offset-0"
      />
      <span>
        I agree to the{' '}
        <a href="/terms-and-conditions" target="_blank" rel="noopener noreferrer" className={linkCls}>Terms of Service</a>
        {' '}and{' '}
        <a href="/privacy-policy" target="_blank" rel="noopener noreferrer" className={linkCls}>Privacy Policy</a>
      </span>
    </label>
  );
}

export default function SignUpForm() {
  const { isLoaded, signUp, setActive } = useSignUp();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [legalAccepted, setLegalAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Google OAuth resumes here (via continueSignUpUrl on /sso-callback) when Clerk's
  // legal-consent requirement wasn't satisfied by the redirect itself — that attempt
  // already has an email address, it's just waiting on legalAccepted.
  const resumingOAuth =
    isLoaded && signUp.status === 'missing_requirements' && signUp.missingFields.includes('legal_accepted');

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
      const res = await signUp.create({ emailAddress: email, password, legalAccepted });
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

  /* ── Resumed Google sign-up: just needs legal consent to finish ─────────── */
  async function completeOAuthSignUp(e: React.FormEvent) {
    e.preventDefault();
    if (!isLoaded || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await signUp.update({ legalAccepted: true });
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

  /* ── Resumed-OAuth screen: consent only, email/password already came from Google ── */
  if (resumingOAuth) {
    return (
      <div className={card}>
        <BrandHeader title="Almost done" subtitle={signUp.emailAddress ?? 'Just one more step'} />
        {errorBanner}
        <form onSubmit={completeOAuthSignUp} className="space-y-4">
          <LegalConsentCheckbox checked={legalAccepted} onChange={setLegalAccepted} />
          <button type="submit" className={btnPrimary} disabled={busy || !legalAccepted}>
            {busy && <Spinner />}
            Complete sign up
          </button>
        </form>
      </div>
    );
  }

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

        <LegalConsentCheckbox checked={legalAccepted} onChange={setLegalAccepted} />

        {/* Clerk Smart CAPTCHA / bot-protection mount point */}
        <div id="clerk-captcha" className="empty:hidden" />

        <button type="submit" className={btnPrimary} disabled={busy || !isLoaded || !legalAccepted}>
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
