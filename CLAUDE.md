# Sapybase / Vaayu - Project Portfolio

## Decision-Making Philosophy

- When making technical decisions, do not give much weight to development cost. Instead, prefer quality, simplicity, robustness, scalability, and long term maintainability.
- Don't design for hypothetical future requirements.
- If you see a bug, lint failure, or test flakiness - even unrelated to current work - fix it.

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
src/app/(app)/dashboard/     # Owner dashboard
src/app/(app)/(site)/        # Public marketing site
src/app/embed/               # Widget embed route
src/components/              # Shared UI components
sapybase_ai_engine/          # Python FastAPI backend
sapybase_ai_engine/packs/    # Vertical pack registry (load_pack pattern)
sapybase_ai_engine/services/ # Business logic (agents, RAG, etc.)
sapybase_ai_engine/tests/    # Pytest suite
docs/                        # Feature plans and runbooks
.claude/skills/              # Project skills
graphify-out/                # Architecture graph (auto-generated)
```

## Coding rules

### Language & Structure
- TypeScript for all frontend files.
- Python for all backend files.
- Tailwind CSS for styling.
- Font: Plus Jakarta Sans (`font-google`).
- Icons: Material Symbols Outlined.
- Server Components by default; add `'use client'` only when hooks/interactivity are needed.
- Never hardcode vertical-specific logic (`if chemical`).
- Use the pack registry pattern: `load_pack(vertical)` drives behavior via config.
- Backend endpoints: all in `main.py`.
- Tenant-scoped queries: always `WHERE company_id = %s`.
- Widget (`ChatWidget.tsx`): the single source of truth for the chat UI.
- `BotPreview.tsx` should render the real widget in preview mode, not duplicate markup.

### Safety & Quality
- SDS/hazard/handling answers come ONLY from tool-returned documents, never LLM-generated.
- Never modify auto-generated files (CHANGELOG.md, generated types, etc.).
- Each full sentence on its own line in Markdown files (readability, diffability).
- Use plain dash "-" instead of em dash "-" everywhere.
- Pixel-perfect UI: if something looks off, fix it.
- Apply same rigor to code: zero lint failures, no test flakiness.

## Branch strategy

- `MainV2` = production. Vercel and Render auto-deploy from this branch.
- Feature branches merge to `MainV2` only after testing.
- Never commit `.env`, pricing PDFs, or API keys.

## Workflow

- **Plans & Memory**: Every non-trivial task needs a plan in `docs/<feature>-plan.md` + matching memory entry.
- Plans and memory are a pair - never create one without the other.
- **Implementation**: Work in small slices, suite green between each.
- Commit only when the user says to.
- **Bug fixes**: Always reproduce in E2E first to find the real problem.
- Start there before diving into code.
- **Commits**: Never auto-add agent name as co-author.
- Follow the existing commit style in git log.

## Git Commit Discipline

### Pre-Commit Checklist
- `git status` - review staged files, catch secrets/binaries.
- `npm run lint` - zero lint errors (enforced in pre-push check skill).
- `npx tsc --noEmit` - zero TypeScript errors.
- `npm run test` - frontend suite green.
- `sapybase_ai_engine/venv/bin/python -m pytest tests/ -q` - backend suite green.
- Migrations idempotency: if you touched `migrations/`, verify the migration is safe to re-run.

### Commit Message Convention
- **Title:** Imperative, specific, under 70 chars.
  - ✅ "Add Explore freemium tier to config"
  - ✅ "Fix email reset window calculation"
  - ✅ "Refactor pack registry to reject hardcoded verticals"
- **Body (required for non-trivial commits):** 2-3 sentences explaining **why** this change exists.
  - Link to memory or plan: "See memory/explore-freemium-plan.md Phase A0-2"
  - Link to GitHub issue/PR if applicable
  - Include test status: "Suite green (571 backend tests, tsc 0)"
  - Example:
    ```
    Implement Polar-anchored monthly reset for Explore tier

    Explore limits reset on Polar's billing_period_end, not a
    rolling 30-day window. This anchors the reset to the customer's
    actual subscription renewal date, matching D2 locked decision.

    See memory/explore-freemium-plan.md Phase A0-3. Suite green
    (571 backend tests, tsc 0).
    ```

### Branch Names (Strict)
- Feature: `feature/explore-enquiry-form`
- Bugfix: `bugfix/email-reset-window`
- Refactor: `refactor/vertical-pack-registry`
- Chore: `chore/update-dependencies`
- **Avoid:** `dev`, `wip`, `temp`, `fix-stuff` (too vague).

### Merging to MainV2
- **Never push directly to MainV2** - always merge via PR + code review.
- **Before merging:** verify CI passes (tsc, lint, tests).
- Run `pre-push-check` skill before pushing: tsc, lint, tests, migration safety, graphify freshness.
- Squash or rebase (no merge commits) - keep history linear and readable.

### What NOT to Commit
- `.env`, `.env.local`, `.env.*.local` (environment variables with secrets).
- `migrations/*.sql` with hardcoded data or passwords.
- Pricing PDFs, API keys, private docs.
- `node_modules/`, `venv/`, `.next/`, `__pycache__/`.
- `*.db`, test artifacts, coverage reports (covered by .gitignore).
- Auto-generated files (CHANGELOG.md, generated types).

### Database Migration Commits
- Every migration gets its own commit (not bundled with code).
- Message format:
  ```
  Add migration 0024: explore_enquiries table

  Creates the enquiry form storage + indexes for Phase B enquiry capture.
  Migration: ADD COLUMN IF NOT EXISTS (additive, safe to re-run).

  Applied dark to prod control DB via Supabase MCP; alembic stamp as no-op.
  ```

### Error Recovery
- **Pushed to wrong branch?** Use `git revert` (creates a new commit undoing changes) - never force-push.
- **Committed secrets?** Notify immediately + rotate keys + use `git filter-branch` (only with help).
- **Amending a published commit?** Don't - create a new commit with the fix instead.

## Skills

Project-scoped skills in `.claude/skills/`. Invoke via `Skill` tool when matched.

| Skill | When to use |
|-------|-------------|
| `pre-commit-check` | Before committing: git status, lint, tsc, tests, migration safety check |
| `migration-apply-dark` | Applying Alembic migration to prod control DB (idempotent, then stamp as no-op) |
| `vertical-pack-scaffold` | Creating new vertical pack with config pattern, rejecting hardcoded `if vertical` logic |
| `pre-push-check` | Before pushing to MainV2: verify suite green, migration safety, graphify freshness |
| `plan-memory-sync` | Creating feature plan: scaffold docs + memory stub + index entry in one shot |
| `graphify-refresh` | After large merges to keep architecture graph fresh |
| `run-backend-tests` | Fast iteration on backend: activate venv, run pytest with coverage |

## Architecture queries

Use `/graphify` skill for deep codebase exploration.
Use `/graphify query "<your question>"` to search architecture relationships.
For quick semantic overview, refer to "Project structure" section above.