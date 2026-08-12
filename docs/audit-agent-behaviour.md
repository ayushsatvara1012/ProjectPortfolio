# Agent Behaviour Audit

Date: 2026-08-10.
Revised: 2026-08-10 (re-prioritised against the stated product goal - see §0.1).
Branch audited: `MainV2` (clean working tree at `092d02a2`).

Auditor brief: check whether the codebase implements a correct AI-agent configuration - prompt, control flow, and deterministic code - without bias, and say plainly what needs fixing and in what order, including a restructure if one is warranted.

Scope: chemical vertical agent (full ReAct path), generic RAG bot path, frontend widget control flow, retrieval/ingestion quality.
Appetite: recommend whatever is right, including a rewrite.
Depth: findings and priorities, implementation left open.

---

## 0. Verdict

### 0.1 The product this is being audited against

This is **not** a generative assistant.
It is a **precision RAG platform for websites**: a customer's data is ingested, and the bot answers from that data.

The success criterion is therefore not fluency.
It is: **the visitor never receives wrong information.**
A confident wrong answer is the only unacceptable output.
A clean "I don't have that on file, let me connect you" is a *correct* answer and must be designed as a first-class outcome, not treated as a failure.

The architecture required to deliver that, in the owner's own framing, is: data fetching, caching, reranking, summarising, intent understanding, and ReAct-based tool selection.
This audit is ranked against that goal.
Everything is ordered by **wrong-answer risk**, not by how sophisticated or conversational the bot feels.

This revision demotes streaming, response voice, and general "agent-likeness", and promotes ingestion structure, identifier retrieval, grounding enforcement, and refusal quality.

### 0.2 The finding

The deterministic tool layer is genuinely good and must be preserved.
Tools are tenant-scoped, resolve-or-refuse, never compute what they can look up, and are covered by 126 focused unit tests.
The COA design in particular - exact-retrieval-or-nothing, one uniform refusal, shared throttle identity between panel and chat, the model never seeing a filename - is the correct template for every high-stakes lookup in this platform.

The problem is that **precision is currently enforced by prompt text, and prompt text cannot enforce precision.**

The system has two answering pathways with opposite reliability, and it is worth being precise about why, because the whole remediation plan follows from it:

| | Reliable pathway | Unreliable pathway |
|---|---|---|
| Used for | products, SDS, prices, COA | staff, roles, policies, company facts, everything else |
| Data shape | typed tables (`products`, `product_skus`) | 300-character prose chunks |
| Retrieval | exact key lookup (CAS / name / grade / pack) | fuzzy vector + BM25, top 5 |
| On a miss | refuses, escalates | model composes from whatever came back |
| Wrong-answer rate | effectively zero | this is where every incident has come from |

Same model.
Same prompt.
Opposite outcomes.

**The fix for precision is to move more question classes from the right column to the left, not to improve how the model synthesises in the right column.**

On top of that, four things actively manufacture or preserve wrong answers today:

1. **RULE 7 explicitly instructs the bot to answer from its own knowledge** when the documents do not have it (`main.py:3660`). That is a fabrication licence, aimed at precisely the category - people and company identity - that produced your live incident.
2. **RULE 1 tells the tool-using agent the knowledge base is its only source** (`main.py:3591`), so it synthesises from retrieved prose instead of pulling the authoritative record.
3. **Chunking splits entity blocks** (`main.py:8300`), so a name lands in one chunk and a phone number in the next, and the model pairs them. This is the mechanical origin of "a believable combination assembled from two places", which the prompt then tries to forbid at generation time - the wrong layer.
4. **Nothing checks the answer before it ships, and the failure gets cached forever.** There is no runtime grounding gate, and `exact_query_cache` has no TTL and no gate on whether the answer was a fallback (`main.py:4193`).

### 0.3 Restructure verdict

An **extraction, not a rewrite**.

The tools, packs, session store, and deterministic services are keepers.
What needs to be built is the layer that currently does not exist as code at all: an explicit turn pipeline with a **grounding gate** between retrieval and answering, and an ingestion layer that produces structured records rather than uniform prose chunks.

Today the orchestration lives as a ~460-line closure inside a 4,000-line handler inside a 14,128-line `main.py`.
It cannot be tested end to end, which is why findings B1 through B5 all survived.

---

## 1. What the system does today

Reconstructed from the code, not from the plans.

### 1.1 Request path (`POST /api/chat`, `main.py:3225-4251`)

