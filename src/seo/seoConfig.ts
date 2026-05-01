const OG_IMAGE = {
  url: 'https://www.sapybase.com/SB_Brand-removebg.png',
  width: 1200,
  height: 630,
  alt: 'Sapybase — Autonomous AI Chatbots',
};

export const seoConfig = {
  home: {
    title: 'Sapybase | Autonomous AI Chatbots for Modern Business',
    description:
      'Automate your customer support and sales with Sapybase AI agents. Connect your documents and databases to deploy custom AI chatbots in minutes. Intelligent automation for the modern web.',
    canonical: 'https://www.sapybase.com/',
    keywords: ['AI chatbot', 'autonomous AI agents', 'customer support automation', 'Sapybase', 'LLM integration', 'RAG pipeline'],
    ogImage: OG_IMAGE,
  },
  about: {
    title: 'About Sapybase | The Future of Autonomous AI Agents',
    description:
      'Sapybase is an engineering studio dedicated to building autonomous AI infrastructure. We simplify complex AI integration for businesses of all sizes, ensuring speed and reliability.',
    canonical: 'https://www.sapybase.com/about',
    keywords: ['about Sapybase', 'AI engineering studio', 'autonomous AI infrastructure', 'Ayush Satvara'],
    ogImage: OG_IMAGE,
  },
  contact: {
    title: 'Build Your AI Bot | Contact Sapybase',
    description:
      'Ready to automate? Contact Sapybase for a consultation on deploying custom AI chatbots for your business. Scalable, intelligent, and production-ready solutions.',
    canonical: 'https://www.sapybase.com/contact',
    keywords: ['contact Sapybase', 'AI chatbot consultation', 'deploy AI bot', 'custom AI solution'],
    ogImage: OG_IMAGE,
  },
  services: {
    title: 'AI Chatbot Solutions & Custom Integration | Sapybase',
    description:
      'Explore Sapybase AI-driven solutions: from custom LLM training (RAG) to seamless multi-platform integration. Build intelligent systems that grow with your business.',
    canonical: 'https://www.sapybase.com/services',
    keywords: ['AI services', 'custom LLM training', 'RAG pipeline', 'chatbot integration', 'multi-platform AI'],
    ogImage: OG_IMAGE,
  },
  pricing: {
    title: 'Pricing Plans | Sapybase AI Chatbot',
    description:
      'Simple, transparent pricing for every stage of your business. Start free, scale as you grow — from solo projects to enterprise AI deployments with Sapybase.',
    canonical: 'https://www.sapybase.com/pricing',
    keywords: ['Sapybase pricing', 'AI chatbot plans', 'chatbot subscription', 'enterprise AI pricing'],
    ogImage: OG_IMAGE,
  },
  docs: {
    title: 'Documentation | Sapybase',
    description: 'Step-by-step guide to integrating, training, and customizing your Sapybase AI chatbot.',
    canonical: 'https://www.sapybase.com/docs',
    keywords: ['Sapybase docs', 'chatbot integration guide', 'AI bot setup', 'API documentation'],
    ogImage: OG_IMAGE,
  },
  privacy: {
    title: 'Privacy Policy | Sapybase',
    description:
      'Read the Sapybase privacy policy to understand how we collect, use, and protect your personal information.',
    canonical: 'https://www.sapybase.com/privacy-policy',
    keywords: ['Sapybase privacy policy', 'data protection', 'GDPR'],
    ogImage: OG_IMAGE,
  },
  terms: {
    title: 'Terms & Conditions | Sapybase',
    description:
      'Review the Sapybase terms and conditions governing use of our services, intellectual property, and service agreements.',
    canonical: 'https://www.sapybase.com/terms-and-conditions',
    keywords: ['Sapybase terms', 'terms of service', 'service agreement'],
    ogImage: OG_IMAGE,
  },
} as const;

export type SeoKey = keyof typeof seoConfig;
