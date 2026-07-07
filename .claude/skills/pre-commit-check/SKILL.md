---
name: pre-commit-check
description: Verify suite is green before committing - run lint, tsc, tests, migrations check
---

# Pre-Commit Check Skill

**Purpose:** Automate the verification checklist before every commit. Catches lint errors, type failures, test flakiness, and unsafe migrations before they hit git history.

**When to use:** User says "commit this" or "ready to commit" — run this skill first to verify everything passes.

**Time:** ~30-60 seconds for full suite.

---

## Procedure

### 1. Review Staged Files
```bash
git status
```
**What to look for:**
- Are all staged files intentional? (no accidental `.env`, credentials, API keys, PDFs)
- Any suspicious untracked files? (investigate before proceeding)
- Missing files that should be staged? (ask user before committing incomplete work)

**Block if:**
- `.env`, `.env.*.local`, `.secret`, `*.pem`, `*.key` found in staged area
- Pricing PDFs or private docs staged
- Large binaries (check file sizes)

**Action:** If issues found, report them and ask user to fix before re-running.

---

### 2. Run Frontend Lint
```bash
npm run lint
```
**Expected:** Zero errors, zero warnings (if warnings exist, report them but don't block).

**Block if:** Any lint error found.

**Common errors:**
- Unused variables (rename to `_var` or remove)
- Missing semicolons (auto-fixable)
- Incorrect import paths

**Action:** If failed, report specific errors + show `npm run lint -- --fix` option.

---

### 3. Run TypeScript Check
```bash
npx tsc --noEmit
```
**Expected:** `0 errors`.

**Block if:** Any TypeScript error found.

**Common errors:**
- Type mismatch (`Expected X, got Y`)
- Missing types on function parameters
- Undefined variables

**Action:** If failed, report specific errors + line numbers (user fixes, then re-run).

---

### 4. Run Frontend Tests
```bash
npm run test
```
**Expected:** All tests pass. Report: `X tests passed`.

**Block if:** Any test failure or timeout.

**Flakiness check:** If a test failed but was previously passing, ask: "Run again?" (sometimes race conditions occur; re-run to confirm).

**Action:** If failed, report failed test name + failure reason. Suggest: "Run `npm run test -- --reporter=verbose` for details."

---

### 5. Run Backend Tests
```bash
cd sapybase_ai_engine && venv/bin/python -m pytest tests/ -q
```
**Expected:** All tests pass. Report: `X passed`.

**Block if:** Any test failure.

**Common issues:**
- Test DB not seeded (check `tests/conftest.py`)
- Missing env vars (`TEST_DATABASE_URL`, etc.)
- Concurrent test interference (run with `-n1` flag to serialize)

**Action:** If failed, report failed test + failure reason. Suggest: "Run `pytest tests/test_name.py -v` for details."

---

### 6. Check Migrations for Safety
**If user touched `sapybase_ai_engine/migrations/`:**

```bash
ls -la sapybase_ai_engine/migrations/*.sql | tail -5
```
**What to verify:**
- Migration is **additive only** (e.g., `ADD COLUMN IF NOT EXISTS`, `CREATE TABLE IF NOT EXISTS`)
- **NO destructive changes** (DROP, DELETE, ALTER without IF EXISTS)
- **NO hardcoded data** (INSERT, UPDATE with concrete values instead of defaults)
- **NO passwords or secrets** in migration body

**Block if:**
- Destructive SQL found without `IF EXISTS` guard
- Hardcoded credentials detected
- Migration looks unsafe to re-run

**Question for user:** 
```
Migration 0024 found. Is it idempotent (safe to re-run)?
- ✓ Yes, it uses ADD COLUMN IF NOT EXISTS / CREATE IF NOT EXISTS
- ❌ No, it has destructive changes
```

**Action:** If unsafe, ask user to add guards (`IF EXISTS`, `IF NOT EXISTS`).

---

### 7. Review Uncommitted Changes
```bash
git diff --cached
```
**What to check:**
- Line counts reasonable? (not committing 1000s of lines at once)
- All changes related to one goal? (or is this a mixed feature + refactor + bugfix?)
- Any commented-out code? (should be removed)
- Any debug `console.log` or `print()` statements? (should be removed)

**Report:** File count + total additions/deletions.

**Block if:**
- User says "wait, that shouldn't be here" after reviewing diff

---

## Success Criteria

✅ All checks pass:
```
✓ git status reviewed (no secrets/binaries staged)
✓ npm run lint — 0 errors
✓ npx tsc --noEmit — 0 errors
✓ npm run test — X tests passed
✓ pytest — X tests passed
✓ Migrations checked (if touched)
✓ git diff reviewed

Ready to commit.
```

---

## Failure Scenarios

**Scenario 1: Lint Error**
```
npm run lint failed:
  src/components/Chat.tsx:42 — 'unused' is declared but never used

Fix: Remove the variable or rename to '_unused'.
Then: npm run lint (verify it passes)
Then: re-run pre-commit-check
```

**Scenario 2: Test Failure**
```
npm run test failed:
  ✓ 487 tests passed
  ✗ 1 test failed: chatWidget.test.ts — "sends message on enter"
  
Reason: Timeout after 5000ms

Fix: Check chatWidget.test.ts, debug the delay, fix.
Then: npm run test (re-run)
Then: re-run pre-commit-check
```

**Scenario 3: Migration Unsafe**
```
Migration 0024 detected:
  ALTER TABLE users DROP COLUMN legacy_field;
  
This is destructive without IF EXISTS guard.
Add a safety guard:
  ALTER TABLE users DROP COLUMN IF EXISTS legacy_field;
Then: re-run pre-commit-check
```

**Scenario 4: Secrets in Staged Area**
```
.env.local is staged.

Remove it:
  git restore --staged .env.local
Then: re-run pre-commit-check
```

---

## Notes

- **No cron/scheduled runs.** Only runs when you explicitly ask ("ready to commit?", "verify suite", etc.).
- **Non-blocking warnings:** If lint has warnings (not errors), report them but don't block — let user decide.
- **Flaky tests:** If a test passes on second run, note it ("test was flaky, passed on retry"). User can decide if worth investigating.
- **Empty suite:** If there are 0 tests (bad), warn: "No tests found. Suite should have >100 tests."
- **Migration-free commits:** If migrations weren't touched, skip migration check (no-op).

---

## Example Output

```
Pre-Commit Check — Sapybase / Vaayu
===================================

1. Git Status
   ✓ 5 files staged (no secrets detected)
   Staged: src/components/Chat.tsx, src/lib/auth.ts, sapybase_ai_engine/config.py, ...

2. Frontend Lint
   ✓ npm run lint — 0 errors

3. TypeScript
   ✓ npx tsc --noEmit — 0 errors

4. Frontend Tests
   ✓ npm run test — 512 tests passed (2m 14s)

5. Backend Tests
   ✓ pytest — 571 tests passed (1m 8s)

6. Migrations
   ✓ No migrations touched (skipped)

7. Git Diff Review
   ✓ 3 files changed, +47 -12 lines
   Diff looks good.

===================================
READY TO COMMIT ✓

Next step: git commit -m "..."
```