```
verify_api_key_and_origin
  -> global LLM budget check (Redis)
  -> widget session-token gate + per-session message budget
  -> load_pack(company.vertical)                 # pack or None decides EVERYTHING below
  -> [pack only] session_store: 8 verbatim turns + summary + state + lead_profile
  -> tier / quota / billing gates
  -> [generic only] exact-match cache lookup -> may return early
  -> HyDE expansion (skipped for entity-lookup questions)   # LLM call 1
  -> embed query, truncate to 768 dims
  -> hybrid retrieval (BM25 + pgvector, RRF, parent resolution)
  -> rerank top 15 -> top 5                                  # LLM call 2
  -> build system prompt (8 platform rules + persona + KB + security + agent directive
                          + prior session context + funnel directive + qualification block)
  -> build message list (system, prior turns, <user_query>-wrapped current message)
  -> return StreamingResponse(stream_generator())            # handler DB conn released here
```

There is **no intent classification step**, **no grounding gate**, and **no compose stage**.
Routing is implicit: the model reads a ~5,900-token rulebook and decides for itself whether this is a tool question or a knowledge question.

### 1.2 Inside `stream_generator`

Two separate branches share one `finally`.

**Pack branch (`main.py:3805-4147`)** - own DB connection, a `_tool_executor` closure, bound tool schemas, `stream_agent_loop` under a 30s deadline with 15s heartbeats.
Tool observations are mutated into a `_captured` dict that simultaneously serves as the UI side-channel, the funnel input, the source-attribution input, and the owner-alert trigger.
Final text emitted as **one SSE token**.

**Generic branch (`main.py:4149-4178`)** - `chat_model.astream(messages)`, token by token.

**Shared `finally` (`main.py:4184-4240`)** - releases the connection, strips citations, saves to cache, computes `is_unanswered` and `confidence`, logs, increments usage.

### 1.3 The ReAct loop (`services/agent.py:1399-1502`)

```
for round in 0..3:
    response = model.ainvoke(convo)
    if no tool calls:
        if text -> emit final, return
        else -> retry once; if still nothing -> emit whatever/fallback, return
    append AIMessage(with ALL tool calls)
    for call in tool_calls[:4]:            # extras silently dropped
        observation = tool_executor(call)
        append ToolMessage
emit AGENT_FALLBACK_TEXT                    # all tool work discarded
```

---

## 2. Target architecture

This is the shape a precision RAG platform needs.
It maps directly onto the components named in the brief - fetching, caching, reranking, summarising, intent, ReAct, tool selection - and shows which of them exist today, which exist in the wrong place, and which are missing entirely.

```
INGEST (offline)          source-type aware extraction
                          -> structure detection
                          -> [structured]  typed tables + deterministic tool
                          -> [prose]       entity-safe chunking + embeddings
                                    |
QUERY                               v
  1. INTENT ROUTER        deterministic first, cheap classifier as fallback
                          classes: structured-lookup | prose | greeting |
                                   out-of-scope | escalation
                                    |
  2. FETCH                structured -> exact key lookup, skip RAG entirely
                          prose      -> hybrid retrieval (semantic + identifier-aware lexical)
                                    |
  3. RERANK               score candidates, keep top-k, KEEP THE SCORES
                                    |
  4. GROUNDING GATE  <<<  THE MISSING PIECE
                          best evidence below threshold -> REFUSE, do not answer
                                    |
  5. ReAct LOOP           bounded tool selection; retrieval is itself a tool
                          so the agent can search again after disambiguation
                                    |
  6. COMPOSE              tool-free final call; EXTRACT and restate the grounded
                          record; never synthesise across ungrounded fragments
                                    |
  7. OUTPUT CHECK         fabrication detector on safety/value-class answers
                          with no grounding observation -> replace with refusal
                                    |
  8. CACHE                cache only grounded, complete answers
                          key on (company, normalised question, KB version), with TTL
                                    |
  9. PERSIST              one TurnResult -> SSE frames, session, funnel,
                          alerts, analytics. All from the same object.
```

### 2.1 Component status

| Component | Today | Gap |
|---|---|---|
| **Intent understanding** | Implicit - the model decides from prompt text. `_is_entity_lookup_query` (`main.py:2368`) is the only explicit routing, and it only toggles HyDE. | No router. Every question pays for HyDE + rerank even when the answer is a pure table lookup. Structured classes should skip RAG entirely. |
| **Data fetching** | Hybrid BM25 + pgvector with RRF and parent-child resolution. Solid design. | Runs once, before the model reasons. Not available as a tool, so it can never search again. Lexical half uses an English stemmer on identifier data. |
| **Reranking** | Real LLM reranker, correctly pinned to temperature 0.0. | Scores are computed and then used only for a cosmetic confidence number. Nothing gates on them. Skipped entirely when there are ≤5 candidates. |
| **Grounding gate** | **Does not exist.** | This is the single most important missing component for the stated goal. |
| **ReAct / tool selection** | Real bounded loop with deterministic tools. Good foundation. | No compose stage, silent tool-call truncation, split dispatch across two files, no tool registry. |
| **Summarising** | Session summarisation is genuinely good - rolling, cost-bounded, injection-sanitised. Parent-child resolution serves as context expansion. | No multi-chunk synthesis path for broad questions. RULE 8 handles vagueness by prompt only. |
| **Caching** | Exact-hash cache with correct pack bypass. | No TTL, caches fallbacks and truncated streams, not keyed on knowledge-base version. |
| **Output verification** | None at runtime. | The detector already exists in a skipped test. |

