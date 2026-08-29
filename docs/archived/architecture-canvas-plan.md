# Architecture Canvas - Plan

## Goal

A public, immersive `/architecture` page that documents Vaayu's product architecture for prospects and investors.
The experience is a full-viewport, distraction-free canvas: no site navbar, no footer, no chrome.
An interactive overview system map (React Flow) links every major feature.
Clicking a feature drills into a detail view with two complementary diagrams: a React Flow data-flow map (structure) and a Mermaid sequence/state diagram (behavior over time).

## Locked decisions

- Audience: public marketing / investors.
- Layout: full-bleed immersive canvas, zero site chrome, only a fixed top-left back control.
- Structure: overview system map + per-feature drill-in.
- Diagram pairing (default A): React Flow data-flow map (structure) + Mermaid sequence diagram (behavior).
  The Mermaid diagram type may vary per feature (sequence, state, ER, flowchart) where it tells a better story; React Flow stays the consistent canvas identity.
- Depth: detailed flows. Real stack names (Next.js, FastAPI, Gemini, Supabase/pgvector, Clerk, Resend, Polar) and real steps (RAG retrieval, ReAct tool calls, token metering).
- Content source: config/registry-driven. One typed registry is the single source of truth.
- Drill-in: dedicated shareable routes (`/architecture/[feature]`), not an in-canvas panel.
- Stack: `@xyflow/react` 12 + `mermaid` 11 on Next 16 + React 19. Verified compatible (see Stack verification).

## Guardrails (public page)

- Never render: API keys, DSNs, internal endpoint paths, table DDL, tenant IDs, credentials.
- "Detailed" means conceptually deep, not a secrets leak.

## Immersive layout and routing

The site navbar and footer are injected by `src/app/(app)/(site)/layout.tsx`.
Anything under `(site)` inherits that chrome; the outer `src/app/(app)/layout.tsx` has no navbar/footer.
The existing `src/app/(app)/demo/` route already lives outside `(site)` and is chrome-free, which is the precedent to follow.

Placement:

- New route group at `src/app/(app)/architecture/` (sibling of `(site)` and `demo`, so it inherits no navbar/footer).
- `src/app/(app)/architecture/layout.tsx`: chrome-free, full-viewport (`h-[100dvh] w-screen overflow-hidden`), renders the fixed back control plus `children`. Sets page metadata.
- `src/app/(app)/architecture/page.tsx`: the overview canvas. Server Component shell (title/meta) mounting the client canvas.
- `src/app/(app)/architecture/[feature]/page.tsx`: the detail view. Server Component shell mounting the two client diagrams plus narrative.

Back control (fixed, top-left):

- Overview page: "Back to home" -> `/`.
- Detail page: "Back to architecture" -> `/architecture` (natural hierarchy; keeps the immersive flow rather than jumping home).
- Single small control, high-contrast, theme-aware, respects safe-area insets on mobile.

Discoverability:

- Add one link to `/architecture` in the main site `Navbar` (and optionally footer). The destination page itself remains chrome-free.

## The registry (config-driven core)

One typed source of truth. Adding or updating a feature = editing one entry, with zero bespoke wiring.

```ts
type NodeKind = 'client' | 'service' | 'datastore' | 'llm' | 'queue' | 'external';

interface FeatureArchitecture {
  id: string;                 // slug -> /architecture/[id]
  name: string;
  tagline: string;
  status: 'live' | 'planned';
  hasDetail: boolean;         // false => "detail coming soon" drill-in
  overview: {                 // drives the system map
    icon: string;             // Material Symbol
    group: string;            // 'ingestion' | 'core' | 'delivery' | 'platform'
    connectsTo: string[];     // edge targets (other feature ids)
    position?: { x: number; y: number }; // optional curated override
  };
  dataFlow?: {                // React Flow detail (structure)
    nodes: { id: string; kind: NodeKind; label: string; sub?: string }[];
    edges: { source: string; target: string; label?: string; animated?: boolean }[];
  };
  mermaid?: {                 // Mermaid detail (behavior)
    type: 'sequence' | 'state' | 'er' | 'flowchart';
    code: string;             // authored mermaid string
    summary: string;          // plain-text a11y fallback + SEO
  };
  narrative?: string;
}
```

- The overview canvas is derived from every entry's `overview` block (auto-layout, with optional curated `position`).
- The drill-in renders that entry's `dataFlow` (React Flow) plus `mermaid` (string -> rendered diagram) plus `narrative`.
- Custom node kinds each get a distinct branded style + icon: `client`, `service`, `datastore`, `llm`, `queue`, `external`.

