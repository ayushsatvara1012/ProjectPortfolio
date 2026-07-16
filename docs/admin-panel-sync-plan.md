# Super Admin Panel — Sync & UX Fix Plan

## Background

Audit (2026-07-16) of `src/app/(app)/dashboard/settings/admin/` against recent backend
work (BYOD, chemical agent handoff, cost metering) found the BYOD tab fully current,
but several gaps and one UX request from the user.

## Findings (source of truth for this plan)

1. **Label collision** — `page.tsx:78` (`byo_database` flag, "Bring Your Own Database")
   sits next to `page.tsx:630` (`max_chunks`, labeled "Storage (chunks)") inside the same
   Feature Access panel, both using a `database` icon. Admins can conflate RAG chunk quota
   with BYOD Postgres connection.
2. **No fleet-wide view for chemical agent requests** — `agent_requests` table +
   `/api/companies/{company_id}/agent-requests` only surfaced in the per-company owner
   dashboard (`RequestsInboxPanel.tsx`), not in super admin.
3. **Dead endpoint** — `GET /api/admin/companies` (`main.py:9367-9377`) has no frontend caller.
4. **No cross-tenant cost/token rollup** — Gemini token spend (P6 metering) lives only in
   per-company `SessionBiPanel`; admin Metrics tab only tracks Polar/subscription data.
5. **UX request (user, 2026-07-16)** — the per-user "Manage" panel (`ManageSlideOver`,
   `page.tsx:360-768`) is a right-anchored slide-over (`md:w-1/2`, slides in from the edge).
   User wants it replaced with a near-fullscreen centered modal — fills the viewport minus
   an outer padding gutter, blurred backdrop, fade/scale transition instead of slide.

## Phases

### Phase A — Manage panel → fullscreen modal (THIS SESSION, in progress)

- Rename `ManageSlideOver` → `ManageModal` (name should match what it now is).
- Outer wrapper: `fixed inset-0 flex items-center justify-center` with padding gutter
  (`p-3 sm:p-6 lg:p-8`) instead of `ml-auto` edge anchor.
- Backdrop: keep dark scrim, bump blur (`backdrop-blur-md`) for a more pronounced blurred background.
- Panel: `w-full h-full` (fills the padded area, no max-width cap — "almost full screen"),
  rounded on all four corners (`rounded-2xl`, not just the left edge).
- Transition: fade + slight scale (`opacity 0→1`, `scale 0.96→1`) replacing the `x: '100%' → 0` slide.
- No functional/prop changes — same `onClose`, `onSave`, `isSaving`, `verticals`,
  `onChangeVertical`, `isVerticalPending` contract, so the single call site
  (`page.tsx:1472`) only needs the component name updated.

### Phase B — Label fix (DONE 2026-07-16)

- Renamed "Storage (chunks)" → "Knowledge base chunks" (`page.tsx:630`) with an explicit hint
  ("RAG vector chunks — unrelated to the BYOD database toggle below") so it reads distinctly
  from the "Bring Your Own Database" feature flag in the Feature Access section below it.
  No other "Storage" labels found elsewhere in the admin panel (`grep` confirmed).

### Phase C — Fleet-wide chemical agent requests view (DONE 2026-07-16)

- Backend: `GET /api/admin/agent-requests` (`main.py`, right after `get_all_companies`) —
  same row shape as the per-company `list_agent_requests`, minus the `company_id` filter,
  joined with `companies` for `company_name`/`bot_name`. Guarded by `get_admin_user` +
  `require_fresh_admin` (step-up), matching the BYOD fleet list's caution level since a
  row carries visitor contact PII across every tenant at once, not just one owner's bot.
  Supports `kind`/`status` filters + `limit`/`offset` pagination (unlike BYOD's unpaginated
  list — request volume across the whole fleet can get large). Status changes reuse the
  existing per-company `PATCH /api/companies/{company_id}/agent-requests/{id}` — no new
  mutation route needed since the fleet row already carries `company_id`.
- Frontend: new `AgentRequestsTab.tsx`, wired into the admin panel as an "Agent requests"
  tab (`page.tsx`), mirroring `ByodTab.tsx`'s filter-pill + desktop-table/mobile-card
  pattern and `useFreshAdminFetch` (step-up token minting) for both the read and the
  status-change mutation.
- Tests: `tests/test_admin_agent_requests.py` (5 new backend tests — response shape +
  company join, fleet query has no `company_id` predicate, kind/status filter pass-through,
  limit clamping, 403 for non-admins). Slice green: frontend 407, backend 1484
  (up from 1479), tsc 0, lint 0 errors.
- Deliberately out of scope: Slack/Resend handoff delivery-status surfacing — no such
  column exists on `agent_requests` today (confirmed via migration 0023), so there's
  nothing to show yet; would need a new column + write path first.

### Phase D — Cross-tenant cost rollup (backlog, not yet started)

- Extend admin Metrics tab (or new tab) with a Gemini token-spend rollup sourced from
  `chat_logs` token columns / `build_token_metrics`, alongside existing Polar metrics.

### Phase E — Dead endpoint decision (backlog, not yet started)

- Decide: wire `GET /api/admin/companies` into a UI surface, or delete it. Not urgent.

## Status

Phase A (fullscreen modal), Phase B (label fix), and Phase C (fleet agent-requests view)
are done. A and B are UI-only; C adds one new read-only backend endpoint (no migration).
Phases D-E are documented backlog — no code written yet, no commitment on order until
the user prioritizes.
