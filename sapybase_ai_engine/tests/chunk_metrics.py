"""Chunk-integrity metrics (entity-safe-ingestion-plan Phase 0).

Not a test module - deliberately not named ``test_*``, so pytest does not collect it.
It is the instrument the plan's phases are measured with: import it from a real test to
assert an invariant, or run it against a chunking implementation to produce the
before/after numbers.

Every metric here counts a way a chunk can be *uninterpretable on its own*, because
that is the failure that produces a confident wrong answer. A chunk holding four
unlabelled pipe-separated values is not missing information in the abstract - it is
missing which one is the phone number.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Callable, Iterable, List, Sequence

HEADING = re.compile(r"^#{1,6} \S")
TABLE_ROW = re.compile(r"^\s*\|.*\|\s*$")
TABLE_RULE = re.compile(r"^\s*\|(?:\s*-{3,}\s*\|)+\s*$")
DEFINITION_TERM = re.compile(r"^\*\*.+\*\*$")
ENTITY_HEAD = re.compile(r"^- [A-Z]\w+")
ENTITY_FIELD = re.compile(r"^\s+- \w+:")


def _lines(text: str) -> List[str]:
    return text.split("\n")


def is_table_row(line: str) -> bool:
    return bool(TABLE_ROW.match(line)) and not TABLE_RULE.match(line)


@dataclass
class ChunkReport:
    """One number per way a chunk can fail to stand alone. Lower is better, always."""

    chunks: int = 0
    stored_words: int = 0
    #: Chunks that are nothing but a heading - the heading is therefore attached to no
    #: content anywhere, so the words in it can never be retrieved alongside an answer.
    orphan_headings: int = 0
    #: Chunks holding table rows with no header row above them. The reader cannot tell
    #: which column is which. This is the defect that pairs a name to a wrong number.
    headerless_table_chunks: int = 0
    #: Table rows that were cut across a chunk boundary - a genuinely torn record.
    split_rows: int = 0
    #: JSON-LD entity blocks whose fields were separated from their type line.
    split_entities: int = 0
    #: A definition or FAQ term left at the end of a chunk with its body in the next
    #: one - the question is retrievable without its answer, and vice versa. Needs the
    #: chunk SEQUENCE to detect, which is why ``measure`` takes an ordered list.
    split_definitions: int = 0
    examples: List[str] = field(default_factory=list)

    @property
    def defects(self) -> int:
        return (self.orphan_headings + self.headerless_table_chunks
                + self.split_rows + self.split_entities + self.split_definitions)

    def summary(self) -> str:
        return (f"chunks={self.chunks} words={self.stored_words} "
                f"orphan_headings={self.orphan_headings} "
                f"headerless_tables={self.headerless_table_chunks} "
                f"split_rows={self.split_rows} "
                f"split_entities={self.split_entities} "
                f"split_definitions={self.split_definitions} "
                f"TOTAL_DEFECTS={self.defects}")


def measure(chunks: Sequence[str]) -> ChunkReport:
    """Score a list of retrievable chunks on whether each one stands alone.

    ``chunks`` is whatever the reader ultimately sees - so for the parent-child scheme
    pass the PARENTS, since parent content is what retrieval hands to the model.
    """
    rep = ChunkReport(chunks=len(chunks))

    for index, chunk in enumerate(chunks):
        # A term is only answered if its body follows it IN THE SAME chunk. Ending a
        # chunk on a bare term strands the question from its answer.
        if index + 1 < len(chunks):
            tail = [ln for ln in _lines(chunk) if ln.strip()]
            if tail and DEFINITION_TERM.match(tail[-1].strip()):
                rep.split_definitions += 1
                rep.examples.append(f"split definition: {tail[-1][:60]!r}")

        lines = [ln for ln in _lines(chunk) if ln.strip()]
        rep.stored_words += len(chunk.split())
        if not lines:
            continue

        if all(HEADING.match(ln) for ln in lines):
            rep.orphan_headings += 1
            rep.examples.append(f"orphan heading: {lines[0][:60]!r}")
            continue

        row_lines = [ln for ln in lines if is_table_row(ln)]
        if row_lines:
            # A header is only a header if the separator rule follows it; a bare row at
            # the top of a fragment is just a person, not a set of column names.
            has_header = any(TABLE_RULE.match(ln) for ln in _lines(chunk))
            if not has_header:
                rep.headerless_table_chunks += 1
                rep.examples.append(f"headerless table: {row_lines[0][:60]!r}")

        # A torn row: the chunk starts or ends mid-row, i.e. an unbalanced pipe line.
        for edge in (lines[0], lines[-1]):
            if edge.count("|") >= 1 and not TABLE_ROW.match(edge) and not HEADING.match(edge):
                rep.split_rows += 1
                rep.examples.append(f"split row: {edge[:60]!r}")

        if any(ENTITY_FIELD.match(ln) for ln in lines) and not any(
                ENTITY_HEAD.match(ln) for ln in lines):
            rep.split_entities += 1
            rep.examples.append(f"orphan entity fields: {lines[0][:60]!r}")

    return rep


def measure_corpus(corpus: dict[str, str], chunker: Callable[[str], Iterable[str]]
                   ) -> dict[str, ChunkReport]:
    return {name: measure(list(chunker(text))) for name, text in corpus.items()}
