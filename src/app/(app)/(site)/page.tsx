import React from 'react';
import type { Metadata } from 'next';
import { buildMetadata } from '@/src/seo/buildMetadata';
import { PRODUCT } from '@/src/lib/brand';

import HeroSection from '@/src/components/marketing/HeroSection';
// import SocialProofBar from '@/src/components/marketing/SocialProofBar'; // hidden for now — component kept in src/components/marketing/SocialProofBar.tsx
import WhatWeSolve from '@/src/components/marketing/WhatWeSolve';

import ScrollTravelSection from '@/src/components/marketing/ScrollTravelSection';
// import EngineSection from '@/src/components/marketing/EngineSection'; // hidden for now — re-add the import together with the JSX below
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
        "text": "Yes. On the Growth plan and above, Vaayu chatbots capture visitor contact details during conversations, automatically score each lead as HOT, WARM, or COLD, and send you instant alerts. Captured leads appear in your dashboard and a prioritized Action Center worklist so you can follow up while intent is high."
      }
    },
    {
      "@type": "Question",
      "name": "What analytics and business intelligence does Vaayu provide?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "The Scale plan adds deep business intelligence: an ROI dashboard that ties conversations to closed revenue, a conversion funnel that shows where visitors drop off, and lead-source attribution so you know which channels drive your best leads. You also get a weekly results email summarizing performance."
      }
    },
    {
      "@type": "Question",
      "name": "Is my data secure with Vaayu?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Yes. Your content is never sold and never used to train external AI models beyond your own bot. All data is encrypted in transit with TLS, API keys are hashed and never stored in plaintext, and the embeddable widget is locked to the website domains you authorize so no one else can reuse it."
      }
    },
    {
      "@type": "Question",
      "name": "Is Vaayu free to try?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "You can explore the live interactive demo for free and start a 14-day trial of the Growth plan on your own data. Paid plans — Starter, Growth, and Scale — unlock production bots, higher message and knowledge limits, and advanced conversion and white-label features, with custom plans available for agencies and high-volume teams."
      }
    }
  ]
};

export default function HomePage() {
  return (
    <>
      {/* Prioritize the hero logo (LCP candidate): a high-priority preload so the
          browser fetches it before hydration work. React 19 hoists this <link>
          into <head>. Pairs with fetchPriority="high" on the <img> itself. */}
      <link rel="preload" as="image" href={PRODUCT.logo} fetchPriority="high" />
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
        {/* HowItWorks moved to the dedicated /vaayu product page */}
        <Testimonials />
        <PricingPreview />
      </main>
    </>
  );
}
