"""The owner request lists must compare compatible column types across tables.

`agent_sessions` and `agent_messages` store `company_id` and `session_id` as TEXT
(migration 0026); `agent_requests`, `quote_requests` and `chat_logs` store them as
UUID. Postgres refuses to compare text to uuid - it raises `42883: operator does not
exist` - so a JOIN predicate that forgets the cast is a 500 on every request, not a
wrong answer on some of them.

This is the bug that took the owner's Requests inbox and Pipeline KPIs down from
2026-07-05 (commit c0bd1d6a, which added the qualification LEFT JOIN) until it was
found on 2026-08-30. Every existing test passed throughout: they drive the endpoints
through a fake cursor whose `execute` stores the string and parses nothing, so no
amount of coverage on the response shape could have caught it.

So this test does the one thing those cannot - it reads the SQL the endpoint ACTUALLY
executes and checks each cross-table predicate against the real column types. It is
deliberately not a schema snapshot: `COLUMN_TYPES` is the contract, and a migration
that changes a column's type has to change it here too.
"""
import re

from fastapi.testclient import TestClient

import main as m


#: The real types, from the migrations. agent_sessions/agent_messages are the odd
#: ones out (0026 created them TEXT); everything else in this family is UUID.
COLUMN_TYPES = {
    ("agent_sessions", "company_id"): "text",
    ("agent_sessions", "session_id"): "text",
    ("agent_messages", "company_id"): "text",
    ("agent_messages", "session_id"): "text",
    ("agent_requests", "company_id"): "uuid",
    ("agent_requests", "session_id"): "text",
    ("quote_requests", "company_id"): "uuid",
    ("quote_requests", "session_id"): "text",
    ("chat_logs", "company_id"): "uuid",
    ("chat_logs", "session_id"): "uuid",
    ("companies", "id"): "uuid",
}

_ALIAS_RE = re.compile(r"\b(?:FROM|JOIN)\s+(\w+)\s+(?!ON\b|WHERE\b|SET\b)(\w+)", re.IGNORECASE)
_PREDICATE_RE = re.compile(r"\b(\w+)\.(\w+)(::\w+)?\s*=\s*(\w+)\.(\w+)(::\w+)?")


def _aliases(sql):
    return {alias: table for table, alias in _ALIAS_RE.findall(sql)}


def _side_type(alias_map, alias, column, cast):
    """The type this side of a predicate presents to Postgres, or None if unknown."""
    if cast:
        return cast.lstrip(":").lower()
    table = alias_map.get(alias)
    if table is None:
        return None
    return COLUMN_TYPES.get((table, column))


def assert_predicates_typecheck(sql):
    """Every column = column predicate whose both sides we know must agree on type."""
    alias_map = _aliases(sql)
    checked = 0
    for lhs_a, lhs_c, lhs_cast, rhs_a, rhs_c, rhs_cast in _PREDICATE_RE.findall(sql):
        left = _side_type(alias_map, lhs_a, lhs_c, lhs_cast)
        right = _side_type(alias_map, rhs_a, rhs_c, rhs_cast)
        if left is None or right is None:
            continue
        checked += 1
        assert left == right, (
            f"{lhs_a}.{lhs_c} ({left}) = {rhs_a}.{rhs_c} ({right}) will raise "
            f"42883 in Postgres. Add an explicit ::text or ::uuid cast.\n\n{sql}"
        )
    return checked


class _RecordingCursor:
    """Answers the ownership check, records every statement for inspection."""

    def __init__(self):
        self.statements = []
        self._sql = ""

    def execute(self, sql, params=None):
        self._sql = sql
        self.statements.append(sql)

    def fetchone(self):
        return ("comp-1",) if "FROM companies" in self._sql else None

    def fetchall(self):
        return []

    def close(self):
        pass


class _RecordingConn:
    def __init__(self, cursor):
        self._cursor = cursor

    def cursor(self):
        return self._cursor

    def commit(self):
        pass

    def rollback(self):
        pass


def _capture(monkeypatch, path):
    cursor = _RecordingCursor()
    monkeypatch.setattr(m, "get_db_connection", lambda: _RecordingConn(cursor))
    monkeypatch.setattr(m, "release_db_connection", lambda c: None)
    m.app.dependency_overrides[m.get_current_user] = lambda: {"id": "user-1"}
    try:
        resp = TestClient(m.app).get(path)
    finally:
        m.app.dependency_overrides.clear()
    assert resp.status_code == 200, resp.text
    return cursor.statements


def _listing_sql(statements, table):
    matches = [s for s in statements if f"FROM {table}" in s]
    assert matches, f"no statement selected FROM {table}"
    return matches[-1]


def test_agent_requests_join_types(monkeypatch):
    sql = _listing_sql(
        _capture(monkeypatch, "/api/companies/comp-1/agent-requests"), "agent_requests")
    assert "agent_sessions" in sql, "the qualification join disappeared - retarget this test"
    assert assert_predicates_typecheck(sql) >= 2


def test_quote_requests_join_types(monkeypatch):
    sql = _listing_sql(
        _capture(monkeypatch, "/api/companies/comp-1/quote-requests"), "quote_requests")
    assert "agent_sessions" in sql, "the qualification join disappeared - retarget this test"
    assert assert_predicates_typecheck(sql) >= 2


def test_checker_catches_the_original_regression():
    """The exact predicate that shipped, to prove the checker is not vacuous."""
    broken = (
        "SELECT a.id FROM agent_requests a "
        "LEFT JOIN agent_sessions s "
        "ON s.session_id = a.session_id AND s.company_id = a.company_id "
        "WHERE a.company_id = %s"
    )
    try:
        assert_predicates_typecheck(broken)
    except AssertionError as exc:
        assert "42883" in str(exc)
    else:
        raise AssertionError("checker missed the uncast text = uuid predicate")


def test_checker_accepts_the_fix():
    fixed = (
        "SELECT a.id FROM agent_requests a "
        "LEFT JOIN agent_sessions s "
        "ON s.session_id = a.session_id AND s.company_id = a.company_id::text "
        "WHERE a.company_id = %s"
    )
    assert assert_predicates_typecheck(fixed) == 2
