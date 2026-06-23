import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { buildMetadata } from '@/src/seo/buildMetadata';
import ScrollReveal from '@/src/components/marketing/ScrollReveal';
import BreadcrumbJsonLd from '@/src/components/seo/BreadcrumbJsonLd';
import GetVaayuButton from '@/src/components/vaayu/GetVaayuButton';
import ConsoleFrame from '@/src/components/vaayu/ConsoleFrame';
import SetupStrip from '@/src/components/vaayu/SetupStrip';
import HowItWorks from '@/src/components/vaayu/HowItWorks';
import LeadsFrame from '@/src/components/vaayu/LeadsFrame';
import FunnelFrame from '@/src/components/vaayu/FunnelFrame';
import RoiFrame from '@/src/components/vaayu/RoiFrame';
import ConversationsFrame from '@/src/components/vaayu/ConversationsFrame';

export const metadata: Metadata = buildMetadata('vaayu');

const vaayuSchema = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Vaayu',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  url: 'https://www.sapybase.com/vaayu',
  description:
    'Vaayu by Sapybase is a Business Intelligence chat for your website. It captures and scores leads, maps the conversion funnel, attributes revenue and ROI to conversations, and auto-summarizes what customers ask — trained on your own content.',
  featureList: [
    'Lead capture and automatic scoring',
    'Conversion funnel analytics',
    'Revenue attribution and ROI tracking',
    'Conversation insights and auto-tagging',
    'Train on PDFs, URLs, and text',
    'One-line embed for any website',
  ],
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  publisher: { '@id': 'https://www.sapybase.com/#organization' },
  brand: { '@type': 'Brand', name: 'Vaayu' },
};

// Q&A block — answer engines (ChatGPT, Perplexity, Gemini, Google AI Overviews)
// preferentially quote concise, structured questions like these.
const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'What is Vaayu?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Vaayu is a Business Intelligence chat by Sapybase that lives on your website. It answers customer questions 24/7, captures and scores leads automatically, maps your conversion funnel, and attributes revenue and ROI back to every conversation — trained on your own content with no code.',
      },
    },
    {
      '@type': 'Question',
      name: 'How is Vaayu different from a normal chatbot?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'A normal chatbot only replies. Vaayu also turns each conversation into business intelligence: it scores every lead by buying intent, shows where visitors drop off in the funnel, breaks down revenue by channel, and auto-summarizes the questions customers ask most.',
      },
    },
    {
      '@type': 'Question',
      name: 'How does Vaayu score leads?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Vaayu reads intent signals in real time — budget, urgency, and fit — and assigns each contact a 0–100 score directly from the chat, so your team can prioritize the hottest leads without filling out a form.',
      },
    },
    {
      '@type': 'Question',
      name: 'How do I add Vaayu to my website?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Train Vaayu on your PDFs, URLs, or text, then paste a single JavaScript snippet into your site. It works on any platform — WordPress, Shopify, Webflow, Next.js, React, or plain HTML — and goes live in minutes.',
      },
    },
    {
      '@type': 'Question',
      name: 'Is Vaayu free?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Yes, Vaayu offers a free tier so you can train and deploy a chat at no cost. Paid plans add more data sources, higher usage, and advanced lead and ROI features.',
      },
    },
  ],
};

type Feature = {
  id: string;
  eyebrow: string;
  title: string;
  body: string;
  bullets: string[];
  visual: React.ReactNode;
};