### 2.2 One design warning on caching

Exact-match caching is the **right conservative choice** for a precision product, and it should stay.
A semantic/similarity cache would serve a near-miss question the wrong cached answer - a wrong-answer generator by construction.
The defects in D1/D2 are about *gating and expiry*, not about the caching strategy.
Do not "upgrade" this to a semantic cache.

---

## 3. The structured-lookup pattern, and how to extend it

This is the core architectural recommendation, and it is the one that most directly serves "answers with precision from the trained data."

### 3.1 The pattern that already works

For products, the pipeline is:

1. **Detect structure at ingest** - `catalog_import` recognises a catalog sheet by header synonyms.
2. **Land it in a typed table** - `products`, `product_skus`, with a defined grain.
3. **Expose a deterministic tool** - `get_product_spec`, `request_quote`, resolve-or-refuse, never auto-serving a fuzzy match.
4. **Never let the prose path answer that class** - the agent directive explicitly routes grade/pack questions through the tool.

Result: zero fabricated prices, zero fabricated SDS links.

### 3.2 Why everything else fails

Every other question class skips steps 1-3 entirely.
A staff directory page, a shipping policy, a certifications list and a branch-locations table all get the same treatment as a blog post: split at 1500/300 characters, embedded, retrieved as five prose fragments, and handed to the model to assemble.

The `products` table is why product answers are trustworthy.
The absence of its equivalent is why contact answers are not.

### 3.3 What to extend it to

These are the recurring structured entity types on a business website.
They should be **pack-configurable, not hardcoded** - the same `catalog_tables` mechanism `packs/chemical.py:310` already uses, generalised to a `structured_kinds` registry:

| Kind | Typical source | Why it must be structured | Priority |
|---|---|---|---|
| **People / roles / contacts** | About, Team, Contact pages | Caused the live incident. Name + title + phone + email must be one atomic record or not answered at all. | **1** |
| **FAQ pairs** | FAQ page, help centre | Question-answer pairs are already atomic; chunking actively destroys them. Highest precision-per-effort. | **2** |
| **Locations / branches** | Contact, Locations | Address + phone + hours is an entity, not prose. Same split-pairing failure as people. | 3 |
| **Policies** | Shipping, returns, warranty, privacy | Users need the exact clause, not a paraphrase. Retrieve the section, restate it. | 4 |
| **Certifications / documents** | Quality, downloads | Same shape as SDS: a document reference, served or refused. | 5 |

Each one needs: an ingest detector, a table, a tool with resolve-or-refuse semantics, and a directive line routing that class to the tool.
The chemical pack proves all four steps are buildable; the work is generalising them out of the chemical-specific path into pack config, which `CLAUDE.md` already mandates ("never hardcode vertical-specific logic").

### 3.4 The refusal path is part of the architecture

For a precision product, the refusal is a shipped feature.
It needs one canonical implementation, one voice, and one trigger condition (grounding gate failed, or tool returned not-found).

Today three different rules fight over the same sentence: RULE 6's mandated exact text (`main.py:3567`), RULE 2's ban on denial openers (`main.py:3606`), and RULE 5's exclusion carve-out (`main.py:3651`).
On top of that, `FALLBACK_PHRASES` (`main.py:3035`) does substring matching on the resulting text to drive analytics, so any wording change silently moves your metrics.
Refusal should be a **structured outcome on the turn**, rendered deterministically, not a phrase the model is asked to reproduce and another component is asked to detect.

---

## 4. Findings ranked by wrong-answer risk

All 38 findings retained with their original IDs.
Ranked here by the revised criterion.
Detailed write-ups follow in §5, grouped by area.

### Band 1 - Directly produce wrong answers. Fix first.

