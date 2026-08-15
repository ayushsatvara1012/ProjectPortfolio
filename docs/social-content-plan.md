# Social Content Plan - Building Vaayu in Public

## Purpose

A repeatable system for posting about Vaayu/Sapybase 2-3x per week across LinkedIn, X, Instagram and YouTube.
Every post is grounded in real work from this repo - real commits, real bugs, real architecture.
No generic "AI is changing everything" content.

## Constraints and decisions

- **Disclosure**: Full. Product named (Vaayu / Sapybase), real code snippets, real UI screenshots, real architecture.
- **Never post**: `.env` contents, API keys, customer names, customer data, internal pricing PDFs, DB connection strings, exact prompt text for safety-critical tools.
- **Cadence**: 2-3 posts per week, mixed formats.
- **Platform priority**: LinkedIn (primary) > X > Instagram/Reels > YouTube.
- **Model stack rule**: this project is Gemini-only. Never claim OpenAI or Anthropic models are in the stack.

## Positioning

One line that has to work for all four audiences:

> I am building Vaayu - an AI chat layer that sits on a business's website and answers both customers and staff from the company's own data, with a BI dashboard behind it.

Per-audience framing of the same fact:

| Audience | What they need to see | Framing |
|---|---|---|
| Hiring managers | Engineering judgment under real constraints | "Here is the tradeoff I made and why" |
| SMB owners / customers | A problem they recognise | "Your team answers the same 40 questions a week" |
| Dev peers | Specificity they can steal | Code, numbers, failure modes |
| Investors / founders | Velocity and product thinking | Shipped X in Y, here is what it unlocked |

The trick: you do not write four posts.
You write one technical post and choose the **first two lines** for the audience you want that week.
The hook is the targeting, the body is the same.

## Weekly rhythm

| Day | Slot | Format | Effort |
|---|---|---|---|
| Monday | Deep technical | LinkedIn long-form + X thread | 45 min |
| Wednesday | Bug / decision / small win | LinkedIn short + X single | 15 min |
| Friday | Visual | Diagram carousel, screen recording or Reel | 60 min |

Rule: if Friday's visual is not ready, ship Wednesday's format again rather than skipping.
Consistency beats production value.

---

## Content pillars

Twelve pillars, each backed by real work in this repo.
Each pillar has enough material for 3-5 posts, so this is roughly six months of content.

### P1 - System architecture

Next.js 16 App Router + React 19 on Vercel, FastAPI/Python 3.12 on Render, Supabase Postgres with pgvector, Redis, Clerk auth, Gemini for inference and embeddings.
Widget ships as an embedded React iframe, ~50 KB gzipped.

### P2 - The vertical pack registry

The rule that shaped the whole backend: **never write `if vertical == "chemical"`**.
Every vertical behaviour lives in a config object (`packs/schema.py` `Pack` dataclass), resolved by `load_pack(vertical)`.
The registry is safe by construction - any absent, unknown or malformed vertical resolves to `None` and falls back to the generic bot path, so a broken pack can never 500 an existing customer.

### P3 - The ReAct agent loop

`stream_agent_loop` in `services/agent.py`.
Bounded at `MAX_TOOL_ROUNDS = 4` and `MAX_CALLS_PER_ROUND = 4`.
Tools are generated from the pack (`build_tool_schemas(pack)`), not hardcoded.
Real tools: `get_sds`, `get_product_spec`, `request_quote`, `request_sample`.

### P4 - Grounded safety (the strongest differentiator)

Safety Data Sheet, hazard and handling answers come **only** from tool-returned documents.
The LLM is never allowed to generate them.
This is a hard architectural rule, not a prompt instruction - because a hallucinated hazard statement on a chemical is a real-world safety incident.

### P5 - Multi-tenant data isolation (BYOD)

Enterprise customers bring their own Postgres.
Per-tenant connection pool (max 3 connections, global ceiling 100), circuit breaker for fault isolation, credentials encrypted with AES-GCM 256, a DML-only `vaayu_runtime` role so the app can never DDL a customer's database.
Every shared-DB query is `WHERE company_id = %s`.

### P6 - Conversational BI

`services/session_bi.py` turns chat sessions into business intelligence: demand signal, stage funnel, lost sales, lead quality bands.
The chat is not the product - the chat is the data collection layer.

### P7 - Streaming and reliability

SSE streaming for the agent path.
The heartbeat bug: a slow tool round was being torn down as a dead connection.
Fix was to keep the heartbeat alive independently of the model round.

