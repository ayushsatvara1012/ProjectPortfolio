"""Phase 5.2 test gate: live config propagation (byod_config).

Exit criteria (RFC docs/rfc-byod.md §13 Phase 5.2, §3.1 / §8.4):
    "Change limit/feature → next request reflects it, no redeploy."

A super-admin edits a user's plan; the entitlement READ is already live (resolved
fresh per request, no cache), so the new value is reflected on the next request.
This module closes §8.4's other half — invalidating the DERIVED answer cache for
every company the user owns so no reply computed under the old plan is replayed,
and a user with several bots has ALL of them cleared (multi-bot, v10).

Layers:
  * Structural (no DB) — the propagation summary shape.
  * Functional (control-plane Postgres) — resolve all of a user's companies,
    invalidate only their answer cache (other users untouched), end-to-end
    propagation, and the gate: a changed config is read fresh AND its stale cached
    answer is gone on the next read. Skips cleanly when no Postgres is available.
"""
from __future__ import annotations

import json
import uuid

import psycopg2
import pytest

import byod_config
from byod_config import (
    ConfigPropagation,
    invalidate_company_caches,
    propagate_config_change,
    resolve_company_ids,
)


# ── Structural (no DB) ───────────────────────────────────────────────────────────
def test_invalidate_empty_is_noop():
    class _Cur:
        def execute(self, *a, **k):  # pragma: no cover - must never be called
            raise AssertionError("no DELETE should run for an empty company list")

    assert invalidate_company_caches(_Cur(), []) == 0


def test_propagation_dataclass_shape():
    prop = ConfigPropagation(company_ids=["a", "b"], companies_invalidated=2)
    assert prop.company_ids == ["a", "b"]
    assert prop.companies_invalidated == 2


# ── Control-plane fixtures ───────────────────────────────────────────────────────
@pytest.fixture
def config_db(control_plane_db_dsn):
    """A bare control-plane DB with the minimal users + companies + answer-cache
    stubs (the slice byod_config touches)."""
    conn = psycopg2.connect(control_plane_db_dsn)
    conn.autocommit = True
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS users (
                    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    clerk_id          TEXT UNIQUE,
                    tier              TEXT,
                    custom_plan_config JSONB
                )
                """
            )
            cur.execute(
                "CREATE TABLE IF NOT EXISTS companies (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID)"
            )
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS exact_query_cache (
                    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
                    query_hash VARCHAR(64) NOT NULL,
                    response   TEXT NOT NULL
                )
                """
            )
    finally:
        conn.close()
    return control_plane_db_dsn


def _make_user(dsn: str, clerk_id: str, *, tier="CUSTOM", config=None) -> str:
    conn = psycopg2.connect(dsn)
    conn.autocommit = True
    try:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO users (clerk_id, tier, custom_plan_config) VALUES (%s, %s, %s) RETURNING id",
                (clerk_id, tier, json.dumps(config) if config is not None else None),
            )
            return str(cur.fetchone()[0])
    finally:
        conn.close()


def _make_company(dsn: str, user_id: str) -> str:
    conn = psycopg2.connect(dsn)
    conn.autocommit = True
    try:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO companies (id, user_id) VALUES (gen_random_uuid(), %s) RETURNING id",
                (user_id,),
            )
            return str(cur.fetchone()[0])
    finally:
        conn.close()


def _cache_answer(dsn: str, company_id: str, query_hash="h1", response="cached-under-old-plan") -> None:
    conn = psycopg2.connect(dsn)
    conn.autocommit = True
    try:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO exact_query_cache (company_id, query_hash, response) VALUES (%s, %s, %s)",
                (company_id, query_hash, response),
            )
    finally:
        conn.close()


def _cache_count(dsn: str, company_id: str) -> int:
    conn = psycopg2.connect(dsn)
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) FROM exact_query_cache WHERE company_id = %s", (company_id,))
            return cur.fetchone()[0]
    finally:
        conn.close()


# ── resolve_company_ids ──────────────────────────────────────────────────────────
def test_resolve_returns_all_companies_for_a_multi_bot_user(config_db):
    """A user can own several bots (v10 dropped UNIQUE(user_id)) — a plan edit must
    reach ALL of them, not just the first."""
    user_id = _make_user(config_db, "clerk_multi")
    c1 = _make_company(config_db, user_id)
    c2 = _make_company(config_db, user_id)
    c3 = _make_company(config_db, user_id)
    other_user = _make_user(config_db, "clerk_other")
    _make_company(config_db, other_user)  # must NOT be returned

    conn = psycopg2.connect(config_db)
    try:
        cur = conn.cursor()
        ids = resolve_company_ids(cur, "clerk_multi")
    finally:
        conn.close()
    assert set(ids) == {c1, c2, c3}


