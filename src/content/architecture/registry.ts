import type { FeatureArchitecture } from './types';

// Single source of truth for the /architecture pages. See
// docs/architecture-canvas-plan.md ("Data sourcing and maintenance"): each entry
// is hand-authored from the real code it abstracts, scrubbed of secrets (no keys,
// DSNs, endpoint paths, tenant IDs, or table DDL). The comment above each authored
// entry names the source modules it abstracts, so touching that code flags that
// the diagram may need a matching edit.
//
// Curated `position` values lay the overview map out as a left-to-right flow:
// delivery surfaces and knowledge sources on the left feed the core brains in the
// middle, which emit analytics on the right; the platform underpins from the bottom.
export const architectureRegistry: FeatureArchitecture[] = [
  // Grounds: ChatWidget.tsx + the embed route (script -> session token -> widget).
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
    narrative:
      'A single script tag mounts the chat on any website. The embed route hands the widget a scoped session token, so the same ChatWidget that powers the dashboard preview runs live on customer sites with no extra build step.',
    dataFlow: {
      nodes: [
        { id: 'site', kind: 'client', label: 'Customer site', sub: 'one snippet' },
        { id: 'loader', kind: 'client', label: 'Widget loader', sub: 'script tag' },
        { id: 'embed', kind: 'service', label: 'Embed route', sub: 'issues session token' },
        { id: 'widget', kind: 'client', label: 'Chat widget', sub: 'ChatWidget' },
        { id: 'api', kind: 'service', label: 'Chat API', sub: 'FastAPI' },
      ],
      edges: [
        { source: 'site', target: 'loader', label: 'loads script' },
        { source: 'loader', target: 'embed', label: 'requests widget' },
        { source: 'embed', target: 'widget', label: 'session token', animated: true },
        { source: 'widget', target: 'api', label: 'chat', animated: true },
        { source: 'api', target: 'widget', label: 'reply' },
      ],
    },
    mermaid: {
      type: 'sequence',
      summary:
        'The customer site loads the snippet, which asks the embed route for the widget. The embed route mounts the chat widget with a scoped session token; the widget then exchanges messages with the chat API and streams replies back to the visitor.',
      code: `sequenceDiagram
    participant S as Customer site
    participant L as Widget loader
    participant E as Embed route
    participant W as Chat widget
    participant A as Chat API
    S->>L: Loads the snippet
    L->>E: Requests the widget
    E-->>W: Mounts with a scoped session token
    W->>A: Sends visitor messages
    A-->>W: Streams replies`,
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
  // Grounds: catalog_import.py + the URL scraper (Jina renderer + BeautifulSoup
  // extraction, sitemap-first full-site discovery).
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
    narrative:
      'Uploads are sorted by type. Web pages are rendered and cleanly extracted, catalog spreadsheets are mapped into structured product tables, and everything else is chunked and embedded into the vector store, so the bot can retrieve it later.',
    dataFlow: {
      nodes: [
        { id: 'source', kind: 'client', label: 'Upload or URL', sub: 'files, sheets, sites' },
        { id: 'ingest', kind: 'service', label: 'Ingestion', sub: 'detect + route' },
        { id: 'scraper', kind: 'service', label: 'URL scraper', sub: 'Jina + BeautifulSoup' },
        { id: 'catalog', kind: 'service', label: 'Catalog import', sub: 'structured rows' },
        { id: 'chunker', kind: 'service', label: 'Chunk + embed' },
        { id: 'vectors', kind: 'datastore', label: 'pgvector', sub: 'RAG chunks' },
        { id: 'tables', kind: 'datastore', label: 'Catalog tables', sub: 'products + SKUs' },
      ],
      edges: [
        { source: 'source', target: 'ingest' },
        { source: 'ingest', target: 'scraper', label: 'web pages' },
        { source: 'ingest', target: 'catalog', label: 'catalog sheets' },
        { source: 'ingest', target: 'chunker', label: 'docs + text' },
        { source: 'scraper', target: 'chunker', label: 'extracted text' },
        { source: 'chunker', target: 'vectors', label: 'embeddings', animated: true },
        { source: 'catalog', target: 'tables', label: 'rows', animated: true },
      ],
    },
    mermaid: {
      type: 'flowchart',
      summary:
        'An upload or URL is detected by type. Web pages are scraped with a renderer plus HTML extraction, catalog sheets are mapped and cleaned into product tables, and documents or text are chunked and embedded into pgvector for retrieval.',
      code: `flowchart TD
    U["Upload or URL"] --> D{"Detect type"}
    D -->|Web page| S["Scrape - render + extract"]
    D -->|Catalog sheet| C["Catalog import - map + clean rows"]
    D -->|Document or text| K["Chunk and embed"]
    S --> K
    K --> V[("pgvector - searchable chunks")]
    C --> T[("Catalog tables - products + SKUs")]`,
    },
  },
  // Grounds: byod_client.py + the routing_enabled routing logic.
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
    narrative:
      "When a tenant connects their own database, a routing switch decides where each query is answered: read-only from the customer's isolated database, or from the default vector knowledge base. Either way, the retrieved context grounds the model's answer.",
    dataFlow: {
      nodes: [
        { id: 'visitor', kind: 'client', label: 'Visitor', sub: 'asks a question' },
        { id: 'api', kind: 'service', label: 'Chat API', sub: 'FastAPI' },
        { id: 'router', kind: 'service', label: 'Query router', sub: 'routing switch' },
        { id: 'owndb', kind: 'datastore', label: 'Customer database', sub: 'isolated, read-only' },
        { id: 'vectors', kind: 'datastore', label: 'Default knowledge', sub: 'pgvector' },
        { id: 'gemini', kind: 'llm', label: 'Gemini', sub: 'grounded answer' },
      ],
      edges: [
        { source: 'visitor', target: 'api' },
        { source: 'api', target: 'router' },
        { source: 'router', target: 'owndb', label: 'routing on', animated: true },
        { source: 'router', target: 'vectors', label: 'routing off' },
        { source: 'owndb', target: 'gemini', label: 'rows as context' },
        { source: 'vectors', target: 'gemini', label: 'chunks as context' },
        { source: 'gemini', target: 'api', label: 'answer' },
        { source: 'api', target: 'visitor', label: 'reply' },
      ],
    },
    mermaid: {
      type: 'sequence',
      summary:
        "A visitor's question reaches the query router. When routing is enabled it reads scoped rows from the customer's own isolated database; otherwise it retrieves ranked chunks from the default pgvector store. The chosen context is sent to Gemini, which returns a grounded answer.",
      code: `sequenceDiagram
    participant V as Visitor
    participant A as Chat API
    participant R as Query router
    participant DB as Customer database
    participant K as Default knowledge
    participant G as Gemini
    V->>A: Asks a question
    A->>R: Route the query
    alt Routing enabled
        R->>DB: Read from the customer's own database
        DB-->>R: Scoped rows
    else Default
        R->>K: Retrieve from pgvector
        K-->>R: Ranked chunks
    end
    R->>G: Question plus context
    G-->>A: Grounded answer
    A-->>V: Shows the answer`,
    },
  },
  // Grounds: the RAG modules in services/ + the chat endpoint (retrieve from
  // pgvector -> rank chunks -> Gemini answer).
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
    narrative:
      'Every question is embedded and matched against the tenant knowledge base in pgvector. The top-ranked chunks are handed to Gemini as context, so answers stay grounded in the customer’s own content rather than invented by the model.',
    dataFlow: {
      nodes: [
        { id: 'visitor', kind: 'client', label: 'Visitor', sub: 'asks a question' },
        { id: 'widget', kind: 'client', label: 'Chat widget', sub: 'embedded on site' },
        { id: 'api', kind: 'service', label: 'Chat API', sub: 'FastAPI' },
        { id: 'retriever', kind: 'service', label: 'RAG retrieval', sub: 'embed + rank' },
        { id: 'vectors', kind: 'datastore', label: 'Knowledge store', sub: 'pgvector' },
        { id: 'gemini', kind: 'llm', label: 'Gemini', sub: 'grounded answer' },
      ],
      edges: [
        { source: 'visitor', target: 'widget' },
        { source: 'widget', target: 'api', label: 'question' },
        { source: 'api', target: 'retriever' },
        { source: 'retriever', target: 'vectors', label: 'similarity search', animated: true },
        { source: 'vectors', target: 'retriever', label: 'top chunks' },
        { source: 'retriever', target: 'gemini', label: 'context + question', animated: true },
        { source: 'gemini', target: 'api', label: 'answer' },
        { source: 'api', target: 'widget', label: 'streamed reply', animated: true },
      ],
    },
    mermaid: {
      type: 'sequence',
      summary:
        'A visitor asks a question in the widget. The chat API embeds the query, runs a similarity search over the pgvector knowledge store, and sends the top-ranked chunks plus the question to Gemini. Gemini returns a grounded answer that is streamed back to the visitor.',
      code: `sequenceDiagram
    participant V as Visitor
    participant W as Chat widget
    participant A as Chat API
    participant R as RAG retrieval
    participant DB as pgvector store
    participant G as Gemini
    V->>W: Asks a question
    W->>A: Sends the message
    A->>R: Embed the query
    R->>DB: Similarity search
    DB-->>R: Top-ranked chunks
    R->>G: Question plus retrieved context
    G-->>A: Grounded answer
    A-->>W: Streamed reply
    W-->>V: Shows the answer`,
    },
  },
  // Grounds: run_agent_loop + the chemical pack in packs/ + qualification.py +
  // agent_handoff.py (ReAct loop with tool calls and Slack/Resend owner handoff).
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
    narrative:
      'The agent runs a reasoning loop: it thinks, picks a grounded tool (catalog lookup, quote, sample request), and acts, repeating until it can help. When a visitor is ready, it proposes a quote or sample and hands off to the owner over Slack and email rather than transacting on its own.',
    dataFlow: {
      nodes: [
        { id: 'visitor', kind: 'client', label: 'Visitor', sub: 'states a need' },
        { id: 'agent', kind: 'service', label: 'Agent loop', sub: 'ReAct reasoning' },
        { id: 'gemini', kind: 'llm', label: 'Gemini', sub: 'plans next step' },
        { id: 'tools', kind: 'service', label: 'Tools', sub: 'quote, sample, catalog' },
        { id: 'catalog', kind: 'datastore', label: 'Catalog + docs', sub: 'grounded facts' },
        { id: 'owner', kind: 'external', label: 'Owner handoff', sub: 'Slack + Resend' },
      ],
      edges: [
        { source: 'visitor', target: 'agent' },
        { source: 'agent', target: 'gemini', label: 'reason', animated: true },
        { source: 'gemini', target: 'agent', label: 'next action' },
        { source: 'agent', target: 'tools', label: 'call tool' },
        { source: 'tools', target: 'catalog', label: 'look up' },
        { source: 'catalog', target: 'tools', label: 'facts' },
        { source: 'tools', target: 'agent', label: 'result' },
        { source: 'agent', target: 'owner', label: 'quote / sample', animated: true },
        { source: 'agent', target: 'visitor', label: 'reply' },
      ],
    },
    mermaid: {
      type: 'sequence',
      summary:
        'The agent loops: it asks Gemini for the next step, runs a grounded tool such as a catalog lookup, quote, or sample request, and feeds the result back. When the visitor is ready it hands off the quote or sample to the owner over Slack and email, then confirms with the visitor.',
      code: `sequenceDiagram
    participant V as Visitor
    participant A as Agent loop
    participant G as Gemini
    participant T as Tools
    participant O as Owner
    V->>A: States a need
    loop ReAct reasoning
        A->>G: Think about the next step
        G-->>A: Choose a tool
        A->>T: Run tool - catalog, quote, sample
        T-->>A: Grounded result
    end
    A->>O: Hand off quote or sample
    O-->>A: Owner follows up
    A-->>V: Confirms and answers`,
    },
    guardrails: [
      'SDS, hazard, and handling answers come only from tool-returned documents, never model-generated.',
      'Prices, products, and quotes are grounded in retrieved catalog data, never invented by the model.',
      'Human-in-the-loop: the agent proposes quotes and samples and hands off to the owner; it never autonomously transacts or commits pricing.',
      'Tenant isolation: every query is company-scoped, with no cross-tenant data.',
      'Data privacy: visitor memory is self-deletable, messages are retained at most one year, and summarized memory is injection-defended.',
      'Cost governance and anti-abuse: per-tenant token metering, caps, and rate limiting on the agent surface.',
      'Transparent qualification tracks known and unknown facts; models are Google Gemini tiers.',
    ],
  },
  // Grounds: the token/cost rollup code (build_token_metrics) + the analytics
  // dashboard panels.
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
    narrative:
      'Every conversation turn logs its tokens, cost, and events. A rollup turns that raw log into the owner-facing views: engagement funnels, ROI, and per-tenant token cost that feeds metering and caps.',
    dataFlow: {
      nodes: [
        { id: 'chats', kind: 'service', label: 'Conversations', sub: 'every message' },
        { id: 'logs', kind: 'datastore', label: 'Chat logs', sub: 'tokens + events' },
        { id: 'rollup', kind: 'service', label: 'Metrics rollup', sub: 'aggregate' },
        { id: 'funnels', kind: 'service', label: 'Funnel + ROI' },
        { id: 'dash', kind: 'client', label: 'Insights dashboard', sub: 'owner view' },
      ],
      edges: [
        { source: 'chats', target: 'logs', label: 'log tokens + turns', animated: true },
        { source: 'logs', target: 'rollup' },
        { source: 'rollup', target: 'funnels' },
        { source: 'rollup', target: 'dash', label: 'cost per tenant', animated: true },
        { source: 'funnels', target: 'dash', label: 'funnel + ROI' },
      ],
    },
    mermaid: {
      type: 'flowchart',
      summary:
        'Each conversation turn writes tokens, cost, and events to the chat log. A metrics rollup aggregates that log into engagement funnels and ROI plus per-tenant token cost, and both feed the owner-facing insights dashboard.',
      code: `flowchart LR
    M["Each conversation turn"] --> L[("Chat logs - tokens, cost, events")]
    L --> R["Metrics rollup"]
    R --> F["Funnels and ROI"]
    R --> C["Per-tenant token cost"]
    F --> D["Insights dashboard"]
    C --> D`,
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
