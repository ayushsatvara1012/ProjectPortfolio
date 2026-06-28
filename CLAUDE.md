# Sapybase / Vaayu — Project Portfolio

## Architecture

- **Frontend**: Next.js 16 (App Router) + React 19 + TypeScript + Tailwind CSS 4
- **Backend**: Python 3.12 FastAPI (`sapybase_ai_engine/`) served by Uvicorn
- **Auth**: Clerk (`@clerk/nextjs` v7)
- **State**: TanStack React Query
- **DB**: Supabase Postgres (pgvector for RAG embeddings)
- **Deploy**: Frontend on Vercel, Backend on Render (branch: `MainV2`)

## Commands

```bash
# Dev
npm run dev              # Next.js on :3000
npm run dev:backend      # Uvicorn on :8000 (activates venv)
npm run dev:all          # Both concurrently

# Test
npm run test                                              # Frontend (Vitest)
sapybase_ai_engine/venv/bin/python -m pytest tests/ -q    # Backend (pytest)

# Type check
npx tsc --noEmit

# Lint
npm run lint
```

## Project structure

```
src/app/(app)/dashboard/   # Owner dashboard (settings, insights, customize)
src/app/(app)/(site)/      # Public marketing site
src/app/(app)/(auth)/      # Clerk auth pages
src/app/embed/             # Widget embed route
src/app/components/        # Shared components (ChatWidget, BotPreview, etc.)
src/lib/context/           # React contexts (BotSettings, User, etc.)
sapybase_ai_engine/        # Python backend
  packs/                   #   Vertical-pack registry (chemical.py, schema.py)
  agent.py                 #   ReAct agent loop + tool implementations
  main.py                  #   FastAPI app (~7k lines, all endpoints)
  tests/                   #   pytest suite
docs/                      # Feature plan documents
graphify-out/              # AST knowledge graph output
```

## Coding rules

- TypeScript for all frontend files. Python for all backend files.
- Tailwind CSS for styling. Font: Plus Jakarta Sans (`font-google`). Icons: Material Symbols Outlined.
- Server Components by default; add `'use client'` only when hooks/interactivity are needed.
- Never hardcode vertical-specific logic (`if chemical`). Use the pack registry pattern: `load_pack(vertical)` drives behavior via config.
- Safety guardrail: SDS/hazard/handling answers come ONLY from tool-returned documents, never LLM-generated.
- Backend endpoints: all in `main.py`. Tenant-scoped queries: always `WHERE company_id = %s`.
- Widget (`ChatWidget.tsx`): the single source of truth for the chat UI. `BotPreview.tsx` should render the real widget in preview mode, not duplicate markup.

## Branch strategy

- `MainV2` = production. Vercel and Render auto-deploy from this branch.
- Feature branches merge to `MainV2` only after testing.
- Never commit `.env`, pricing PDFs, or API keys.

## Workflow

- **Plans**: Every non-trivial task gets a plan document in `docs/<feature>-plan.md` before implementation starts. Always save a corresponding memory entry linking to the plan so future sessions have context. Plans and memory are a pair — never create one without the other.
- **Memory**: After decisions are locked or a phase ships, save the key facts (what was decided, why, what's next) to memory. Never duplicate what the code or git log already shows.
- **Implementation**: Work in small slices, suite green between each. Commit only when the user says to.

## Before searching files

Check `graphify-out/GRAPH_REPORT.md` first to understand architecture and save tokens.