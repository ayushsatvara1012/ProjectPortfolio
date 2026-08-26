"""Structure-aware chunking (entity-safe-ingestion-plan Phase 1).

The invariant under test is one sentence: **a chunk must be interpretable on its own.**
Every assertion below is a way that can fail - a row without its column names, a heading
that governs nothing, a question without its answer, an entity's fields without the
entity - and each one is a way the model gets to invent the missing half.

`TestTheBaselineDefects` is the acceptance test: it re-runs the Phase 0 harness over the
Phase 0 corpus and requires zero. `TestCost` guards the other direction, since the
cheapest way to score zero defects would be to never split anything.
"""
from __future__ import annotations

import pytest

from services import chunking
from services.chunking import Block, Chunk, pack, segment, split
from services.html_extract import extract
from tests.chunk_fixtures import CORPUS, TEAM_LARGE
from tests.chunk_metrics import measure

TABLE = """## Our Team

| Name | Role | Phone |
| --- | --- | --- |
| Priya Raman | Head of QA | +91 98200 11111 |
| Dev Kulkarni | Sales Manager | +91 98200 22222 |
"""


def kinds(text: str) -> list[str]:
    return [b.kind for b in segment(text)]


class TestSegmentation:
    def test_a_heading_is_its_own_block(self):
        assert kinds("## Our Team\n\nSome prose here.") == ["heading", "paragraph"]

    def test_a_table_keeps_its_header_apart_from_its_rows(self):
        table = [b for b in segment(TABLE) if b.kind == "table"][0]
        assert table.header == ["| Name | Role | Phone |", "| --- | --- | --- |"]
        assert len(table.lines) == 2
        assert all(line.startswith("| ") for line in table.lines)

    def test_pipes_without_a_rule_line_are_not_a_table(self):
        # Inventing column names for a decorative pipe run would label every row with
        # the wrong thing - worse than leaving it unlabelled.
        block = segment("| just | some | text |\n| more | pipe | text |")[0]
        assert block.header is None
        assert len(block.lines) == 2

    def test_a_definition_holds_its_term_and_body_together(self):
        block = segment("**What is the lead time?**\nFive working days.")[0]
        assert block.kind == "definition"
        assert block.text == "**What is the lead time?**\nFive working days."

    def test_a_jsonld_entity_is_one_block(self):
        text = "- Organization\n  - name: Acme\n  - telephone: +91 22 4000 0000"
        block = segment(text)[0]
        assert block.kind == "entity"
        assert len(block.lines) == 3

    def test_a_bullet_list_is_not_mistaken_for_an_entity(self):
        # Both open with "- ". Only the indented field lines tell them apart.
        assert segment("- first item\n- second item\n- third item")[0].kind == "list"

    def test_prose_is_a_paragraph(self):
        assert segment("Just some ordinary prose about the company.")[0].kind == "paragraph"


class TestHeadingsAttachForward:
    """Baseline defect 2: `## Our Team` became an 11-character parent of its own, so
    those words never accompanied a single person's row."""

    def test_a_heading_never_becomes_a_chunk_of_its_own(self):
        chunks = pack(segment(TABLE))
        assert all(c.content.strip() != "## Our Team" for c in chunks)

    def test_the_heading_travels_as_context_on_what_it_introduces(self):
        chunks = pack(segment(TABLE))
        assert all("## Our Team" in c.context for c in chunks)
        assert all("## Our Team" in c.retrievable_text for c in chunks)

    def test_a_subheading_does_not_erase_its_parent(self):
        # Found by the corpus, not by design: with a single heading slot, `### Clause 0`
        # overwrote `## Shipping and returns` and no chunk could say which document the
        # clause belonged to. Headings are a stack.
        text = "## Shipping and returns\n\n### Clause 0\n\nGoods must be inspected."
        chunk = pack(segment(text))[0]
        assert "## Shipping and returns" in chunk.context
        assert "### Clause 0" in chunk.context

    def test_a_sibling_heading_pops_the_previous_one(self):
        text = ("## Policies\n\n### Shipping\n\nShips in two days.\n\n"
                "### Returns\n\nReturns within seven days.")
        chunks = pack(segment(text))
        returns = [c for c in chunks if "seven days" in c.content][0]
        assert "## Policies" in returns.context
        assert "### Returns" in returns.context
        assert "### Shipping" not in returns.context

    def test_a_new_heading_closes_the_previous_section(self):
        text = "## First\n\nAlpha prose.\n\n## Second\n\nBeta prose."
        chunks = pack(segment(text))
        assert len(chunks) == 2
        assert chunks[0].context == "## First" and "Alpha" in chunks[0].content
        assert chunks[1].context == "## Second" and "Beta" in chunks[1].content


