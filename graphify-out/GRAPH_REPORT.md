# Graph Report - .  (2026-05-01)

## Corpus Check
- 186 files · ~326,643 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1137 nodes · 1992 edges · 35 communities detected
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 17 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Backend API & Business Logic|Backend API & Business Logic]]
- [[_COMMUNITY_Frontend Widget Components|Frontend Widget Components]]
- [[_COMMUNITY_Motion & Animation System|Motion & Animation System]]
- [[_COMMUNITY_Asynchronous Streaming Logic|Asynchronous Streaming Logic]]
- [[_COMMUNITY_Component Lifecycle Management|Component Lifecycle Management]]
- [[_COMMUNITY_Chat UI & Loader Integration|Chat UI & Loader Integration]]
- [[_COMMUNITY_Dashboard & Demo Workflows|Dashboard & Demo Workflows]]
- [[_COMMUNITY_Data Processing & Serialization|Data Processing & Serialization]]
- [[_COMMUNITY_File System & Path Utilities|File System & Path Utilities]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 33|Community 33]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 43|Community 43]]
- [[_COMMUNITY_Community 44|Community 44]]
- [[_COMMUNITY_Community 98|Community 98]]
- [[_COMMUNITY_Community 105|Community 105]]

## God Nodes (most connected - your core abstractions)
1. `Js()` - 279 edges
2. `get_db_connection()` - 50 edges
3. `release_db_connection()` - 50 edges
4. `$s` - 31 edges
5. `al()` - 24 edges
6. `zi` - 20 edges
7. `ll` - 18 edges
8. `fl` - 18 edges
9. `rp` - 18 edges
10. `SapybaseWidget` - 17 edges

## Surprising Connections (you probably didn't know these)
- `FastAPI App` --semantically_similar_to--> `Clerk Auth`  [INFERRED] [semantically similar]
  sapybase_ai_engine/main.py → src/middleware.ts
- `process_pdf_efficiently()` --calls--> `set()`  [INFERRED]
  sapybase_ai_engine/main.py → src/app/dashboard/settings/admin/page.tsx
- `handleTrain()` --calls--> `parseFileToChunks()`  [INFERRED]
  src/app/dashboard/train/page.tsx → src/lib/demo/demoRag.ts
- `handlePurge()` --calls--> `clearKnowledge()`  [INFERRED]
  src/app/dashboard/train/page.tsx → src/lib/demo/demoStorage.ts
- `ingest_knowledge()` --calls--> `get_embedding_model()`  [INFERRED]
  sapybase_ai_engine/ingest.py → sapybase_ai_engine/embedding_config.py

## Communities

### Community 0 - "Backend API & Business Logic"
Cohesion: 0.02
Nodes (189): BaseModel, Enum, AdminUpdateUserRequest, async_increment_usage(), build_query_hash(), cancel_subscription(), capture_lead(), chat_endpoint() (+181 more)

### Community 1 - "Frontend Widget Components"
Cohesion: 0.02
Nodes (132): $a(), ad(), Ae(), ai(), ao(), at(), Ba(), bc() (+124 more)

### Community 2 - "Motion & Animation System"
Cohesion: 0.03
Nodes (42): al(), Be(), Bl(), Bs(), cl, ds(), ec(), es() (+34 more)

### Community 3 - "Asynchronous Streaming Logic"
Cohesion: 0.03
Nodes (22): au(), bi(), cc(), ci(), e(), fl, gd(), gi() (+14 more)

### Community 4 - "Component Lifecycle Management"
Cohesion: 0.06
Nodes (14): as(), bu, cs(), gp(), Iu(), ko(), lp, mo() (+6 more)

### Community 5 - "Chat UI & Loader Integration"
Cohesion: 0.07
Nodes (10): handleKeyDown(), handleSend(), handleSubmit(), sendMessage(), sync(), _buildFabSvg(), _hexToRgba(), SapybaseWidget (+2 more)

### Community 6 - "Dashboard & Demo Workflows"
Cohesion: 0.08
Nodes (22): handleSave(), clearKnowledge(), getBotConfig(), getKnowledge(), isTrained(), resetDemo(), saveBotConfig(), saveKnowledge() (+14 more)

