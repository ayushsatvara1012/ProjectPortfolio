# Lock bot `vertical` field to super-admin only

## Problem

`companies.vertical` drives structural, not cosmetic, behavior: which pack loads
(`packs/registry.py`), hub cards, gradient theming (`ChatWidget.tsx:2164`), RAG
prompts, tool availability. Today it is:

- Editable by any company user from the customise page
  (`src/app/(app)/dashboard/settings/customize/page.tsx:373-382`, a plain
  `<select>` bound to `botSettings.vertical`).
- Writable via `PATCH /api/company` (`sapybase_ai_engine/main.py:2470`), gated
  only by `require_premium_tier` - no role check.
- Unvalidated - any string is accepted; unknown values silently degrade to
  generic via `normalize_vertical` (`packs/schema.py:207-217`). No allowlist
  against the pack registry (`packs/registry.py:24-26`, currently only
  `"chemical"` is registered).
- Never set at creation time - `POST /api/register` (`main.py:7703`) doesn't
  accept or set `vertical` at all; every new company starts NULL/generic.

Net effect: any paying customer can self-assign `vertical=chemical` (or any
garbage string) with zero admin involvement and zero audit trail.

## Decisions (confirmed with user)

1. **Assignment flow**: no creation-time picker. Companies always start
   generic (NULL) at signup. A `SUPER_ADMIN` assigns a vertical any time later
   from the admin panel.
2. **Existing data**: leave any company's current `vertical` value untouched.
   Only new writes go through the lock-down.
3. **Validation**: reject unknown vertical strings with `400`. Valid set =
   values in `packs.registry` (currently just `"chemical"`) plus `null`/`""`
   for "revert to generic".
4. **Audit**: reuse the existing `admin_audit_log` table /
   `log_admin_action()` helper (`main.py:543-559`) - no new table.

## Scope of change

### 1. Backend: `PATCH /api/company` (`main.py:2470` area)

- Add a role check specific to `field == "vertical"`: if the caller's role is
  not `SUPER_ADMIN`, reject with `403` (do not silently drop the field -
  explicit rejection surfaces misuse attempts instead of masking them).
- Add allowlist validation: normalize the incoming value, then check it
  against `packs.registry` known verticals (need to confirm/add a
  `known_verticals()` helper if one doesn't already exist - the explore pass
  found `_REGISTRY` as a dict but no public listing function). Empty/null is
  always valid (means "generic"). Anything else not in the registry -> `400`
  with a clear message listing valid values.
- On successful change, call `log_admin_action(admin_id=..., action=
  "UPDATE_COMPANY_VERTICAL", target_id=company_id, changes={"old": ...,
  "new": ...})`, mirroring the existing call-site pattern (e.g. line 9071's
  `UPDATE_USER_PROFILE`).
- Keep the existing premium-tier gate for all *other* fields in this endpoint
  untouched - only `vertical` gets the extra role check, to avoid regressing
  unrelated customise-page functionality.

### 2. Frontend: customise page

- Remove the "Industry vertical" `<select>` from
  `customize/page.tsx:373-382` entirely (not just disable it - a disabled
  control implies the user should expect to enable it somehow, which isn't
  true here). Replace with a **read-only display** of the current vertical
  (plain text/badge, e.g. "Vertical: Chemical" or "Vertical: Generic"), so
  users still have visibility without an edit affordance.
- Remove `vertical` from `updateSetting`'s writable fields in
  `BotSettingsContext.tsx` if it's currently included in the PATCH payload
  builder, so a crafted client-side request can't even attempt the field
  (defense in depth - the real gate is the backend, but don't leave a UI path
  that only fails at submit time).

### 3. Frontend: super-admin panel

- Add a vertical editor to the existing admin panel
  (`src/app/(app)/dashboard/settings/admin/page.tsx`), scoped per-company (the
  panel already has company-level admin actions per the ByodTab/
  ExploreEnquiriesTab pattern - follow that existing layout convention).
