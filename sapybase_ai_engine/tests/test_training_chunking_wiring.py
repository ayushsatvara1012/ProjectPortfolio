"""run_training_job feeds structure-aware chunks, with their context, to ingest.

The unit under test is the WIRING, not the chunker: services/chunking.py has its own
suite. What this proves is that a training job actually reaches ingest carrying whole
list items and their labels, which is what the production incident turned on
(docs/list-answer-consistency-plan.md §1.1).

Routed through the BYOD branch because that is the one seam where the chunks are
handed to a single call that can be captured without a database.
"""
from __future__ import annotations

import re

import pytest
from langchain_core.documents import Document

import byod_ingest


BROCHURE = (
    "## Food Additives Portfolio\n"
    "A comprehensive range of food-grade additives, packed under quality control: \n"
    + "\n".join(f"{i}.  Compound number {i} with a long descriptive name "
                for i in range(1, 121))
)


def _items(text: str) -> set[int]:
    return {int(m) for m in re.findall(r"(?:^|\s)(\d{1,3})\.\s+\S", text)}


@pytest.fixture
def captured(monkeypatch):
    import main
    from services import byod_engine

    seen: dict = {}

    async def _capture(job_id, company_id, source_name, chunks, limit, is_upsert):
        seen["chunks"] = chunks

    monkeypatch.setattr(byod_engine, "routing_active", lambda _cid: True)
    monkeypatch.setattr(main, "_byod_run_training_job", _capture)
    return seen


@pytest.mark.asyncio
async def test_a_long_list_reaches_ingest_with_every_item_intact(captured):
    from main import run_training_job

    await run_training_job(
        job_id="job-1",
        resolved_company_id="c-1",
        docs=[Document(page_content=BROCHURE, metadata={"source": "brochure.pdf"})],
        current_user={"tier": "PRO"},
        limit=100_000,
        source_name="brochure.pdf",
    )

    chunks = captured["chunks"]
    assert chunks, "nothing reached ingest"
    assert all(isinstance(c, byod_ingest.ChunkPair) for c in chunks)

    # Every item present across the parents, none torn in half.
    parents = {c.parent_content for c in chunks}
    assert _items("\n".join(parents)) == set(range(1, 121))


@pytest.mark.asyncio
async def test_every_part_of_the_split_list_carries_its_label(captured):
    from main import run_training_job

    await run_training_job(
        job_id="job-1",
        resolved_company_id="c-1",
        docs=[Document(page_content=BROCHURE, metadata={"source": "brochure.pdf"})],
        current_user={"tier": "PRO"},
        limit=100_000,
        source_name="brochure.pdf",
    )

    for chunk in captured["chunks"]:
        if _items(chunk.parent_content):
            assert "food-grade additives" in chunk.parent_context


@pytest.mark.asyncio
async def test_context_is_embedded_but_not_stored_as_content(captured):
    # The Q1 decision made concrete: the vector sees the label, the billed content
    # does not. A test on only one of those would miss the point.
    from main import run_training_job

    await run_training_job(
        job_id="job-1",
        resolved_company_id="c-1",
        docs=[Document(page_content=BROCHURE, metadata={"source": "brochure.pdf"})],
        current_user={"tier": "PRO"},
        limit=100_000,
        source_name="brochure.pdf",
    )

    labelled = [c for c in captured["chunks"] if c.child_context]
    assert labelled, "no child carried context"
    for chunk in labelled:
        assert chunk.child_context not in chunk.child_content
        assert chunk.child_retrievable.startswith(chunk.child_context)
        assert chunk.child_content in chunk.child_retrievable
