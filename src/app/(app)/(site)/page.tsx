import React from 'react';
import type { Metadata } from 'next';
import { buildMetadata } from '@/src/seo/buildMetadata';

import HeroSection from '@/src/components/marketing/HeroSection';
// import SocialProofBar from '@/src/components/marketing/SocialProofBar'; // hidden for now — component kept in src/components/marketing/SocialProofBar.tsx
import WhatWeSolve from '@/src/components/marketing/WhatWeSolve';

import ScrollTravelSection from '@/src/components/marketing/ScrollTravelSection';
import EngineSection from '@/src/components/marketing/EngineSection';
import HowItWorks from '@/src/components/marketing/HowItWorks';
import Testimonials from '@/src/components/marketing/Testimonials';
import PricingPreview from '@/src/components/marketing/PricingPreview';

export const metadata: Metadata = buildMetadata('home');

const productSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "Vaayu",
  "applicationCategory": "BusinessApplication",
  "operatingSystem": "Web",
  "url": "https://www.sapybase.com",
  "brand": { "@type": "Brand", "name": "Sapybase" },
  "description": "Vaayu by Sapybase is a Business Intelligence chat that lives on your website. Upload your PDFs, paste your URLs, or add text — Vaayu trains an AI agent on your content, answers customer questions 24/7, captures and scores leads automatically, and shows you the funnel, conversions, and exact ROI it earned.",
  "featureList": [
    "Train on PDFs, URLs, and manual text",
    "One-line JavaScript embed for any website",
    "24/7 automated customer support",
    "Lead capture, scoring, and conversion funnel",
    "ROI and revenue attribution from conversations",
    "RAG (Retrieval-Augmented Generation) engine"
  ],
  "offers": {
    "@type": "Offer",
    "price": "0",
    "priceCurrency": "USD"
  }
};

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "What is Vaayu?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Vaayu is a RAG-powered AI chatbot platform that lets you train a custom AI agent on your own documents, PDFs, and website URLs. Once trained, you embed the chatbot on your website with a single line of JavaScript to answer customer questions 24/7."
      }
    },
    {
      "@type": "Question",
      "name": "How does Vaayu work?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Vaayu uses Retrieval-Augmented Generation (RAG) to ground AI responses in your actual content. You upload your documents or paste your URLs, Vaayu indexes and vectorizes the content, and the AI chatbot retrieves relevant context before answering — so responses are accurate and based on your data, not hallucinated."
      }
    },
    {
      "@type": "Question",
      "name": "What data sources can I use to train my Vaayu chatbot?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "You can train your Vaayu chatbot using website URLs (which Vaayu crawls and indexes), PDF and document uploads, or by pasting raw text manually. All three sources can be combined to give your AI agent a complete knowledge base."
      }
    },
    {
      "@type": "Question",
      "name": "How do I add the Vaayu chatbot to my website?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "After training your bot, Vaayu generates a single JavaScript snippet. Paste it into your website's HTML — it works with any platform including Next.js, React, WordPress, Shopify, Webflow, and plain HTML."
      }
    },
    {
      "@type": "Question",
      "name": "Does Vaayu support lead generation?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Yes. Vaayu chatbots can capture visitor details during conversations and surface them as leads in your dashboard, helping you convert website traffic into sales opportunities without manual follow-up."
      }
    },
    {
      "@type": "Question",
      "name": "Is Vaayu free to use?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Vaayu offers a free tier so you can build and test your AI chatbot at no cost. Paid plans are available for higher usage, more data sources, and advanced features."
      }
    }
  ]
};

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <main className="relative overflow-x-clip">
        <HeroSection />
        {/* <SocialProofBar /> */}
        <WhatWeSolve />
        <ScrollTravelSection />
        {/* <EngineSection /> */}
        <HowItWorks />
        <Testimonials />
        <PricingPreview />
      </main>
    </>
  );
}
