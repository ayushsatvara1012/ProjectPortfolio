#!/usr/bin/env python3
"""Lightweight standalone cron runner — runs scheduled jobs WITHOUT booting
the full FastAPI app (~480KB / 10K-line main.py + LangChain + Gemini SDK).

Usage (Render Cron Job command):
    python sapybase_ai_engine/scripts/run_cron.py weekly-digest
    python sapybase_ai_engine/scripts/run_cron.py data-plane-migrations
    python sapybase_ai_engine/scripts/run_cron.py switchin-purge

Each job uses only the imports it needs — psycopg2 + email_provider for the
digest, BYOD modules for migrations/purge. Memory stays under 100MB vs the
400MB+ the full app requires.

Env vars: DATABASE_URL (required), RESEND_API_KEY / SMTP_USER+SMTP_PASS
(for digest emails), BYOD_KMS_KEY (for migrations), CRON_SECRET (unused here
— auth is handled by Render's internal-only invocation).
"""
from __future__ import annotations

import os
import sys
import logging
from datetime import datetime, timedelta, timezone

# Ensure the engine root is on sys.path so sibling module imports work
# regardless of the working directory Render uses.
ENGINE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ENGINE_DIR not in sys.path:
    sys.path.insert(0, ENGINE_DIR)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [CRON] %(levelname)s %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("cron")

DB_URL = os.getenv("DATABASE_URL")


def _connect():
    """Single lightweight psycopg2 connection (no pool, no pgvector)."""
    import psycopg2
    if not DB_URL:
        logger.error("DATABASE_URL not set")
        sys.exit(1)
    return psycopg2.connect(DB_URL)


# ── Weekly Digest ────────────────────────────────────────────────────────────

def run_weekly_digest():
    from weekly_digest import iso_week_key, resolve_digest_recipient, summarize_leads, should_send_digest, build_digest_email
    from email_provider import send_transactional_email

    now = datetime.now(timezone.utc)
    week_key = iso_week_key(now)
    period_label = (
        f"Week of {(now - timedelta(days=7)).strftime('%b %d')} – "
        f"{now.strftime('%b %d, %Y')}"
    )
    processed = sent = skipped = failed = 0

    conn = _connect()
    try:
        cur = conn.cursor()
        cur.execute("""
            SELECT c.id, c.bot_name, u.email, c.alert_email,
                   c.weekly_digest_enabled, c.last_weekly_digest_week
            FROM companies c JOIN users u ON c.user_id = u.id
            WHERE c.is_active = true
        """)
        companies = cur.fetchall()
        cur.close()

        for row in companies:
            processed += 1
            company = {
                "id": row[0], "bot_name": row[1], "owner_email": row[2],
                "alert_email": row[3], "weekly_digest_enabled": row[4],
            }
            if row[5] == week_key:
                skipped += 1
                continue
            recipient = resolve_digest_recipient(company)
            if not recipient:
                skipped += 1
                continue

            try:
                cur = conn.cursor()
                cur.execute("""
                    SELECT email, name, context, score, score_band
                    FROM lead_capture
                    WHERE company_id = %s AND created_at > NOW() - INTERVAL '7 days'
                """, (company["id"],))
                leads = [
                    {"email": r[0], "name": r[1], "context": r[2], "score": r[3], "band": r[4]}
                    for r in cur.fetchall()
                ]
                cur.close()
            except Exception as e:
                logger.error(f"Lead query failed for {company['id']}: {e}")
                skipped += 1
                continue

            stats = summarize_leads(leads)
            if not should_send_digest(stats):
                skipped += 1
                continue

            subject, html = build_digest_email(
                company["bot_name"] or "Your bot", stats, period_label
            )
            if send_transactional_email(recipient, subject, html):
                try:
                    cur = conn.cursor()
                    cur.execute(
                        "UPDATE companies SET last_weekly_digest_week = %s WHERE id = %s",
                        (week_key, company["id"]),
                    )
                    conn.commit()
                    cur.close()
                    sent += 1
                except Exception as e:
                    conn.rollback()
                    logger.error(f"Failed to mark week for {company['id']}: {e}")
                    failed += 1
            else:
                skipped += 1

        result = {
            "status": "ok", "week": week_key,
            "processed": processed, "sent": sent,
            "skipped": skipped, "failed": failed,
        }
        logger.info(f"Weekly digest done: {result}")
        return result
    except Exception as e:
        conn.rollback()
        logger.error(f"Weekly digest run failed: {e}")
        sys.exit(1)
    finally:
        conn.close()