class TestTablesKeepTheirHeader:
    """Baseline defect 1, and the reason this module exists."""

    def test_every_part_of_a_split_table_carries_the_header(self):
        text = extract(TEAM_LARGE, "https://acme.example/team")
        chunks = pack(segment(text), budget=600)
        table_chunks = [c for c in chunks if c.content.startswith("| Person")]
        assert len(table_chunks) > 1, "budget must actually force a split"
        for chunk in table_chunks:
            assert "| Name | Role | Phone | Email |" in chunk.context
            assert "## Our Team" in chunk.context

    def test_rows_are_never_cut(self):
        text = extract(TEAM_LARGE, "https://acme.example/team")
        for chunk in pack(segment(text), budget=600):
            for line in chunk.content.split("\n"):
                if line.strip().startswith("|"):
                    assert line.rstrip().endswith("|"), f"torn row: {line!r}"

    def test_a_row_wider_than_the_budget_still_ships_whole(self):
        # A torn record is a correctness problem; an oversized chunk is only a cost one.
        wide = "| " + " | ".join(f"cell number {i}" for i in range(40)) + " |"
        block = Block("table", [wide], header=["| a |", "| --- |"])
        chunks = list(chunking._split_table(block, "## H", budget=100))
        assert len(chunks) == 1
        assert chunks[0].content == wide


class TestAtomicBlocks:
    def test_an_oversized_entity_is_not_cut(self):
        fields = "\n".join(f"  - field{i}: value number {i} for this entity"
                           for i in range(60))
        chunks = pack(segment(f"- Organization\n{fields}"), budget=300)
        assert len(chunks) == 1
        assert chunks[0].content.count("- field") == 60

    def test_an_oversized_definition_is_not_cut(self):
        body = " ".join(f"Sentence number {i} of the answer." for i in range(80))
        chunks = pack(segment(f"**What is the storage requirement?**\n{body}"), budget=300)
        assert len(chunks) == 1
        assert chunks[0].content.startswith("**What is the storage requirement?**")

    def test_prose_is_the_only_kind_that_gets_cut(self):
        body = " ".join(f"Sentence number {i} about the policy." for i in range(80))
        chunks = pack(segment(body), budget=300)
        assert len(chunks) > 1
        # Cut on sentence boundaries, so no piece ends mid-sentence.
        assert all(c.content.rstrip().endswith(".") for c in chunks)


class TestContextIsNotBilled:
    """Plan §6 Q1: the tenant did not write the header once per chunk and must not be
    charged for it once per chunk."""

    def test_billable_words_exclude_context(self):
        chunk = Chunk(content="| Priya Raman | Head of QA |",
                      context="## Our Team\n| Name | Role |\n| --- | --- |")
        assert chunk.billable_words == len("| Priya Raman | Head of QA |".split())
        assert "Our Team" not in chunk.content

    def test_the_model_still_reads_the_context(self):
        chunk = Chunk(content="| Priya Raman | Head of QA |", context="| Name | Role |")
        assert chunk.retrievable_text.startswith("| Name | Role |")
        assert "Priya Raman" in chunk.retrievable_text

    def test_a_chunk_without_context_reads_as_itself(self):
        assert Chunk(content="Plain prose.").retrievable_text == "Plain prose."


class TestChildrenInheritContext:
    """Children are what get embedded and searched, so a child that has lost its header
    is a child that gets retrieved and misread."""

    def test_table_children_carry_the_header(self):
        text = extract(TEAM_LARGE, "https://acme.example/team")
        for parent in split(text):
            for child in parent.children:
                if child.content.startswith("| Person"):
                    assert "| Name | Role | Phone | Email |" in child.context

    def test_children_cover_their_parent(self):
        text = extract(TEAM_LARGE, "https://acme.example/team")
        for parent in split(text):
            joined = "\n".join(c.content for c in parent.children)
            for line in parent.chunk.content.split("\n"):
                if line.strip():
                    assert line in joined

    def test_a_small_parent_is_its_own_single_child(self):
        parent = split("## H\n\nShort prose.")[0]
        assert len(parent.children) == 1
        assert parent.children[0].content == parent.chunk.content


class TestTheBaselineDefects:
    """Acceptance: the Phase 0 harness over the Phase 0 corpus, which scored 5."""

    @pytest.mark.parametrize("name", sorted(CORPUS))
    def test_no_fixture_produces_a_defect(self, name):
        text = extract(CORPUS[name], f"https://acme.example/{name}")
        report = measure([p.chunk.retrievable_text for p in split(text)])
        assert report.defects == 0, f"{name}: {report.summary()} {report.examples[:3]}"

    def test_the_specific_row_from_the_plan_is_now_labelled(self):
        # The exact chunk quoted in the plan: four unlabelled values, no way to tell a
        # role from a phone number.
        text = extract(TEAM_LARGE, "https://acme.example/team")
        for parent in split(text):
            if "Person 16 Name" in parent.chunk.content:
                assert "Phone" in parent.chunk.retrievable_text
                assert "Role" in parent.chunk.retrievable_text
                break
        else:
            pytest.fail("fixture no longer contains the row the plan cites")