def test_resolve_user_with_no_company_is_empty(config_db):
    _make_user(config_db, "clerk_lonely")
    conn = psycopg2.connect(config_db)
    try:
        ids = resolve_company_ids(conn.cursor(), "clerk_lonely")
    finally:
        conn.close()
    assert ids == []


# ── invalidate_company_caches ────────────────────────────────────────────────────
def test_invalidate_clears_only_targeted_companies(config_db):
    user_id = _make_user(config_db, "clerk_a")
    c1 = _make_company(config_db, user_id)
    c2 = _make_company(config_db, user_id)
    other_user = _make_user(config_db, "clerk_b")
    c_other = _make_company(config_db, other_user)
    for c in (c1, c2, c_other):
        _cache_answer(config_db, c)

    conn = psycopg2.connect(config_db)
    try:
        cur = conn.cursor()
        n = invalidate_company_caches(cur, [c1, c2])
        conn.commit()
    finally:
        conn.close()

    assert n == 2
    assert _cache_count(config_db, c1) == 0
    assert _cache_count(config_db, c2) == 0
    assert _cache_count(config_db, c_other) == 1  # another user's cache untouched


# ── propagate_config_change (end-to-end) + THE GATE ──────────────────────────────
def test_propagate_invalidates_every_company_of_the_user(config_db):
    user_id = _make_user(config_db, "clerk_prop")
    c1 = _make_company(config_db, user_id)
    c2 = _make_company(config_db, user_id)
    _cache_answer(config_db, c1)
    _cache_answer(config_db, c2)

    conn = psycopg2.connect(config_db)
    try:
        cur = conn.cursor()
        prop = propagate_config_change(cur, "clerk_prop")
        conn.commit()
    finally:
        conn.close()

    assert prop.companies_invalidated == 2
    assert set(prop.company_ids) == {c1, c2}
    assert _cache_count(config_db, c1) == 0
    assert _cache_count(config_db, c2) == 0


def test_change_feature_next_read_reflects_it_and_stale_answer_gone(config_db):
    """THE GATE: change a feature → the next request reads the new config live
    (no entitlement cache) AND the stale cached answer from the old plan is gone."""
    user_id = _make_user(
        config_db, "clerk_gate", config={"analytics": False, "gemini_model": "gemini-2.5-flash"}
    )
    company_id = _make_company(config_db, user_id)
    _cache_answer(config_db, company_id, response="answer-under-flash")
    assert _cache_count(config_db, company_id) == 1

    # Admin edits the plan: enable analytics + upgrade the model.
    admin_conn = psycopg2.connect(config_db)
    admin_conn.autocommit = True
    try:
        with admin_conn.cursor() as cur:
            cur.execute(
                "UPDATE users SET custom_plan_config = %s WHERE clerk_id = %s",
                (json.dumps({"analytics": True, "gemini_model": "gemini-2.5-pro"}), "clerk_gate"),
            )
        # Phase 5.2 propagation runs after the config write.
        with admin_conn.cursor() as cur:
            propagate_config_change(cur, "clerk_gate")
    finally:
        admin_conn.close()

    # Next request: config resolved fresh (no redeploy) → reflects the new values.
    read_conn = psycopg2.connect(config_db)
    try:
        with read_conn.cursor() as cur:
            cur.execute("SELECT custom_plan_config FROM users WHERE clerk_id = %s", ("clerk_gate",))
            cfg = cur.fetchone()[0]
    finally:
        read_conn.close()
    assert cfg["analytics"] is True
    assert cfg["gemini_model"] == "gemini-2.5-pro"
    # And the answer cached under the old plan is gone → next answer is recomputed.
    assert _cache_count(config_db, company_id) == 0


def test_propagate_user_with_no_company_is_clean_noop(config_db):
    _make_user(config_db, "clerk_empty")
    conn = psycopg2.connect(config_db)
    try:
        prop = propagate_config_change(conn.cursor(), "clerk_empty")
        conn.commit()
    finally:
        conn.close()
    assert prop.company_ids == []
    assert prop.companies_invalidated == 0
