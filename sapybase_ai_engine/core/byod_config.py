"""BYOD live config propagation (RFC docs/rfc-byod.md Phase 5.2, §3.1 + §8.4).

A super-admin edits a BYOD/CUSTOM client's plan — limits, features, model, or
plan state — through the existing custom-plan endpoints (``PATCH
.../custom-plan/override`` and ``.../limits``). The entitlement **read** is
already live: every request resolves ``tier`` + ``custom_plan_config`` fresh from
the control-plane DB (there is no entitlement cache), so a changed limit/feature
is reflected on the very next request with **no redeploy** (§3.1).

What this module closes is the other half of §8.4: on a control-plane change the
**derived engine caches** must be invalidated so nothing computed under the old
plan outlives the edit — specifically the control-plane answer cache
(``exact_query_cache``), where a reply generated under the old model/entitlements
could otherwise be replayed after the change. A user can own many bots (the
``UNIQUE(user_id)`` constraint was dropped in ``v10_multi_bot``), so the edit must
reach **every** company the user owns, not just the first.

Cursor-taking (the caller owns the transaction and commits), so the whole module
is unit-testable against an ephemeral control-plane Postgres without the HTTP
layer. It touches only the control plane — never a tenant DB — so it is safe for
shared and BYOD tenants alike.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import List, Sequence


@dataclass(frozen=True)
class ConfigPropagation:
    """Summary of a live config-change propagation: the companies whose derived
    caches were cleared so the next request reflects the new plan."""

    company_ids: List[str]
    companies_invalidated: int


def resolve_company_ids(cur, clerk_id: str) -> List[str]:
    """Every ``company_id`` owned by the user behind ``clerk_id`` (multi-bot).

    A plan edit is keyed by the user (``clerk_id``) but caches are keyed by
    company, and one user may own several bots — so resolve ALL of them. Returns
    an empty list if the user owns no company. Control-plane read only."""
    cur.execute(
        """
        SELECT c.id::text
          FROM companies c
          JOIN users u ON c.user_id = u.id
         WHERE u.clerk_id = %s
         ORDER BY c.id
        """,
        (clerk_id,),
    )
    return [row[0] for row in cur.fetchall()]


def invalidate_company_caches(cur, company_ids: Sequence[str]) -> int:
    """Clear the control-plane answer cache (``exact_query_cache``) for each company
    on the caller's cursor; the caller commits. Returns the number of companies
    processed.

    A plan/feature/model change can make a previously cached answer stale; deleting
    the cached rows forces a clean miss that recomputes the answer under the new
    config (§8.4). No-op on an empty list. The entitlement values themselves are
    NOT cached (read fresh per request), so there is nothing else to invalidate on
    the control plane here."""
    ids = list(company_ids)
    for company_id in ids:
        cur.execute("DELETE FROM exact_query_cache WHERE company_id = %s", (company_id,))
    return len(ids)


def propagate_config_change(cur, clerk_id: str) -> ConfigPropagation:
    """Resolve the user's companies and invalidate each one's derived caches after
    an admin plan edit (§3.1, §8.4), so the change takes effect on the next request
    with no stale cached answer and no redeploy. Caller owns the transaction."""
    company_ids = resolve_company_ids(cur, clerk_id)
    n = invalidate_company_caches(cur, company_ids)
    return ConfigPropagation(company_ids=company_ids, companies_invalidated=n)
