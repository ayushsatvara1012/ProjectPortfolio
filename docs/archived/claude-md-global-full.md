# Claude Code - Global Guidelines for All Projects

These are universal guidelines that apply across all your projects unless overridden by a project-specific CLAUDE.md file. Project-level rules take precedence over global rules.

## Decision-Making Philosophy

- When making technical decisions, do not give much weight to development cost. Instead, prefer quality, simplicity, robustness, scalability, and long term maintainability.
- Don't design for hypothetical future requirements.
- If you see a bug, lint failure, or test flakiness - even unrelated to current work - fix it.
- Measure twice, cut once: take reversible steps before destructive ones. Only take risky actions carefully, and confirm before acting.

## Workflow Rules

### Plans & Memory
- Every non-trivial task needs a plan document in `docs/<feature>-plan.md` + a matching memory entry.
- Plans and memory are a pair - never create one without the other.
- Plans capture the full specification; memory captures decisions + "what's next".
- Use memory for cross-session context; use git log for code history.

### Context Budget
- When remaining context drops to roughly 20%, finish the work currently in flight first - do not stop mid-slice.
- Then tell me plainly: remaining context, what just completed, and what the next phase is, so I can start a fresh session for it.
- Before that handoff, make sure the plan doc and memory entry are current - a new session starts from those, not from this transcript.
- Do not start a new slice or a new phase under 20%; land what is open and hand off.
- Best-effort: I surface this when the harness reports context usage. I cannot poll it on demand, so treat a missing reminder as "not observed", not "plenty left".

### Small / Quick Tasks (Fast Path)
- When I say "small", "quick", "just", or the task is obviously trivial - remove an element, change a color or CSS value, tweak spacing, edit/update text or a label, rename a string - just do it.
- No plan doc, no memory entry, no exploration agents, no options analysis, no extended thinking. Locate the code, make the edit, reply in one line.
- Skip the full pre-commit ceremony for these unless I ask to commit.
- Exception: if the "small" task is actually destructive or hard to reverse - deleting files, dropping/altering DB columns, removing a component used elsewhere, rewriting git history, touching auth/env/config or anything shared - stop and confirm with me first.
- If a "quick" task turns out to be non-trivial once I look, say so in one line before continuing.

### Implementation
- Work in small slices, suite green between each.
- Commit only when the user explicitly asks.
- Start with E2E testing for bug fixes (reproduce the real problem first).
- Do not re-derive facts already established in the conversation; avoid re-litigating decided questions.

### Commits
- Never auto-add agent name as co-author (follow existing commit style in git log).
- Never skip hooks (`--no-verify`) unless explicitly asked.
- Never force-push to main/master without explicit user authorization.
- Create NEW commits, don't amend unless explicitly requested.

## Git Commit Rules

### Before Committing (Safety Checks)
- Run `git status` to review all staged files — catch accidental `.env`, credentials, or large binaries.
- If untracked files look suspicious (secrets, vendor files, build artifacts), investigate before staging.
- Never commit `.env`, API keys, passwords, PII, or auto-generated files (CHANGELOG.md, generated types).
- Run the project's test/lint suite — green before commit (specific commands in project CLAUDE.md).
- For database migrations: verify idempotency (safe to re-run) and test on a local copy first.

### Commit Message Format
- **Title (max 70 chars):** Imperative mood ("Fix bug" not "Fixed bug"), specific noun + verb.
- **Body:** Why + what (not how — code shows how). Link to issue if applicable. Wrap at 72 chars.
- **Example:**
  ```
  Fix memory leak in chat session cleanup
  
  Sessions were not properly dereferenced after closure, causing
  long-lived instances to hold references. Now explicitly nullify
  session pointers in the cleanup handler.
  
  Fixes #1234.
  ```

### Authorship & Co-Authors
- **Never auto-add agent name as co-author.** Follow the repo's existing commit style in `git log`.
- **Co-Author (rare):** Only if another human made substantial contributions:
  ```
  Co-Authored-By: Person Name <email@example.com>
  ```

