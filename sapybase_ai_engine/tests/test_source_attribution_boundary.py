"""Slice D §12.1 boundary: source attribution is owner-only, never visitor-facing.

RULE 3/RULE 4 forbid the widget ever seeing a document label, filename or URL.
Slice D writes that attribution to `chat_logs.sources` and renders it in the
owner dashboard — it must never reach an SSE frame on `/api/chat`, which is the
same stream the public embed route consumes.

§6 of the plan asks for this as a test rather than a convention, because the
failure mode is silent: appending one key to a yielded payload would leak
source labels to every visitor with no test turning red.
"""
import ast
import pathlib

MAIN = pathlib.Path(__file__).resolve().parent.parent / "main.py"

# The attribution values and the builders that produce them. If any of these
# reaches a `yield`, the owner-only boundary is broken.
SOURCE_IDENTIFIERS = (
    "_turn_sources",
    "_kb_sources",
    "_build_kb_sources",
    "_build_tool_sources",
)


def _yielded_segments() -> list[str]:
    source = MAIN.read_text()
    tree = ast.parse(source)
    return [
        seg
        for node in ast.walk(tree)
        if isinstance(node, (ast.Yield, ast.YieldFrom)) and node.value is not None
        for seg in [ast.get_source_segment(source, node.value)]
        if seg
    ]


def test_no_sse_frame_carries_source_attribution():
    leaks = [
        (ident, seg)
        for seg in _yielded_segments()
        for ident in SOURCE_IDENTIFIERS
        if ident in seg
    ]
    assert not leaks, "Source attribution leaked into an SSE frame:\n" + "\n".join(
        f"- {ident} in: {seg}" for ident, seg in leaks
    )


def test_no_sse_frame_carries_a_sources_payload_key():
    leaks = [seg for seg in _yielded_segments() if "'sources'" in seg or '"sources"' in seg]
    assert not leaks, "A 'sources' key reached the visitor stream:\n" + "\n".join(leaks)


def test_the_guard_can_actually_see_yield_payloads():
    """Guard against the checks above passing because nothing was parsed."""
    segments = _yielded_segments()
    assert len(segments) > 5
    assert any("token" in seg for seg in segments)
