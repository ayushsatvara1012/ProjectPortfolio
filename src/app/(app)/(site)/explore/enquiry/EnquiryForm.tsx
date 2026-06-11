'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useUser } from '@clerk/nextjs';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

type Phase = 'form' | 'pending' | 'approved';

/**
 * Explore access enquiry form (Explore §3, Phase B3b).
 *
 * Personal-email users can't self-serve the $0 Explore sub — they apply here.
 * Posts to `POST /api/explore/enquiry`; the backend classifies the domain,
 * stores a `pending` row (super-admin approves later), and rejects
 * disposable/invalid addresses (422). Honeypot `website` field traps bots.
 */
export default function EnquiryForm() {
  const { isLoaded, isSignedIn, user } = useUser();

  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [useCase, setUseCase] = useState('');
  const [website, setWebsite] = useState(''); // honeypot — must stay empty

  const [submitting, setSubmitting] = useState(false);
  const [phase, setPhase] = useState<Phase>('form');
  const [error, setError] = useState<string | null>(null);

  // Prefill from the signed-in Clerk profile (best-effort; fields stay editable).
  useEffect(() => {
    if (!isLoaded || !isSignedIn || !user) return;
    const primary = user.primaryEmailAddress?.emailAddress;
    if (primary) setEmail(prev => prev || primary);
    const full = user.fullName || [user.firstName, user.lastName].filter(Boolean).join(' ');
    if (full) setName(prev => prev || full);
  }, [isLoaded, isSignedIn, user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/api/explore/enquiry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          name: name.trim() || null,
          company_name: companyName.trim() || null,
          use_case: useCase.trim() || null,
          website, // honeypot
        }),
      });

      if (res.status === 429) {
        setError("You're sending requests a little too fast. Please wait a minute and try again.");
        return;
      }
      if (res.status === 422) {
        setError('Please use a valid, non-disposable email address.');
        return;
      }

      let data: { status?: string; message?: string } = {};
      try {
        data = await res.json();
      } catch {
        /* non-JSON body */
      }

      if (!res.ok) {
        setError(data.message || 'Something went wrong. Please try again in a moment.');
        return;
      }

      if (data.status === 'approved') {
        setPhase('approved');
      } else {
        // 'pending' (and any future success status) → under review.
        setPhase('pending');
      }
    } catch {
      setError('Network error — please check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass =
    'bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-base font-google text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 dark:focus:border-blue-500 outline-none transition-all duration-200 w-full';
  const labelClass = 'text-sm font-google font-medium text-slate-700 dark:text-slate-300';

  return (
    <section className="relative w-full bg-white dark:bg-slate-950 py-24 sm:py-32 overflow-x-clip transition-colors duration-500">
      {/* Ambient glows */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-blue-500/5 dark:bg-blue-600/10 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-indigo-500/5 dark:bg-indigo-600/10 blur-[120px] rounded-full pointer-events-none" />

      <div className="max-w-2xl mx-auto px-6 sm:px-8 relative z-10">
        {/* HEADER */}
        <div className="mb-10 text-center">
          <div className="inline-flex items-center gap-2 text-sm uppercase tracking-widest font-bold font-google text-slate-400 dark:text-slate-500 mb-4">
            <span className="material-symbols-outlined text-[16px] text-blue-500">explore</span>
            <span>Explore — Request Access</span>
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-google font-medium tracking-tight leading-tight text-slate-900 dark:text-slate-200 mb-4">
            Tell us about your business
          </h1>
          <p className="text-base md:text-lg font-google text-slate-500 dark:text-slate-400 max-w-lg mx-auto leading-relaxed">
            Explore is free, forever — and built for real businesses. Sign-ups from a business domain get
            instant access; if you’re using a personal email, just share a little about what you’re building
            and we’ll approve you, usually within 24 hours.
          </p>
        </div>

        {/* CARD */}
        <div className="rounded-3xl border border-slate-200 dark:border-slate-800/60 bg-white dark:bg-slate-950 p-5 sm:p-8 lg:p-10 shadow-[0_8px_30px_rgba(0,0,0,0.04)] dark:shadow-none transition-all duration-300">
          {phase === 'form' && (
            <form onSubmit={handleSubmit} className="space-y-6" noValidate>
              {/* Honeypot — visually hidden, off-screen, not announced, not tabbable. */}
              <div aria-hidden="true" className="absolute -left-[9999px] top-0 h-0 w-0 overflow-hidden">
                <label htmlFor="website">Leave this field empty</label>
                <input
                  id="website"
                  name="website"
                  type="text"
                  tabIndex={-1}
                  autoComplete="off"
                  value={website}
                  onChange={e => setWebsite(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="name" className={labelClass}>Your name</label>
                  <input
                    id="name" type="text" value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Jane Doe" className={inputClass}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="email" className={labelClass}>Email <span className="text-blue-500">*</span></label>
                  <input
                    id="email" type="email" required value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@company.com" className={inputClass}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="company" className={labelClass}>Company / brand</label>
                <input
                  id="company" type="text" value={companyName}
                  onChange={e => setCompanyName(e.target.value)}
                  placeholder="Acme Inc." className={inputClass}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="usecase" className={labelClass}>What will you build with Vaayu?</label>
                <textarea
                  id="usecase" rows={4} value={useCase}
                  onChange={e => setUseCase(e.target.value)}
                  placeholder="e.g. a support bot for our e-commerce store, trained on our help docs…"
                  className={`${inputClass} resize-none`}
                  maxLength={1000}
                />
              </div>

              {error && (
                <div
                  role="alert"
                  className="flex items-start gap-2 rounded-xl border border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-950/20 px-4 py-3 text-sm font-google text-red-700 dark:text-red-300"
                >
                  <span className="material-symbols-outlined text-[18px] shrink-0">error</span>
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-slate-900 dark:bg-white px-8 py-4 text-base font-google font-medium text-white dark:text-slate-900 transition-all duration-200 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? (
                  <>
                    <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
                    Submitting…
                  </>
                ) : (
                  <>
                    Request access
                    <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                  </>
                )}
              </button>

              <p className="text-xs font-google text-slate-400 dark:text-slate-500 text-center">
                No credit card, ever. We’ll email you the moment your access is approved.
              </p>
            </form>
          )}

          {phase === 'pending' && (
            <Confirmation
              icon="mark_email_read"
              title="Request received 🎉"
              body="Thanks! Your Explore access request is under review. We’ll email you the moment it’s approved — usually within 24 hours."
            />
          )}

          {phase === 'approved' && (
            <Confirmation
              icon="verified"
              title="You’re already approved!"
              body="Good news — this email is already approved for Explore. Sign in to jump straight into your dashboard."
              cta={{ href: '/sign-in', label: 'Sign in' }}
            />
          )}
        </div>

        <p className="mt-6 text-center text-sm font-google text-slate-500 dark:text-slate-400">
          Have a business email?{' '}
          <Link href="/pricing" className="font-medium text-blue-600 dark:text-blue-400 hover:underline">
            See all plans
          </Link>
        </p>
      </div>
    </section>
  );
}

function Confirmation({
  icon, title, body, cta,
}: {
  icon: string;
  title: string;
  body: string;
  cta?: { href: string; label: string };
}) {
  return (
    <div className="flex flex-col items-center text-center py-6">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/40 mb-6">
        <span className="material-symbols-outlined text-[30px] text-blue-600 dark:text-blue-400">{icon}</span>
      </div>
      <h2 className="text-2xl font-google font-medium text-slate-900 dark:text-slate-100 mb-3">{title}</h2>
      <p className="max-w-md text-base font-google text-slate-500 dark:text-slate-400 leading-relaxed mb-8">{body}</p>
      {cta ? (
        <Link
          href={cta.href}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-slate-900 dark:bg-white px-8 py-3.5 text-base font-google font-medium text-white dark:text-slate-900 transition-all duration-200 hover:opacity-90"
        >
          {cta.label}
          <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
        </Link>
      ) : (
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm font-google font-medium text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
        >
          <span className="material-symbols-outlined text-[16px]">home</span>
          Back to home
        </Link>
      )}
    </div>
  );
}