# ── Data-Plane Migrations ───────────────────────────────────────────────────

def run_data_plane_migrations():
    from db import byod_store
    from services import byod_engine
    import byod_orchestrator
    import byod_jobs
    from core.byod_crypto import kms_from_env

    def _list_tenants():
        c = _connect()
        try:
            cur = c.cursor()
            try:
                return byod_store.list_live_tenants(cur)
            finally:
                cur.close()
        finally:
            c.close()

    def _resolve_migrate_dsn(company_id):
        from core import byod_crypto
        kms = kms_from_env()
        c = _connect()
        try:
            cur = c.cursor()
            try:
                return byod_crypto.load_decrypted_dsn(cur, company_id, kms)
            finally:
                cur.close()
        finally:
            c.close()

    def _record_version(company_id, version):
        c = _connect()
        try:
            cur = c.cursor()
            try:
                byod_store.update_tenant_db_schema_version(cur, company_id, version)
                c.commit()
            finally:
                cur.close()
        finally:
            c.close()

    try:
        report = byod_orchestrator.run_migration_rollout(
            list_tenants=_list_tenants,
            resolve_migrate_dsn=_resolve_migrate_dsn,
            record_version=_record_version,
            skip=byod_engine.tenant_breaker_open,
            sanitize=byod_engine.sanitize_db_error,
        )
    except byod_orchestrator.OrchestratorError as e:
        logger.error(f"Data-plane migration rollout failed: {e}")
        sys.exit(1)

    result = {
        "status": "ok", "target": report.target, "total": report.total,
        "migrated": report.migrated, "current": report.current,
        "contended": report.contended, "skipped": report.skipped,
        "failed": report.failed,
    }
    logger.info(f"Data-plane migrations done: {result}")
    return result


# ── Switchin Purge ──────────────────────────────────────────────────────────

def run_switchin_purge():
    import byod_switchin

    conn = _connect()
    purged = 0
    try:
        cur = conn.cursor()
        try:
            company_ids = byod_switchin.list_purgeable(cur)
        finally:
            cur.close()
        for company_id in company_ids:
            if byod_switchin.purge_shared_copy(conn, conn, company_id):
                purged += 1
        result = {"status": "ok", "candidates": len(company_ids), "purged": purged}
        logger.info(f"Switchin purge done: {result}")
        return result
    finally:
        conn.close()


# ── Session Retention ──────────────────────────────────────────────────────

def run_session_retention():
    """Phase 4 PII retention purge:
      - Hard-delete agent_messages older than 1 year.
      - Hard-delete agent_sessions older than 1 year that have no messages left.

    agent_messages cascades from agent_sessions ON DELETE CASCADE, so purging
    messages first is the correct order: orphaned sessions (no remaining messages)
    are then removed in the second pass. Idempotent; safe to re-run any time.
    """
    conn = _connect()
    try:
        cur = conn.cursor()
        cur.execute("DELETE FROM agent_messages WHERE ts < NOW() - INTERVAL '1 year'")
        messages_deleted = cur.rowcount
        cur.execute(
            """
            DELETE FROM agent_sessions
             WHERE last_active_at < NOW() - INTERVAL '1 year'
               AND NOT EXISTS (
                   SELECT 1 FROM agent_messages m
                    WHERE m.session_id = agent_sessions.session_id
               )
            """
        )
        sessions_deleted = cur.rowcount
        conn.commit()
        result = {
            "status": "ok",
            "messages_deleted": messages_deleted,
            "sessions_deleted": sessions_deleted,
        }
        logger.info(f"Session retention done: {result}")
        return result
    except Exception as e:
        conn.rollback()
        logger.error(f"Session retention failed: {e}")
        sys.exit(1)
    finally:
        conn.close()


# ── CLI dispatch ────────────────────────────────────────────────────────────

JOBS = {
    "weekly-digest": run_weekly_digest,
    "data-plane-migrations": run_data_plane_migrations,
    "switchin-purge": run_switchin_purge,
    "session-retention": run_session_retention,
}

if __name__ == "__main__":
    if len(sys.argv) < 2 or sys.argv[1] not in JOBS:
        print(f"Usage: {sys.argv[0]} <{'|'.join(JOBS.keys())}>")
        sys.exit(1)

    job_name = sys.argv[1]
    logger.info(f"Starting cron job: {job_name}")
    JOBS[job_name]()
    logger.info(f"Cron job {job_name} completed successfully")
