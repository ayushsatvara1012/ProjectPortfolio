import React from 'react';
import { Metadata } from 'next';
import HeroSection from '@/src/components/marketing/HeroSection';
import HowItWorks from '@/src/components/marketing/HowItWorks';
import Metrics from '@/src/components/marketing/Metrics';
import Services from '@/src/components/marketing/Services';
import ScrollReveal from '@/src/components/marketing/ScrollReveal';

export const metadata: Metadata = {
  title: "SaPyBase | Autonomous AI Chatbots for Modern Business",
  description: "Automate your customer support and sales with SaPyBase AI agents. Connect your documents and databases to deploy custom AI chatbots in minutes. Intelligent automation for the modern web.",
  alternates: {
    canonical: "https://www.sapybase.com/",
  },
};

export default function HomePage() {
  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": "https://www.sapybase.com/#organization",
        "name": "SaPyBase",
        "url": "https://www.sapybase.com",
        "logo": {
          "@type": "ImageObject",
          "url": "https://www.sapybase.com/SB_Brand-removebg.png"
        }
      },
      {
        "@type": "SoftwareApplication",
        "name": "SaPyBase AI Chatbot",
        "applicationCategory": "BusinessApplication",
        "operatingSystem": "Web",
        "url": "https://www.sapybase.com",
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
      <main className="relative overflow-x-hidden">
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