const FEATURES: Feature[] = [
  {
    id: 'leads',
    eyebrow: 'Lead Capture & Scoring',
    title: 'Every conversation, ranked by how ready they are to buy.',
    body:
      'Vaayu reads intent in real time — budget, urgency, fit — and turns each chat into a scored lead. Your team sees who is hot before the visitor ever leaves the page.',
    bullets: [
      'Automatic 0–100 intent score on every contact',
      'Captured straight from chat, no forms required',
      'Hot leads surfaced to the top, instantly',
    ],
    visual: <LeadsFrame />,
  },
  {
    id: 'funnel',
    eyebrow: 'Conversion Funnel',
    title: 'See exactly where visitors convert — and where they slip away.',
    body:
      'From first visit to closed sale, Vaayu maps every stage and shows the drop-off at each step, so you fix the leak that is actually costing you revenue.',
    bullets: [
      'Visitor → conversation → lead → sale, end to end',
      'Stage-by-stage drop-off rates',
      'Spot the highest-impact bottleneck at a glance',
    ],
    visual: <FunnelFrame />,
  },
  {
    id: 'roi',
    eyebrow: 'ROI & Attribution',
    title: 'Revenue traced back to every single chat.',
    body:
      'Vaayu connects conversations to the deals they closed, so you can prove return on spend, see which channels pay off, and stop guessing what your chat is worth.',
    bullets: [
      'Dollar-level revenue attribution',
      'Return-on-spend, calculated for you',
      'Breakdown by channel and source',
    ],
    visual: <RoiFrame />,
  },
  {
    id: 'conversations',
    eyebrow: 'Conversations & Insights',
    title: 'What your customers actually ask — summarized for you.',
    body:
      'Beyond replying, Vaayu reads every conversation and hands you the patterns: top questions, sentiment, and auto-tagged themes that tell you what to fix and what to build next.',
    bullets: [
      'Top questions ranked by volume',
      'Sentiment tracked across conversations',
      'Themes auto-tagged — pricing, refunds, shipping',
    ],
    visual: <ConversationsFrame />,
  },
];

