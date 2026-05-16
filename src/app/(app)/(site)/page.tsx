import React from 'react';
import type { Metadata } from 'next';
import { buildMetadata } from '@/src/seo/buildMetadata';

import HeroSection from '@/src/components/marketing/HeroSection';
import WhatWeSolve from '@/src/components/marketing/WhatWeSolve';

import ScrollTravelSection from '@/src/components/marketing/ScrollTravelSection';
import EngineSection from '@/src/components/marketing/EngineSection';
import HowItWorks from '@/src/components/marketing/HowItWorks';

export const metadata: Metadata = buildMetadata('home');

const productSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "Sapybase AI Chatbot",
  "applicationCategory": "BusinessApplication",
  "operatingSystem": "Web",
  "url": "https://www.sapybase.com",
  "description": "Sapybase is a RAG-powered AI chatbot builder. Upload your PDFs, paste your URLs, or add text — Sapybase trains an AI agent on your content and generates an embeddable chatbot widget for any website. Answer customer questions 24/7 and capture leads automatically.",
  "featureList": [
    "Train on PDFs, URLs, and manual text",
    "One-line JavaScript embed for any website",
    "24/7 automated customer support",
    "Lead capture from chat conversations",
    "Custom branding and theme colors",
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
      "name": "What is Sapybase?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Sapybase is a RAG-powered AI chatbot platform that lets you train a custom AI agent on your own documents, PDFs, and website URLs. Once trained, you embed the chatbot on your website with a single line of JavaScript to answer customer questions 24/7."
      }
    },
    {
      "@type": "Question",
      "name": "How does Sapybase work?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Sapybase uses Retrieval-Augmented Generation (RAG) to ground AI responses in your actual content. You upload your documents or paste your URLs, Sapybase indexes and vectorizes the content, and the AI chatbot retrieves relevant context before answering — so responses are accurate and based on your data, not hallucinated."
      }
    },
    {
      "@type": "Question",
      "name": "What data sources can I use to train my Sapybase chatbot?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "You can train your Sapybase chatbot using website URLs (which Sapybase crawls and indexes), PDF and document uploads, or by pasting raw text manually. All three sources can be combined to give your AI agent a complete knowledge base."
      }
    },
    {
      "@type": "Question",
      "name": "How do I add the Sapybase chatbot to my website?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "After training your bot, Sapybase generates a single JavaScript snippet. Paste it into your website's HTML — it works with any platform including Next.js, React, WordPress, Shopify, Webflow, and plain HTML."
      }
    },
    {
      "@type": "Question",
      "name": "Does Sapybase support lead generation?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Yes. Sapybase chatbots can capture visitor details during conversations and surface them as leads in your dashboard, helping you convert website traffic into sales opportunities without manual follow-up."
      }
    },
    {
      "@type": "Question",
      "name": "Is Sapybase free to use?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Sapybase offers a free tier so you can build and test your AI chatbot at no cost. Paid plans are available for higher usage, more data sources, and advanced features."
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
        <WhatWeSolve />
        <ScrollTravelSection />
        <EngineSection />
        <HowItWorks />
      </main>
    </>
  );
}
