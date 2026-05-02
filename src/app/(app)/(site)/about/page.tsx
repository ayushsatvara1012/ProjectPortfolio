import type { Metadata } from 'next';
import { buildMetadata } from '@/src/seo/buildMetadata';
import Projects from '@/src/components/marketing/ProjectSection';
import ScrollReveal from '@/src/components/marketing/ScrollReveal';
import { 
  HeroCell, 
  ProfileCell, 
  MetricsStrip, 
  TechStackCell, 
  EducationCell, 
  CertificationsCell, 
  DeliverablesCell, 
  CTAStrip 
} from './components';
import { CoreProjectsCell } from './AboutClient';

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

export default function AboutPage() {
  return (
    <div className="bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-200 overflow-x-clip transition-colors duration-500">
      
      {/* HEADER STRIP */}
      <div className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 pt-20 pb-0">
        <div className="max-w-8xl mx-auto px-6 md:px-12 py-6 flex items-center justify-between">
          <div className="inline-flex items-center gap-2 px-2 py-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-none">
            <span className="material-symbols-outlined text-[14px] text-blue-600">terminal</span>
            <span className="text-xs font-display uppercase tracking-widest font-bold text-slate-400 dark:text-slate-500">Sapybase_v2.0 · About</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="block w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs font-google font-bold uppercase tracking-widest text-green-600 dark:text-green-500">Available</span>
          </div>
        </div>
      </div>

      <div className="max-w-8xl mx-auto px-6 md:px-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-px bg-slate-200 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 transition-colors duration-500">
          <HeroCell />
          <ProfileCell />
        </div>
      </div>

      <ScrollReveal className="max-w-8xl mx-auto px-6 md:px-12">
        <MetricsStrip />
      </ScrollReveal>

      <ScrollReveal className="max-w-8xl mx-auto px-6 md:px-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-px bg-slate-200 dark:bg-slate-800 border-x border-b border-slate-200 dark:border-slate-800 transition-colors duration-500">
          <TechStackCell stack={STACK} />
          <CoreProjectsCell projects={PROJECTS_DATA} />
        </div>
      </ScrollReveal>

      <ScrollReveal className="max-w-8xl mx-auto px-6 md:px-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-slate-200 dark:bg-slate-800 border-x border-b border-slate-200 dark:border-slate-800 transition-colors duration-500">
          <EducationCell />
          <CertificationsCell certifications={CERTIFICATIONS} />
          <DeliverablesCell />
        </div>
      </ScrollReveal>

      <ScrollReveal><Projects /></ScrollReveal>

      <ScrollReveal className="max-w-8xl mx-auto px-6 md:px-12">
        <CTAStrip />
      </ScrollReveal>

      <div className="h-px bg-slate-200 dark:bg-slate-800 max-w-8xl mx-auto px-6 md:px-12" />
      <div className="pb-8" />
    </div>
  );
}