- Dropdown sourced from the same registry allowlist the backend validates
  against (single source of truth - don't hardcode `["chemical"]` twice).
- Show current value + confirmation step before submit, since this is a
  structural change to a live bot (mirrors the "ask before risky action"
  philosophy - this isn't reversible-free, a vertical swap changes prompts/
  tools/RAG scope for the live bot immediately).

### 4. Tests

- Backend: non-admin attempting to PATCH `vertical` -> `403`. Admin PATCHing
  an unknown string -> `400`. Admin PATCHing a valid vertical -> `200` +
  `admin_audit_log` row written. Admin PATCHing `null`/`""` -> reverts to
  generic, succeeds.
- Frontend: customise page renders vertical as read-only text, no `<select>`
  present, `updateSetting('vertical', ...)` path removed/unreachable.
- Existing `tests/test_packs.py` (`hub_cards_for` tests) should stay green
  unchanged since pack behavior itself isn't touched.

## Edge cases / exceptions to handle

- **Race/self-service bypass via other endpoints**: confirm no *other*
  endpoint besides `PATCH /api/company` can write `vertical` (e.g. a bulk
  import, BYOD onboarding, or CSV catalog import path). Grep needed before
  implementation - not yet verified.
- **Migration between packs**: if a company moves from `chemical` back to
  generic, hub_cards-dependent UI (gradient, hub cards) must gracefully empty
  out - already true today since `hasHub` just checks `hub_cards.length`, no
  new work needed there.
- **Caching**: if `BotSettingsContext` or any client cache holds a stale
  `vertical` after an admin changes it out-of-band, the dashboard should
  refetch (check whether existing polling/revalidation already covers this,
  or if a manual refresh is the only way today - acceptable given this is an
  infrequent admin action, but worth noting as a known limitation rather than
  silently assuming it's fine).
- **SUPER_ADMIN role source of truth**: reuse the exact same role check
  pattern already used elsewhere (`role === 'SUPER_ADMIN'` via `/api/me`,
  as seen in `admin/layout.tsx:19-33`) - don't introduce a second role-check
  mechanism.
- **Empty-string vs null semantics**: confirm `normalize_vertical` treats both
  identically before relying on "either counts as generic" in validation logic.
- **Multi-tenant / test companies**: any seed/test data or fixtures that rely
  on directly setting `vertical` via the customise-page UI flow (rather than
  DB fixture) in existing Playwright/E2E tests would break once the `<select>`
  is removed - test suite audit needed as part of implementation, not just
  unit tests.

## Out of scope

- Building a creation-time vertical picker (explicitly decided against, per
  user).
- Auditing/cleaning up already-existing non-null `vertical` values (explicitly
  decided against, per user).
- Building new packs beyond `chemical` (unrelated to this lock-down).

## Status

**Implemented, uncommitted.**

- Backend: `PATCH /api/company` (`main.py`) now 403s a `vertical` write from a
  non-`SUPER_ADMIN`, 400s an unknown value against `known_verticals()`, and
  logs `UPDATE_COMPANY_VERTICAL` to `admin_audit_log` on success. No other
  endpoint writes `companies.vertical` (grepped and confirmed - only reads).
- New admin-only endpoints: `GET /api/admin/verticals` (allowlist for the
  dropdown) and `PATCH /api/admin/companies/{company_id}/vertical` (not
  scoped to the caller's own companies, unlike `PATCH /api/company`, since an
  admin edits any tenant's bot). Both gated by `get_admin_user` +
  `require_fresh_admin`.
- `companies` list in `GET /api/admin/users` now carries each bot's `vertical`.
- Frontend: customise page's vertical `<select>` replaced with a read-only
  badge; `BotSettingsContext.saveSettings` no longer sends `vertical` in the
  PATCH payload at all.
- Admin panel: `ManageSlideOver`'s "Deployed bots" section gained a
  `VerticalEditor` per bot - dropdown sourced from `/api/admin/verticals`,
  confirm-before-submit step, calls the new admin endpoint.
- Tests: `tests/test_vertical_lock.py` (4 new backend tests - 403/400/200 audit
  /revert-to-generic). Backend suite green (1390 passed), frontend suite green
  (357 passed), `tsc` 0 errors, lint 0 errors (pre-existing warnings only).

Not yet committed - awaiting explicit go-ahead to commit per user instruction.
