import os
import sys
from logging.config import fileConfig
from pathlib import Path

from sqlalchemy import engine_from_config
from sqlalchemy import pool

from alembic import context

# Load DATABASE_URL from .env / .env.local (same pattern as main.py).
# In Render production, DATABASE_URL is already in the process env, so
# load_dotenv is a no-op there.
try:
    from dotenv import load_dotenv
    ROOT = Path(__file__).resolve().parent.parent
    for env_file in (".env.local", ".env"):
        p = ROOT / env_file
        if p.exists():
            load_dotenv(p)
            break
except ImportError:
    pass  # python-dotenv missing in some envs is fine if DATABASE_URL is already set

# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config

# Inject DATABASE_URL from env into Alembic's config so the rest of the file
# (and offline mode) sees a valid sqlalchemy.url. Fail LOUD if it's missing —
# silent default-to-sqlite would be a footgun.
db_url = os.getenv("DATABASE_URL")
if not db_url:
    print("ERROR: DATABASE_URL not set. Set it in .env / .env.local / shell env.", file=sys.stderr)
    sys.exit(1)
# Escape % for configparser — Postgres URLs with URL-encoded passwords (%40
# for @, etc.) collide with configparser's %()-interpolation syntax.
# Doubling the percent makes configparser emit a literal %.
config.set_main_option("sqlalchemy.url", db_url.replace("%", "%%"))

# Interpret the config file for Python logging.
# This line sets up loggers basically.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# We're not using SQLAlchemy ORM models — migrations are written by hand
# against op.execute() / op.add_column() etc. So target_metadata stays None
# and `alembic revision --autogenerate` is intentionally NOT supported.
target_metadata = None

# other values from the config, defined by the needs of env.py,
# can be acquired:
# my_important_option = config.get_main_option("my_important_option")
# ... etc.


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode.

    This configures the context with just a URL
    and not an Engine, though an Engine is acceptable
    here as well.  By skipping the Engine creation
    we don't even need a DBAPI to be available.

    Calls to context.execute() here emit the given string to the
    script output.

    """
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
    """Run migrations in 'online' mode.

    In this scenario we need to create an Engine
    and associate a connection with the context.

    """
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