| Rank | ID | Finding | Location | Size |
|---|---|---|---|---|
| 1 | A2 | RULE 7 instructs the bot to answer from its own knowledge when the docs lack it, and hardcodes the platform founder into every tenant's prompt | `main.py:3660` | 1 line |
| 2 | A1 | RULE 1 tells the tool-using agent the KB is its only source, so it synthesises instead of looking up | `main.py:3591` | half day |
| 3 | B6 | Agent samples at `temperature=0.7`; same question, different answer | `main.py:818` | 1 arg |
| 4 | E2 | Chunking splits entity blocks, so names pair with the wrong phone numbers | `main.py:8300` | slice |
| 5 | E1 | No structured directory lookup - the highest-damage class still uses the fuzzy pathway | `main.py:2368` | slice |
| 6 | B7 | No runtime grounding check; a fabricated value ships unexamined | `agent.py:1236` | 1-2 days |
| 7 | E3 | BM25 uses an English stemmer over CAS numbers and batch codes, so the exact row is missed and adjacent prose answers instead | `main.py:2459` | 1-2 days |
| 8 | B1 | Tool calls beyond 4 per round are silently dropped; the model answers about data it never received | `agent.py:1473` | half day |
| 9 | A4 | RULE 6 names `search_catalog`, a tool that has never existed | `main.py:3543` | 1 line |
| 10 | C1 | Client-supplied history bypasses sanitization and the injection firewall; forged assistant turns can be restated as fact | `main.py:3772` | half day |

### Band 2 - Let wrong answers persist, spread, or go undetected.

| Rank | ID | Finding | Location |
|---|---|---|---|
| 11 | D1 | Fallback answers cached permanently, no TTL | `main.py:4193` |
| 12 | D2 | Truncated and errored streams cached as canonical answers | `main.py:4184` |
| 13 | D3 | `is_unanswered` is inverted for tool-answered turns - you cannot see which answers failed | `main.py:4199` |
| 14 | D4 | `confidence` measures retrieval quality, not answer grounding, and is null for every small knowledge base | `main.py:3042` |
| 15 | C3 | `tool_calls`/`observations` columns exist but are never written - no record of what the agent actually looked up | `main.py:4074` |
| 16 | A6 | Three rules fight over the refusal sentence, so refusal behaviour is inconsistent | `main.py:3567,3606,3651` |
| 17 | F3 | Client and server hold two different, non-matching definitions of "the bot failed" | `ChatWidget.tsx:2712` |

### Band 3 - Architecture gaps that cap achievable precision.

| Rank | ID | Finding | Location |
|---|---|---|---|
| 18 | B8 | Retrieval is not a tool - the agent gets one fixed blob and can never search again | `main.py:3452` |
| 19 | A3 | Four prompt blocks each claim highest authority; precedence is undefined | `main.py:3588,3686` |
| 20 | A5 | ~5,900 instruction tokens against a 200-token thinking budget | `main.py:1602` |
| 21 | B9 | Tool dispatch split across two files and three if-chains; nothing enforces agreement | `agent.py:1110` |
| 22 | B4 | `_captured` is single-slot while the directive explicitly asks for multi-call turns | `main.py:3813` |
| 23 | C2 | Generic bots have no server-side memory; all state is client-controlled | `main.py:3293` |
| 24 | D5 | Two different vector thresholds for the same job (0.7 vs 0.55) | `main.py:2449,2512` |
| 25 | B10 | `get_coa` advertised to bots with no Drive folder configured | `chemical.py:392` |
| 26 | A7 | Volatile KB sits mid-prompt, defeating implicit context caching | `main.py:3681` |

### Band 4 - Reliability and UX. Real, but not precision.

| Rank | ID | Finding | Location |
|---|---|---|---|
| 27 | B3 | Failed turns still emit cards, commit quote rows, and alert the owner | `main.py:3959,4132` |
| 28 | B2 | Round exhaustion discards all successful tool work | `agent.py:1500` |
| 29 | F2 | Server errors leave the bot bubble typing forever | `main.py:4180` |
| 30 | C4 | Client retries a non-idempotent chat request; double usage, double logs, double turns | `ChatWidget.tsx:2785` |
| 31 | B5 | Timeout budget is arithmetically inconsistent (20s x 2 retries inside a 30s deadline) | `main.py:804,1593` |
| 32 | F4 | Structured frames are single-slot on the client too | `ChatWidget.tsx:2574` |
| 33 | F1 | Agent replies do not stream (demoted - cosmetic under this goal) | `main.py:4050` |

### Band 5 - Hygiene.

| Rank | ID | Finding | Location |
|---|---|---|---|
| 34 | D6 | Dead `context_text` shadowing the sanitized `knowledge_context` | `main.py:3490` |
| 35 | E4 | Embeddings over-fetched at full dimensionality then truncated in Python | `main.py:3463` |
| 36 | A8 | Comment contradicts code on user-message placement | `main.py:3716` |
| 37 | B10b | Tool availability not derived from effective config (same root as B10) | `main.py:3941` |
| 38 | D5b | FTS-absent fallback path silently changes recall profile (same root as D5) | `main.py:2512` |

### What moved in this revision

