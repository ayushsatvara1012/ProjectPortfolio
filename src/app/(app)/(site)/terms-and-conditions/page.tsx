import React from 'react';
import { Gavel, AlertCircle, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

import type { Metadata } from 'next';
import { buildMetadata } from '@/src/seo/buildMetadata';

export const metadata: Metadata = buildMetadata('terms');

const LAST_UPDATED = 'June 5, 2026';
const CONTACT_EMAIL = 'ayushsatvara2002@gmail.com';

const Section = ({ num, title, children }: { num: string; title: string; children: React.ReactNode }) => (
  <section>
    <h2 className="text-2xl md:text-3xl font-display font-bold tracking-tight text-slate-900 dark:text-white mb-4 flex items-center gap-3 transition-colors">
      <span className="w-10 h-10 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center text-emerald-600 dark:text-emerald-500 text-base font-bold font-sans transition-colors">
        {num}
      </span>
      {title}
    </h2>
    <div className="text-base text-slate-600 dark:text-slate-400 leading-relaxed transition-colors space-y-3">
      {children}
    </div>
  </section>
);

export default function TermsAndConditionsPage() {
  return (
    <div className="min-h-screen bg-[#FAFAFA] dark:bg-slate-950 text-slate-600 dark:text-slate-300 pt-32 pb-20 px-6 transition-colors duration-500">
      <div className="max-w-4xl mx-auto">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors mb-12 group"
        >
          <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
          Back to Home
        </Link>

        <header className="mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[10px] uppercase tracking-widest font-bold font-sans mb-6 transition-colors">
            <Gavel size={14} />
            Service Agreement
          </div>
          <h1 className="text-3xl md:text-4xl font-display font-black tracking-tight leading-none text-slate-900 dark:text-white mb-6 transition-colors">
            Terms &amp; Conditions
          </h1>
          <p className="text-sm text-slate-500 font-medium transition-colors">
            Last Updated: {LAST_UPDATED}
          </p>
        </header>

        <div className="space-y-12">

          <Section num="01" title="Agreement to Terms">
            <p>
              By creating an account or using any part of the Sapybase platform (&ldquo;Service&rdquo;), you agree to be
              bound by these Terms &amp; Conditions. If you do not agree, do not use the Service.
            </p>
            <p>
              Sapybase is operated by Ayush Satvara, based in Jersey City, New Jersey, United States
              (&ldquo;we&rdquo;, &ldquo;us&rdquo;, &ldquo;our&rdquo;). &ldquo;You&rdquo; refers to the individual or business that
              created a Sapybase account.
            </p>
          </Section>

          <Section num="02" title="The Service">
            <p>
              Sapybase is a SaaS platform that lets you create, train, and deploy AI-powered chatbots on your
              website or app and — on higher plans — capture and score leads, hand conversations off to human
              agents, and access business-intelligence analytics such as ROI, conversion funnel, and lead-source
              attribution. Features available to you depend on your subscription plan. Current plan details
              and pricing are published at{' '}
              <Link href="/pricing" className="text-indigo-600 dark:text-indigo-400 underline">
                Sapybase.com/pricing
              </Link>.
            </p>
            <p>
              We reserve the right to modify, suspend, or discontinue any feature of the Service at any time
              with reasonable notice. We will not reduce core functionality of a paid plan without providing
              at least 30 days&apos; notice by email.
            </p>
          </Section>

          <Section num="03" title="Subscriptions and Billing">
            <p>
              Paid plans (Starter, Growth, Scale) are billed monthly or annually in advance via Polar,
              our payment processor. Prices are listed in USD and INR on our pricing page. Local taxes may
              apply and are calculated at checkout.
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong>Upgrades</strong> take effect immediately. You are charged a pro-rated amount for the
                remainder of the current billing period.
              </li>
              <li>
                <strong>Downgrades</strong> take effect at the end of your current billing period. You retain
                access to your current plan&apos;s features until then.
              </li>
              <li>
                <strong>Cancellation</strong> can be done at any time from your dashboard. Access continues
                until the end of the paid billing period. No further charges are made after cancellation.
              </li>
              <li>
                <strong>Plan limits</strong> (bots, messages per month, knowledge chunks) are enforced
                per-bot as described on the pricing page. Exceeding your message quota suspends chat
                responses for that bot until the next billing cycle.
              </li>
              <li>
                <strong>Annual billing</strong> is available on the Starter, Growth, and Scale plans and includes
                two months free compared with paying monthly. You can switch between monthly and annual billing
                using the toggle on the{' '}
                <Link href="/pricing" className="text-indigo-600 dark:text-indigo-400 underline">
                  pricing page
                </Link>.
              </li>
            </ul>
          </Section>

          <Section num="04" title="Refund Policy">
            <p>
              We want you to be satisfied with Sapybase. If you experience an issue with the Service, you
              may request a refund by emailing{' '}
              <a
                href={`mailto:${CONTACT_EMAIL}?subject=Refund%20Request`}
                className="text-indigo-600 dark:text-indigo-400 underline"
              >
                {CONTACT_EMAIL}
              </a>{' '}
              with the subject line &ldquo;Refund Request&rdquo; within <strong>12 days of the payment date</strong>.
            </p>
            <p>
              Your email must include:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>A description of the issue you experienced.</li>
              <li>Supporting evidence (screenshots, error messages, or relevant details).</li>
              <li>The email address associated with your Sapybase account.</li>
            </ul>
            <p>
              We review each request individually and will respond within 5 business days. Refunds granted
              are processed back to your original payment method via Polar and may take 5–10 business days
              to appear.
            </p>
            <p>
              Refund requests submitted more than 12 days after the payment date, or requests without
              supporting evidence, are not eligible. Abuse of the refund policy (repeated refund requests
              across billing cycles) may result in account suspension.
            </p>
          </Section>

          <Section num="05" title="Acceptable Use">
            <p>You agree not to use Sapybase to:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Violate any applicable law or regulation.</li>
              <li>Distribute spam, malware, or unsolicited commercial communications.</li>
              <li>Harass, threaten, or deceive end-users of your bots.</li>
              <li>Impersonate another person or entity.</li>
              <li>Attempt to reverse-engineer, scrape, or extract our AI models or infrastructure.</li>
              <li>Deliberately circumvent plan limits, rate limits, or billing enforcement.</li>
              <li>Train bots on content that infringes third-party intellectual property rights.</li>
              <li>Deploy bots for illegal activities including fraud, phishing, or data theft.</li>
            </ul>
            <p>
              Violation of this Acceptable Use Policy may result in immediate account suspension without
              a refund.
            </p>
          </Section>

          <Section num="06" title="AI-Generated Content and Knowledge Ingestion">
            <p>
              Sapybase uses Google&apos;s Gemini API to generate bot responses. AI-generated content may be
              inaccurate, incomplete, or inappropriate. You are responsible for configuring your bot&apos;s
              knowledge base and system prompt, and for the outputs your bot produces to your end-users.
            </p>
            <p>
              By ingesting a URL, PDF, or text into your bot&apos;s knowledge base, you certify that:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>You have the legal right, ownership, or permission to use that content.</li>
              <li>The content does not violate third-party intellectual property, privacy, or trade secret rights.</li>
              <li>The ingestion does not bypass non-public security measures or paywalls (CFAA compliance).</li>
            </ul>
          </Section>

          <Section num="07" title="Intellectual Property">
            <p>
              The Sapybase platform, branding, and underlying code are owned by Sapybase and protected by
              applicable intellectual property law. You retain full ownership of the content you upload to
              your knowledge base and the bot configurations you create.
            </p>
            <p>
              You grant Sapybase a limited, non-exclusive licence to store, process, and transmit your
              content solely to operate the Service on your behalf. We do not claim ownership of your content
              and will not use it for purposes outside the Service.
            </p>
          </Section>

          <Section num="08" title="Limitation of Liability">
            <p>
              To the maximum extent permitted by law, Sapybase and its operator shall not be liable for any
              indirect, incidental, special, consequential, or punitive damages arising from your use of the
              Service, including but not limited to loss of profits, data, or business opportunities.
            </p>
            <p>
              Our total liability to you for any claim arising under these Terms shall not exceed the amount
              you paid to Sapybase in the 3 months preceding the claim.
            </p>
          </Section>

          <Section num="09" title="Indemnification">
            <p>
              You agree to defend, indemnify, and hold harmless Sapybase and its operator from and against
              any claims, damages, or costs (including legal fees) arising from: (i) your use of the Service,
              (ii) content you ingest or deploy through your bots, (iii) your violation of these Terms, or
              (iv) your violation of any third-party right.
            </p>
          </Section>

          <Section num="10" title="Termination">
            <p>
              You may close your account at any time from your dashboard settings. We may suspend or
              terminate your account immediately if you violate these Terms, with or without notice depending
              on the severity of the violation.
            </p>
            <p>
              Upon termination, your bots will stop serving responses and your data will be retained for
              the period described in our Privacy Policy, after which it will be deleted.
            </p>
          </Section>

          <Section num="11" title="Governing Law">
            <p>
              These Terms are governed by and construed in accordance with the laws of the State of New
              Jersey, United States, without regard to its conflict-of-law provisions. Any disputes arising
              under these Terms shall be resolved exclusively in the courts of New Jersey.
            </p>
          </Section>

          <Section num="12" title="Changes to These Terms">
            <p>
              We may update these Terms from time to time. When we do, we will update the &ldquo;Last Updated&rdquo;
              date above. For material changes, we will notify you by email at least 14 days before the
              change takes effect. Continued use of the Service after the effective date constitutes
              acceptance of the updated Terms.
            </p>
          </Section>

          <div className="flex items-start gap-4 p-6 rounded-2xl bg-amber-50 dark:bg-amber-500/5 border border-amber-200 dark:border-amber-500/20 transition-colors">
            <AlertCircle className="text-amber-600 dark:text-amber-500 shrink-0 mt-1 transition-colors" size={20} />
            <div>
              <h3 className="text-lg font-display font-bold text-amber-700 dark:text-amber-500 mb-1 transition-colors">
                Questions or Concerns?
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 font-medium transition-colors">
                For any questions about these Terms, email us at{' '}
                <a
                  href={`mailto:${CONTACT_EMAIL}`}
                  className="text-indigo-600 dark:text-indigo-400 underline"
                >
                  {CONTACT_EMAIL}
                </a>
                . We aim to respond within 2 business days.
              </p>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
