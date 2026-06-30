"""Persistent session memory store for the vertical AI agent (Phase 1b).

Manages the agent_sessions and agent_messages tables (migration 0026).
Called from the chat endpoint on every vertical-agent turn:
  - upsert_session    : create / touch the session row
  - load_hybrid_context : last 8 turns verbatim + rolling summary for older turns
  - append_message    : persist one user/assistant turn
  - set_session_title : set the auto-generated title once (never overwrite)
  - derive_title      : pick a title from the first captured product action
  - count_messages    : row count for summarisation threshold check
  - maybe_summarize_session : background task — generate + store a summary via flash-lite

Import pattern (avoids circular import from main.py):
  from services import session_store
"""

from __future__ import annotations

import json
import logging
import os
from typing import Any, Callable, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)

# Messages served verbatim to the model.  Older turns use the summary.
VERBATIM_LIMIT = 8
# Minimum total messages before we bother generating a summary.
SUMMARY_THRESHOLD = VERBATIM_LIMIT


# ── Session lifecycle ─────────────────────────────────────────────────────────

def upsert_session(
    cursor,
    session_id: str,
    company_id: str,
    visitor_id: Optional[str] = None,
) -> None:
    """Create the session row on first turn, or touch last_active_at on resume.

    `visitor_id` is the device-local identity (browser localStorage UUID) used to
    scope the history list to one visitor (Phase 1d). It is stamped once on insert
    and never overwritten on resume (COALESCE keeps the original), so a legacy
    row that predates visitor_id stays NULL rather than being mis-attributed.

    The WHERE clause on DO UPDATE is a defence-in-depth guard: if a session_id
    somehow collides across tenants (extremely unlikely with UUIDs), the update
    is a no-op instead of touching another tenant's row.
    """
    cursor.execute(
        """
        INSERT INTO agent_sessions (session_id, company_id, visitor_id, created_at, last_active_at)
        VALUES (%s, %s, %s, NOW(), NOW())
        ON CONFLICT (session_id) DO UPDATE
            SET last_active_at = NOW(),
                visitor_id = COALESCE(agent_sessions.visitor_id, EXCLUDED.visitor_id)
            WHERE agent_sessions.company_id = EXCLUDED.company_id
        """,
        (session_id, company_id, visitor_id),
    )


def set_session_title(cursor, session_id: str, title: str) -> None:
    """Set the auto-title once; never overwrite an existing one."""
    cursor.execute(
        """
        UPDATE agent_sessions
           SET title = %s
         WHERE session_id = %s
           AND company_id IS NOT NULL   -- safety: only rows we own
           AND title IS NULL
        """,
        (title, session_id),
    )


# ── Message persistence ───────────────────────────────────────────────────────

def append_message(
    cursor,
    session_id: str,
    company_id: str,
    role: str,
    content: Optional[str],
    *,
    tool_calls: Optional[List[Dict]] = None,
    observations: Optional[List[Dict]] = None,
    actions: Optional[Dict[str, Any]] = None,
) -> None:
    """Append one turn to agent_messages, tenant-scoped."""
    cursor.execute(
        """
        INSERT INTO agent_messages
            (session_id, company_id, role, content,
             tool_calls, observations, actions, ts)
        VALUES (%s, %s, %s, %s,
                %s::jsonb, %s::jsonb, %s::jsonb, NOW())
        """,
        (
            session_id,
            company_id,
            role,
            content,
            json.dumps(tool_calls) if tool_calls is not None else None,
            json.dumps(observations) if observations is not None else None,
            json.dumps(actions) if actions is not None else None,
        ),
    )


# ── Context loading ───────────────────────────────────────────────────────────

def load_hybrid_context(
    cursor,
    session_id: str,
    company_id: str,
    verbatim_limit: int = VERBATIM_LIMIT,
) -> Tuple[Optional[str], List[Dict[str, Any]]]:
    """Load the hybrid context for a session resume.

    Returns:
        summary  — rolling compressed context (None if not yet generated)
        messages — last `verbatim_limit` rows in chronological order, each a
                   dict with keys: role, content
    """
    cursor.execute(
        "SELECT summary FROM agent_sessions WHERE session_id = %s AND company_id = %s",
        (session_id, company_id),
    )
    row = cursor.fetchone()
    summary = row[0] if row else None

    cursor.execute(
        """
        SELECT role, content
          FROM (
              SELECT role, content, ts
                FROM agent_messages
               WHERE session_id = %s AND company_id = %s
               ORDER BY ts DESC
               LIMIT %s
          ) sub
         ORDER BY ts ASC
        """,
        (session_id, company_id, verbatim_limit),
    )
    messages = [
        {"role": r[0], "content": r[1] or ""}
        for r in cursor.fetchall()
    ]
    return summary, messages


def count_messages(cursor, session_id: str, company_id: str) -> int:
    """Return total message count for this session."""
    cursor.execute(
        "SELECT COUNT(*) FROM agent_messages WHERE session_id = %s AND company_id = %s",
        (session_id, company_id),
    )
    row = cursor.fetchone()
    return int(row[0]) if row else 0


# ── Funnel state + lead profile (Phase 2) ─────────────────────────────────────

