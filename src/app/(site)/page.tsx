import React from 'react';
import { Metadata } from 'next';
import HeroSection from '@/src/components/marketing/HeroSection';
import HowItWorks from '@/src/components/marketing/HowItWorks';
import Metrics from '@/src/components/marketing/Metrics';
import Services from '@/src/components/marketing/Services';
import ScrollReveal from '@/src/components/marketing/ScrollReveal';

export const metadata: Metadata = {
  title: "Sapybase | Autonomous AI Chatbots for Modern Business",
  description: "Automate your customer support and sales with Sapybase AI agents. Connect your documents and databases to deploy custom AI chatbots in minutes. Intelligent automation for the modern web.",
  alternates: {
    canonical: "https://www.Sapybase.com/",
  },
};

export default function HomePage() {
  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": "https://www.Sapybase.com/#organization",
        "name": "Sapybase",
        "url": "https://www.Sapybase.com",
        "logo": {
          "@type": "ImageObject",
          "url": "https://www.Sapybase.com/SB_Brand-removebg.png"
        }
      },
      {
        "@type": "SoftwareApplication",
        "name": "Sapybase AI Chatbot",
        "applicationCategory": "BusinessApplication",
        "operatingSystem": "Web",
        "url": "https://www.Sapybase.com",
        "description": "Autonomous AI chatbots and agents for modern businesses. Connect documents and databases to automate customer support and sales.",
        "offers": {
          "@type": "Offer",
          "price": "0",
          "priceCurrency": "USD"
        }
      }
    ]
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />
      <main className="relative overflow-x-clip">
        <HeroSection />
        <ScrollReveal>
          <HowItWorks />
        </ScrollReveal>
        <ScrollReveal delay={0.05}>
          <Metrics />
        </ScrollReveal>
        <ScrollReveal delay={0.05}>
          <Services />
        </ScrollReveal>
      </main>
    </>
  );
}
