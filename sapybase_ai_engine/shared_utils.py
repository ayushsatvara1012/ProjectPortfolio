"""Shared utility registry for the Sapybase AI engine.

This module serves as a single import point for cross-cutting utilities,
ensuring the dependency graph has explicit edges between isolated helpers
and their consumers. Import from here instead of directly from sub-modules
to keep the import surface visible and auditable.
"""

from embedding_config import (
    get_embedding_model,
    EMBEDDING_MODEL,
    EMBEDDING_DIMENSIONS,
)

__all__ = [
    "get_embedding_model",
    "EMBEDDING_MODEL",
    "EMBEDDING_DIMENSIONS",
]