def load_session_meta(
    cursor, session_id: str, company_id: str
) -> Tuple[Dict[str, Any], Dict[str, Any]]:
    """Return (state, lead_profile) JSON for a session; empty dicts if unset.

    Tenant-scoped. Used to seed the next turn's stage machine and next-best-action.
    """
    cursor.execute(
        "SELECT state, lead_profile FROM agent_sessions "
        "WHERE session_id = %s AND company_id = %s",
        (session_id, company_id),
    )
    row = cursor.fetchone()
    if not row:
        return {}, {}
    state = row[0] if isinstance(row[0], dict) else (json.loads(row[0]) if row[0] else {})
    profile = row[1] if isinstance(row[1], dict) else (json.loads(row[1]) if row[1] else {})
    return state or {}, profile or {}


def update_session_state(cursor, session_id: str, company_id: str, state: Dict[str, Any]) -> None:
    """Persist the derived funnel state (Phase 2). Tenant-scoped."""
    cursor.execute(
        """
        UPDATE agent_sessions
           SET state = %s::jsonb
         WHERE session_id = %s AND company_id = %s
        """,
        (json.dumps(state), session_id, company_id),
    )


def update_lead_profile(cursor, session_id: str, company_id: str, profile: Dict[str, Any]) -> None:
    """Persist the rolling lead profile (Phase 2). Tenant-scoped."""
    cursor.execute(
        """
        UPDATE agent_sessions
           SET lead_profile = %s::jsonb
         WHERE session_id = %s AND company_id = %s
        """,
        (json.dumps(profile), session_id, company_id),
    )


# ── Auto-title derivation ─────────────────────────────────────────────────────

def derive_title(captured: Dict[str, Any]) -> Optional[str]:
    """Derive a short session title from the first captured product action.

    Examples: 'Ethanol quote', 'Toluene SDS', 'IPA sample'.
    Returns None if no product action was captured this turn.
    """
    if captured.get("quote"):
        q = captured["quote"]
        product = (q.get("product") or "").strip()
        if product:
            return f"{product} quote"
    if captured.get("sds"):
        product = (captured["sds"].get("product") or "").strip()
        if product:
            return f"{product} SDS"
    if captured.get("spec"):
        product = (captured["spec"].get("product") or "").strip()
        if product:
            return f"{product} enquiry"
    if captured.get("form"):
        prefill = captured["form"].get("prefill") or {}
        product = (prefill.get("product") or "").strip()
        if product:
            return f"{product} sample"
    return None


# ── Background summarisation ──────────────────────────────────────────────────

async def maybe_summarize_session(
    session_id: str,
    company_id: str,
    get_conn: Callable,
    release_conn: Callable,
) -> None:
    """Generate and store a rolling summary when the session grows beyond the
    verbatim window.  Called as a background task after each agent turn.

    No-ops if a summary already exists or message count <= SUMMARY_THRESHOLD.
    Uses a fresh DB connection (the chat-endpoint conn is already released).
    Uses gemini-2.5-flash-lite — the cheapest model in the stack, already used
    for background text-compression tasks (OCR, digest, eval) throughout main.py.
    """
    conn = get_conn()
    try:
        cursor = conn.cursor()

        # Skip if already summarised.
        cursor.execute(
            "SELECT summary FROM agent_sessions WHERE session_id = %s AND company_id = %s",
            (session_id, company_id),
        )
        row = cursor.fetchone()
        if row and row[0]:
            return

        total = count_messages(cursor, session_id, company_id)
        if total <= SUMMARY_THRESHOLD:
            return

        # Load all messages for the transcript.
        cursor.execute(
            """
            SELECT role, content
              FROM agent_messages
             WHERE session_id = %s AND company_id = %s
             ORDER BY ts ASC
            """,
            (session_id, company_id),
        )
        rows = cursor.fetchall()
        if not rows:
            return

        transcript_lines = []
        for role, content in rows:
            if content:
                label = "Customer" if role == "user" else "Agent"
                transcript_lines.append(f"{label}: {content}")
        transcript = "\n".join(transcript_lines)

        # Cheap flash-lite call — text compression, no reasoning needed.
        gemini_key = os.getenv("GEMINI_API_KEY")
        if not gemini_key:
            logger.warning("session_store.maybe_summarize: GEMINI_API_KEY not set; skipping")
            return

        try:
            from langchain_google_genai import ChatGoogleGenerativeAI
            from langchain_core.messages import HumanMessage as _HM
            _model = ChatGoogleGenerativeAI(
                model="gemini-2.5-flash-lite",
                google_api_key=gemini_key,
                temperature=0,
            )
            response = await _model.ainvoke([_HM(content=(
                "Summarise this chemical sales conversation in 3 sentences: "
                "what product was discussed, where the conversation got to, "
                "and what the visitor still needs.\n\n"
                f"<transcript>\n{transcript}\n</transcript>"
            ))])
            summary_text = (
                response.content
                if isinstance(response.content, str)
                else str(response.content)
            )
        except Exception:
            logger.exception(
                "session_store.maybe_summarize: LLM call failed for session=%s", session_id
            )
            return

        cursor.execute(
            "UPDATE agent_sessions SET summary = %s WHERE session_id = %s AND company_id = %s",
            (summary_text, session_id, company_id),
        )
        conn.commit()
        logger.info(
            "session_store: generated summary for session=%s (%d messages)", session_id, total
        )

    except Exception:
        logger.exception(
            "session_store.maybe_summarize_session: unexpected error for session=%s", session_id
        )
        try:
            conn.rollback()
        except Exception:
            pass
    finally:
        release_conn(conn)
