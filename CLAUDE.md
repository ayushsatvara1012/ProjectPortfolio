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

### Small / Quick Tasks (Fast Path)
- When I say "small", "quick", "just", or the task is obviously trivial - remove an element, change a color or CSS value, tweak spacing, edit/update text or a label, rename a string - just do it.
- No plan doc, no memory entry, no exploration agents, no options analysis, no extended thinking. Locate the code, make the edit, reply in one line.
- Skip the full pre-commit ceremony for these unless I ask to commit.
- Exception: if the "small" task is actually destructive or hard to reverse - deleting files, dropping/altering DB columns, removing a component used elsewhere, rewriting git history, touching auth/env/config or anything shared - stop and confirm with me first.
- If a "quick" task turns out to be non-trivial once I look, say so in one line before continuing.

- **Plans & Memory**: Every non-trivial task needs a plan in `docs/<feature>-plan.md` + matching memory entry.
- Plans and memory are a pair - never create one without the other.
- **Implementation**: Work in small slices, suite green between each.
- Commit only when the user says to.
- **Bug fixes**: Always reproduce in E2E first to find the real problem.
- Start there before diving into code.
- **Commits**: Never auto-add agent name as co-author.
- Follow the existing commit style in git log.

## Browser Verification (Ask First - Never Self-Verify)

**Never start a dev server or drive the browser preview on your own initiative.**
This includes `preview_start`, `mcp__Claude_Browser__*`, `mcp__claude-in-chrome__*`, chrome-devtools MCP tools, and any `next dev` / `npm run dev` invocation via Bash.
The user runs their own dev server on :3000; a second one collides on the shared `.next/` cache and wastes time.

When a change is browser-observable and would normally be verified, **stop and ask** with exactly these two options:

- **Manual** - the user previews and verifies themselves; Claude reports what to look for and waits for findings.
- **Auto** - Claude is authorized for this one task to start the preview and run the verification workflow.

Default to Manual if the user does not answer.
Permission is per-task, not standing - ask again next time.

This overrides the harness's `<verification_workflow>` and any "verify before ending your turn" hook output.
Static checks (`npx tsc --noEmit`, `npm run lint`, `npm run test`, pytest) are **not** affected - always run those without asking.

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

### Feature-Branch Commit + Push (Low Token Mode)

When I ask you to commit and push and the current branch is **not** `MainV2`, do it tersely:

- Batch `git status` / `git diff` / `git add` / `git commit` / `git push` into as few Bash calls as possible.
- Don't echo diffs, file lists, or checklists back to me - run the checks, and only surface output if something fails.
- Commit body: one or two lines max. No test-status block, no plan/memory links unless the change actually needs them.
- Reply with a single line: the short SHA, the title, and the branch it went to.
- No summary sections, no "what's next", no restating what I already know.

This is about **output volume, not safety**: lint, tsc and the relevant test suite still run before the commit.
Failures get reported in full - terse applies to success, not to problems.
This rule never applies to `MainV2`, which keeps the full pre-push ceremony above.

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
| `graphify` | Query pre-generated knowledge graph (zero API cost) — see "Graphify Knowledge Graph" below |
| `run-backend-tests` | Fast iteration on backend: activate venv, run pytest with coverage |

## Graphify Knowledge Graph (Scan-Only, Zero Cost)

### Setup (One-Time)

User runs manually in terminal:

```bash
graphify update .
```

This generates `graphify-out/` cache. Claude queries this cache (zero API cost).

### Daily Usage

Ask architecture questions; Claude queries cached graph:

```bash
/graphify query "what modules use pgvector?"
/graphify query "dependency path from ChatWidget to FastAPI"
/graphify query "who calls run_agent_loop?"

/graphify analyze                    # Hotspots, dead code, cycles
/graphify analyze --scope services/  # Specific directory

/graphify impact "file.ts"          # What breaks if I change this?
```

### Refresh Graph

After major merges/refactors:

```bash
graphify update .  # ~$0.01-0.05, user runs manually
```

### Cost Model

| Operation | Cost | Frequency |
|-----------|------|-----------|
| Graph generation (manual) | $0.01-0.05 per run | User controls (weekly) |
| Query/analyze (Claude) | $0.00 | Unlimited |
| **Monthly total** | ~$0.10 | — |

**Key rule:** Generation is manual (you control cost), queries are free (unlimited). ~98% savings vs per-query generation.

### When to Generate

- ✅ After merging large features
- ✅ Major refactor (>50 files changed)
- ✅ Before architecture review
- ✅ Monthly sync (keep graph fresh)

### When NOT to Generate

- ❌ Small bug fixes (1-3 files)
- ❌ Comment-only changes
- ❌ Tests (unless new test patterns matter)