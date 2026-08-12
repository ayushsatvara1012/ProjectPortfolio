"""Owner-facing source attribution for the tools a turn actually used.

The knowledge-base half is built in the request handler from the retrieved chunks;
this is the tool half, read from the SAME capture dict the SSE payload and the
real-time owner handoff already use - no new tracking, just a second read of data
already in hand.
"""
from __future__ import annotations

from typing import Any, Dict, List


def tool_sources(captured: Dict[str, Any]) -> List[Dict[str, Any]]:
    """One 'tool' source entry per transactional/lookup tool that produced this
    turn's answer (agent-conversation-gaps plan §12.2).

    ``get_sds`` is the clearest case named in the plan: the owner needs to see WHICH
    document the SDS panel showed, and that never appears in ``retrieved_docs`` at
    all - it comes straight from the tool result."""
    sources: List[Dict[str, Any]] = []
    sds = captured.get("sds")
    if sds:
        sources.append({"kind": "tool", "label": "get_sds",
                        "detail": sds.get("product"), "url": sds.get("url")})
    spec = captured.get("spec")
    if spec:
        sources.append({"kind": "tool", "label": "get_product_spec",
                        "detail": spec.get("product"), "url": None})
    quote = captured.get("quote")
    if quote:
        sources.append({"kind": "tool", "label": "request_quote",
                        "detail": quote.get("product"), "url": quote.get("quote_url")})
    coa = captured.get("coa")
    if coa and coa.get("status") == "found":
        results = coa.get("results") or []
        first = results[0] if results and isinstance(results[0], dict) else {}
        # No URL here even for the owner: COA documents are confidentiality-gated
        # (docs/coa-confidential-access-plan.md) and this module has no context
        # on whether the visitor's throttle/lockout state still permits a link.
        sources.append({"kind": "tool", "label": "get_coa",
                        "detail": coa.get("query") or first.get("name"), "url": None})
    if captured.get("form"):
        sources.append({"kind": "tool", "label": "request_sample", "detail": None, "url": None})
    return sources
