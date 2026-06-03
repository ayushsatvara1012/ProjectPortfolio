export const seoConfig = {
  home: {
    title: 'Sapybase — AI Chatbot That Knows Your Business | Deploy in 10 Minutes',
    description:
      'Add a 24/7 AI support agent to your website in 10 minutes. Sapybase trains on your content — PDFs, URLs, or text — answers customer questions accurately, captures leads, and shows you the exact ROI. No coding required.',
    canonical: 'https://www.sapybase.com/',
    keywords: [
      'AI chatbot for website',
      'no-code AI chatbot',
      'customer support automation',
      'chatbot that reads my documents',
      'AI support agent small business',
      'website chatbot no coding',
      'automated customer support',
      'chatbot lead capture',
      'AI FAQ bot',
      'PDF chatbot',
      'customer support analytics',
      'chatbot ROI tracking',
      'AI support insights',
      'conversation analytics',
      'Sapybase',
    ],
  },
  about: {
    title: 'About Sapybase — Built to Make AI Work for Every Business',
    description:
      'Sapybase was built by Ayush Satvara to give every business — not just tech companies — access to accurate, reliable AI support automation. Learn the story and the team.',
    canonical: 'https://www.sapybase.com/about',
    keywords: ['about Sapybase', 'Sapybase founder', 'Ayush Satvara', 'AI customer support platform', 'business AI chatbot'],
  },
  contact: {
    title: 'Build Your AI Bot | Contact Sapybase',
    description:
      'Ready to automate? Contact Sapybase for a consultation on deploying custom AI chatbots for your business. Scalable, intelligent, and production-ready solutions.',
    canonical: 'https://www.sapybase.com/contact',
    keywords: ['contact Sapybase', 'AI chatbot consultation', 'deploy AI bot', 'custom AI solution'],
  },
  services: {
    title: 'Sapybase AI Chatbot — Features & Capabilities',
    description:
      'From lead capture to ROI analytics, see everything your Sapybase chatbot does automatically — 24/7 support, conversation memory, custom branding, and real-time insights.',
    canonical: 'https://www.sapybase.com/services',
    keywords: ['AI chatbot features', 'chatbot lead capture', 'chatbot ROI analytics', 'AI customer support features', 'no-code chatbot platform', 'AI support insights', 'chatbot conversation analytics', 'support automation ROI'],
  },
  pricing: {
    title: 'Pricing Plans | Sapybase AI Chatbot',
    description:
      'Simple, transparent pricing for every stage of your business. Start free, scale as you grow — from solo projects to enterprise AI deployments with Sapybase.',
    canonical: 'https://www.sapybase.com/pricing',
    keywords: ['Sapybase pricing', 'AI chatbot plans', 'chatbot subscription', 'enterprise AI pricing'],
  },
  docs: {
    title: 'Documentation | Sapybase',
    description: 'Step-by-step guide to integrating, training, and customizing your Sapybase AI chatbot.',
    canonical: 'https://www.sapybase.com/docs',
    keywords: ['Sapybase docs', 'chatbot integration guide', 'AI bot setup', 'API documentation'],
  },
  privacy: {
    title: 'Privacy Policy | Sapybase',
    description:
      'Read the Sapybase privacy policy to understand how we collect, use, and protect your personal information.',
    canonical: 'https://www.sapybase.com/privacy-policy',
    keywords: ['Sapybase privacy policy', 'data protection', 'GDPR'],
  },
  terms: {
    title: 'Terms & Conditions | Sapybase',
    description:
      'Review the Sapybase terms and conditions governing use of our services, intellectual property, and service agreements.',
    canonical: 'https://www.sapybase.com/terms-and-conditions',
    keywords: ['Sapybase terms', 'terms of service', 'service agreement'],
  },
  blog: {
    title: 'Blog — AI Chatbot Guides, ROI, and Best Practices | Sapybase',
    description:
      'Practical guides on launching AI support chatbots, measuring chatbot ROI, capturing leads, and keeping answers accurate. Written for non-technical teams.',
    canonical: 'https://www.sapybase.com/blog',
    keywords: [
      'AI chatbot guides',
      'chatbot best practices',
      'customer support automation blog',
      'AI support insights',
      'chatbot ROI',
    ],
  },
} as const;

export type SeoKey = keyof typeof seoConfig;