## Data sourcing and maintenance

This section records where the architecture content comes from and how it stays truthful as features evolve.
It is a locked decision, not an open question.

### Source of truth: hand-authored, code-grounded, public-safe registry

Three sourcing models were considered:

- Auto-generate from the code graph (AST / call-graph scan). Rejected: the real call-graph of a feature is hundreds of nodes and would surface exactly what the public-page guardrails forbid (endpoint paths, table names, module structure). It produces a dependency map, not a narrative.
- Live runtime introspection (page queries the backend to draw itself). Rejected: a public marketing page must never call internal APIs, and it would leak internals.
- Hand-authored typed registry (one `FeatureArchitecture` entry per feature). Chosen.

"Hand-authored" does not mean invented.
Each entry is derived by reading the real implementation, then abstracting it to a public-safe conceptual flow (the story, scrubbed of secrets).
The mapping from feature to the code that grounds it:

| Feature | Grounding source in the codebase |
|---|---|
| AI Chatbot + RAG | `sapybase_ai_engine/services/` RAG modules + the chat endpoint in `main.py` (retrieve from pgvector -> rank chunks -> Gemini answer) |
| Vertical AI Agent | `run_agent_loop`, the chemical pack in `packs/`, `services/qualification.py`, `agent_handoff.py` (ReAct loop + Slack/Resend owner handoff) |
| Knowledge Ingestion | `catalog_import.py`, the URL scraper (Jina renderer + BeautifulSoup extraction) |
| Insights / metering | the token/cost rollup code (`build_token_metrics`) |
| BYOD | `byod_client.py`, the `routing_enabled` routing logic |
| Embeddable widget | `ChatWidget.tsx` and the embed route |

Pipeline: read the real code -> abstract to a public-safe conceptual flow -> encode as a registry entry.
The diagram is accurate to how the system behaves, but stripped to the story and free of secrets.

### How it stays updated when a feature changes

- One place to edit. A feature change means editing one registry entry (`dataFlow` nodes/edges or the `mermaid.code` string). The overview map, detail route, `generateStaticParams`, sitemap entry, and per-route metadata all re-derive from that entry. No entry is wired by hand anywhere else. A brand-new feature is one appended object; its route, sitemap row, and metadata appear on the next build with zero extra wiring.
- Tests catch structural drift. The registry-invariants test (`hasDetail: true` implies both diagrams; every `connectsTo` resolves; ids unique and URL-safe) and the mermaid-parse test (every `mermaid.code` parses) fail CI if the registry is internally broken or a diagram has a typo.
- Honest limitation. No test can detect that a feature's real behavior drifted from its diagram; keeping the content truthful stays a human step by design (the alternative, auto-generation, was rejected above). Mitigation is process, not magic: each registry entry carries a short comment naming the source modules it abstracts, so touching that code during review flags that the entry may need a matching edit - the same plan-and-memory pairing discipline used elsewhere. This is the drift risk named in the Risks section, accepted deliberately.

## Feature coverage

The registry lists all 8 major features so the overview map reads as complete.
Only 5-6 receive authored two-diagram detail for the prototype; the rest render a "detail coming soon" drill-in (`hasDetail: false`).

Prototype (full two-diagram treatment):

1. AI Chatbot + RAG knowledge base - pgvector retrieval -> Gemini answer.
2. Vertical AI Agent - ReAct loop, chemical pack, tool calls (quote, sample request), owner handoff (Slack/Resend).
3. Knowledge Ingestion - file/catalog upload, URL scraper with full-site discovery, structured catalog import.
4. Insights / BI + cost metering - analytics dashboard, token/cost rollups.
5. BYOD - bring-your-own-database routing + client self-serve onboarding.
6. Embeddable widget - the ChatWidget on customer sites.

Listed now, diagrams later (`hasDetail: false`):

7. Contextual teaser - page-aware proactive bubble.
8. Multi-tenant platform - Clerk auth, tenant isolation, Explore freemium/billing.

## Stack verification (why no alternative library is needed)

React Flow (`@xyflow/react` 12.11.2):

- Peer deps are `react >=17`, so React 19 is fully supported.
- v12 was rebuilt with SSR in mind, fixing the Next.js issues v11 had; an official Next.js example app exists.
- It is interactive by nature, so it is a client component regardless. Clean fit with Next 16.

