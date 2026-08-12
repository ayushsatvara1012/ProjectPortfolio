"""Product resolution shared by the catalog tools.

``_resolve_product`` is the one path ``get_product_spec`` (and, historically,
``get_sds``) uses to turn a CAS/name/grade into exactly one product row, so
resolution can never drift between two tools. ``get_sds`` deliberately keeps its
OWN grade-agnostic resolver (see that module) - an SDS is per product, not per
grade.

SECURITY: every query here is ``company_id``-scoped without exception.
"""
from __future__ import annotations

import re
from typing import Any, Dict


def is_https(url: object) -> bool:
    """An SDS link is only servable if it's a real https URL (no http/relative)."""
    return isinstance(url, str) and url.strip().lower().startswith("https://")


def candidate(row) -> Dict[str, Any]:
    """Shrink a product row to the fields the agent needs to disambiguate."""
    return {"name": row[0], "cas_number": row[1], "grade": row[2]}


def split_packs(packaging: object) -> list:
    """Split a free-text packaging field into ordered pack-size options.

    Catalog packaging is stored as free text ("500 ml, 2.5 Ltr" / "500 ml and
    2.5 Ltr / 5 Ltr"). We split on commas, slashes, and the word 'and' so the
    widget can render selectable pack chips for product-discovery questions too
    (not just the quote flow). Returns [] when there's nothing usable.
    """
    if not isinstance(packaging, str) or not packaging.strip():
        return []
    parts = re.split(r"\s*(?:,|/|\band\b)\s*", packaging.strip(), flags=re.IGNORECASE)
    seen, out = set(), []
    for p in parts:
        p = p.strip()
        key = p.lower()
        if p and key not in seen:
            seen.add(key)
            out.append(p)
    return out


# The single column list every product lookup selects. A superset: ``get_sds``
# needs ``sds_ref``/``updated_at``; ``get_product_spec`` ignores them. Keeping one
# shape lets both tools share the resolver and the ``candidate`` row indexing.
PRODUCT_COLS = "name, cas_number, grade, packaging, sds_ref, updated_at"


def resolve_product(cursor, company_id, cas: str, name: str, grade: str = "") -> Dict[str, Any]:
    """Resolve a CAS/name(/grade) to exactly one product row, or a terminal status.

    Resolution order (CAS is the precise key; a fuzzy name never auto-resolves):
      1. exact CAS match
      2. exact (case-insensitive) name match
      3. partial name match -> returned as candidates to CONFIRM, never served

    When a name/CAS matches several rows (the common case: one product sold in
    LR / AR / HPLC grades, each with its OWN sheet), a supplied ``grade`` narrows
    them to the exact one. Without a grade, multiple matches stay ``ambiguous`` so
    the agent asks which grade - and can then act on the answer.

    Returns one of:
      - ``{"row": <tuple>}``                  - a single unambiguous match
      - ``{"status": "missing_identifier"}``  - neither CAS nor name supplied
      - ``{"status": "not_found", ...}``      - nothing matched
      - ``{"status": "ambiguous", ...}``      - >1 match and no/!matching grade

    The caller decides what to do with the single row (e.g. ``get_sds`` still has
    to vet the ``sds_ref``).
    """
    if not cas and not name:
        return {
            "status": "missing_identifier",
            "message": "Ask the visitor for the product name or, ideally, its CAS number.",
        }

    rows = []

    # 1. CAS exact — the precise, unambiguous key.
    if cas:
        cursor.execute(
            f"SELECT {PRODUCT_COLS} FROM products WHERE company_id = %s AND cas_number = %s",
            (company_id, cas),
        )
        rows = cursor.fetchall() or []

    # 2. Name exact (case-insensitive) fallback.
    if not rows and name:
        cursor.execute(
            f"SELECT {PRODUCT_COLS} FROM products WHERE company_id = %s AND lower(name) = lower(%s)",
            (company_id, name),
        )
        rows = cursor.fetchall() or []

    # 3. Partial name — present as candidates, NEVER auto-resolve (a wrong product
    #    is worse than asking one more question; identical discipline for spec+SDS).
    if not rows and name:
        cursor.execute(
            f"SELECT {PRODUCT_COLS} FROM products WHERE company_id = %s AND name ILIKE %s LIMIT 8",
            (company_id, f"%{name}%"),
        )
        partial = cursor.fetchall() or []
        if not partial:
            return {
                "status": "not_found",
                "message": (
                    "No matching product in the catalog. Tell the visitor you don't "
                    "have it on file and offer to connect them to the team."
                ),
            }
        # A grade can still single out one of the partial candidates.
        if grade:
            narrowed = [r for r in partial if (r[2] or "").strip().lower() == grade.strip().lower()]
            if len(narrowed) == 1:
                return {"row": narrowed[0]}
        return {
            "status": "ambiguous",
            "candidates": [candidate(r) for r in partial[:8]],
            "message": (
                "One or more products partially match. Ask the visitor to confirm "
                "the exact product (by grade or CAS number) before sharing anything."
            ),
        }

    if not rows:
        return {
            "status": "not_found",
            "message": (
                "No matching product in the catalog. Tell the visitor you don't have "
                "it on file and offer to connect them to the team."
            ),
        }

    # Multiple exact matches = several grades share a name/CAS. A supplied grade
    # picks the exact one; otherwise ask which grade. `rows` is included alongside
    # `candidates` (which only carries name/cas/grade) so a caller that needs a
    # field candidates don't expose doesn't need a second query.
    if len(rows) > 1:
        if grade:
            g = grade.strip().lower()
            narrowed = [r for r in rows if (r[2] or "").strip().lower() == g]
            if len(narrowed) == 1:
                return {"row": narrowed[0]}
            if len(narrowed) > 1:
                rows = narrowed  # same grade duplicated — still ambiguous below
            else:
                # Grade given but not stocked — name the grades that ARE available.
                available = [str(r[2]) for r in rows if r[2]]
                return {
                    "status": "ambiguous",
                    "candidates": [candidate(r) for r in rows[:8]],
                    "rows": rows,
                    "message": (
                        f"No '{grade}' grade is on file for this product. Available "
                        f"grades: {', '.join(available)}. Ask the visitor to pick one."
                    ),
                }
        return {
            "status": "ambiguous",
            "candidates": [candidate(r) for r in rows[:8]],
            "rows": rows,
            "message": "Several grades match. Ask the visitor which grade they need.",
        }

    return {"row": rows[0]}