### Community 7 - "Data Processing & Serialization"
Cohesion: 0.17
Nodes (13): dn(), eo(), I, Kn(), n(), Pn(), qn(), u() (+5 more)

### Community 8 - "File System & Path Utilities"
Cohesion: 0.16
Nodes (11): co(), ee(), fn(), gn(), In(), j(), ln(), mn() (+3 more)

### Community 9 - "Community 9"
Cohesion: 0.18
Nodes (4): _buildFabSvg(), _hexToRgba(), SapybaseWidget, _shadeColor()

### Community 10 - "Community 10"
Cohesion: 0.25
Nodes (13): extractCsvText(), extractExcelText(), extractPdfText(), extractTextFromFile(), _findHeaderRow(), parseCsvLine(), parseFileToChunks(), retrieveChunks() (+5 more)

### Community 11 - "Community 11"
Cohesion: 0.15
Nodes (3): handleCancel(), handleSelectPlan(), showAlert()

### Community 12 - "Community 12"
Cohesion: 0.45
Nodes (11): check_db(), check_env_vars(), check_gemini(), check_mark(), check_ngrok(), check_ports(), check_venv(), main() (+3 more)

### Community 13 - "Community 13"
Cohesion: 0.22
Nodes (3): handleTierChange(), handleToggleCustom(), set()

### Community 14 - "Community 14"
Cohesion: 0.31
Nodes (5): buildCalendarData(), buildDemoReport(), formatDateStr(), generateLast30Days(), renderHeader()

### Community 15 - "Community 15"
Cohesion: 0.25
Nodes (2): BotSettingsProvider(), useAuthenticatedFetch()

### Community 16 - "Community 16"
Cohesion: 0.29
Nodes (5): get_embedding_model(), Return a configured embedding model for the given task type.      task_type: 're, ingest_knowledge(), list_companies(), Run this to find your real company ID if ingest fails with FK violation.

### Community 17 - "Community 17"
Cohesion: 0.38
Nodes (6): cleanup(), delete_from_clerk(), load_environment(), Load the production/development environment variables., Safely delete a user from the Clerk Dashboard., Main cleanup logic with cascading support.

### Community 20 - "Community 20"
Cohesion: 0.33
Nodes (5): downgrade(), Migrate the four self-healing ALTER TABLE calls out of startup_event into Alembi, Add the four columns previously managed by startup_event.      Idempotent on pro, Drop the four columns. DESTRUCTIVE — loses webhook ordering state., upgrade()

### Community 21 - "Community 21"
Cohesion: 0.33
Nodes (5): downgrade(), baseline — stamp the current production schema as revision 0001.  Created: 2026-, Baseline — no-op. Production schema is assumed to already match.      See module, No-op. There is nothing meaningful to downgrade past the baseline.      Restore, upgrade()

### Community 22 - "Community 22"
Cohesion: 0.33
Nodes (1): DashboardErrorBoundary

### Community 25 - "Community 25"
Cohesion: 0.4
Nodes (4): Run migrations in 'offline' mode.      This configures the context with just a U, Run migrations in 'online' mode.      In this scenario we need to create an Engi, run_migrations_offline(), run_migrations_online()

### Community 26 - "Community 26"
Cohesion: 0.5
Nodes (4): fetchall(), main(), Schema audit — Step 4.1 of the production-readiness plan.  READ-ONLY introspecti, SELECT-only helper. Asserts no DDL keywords.

### Community 28 - "Community 28"
Cohesion: 0.4
Nodes (2): UserSeed(), useUserRole()