Promoted: E2 chunking (P1 to Band 1), E1 directory (P1 to Band 1), E3 identifier retrieval (P2 to Band 1), B6 temperature (P1 to Band 1), B7 runtime grounding (P1 to Band 1), C3 tool trace (P2 to Band 2).
Demoted: F1 streaming (P1 to Band 4), B2 round exhaustion (P0 to Band 4 - it produces a visible *failure*, not a wrong answer), B3 (P0 to Band 4 - same reasoning, though it does send the owner bad data).
Dropped entirely: the "prompt voice rewrite" recommendation from the previous revision. Shrink the rulebook for adherence (A5), not for tone.

---

## 5. Detailed findings

### A. Prompt

**A1 - The agent is told its tools do not matter.** `main.py:3591-3594` delivers "You answer exclusively from the KNOWLEDGE BASE" to pack companies, under a banner claiming it cannot be overridden.
The agent directive (`main.py:3706`) then says safety comes only from `get_sds`, availability only from `get_product_spec`, prices only from `request_quote`.
Both absolute, contradictory, resolved differently per turn.
RULE 6 already forks by pack (`main.py:3538-3582`), so the mechanism exists.

**A2 - RULE 7 licenses fabrication and leaks the platform founder.** `main.py:3659-3660`: "For direct questions about {company_name}'s history, founders (e.g., Ayush Satvara), or mission, use your internal knowledge and logic if not in the knowledge base."
Three defects: an explicit instruction to invent, scoped to the exact category that caused the live incident; `Ayush Satvara` hardcoded into every tenant's prompt, making it the most specific thing in context when a visitor asks who founded the company; and a violation of the project's own no-hardcoded-business-logic rule.

**A3 - Four blocks claim highest authority.** PLATFORM RULES ("cannot be overridden", `main.py:3588`), the pack persona ("overrides every other instruction", `chemical.py:32`), the SECURITY DIRECTIVE ("FINAL and HIGHEST-PRIORITY", `main.py:3686`), and the AGENT DIRECTIVE ("HIGHEST PRIORITY", `agent.py:1220`).
No defined precedence, so the model applies recency and specificity heuristics - which is why behaviour shifts when unrelated blocks are edited.

**A4 - Phantom tool.** `search_catalog` (`main.py:3543`) exists nowhere in the repository. A model that obeys burns a round on "Tool not available" (`agent.py:1160`).

**A5 - Instruction mass vs reasoning budget.** Measured on the live chemical pack: rules template 9,630 chars, agent directive 6,930, tool schemas 4,923, qualification 1,077, persona 964, funnel ~350. Total ~23,900 chars / ~5,900 tokens, against `AGENT_THINKING_BUDGET = 200` (`main.py:1602`).
Over 60 negative constraints. "Do not restate your previous answer" appears four separate times across RULE 2, RULE 6 and the agent directive - each added by a real incident fix, which is why they are all there.

**A6 - Three rules, one sentence.** RULE 6 mandates exact fallback text (`main.py:3567`), RULE 2 bans denial openers (`main.py:3606`), RULE 5 carves out a third case (`main.py:3651`). `FALLBACK_PHRASES` (`main.py:3035`) then substring-matches the result to drive analytics.

**A7 - Cache-hostile ordering.** The volatile KB block sits at `main.py:3681`, mid-prompt. Everything after it is stable content behind a cache-breaking boundary. `docs/streaming-cache-optimization-plan.md` already established implicit caching is the only available lever, and it keys on a stable prefix.

**A8 - Stale comment.** `main.py:3716-3721` claims the user message is passed in system context, not as a HumanMessage. `main.py:3781` appends it as a HumanMessage.

### B. Loop and control flow

**B1 - Silent tool-call truncation.** `agent.py:1473-1474` appends the AIMessage advertising N calls but only executes the first 4. Certain consequence: the model receives 4 answers for 5 requests with no signal, and answers about a product it never got data for. Probable consequence: Gemini rejects the next round for mismatched call/response parts, caught at `agent.py:1427`, whole turn becomes fallback.

**B2 - Round exhaustion discards all work.** `agent.py:1500-1502`. A resolved product, valid SDS URL and priced SKU are all thrown away. `MAX_TOOL_ROUNDS = 4` really means 3 tool rounds plus a compose the model must volunteer to do.

**B3 - Non-transactional turns.** The deadline path sets the fallback text (`main.py:3959`) but leaves `_captured` intact, so the quote card still renders (`main.py:4054`), the owner alert still fires (`main.py:4132`), and `_insert_quote` has already committed (`agent.py:974`). Visitor sees a failure message under a live price card; owner gets a hot-lead alert for a conversation that visibly failed.

**B4 - Single-slot capture.** `_captured` holds one entry per action type (`main.py:3813-3939`), while the directive instructs "call the tool ONCE PER GRADE and present each result" (`agent.py:1309`). Two quotes write two rows, render one card, fire one alert.

