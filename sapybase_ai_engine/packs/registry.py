"""Pack registry — resolve a ``companies.vertical`` value to its Pack.

The registry is an explicit, statically-built dict (no import-time side-effect
registration, no import-order surprises). To add a vertical: import its pack and
add it to ``_REGISTRY``.

``load_pack`` is the single entry point the engine uses, and it is built to be
*safe by construction*: any absent, unknown, or malformed vertical resolves to
``None`` (the generic-bot path). A broken pack can never break an existing
``NULL``-vertical customer, because their value normalizes to ``None`` and the
registry is never consulted for them.
"""
from __future__ import annotations

import logging
from typing import Dict, Optional

from packs.chemical import CHEMICAL_PACK
from packs.schema import Pack, normalize_vertical

logger = logging.getLogger(__name__)

# Statically-built registry. One line per supported vertical.
_REGISTRY: Dict[str, Pack] = {
    CHEMICAL_PACK.vertical: CHEMICAL_PACK,
}


def known_verticals() -> tuple[str, ...]:
    """The set of verticals that currently have a registered pack."""
    return tuple(_REGISTRY.keys())


def load_pack(vertical: object) -> Optional[Pack]:
    """Resolve a raw ``companies.vertical`` value to its Pack, or ``None``.

    Returns ``None`` — meaning "use the generic, pre-pack engine path" — for every
    non-vertical case: a NULL/empty/whitespace value, a non-string value, or a
    slug with no registered pack (e.g. a typo or a vertical we haven't shipped).
    Never raises: a lookup failure degrades to generic rather than 500-ing a live
    request. Callers MUST treat ``None`` as "generic bot, no tools".
    """
    slug = normalize_vertical(vertical)
    if slug is None:
        return None
    try:
        pack = _REGISTRY.get(slug)
    except Exception:  # pragma: no cover - registry is a plain dict; defensive only
        logger.exception("pack registry lookup failed for vertical=%r", slug)
        return None
    if pack is None:
        # A value is set but we have no pack for it. Log once at info — this is an
        # operational signal (bad config / unshipped vertical), not an error, and
        # the request safely continues as a generic bot.
        logger.info("no pack registered for vertical=%r; serving generic bot", slug)
    return pack