### P8 - Cost engineering

Token metering per company, cross-tenant spend rollup in super admin, bounded Gemini thinking tokens, implicit cache-read visibility.
Explicit context caching was evaluated and **rejected** - it needs a 32K prefix, which this workload never has.
Cron jobs were split specifically to cut worker memory.

### P9 - Ingestion and data quality

Excel/CSV catalog sheets route into **structured tables**, not RAG - because a price should be looked up, never embedded and approximated.
Single-sheet fan-out fills `products` + `product_skus` from one upload, config-driven.
URL training: sitemap-first full-site discovery, and in-house BeautifulSoup extraction after finding the third-party extractor was silently dropping footers and tables.

### P10 - Privacy

GDPR session deletion, retention cron, prompt injection defence, and a deliberate decision to **stop citing knowledge sources** in replies because the citation leaked internal document names to end customers.

### P11 - Testing discipline

1,125 backend test functions across 67 test files.
Groundedness tests and guardrail evals are part of the suite - the AI behaviour itself is tested, not just the plumbing.

### P12 - Frontend craft

The widget is the single source of truth for chat UI; the dashboard preview renders the real widget rather than duplicating markup.
Mobile keyboard white-gap fix, input zoom fix, 17 navbar audit findings across motion/layout/a11y, hero terrain canvas.

---

## Content bank - 30 posts

Ready to pull from. `[LI]` LinkedIn, `[X]` X thread, `[IG]` Reel, `[YT]` video.

**Architecture and design**

1. `[LI][X]` The full Vaayu architecture, one diagram, walked through layer by layer. (P1)
2. `[LI]` Why I banned `if vertical == "chemical"` from my codebase. (P2)
3. `[X]` A registry that cannot break production: how `load_pack` degrades instead of raising. (P2)
4. `[LI]` Config-as-product: adding a new industry to my AI product is a Python dataclass, not a release. (P2)
5. `[YT]` 12-minute architecture walkthrough of a production AI SaaS. (P1)
6. `[LI]` Server Components by default: what actually moved to the client and why. (P12)

**The agent**

7. `[LI][X]` I gave my chatbot tools instead of a bigger prompt. Here is the loop. (P3)
8. `[X]` Why my agent loop is capped at 4 rounds and 4 calls. (P3)
9. `[LI]` The rule that made my AI safe to sell into chemicals: it is not allowed to write the answer. (P4)
10. `[IG]` 30-second Reel: asking the bot for a Safety Data Sheet, showing the document arrive. (P4)
11. `[LI]` From RAG bot to agent: the five phases, and what broke in each. (P3)
12. `[X]` Tool schemas generated from config, not hand-written. Code screenshot. (P2/P3)

**Bugs and war stories**

13. `[LI]` The bug that only appeared for slow answers: my SSE heartbeat was killing healthy connections. (P7)
14. `[X]` Truncated AI answers root-caused to unbounded thinking tokens. Not a prompt problem. (P8)
15. `[LI]` My bot quoted the wrong price. The cause was a pack-size collision, not the model. (P9)
16. `[X]` The demo that was fabricating knowledge: fake `pdfjsLib` and `XLSX` globals in a preview path. (P9)
17. `[LI]` Excel training was reading one sheet out of twelve. (P9)
18. `[LI]` The mobile keyboard white gap - a two-day CSS bug on a product that works. (P12)
19. `[X]` My URL scraper was silently dropping every table on the page. (P9)

**Data and infrastructure**

20. `[LI]` Letting enterprise customers keep their own database - and the four things that had to be true first. (P5)
21. `[X]` DML-only database role: my app literally cannot drop a customer's table. (P5)
22. `[LI]` Why product prices never go into the vector store. (P9)
23. `[LI]` We changed our storage limit from "chunks" to "words" because nobody knows what a chunk is. (P9)
24. `[X]` Per-tenant connection pools with a global ceiling and a circuit breaker. (P5)

**Business intelligence and product**

25. `[LI]` The chat is not the product. The chat is the data collection layer. (P6)
26. `[LI]` Turning conversations into a demand signal: what customers ask for that we do not sell. (P6)
27. `[IG]` Reel: the analytics dashboard, 20 seconds, no voiceover, captions only. (P6)
28. `[LI]` I removed source citations from my AI's answers. Customers were seeing our internal filenames. (P10)

**Craft and process**