**B5 - Timeout arithmetic.** Deadline 30s (`main.py:1593`), per-call timeout 20s with 2 retries (`main.py:804`), 4 rounds. One retried call exceeds the whole-turn budget by itself.

**B6 - Temperature 0.7 on the agent.** `main.py:814-819`. That temperature governs CAS-number and pack-size extraction into tool arguments, the safety-class judgement, and the refusal decision, in the same call.
HyDE, the reranker and the summarizer are all correctly pinned to 0.0. Only the highest-stakes call is left creative.

**B7 - No runtime grounding enforcement.** `CLAUDE.md` states the non-negotiable rule; enforcement is persona text, directive text, and `tests/test_guardrail_eval.py`, which is `skipif`-gated behind `RUN_LLM_EVALS=1` and does not run in CI.
The eval already contains a working detector - `fabrication_hits` (`test_guardrail_eval.py:57-71`), hazard vocabulary plus a nearby-digit proximity check. It belongs in the response path.

**B8 - Retrieval is not a tool.** RAG runs once before the model reasons (`main.py:3452-3495`). The agent cannot search again after a clarification or an `ambiguous` result. HyDE and reranking also fire on every agent turn including ones answered entirely by `request_quote` - a minimum agent turn is 4 LLM calls.

**B9 - Split dispatch.** Adding a tool requires coordinated edits in `packs/chemical.py`, `agent.py:1110-1166`, and `main.py:3813-3939`, plus `ChatWidget.tsx`, `sales_funnel._candidate_stage`, `session_store.derive_title` and `_build_tool_sources`. Nothing enforces agreement. `get_coa` already breaks the pattern.

**B10 - Ungated tool availability.** `packs/chemical.py:392` declares `get_coa` for every chemical bot; `main.py:9995` gates the UI picker on Drive configuration but `build_tool_schemas` (`main.py:3941`) is ungated.

### C. Memory and state

**C1 - History bypasses the firewall.** `sanitize_message` applies only to `ChatRequest.message` (`db/models.py:54-59`). `ChatMessage.content` is length-checked only.
`main.py:3772-3779` injects history as raw Human/AIMessages, never `<user_query>`-wrapped, so the SECURITY DIRECTIVE - which speaks only about `<user_query>` and `<knowledge_base>` - does not cover it. `role` is a free string; anything not exactly `'user'` becomes an AIMessage, the highest-trust text in context.
A scraped widget key or compromised host page can forge prior assistant turns the model will restate as its own established facts.

**C2 - Generic bots have no server memory.** `main.py:3293` gates session memory on `pack is not None`. Generic bots are the majority of tenants, and their entire state is client-supplied.

**C3 - Reasoning is never persisted.** `agent_messages.tool_calls` and `observations` exist and `append_message` accepts them (`session_store.py:132`); the chat path passes only `actions` (`main.py:4074`).
When an owner reports a wrong answer you can see the text and the sources but not the decision. The schema is already there.

**C4 - Non-idempotent retry.** `ChatWidget.tsx:2785-2789` retries the whole POST once on a thrown stream error. The backend `finally` already persisted the first attempt, so a network drop yields two usage increments, two `chat_logs` rows, duplicated session turns, and a second full agent run. `client_message_id` is already sent and logged (`main.py:4227`) but unused for dedupe.

### D. Cache and signals

**D1 - Failures cached forever.** `main.py:4193-4196` gates the cache write on `len(full_reply) > 10` only. `is_un_final` is computed on the next line and never used. No TTL on `exact_query_cache`; invalidation happens only on training and knowledge mutation (`main.py:8508, 9516, 9845, 9893`).
One transient retrieval hiccup freezes "I don't have specific information about that yet" for that exact question-plus-history until the owner retrains.

**D2 - Truncated streams cached.** The same `finally` runs on client disconnect and after the `except` at `main.py:4180`. A visitor closing the tab mid-answer can permanently install a half-sentence as that question's canonical response.

**D3 - `is_unanswered` inverted.** `main.py:4199-4203`: `len(retrieved_docs) == 0` OR one of three hardcoded English substrings.
A correct tool-sourced price is flagged unanswered at confidence 0.0 when the KB returned nothing; a confidently fabricated answer with good retrieval scores as answered and confident.
Dependent surfaces: `/api/fixes-needed` (`main.py:7229`), the conversations unanswered filter (`main.py:6675`), the weekly digest, the session BI panel. All currently give owners inverted information.

**D4 - `confidence` measures the wrong thing.** `_compute_confidence` (`main.py:3042`) returns the reranker's opinion of the best *retrieved chunk*, not of the answer, and `rerank_chunks` early-returns without scoring at ≤5 candidates (`main.py:2560`) - so it is null for every new tenant.

**D5 - Divergent thresholds.** Hybrid path `< 0.7` (`main.py:2449`), fallback path `< 0.55` (`main.py:2512`).