export default function VaayuPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(vaayuSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <BreadcrumbJsonLd trail={[{ name: 'Vaayu', path: '/vaayu' }]} />

      <main className="relative overflow-x-clip bg-white dark:bg-slate-950">
        {/* ── Hero ───────────────────────────────────────── */}
        <section className="relative px-6 sm:px-12 lg:px-20 pt-28 lg:pt-36 pb-16 lg:pb-24">
          <div className="absolute inset-x-0 top-0 h-[420px] bg-gradient-to-b from-[#004DE8]/[0.06] to-transparent pointer-events-none" aria-hidden="true" />
          <div className="relative mx-auto max-w-7xl grid lg:grid-cols-2 gap-12 lg:gap-10 items-center">
            <ScrollReveal>
              <div className="flex items-center gap-2 mb-5">
                <img src="/vaayu_logo.svg" alt="" className="h-5 w-auto" />
                <span className="font-google text-sm font-medium tracking-wide text-[#004DE8]">Vaayu · by Sapybase</span>
              </div>
              <h1 className="font-google font-medium tracking-tight leading-[1.05] text-4xl sm:text-5xl lg:text-6xl text-slate-900 dark:text-white">
                A Business Intelligence that{' '}
                <span className="text-transparent bg-clip-text bg-linear-to-r from-blue-700 to-blue-500">lives in your chat.</span>
              </h1>
              <p className="mt-6 max-w-xl font-google text-base sm:text-lg leading-relaxed text-slate-600 dark:text-slate-300">
                Vaayu answers customers 24/7, captures and scores every lead, maps your funnel, and proves the exact revenue and ROI it earned — all from one line of code on your site.
              </p>
              <div className="mt-9 flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
                <GetVaayuButton />
                <Link
                  href="/pricing"
                  className="inline-flex items-center justify-center gap-2 px-8 py-4 text-lg font-google font-medium rounded-full border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors"
                >
                  See pricing
                </Link>
              </div>
            </ScrollReveal>

            <ScrollReveal delay={0.15}>
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 shadow-2xl shadow-slate-900/5 dark:shadow-black/30 p-2 sm:p-3">
                <ConsoleFrame />
              </div>
            </ScrollReveal>
          </div>
        </section>

        {/* ── Setup strip ────────────────────────────────── */}
        <section className="px-6 sm:px-12 lg:px-20 py-12 lg:py-16 border-y border-slate-100 dark:border-slate-900 bg-slate-50/40 dark:bg-slate-900/20">
          <div className="mx-auto max-w-7xl">
            <ScrollReveal>
              <p className="font-google text-sm font-medium tracking-wide text-[#004DE8] mb-2">Live in minutes</p>
              <h2 className="font-google font-medium tracking-tight text-2xl sm:text-3xl text-slate-900 dark:text-white max-w-2xl">
                No engineers, no migration. Train it, embed it, done.
              </h2>
            </ScrollReveal>
            <ScrollReveal delay={0.1} className="mt-10">
              <SetupStrip />
            </ScrollReveal>
          </div>
        </section>

        {/* ── How it works ───────────────────────────────── */}
        <HowItWorks />

        {/* ── Feature sections ───────────────────────────── */}
        {FEATURES.map((f, i) => {
          const flip = i % 2 === 1;
          return (
            <section
              key={f.id}
              id={f.id}
              className="scroll-mt-24 px-6 sm:px-12 lg:px-20 py-16 lg:py-24"
            >
              <div className="mx-auto max-w-7xl grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
                {/* Text */}
                <ScrollReveal className={flip ? 'lg:order-2' : ''}>
                  <p className="font-google text-sm font-medium tracking-wide text-[#004DE8] mb-3">{f.eyebrow}</p>
                  <h2 className="font-google font-medium tracking-tight leading-tight text-3xl sm:text-4xl text-slate-900 dark:text-white max-w-xl">
                    {f.title}
                  </h2>
                  <p className="mt-5 max-w-xl font-google text-base sm:text-lg leading-relaxed text-slate-600 dark:text-slate-300">
                    {f.body}
                  </p>
                  <ul className="mt-7 space-y-3.5">
                    {f.bullets.map((b) => (
                      <li key={b} className="flex items-start gap-3">
                        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#004DE8]/10">
                          <svg viewBox="0 0 12 12" className="h-3 w-3" aria-hidden="true">
                            <path d="M2.5 6.5 L5 9 L9.5 3.5" fill="none" stroke="#004DE8" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </span>
                        <span className="font-google text-[15px] leading-relaxed text-slate-700 dark:text-slate-300">{b}</span>
                      </li>
                    ))}
                  </ul>
                </ScrollReveal>

                {/* Visual */}
                <ScrollReveal delay={0.12} className={flip ? 'lg:order-1' : ''}>
                  <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-gradient-to-br from-white to-slate-50 dark:from-slate-950 dark:to-slate-900/50 shadow-xl shadow-slate-900/5 dark:shadow-black/20 p-3 sm:p-5">
                    {f.visual}
                  </div>
                </ScrollReveal>
              </div>
            </section>
          );
        })}

        {/* ── Final CTA ──────────────────────────────────── */}
        <section className="px-6 sm:px-12 lg:px-20 pb-24 pt-4">
          <ScrollReveal>
            <div className="relative mx-auto max-w-7xl overflow-hidden rounded-3xl bg-gradient-to-br from-[#002B82] via-[#004DE8] to-[#3B82F6] px-8 sm:px-14 py-16 sm:py-20 text-center shadow-2xl">
              <div className="absolute -top-24 -right-16 h-64 w-64 rounded-full bg-white/10 blur-2xl pointer-events-none" aria-hidden="true" />
              <div className="absolute -bottom-28 -left-16 h-72 w-72 rounded-full bg-white/10 blur-3xl pointer-events-none" aria-hidden="true" />
              <h2 className="relative font-google font-medium tracking-tight text-3xl sm:text-5xl text-white leading-tight">
                Turn conversations into revenue.
              </h2>
              <p className="relative mx-auto mt-5 max-w-xl font-google text-base sm:text-lg text-blue-50/90 leading-relaxed">
                Put Vaayu on your site today — it starts answering, scoring, and attributing from the first chat.
              </p>
              <div className="relative mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
                <GetVaayuButton variant="invert" />
                <Link
                  href="/pricing"
                  className="inline-flex items-center justify-center gap-2 px-8 py-4 text-lg font-google font-medium rounded-full border border-white/30 text-white hover:bg-white/10 transition-colors"
                >
                  Compare plans
                </Link>
              </div>
            </div>
          </ScrollReveal>
        </section>
      </main>
    </>
  );
}
