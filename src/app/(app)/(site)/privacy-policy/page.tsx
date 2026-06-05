import React from 'react';
import { Shield } from 'lucide-react';
import Link from 'next/link';

import type { Metadata } from 'next';
import { buildMetadata } from '@/src/seo/buildMetadata';

export const metadata: Metadata = buildMetadata('privacy');

const LAST_UPDATED = 'June 5, 2026';
const CONTACT_EMAIL = 'ayushsatvara2002@gmail.com';

const Section = ({ num, title, children }: { num: string; title: string; children: React.ReactNode }) => (
  <section>
    <h2 className="text-2xl md:text-3xl font-display font-bold tracking-tight text-slate-900 dark:text-white mb-4 flex items-center gap-3 transition-colors">
      <span className="w-10 h-10 rounded-lg dark:bg-slate-900 flex items-center justify-center text-indigo-600 dark:text-indigo-500 font-bold font-sans transition-colors">
        {num}
      </span>
      {title}
    </h2>
    <div className="text-lg font-medium md:text-xl text-slate-600 dark:text-slate-400 leading-relaxed transition-colors space-y-3">
      {children}
    </div>
  </section>
);

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-[#FAFAFA] dark:bg-slate-950 text-slate-600 dark:text-slate-300 pt-32 pb-20 px-6 transition-colors duration-500">
      <div className="max-w-4xl mx-auto">
        <Link
          href="/"
          className="inline-flex items-center text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors mb-12 group"
        >
          <span className="material-symbols-outlined">arrow_back</span>
        </Link>

        <header className="mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20 text-indigo-600 dark:text-indigo-400 text-[10px] uppercase tracking-widest font-bold font-sans mb-6 transition-colors">
            <Shield size={14} />
            Legal &amp; Privacy
          </div>
          <h1 className="text-3xl md:text-4xl font-display font-black tracking-tight leading-none text-slate-900 dark:text-white mb-6 transition-colors">
            Privacy Policy
          </h1>
          <p className="text-md text-slate-500 font-medium font-sans transition-colors">
            Last Updated: {LAST_UPDATED}
          </p>
        </header>

        <div className="space-y-12">

          <Section num="01" title="Who We Are">
            <p>
              Sapybase (&ldquo;we&rdquo;, &ldquo;us&rdquo;, &ldquo;our&rdquo;) is a SaaS platform that lets businesses build and deploy
              AI-powered chatbots. We are operated by Ayush Satvara, based in Jersey City, New Jersey, United States.
            </p>
            <p>
              This Privacy Policy applies to our website at{' '}
              <span className="text-indigo-600 dark:text-indigo-400">www.sapybase.com</span>, our dashboard, our embeddable
              chatbot widget, and our API. By using any of these services you agree to the practices described here.
            </p>
          </Section>

          <Section num="02" title="Information We Collect">
            <p>We collect the following categories of data:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong>Account data</strong> — name, email address, and authentication credentials managed via Clerk
                (our identity provider). We never store your password directly.
              </li>
              <li>
                <strong>Billing data</strong> — subscription plan, billing period, and payment status managed via Polar.
                We do not store full credit card numbers; payment details are handled by Polar&apos;s PCI-compliant infrastructure.
              </li>
              <li>
                <strong>Bot configuration data</strong> — bot names, knowledge base content (URLs, PDFs, text), system
                prompts, and settings you configure in the dashboard.
              </li>
              <li>
                <strong>Chat logs</strong> — conversations between your end-users and your bots, including user queries
                and AI-generated responses. These are stored to power analytics, the unanswered-question dashboard, and
                SEO FAQ generation.
              </li>
              <li>
                <strong>Usage data</strong> — message counts, API request metadata, IP addresses, and browser/device
                information collected for rate limiting, billing enforcement, and abuse prevention.
              </li>
              <li>
                <strong>Lead &amp; conversion data</strong> — if you enable lead capture on your bot, end-user contact
                information (name, email, phone) submitted through the widget is stored, scored as HOT/WARM/COLD, and
                attributed to your account and its traffic source so you can measure conversion performance.
              </li>
            </ul>
          </Section>

          <Section num="03" title="How We Use Your Information">
            <ul className="list-disc pl-6 space-y-2">
              <li>Providing, operating, and improving the Sapybase platform and your bots.</li>
              <li>Processing subscription billing and enforcing plan limits.</li>
              <li>Generating analytics, insight reports, and SEO FAQ content for your bots.</li>
              <li>Sending account and billing emails via Clerk, and product notification emails — hot-lead alerts, human-handoff notifications, and the weekly results digest — via Resend.</li>
              <li>Detecting and preventing abuse, fraud, and rate-limit violations.</li>
              <li>Responding to your support requests sent to {CONTACT_EMAIL}.</li>
            </ul>
            <p>
              We do <strong>not</strong> sell your data or your end-users&apos; data to third parties. We do not use chat
              log content to train AI models beyond your own bot&apos;s knowledge base.
            </p>
          </Section>

          <Section num="04" title="Subprocessors">
            <p>
              We share data with the following third-party subprocessors solely to deliver the service. Each is bound
              by their own data protection agreements.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-base border-collapse mt-2">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700">
                    <th className="text-left py-2 pr-6 font-semibold text-slate-700 dark:text-slate-300">Subprocessor</th>
                    <th className="text-left py-2 pr-6 font-semibold text-slate-700 dark:text-slate-300">Purpose</th>
                    <th className="text-left py-2 font-semibold text-slate-700 dark:text-slate-300">Data location</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {[
                    ['Clerk', 'User authentication & identity', 'US'],
                    ['Supabase', 'PostgreSQL database hosting', 'US (AWS)'],
                    ['Render', 'API server hosting', 'US'],
                    ['Polar', 'Subscription billing & payments', 'US'],
                    ['Google (Gemini API)', 'AI language model inference', 'US / Google Cloud'],
                    ['Resend', 'Transactional & notification email delivery', 'US'],
                    ['Vercel', 'Frontend hosting', 'Global CDN'],
                    ['Redis (Render)', 'Rate limiting & caching', 'US'],
                  ].map(([name, purpose, location]) => (
                    <tr key={name}>
                      <td className="py-2 pr-6 font-medium text-slate-700 dark:text-slate-300">{name}</td>
                      <td className="py-2 pr-6">{purpose}</td>
                      <td className="py-2">{location}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          <Section num="05" title="Data Retention">
            <p>
              We retain your data for as long as your account is active. Specific retention periods:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Chat logs</strong> — retained for 12 months from the date of each conversation, then subject to deletion in a future automated purge feature (currently manual on request).</li>
              <li><strong>Account &amp; billing data</strong> — retained for the lifetime of your account plus 3 years after account closure for tax and legal compliance.</li>
              <li><strong>Knowledge base content</strong> — deleted immediately when you remove it from the dashboard or delete your bot.</li>
              <li><strong>Lead capture data</strong> — retained until you delete it from your dashboard or close your account.</li>
            </ul>
            <p>
              To request early deletion of any data, email{' '}
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-indigo-600 dark:text-indigo-400 underline">{CONTACT_EMAIL}</a>.
              We will action deletion requests within 30 days.
            </p>
          </Section>

          <Section num="06" title="Cookies and Tracking">
            <p>
              We use strictly necessary cookies for session management (via Clerk) and do not use advertising
              or cross-site tracking cookies. Our frontend may use Vercel&apos;s analytics for aggregate page-view
              counts — this does not involve selling data or fingerprinting individual users.
            </p>
          </Section>

          <Section num="07" title="Your Rights">
            <p>
              Depending on your location, you may have the right to access, correct, delete, or export the personal
              data we hold about you. US residents (including California under CCPA) and EU/UK residents (under GDPR)
              may also have the right to object to or restrict certain processing.
            </p>
            <p>
              To exercise any of these rights, email{' '}
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-indigo-600 dark:text-indigo-400 underline">{CONTACT_EMAIL}</a>{' '}
              with the subject line &ldquo;Privacy Request&rdquo;. We will respond within 30 days.
            </p>
          </Section>

          <Section num="08" title="Data Security">
            <p>
              We implement industry-standard security measures including TLS encryption in transit, hashed API keys
              (SHA-256, never stored in plaintext), Clerk-managed authentication, and role-based access controls.
              Our database is hosted on Supabase with pgvector on PostgreSQL 17.
            </p>
            <p>
              No method of transmission over the internet is 100% secure. In the event of a data breach that
              materially affects your account, we will notify you by email within 72 hours of becoming aware.
            </p>
          </Section>

          <Section num="09" title="Children's Privacy">
            <p>
              Sapybase is not directed at children under 13. We do not knowingly collect personal data from
              anyone under 13. If you believe a child has provided us data, contact us immediately at{' '}
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-indigo-600 dark:text-indigo-400 underline">{CONTACT_EMAIL}</a>.
            </p>
          </Section>

          <Section num="10" title="Changes to This Policy">
            <p>
              We may update this Privacy Policy from time to time. When we do, we will update the &ldquo;Last Updated&rdquo;
              date at the top of this page and, for material changes, notify you by email. Continued use of the
              service after changes constitutes acceptance of the updated policy.
            </p>
          </Section>

          <section className="p-8 rounded-2xl bg-indigo-50 dark:bg-indigo-600/5 border border-indigo-200 dark:border-indigo-500/20 transition-colors">
            <h2 className="text-xl md:text-2xl font-display font-bold text-slate-900 dark:text-white mb-4 transition-colors">
              Contact Us
            </h2>
            <p className="text-base text-slate-600 dark:text-slate-400 font-medium mb-6 transition-colors">
              Privacy questions, data requests, or concerns — email us and we will respond within 30 days.
            </p>
            <a
              href={`mailto:${CONTACT_EMAIL}?subject=Privacy%20Request`}
              className="px-6 py-3 rounded-xl bg-indigo-600 dark:bg-indigo-600 text-white text-[10px] uppercase tracking-widest font-bold font-sans hover:bg-indigo-700 dark:hover:bg-indigo-500 transition-colors shadow-sm inline-block"
            >
              Email Us
            </a>
          </section>

        </div>
      </div>
    </div>
  );
}
