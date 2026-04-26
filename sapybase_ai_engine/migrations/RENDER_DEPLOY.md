# Render Pre-Deploy Hook for Alembic

This is the one piece of Step 4 that lives in Render's dashboard rather
than in this repo. Set it up once; from then on every deploy auto-runs
pending migrations before the new code starts serving traffic.

## One-time setup

1. Open Render dashboard → your FastAPI service → **Settings** tab.
2. Scroll to the **Build & Deploy** section.
3. Find the **Pre-Deploy Command** field (separate from "Build Command"
   and "Start Command").
4. Set it to:

   ```
   alembic upgrade head
   ```

5. Save changes. Render applies the new pre-deploy command starting with
   the next deploy.

## What this does

Render's deploy lifecycle, after this change:

```
1. git push triggers a deploy
2. Build phase: pip install -r requirements.txt
3. Pre-deploy: `alembic upgrade head` runs against DATABASE_URL
   - If migrations succeed: deploy continues
   - If migrations fail:    deploy ABORTED, previous version keeps serving
4. Start phase: gunicorn launches main:app
```

The pre-deploy step runs in the same container with the same env vars as
the app, so `DATABASE_URL` is already available. Alembic's `env.py` reads
it directly from the environment.

## Verification

After saving the setting, trigger a manual redeploy from the dashboard.
Watch the deploy logs — you should see a "Pre-Deploy" section near the
top with output like:

```
INFO  [alembic.runtime.migration] Context impl PostgresqlImpl.
INFO  [alembic.runtime.migration] Will assume transactional DDL.
INFO  [alembic.runtime.migration] Running upgrade 0001 -> 0002, ...
```

(Or simply `INFO ... Will assume transactional DDL.` with no upgrade line
if there's nothing pending — that's the expected steady state.)

## Failure modes

**"alembic: command not found"**
The `alembic` package isn't installed in the deploy environment. Check
`requirements.txt` includes `alembic` (it does, as of Step 4.3) and the
build phase ran `pip install -r requirements.txt` successfully.

**"DATABASE_URL not set"**
The `env.py` failed loud because the env var is missing. Check Render's
Environment tab; `DATABASE_URL` should be set automatically when the
Postgres add-on is linked, but verify.

**"Can't locate revision identified by 'XXXX'"**
The DB is at a revision that doesn't exist in the deployed code. This
happens if you `alembic stamp` to a revision then later remove that
revision file. Fix by either re-creating the revision file or running
`alembic stamp <known-good-revision>` manually.

**Migration takes too long and Render times out**
Render's pre-deploy command has a timeout. For a long migration, the
correct fix is to refactor it into smaller chunks (see MIGRATIONS.md
rule 5 — backfill plans). A migration that locks a populated table for
minutes is the wrong design regardless of the pre-deploy timeout.

## Rollback procedure

If a deploy goes bad after migrations succeeded but app code is broken:

1. **Don't downgrade the migration** — the app code that depended on
   the new schema may have already written data using the new shape.
2. Revert the app code via Render's "Rollback" button on the previous
   deploy in the Events tab. The schema stays at the new revision; the
   old code reads/writes the new schema (extra columns are ignored).

If a deploy goes bad because the migration itself broke something:

1. Render aborted the deploy automatically (because pre-deploy failed).
2. Old version is still serving — no user impact.
3. Fix the migration in a new commit, push, redeploy.
