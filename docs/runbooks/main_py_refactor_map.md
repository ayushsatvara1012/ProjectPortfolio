# `main.py` Refactor Map (7,914 lines → modular)

Goal: split the monolith into focused modules **without changing behavior** and
**without breaking the 270 backend tests**. This is the plan; execution is
incremental (one module at a time, tests green after each).

---

## The two hard constraints (why we map first)

### 1. Shared globals must flow one direction only
A foundation layer is imported by everything. Import direction is strict:

```
config → db → models → ai_models → security → services → routers → main(app)
```
Foundation modules must **never** import a router. Routers must **never** import
`main`. Break this and you get circular imports.

### 2. Tests bind to the name `main`
Tests use BOTH styles:
- `from main import X`  (e.g. `ChatRequest`, `_check_custom_plan_gate`, `normalize_source_url`)
- `import main; main.X`  and `monkeypatch.setattr(main, ...)` (12 sites)
- `patch("main.get_db_connection")`, `patch("main.release_db_connection")`, `patch("main.log_admin_action")`

**Technique:** after moving a symbol out, `main.py` **re-imports it back** into its
own namespace (a facade). That keeps `from main import X` and `main.X` working
with the same object identity — tests stay untouched.

**The sharp edge:** `patch("main.get_db_connection")` only affects callers that
resolve the name through `main`. If an *endpoint* moves into a router and calls
`get_db_connection()` via `from db import get_db_connection`, the patch misses.
→ So endpoints that call patched helpers can only move once we also update those
specific patch paths in the tests. This is what splits the work into phases.

---

## Target module layout

### Foundation (Layer 0 — zero router deps)
| New file | Contents (current line refs) |
|----------|------------------------------|
| `config.py` | env vars (64–70), `PLAN_LIMITS` (474), `MODEL_MAPPING`/`VALID_MODELS` (485–494), `UNLIMITED_PLAN`, `POLAR_PRODUCT_TIER_MAP` (616), `TIER_RATE_LIMITS` (636), `WIDGET_SESSION_*` (660), `ALLOWED_ORIGINS` (964), `CUSTOM_PLAN_*` (1128–1215), logo constants (1041–1062), `FALLBACK_PHRASES`, `SPAM_WORDS`, lead keyword sets (2974–2988), `logger` |
| `db.py` | `_get_pool`/`get_db_connection`/`release_db_connection` (79–117), `shutdown_db_pool` (891), `_check_fts_column` (1280) |
| `models.py` | all Pydantic classes + enums (RegisterRequest, ChatMessage/Request/Response, LeadCaptureRequest, Subscription/Handoff, UserRole/UserTier, CustomPlanConfig, CompanyUpdate, RoiBenchmarkUpdate, Delete*Request, TrialExtensionRequest, CustomPlan*Request, EvalQuestion/EvalRunRequest) |
| `ai_models.py` | `get_embedding_model` wiring, `embeddings_model_doc/query` (1273), `get_tier_model` (498), `get_plan` (542) |

### Security (Layer 1)
| New file | Contents |
|----------|----------|
| `security/widget_session.py` | `_mint_widget_session`, `_verify_widget_session` (675–712) |
| `security/rate_limit.py` | `limiter` (602), `get_limit_key` (588), `_rate_limit_handler` (923), `enforce_tier_chat_limit` (722), `check_global_llm_budget` (898), `_alert_redis_down` |
| `security/auth.py` | JWKS cache + `get_clerk_jwks`/`verify_clerk_jwt` (1547–1608), `get_current_user` (1609), `get_admin_user`, `require_premium_tier`, `require_fresh_admin`, `verify_api_key_and_origin` (1329), `api_key_header` |
| `security/input_safety.py` | `validate_safe_url` (118), `validate_logo_url` (343), `normalize_source_url` (151), jailbreak load/strip (1019–1031) |

### Services / helpers (Layer 2)
| New file | Contents |
|----------|----------|
| `services/rag.py` | `hyde_expand` (1916), `retrieve_knowledge` (1954), `rerank_chunks` (2056) |
| `services/cache.py` | `build_query_hash`, `save_cache_entry`, `invalidate_cache` (2314–2349), `_config_cache_key_builder` |
| `services/analytics.py` | `log_chat_to_db`, `async_increment_usage`, `_compute_confidence` (2368–2403) |
| `services/ingestion.py` | `parse_tabular_to_docs` (182), `process_pdf_efficiently` (3961), `safe_json_loads`, `normalize_quick_questions` |
| `services/leads_scoring.py` | `_email_domain`, `_score_lead` (2995–3055), `_build_fixes_list` (3437) |
| `services/notifications.py` | `_fire_webhook` (2863), `_send_handoff_email` (2916) |
| `services/company.py` | `get_company_by_clerk_id` (1853), `log_admin_action` (433) |

### Routers (Layer 3 — one APIRouter per file)
| New file | Endpoints |
|----------|-----------|
| `routers/chat.py` | widget session (2427), chat (2446) |
| `routers/leads.py` | capture, handoff, list, delete, export (3056–3309) |
| `routers/conversations.py` | list_conversations (3327) |
| `routers/fixes.py` | list_fixes_needed (3481) |
| `routers/roi.py` | get/update roi (3560–3669) |
| `routers/insights.py` | generate_insight_report (3690) |
| `routers/training.py` | train, status, job runner (4037–4650) |
| `routers/companies.py` | register, rotate-key, list, delete, update_company (2162, 4651–4884) |
| `routers/knowledge.py` | sources/chunks CRUD (4886–5127) |
| `routers/config.py` | get_config (5141), get_bot_faqs (5168) |
| `routers/users.py` | me, company-details, subscription (5273–5427) |
| `routers/admin.py` | stats, users, custom-plan provision/override/metrics/dashboard (5359–6265, 7738–7928) |
| `routers/billing.py` | clerk + polar webhooks, portal, cancel, gdpr (6266–7191) |
| `routers/eval.py` | run_eval, results, _judge_single (7202–7505) |

### App assembly (Layer 4)
`main.py` shrinks to ~150–200 lines: create `app`, CORS, register limiter +
exception handler, `include_router(...)` for each, startup/shutdown events,
background reconciliation loop, `read_root`, **and the re-export facade**.

---

## Execution order (safest → riskiest)

**Phase A — zero test risk (re-export facade only):**
1. `models.py`  ← pure Pydantic, not patched. Best first slice.
2. `config.py`  ← constants/env.
3. `services/leads_scoring.py`, `services/ingestion.py` ← pure helpers, tested by value.

Each step: move code → `main.py` re-imports the names → run 270 tests → commit-worthy.

**Phase B — foundation with patched helpers (update patch paths):**
4. `db.py` (then update `patch("main.get_db_connection"/"release_db_connection")` → new path, or keep a `main`-level wrapper).
5. `ai_models.py`, `security/*`.

**Phase C — routers (one at a time):**
6. Move one router, switch `@app.*` → `@router.*`, `app.include_router(...)`,
   fix that router's test patch targets, run tests, repeat.
   Start with a self-contained one (`routers/fixes.py` or `routers/roi.py`).

**Phase D — thin `main.py`** once everything is extracted.

---

## Rules we follow during execution
- **No logic edits** — relocation only. Tests are the proof of equivalence.
- **Run all 270 tests after every module move.** Never batch.
- **Per-file approval** before each move.
- If a move would require touching a test's patch path, that change is called out
  and approved explicitly (not silent).

## Recommended first move
`models.py` — ~20 Pydantic classes, imported by value, no patch coupling. It
proves the re-export facade end-to-end with essentially zero risk.