**D6 - Dead code.** `context_text` (`main.py:3490`) is built from every retrieved doc and never read; the real, `_strip_control_tags`-sanitized context is `knowledge_context` (`main.py:3521`).

### E. Retrieval and ingestion

**E1 - No structured directory lookup.** `_is_entity_lookup_query` (`main.py:2368`) is a careful mitigation - it stops HyDE inventing the retrieval vector - but it only changes what gets embedded. The query still goes through fuzzy search and the answer is still assembled by the model.
Products got a table and a tool and became reliable. Contacts did not. See §3.

**E2 - One chunking strategy for all documents.** `main.py:8300-8307` splits everything at 1500/150 parent and 300/50 child. Tabular sources correctly bypass via `skip_splitting`, and `catalog_import` correctly routes structured product data.
Everything else - directory pages, spec tables inside PDFs, policies, FAQs - gets identical treatment. A 300-character child inside a contact table carries a name while the phone number sits in the next chunk.
This is the mechanical origin of the fabrication the directive tries to forbid at generation time.

**E3 - English text-search config over identifier data.** `main.py:2459,2464` use `plainto_tsquery('english', ...)`. English stemming and stopword removal are wrong for CAS numbers, batch codes, grade codes and HSN numbers. No trigram index, no exact-identifier path - so the lexical half of hybrid retrieval contributes least on exactly the queries where it should dominate.

**E4 - Over-fetched embeddings.** `main.py:3463-3464` truncates to 768 dims in Python rather than requesting `output_dimensionality=768`. Cosine is scale-invariant so correctness is unaffected, but 4x the vector is computed and transferred on every query and every ingested chunk.

### F. Widget

**F1 - No streaming on the agent path.** `main.py:4050-4051` emits the whole reply as one token; the generic bot streams properly. Demoted under this goal - cosmetic, not a precision issue - but the fix rides free on B2's compose stage.

**F2 - Errors leave the bubble typing forever.** `main.py:4180-4182` yields an error frame and ends. No `token` renders (`ChatWidget.tsx:2774`), `[DONE]` never arrives so `isStreaming` never clears (`ChatWidget.tsx:2681`), `onclose` only clears `isLoading` (`ChatWidget.tsx:2807`), and `fetch-event-source` resolves normally on a clean close so `onerror` never fires (verified in the library source).

**F3 - Two definitions of failure.** `ChatWidget.tsx:2712` hardcodes one English substring list; `main.py:3035` hardcodes a different one. Neither is authoritative. Should be a structured flag on the response.

**F4 - Single-slot client frames.** `pendingQuote`, `pendingSds`, `pendingCoa`, `pendingForm`, `pendingGradeSelector`, `pendingPackSelector` (`ChatWidget.tsx:2574-2592`) are each one variable. Client mirror of B4; both sides must move to arrays together.

---

## 6. Remediation order

### Track 1 - Stop producing wrong answers

Independent, individually shippable, no architectural change.

| # | Fix | ID | Size |
|---|---|---|---|
| 1 | Delete the founder clause and the "use your internal knowledge" licence from RULE 7 | A2 | minutes |
| 2 | Drop agent-path temperature to ~0.1-0.2 | B6 | minutes |
| 3 | Remove `search_catalog` from RULE 6 | A4 | minutes |
| 4 | Fork RULE 1 into a tool-aware variant for pack companies | A1 | half day |
| 5 | Gate cache writes on grounded + complete; add a TTL to `exact_query_cache` | D1, D2 | hours |
| 6 | Execute all tool calls in a round, or return an explicit "not executed" observation | B1 | half day |
| 7 | Sanitize and delimit client history; validate `role` against a literal set | C1 | half day |
| 8 | Consolidate the refusal into one structured outcome with one rendering | A6, F3 | 1 day |
| 9 | Reconcile the timeout budget from per-call timeout x retries x rounds | B5 | hours |
| 10 | Suppress `_captured` side effects when the turn's answer is a fallback | B3 | half day |
| 11 | Forced tool-free compose round; fallback only when there is truly nothing | B2 | 1-2 days |
| 12 | Handle the `error` SSE frame client-side; terminate with `[DONE]` after it | F2 | half day |
| 13 | Use `client_message_id` as an idempotency key on the chat write path | C4 | 1 day |

**Gate:** run `tests/test_guardrail_eval.py` with `RUN_LLM_EVALS=1` before and after items 1-4 and record both results.
Those four change model behaviour and the eval is the only instrument you have for it.

### Track 2 - Build the precision architecture