Mermaid (11.16.0):

- The only real constraint is a general Next.js App Router rule: `dynamic(..., { ssr: false })` cannot be called from a Server Component (it throws).
- Fix, designed in from Phase 0: the Mermaid diagram is a `'use client'` component that renders a skeleton on first paint, then calls `mermaid.render()` in `useEffect` (browser-only) and swaps in the SVG after mount. No server HTML for the SVG means no hydration mismatch by construction.
- The `ssr: false` dynamic import lives inside a client wrapper, never in the server page shell. The shell (title/meta) stays a Server Component for SEO/LCP.

Conclusion: keep `@xyflow/react` + `mermaid`. No stack change.

## Performance

- Diagrams are lazy-loaded via `next/dynamic` (`ssr: false`) inside client wrappers, scoped to `/architecture` routes only. React Flow and Mermaid never enter the shared/global bundle.
- Overview LCP is the text hero/title, which hydrates before the canvas.
- Mermaid is parsed on-demand only when a detail route mounts, never on the overview.
- Respect `prefers-reduced-motion`: disable animated edges and any auto-motion.
- Phase 4 perf upgrade - build-time Mermaid prerender: because Mermaid diagrams are static authored strings in the registry, prerender them to static SVG at build time so the marketing page ships no Mermaid runtime at all (best LCP, SVG present in initial HTML for SEO). React Flow stays client since it is the interactive piece.
- Target: green Core Web Vitals on the overview route; run a Lighthouse pass in Phase 4.

## Interactivity (rich + animated)

- Overview: animated data-flow edges, pan/zoom, minimap, zoom/fit controls, hover highlights, clickable nodes that route to the detail page.
- Branded custom node components (no default gray boxes), theme-aware (light/dark).
- Sensible default `fitView` on load; pinch-zoom on mobile.

## Accessibility

- A canvas is not readable by screen readers, so every diagram ships a text summary.
  The Mermaid `summary` field and the React Flow node/edge labels provide the accessible description; `narrative` doubles as the readable fallback.
- Keyboard-focusable nodes, visible focus states, contrast-checked in both themes.
- The back control is a real link/button with an accessible label.

## Design and brand

- Tailwind 4, Plus Jakarta Sans (`font-google`), Material Symbols Outlined.
- Matches the warm-editorial site aesthetic; theme-aware light/dark.
- Full-viewport dark or tinted canvas backdrop that reads as a "control room" for the immersive feel.

## AI agent: operating rules and depiction guardrails

The Vertical AI Agent is depicted on this public page, so its detail view carries a small "guardrails" strip.
This section governs what we show and how.

### A. The agent's real operating rules (represent accurately)

These are true constraints in the codebase; the detail view surfaces them as a trust signal.
Represent them at category level, in plain language, no thresholds or bypass detail.

- SDS / hazard / handling answers come ONLY from tool-returned documents, never model-generated (safety-critical; aligns with the GHS / OSHA HazCom source-of-truth principle).
- Grounded-only: prices, products, and quotes come from retrieved catalog/tables or tools, never invented by the model.
- Human-in-the-loop: the agent proposes quotes/samples and hands off to the owner (Slack / Resend); it does not autonomously transact or commit pricing.
- Tenant isolation: every query is company-scoped (`WHERE company_id`); no cross-tenant data.
- Data privacy: visitor memory is self-deletable, messages are retained at most 1 year, and summarized memory is injection-defended.
- Cost governance and anti-abuse: per-tenant token metering, caps, and rate limiting on the agent surface.
- Transparent qualification (KNOWN / UNKNOWN fact tracking, no covert profiling) and model transparency (Google Gemini tiers).

### B. Publication guardrails (rules our depiction must obey)

- Only depict guardrails that actually exist in code. No aspirational or false safety claims.
- Category-level only, never bypass-enabling: no rate-limit thresholds, no exact prompt-injection filters, no secret system prompts, no abuse-enabling tool schemas.
- No compliance certifications we do not hold (no "GDPR / SOC2 certified" unless true). Describe design principles, not certifications.
- No secrets: keys, DSNs, endpoint paths, tenant IDs, table DDL (repeats the public-page guardrail).
- Keep the SDS / safety-critical rule prominent; it is the strongest trust signal for the chemical vertical.

## SEO, metadata, and static generation