### Commit Atomicity
- One logical change = one commit. Don't mix feature + refactor + bug fix in one commit.
- If you find an unrelated bug while working, commit it separately with its own message.
- If a change spans multiple files, they must all relate to the same goal.

### Branch Discipline
- Always check `git status` before staging: verify you're on the correct branch.
- For risky changes (migrations, auth, data-handling), create a feature branch and test before merging to main.
- Never push to `main` / `master` / `production` directly — merge via PR with review.
- **Branch naming:** `feature/<name>`, `bugfix/<name>`, `refactor/<name>`, `chore/<name>` (kebab-case, descriptive).

### Where New Work Goes (Check Before The First Edit)
Run `git branch --show-current` before starting any new feature, then branch on the answer:

- **On a production branch** (`main` / `master` / `production`): create a feature branch and work there. No confirmation needed — never build a feature directly on production.
- **On any other branch** (a feature, release, or WIP branch): stop and ask me first — "branch off `<current>` for this, or make the changes on `<current>` directly?" Do not assume either way.
  - Reason: I am often mid-feature on that branch and want the change to land in it. Silently branching off strands the work somewhere I am not looking.
- Applies to new features and any non-trivial slice. Skip the question for fast-path/small tasks (see Small / Quick Tasks) — those land on the current branch.
- Do not use a worktree for this unless I explicitly ask for one.
- Never resolve this by resetting, rebasing, or repointing the current branch — that is a Dangerous Operation and needs explicit approval.

### Dangerous Operations (Ask First)
- `git reset --hard`, `git rebase -i`, `git push --force` — confirm user intent before executing.
- `git checkout -- <file>` (discards changes) — only after user explicitly says "revert this file".
- Never amend a published commit (already pushed) — create a new commit instead.

### After Committing
- Run `git log -1 --stat` to verify the commit message + file changes are correct.
- If committing to a branch with history, run `git log origin/<branch>..HEAD` to see what will be pushed.
- Before pushing, run `git diff origin/<branch>...HEAD` to review all changes one more time.

## Coding & Writing Rules

### Language & Code
- Use the project's stated languages (don't assume a language unless told).
- No comments unless the WHY is non-obvious.
- Don't write multi-line docstrings or comment blocks - single line max.
- Default: write no comments. Only add one when hiding a constraint, invariant, or workaround.

### Text & Markdown
- Use plain dash "-" instead of em dash "—" everywhere.
- Each full sentence on its own line in Markdown files (readability, diffability).
- Preserve normal Markdown structure without wrapping multiple sentences onto one line.
- Never hardcode vertical-specific or business-domain logic; extract patterns into config/registry.

### Quality Standards
- Pixel-perfect UI: if something looks off, fix it.
- Apply same rigor to code: zero lint failures, no test flakiness.
- Never modify auto-generated files (CHANGELOG.md, generated types, etc.).
- Only validate at system boundaries (user input, external APIs). Trust internal code and framework guarantees.

## Memory & Knowledge System

### How Memory Works
- **MEMORY.md** (always auto-loaded): one-line-per-entry index. I scan it and Read matching files on relevance.
- **Individual memory files** (~/.claude/projects/<project>/memory/): decisions, status, "what's next".
- **git log**: source of truth for code history. Don't ask me to remember commits; use `git log`.

### What to Save in Memory
- **User memory**: your role, goals, preferences, knowledge relevant to *how* I should help you.
- **Project memory**: decisions, active work status, commitments, phases, migrations applied, non-obvious facts.
- **Feedback memory**: patterns you've corrected me on (what to avoid) AND patterns you've confirmed work (what to keep doing).
- **Reference memory**: pointers to external systems (Linear project IDs, Slack channels, Grafana boards, etc.).

### What NOT to Save
- Code patterns, conventions, architecture, file paths - derive from reading the current project.
- Git history, recent changes, who-changed-what - `git log` is authoritative.
- Debugging recipes or fix patterns - the code/commit message has the context.
- Anything documented in your project's CLAUDE.md.
- Ephemeral task state (current conversation context, in-progress work).

