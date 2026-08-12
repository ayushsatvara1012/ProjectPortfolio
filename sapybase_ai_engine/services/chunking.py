"""Structure-aware chunking (entity-safe-ingestion-plan Phase 1).

`html_extract` already preserves a page's structure - markdown headings, pipe tables,
`**term**` definitions, JSON-LD entity blocks. The old splitter counted characters and
knew none of that, so a table longer than one parent lost its header row and every
chunk after the first became unlabelled tuples. This module segments that markdown into
typed blocks first and packs whole blocks, so a record is never separated from the thing
that says what its fields mean.

Pure by design: no DB, no LLM, no Redis, no config. It takes text and returns chunks.

The load-bearing idea is `Chunk.context`. A row's column headers and its enclosing
heading are *structural* - the tenant did not write them once per chunk and must not be
billed once per chunk for them (plan §6 Q1). So they live beside the content rather than
inside it: `content` is exactly what was on the page and is what `word_count` bills,
while `retrievable_text` is what gets embedded and what the model reads.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Iterator, List, Optional

PARENT_SIZE = 1500
CHILD_SIZE = 300

_HEADING = re.compile(r"^(#{1,6}) \S")
_TABLE_LINE = re.compile(r"^\s*\|.*\|\s*$")
_TABLE_RULE = re.compile(r"^\s*\|(?:\s*:?-{3,}:?\s*\|)+\s*$")
_DEFINITION_TERM = re.compile(r"^\*\*.+\*\*$")
_ENTITY_HEAD = re.compile(r"^- \S")
_ENTITY_FIELD = re.compile(r"^\s+- \S")
_LIST_ITEM = re.compile(r"^\s*(?:[-*] |\d+\. )\S")
# Sentence end: terminator, closing quote/bracket optional, then whitespace. Kept
# deliberately dumb - an abbreviation splitting a prose chunk one sentence early is
# invisible to a reader, whereas anything cleverer here would need a language model.
_SENTENCE_END = re.compile(r"(?<=[.!?])[\"')\]]*\s+")


@dataclass(frozen=True)
class Chunk:
    """One retrievable unit.

    ``content`` is verbatim page text - the billable part. ``context`` is the structural
    scaffolding needed to read it (enclosing heading, table header row) and is stored
    once alongside, never folded into ``content``.
    """

    content: str
    context: str = ""

    @property
    def retrievable_text(self) -> str:
        """What gets embedded, and what the model is shown. Context first, so a row
        reads as a labelled record rather than four anonymous values."""
        return f"{self.context}\n{self.content}" if self.context else self.content

    @property
    def billable_words(self) -> int:
        return len(self.content.split())


@dataclass
class Parent:
    chunk: Chunk
    children: List[Chunk] = field(default_factory=list)


@dataclass
class Block:
    """A run of lines that means one thing. ``kind`` decides whether it may be cut."""

    kind: str  # heading | table | definition | entity | list | paragraph
    lines: List[str]
    #: Tables only: the header row plus its separator rule, repeated as context.
    header: Optional[List[str]] = None

    @property
    def text(self) -> str:
        return "\n".join(self.lines)

    @property
    def size(self) -> int:
        return len(self.text)

    @property
    def atomic(self) -> bool:
        """Whether cutting this block would destroy a record. Tables are excluded: they
        are divisible, but only at row boundaries, which ``_split_table`` handles."""
        return self.kind in ("definition", "entity", "heading")


def segment(text: str) -> List[Block]:
    """Markdown -> typed blocks, in document order."""
    lines = text.split("\n")
    blocks: List[Block] = []
    i = 0

    while i < len(lines):
        line = lines[i]
        if not line.strip():
            i += 1
            continue

        if _HEADING.match(line):
            blocks.append(Block("heading", [line]))
            i += 1
            continue

        if _TABLE_LINE.match(line):
            start = i
            while i < len(lines) and _TABLE_LINE.match(lines[i]):
                i += 1
            rows = lines[start:i]
            # A pipe run is only a TABLE if it declares columns. Without the rule line
            # it is decorative text that happens to contain pipes, and inventing a
            # header for it would label rows with the wrong thing.
            header = rows[:2] if len(rows) > 1 and _TABLE_RULE.match(rows[1]) else None
            blocks.append(Block("table", rows[2:] if header else rows, header=header))
            continue

        # Entity before list: a JSON-LD block also opens with "- ", and only its
        # indented field lines tell the two apart.
        if _ENTITY_HEAD.match(line) and i + 1 < len(lines) and _ENTITY_FIELD.match(lines[i + 1]):
            start = i
            i += 1
            while i < len(lines) and (_ENTITY_FIELD.match(lines[i]) or not lines[i].strip()):
                if not lines[i].strip():
                    # A blank line ends the entity unless more fields follow it.
                    if not (i + 1 < len(lines) and _ENTITY_FIELD.match(lines[i + 1])):
                        break
                i += 1
            blocks.append(Block("entity", [ln for ln in lines[start:i] if ln.strip()]))
            continue

        if _DEFINITION_TERM.match(line.strip()):
            start = i
            i += 1
            while i < len(lines) and lines[i].strip() and not _DEFINITION_TERM.match(lines[i].strip()):
                i += 1
            blocks.append(Block("definition", lines[start:i]))
            continue

        if _LIST_ITEM.match(line):
            start = i
            while i < len(lines) and (_LIST_ITEM.match(lines[i]) or
                                      (lines[i].strip() and lines[i].startswith((" ", "\t")))):
                i += 1
            blocks.append(Block("list", lines[start:i]))
            continue

        start = i
        while i < len(lines) and lines[i].strip() and not (
            _HEADING.match(lines[i]) or _TABLE_LINE.match(lines[i])
            or _DEFINITION_TERM.match(lines[i].strip()) or _LIST_ITEM.match(lines[i])
        ):
            i += 1
        blocks.append(Block("paragraph", lines[start:i]))

    return blocks


def _split_table(block: Block, heading: str, budget: int) -> Iterator[Chunk]:
    """Table -> chunks of whole rows, each carrying the header as context.

    This is the fix for the baseline's only real defect. Every part gets the header,
    not just the first, and it arrives as context so the tenant is billed for it once.
    """
    header_text = "\n".join(block.header) if block.header else ""
    context = "\n".join(p for p in (heading, header_text) if p)

    current: List[str] = []
    used = 0
    for row in block.lines:
        # A single row wider than the budget still ships whole - a torn record is a
        # correctness problem, an oversized chunk is only a cost one.
        if current and used + len(row) + 1 > budget:
            yield Chunk("\n".join(current), context)
            current, used = [], 0
        current.append(row)
        used += len(row) + 1
    if current:
        yield Chunk("\n".join(current), context)


def _split_paragraph(text: str, budget: int) -> Iterator[str]:
    """Prose -> pieces on sentence boundaries. Prose is the only kind that may be cut
    mid-block, because a sentence boundary is a real seam and a row boundary is not."""
    sentences = _SENTENCE_END.split(text)
    current: List[str] = []
    used = 0
    for sentence in sentences:
        if not sentence:
            continue
        if current and used + len(sentence) + 1 > budget:
            yield " ".join(current)
            current, used = [], 0
        current.append(sentence)
        used += len(sentence) + 1
    if current:
        yield " ".join(current)


def pack(blocks: List[Block], budget: int = PARENT_SIZE) -> List[Chunk]:
    """Blocks -> parents, never cutting a record.

    A heading is held rather than emitted: it belongs to what it introduces, and
    flushing it on its own is the baseline's second defect (an 11-character parent whose
    words never accompany any answer).
    """
    out: List[Chunk] = []
    # A STACK, not a single slot. `### Clause 3` under `## Shipping and returns` must
    # carry both: with one slot the subheading overwrites its parent and no chunk can
    # say which document the clause belongs to.
    heading_stack: List[tuple[int, str]] = []
    current: List[str] = []
    used = 0

    def heading_context() -> str:
        return "\n".join(text for _, text in heading_stack)

    def flush() -> None:
        nonlocal current, used
        if current:
            out.append(Chunk("\n\n".join(current), heading_context()))
            current, used = [], 0

    for block in blocks:
        if block.kind == "heading":
            # A new heading governs what follows, so close what the previous one did.
            flush()
            level = len(_HEADING.match(block.text).group(1))
            while heading_stack and heading_stack[-1][0] >= level:
                heading_stack.pop()
            heading_stack.append((level, block.text))
            continue

        if block.kind == "table":
            flush()
            for chunk in _split_table(block, heading_context(), budget):
                out.append(chunk)
            continue

        if block.atomic or block.size <= budget:
            if current and used + block.size > budget:
                flush()
            current.append(block.text)
            used += block.size + 2
            continue

        # Only paragraphs reach here: too big for one parent and safe to cut.
        flush()
        for piece in _split_paragraph(block.text, budget):
            out.append(Chunk(piece, heading_context()))

    flush()
    return out


def _children_for(parent: Chunk, budget: int) -> List[Chunk]:
    """Children inherit the parent's context, so a child is independently readable -
    which is the whole point, since children are what get embedded and searched."""
    lines = parent.content.split("\n")
    if all(_TABLE_LINE.match(ln) for ln in lines if ln.strip()):
        block = Block("table", [ln for ln in lines if ln.strip()])
        return list(_split_table(block, parent.context, budget))

    if len(parent.content) <= budget:
        return [parent]

    return [Chunk(piece, parent.context)
            for piece in _split_paragraph(parent.content, budget)]


def split(text: str, *, parent_size: int = PARENT_SIZE,
          child_size: int = CHILD_SIZE) -> List[Parent]:
    """The entry point. Text -> parents, each with the children that index it."""
    parents = pack(segment(text), parent_size)
    return [Parent(chunk=p, children=_children_for(p, child_size)) for p in parents]
