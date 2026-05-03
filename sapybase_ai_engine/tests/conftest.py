import pytest
import sys
import os

# Make sapybase_ai_engine importable without installing
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

# Stub heavy env vars so importing main.py doesn't crash in test env
os.environ.setdefault("DATABASE_URL", "postgresql://test:test@localhost/test")
os.environ.setdefault("GEMINI_API_KEY", "test-key")
os.environ.setdefault("CLERK_JWT_ISSUER", "https://test.clerk.accounts.dev")
os.environ.setdefault("CLERK_WEBHOOK_SECRET", "whsec_test")
os.environ.setdefault("POLAR_WEBHOOK_SECRET", "test-polar-secret")
os.environ.setdefault("ADMIN_SECRET", "test-admin-secret")
os.environ.setdefault("ENV", "test")