29. `[LI]` 1,125 backend tests on an AI product - including tests for whether the AI stayed grounded. (P11)
30. `[LI]` 800 commits in six months, solo. What the git log actually says about how I work. (all)

---

## Fully drafted posts

Eight ready to publish. Post 1 is the anchor - lead with it.

---

### Draft 1 - Architecture anchor `[LinkedIn]`

**Asset**: architecture diagram (see Visual assets, A1).

---

For the last six months I have been building Vaayu - an AI chat layer that answers a business's customers *and* its own staff from that company's real data.

800 commits in. Here is the actual architecture, no hand-waving.

**Frontend**
Next.js 16 App Router with React 19, deployed on Vercel. Server Components by default - the client bundle only grows where there is genuine interactivity. The customer-facing chat widget is a separate embedded React iframe, about 50 KB gzipped, so dropping it on a customer site cannot break their CSS or their bundle.

**Backend**
Python 3.12 on FastAPI, Uvicorn behind Gunicorn, deployed on Render. Every endpoint is tenant-scoped - there is no query in the codebase that reads company data without `WHERE company_id = %s`.

**Data**
Supabase Postgres. Two kinds of knowledge live in two different places, deliberately:
- Unstructured docs go through Gemini embeddings into pgvector for RAG.
- Structured data - product catalogs, prices, specs - goes into real relational tables.

That split is the single most important data decision in the product. A price should be *looked up*, never approximated by a nearest-neighbour vector search. Embedding a price list and hoping is how AI products quote the wrong number.

**Inference**
Gemini, tiered by plan. Not a single model call - a bounded ReAct agent loop that can call real tools against the database before it answers.

**Caching**
Redis for sessions, rate limiting, and an exact-query cache. Token spend is metered per company and rolled up across tenants, because on an AI product your COGS is a variable you have to be able to see.

**Enterprise**
Customers can bring their own Postgres. Per-tenant connection pool, circuit breaker, credentials encrypted at rest, and a DML-only database role so my application is structurally incapable of altering their schema.

The thing I did not expect going in: the hard problems were almost never the model. They were connection lifecycles, data isolation, ingestion quality and cost visibility. The AI part is a component. The product is the system around it.

I am going to keep posting the details - the bugs included. Next one is the agent loop.

---

### Draft 2 - The registry post `[LinkedIn]`

**Asset**: code screenshot of `packs/registry.py` `load_pack`.

---

There is one line of code I have never let myself write in this product:

```python
if vertical == "chemical":
```

Vaayu serves different industries. A chemical distributor's bot needs Safety Data Sheet lookup, CAS number resolution and grade disambiguation. A cleaning company's bot needs none of that.

The obvious way to build this is branching. Six months in it would have been 300 branches across 40 files, and adding an industry would mean touching all of them.

So instead every vertical is a config object - one Python dataclass:

- `persona_prompt` - how it talks
- `tools` - what it can actually do
- `hub_cards` - what UI cards render in the widget
- `catalog_tables` - how uploaded spreadsheets map to real tables
- `qualification_slots` - what facts it tries to learn about a buyer
- `teaser_rules` - what it proactively says on which page

The engine has exactly one entry point: `load_pack(vertical)`.

The part I am most pleased with is not the config - it is the failure behaviour. `load_pack` is built to be safe by construction. An absent value, a typo, an unshipped vertical, a non-string, a malformed pack - all of it resolves to `None`, which means "generic bot, no tools". It never raises. A broken pack cannot 500 a live customer request; the worst case is a customer gets the ordinary bot for one deploy.

That is the difference between config-driven and config-fragile. Anyone can move logic into a dict. The engineering is in deciding what happens when the dict is wrong.

Adding a new industry is now a new dataclass and one line in a registry. Not a release.

---

### Draft 3 - The safety rule `[LinkedIn]` (highest-signal post in the set)

---

My AI is not allowed to answer the most important question it gets asked.

Vaayu's first vertical is chemical distribution. People ask the bot things like "is this corrosive", "what is the flash point", "how do I store this safely".

Every instinct in AI product building says: put the safety data in the context window and let the model answer fluently.

I made that architecturally impossible.

Safety Data Sheet, hazard and handling answers come **only** from a tool that returns the actual document. The model can decide to call the tool. It can present what came back. It cannot compose the answer itself.

Why the hard line: a hallucinated flash point is not a bad user experience. It is someone storing a solvent wrong. There is a difference between a product that is embarrassing when it is wrong and a product that is dangerous when it is wrong, and the second kind does not get to rely on a prompt instruction saying "please be accurate".