### Community 29 - "Community 29"
Cohesion: 0.67
Nodes (3): main(), SSE concurrency load test for /api/chat.  Usage (from Sapybase_ai_engine/ with v, run_one_stream()

### Community 31 - "Community 31"
Cohesion: 0.67
Nodes (2): handleUrlChange(), preValidateUrl()

### Community 32 - "Community 32"
Cohesion: 0.5
Nodes (2): Alert(), handleExport()

### Community 33 - "Community 33"
Cohesion: 0.83
Nodes (3): clear(), finish(), start()

### Community 34 - "Community 34"
Cohesion: 0.67
Nodes (2): manual_sync(), Manually syncs your specific Clerk User ID to the Sapybase database.     Use thi

### Community 35 - "Community 35"
Cohesion: 0.67
Nodes (2): Seeds the database with the initial Admin user and company.     Restores the exi, seed_production()

### Community 36 - "Community 36"
Cohesion: 0.67
Nodes (2): purge_database(), Safely and completely wipes the database clean for production launch.     Uses T

### Community 43 - "Community 43"
Cohesion: 0.67
Nodes (1): UpgradeError

### Community 44 - "Community 44"
Cohesion: 0.67
Nodes (3): FastAPI App, Plan Limits, Clerk Auth

### Community 98 - "Community 98"
Cohesion: 1.0
Nodes (2): Ayush Satvara, Sapybase

### Community 105 - "Community 105"
Cohesion: 1.0
Nodes (1): Defense-in-depth: Strips known prompt injection trigger phrases from         use

## Knowledge Gaps
- **103 isolated node(s):** `Run this to find your real company ID if ingest fails with FK violation.`, `Return a configured embedding model for the given task type.      task_type: 're`, `Config`, `Get a warm connection from the pool (~1ms vs ~50ms for new conn).`, `Return connection to pool — does NOT close it (keeps it warm).` (+98 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Community 15`** (8 nodes): `BotSettingsProvider()`, `COMPANY_DETAILS_KEY()`, `mapCompanyToSettings()`, `useBotSettings()`, `useAuthenticatedFetch()`, `useIsAuthReady()`, `BotSettingsContext.tsx`, `useAuthenticatedFetch.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 22`** (6 nodes): `DashboardErrorBoundary`, `.componentDidCatch()`, `.getDerivedStateFromError()`, `.render()`, `SidebarItem()`, `AppLayout.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 28`** (5 nodes): `UserSeed()`, `mapMe()`, `useUserRole()`, `UserSeed.tsx`, `UserContext.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 31`** (4 nodes): `handleUrlBlur()`, `handleUrlChange()`, `preValidateUrl()`, `LogoCustomizer.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 32`** (4 nodes): `Alert()`, `handleExport()`, `Alert.tsx`, `LeadsPanel.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 34`** (3 nodes): `mock_sync.py`, `manual_sync()`, `Manually syncs your specific Clerk User ID to the Sapybase database.     Use thi`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 35`** (3 nodes): `seed_production.py`, `Seeds the database with the initial Admin user and company.     Restores the exi`, `seed_production()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 36`** (3 nodes): `purge_database()`, `production_purge.py`, `Safely and completely wipes the database clean for production launch.     Uses T`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 43`** (3 nodes): `UpgradeError`, `.constructor()`, `errors.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 98`** (2 nodes): `Ayush Satvara`, `Sapybase`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 105`** (1 nodes): `Defense-in-depth: Strips known prompt injection trigger phrases from         use`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Js()` connect `Frontend Widget Components` to `Motion & Animation System`, `Asynchronous Streaming Logic`, `Component Lifecycle Management`, `Data Processing & Serialization`, `File System & Path Utilities`?**
  _High betweenness centrality (0.214) - this node is a cross-community bridge._
- **Why does `al()` connect `Motion & Animation System` to `Frontend Widget Components`, `Asynchronous Streaming Logic`, `Component Lifecycle Management`?**
  _High betweenness centrality (0.019) - this node is a cross-community bridge._
- **Why does `$s` connect `Motion & Animation System` to `Frontend Widget Components`, `Asynchronous Streaming Logic`, `Component Lifecycle Management`?**
  _High betweenness centrality (0.012) - this node is a cross-community bridge._
- **What connects `Run this to find your real company ID if ingest fails with FK violation.`, `Return a configured embedding model for the given task type.      task_type: 're`, `Config` to the rest of the system?**
  _103 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Backend API & Business Logic` be split into smaller, more focused modules?**
  _Cohesion score 0.02 - nodes in this community are weakly interconnected._
- **Should `Frontend Widget Components` be split into smaller, more focused modules?**
  _Cohesion score 0.02 - nodes in this community are weakly interconnected._
- **Should `Motion & Animation System` be split into smaller, more focused modules?**
  _Cohesion score 0.03 - nodes in this community are weakly interconnected._