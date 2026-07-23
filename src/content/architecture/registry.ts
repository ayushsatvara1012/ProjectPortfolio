import type { FeatureArchitecture } from './types';

// Single source of truth for the /architecture pages. See
// docs/architecture-canvas-plan.md ("Data sourcing and maintenance"): each entry
// is hand-authored from the real code it abstracts, scrubbed of secrets. The
// overview map is derived entirely from the `overview` blocks below. Authored
// per-feature diagrams (dataFlow + mermaid + narrative) land in Phase 3; until
// then hasDetail:true entries carry no diagrams yet.
//
// Curated `position` values lay the map out as a left-to-right flow: delivery
// surfaces and knowledge sources on the left feed the core brains in the middle,
// which emit analytics on the right; the platform underpins from the bottom.
export const architectureRegistry: FeatureArchitecture[] = [
  {
    id: 'embed-widget',
    name: 'Embeddable Widget',
    tagline: 'One snippet drops the chat onto any customer site.',
    status: 'live',
    hasDetail: true,
    overview: {
      icon: 'widgets',
      group: 'delivery',
      connectsTo: ['chatbot-rag'],
      position: { x: 0, y: 0 },
    },
  },
  {
    id: 'contextual-teaser',
    name: 'Contextual Teaser',
    tagline: 'A page-aware bubble that proactively starts the conversation.',
    status: 'live',
    hasDetail: false,
    overview: {
      icon: 'campaign',
      group: 'delivery',
      connectsTo: ['embed-widget'],
      position: { x: 0, y: 140 },
    },
  },
  {
    id: 'knowledge-ingestion',
    name: 'Knowledge Ingestion',
    tagline: 'Files, URLs, and catalogs become searchable knowledge.',
    status: 'live',
    hasDetail: true,
    overview: {
      icon: 'cloud_upload',
      group: 'ingestion',
      connectsTo: ['chatbot-rag', 'vertical-agent'],
      position: { x: 0, y: 320 },
    },
  },
  {
    id: 'byod',
    name: 'Bring Your Own Database',
    tagline: "Route answers to a customer's own database, safely isolated.",
    status: 'live',
    hasDetail: true,
    overview: {
      icon: 'database',
      group: 'ingestion',
      connectsTo: ['chatbot-rag'],
      position: { x: 0, y: 460 },
    },
  },
  {
    id: 'chatbot-rag',
    name: 'AI Chatbot + RAG',
    tagline: 'pgvector retrieval grounds every answer in your knowledge.',
    status: 'live',
    hasDetail: true,
    overview: {
      icon: 'chat',
      group: 'core',
      connectsTo: ['vertical-agent', 'insights'],
      position: { x: 360, y: 150 },
    },
  },
  {
    id: 'vertical-agent',
    name: 'Vertical AI Agent',
    tagline: 'A ReAct loop that quotes, samples, and hands off to a human.',
    status: 'live',
    hasDetail: true,
    overview: {
      icon: 'smart_toy',
      group: 'core',
      connectsTo: ['insights'],
      position: { x: 360, y: 370 },
    },
  },
  {
    id: 'insights',
    name: 'Insights + Cost Metering',
    tagline: 'Conversations become funnels, ROI, and per-tenant token cost.',
    status: 'live',
    hasDetail: true,
    overview: {
      icon: 'insights',
      group: 'delivery',
      connectsTo: [],
      position: { x: 720, y: 260 },
    },
  },
  {
    id: 'multi-tenant',
    name: 'Multi-Tenant Platform',
    tagline: 'Clerk auth, tenant isolation, and Explore-tier billing under it all.',
    status: 'live',
    hasDetail: false,
    overview: {
      icon: 'apartment',
      group: 'platform',
      connectsTo: ['chatbot-rag'],
      position: { x: 180, y: 580 },
    },
  },
];

export function getFeature(id: string): FeatureArchitecture | undefined {
  return architectureRegistry.find((f) => f.id === id);
}