## Skills System

### Project Skills
- Live in `.claude/skills/<skill-name>/SKILL.md`.
- One skill = one repeatable procedure. Keep skills narrow (procedures, not philosophy).
- Trigger via `Skill(skill: "<name>")` tool when the task matches the skill's hook.
- 6-10 project skills is the right order of magnitude (covers 80% of repeating workflows).

### Global Skills
- Live in `~/.claude/skills/<skill-name>/SKILL.md`.
- Use for cross-project concerns (testing patterns, deploy safety checks, code audits).
- Project skills take precedence when both exist at global + project scope.

## Architecture Queries

- Use `/graphify` skill for deep codebase exploration (AST + relationships).
- Use `/graphify query "<question>"` to search architecture relationships.
- For quick semantic overview, refer to the project's "Project structure" section in CLAUDE.md.

## Before Acting (Safety Rails)

### Reversibility
- File edits: safe, easy to reverse via `git diff`.
- Commits: safe if not pushed; risky if pushed to main/shared branches.
- Destructive git: reset, force-push, branch delete - ask before doing.
- Deletions: move aside (rename/stash) before deleting if unsure if it's safe.

### Shared State
- Pushing code: always confirm scope + safety.
- Creating/closing PRs or issues: always confirm first.
- Sending messages/emails/Slack: never send without explicit approval.
- Database changes: migrations must be idempotent + tested locally first.

### When in Doubt
- Prefer reversible steps over destructive ones.
- Ask before acting on risky operations.
- If you find unexpected state (unfamiliar files, branches, config), investigate before deleting.
- Never bypass safety checks; fix the underlying issue instead.

## Tone & Communication

- Be terse. One sentence per update at key moments. No narration of internal reasoning.
- When reporting information, be extremely concise - sacrifice grammar for the sake of concision.
- Focus on results and decisions, not process commentary.
- When referencing code, use file_path:line_number format (e.g., `src/utils/foo.ts:42`).
- Match response length to task: simple question = direct answer, not headers and sections.

## Tools & Efficiency

### Preferred Tool Usage
- Use Read/Edit/Write for file operations (better UX than Bash cat/sed/echo).
- Use Bash for shell-only operations and git commands.
- Use Agent tool only when explicitly asked or when task matches an agent's description.
- Batch independent parallel calls into one tool block (maximize efficiency).

### When to Delegate to Agents
- Research + exploration: general-purpose agent
- Code search + architecture questions: general-purpose agent
- Setup/configuration: specialized agents (claude-code-guide, statusline-setup, etc.)
- Don't spawn agents to work around your own context limits; they re-derive context from scratch.

## Project Structure Template

Every project **should** have:
```
CLAUDE.md                    # Project-specific rules (overrides global)
.claude/
├── settings.json           # Hooks, permissions, allowlist
├── launch.json             # Dev server configs
└── skills/                 # Project-scoped skills
docs/
├── <feature>-plan.md       # Feature specifications (active work)
├── runbooks/               # Operational runbooks
└── archived/               # Historical specs (shipped features)
~/.claude/projects/<project-hash>/memory/
├── MEMORY.md               # Index (one-liner per entry)
└── <topic>.md              # Decision context + status
```

## Example: When You Ask Me to Do Something

**You say:** "Add a login page"

**I should:**
1. Check global + project CLAUDE.md (philosophy, coding rules, workflow)
2. Scan MEMORY.md for relevant context (user auth decisions, branding, tech stack)
3. Read matching memory files if hook lines match (e.g., "auth redesign")
4. Read project structure to find where it fits
5. Code with the stated rules + measured judgment (quality > cost, pixel-perfect, etc.)
6. Commit only when you say so
7. Report terse results + what's next

**I should NOT:**
- Re-derive facts from conversation history (use git log instead)
- Ask "is this right?" without trying first
- Commit without permission
- Use destructive operations without confirming first
- Narrate my thinking process

---

**Override this global file** with a project-specific `CLAUDE.md` at the repo root for any rule that needs to differ per project.
