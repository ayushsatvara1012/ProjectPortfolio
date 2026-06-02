import type { Metadata } from 'next';
import { buildMetadata } from '@/src/seo/buildMetadata';
import ScrollReveal from '@/src/components/marketing/ScrollReveal';
import Testimonials from '@/src/components/marketing/Testimonials';
import SocialProofBar from '@/src/components/marketing/SocialProofBar';
import {
  HeroCell,
  BeliefSection,
  GeometricDivider,
  StorySection,
  PrinciplesSection,
  DeliverablesCell,
  MetricsStrip,
  CTAStrip,
} from './components';
import FounderSection from './FounderSection';

export const metadata: Metadata = buildMetadata('about');

const STACK = [
  { name: 'Python', note: 'Backend core' },
  { name: 'FastAPI', note: 'REST & async' },
  { name: 'React 19', note: 'UI layer' },
  { name: 'PostgreSQL', note: 'Relational store' },
  { name: 'pgvector', note: 'Semantic search' },
  { name: 'AWS', note: 'Cloud infra' },
  { name: 'Tailwind v4', note: 'Design system' },
  { name: 'Vite', note: 'Build tooling' },
  { name: 'Gemini AI', note: 'LLM layer' },
  { name: 'RAG Pipeline', note: 'Context retrieval' },
  { name: 'Supabase', note: 'Auth & realtime' },
  { name: 'Docker', note: 'Containerisation' },
];

const PROJECTS_DATA = [
  {
    title: 'Sapybase Portfolio',
    tech: 'React · Vite · Tailwind v4 · SEO',
    result: '100 Lighthouse',
    tag: 'LIVE',
  },
  {
    title: 'LuminaLib AI',
    tech: 'FastAPI · pgvector · RAG',
    result: '<80ms retrieval',
    tag: 'DEPLOYED',
  },
  {
    title: 'V-Comm Platform',
    tech: 'IAM · S3 · EC2 · Route53',
    result: '99.9% uptime',
    tag: 'PRODUCTION',
  },
];

const CERTIFICATIONS = [
  { name: 'AWS Certified Solutions Architect', issuer: 'Amazon Web Services' },
  { name: 'Generative AI: Prompt Engineering', issuer: 'IBM' },
  { name: 'Machine Learning with Python', issuer: 'IBM' },
  { name: 'Intermediate Machine Learning', issuer: 'Kaggle' },
  { name: 'Python Programming', issuer: 'Kaggle' },
  { name: 'Android Studio Masterclass', issuer: 'Udemy' },
];

const EDUCATION = [
  {
    period: '2023 – 2025',
    degree: 'MS Computer Science',
    school: 'New York Institute of Technology',
    score: 'GPA 3.26 / 4.0',
  },
  {
    period: '2019 – 2023',
    degree: 'BTech Information Technology',
    school: 'KSV University',
    score: 'CGPA 7.52 / 10',
  },
];

// Placeholder copy — refine to taste.
const QUALITIES = [
  {
    icon: 'speed',
    title: 'Performance-first',
    body: 'Every page targets a 100 Lighthouse score. Speed is a feature, not an afterthought.',
  },
  {
    icon: 'visibility',
    title: 'No black box',
    body: 'Systems should be inspectable. I build tools that show their work, not hide it.',
  },
  {
    icon: 'bolt',
    title: 'Ship, then iterate',
    body: 'Real feedback beats perfect plans. I get things live fast and improve in the open.',
  },
  {
    icon: 'handshake',
    title: 'Built for trust',
    body: 'Accuracy over hype — products that earn confidence by never making things up.',
  },
];

export default function AboutPage() {
  return (
    <div className="bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-200 overflow-x-clip transition-colors duration-500">

      {/* 1 · Mission */}
      <HeroCell />

      {/* 2 · What we believe */}
      <ScrollReveal><BeliefSection /></ScrollReveal>

      {/* Geometric Divider */}
      <ScrollReveal><GeometricDivider /></ScrollReveal>

      {/* 3 · Our story */}
      <ScrollReveal><StorySection /></ScrollReveal>

      {/* 4 · Our principles */}
      <ScrollReveal><PrinciplesSection qualities={QUALITIES} /></ScrollReveal>

      {/* 5 · What we build */}
      <ScrollReveal><DeliverablesCell /></ScrollReveal>

      {/* 7 · Meet the founder */}
      <ScrollReveal>
        <FounderSection
          stack={STACK}
          certifications={CERTIFICATIONS}
          projects={PROJECTS_DATA}
          education={EDUCATION}
        />
      </ScrollReveal>

      {/* 8 · CTA */}
      <ScrollReveal><CTAStrip /></ScrollReveal>
    </div>
  );
}
