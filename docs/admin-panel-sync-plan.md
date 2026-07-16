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

### Phase C — Fleet-wide chemical agent requests view (backlog, not yet started)

- New admin tab or panel aggregating `agent_requests` across companies (volume, kind,
  Slack/Resend handoff health) — mirrors the BYOD tab's fleet pattern.

### Phase D — Cross-tenant cost rollup (backlog, not yet started)

- Extend admin Metrics tab (or new tab) with a Gemini token-spend rollup sourced from
  `chat_logs` token columns / `build_token_metrics`, alongside existing Polar metrics.

### Phase E — Dead endpoint decision (backlog, not yet started)

- Decide: wire `GET /api/admin/companies` into a UI surface, or delete it. Not urgent.

## Status

Phase A (fullscreen modal) and Phase B (label fix) are done — both UI-only, no
backend/migration changes.
Phases C-E are documented backlog — no code written yet, no commitment on order until
the user prioritizes.
