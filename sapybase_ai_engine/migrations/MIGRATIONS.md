# Database Migrations

This project uses **Alembic** for all schema changes. Adopted in Step 4 of the
production-readiness plan (2026-04-26). Replaces the previous manual
`v8-v22.sql` files plus self-healing `ALTER TABLE IF NOT EXISTS` calls in
`main.py:startup_event`.

The Alembic config lives at:

- `Sapybase_ai_engine/alembic.ini` — config (URL is loaded from env, not stored here)
- `Sapybase_ai_engine/alembic_migrations/env.py` — runtime config; loads `DATABASE_URL` from `.env`
- `Sapybase_ai_engine/alembic_migrations/versions/` — versioned migration files

The legacy `v8-v22.sql` files in this directory are kept for **historical
reference only**. Do not apply them; the production schema they describe was
baselined as revision `0001`.

---

## Day-to-day commands

All commands run from `Sapybase_ai_engine/` with the venv activated.

```bash
# Where is prod right now?
./venv/bin/alembic current

# What's the latest revision in code?
./venv/bin/alembic heads

# Apply all pending migrations (this is what Render runs pre-deploy)
./venv/bin/alembic upgrade head

# Create a new migration
./venv/bin/alembic revision -m "short imperative description"

# Roll back one revision (DEV ONLY — see "Downgrades" below)
./venv/bin/alembic downgrade -1

# View full migration history
./venv/bin/alembic history
```

---

## Authoring rules — non-negotiable

### 1. Every PR that touches schema MUST ship with an Alembic migration in the same commit

- No more `cursor.execute("ALTER TABLE ...")` anywhere in `main.py` or `startup_event`.
- If you add a column, the migration adds it. If you create a table, the migration creates it.
- The `MIGRATION CHECK` block in `startup_event` only *warns* when prod's `alembic_version` row
  lags behind code's HEAD. It does not run migrations — Render's pre-deploy command does.

### 2. Every migration MUST have a working `downgrade()` unless explicitly justified

If `downgrade()` is left empty or destructive, the migration's docstring must say WHY.
Example justifications: "drops a column with PII data — restore from backup if needed",
"creates a table with foreign keys; downgrade requires manual cleanup of dependent rows".

### 3. Use `IF NOT EXISTS` / `IF EXISTS` for idempotency

Migrations should be safe to re-run. Even though Alembic tracks state, a partial failure
mid-migration shouldn't block the retry. Pattern:

```python
op.execute("ALTER TABLE companies ADD COLUMN IF NOT EXISTS new_col TEXT")
```

### 4. Long-running migrations get a "DEPLOYMENT NOTES" docstring section

If a migration is expected to run longer than ~5 seconds (large data backfill, index
creation on a big table, etc.), the docstring must include:

```
== DEPLOYMENT NOTES ==
Estimated duration: X minutes on a database of Y rows.
Locking: Acquires <ACCESS EXCLUSIVE | SHARE> on table Z.
Safe-deploy procedure: <e.g. "use CREATE INDEX CONCURRENTLY in two
revisions: one to create, one to validate. See revision NNNN for example.">
```

### 5. Schema changes that touch production data require a backfill plan

Adding a NOT NULL column to a populated table requires three steps:

1. Migration A: add the column nullable, with a default if appropriate
2. Backfill: separate script (or migration with `op.execute("UPDATE ...")`) populates existing rows
3. Migration B: alter to NOT NULL

Never combine these into one migration — the lock duration on a large table is unbounded.

---

## Downgrades — when to use them

**Production:** Almost never. Restore from a Postgres backup instead. A downgrade on a
live system implies undoing a state transition that may have already affected user data
in ways the schema downgrade cannot reverse.

**Development:** Frequently. Test forward+back to confirm `downgrade()` works before
merging. A migration without a tested downgrade is a one-way door.

---

## Multiple devs writing migrations

Alembic uses a single linear history — there is no `--autogenerate` here, and no merge
strategy for branched revisions. The rule:

- Always rebase your branch on `main` before generating a revision.
- If you discover your migration's `down_revision` no longer matches `main`'s HEAD,
  you must regenerate the file (or hand-edit `down_revision`) before merge.

---

## Render deploy hook

Render runs `alembic upgrade head` automatically before each deploy via the
**Pre-Deploy Command** field in the service settings. See `RENDER_DEPLOY.md`
in this directory for the exact configuration.

If a migration fails during pre-deploy, Render aborts the deploy and the
previous version keeps serving — no partial state. Investigate, fix the
migration in a follow-up commit, redeploy.

---

## Historical context — what was here before

Before Alembic:

- `migrations/v8-v22.sql` files were applied manually via `psql` against production
- `startup_event` in `main.py` ran `ALTER TABLE IF NOT EXISTS` for the four most
  recent additive columns (`ai_model`, `webhook_url`, `handoff_redirect_url`,
  `last_polar_event_at`) on every boot

Both patterns worked but left schema management split between two systems with no
recorded version. The schema audit at `SCHEMA_AUDIT_2026-04-26.md` documents the
exact state of production at the moment Alembic adopted it.
