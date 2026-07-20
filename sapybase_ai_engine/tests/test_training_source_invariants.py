"""One training job = one logical source.

Two pre-existing bugs found while planning the URL scraper rewrite
(docs/url-scraper-rewrite-plan.md, premise corrections 3 and 4):

- `url`/`file`/`csv_file`/`text` were not mutually exclusive, so a combined
  submission stored one input's content under another's name and splitting mode.
- `doc.metadata["source"]` never reached the INSERT, so a future multi-source
  job would have silently written rows the atomic swap then deletes.
"""

import pytest
from langchain_core.documents import Document


def _run_training_job():
    from main import run_training_job
    return run_training_job


class TestSourceMetadataInvariant:
    """The guard must fire before any DB or Redis work, so these need no fixtures."""

    @pytest.mark.asyncio
    async def test_conflicting_doc_source_raises(self):
        with pytest.raises(ValueError) as exc:
            await _run_training_job()(
                job_id="job-1",
                resolved_company_id="c-1",
                docs=[Document(page_content="a", metadata={"source": "other-source.pdf"})],
                current_user={"tier": "PRO"},
                limit=1000,
                source_name="example.com",
            )
        assert "one logical source per job" in str(exc.value)
        assert "other-source.pdf" in str(exc.value)

    @pytest.mark.asyncio
    async def test_all_conflicting_sources_are_reported(self):
        with pytest.raises(ValueError) as exc:
            await _run_training_job()(
                job_id="job-1",
                resolved_company_id="c-1",
                docs=[
                    Document(page_content="a", metadata={"source": "one.pdf"}),
                    Document(page_content="b", metadata={"source": "two.csv"}),
                ],
                current_user={"tier": "PRO"},
                limit=1000,
                source_name="example.com",
            )
        message = str(exc.value)
        assert "one.pdf" in message and "two.csv" in message

    @pytest.mark.asyncio
    async def test_matching_source_passes_the_guard(self):
        # Downstream DB/Redis failures are caught and reported as job status, so a
        # legitimate single-source job returns rather than raising.
        await _run_training_job()(
            job_id="job-1",
            resolved_company_id="c-1",
            docs=[Document(page_content="a", metadata={"source": "example.com"})],
            current_user={"tier": "PRO"},
            limit=1000,
            source_name="example.com",
        )

    @pytest.mark.asyncio
    async def test_docs_without_source_metadata_pass_the_guard(self):
        # The PDF path tags pages with {"page": n} and no "source".
        await _run_training_job()(
            job_id="job-1",
            resolved_company_id="c-1",
            docs=[Document(page_content="a", metadata={"page": 1})],
            current_user={"tier": "PRO"},
            limit=1000,
            source_name="report.pdf",
        )


class TestPdfFallbackDocument:
    @pytest.mark.asyncio
    async def test_failed_pdf_does_not_claim_a_source(self, tmp_path):
        """The fallback doc used to carry metadata={"source": "error"}, which would
        now trip the invariant guard on every text-less PDF."""
        import main
        from pypdf import PdfWriter

        blank = tmp_path / "blank.pdf"
        writer = PdfWriter()
        writer.add_blank_page(width=200, height=200)
        with open(blank, "wb") as fh:
            writer.write(fh)

        docs = await main.process_pdf_efficiently(str(blank))
        assert len(docs) == 1
        assert "source" not in docs[0].metadata
        assert docs[0].metadata.get("extraction") == "failed"