| Slice | Content | IDs |
|---|---|---|
| **A** | **Grounding gate.** Keep rerank scores, set a threshold, refuse below it. Refusal becomes a structured turn outcome. | B7 (part), D4 |
| **B** | **Runtime output check.** Promote `fabrication_hits` into the response path for value-class answers with no grounding observation. | B7 |
| **C** | **Entity-safe ingestion.** Source-type-aware extraction; never split a contact block, table row, or FAQ pair across chunks. Structure detection ahead of prose chunking. | E2 |
| **D** | **Identifier retrieval path.** Trigram / exact-match index alongside BM25; stop stemming identifiers. | E3, D5 |
| **E** | **Structured-kind registry.** Generalise `catalog_tables` into pack-configurable kinds. Ship **people/contacts first**, then FAQ pairs. Each gets a table, a resolve-or-refuse tool, and a directive route. | E1 |
| **F** | **Intent router.** Deterministic first, cheap classifier as fallback. Structured classes skip HyDE and rerank entirely. | B8 (part), A5 |
| **G** | **Turn pipeline extraction.** `services/agent_runtime/`, one `TurnResult` (text, events[], sources, tool_trace, status) that SSE, session, funnel, alerts and analytics all read. | B3, B4, F4 |
| **H** | **Tool registry.** One object per tool owning schema, executor, capture shape, funnel contribution and availability predicate. Startup assertion against the pack. | B9, B10 |
| **I** | **Prompt composer.** One authority order, static-before-volatile block ordering, asserted token budget, snapshot-tested. | A3, A5, A7, A8 |
| **J** | **KB search as a tool.** Retrieval becomes a decision, not a tax. | B8 |
| **K** | **Signals rebuild.** Replace `is_unanswered`/`confidence` with grounded-answer rate and refusal rate derived from `TurnResult`. Version the metric so owner dashboards do not silently change meaning. | D3, D4 |
| **L** | **Persist the tool trace.** `tool_calls`/`observations` written and surfaced in the owner conversation view. | C3 |
| **M** | Streaming compose; generic-bot server-side memory; embedding dimensionality; dead code. | F1, C2, E4, D6 |

**Operational warning on ordering.** Slice A (the grounding gate) will *increase* refusals on a corpus of badly-cut chunks, because it starts declining what the model used to guess at.
That is the correct behaviour, but owners will experience it as "the bot got quieter".
Ship Slice C (entity-safe ingestion) close behind A, and communicate the change - or gate A behind a per-tenant flag and enable it after their content is re-ingested.

Slices A through E are the load-bearing set for the stated goal.
F through M are each independently valuable and can be reordered against business need.

---

## 7. Measurement

You currently cannot manage precision, because D3 and D4 mean the two headline signals are inverted for the traffic that matters most.

Signals to add, derived from `TurnResult`:

- **Grounded-answer rate** - share of answers with a corresponding tool `found` or an above-threshold retrieval. This is the product KPI.
- **Refusal rate**, split by cause: no retrieval, below threshold, tool not-found, out of scope. A healthy precision bot has a non-trivial refusal rate; a zero refusal rate means it is guessing.
- **Retrieval miss rate** on identifier-bearing queries specifically.
- Per-tool outcome distribution: `found` / `ambiguous` / `not_found` / `error`.
- Round-exhaustion and deadline-hit rates. Today `logger.warning` only (`agent.py:1501`, `main.py:3960`), with no counter, despite `observability/metrics.py` having the machinery.

Tests worth adding:

1. Loop boundary tests: round exhaustion, and `len(tool_calls) > MAX_CALLS_PER_ROUND`. Both budget boundaries are currently untested, which is why B1 and B2 survived.
2. Grounding-gate tests: below-threshold evidence produces a refusal, not an answer.
3. Cache-write tests: a refusal is not cached; a truncated stream is not cached.
4. History-injection test: a forged assistant turn does not change refusal behaviour.
5. Chunk-integrity test: a fixture contact block and a fixture FAQ pair survive ingestion as single retrievable units.
6. A prompt snapshot test asserting block order, a single authority statement, and a token ceiling.
7. Move `test_guardrail_eval.py` into a scheduled CI job with a real key. A guardrail that runs only when someone remembers an env var is documentation, not a gate.

---

## 8. Do not regress these

- Tenant scoping on every tool query, without exception.
- Fuzzy names never auto-resolving to a product.
- Conflicting prices escalating rather than picking by DB order.
- POR requiring a valid email before finalising.
- The model never being shown a COA filename.
- SDS and quote links rendered by the widget from tool data, never typed by the model.
- Pack companies bypassing the exact-match cache (`main.py:3395`) - a cached SDS link would be a genuine safety issue.
- HyDE skipped for entity-lookup questions.
- The sample flow being a form rather than conversational slot-filling.
- Exact-match (not semantic) caching - see §2.2.
- Reranker, HyDE and summarizer pinned to temperature 0.0.
- Session summarisation being rolling and cost-bounded rather than whole-transcript.