The practical version of this rule:
- The tool resolves the product first - by CAS number, name, and grade, because multi-grade products are a real disambiguation problem.
- It returns the newest document over HTTPS, or it returns nothing.
- Nothing is an acceptable answer. "I could not find a Safety Data Sheet for that, here is how to reach a human" is a correct response. An invented one never is.
- Groundedness is covered in the test suite, so a prompt change cannot quietly loosen it.

If you are selling AI into an industry with real physical consequences, the question is not "how good is the model". It is "what is the model structurally unable to do".

---

### Draft 4 - Agent loop `[X thread]`

---

**1/** I stopped trying to make my chatbot smarter with a bigger prompt and gave it tools instead.

Here is the loop that runs in production. 🧵

**2/** The model gets a set of tool schemas and can call them mid-answer. Real ones, against a real Postgres:

`get_sds` - fetch a safety data sheet
`get_product_spec` - specs by CAS/name/grade
`request_quote` - create a real quote row
`request_sample` - open a request + notify the owner

**3/** The tool schemas are not hand-written.

They are generated from the vertical's config object at request time: `build_tool_schemas(pack)`.

Add a tool to the config, the model can use it. No branching in the engine.

**4/** The loop is bounded. Hard.

`MAX_TOOL_ROUNDS = 4`
`MAX_CALLS_PER_ROUND = 4`

An unbounded agent loop is an unbounded bill. Ask me how I know.

**5/** It streams over SSE, and that caused my favourite bug.

Slow tool rounds looked like dead connections to the heartbeat, so healthy requests were getting torn down mid-answer - but only for the *hardest* questions.

**6/** The fix: the heartbeat has to survive a slow round, not police it.

The general lesson - your liveness check and your work loop should never share a clock.

**7/** Second cost bug in the same area: truncated answers.

Everyone's first instinct is "bad prompt". It was unbounded thinking tokens. The model was spending its whole budget reasoning and getting cut off before it wrote anything.

Bounded them, logged `MAX_TOKENS` finish reasons, done.

**8/** Takeaway: most "the AI is bad" bugs I have hit were not the model.

They were budgets, lifecycles, and data plumbing.

Building this at Vaayu - more of the build in public 👇

---

### Draft 5 - Bug story `[LinkedIn]`, short

---

My bot quoted a customer the wrong price. It was not a hallucination.

The product had multiple pack sizes. My resolver was matching the product correctly but then colliding across sizes - so a 5 L price could surface for a 25 L enquiry, and the system flagged it as an ambiguous price rather than the wrong one.

The instinct with an AI product is always to blame the model. It is usually wrong. Prices in Vaayu never go through the vector store - they come from structured tables by exact lookup, precisely so pricing cannot be approximated. Which means when a price is wrong, it is deterministic, reproducible and my fault.

That is the trade I would make every time. A hallucinated price is unfixable. A resolver bug is a test case.

Fixed, with a regression test. The cost of building AI products that way is more plumbing. The benefit is that your bugs stay debuggable.

---

### Draft 6 - BYOD `[LinkedIn]`

**Asset**: BYOD isolation diagram (A2).

---

Enterprise customers kept asking the same question: "where does our data live?"

The honest answer for most AI SaaS is "our database, trust us". So I built the other option.

Vaayu customers can bring their own Postgres. Their conversations, their knowledge base, their leads - in infrastructure they own and can revoke.

Four things had to be true before I could ship it:

**1. My app must be structurally unable to damage their database.**
The runtime connects through a DML-only role. It can read and write rows. It cannot create, alter or drop anything. Not "should not" - cannot.

**2. Credentials must be worthless if the app database leaks.**
Connection details are encrypted with AES-GCM 256 under a per-tenant key, with master keys held in the environment, never in Postgres.

**3. One customer's outage must not become everyone's outage.**
Per-tenant connection pool capped at 3 with a global ceiling of 100, plus a circuit breaker. A customer whose database is down gets errors. Nobody else notices.

**4. It must be boring to operate.**
Schema injection and migration are automatic, and routing decisions are cached in Redis on a short TTL so the hot path is not re-resolving tenancy on every message.

The lesson for anyone building B2B AI: data residency is not a feature you bolt on after an enterprise asks. It is a constraint that has to reach into your connection layer, your key management and your failure isolation. Retrofit it and you get a checkbox. Design for it and you get a sales advantage.

---

### Draft 7 - BI reframe `[LinkedIn]`

**Asset**: dashboard screenshot or Reel (A4).

---

The chat is not the product. The chat is the data collection layer.

When I started Vaayu I thought I was building a support bot. What customers actually get excited about in a demo is the dashboard behind it.

Because every conversation is a structured record of demand:

**Demand signal** - what people ask for, ranked. Including things you do not sell. That is your product roadmap, written by your market, for free.

**Stage funnel** - where conversations stop. Discovery, qualification, quote, handoff. You can see the exact step that leaks.

**Lost sales** - enquiries that reached intent and did not convert, with the reason attached.

**Lead quality bands** - so a sales team works the top band instead of the newest.

A human sales team generates the same data every day and throws almost all of it away, because writing it down is nobody's job. The bot's advantage is not that it is smarter than your salesperson. It is that it never forgets to log the conversation.

Sell the answers. Ship the analytics.

---

### Draft 8 - Testing `[LinkedIn]`

---

1,125 backend tests on an AI product. Here is the part people find surprising:

Some of them test the AI's behaviour, not the code around it.

The standard advice is that you cannot unit-test a language model, so you test the plumbing and eyeball the rest. That works until the thing you are shipping is trust.

So alongside the ordinary suite there are:

**Groundedness tests** - does the answer actually come from retrieved material, or did the model fill a gap.

**Guardrail evals** - does it still refuse what it is supposed to refuse, after a prompt change.

That second one is the real value. Prompts are code, but they are code with no type system, no compiler and no stack trace. The only thing standing between a prompt tweak and a regression in a safety-critical answer is a test that fails.

If you are shipping AI to paying customers, the question is not whether your model is good. It is whether you would notice if it got worse.

---

## Visual assets to produce

Ranked by return on effort.

**A1 - Architecture diagram** (highest priority)
One clean layered diagram: browser/widget → Next.js → FastAPI → Postgres+pgvector / Redis / Gemini / BYOD.
Build it in Excalidraw or Figma, dark background, one accent colour.
Reuse it in every architecture post, the LinkedIn banner, and the YouTube thumbnail.
Source of truth already exists in `docs/product-hunt-technical-summary.md`.

**A2 - BYOD isolation diagram**
Shared DB path vs BYOD path side by side, showing the DML-only role and the circuit breaker.

**A3 - Agent loop animation**
The four-round loop as five slides: question → tool decision → DB call → result → answer.
Works as a LinkedIn carousel and, exported as a video, as a Reel.

**A4 - Screen recording: the whole flow, 45 seconds**
Ask the widget a real product question → tool call visibly runs → answer with a real document → cut to the dashboard showing that conversation as a data point.
This single clip is your best sales asset *and* your best social asset. Record it once at high quality, cut three versions: 45s (LinkedIn), 60s vertical (Reels), 15s (X).

**A5 - Code screenshots**
Use Carbon or `ray.so`. Dark theme, no line numbers, under 20 lines.
Good candidates: `load_pack`, the `Pack` dataclass, `MAX_TOOL_ROUNDS` constants.

**A6 - Before/after images**
Bug posts double their engagement with a visual. Screenshot the broken state before you fix it - this needs a habit, not a tool.

**YouTube (one per month, not more)**
- V1: "Architecture of a production AI SaaS" - 12 min, screen share over A1.
- V2: "Building a ReAct agent with tools over Postgres" - 15 min, real code.
- V3: "How I let enterprise customers keep their own database" - 10 min.

## Capture habit

The system only fails one way: you ship things and forget to write them down.

Fix: at the end of any session where something interesting happened, add one line to `docs/social-content-log.md`:

```
2026-08-14 | bug | SSE heartbeat killed slow rounds | P7 | screenshot? no
```

Then on Sunday, run `git log --since="1 week ago" --format='%s'` and pick two.
Commit titles in this repo are already good enough to be post hooks - "Harden agent SSE heartbeat so a slow round is not torn down" is a headline as written.

## What to measure

Ignore likes. Track:

- Profile views and connection requests from target roles (LinkedIn weekly).
- Inbound DMs mentioning the product.
- Demo requests attributable to a post.
- Which pillar produces them - after 10 posts you will know whether it is architecture, bugs or BI, and you double down there.

## Open items

- Decide whether to post under a personal brand or a Vaayu company page. Recommendation: personal, with the company page resharing. Personal accounts out-reach company pages by a wide margin and all four target audiences respond to a person.
- Record A4 once - it unblocks Instagram and X video entirely.
