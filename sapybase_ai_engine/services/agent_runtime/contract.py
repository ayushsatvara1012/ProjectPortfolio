"""The response contract - what must be true of a reply before the visitor reads it.

docs/bot-output-quality-plan.md §2 (Slice G) and §5 (Slice J). Four post-conditions:

  1. ``leading_restatement``  - no replay of the previous reply's opening.
  2. ``denial_opener``        - no "I don't have that" in front of a real answer.
  3. ``ungrounded_identities``- every name, phone and email came from this turn's evidence.
  4. ``surplus_questions``    - at most one question, and only when licensed (Slice J).

Checks 1, 2 and 4 repair deterministically here, at no model cost. Check 3 cannot:
removing a name can leave a reply that answers nothing, so it reports and the caller
re-invokes once (§2.5).

Why this is code and not a prompt rule: RULE 2 has carried an anti-restate clause
through four separate incidents and the symptom persisted anyway (audit A5). §7.1's
rule is that the higher the cost of being wrong, the lower the layer the behaviour
belongs in - this is the ``_strip_source_citation`` pattern, prompt for the common
case and code for the guarantee.

Pure functions with no I/O, so the thresholds below can be measured against real
traffic in shadow mode before anything is enforced (§2.5).
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from difflib import SequenceMatcher
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple

#: How close a leading sentence must be to one in the previous reply to count as a
#: replay. Deliberately high: the model paraphrases lightly when it repeats itself,
#: but two sentences that merely share a subject are not a restatement. Shadow mode
#: exists to move this number with evidence rather than taste.
RESTATEMENT_RATIO = 0.90

#: Below this a leading match is too short to be worth removing ("Sure.", "Of course.")
#: and stripping it would only make the reply abrupt.
MIN_RESTATEMENT_CHARS = 25

#: A denial only counts as a lie if a real answer follows it. Shorter than this and
#: the "answer" is more likely a trailing offer than substance.
MIN_ANSWER_AFTER_DENIAL = 40

_SENTENCE_SPLIT_RE = re.compile(r"(?<=[.!?])\s+")
_WHITESPACE_RE = re.compile(r"\s+")
_NON_WORD_RE = re.compile(r"[^a-z0-9]+")

#: Openers that deny having something. Broader than ``refusal.reads_as_refusal``,
#: which detects a whole reply that refused; here the target is a denial clause
#: bolted onto the front of an answer that does exist (gaps plan §13.4).
_DENIAL_PATTERNS = (
    r"i don'?t have",
    r"i do not have",
    r"i couldn'?t find",
    r"i could not find",
    r"i'?m not able to (?:find|confirm|provide)",
    r"i am not able to (?:find|confirm|provide)",
    r"i don'?t hold",
    r"that one i can'?t confirm",
    r"still nothing on",
    r"no (?:specific )?details? on file",
    r"i don'?t have (?:that|specific) information",
)
_DENIAL_RE = re.compile("|".join(_DENIAL_PATTERNS), re.IGNORECASE)

#: What a refusal's own next step sounds like (``refusal._NEXT_STEPS`` and the
#: offers RULE 6 licenses). A denial followed only by these is a complete refusal,
#: correctly formed - the defect is a denial in front of *substance*.
_NEXT_STEP_PATTERNS = (
    r"let me (?:get|connect|put)",
    r"give it another moment",
    r"tell me a little more",
    r"i'?ll try again",
    r"would you like",
    r"i can (?:connect|arrange|put)",
    r"the team (?:will|can)",
    r"someone from the team",
    r"share your (?:email|number|details)",
    r"happy to help",
    r"anything else",
)
_NEXT_STEP_RE = re.compile("|".join(_NEXT_STEP_PATTERNS), re.IGNORECASE)

#: Connectives left dangling once a leading span is removed.
_ORPHAN_CONNECTIVE_RE = re.compile(
    r"^\s*(?:however|that said|but|also|additionally|so|and|though|still)\s*,?\s*",
    re.IGNORECASE,
)

_EMAIL_RE = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")

#: Seven or more digits, allowing the separators a phone number is written with.
#: Shorter runs are quantities, CAS numbers and pack sizes, none of which are
#: contact details and all of which legitimately appear in a priced answer.
_PHONE_RE = re.compile(r"(?:\+?\d[\d\s().-]{6,}\d)")

#: Two or more capitalised words in a row - the shape of a person's name. Filtered
#: hard below, because this also matches "Safety Data Sheet" and "Acetic Acid".
_NAME_RE = re.compile(r"\b([A-Z][a-z]{1,20}(?:\s+[A-Z][a-z]{1,20}){1,3})\b")

#: Capitalised multi-word phrases that are never people. Domain vocabulary lives in
#: the pack, never here - this is the tenant-independent half only (the same split
#: ``services/faq_eligibility`` draws for the FAQ feed).
_NOT_A_PERSON = frozenset({
    "safety data sheet", "certificate of analysis", "material safety data",
    "data sheet", "technical data sheet", "purchase order", "sales order",
    "customer service", "customer support", "business development",
    "product specification", "quality control", "food grade", "industrial grade",
    "united states", "new delhi", "sales team", "support team", "our team",
    "let me", "i can", "please note", "thank you", "best regards", "kind regards",
    "good morning", "good afternoon", "good evening",
})

#: Leading words that make a match a sentence opener rather than a name.
_SENTENCE_OPENERS = frozenset({
    "the", "this", "that", "these", "those", "our", "your", "their", "his", "her",
    "we", "i", "you", "they", "it", "there", "here", "if", "when", "while", "for",
    "yes", "no", "sure", "please", "hello", "hi", "thanks", "thank",
})


@dataclass(frozen=True)
class ContractFinding:
    """One post-condition a reply failed."""

    check: str
    detail: str
    #: Whether this module already repaired it, or the caller must act (check 3).
    repaired: bool
    span: str = ""


@dataclass
class ContractReport:
    """What the contract made of one reply.

    ``text`` is the repaired reply in enforcing mode and the untouched original in
    shadow mode, so a shadow run can never change what a visitor reads.
    """

    text: str
    findings: List[ContractFinding] = field(default_factory=list)
    shadow: bool = False

    @property
    def changed(self) -> bool:
        return any(f.repaired for f in self.findings)

    @property
    def needs_reinvoke(self) -> bool:
        """Check 3 is the only failure a rewrite cannot fix (§2.5)."""
        return any(f.check == "ungrounded" for f in self.findings)

    def summary(self) -> str:
        return "; ".join(f"{f.check}: {f.detail}" for f in self.findings) or "clean"


def _sentences(text: str) -> List[str]:
    parts = [s.strip() for s in _SENTENCE_SPLIT_RE.split((text or "").strip())]
    return [s for s in parts if s]


def _normalise(text: str) -> str:
    return _NON_WORD_RE.sub(" ", (text or "").lower()).strip()


def _similar(a: str, b: str) -> float:
    na, nb = _normalise(a), _normalise(b)
    if not na or not nb:
        return 0.0
    return SequenceMatcher(None, na, nb).ratio()


# ── Check 1: no restatement of the previous reply ────────────────────────────────

def leading_restatement(text: str, prior_reply: str,
                        ratio: float = RESTATEMENT_RATIO) -> Optional[str]:
    """The leading span of ``text`` replayed from ``prior_reply``, if any.

    Compares leading sentences rather than whole messages on purpose: the failure
    observed in session ``4ef9ffa0`` is a *prepend* followed by genuinely new
    content, which whole-message similarity scores as a low match and misses (§2.4).
    """
    if not text or not prior_reply:
        return None

    prior_sentences = _sentences(prior_reply)
    if not prior_sentences:
        return None

    matched: List[str] = []
    for sentence in _sentences(text):
        if any(_similar(sentence, prior) >= ratio for prior in prior_sentences):
            matched.append(sentence)
            continue
        break

    if not matched:
        return None
    span = " ".join(matched)
    if len(span) < MIN_RESTATEMENT_CHARS:
        return None
    # Everything the model said was already said last turn: that is a repeat, but
    # stripping it would leave an empty reply, so the caller decides what to do.
    return span


def strip_leading_span(text: str, span: str) -> str:
    """Remove a leading span and whatever connective it left dangling."""
    remainder = (text or "")[len(span):].lstrip() if (text or "").startswith(span) else ""
    if not remainder:
        stripped = _WHITESPACE_RE.sub(" ", (text or "").strip())
        span_norm = _WHITESPACE_RE.sub(" ", span.strip())
        remainder = stripped[len(span_norm):].lstrip() if stripped.startswith(span_norm) else stripped
    remainder = _ORPHAN_CONNECTIVE_RE.sub("", remainder)
    return remainder[:1].upper() + remainder[1:] if remainder else ""


# ── Check 2: no denial in front of a real answer ─────────────────────────────────

def denial_opener(text: str) -> Optional[str]:
    """The opening denial sentence, when a substantive answer follows it.

    The refusal is the lie; the answer underneath is real (gaps plan §13.4).
    """
    sentences = _sentences(text)
    if len(sentences) < 2:
        return None
    opener = sentences[0]
    if not _DENIAL_RE.search(opener):
        return None
    remainder = sentences[1:]
    rest = " ".join(remainder).strip()
    if len(rest) < MIN_ANSWER_AFTER_DENIAL:
        return None
    if _DENIAL_RE.search(rest) and len(rest) < MIN_ANSWER_AFTER_DENIAL * 2:
        # Still refusing further down: this is a refusal, not a buried answer.
        return None
    if all(_NEXT_STEP_RE.search(s) for s in remainder):
        # "I don't have that. Let me get someone from the team." is the refusal
        # builder's own output, whole and correct - there is no answer to rescue.
        return None
    return opener


# ── Check 3: every identity detail grounded in this turn ─────────────────────────

def _evidence_haystack(evidence: Iterable[str]) -> Tuple[str, str]:
    joined = " ".join(str(e or "") for e in evidence)
    return _normalise(joined), re.sub(r"\D", "", joined)


def _candidate_names(text: str) -> List[str]:
    out: List[str] = []
    for match in _NAME_RE.finditer(text or ""):
        phrase = match.group(1).strip()
        low = phrase.lower()
        if low in _NOT_A_PERSON:
            continue
        if low.split()[0] in _SENTENCE_OPENERS:
            continue
        if phrase not in out:
            out.append(phrase)
    return out


def ungrounded_identities(text: str, evidence: Sequence[str],
                          extra_vocab: Sequence[str] = ()) -> List[str]:
    """Names, phones and emails in the reply that this turn's evidence does not support.

    ``evidence`` is kb chunk text **plus tool result payloads** - not chunks alone.
    SDS, COA, quote and spec replies legitimately carry names and identifiers that
    came from a tool and never appear in retrieval, so validating against chunks
    alone breaks every working tool answer. §2.4 names this as the single most
    likely way to get this slice wrong.

    ``extra_vocab`` is the pack's own vocabulary (product names, grades) that is
    capitalised but is never a person.
    """
    haystack, digits = _evidence_haystack(evidence)
    if not haystack and not digits:
        # No evidence at all is not a grounding failure to decide here - the turn's
        # own gates already refuse it, and reporting every name would drown check 3.
        return []

    blocked = {v.strip().lower() for v in extra_vocab if v and v.strip()}
    ungrounded: List[str] = []

    for name in _candidate_names(text):
        low = name.lower()
        if low in blocked or any(low in b or b in low for b in blocked):
            continue
        if _normalise(name) in haystack:
            continue
        ungrounded.append(name)

    for email in _EMAIL_RE.findall(text or ""):
        # The address ends where the sentence does; a trailing "." or "," is
        # punctuation, and comparing it as part of the address reports every
        # correctly-quoted email as invented.
        email = email.rstrip(".,;:)")
        if _normalise(email) not in haystack:
            ungrounded.append(email)

    for phone in _PHONE_RE.findall(text or ""):
        bare = re.sub(r"\D", "", phone)
        if len(bare) < 7:
            continue
        # Match on the last 10 digits so a country code written one way in the
        # record and another in the reply is not reported as invented.
        tail = bare[-10:]
        if tail and tail not in digits:
            ungrounded.append(phone.strip())

    return ungrounded


# ── Check 4: at most one question, and only when licensed ────────────────────────

def surplus_questions(text: str, licensed: bool) -> List[str]:
    """Question sentences beyond what this turn is allowed to ask.

    Slice J decides ``licensed`` - whether the turn is sales-progressing at all;
    this only enforces the count, which is why the two ship together (§2.4/§5).
    """
    questions = [s for s in _sentences(text) if s.rstrip().endswith("?")]
    if not questions:
        return []
    return questions if not licensed else questions[1:]


def _drop_sentences(text: str, doomed: Sequence[str]) -> str:
    if not doomed:
        return text
    kept = [s for s in _sentences(text) if s not in set(doomed)]
    return " ".join(kept).strip()


# ── The contract itself ──────────────────────────────────────────────────────────

def check(
    text: str,
    *,
    prior_reply: str = "",
    evidence: Sequence[str] = (),
    question_licensed: bool = True,
    pack_vocab: Sequence[str] = (),
    shadow: bool = True,
) -> ContractReport:
    """Apply all four post-conditions to one reply.

    ``shadow=True`` reports without changing a word, so thresholds can be measured
    against real traffic before enforcement (§2.5, owner decision). The caller
    re-invokes only on ``needs_reinvoke``, at most once, ever.
    """
    original = text or ""
    working = original
    findings: List[ContractFinding] = []

    span = leading_restatement(working, prior_reply)
    if span:
        repaired = strip_leading_span(working, span)
        # A reply that is nothing but the previous reply has no answer to salvage;
        # leave it to the caller rather than emitting an empty message.
        if repaired:
            findings.append(ContractFinding(
                check="restatement", detail=f"{len(span)} chars replayed",
                repaired=True, span=span))
            working = repaired
        else:
            findings.append(ContractFinding(
                check="restatement", detail="entire reply replays the previous turn",
                repaired=False, span=span))

    opener = denial_opener(working)
    if opener:
        repaired = strip_leading_span(working, opener)
        if repaired:
            findings.append(ContractFinding(
                check="denial_opener", detail=opener[:80], repaired=True, span=opener))
            working = repaired

    surplus = surplus_questions(working, question_licensed)
    if surplus:
        repaired = _drop_sentences(working, surplus)
        if repaired:
            findings.append(ContractFinding(
                check="extra_question", detail=f"{len(surplus)} unlicensed",
                repaired=True, span=" ".join(surplus)))
            working = repaired

    # Runs last and against the repaired text: a name that only appeared inside a
    # replayed span is not an ungrounded claim once the span is gone.
    invented = ungrounded_identities(working, evidence, extra_vocab=pack_vocab)
    if invented:
        findings.append(ContractFinding(
            check="ungrounded", detail=", ".join(invented[:5]),
            repaired=False, span=", ".join(invented)))

    return ContractReport(text=original if shadow else working,
                          findings=findings, shadow=shadow)


def evidence_from(retrieved_docs: Sequence[Any] = (),
                  captured: Optional[Dict[str, Any]] = None) -> List[str]:
    """This turn's evidence set, as text.

    Built here rather than read off ``TurnResult.sources``, which carries only
    attribution (url, content_id, rank, score) and explicitly not chunk content -
    see ``_build_kb_sources``. Both halves are required, per §2.4's trap.
    """
    evidence: List[str] = []
    for row in retrieved_docs or ():
        if isinstance(row, str):
            evidence.append(row)
        elif isinstance(row, (list, tuple)) and row:
            evidence.append(str(row[0]))
    for payload in (captured or {}).values():
        evidence.append(_stringify(payload))
    return [e for e in evidence if e]


def _stringify(payload: Any) -> str:
    if payload is None:
        return ""
    if isinstance(payload, str):
        return payload
    if isinstance(payload, dict):
        return " ".join(_stringify(v) for v in payload.values())
    if isinstance(payload, (list, tuple)):
        return " ".join(_stringify(v) for v in payload)
    return str(payload)