class TestCost:
    """Scoring zero defects by never splitting would be cheating. These bound it."""

    def test_the_corpus_does_not_get_more_expensive(self):
        # Children are what get embedded and what quota bills, so they are the number
        # that matters - not parents.
        total_children = 0
        total_words = 0
        for name, html in CORPUS.items():
            text = extract(html, f"https://acme.example/{name}")
            for parent in split(text):
                total_children += len(parent.children)
                total_words += sum(c.billable_words for c in parent.children)
        # Phase 1 measured 119 children / 4257 words against the old splitter's
        # 135 / 4626. Headroom left for fixture edits; a real regression blows past it.
        assert total_children <= 135
        assert total_words <= 4626

    def test_no_content_is_lost(self):
        # Against `retrievable_text`, not `content`: a heading deliberately moves OUT of
        # content and into context, so checking content alone would report the fix as
        # data loss. What must never be lost is what the reader ends up seeing.
        for name, html in CORPUS.items():
            text = extract(html, f"https://acme.example/{name}")
            packed = "\n".join(p.chunk.retrievable_text for p in split(text))
            for line in text.split("\n"):
                if line.strip() and not line.strip().startswith("|"):
                    assert line.strip() in packed, f"{name} dropped: {line[:60]!r}"

    def test_every_table_body_row_survives(self):
        # Rows are excluded from the check above because the header row legitimately
        # appears in many chunks' context. Here the BODY rows - the actual records -
        # must each still be present in billed content.
        for name, html in CORPUS.items():
            text = extract(html, f"https://acme.example/{name}")
            body = "\n".join(p.chunk.content for p in split(text))
            header_rows = {
                b.header[0].strip() for b in chunking.segment(text)
                if b.kind == "table" and b.header
            }
            for line in text.split("\n"):
                stripped = line.strip()
                if (stripped.startswith("|") and not chunking._TABLE_RULE.match(line)
                        and stripped not in header_rows):
                    assert stripped in body, f"{name} dropped row: {stripped[:60]!r}"

    def test_a_split_table_header_reaches_every_part(self):
        # The complement: the header is not in content, so prove it is not simply lost.
        text = extract(CORPUS["locations"], "https://acme.example/locations")
        table_parents = [p for p in split(text) if p.chunk.content.startswith("| Branch")]
        assert len(table_parents) > 1
        for parent in table_parents:
            assert "| Branch | Address | Phone | Hours |" in parent.chunk.retrievable_text


class TestLongListsSurvive:
    """A list is cut only between items, at any length.

    Production regression (docs/list-answer-consistency-plan.md): a 39-item numbered
    list in a PDF brochure was severed across two parents, so the bot answered the same
    question with 34 items once and 39 another. The list is the record here, exactly as
    a row is the record in a table.
    """

    HEAD = ("## Food grade range\n"
            "A comprehensive range of food-grade additives, packed under quality control: \n")

    def _list(self, n: int, sep: str = "  ") -> str:
        rows = "\n".join(f"{i}.{sep}Compound number {i} with a long descriptive name "
                         for i in range(1, n + 1))
        return self.HEAD + rows

    def _items(self, text: str) -> set[int]:
        import re
        return {int(m) for m in re.findall(r"(?:^|\s)(\d{1,3})\.\s+\S", text)}

    def test_a_pdf_numbered_list_is_a_list_not_prose(self):
        # A PDF renders "1.  Acetic acid" with two spaces. Reading that as prose is
        # what let the sentence splitter cut inside the list.
        assert kinds("1.  Acetic acid \n2.  Ascorbic acid ") == ["list"]

    @pytest.mark.parametrize("n", [39, 60, 140, 300])
    def test_no_item_is_ever_severed_or_lost(self, n):
        parents = split(self._list(n))
        seen: set[int] = set()
        for parent in parents:
            got = self._items(parent.chunk.content)
            assert not (seen & got), "an item appears in two parents"
            seen |= got
        assert seen == set(range(1, n + 1))

    @pytest.mark.parametrize("n", [60, 140, 300])
    def test_every_part_of_a_split_list_says_what_it_is_a_list_of(self, n):
        # The list's answer to a table's header row. "35. Sodium metabisulphite" alone
        # is unusable; the introducing line has to travel with it.
        for parent in split(self._list(n)):
            if self._items(parent.chunk.content):
                assert "food-grade additives" in parent.chunk.context

    @pytest.mark.parametrize("n", [60, 300])
    def test_children_do_not_sever_items_either(self, n):
        # Children are what get embedded, so a torn child is a retrieval failure even
        # when the parent is intact.
        for parent in split(self._list(n)):
            for child in parent.children:
                assert self._items(child.content) <= self._items(parent.chunk.content)

    def test_a_list_that_fits_is_still_packed_whole(self):
        # The narrow case must not regress into needless splitting.
        parents = split(self._list(12))
        holding = [p for p in parents if self._items(p.chunk.content)]
        assert len(holding) == 1
        assert self._items(holding[0].chunk.content) == set(range(1, 13))

    def test_the_introducing_line_is_context_not_billed_content(self):
        # Same rule as a table header: structural, so charged once (plan §6 Q1).
        for parent in split(self._list(140)):
            assert "packed under quality control" not in parent.chunk.content.split("\n", 1)[-1] \
                   or not self._items(parent.chunk.content)