- These routes are fully known at build time from the registry, so both `/architecture` and `/architecture/[feature]` are statically generated (SSG) via `generateStaticParams` over the registry ids. Best possible LCP and crawlability.
- Per-route metadata: unique `title` + `description` per feature (pull from `name` / `tagline` / `narrative`), plus OpenGraph + Twitter card tags so shared links (investor decks, sales) render a clean preview.
- Add `/architecture` and every `/architecture/[feature]` URL to the site `sitemap.xml`.
- Invalid slug -> `notFound()` (404). `hasDetail: false` still renders a real page (a "detail coming soon" state), so its route is valid and indexable.
- Immersive routes carry no navbar/footer; they inherit site/system theme (no separate theme toggle unless we decide to add one).

## States: loading, error, empty

- Loading: React Flow and Mermaid are lazy-loaded, so each diagram shows a lightweight skeleton until mounted.
- Error: wrap each diagram in an error boundary. If `mermaid.render()` throws, fall back to the plain-text `summary` instead of a blank box; if React Flow fails, show the node/edge list as text. The page never white-screens on one bad diagram.
- Empty: `hasDetail: false` features render a tasteful "detail coming soon" panel with the tagline, not a broken/empty canvas.

## Testing and validation

Suite stays green (vitest, `tsc --noEmit`, `npm run lint`) between slices.

- Registry-invariants test (vitest): `hasDetail: true` implies both `dataFlow` and `mermaid` are present; every `overview.connectsTo` id resolves to a real registry entry; ids are unique and URL-safe.
- Mermaid parse test: every authored `mermaid.code` parses without error (guards against a typo shipping a broken diagram).
- A11y: each diagram exposes a text alternative (`mermaid.summary` / node labels / `narrative`); back control is a labeled link; nodes are keyboard-focusable.
- Type safety: the registry is fully typed; no `any`.

## Definition of done

- `/architecture` renders the immersive overview (no chrome, back-to-home control, animated edges, pan/zoom, minimap) and drills into every listed feature.
- The 5-6 prototype features show both diagrams plus narrative; the other two show "detail coming soon".
- Agent detail view shows the guardrails strip per the rules above.
- SSG + per-route metadata + OG + sitemap in place; bad slug 404s.
- Diagram libs are absent from the shared bundle; overview passes a Lighthouse pass with green Core Web Vitals; `prefers-reduced-motion` respected.
- Suite green (vitest, tsc 0, lint 0), registry-invariants + mermaid-parse tests included.

## Phasing

- Phase 0 - Scaffold: add `@xyflow/react` + `mermaid`; create the `architecture` route group + chrome-free `layout.tsx` + back control; registry types + empty registry; branded node components; client-wrapper dynamic-import pattern (handles the SSR constraint up front); diagram error boundary + skeletons.
- Phase 1 - Overview canvas: derive the system map from the registry (all 8 nodes), animated edges, drill-in navigation, Navbar link; `prefers-reduced-motion` handling.
- Phase 2 - Detail template: the `[feature]` route rendering React Flow + Mermaid + narrative from a registry entry; SSG (`generateStaticParams`) + per-route metadata + OG; `notFound()` for bad slugs; "detail coming soon" empty state; responsive (diagrams stack on mobile) + a11y.
- Phase 3 - Author the 5-6: write real `dataFlow` + `mermaid` for the prototype features; add the agent guardrails strip; registry-invariants + mermaid-parse tests; sitemap entries.
- Phase 4 - Polish: theming, mobile, Mermaid build-time prerender, Lighthouse/perf pass, final a11y + suite-green check.

## Open questions to confirm during build

- Back-control target on detail pages: "Back to architecture" (recommended) vs literally "Back to home". Default is back to the map.
- Overview auto-layout vs hand-placed node positions for the cleanest first impression (can start auto, then curate positions).
- Agent guardrails strip: show the full category list (recommended, strong trust signal) vs a minimal version. Default is the full category-level list, no thresholds.
- Theme control on the chrome-free page: inherit site/system theme (default) vs add a small in-canvas theme toggle.

## Risks (now known patterns, not blockers)

- Mermaid + Next 16 SSR: handled by the client-wrapper + `useEffect` render pattern from Phase 0.
- Diagram accuracy drift as features evolve: the registry keeps everything in one place; graphify-assisted generation can be revisited later, but hand-authored-from-registry is the maintainable v1.
- Mobile density: detail diagrams stack vertically; overview canvas defaults to fit-view with pinch-zoom.
