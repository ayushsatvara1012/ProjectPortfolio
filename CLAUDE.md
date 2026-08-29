# Sapybase / Vaayu

Multi-tenant AI agent platform. Facts about this repo.
Behavioral rules live in the global `~/.claude/CLAUDE.md`.

## Stack

- **Frontend:** Next.js 16 (App Router) + React 19 + TypeScript + Tailwind CSS 4
- **Backend:** Python 3.12 FastAPI in `sapybase_ai_engine/`, served by Uvicorn
- **Auth:** Clerk (`@clerk/nextjs` v7) - **State:** TanStack React Query
- **DB:** Supabase Postgres, pgvector for RAG embeddings
- **Deploy:** `MainV2` is production. Vercel (frontend) and Render (backend) auto-deploy from it.

## Commands

```bash
npm run dev:all                                            # Next :3000 + Uvicorn :8000
npm run test                                               # Frontend (Vitest)
sapybase_ai_engine/venv/bin/python -m pytest tests/ -q     # Backend (pytest)
npx tsc --noEmit                                           # Type check
npm run lint
```

All four must be green before committing.

## Invariants

Violating any of these is a real bug, not a style issue.

- **Never hardcode vertical logic** (`if vertical == "chemical"`). Behavior comes from `load_pack(vertical)` config in `sapybase_ai_engine/packs/`.
- **SDS, hazard, and handling answers come only from tool-returned documents.** Never LLM-generated, never paraphrased. Safety-critical.
- **Every tenant-scoped query needs `WHERE company_id = %s`.** No exceptions.
- **All backend endpoints live in `main.py`.** Business logic goes in `services/`.
- **`ChatWidget.tsx` is the single source of truth for chat UI.** `BotPreview.tsx` renders the real widget in preview mode - it must not duplicate markup.
- Server Components by default; `'use client'` only when hooks or interactivity require it.
- Font: Plus Jakarta Sans. Icons: Material Symbols Outlined.

## Branch & deploy

- Never push directly to `MainV2` - merge via PR. A push deploys to production immediately.
- Squash or rebase; no merge commits.
- Never commit `.env*`, pricing PDFs, API keys, or `migrations/*.sql` containing data or credentials.

## Migrations

- Own commit, separate from code. Must be idempotent (`ADD COLUMN IF NOT EXISTS`).
- Applied dark to the prod control DB via Supabase MCP, then alembic-stamped as a no-op.
- Commit body records which of those steps ran.

## Docs

- `docs/*-plan.md` - active work.
- `docs/archived/` - shipped. Historical intent, not current behavior. Where it disagrees with the code, the code is correct.
- `docs/runbooks/` - operational procedures.

## Graphify

`graphify-out/` holds a pre-generated knowledge graph. Query it via the `graphify` skill - free, no API cost.
Regenerating (`graphify update .`) costs money and is run manually by the user, not by Claude.
