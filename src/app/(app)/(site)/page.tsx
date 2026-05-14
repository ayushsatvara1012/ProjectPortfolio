import React from 'react';
import type { Metadata } from 'next';
import { buildMetadata } from '@/src/seo/buildMetadata';

import HeroSection from '@/src/components/marketing/HeroSection';
import WhatWeSolve from '@/src/components/marketing/WhatWeSolve';

import FeatureIllustration from '@/src/components/marketing/FeatureIllustration';
import EngineSection from '@/src/components/marketing/EngineSection';

export const metadata: Metadata = buildMetadata('home');

const structuredSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "Sapybase AI Chatbot",
  "applicationCategory": "BusinessApplication",
  "operatingSystem": "Web",
  "url": "https://www.sapybase.com",
  "description": "Autonomous AI chatbots and agents for modern businesses. Connect documents and databases to automate customer support and sales.",
  "offers": {
    "@type": "Offer",
    "price": "0",
    "priceCurrency": "USD"
  }
};

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredSchema) }}
      />
      <main className="relative overflow-x-clip">
        <HeroSection />
        <WhatWeSolve />
        <FeatureIllustration />
        <EngineSection/>
      </main>
    </>
  );
}
