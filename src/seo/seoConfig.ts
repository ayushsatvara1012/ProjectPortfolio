export const seoConfig = {
  home: {
    title: 'Vaayu by Sapybase — Business Intelligence Chat That Captures Leads & Proves ROI',
    description:
      'Vaayu by Sapybase is a Business Intelligence chat for your website. It answers customer questions 24/7, captures and scores leads, and shows you the funnel, conversions, and exact ROI it earned — trained on your own content, no coding required.',
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
      'Vaayu',
      'Vaayu by Sapybase',
      'Sapybase',
    ],
  },
  vaayu: {
    title: 'Vaayu — A Business Intelligence Chat That Captures Leads & Proves ROI | by Sapybase',
    description:
      'Vaayu is the Business Intelligence chat by Sapybase. It captures and scores leads, maps your conversion funnel, attributes revenue and ROI to every conversation, and auto-summarizes what customers ask — trained on your content, live in minutes.',
    canonical: 'https://www.sapybase.com/vaayu',
    keywords: [
      'Vaayu',
      'Vaayu by Sapybase',
      'business intelligence chat',
      'AI chatbot lead scoring',
      'conversion funnel analytics',
      'chatbot ROI attribution',
      'conversation analytics',
      'lead capture chatbot',
      'AI chat revenue attribution',
      'no-code AI chatbot',
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
    title: 'Sapybase Services — Custom AI, Web Apps & Cloud Engineering',
    description:
      'Sapybase is a software studio that designs and ships custom AI chatbots, RAG pipelines, full-stack web apps, and cloud infrastructure. Engineering digital excellence, from code to cloud.',
    canonical: 'https://www.sapybase.com/services',
    keywords: ['custom AI development', 'RAG pipeline development', 'full-stack web app agency', 'AI integration consulting', 'cloud infrastructure AWS', 'software development studio'],
  },
  pricing: {
    title: 'Vaayu Pricing — Plans That Scale With You | by Sapybase',
    description:
      'Simple, transparent pricing for Vaayu, the Business Intelligence chat by Sapybase. Start free and scale as you grow — more data sources, lead capture, and ROI insights on every plan.',
    canonical: 'https://www.sapybase.com/pricing',
    keywords: ['Vaayu pricing', 'business intelligence chat pricing', 'AI chatbot plans', 'chatbot subscription', 'lead capture pricing'],
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
