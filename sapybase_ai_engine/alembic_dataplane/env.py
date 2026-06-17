"""Alembic environment for the BYOD **data_plane** lineage (RFC A.7).

This mirrors the control-plane ``alembic_migrations/env.py`` but targets the
*client's* BYO database, not Sapybase's control-plane DB. The two lineages are
independent: separate script directory, separate ``alembic_version`` table (each
lives on its own database), separate revision tree.

Crucially the target URL is NOT ``DATABASE_URL`` (that is the control plane).
The data-plane DB is supplied per-invocation, in priority order:

  1. an explicit ``sqlalchemy.url`` already set on the Config object
     (programmatic callers / tests),
  2. ``-x dsn=<tenant_dsn>`` on the alembic command line (the migration
     orchestrator, Phase 6, applies pending migrations to one tenant at a time),
  3. the ``BYOD_DATAPLANE_DATABASE_URL`` environment variable.

If none is provided we fail LOUD — silently defaulting to some other database
would be catastrophic for a multi-tenant data plane.
"""
import os
import sys
from logging.config import fileConfig
from pathlib import Path

from sqlalchemy import engine_from_config
from sqlalchemy import pool

from alembic import context

# Make the engine root importable so the data_plane revisions can import the
# authoritative `byod_dataplane` schema constants regardless of CWD.
_ENGINE_ROOT = Path(__file__).resolve().parent.parent
if str(_ENGINE_ROOT) not in sys.path:
    sys.path.insert(0, str(_ENGINE_ROOT))

config = context.config


def _resolve_dataplane_url() -> str:
    """Resolve the tenant (data-plane) DB URL. Fail loud if absent."""
    # 1. Already configured (programmatic callers / tests set this directly).
    existing = config.get_main_option("sqlalchemy.url")
    if existing:
        return existing
    # 2. -x dsn=... on the command line (orchestrator / CLI).
    x_args = context.get_x_argument(as_dictionary=True)
    if x_args.get("dsn"):
        return x_args["dsn"]
    # 3. Environment variable.
    env_url = os.getenv("BYOD_DATAPLANE_DATABASE_URL")
    if env_url:
        return env_url
    print(
        "ERROR: data-plane DB URL not set. Pass it as `-x dsn=<tenant_dsn>` or set "
        "BYOD_DATAPLANE_DATABASE_URL. (DATABASE_URL is the control plane and is NOT "
        "used here.)",
        file=sys.stderr,
    )
    sys.exit(1)


# Escape % for configparser — Postgres URLs with URL-encoded passwords (%40 for
# @, etc.) collide with configparser's %()-interpolation syntax. Doubling the
# percent makes configparser emit a literal %.
config.set_main_option("sqlalchemy.url", _resolve_dataplane_url().replace("%", "%%"))

# Interpret the config file for Python logging — but ONLY when invoked via the
# CLI. fileConfig() mutates Python's GLOBAL logging config and is NOT thread-safe;
# the Phase-6 migration orchestrator runs `command.upgrade` concurrently across
# many tenant DBs, so it sets the standard Alembic `configure_logger=False`
# attribute to skip this and avoid a cross-thread deadlock on the logging lock.
if config.config_file_name is not None and config.attributes.get(
    "configure_logger", True
):
    fileConfig(config.config_file_name)

# Hand-written migrations against op.execute() — no ORM models, so autogenerate
# is intentionally unsupported.
target_metadata = None


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode (emit SQL, no DBAPI needed)."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode against the tenant DB."""
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection, target_metadata=target_metadata
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
