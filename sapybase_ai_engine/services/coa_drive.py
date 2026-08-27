"""COA finder — Google Drive connector and tokenized certificate search.

Plan `docs/coa-finder-plan.md` Phase 1 (§6 how it works, §7 matching, §10 hardening).

**The central design rule: we never parse filenames.** An earlier draft encoded one
client's convention (`{code}_{batch}_{description}.pdf`) as a regex, which is exactly
the hardcoded vertical logic this codebase forbids — the next client names files
`ACET-LR-B1042.pdf` and the parser is dead. Instead every filename is *tokenized*
(NFKC-normalized, uppercased, split on every run of non-alphanumerics) and a query
matches against those tokens. We never decide which token is "the product code" or "the batch"; the
file simply contains them. The consequence is zero per-client configuration: a folder
link is the entire onboarding.

The module is split so the interesting half needs no network:

  * **Pure** — :func:`normalize`, :func:`tokenize`, :func:`display_name`,
    :func:`build_document`, :func:`dedupe`, :func:`search`. Unit-testable without
    Drive, Redis, or a key.
  * **I/O** — :func:`walk_folder` and its private helpers. One ``files.list`` per
    folder (Drive has no recursive query), fanned out concurrently.

Guard rails: every unbounded path is capped — walk depth, folders, files, pages per
folder (H14), and a visited-set so a shortcut pointing at an ancestor cannot loop
(H4). A breach serves what it has rather than hanging, and reports itself in
:attr:`WalkResult.capped` so the owner panel can say why a folder looks short.
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import random
import re
import time
import unicodedata
import zlib
from collections import OrderedDict
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple

import httpx

from byod_breaker import BreakerConfig, BreakerOpen, BreakerRegistry
from packs.overrides import COA_FOLDER_ID_RE

logger = logging.getLogger("coa_drive")

DRIVE_FILES_ENDPOINT = "https://www.googleapis.com/drive/v3/files"
FOLDER_MIME = "application/vnd.google-apps.folder"
SHORTCUT_MIME = "application/vnd.google-apps.shortcut"

# H7 — files.list returns a MINIMAL field set unless `fields` is given, and
# webViewLink is not in it. Omit this and every result carries webViewLink=None,
# i.e. every link in the panel is broken while the walk looks perfectly healthy.
DRIVE_FIELDS = "nextPageToken,files(id,name,mimeType,modifiedTime,webViewLink,shortcutDetails)"

# Walk guard rails (plan §6).
#
# MAX_FILES was 5,000 on an estimate of "a few hundred COAs a year". The client's
# real folder turned out to hold 2,240 files for seven months of 2026 (~320/month),
# which would have breached that cap around mid-2027 — and a breach serves PARTIAL
# results, announced only through `WalkResult.capped`. Raised to 25,000 (~2032 at
# the same intake) now that a listing costs ~54 bytes compressed and is parsed once
# per TTL rather than once per search. The binding constraint is no longer this
# number but the cached entry size; the signal to move to a `coa_documents` Postgres
# index is that entry approaching a megabyte.
MAX_DEPTH = 6
MAX_FOLDERS = 200
MAX_FILES = 25000
MAX_PAGES_PER_FOLDER = 10
PAGE_SIZE = 1000
WALK_CONCURRENCY = 8
HTTP_TIMEOUT = 10.0

# H15 — bounded retry with backoff. Three attempts costs at most ~1.5s of added
# latency against a ~1.5s walk, which a visitor waiting on a search will accept and
# which is well inside the widget's patience. The walk fans out 8 folders at once, so
# a rate-limited Drive would have all 8 retrying in lockstep without the jitter.
MAX_DRIVE_ATTEMPTS = 3
RETRY_BASE_DELAY_SECONDS = 0.25
RETRY_MAX_DELAY_SECONDS = 2.0

# Transient by definition: too many requests, or Drive itself being unwell.
RETRYABLE_STATUSES = frozenset({429, 500, 502, 503, 504})

# A 403 is the ambiguous one. These reasons mean "slow down" and are retryable;
# anything else on a 403 means the folder is not readable by us and retrying is pure
# latency. Compared lowercased because Drive is not consistent about case.
_RATE_LIMIT_REASONS = frozenset({
    "ratelimitexceeded", "userratelimitexceeded", "sharingratelimitexceeded",
    "quotaexceeded", "backendlimitexceeded", "rate_limit_exceeded",
})

# H10 — a filename is attacker-controlled by anyone who can write to the Drive
# folder, so it is capped on ingest before it can reach a log or an observation.
MAX_NAME_LEN = 300

# Phase 4 (owner visibility). Both lists are samples, not inventories: the owner
# needs to recognise the *shape* of a problem and go fix it in Drive, and an
# unbounded list would put a 400-name array in a cached entry and on a settings page.
MAX_DUPLICATE_SAMPLES = 25
MAX_THIN_SAMPLES = 25

# A filename with one token is findable only by typing that token exactly — no
# batch, no product name, nothing to narrow with. `129LR.pdf` in the client's real
# folder is the whole population of this category, but a folder of `scan001.pdf` is
# unsearchable by any design (§11), and Phase 4 exists to make that visible rather
# than to fix it.
MIN_FINDABLE_TOKENS = 2

# §4 of the confidential-access amendment. A query carrying fewer than two tokens is
# refused before it is matched at all, so "acetone" and "EP" never reach the library.
#
# There is no result cap any more because there is no result list: a query resolves to
# exactly one certificate or to nothing, so the "keep typing to narrow" hint the cap
# used to drive has nothing left to describe.
MIN_QUERY_TOKENS = 2

# coa-split-lookup-fields-plan §5 step 6. A document token shorter than this
# prefix-matches almost anything a customer might type (`101` prefixes half a
# product line), so it is excluded from the tolerant pass entirely — a noise floor,
# not a claim about what a product code looks like (D2 still applies).
MIN_PREFIX_DOC_TOKEN = 4

# Everything that separates one meaningful chunk of a filename from the next. The
# whole point is that we do NOT care which chunk means what.
#
# This was `[_\-.\s/]+` — a list hand-picked from one client's filenames, which is a
# small piece of the convention-fitting D2 forbids. It also had a live consequence: a
# comma is not in that set, so a visitor typing "acetone, batch 100.26R016" produced
# the token "ACETONE," which matches nothing, the strict pass failed, and the fallback
# returned the whole acetone catalogue. Any run of non-alphanumerics is a separator
# now, so `ACET,LR,B1042.pdf` and `BUTAN-1-OL (N-BUTANOL)` tokenize as well as the
# underscore convention does.
#
# `[\W_]+` rather than `[^0-9A-Z]+` on purpose: `\W` is Unicode-aware for str
# patterns, so letters and digits of any script survive as tokens, while the
# underscore — a word character to `\w` — is still split on. An ASCII-only class
# would tokenize a Cyrillic or CJK filename to nothing and make it unfindable.
_SEPARATORS = re.compile(r"[\W_]+")

# Leading zeros inside a numeric run, so `26R16` still finds `26R016` (§7).
_LEADING_ZEROS = re.compile(r"0*(\d+)")

# Document extensions, stripped from both filenames and queries so that pasting a
# whole filename does not fail the strict pass on a stray "PDF" token.
_EXTENSION_TOKENS = frozenset({"PDF", "DOC", "DOCX", "JPG", "JPEG", "PNG", "TIF", "TIFF"})
_EXTENSION_SUFFIX = re.compile(r"\.(pdf|docx?|jpe?g|png|tiff?)$", re.IGNORECASE)

# H3 — the Drive API key travels as a URL query parameter, so any string built from
# a request URL (notably `str(httpx_error)`) carries it. Scrub before logging.
_KEY_IN_URL = re.compile(r"([?&]key=)[^&\s]*")

class CoaDriveError(Exception):
    """Drive could not be reached, or refused us.

    Carries a short machine-readable ``reason`` and never any Drive response text,
    folder ID, or URL — a 403 must not be able to smuggle the API key (H3) or the
    folder ID (H11) into a widget response, a log line, or a Slack handoff.

    ``retryable`` is what H15 turns on: a 403 meaning "you are going too fast" and a
    403 meaning "this folder is not shared with you" arrive identically and must be
    treated completely differently — retrying the second is pure latency, and
    reporting the first to a visitor as "no certificate exists" is a lie.
    """

    def __init__(self, reason: str, retryable: bool = False):
        super().__init__(reason)
        self.reason = reason
        self.retryable = retryable


def scrub(text: Any) -> str:
    """Redact ``key=…`` from anything on its way to a log (H3)."""
    return _KEY_IN_URL.sub(r"\1[redacted]", str(text))


# ─────────────────────────────── pure: text ────────────────────────────────

def normalize(value: Any) -> str:
    """NFKC + uppercase + strip — the ONE normalizer (H17).

    Index and query must normalize through the same function or nothing ever
    matches, so both paths call this and a test asserts they share it. NFKC folds
    the full-width and compatibility forms a copy-paste out of a PDF can carry.
    """
    if not isinstance(value, str):
        return ""
    return unicodedata.normalize("NFKC", value).strip().upper()


def tokenize(value: Any) -> Tuple[str, ...]:
    """Split a filename or a query into comparable tokens (§2).

    ``100RG_100.26R016_ACETONE RG.pdf`` → ``100RG 100 26R016 ACETONE RG``

    A trailing extension token is dropped so that pasting a whole filename as the
    query does not fail the strict pass on "PDF"; it is only dropped when other
    tokens survive it, so a query of "pdf" is still a (useless but honest) query.
    """
    text = normalize(value)
    if not text:
        return ()
    tokens = [t for t in _SEPARATORS.split(text) if t]
    if len(tokens) > 1 and tokens[-1] in _EXTENSION_TOKENS:
        tokens.pop()
    return tuple(tokens)


def tokenize_filename(raw_name: Any) -> Tuple[str, ...]:
    """Tokenize a FILENAME, where the extension is never a token.

    Differs from :func:`tokenize` in one case that matters: a file called
    ``___.pdf`` has no meaningful tokens at all and must be dropped rather than
    indexed under "PDF", whereas a *query* of "pdf" is a real, if useless, query and
    may not be silently emptied into H6's match-everything hole. Both paths still
    share :func:`normalize`, which is what H17 actually requires.
    """
    if not isinstance(raw_name, str):
        return ()
    return tokenize(_EXTENSION_SUFFIX.sub("", raw_name.strip()))


def numeric_key(token: str) -> str:
    """Strip leading zeros inside every numeric run: ``26R016`` → ``26R16`` (§7)."""
    return _LEADING_ZEROS.sub(r"\1", token)


def display_name(raw_name: str) -> str:
    """The filename shown back to the visitor, cleaned up — never parsed (§7).

    ``100RG_100.26R016_ACETONE RG.pdf`` → ``100RG · 100.26R016 · ACETONE RG``

    Splits on ``_`` only, so the dotted batch stays intact, and collapses the stray
    and doubled spaces seen in the client's folder. Original case is preserved: this
    is presentation, not matching.
    """
    if not isinstance(raw_name, str):
        return ""
    stem = _EXTENSION_SUFFIX.sub("", raw_name.strip())
    parts = [re.sub(r"\s+", " ", part).strip() for part in stem.split("_")]
    parts = [p for p in parts if p]
    return " · ".join(parts) if parts else re.sub(r"\s+", " ", stem).strip()


# ───────────────────────────── pure: documents ──────────────────────────────

@dataclass(frozen=True)
class CoaDocument:
    """One certificate, as indexed. Immutable so a cached listing cannot drift."""

    file_id: str
    name: str
    modified_time: str          # RFC3339 UTC from Drive, or "" when absent (H9)
    web_view_link: str
    tokens: Tuple[str, ...]
    numeric_tokens: Tuple[str, ...]
    display: str

    @property
    def download_url(self) -> str:
        """H8 — a ``webViewLink`` is an HTML viewer page, not the PDF. Saving that
        blob under a ``.pdf`` name hands the customer a corrupt file, so Download
        must target the direct-download form."""
        return f"https://drive.google.com/uc?export=download&id={self.file_id}"


def is_pdf(entry: Dict[str, Any]) -> bool:
    """Drive occasionally reports a generic mime for an uploaded PDF, so the name
    is accepted as a second opinion. Everything else is ignored but counted."""
    if (entry.get("mimeType") or "") == "application/pdf":
        return True
    return bool(_EXTENSION_SUFFIX.search(str(entry.get("name") or "")))


def build_document(entry: Dict[str, Any]) -> Optional[CoaDocument]:
    """A raw Drive ``files.list`` entry → a :class:`CoaDocument`, or ``None``.

    ``None`` means unusable — no ID, no name, or no link to serve — and an unusable
    file is dropped rather than indexed, mirroring the SDS picker's rule that a
    product with no servable sheet is never offered.
    """
    if not isinstance(entry, dict):
        return None
    file_id = str(entry.get("id") or "").strip()
    raw_name = str(entry.get("name") or "").strip()[:MAX_NAME_LEN]
    link = str(entry.get("webViewLink") or "").strip()
    if not file_id or not raw_name or not link:
        return None
    tokens = tokenize_filename(raw_name)
    if not tokens:
        return None
    return CoaDocument(
        file_id=file_id,
        name=raw_name,
        modified_time=str(entry.get("modifiedTime") or "").strip(),
        web_view_link=link,
        tokens=tokens,
        numeric_tokens=tuple(numeric_key(t) for t in tokens),
        display=display_name(raw_name),
    )


def _wins(candidate: CoaDocument, incumbent: CoaDocument) -> bool:
    """Newest-``modifiedTime`` wins, nulls always lose (D6, H9).

    The same trap ``_newest_https_row`` documents for SDS: comparing two ``None``
    timestamps raises ``TypeError``, so a null is only ever skipped, never compared.
    Drive's ``modifiedTime`` is RFC3339 UTC with a fixed shape, so the lexicographic
    comparison is a chronological one. Equal timestamps tiebreak on file ID, so a
    result never flip-flops between requests.
    """
    if not candidate.modified_time:
        return False
    if not incumbent.modified_time:
        return True
    if candidate.modified_time != incumbent.modified_time:
        return candidate.modified_time > incumbent.modified_time
    return candidate.file_id < incumbent.file_id


def dedupe(documents: Iterable[CoaDocument]) -> List[CoaDocument]:
    """Collapse identical filenames to one document, newest wins (D6).

    The client files one COA per batch and the same certificate appears in two month
    folders, so an identical normalized filename is a revision, not a distinct
    document. This is an assumption, not a law — a client filing per-customer
    subfolders with repeated names would lose documents — and Phase 4's duplicate
    report is the safety net (H16).
    """
    best: Dict[str, CoaDocument] = {}
    for doc in documents:
        key = normalize(doc.name)
        incumbent = best.get(key)
        if incumbent is None or _wins(doc, incumbent):
            best[key] = doc
    return sorted(best.values(), key=lambda d: d.file_id)


def duplicate_names(documents: Iterable[CoaDocument]) -> Dict[str, int]:
    """Filenames seen more than once, for the owner panel (H16, Phase 4).

    Must be called on the PRE-dedupe document list — after :func:`dedupe` there are
    by definition no duplicates left to report, which is exactly why the walk
    computes this and stores it rather than the panel deriving it from a listing.
    """
    counts: Dict[str, int] = {}
    for doc in documents:
        counts[doc.name] = counts.get(doc.name, 0) + 1
    return {name: n for name, n in counts.items() if n > 1}


def duplicate_summary(
    documents: Iterable[CoaDocument],
) -> Tuple[int, Tuple[Tuple[str, int], ...]]:
    """``(copies_collapsed, samples)`` for the duplicate report (H16).

    ``copies_collapsed`` counts documents that :func:`dedupe` will drop, not names
    that repeat: 411 repeated names collapsing 457 copies is one folder's real
    measurement, and the second number is the one that answers "did I lose a
    document?". Samples are the worst offenders first, so the owner sees a name filed
    five times before one filed twice.
    """
    counts = duplicate_names(documents)
    collapsed = sum(n - 1 for n in counts.values())
    ranked = sorted(counts.items(), key=lambda kv: (-kv[1], kv[0]))
    return collapsed, tuple(ranked[:MAX_DUPLICATE_SAMPLES])


def thin_documents(documents: Iterable[CoaDocument]) -> List[CoaDocument]:
    """Certificates with too few tokens to be findable in practice (Phase 4, §11).

    Pure and derived from the tokenizer, so a change to how filenames split shows up
    here on the next read instead of being frozen into a cached counter.
    """
    return [d for d in documents if len(d.tokens) < MIN_FINDABLE_TOKENS]


# ─────────────────────────────── pure: search ───────────────────────────────

@dataclass(frozen=True)
class CoaQuery:
    """A certificate lookup, tokenized per field (coa-split-lookup-fields-plan §5).

    ``product_tokens`` and ``batch_tokens`` are matched by DIFFERENT rules. The
    strict pass (:func:`_hits`) pools both fields and requires exact equality —
    field-agnostic, so a customer who puts the batch in the product box still
    resolves, exactly as the single-box query always has. The tolerant pass
    (:func:`_hits_tolerant`) runs only when the strict pass finds nothing, and
    widens ``product_tokens`` alone: a printed pack code carries a size suffix
    (`101LR025L`) that a certificate's filename never does (`101LR`). The batch
    keeps the exact rule always — it is the entropy, and a tolerant batch could
    release the WRONG certificate, not just fail to release the right one.

    Immutable, like :class:`CoaDocument` — a query is a snapshot of what was
    typed, not something later code should be able to mutate underneath a caller.
    """

    product_tokens: Tuple[str, ...] = ()
    batch_tokens: Tuple[str, ...] = ()

    @classmethod
    def from_fields(cls, product: Any, batch: Any) -> "CoaQuery":
        """The two-box panel and the ``get_coa`` tool's two slots."""
        return cls(product_tokens=tokenize(product), batch_tokens=tokenize(batch))

    @classmethod
    def from_raw(cls, raw: Any) -> "CoaQuery":
        """The legacy single-box ``q=`` — a widget bundle already cached on a
        customer's site sends this and must keep resolving byte-for-byte.

        Every token lands in ``batch_tokens``, never ``product_tokens``. Pooled
        into the strict pass that is identical either way, but with
        ``product_tokens`` empty the tolerant pass has nothing to widen and can
        never trigger (see the guard in :func:`_matches`) — a cached bundle must
        not silently gain a tolerance it has no field to express.
        """
        return cls(batch_tokens=tokenize(raw))

    @property
    def pooled_tokens(self) -> Tuple[str, ...]:
        """Every token from both fields — the strict pass does not care which
        field a token came from, only that every one of them matched (§5 step 2-4)."""
        return self.product_tokens + self.batch_tokens


def _coerce_query(query: Any) -> CoaQuery:
    """Accept a :class:`CoaQuery` as-is, or wrap anything else via ``from_raw``.

    Keeps every existing caller — the endpoint's current ``q=``, the old agent
    tool call, every raw-string test — working unchanged while the two-pass logic
    below lands. Mirrors ``coerce_overrides`` in ``packs/overrides.py``: normalize
    once at the boundary rather than asking every caller to know the new type.
    """
    return query if isinstance(query, CoaQuery) else CoaQuery.from_raw(query)


def _hits(query_token: str, doc: CoaDocument) -> bool:
    """Does one query token match this file? Exactly, or not at all (§4 step 3).

    Prefix and substring matching are gone deliberately. They are what let `EP` return
    48 certificates and `acetone` fill the result cap, and a result row carries the
    product code, batch and date — so the list alone published the client's production
    history without a single PDF being opened.

    The leading-zero normalization survives as the one tolerance, because it is a
    normalization rather than a fuzzy match: `26R16` and `26R016` are one identifier
    written two ways, not two identifiers that happen to look alike.
    """
    return query_token in doc.tokens or numeric_key(query_token) in doc.numeric_tokens


def _hits_tolerant(query_token: str, doc: CoaDocument) -> bool:
    """Does one PRODUCT token match this file, tolerating a printed pack-size
    suffix the filename never carries (coa-split-lookup-fields-plan §5 step 6)?

    Exact still counts (everything :func:`_hits` accepts still passes here). Beyond
    that, one extra shape is tolerated: a document token of at least
    ``MIN_PREFIX_DOC_TOKEN`` characters that is a PREFIX of the query token —
    `101LR` (in the filename) prefixing `101LR025L` (typed off the drum).

    One-directional on purpose, and this is the part that must never drift. `EP`
    matching `EPICHLOROHYDRIN` — a short QUERY prefixing a long DOCUMENT token — is
    the browsable-index behaviour coa-confidential-access §4 deleted (it is what let
    `EP` return 48 certificates). This function only ever tolerates the customer
    supplying MORE characters than the file holds, never fewer, so it can rescue an
    over-specified query and cannot turn a short probe into a list.
    """
    if _hits(query_token, doc):
        return True
    return any(
        len(t) >= MIN_PREFIX_DOC_TOKEN and query_token.startswith(t)
        for t in doc.tokens
    )


def _matches_by_pass(documents: Sequence[CoaDocument], query: Any) -> Tuple[List[CoaDocument], str]:
    """Same two-pass logic :func:`_matches` exposes, plus WHICH pass produced the
    list — ``"strict"`` or ``"tolerant"`` (coa-split-lookup-fields-plan §5, Phase 5).

    The pass name is not a new fact about the certificate library; it is already
    implicit in which branch below ran. Surfacing it is what lets
    :func:`resolve_with_shape` log the SHAPE of a lookup (which pass released it,
    or that nothing did) without ever touching a count or a filename — the two
    things C3 withholds from a visitor stay withheld; a pass name alone reveals
    neither how many documents exist nor which one matched.

    Two passes, in order:

    1. **Strict** (§4 steps 1-4, unchanged): pool every token from both fields —
       field-agnostic, so a swapped product/batch still resolves — and keep
       documents where EVERY pooled token matches exactly. If this finds anything
       at all, even an ambiguous set, it is the final answer: an ambiguous strict
       result must never fall through to the tolerant pass and get resolved by it.
    2. **Tolerant** (§5 step 6): only reached on a strict MISS, and only when the
       query actually has a product field to widen. Batch tokens keep the exact
       rule even here — tolerating the batch could release the WRONG certificate,
       not just fail to release the right one.
    """
    query = _coerce_query(query)
    pooled = query.pooled_tokens
    # H6 — "every query token must match" is VACUOUSLY TRUE for zero tokens, so an
    # unguarded query of "___" would match the entire folder. The floor closes that
    # and enforces §4's two-part rule in one check, but only AFTER tokenizing: "___"
    # is three characters and no tokens, so counting characters would not catch it.
    if len(pooled) < MIN_QUERY_TOKENS:
        return [], "strict"
    strict = [d for d in documents if all(_hits(t, d) for t in pooled)]
    if strict or not query.product_tokens:
        return strict, "strict"
    tolerant = [
        d for d in documents
        if all(_hits(t, d) for t in query.batch_tokens)
        and all(_hits_tolerant(t, d) for t in query.product_tokens)
    ]
    return tolerant, "tolerant"


def _matches(documents: Sequence[CoaDocument], query: Any) -> List[CoaDocument]:
    """Every document this query identifies — strict first, tolerant only on a
    strict miss (coa-split-lookup-fields-plan §5).

    Module-private, and that is the point. The NUMBER of matches is exactly the fact
    C3 withholds from the visitor — "16 certificates matched" tells someone probing
    that acetone exists and that they are close — so it must not leave this module.
    Only :func:`resolve` sees it, and only to decide whether a re-walk could help.
    """
    docs, _pass = _matches_by_pass(documents, query)
    return docs


def lookup(documents: Sequence[CoaDocument], query: Any) -> Optional[CoaDocument]:
    """The one certificate this query identifies, or ``None`` (§4 step 5).

    Replaces the ranked ``search()`` the finder shipped with. Ranking went with it:
    ranking only means something when the caller may show more than one row, and
    showing more than one row is what turned this feature into a browsable index of
    the client's production history.

    ``None`` covers three different situations deliberately — nothing matched, several
    matched, and the query was too short to be matched at all. The caller cannot tell
    them apart because the visitor must not be able to either (C3): a refusal that
    varies is an oracle telling a guesser when they are warm.

    Still the ONE resolver. The panel endpoint and the ``get_coa`` agent tool both
    reach it through :func:`resolve`, so the conversational path and the panel can
    never disagree — the invariant ``_newest_https_row`` establishes for SDS.

    ``query`` accepts either a :class:`CoaQuery` (the two-field callers) or
    anything :func:`CoaQuery.from_raw` can wrap (the legacy single-box callers) —
    :func:`_matches` does the coercion.
    """
    matches = _matches(documents, query)
    return matches[0] if len(matches) == 1 else None


# ──────────────────────────────── I/O: walk ─────────────────────────────────

@dataclass(frozen=True)
class WalkResult:
    """One recursive walk. The counters are what Test Connection reports.

    ``files_seen`` counts every file Drive returned and ``ignored_non_pdf`` the ones
    dropped, so "connected, 0 files" is distinguishable from "connected, N files" —
    H2's requirement, because a Shared Drive folder read without the ``allDrives``
    flags returns zero files with HTTP 200 and looks exactly like an empty folder.

    The Phase 4 fields all record something that happened DURING the walk and is
    unrecoverable from ``documents`` afterwards: ``unindexable`` counts PDFs dropped
    before they became documents, and the duplicate figures describe what
    :func:`dedupe` collapsed — a deduped listing has no duplicates left to count.
    """

    documents: Tuple[CoaDocument, ...]
    folders_visited: int
    files_seen: int
    ignored_non_pdf: int
    capped: Tuple[str, ...]
    unindexable: int = 0
    duplicates_collapsed: int = 0
    duplicate_samples: Tuple[Tuple[str, int], ...] = ()
    walked_at: str = ""

    @property
    def indexed(self) -> int:
        return len(self.documents)


def drive_api_key() -> str:
    """The platform-wide Drive key. Blank = the COA lookup is off everywhere."""
    return (os.getenv("GOOGLE_DRIVE_API_KEY") or "").strip()


def _list_params(folder_id: str, api_key: str, page_token: str = "") -> Dict[str, Any]:
    """Query parameters for one ``files.list`` page.

    Split out as a pure function so the H2 and H7 requirements — both of which fail
    SILENTLY and look like an empty or broken folder rather than an error — can be
    asserted directly instead of through a mocked response.
    """
    params: Dict[str, Any] = {
        # H1 — the folder ID is interpolated into a quoted string, so an apostrophe
        # would break out and rewrite the query. `walk_folder` re-validates against
        # COA_FOLDER_ID_RE before we ever get here; this is the second gate.
        "q": f"'{folder_id}' in parents and trashed = false",
        "fields": DRIVE_FIELDS,
        # H2 — both flags, always. Without them a folder that lives in a Google
        # Shared Drive returns zero files and no error, and the bot then says "no
        # certificates on file" forever while nothing looks broken.
        "supportsAllDrives": "true",
        "includeItemsFromAllDrives": "true",
        "pageSize": PAGE_SIZE,
        "key": api_key,
    }
    if page_token:
        params["pageToken"] = page_token
    return params


def _classify(entry: Dict[str, Any]) -> Tuple[str, Dict[str, Any]]:
    """One Drive entry → ``("folder"|"file"|"skip", entry)``, shortcuts resolved.

    A shortcut is rewritten into whatever it points at, so a folder of aliases walks
    exactly like a folder of originals; an unresolvable one is skipped rather than
    guessed at.
    """
    mime = str(entry.get("mimeType") or "")
    if mime == SHORTCUT_MIME:
        details = entry.get("shortcutDetails")
        if not isinstance(details, dict):
            return "skip", entry
        target_id = str(details.get("targetId") or "").strip()
        target_mime = str(details.get("targetMimeType") or "")
        if not target_id:
            return "skip", entry
        entry = {**entry, "id": target_id, "mimeType": target_mime}
        mime = target_mime
    if mime == FOLDER_MIME:
        return "folder", entry
    return "file", entry


def _error_reasons(response: httpx.Response) -> Tuple[str, ...]:
    """The ``error.errors[].reason`` codes from a Drive error body, lowercased.

    Used ONLY to classify retryability. The body is never logged and never reaches a
    response: a Drive error message can contain the request URL, and the URL carries
    the API key (H3).
    """
    try:
        payload = response.json()
    except ValueError:
        return ()
    if not isinstance(payload, dict):
        return ()
    error = payload.get("error")
    if not isinstance(error, dict):
        return ()
    out: List[str] = []
    status = error.get("status")
    if isinstance(status, str):
        out.append(status.strip().lower())
    errors = error.get("errors")
    if isinstance(errors, list):
        for item in errors:
            if isinstance(item, dict) and isinstance(item.get("reason"), str):
                out.append(item["reason"].strip().lower())
    return tuple(out)


def classify_status(response: httpx.Response) -> CoaDriveError:
    """One non-200 Drive response → the error to raise (H15).

    The split that matters is inside 403. ``userRateLimitExceeded`` and a folder whose
    sharing was revoked are both 403s, and they need opposite handling: the first is
    worth retrying and must never surface as "no certificate exists", the second is
    permanent and the owner has to go fix the share.
    """
    code = response.status_code
    if code == 404:
        return CoaDriveError("not_found")
    if code == 403 and any(reason in _RATE_LIMIT_REASONS for reason in _error_reasons(response)):
        return CoaDriveError("rate_limited", retryable=True)
    if code in (401, 403):
        return CoaDriveError("forbidden")
    if code in RETRYABLE_STATUSES:
        return CoaDriveError("unavailable", retryable=True)
    return CoaDriveError("unavailable")


def backoff_delay(attempt: int, jitter: float = 1.0) -> float:
    """Exponential backoff for ``attempt`` (1-based), capped and jittered.

    ``jitter`` is a 0-1 draw, injected so the arithmetic is testable. It scales the
    delay into [50%, 100%] of the exponential step: the walk lists 8 folders
    concurrently, so an un-jittered backoff would have all 8 retry in the same
    millisecond and re-create the burst that got them rate-limited.
    """
    step = min(RETRY_MAX_DELAY_SECONDS, RETRY_BASE_DELAY_SECONDS * (2 ** max(0, attempt - 1)))
    return step * (0.5 + 0.5 * min(1.0, max(0.0, jitter)))


async def _backoff(attempt: int) -> None:
    await asyncio.sleep(backoff_delay(attempt, random.random()))


async def _fetch_page(
    folder_id: str,
    api_key: str,
    client: httpx.AsyncClient,
    semaphore: asyncio.Semaphore,
    page_token: str,
) -> Dict[str, Any]:
    """One ``files.list`` page, retried with backoff on a transient failure (H15).

    The semaphore is taken per ATTEMPT, not around the retry loop, so a request
    sleeping between attempts gives its concurrency slot back instead of holding one
    of the eight open while doing nothing.
    """
    for attempt in range(1, MAX_DRIVE_ATTEMPTS + 1):
        try:
            return await _attempt_page(folder_id, api_key, client, semaphore, page_token)
        except CoaDriveError as exc:
            if not exc.retryable or attempt == MAX_DRIVE_ATTEMPTS:
                raise
            logger.warning(
                "COA walk: retrying after a transient Drive failure (%s, attempt %s/%s)",
                exc.reason, attempt, MAX_DRIVE_ATTEMPTS)
            await _backoff(attempt)
    raise CoaDriveError("unavailable")  # unreachable; the loop always returns or raises


async def _attempt_page(
    folder_id: str,
    api_key: str,
    client: httpx.AsyncClient,
    semaphore: asyncio.Semaphore,
    page_token: str,
) -> Dict[str, Any]:
    async with semaphore:
        try:
            response = await client.get(
                DRIVE_FILES_ENDPOINT, params=_list_params(folder_id, api_key, page_token)
            )
        except httpx.HTTPError as exc:
            # A timeout or a reset connection is the most retryable failure there is.
            logger.warning("COA walk: Drive request failed (%s)", scrub(exc))
            raise CoaDriveError("unreachable", retryable=True) from None

    if response.status_code != 200:
        error = classify_status(response)
        logger.warning("COA walk: Drive returned HTTP %s (%s)", response.status_code, error.reason)
        raise error

    try:
        payload = response.json()
    except ValueError:
        raise CoaDriveError("unavailable") from None
    return payload if isinstance(payload, dict) else {}


async def _list_folder(
    folder_id: str,
    api_key: str,
    client: httpx.AsyncClient,
    semaphore: asyncio.Semaphore,
) -> List[Dict[str, Any]]:
    """Every entry directly inside one folder, following pagination."""
    entries: List[Dict[str, Any]] = []
    page_token = ""
    # H14 — a repeating or malformed nextPageToken spins forever, so pages are
    # capped as well as compared against the previous token.
    for _ in range(MAX_PAGES_PER_FOLDER):
        payload = await _fetch_page(folder_id, api_key, client, semaphore, page_token)
        entries.extend(e for e in (payload.get("files") or []) if isinstance(e, dict))
        next_token = str(payload.get("nextPageToken") or "")
        if not next_token or next_token == page_token:
            break
        page_token = next_token
    return entries


async def walk_folder(
    folder_id: str,
    api_key: str = "",
    *,
    client: Optional[httpx.AsyncClient] = None,
) -> WalkResult:
    """Recursively index every PDF under ``folder_id`` (§6 step 2).

    Drive has no recursive query, so this is one ``files.list`` per folder, fanned
    out a level at a time under a concurrency bound. The observed client folder
    (root + 7 month folders) is 8 calls in roughly half a second.

    The folder path is never read for meaning (F3) — a batch year that disagrees with
    the folder it sits in is not a problem, because only filenames are indexed.

    Raises :class:`CoaDriveError` when Drive cannot be reached; callers degrade to
    "we couldn't reach the document library" plus a handoff, never a 500.
    """
    folder_id = (folder_id or "").strip()
    # H1 read-time gate. Phase 0 validates on save, but a row hand-edited around the
    # API must not reach the Drive query either — and this is the SSRF guard too: we
    # only ever construct the googleapis.com URL ourselves.
    if not COA_FOLDER_ID_RE.match(folder_id):
        raise CoaDriveError("invalid_folder")
    api_key = (api_key or "").strip() or drive_api_key()
    if not api_key:
        raise CoaDriveError("not_configured")

    owns_client = client is None
    client = client or httpx.AsyncClient(timeout=HTTP_TIMEOUT)
    try:
        return await _walk(folder_id, api_key, client)
    finally:
        if owns_client:
            await client.aclose()


async def _walk(folder_id: str, api_key: str, client: httpx.AsyncClient) -> WalkResult:
    semaphore = asyncio.Semaphore(WALK_CONCURRENCY)
    # H4 — a Drive shortcut can point at an ancestor folder, so recursive descent
    # loops. The depth cap alone does not prevent combinatorial blowup within the
    # cap; the visited-set does, and guarantees each folder is listed exactly once.
    visited = {folder_id}
    frontier = [folder_id]
    depth = 0

    documents: List[CoaDocument] = []
    files_seen = 0
    ignored_non_pdf = 0
    unindexable = 0
    capped: List[str] = []

    while frontier:
        if depth > MAX_DEPTH:
            capped.append("depth")
            break

        pages = await asyncio.gather(
            *(_list_folder(fid, api_key, client, semaphore) for fid in frontier)
        )

        next_frontier: List[str] = []
        for entries in pages:
            for raw in entries:
                kind, entry = _classify(raw)
                if kind == "skip":
                    continue
                if kind == "folder":
                    child = str(entry.get("id") or "").strip()
                    if not child or child in visited:
                        continue
                    if len(visited) >= MAX_FOLDERS:
                        if "folders" not in capped:
                            capped.append("folders")
                        continue
                    visited.add(child)
                    next_frontier.append(child)
                    continue

                files_seen += 1
                if files_seen > MAX_FILES:
                    if "files" not in capped:
                        capped.append("files")
                    continue
                if not is_pdf(entry):
                    ignored_non_pdf += 1
                    continue
                doc = build_document(entry)
                if doc is None:
                    # A PDF that cannot be served or cannot be tokenized — no link,
                    # or a name like `___.pdf`. Dropped as before, but counted now:
                    # silently vanishing files are the one thing an owner staring at
                    # a short count has no way to explain.
                    unindexable += 1
                    continue
                documents.append(doc)

        frontier = next_frontier
        depth += 1

    if capped:
        logger.warning("COA walk hit guard rails: %s", ", ".join(capped))

    # Computed before dedupe, because dedupe is what destroys the evidence (H16).
    duplicates_collapsed, duplicate_samples = duplicate_summary(documents)

    return WalkResult(
        documents=tuple(dedupe(documents)),
        folders_visited=len(visited),
        files_seen=files_seen,
        ignored_non_pdf=ignored_non_pdf,
        capped=tuple(capped),
        unindexable=unindexable,
        duplicates_collapsed=duplicates_collapsed,
        duplicate_samples=duplicate_samples,
        walked_at=datetime.now(timezone.utc).isoformat(timespec="seconds"),
    )


# ─────────────────────────────── I/O: cache ─────────────────────────────────

# D9 — the miss-refresh path (§6 step 5) is what removes staleness, so the TTL only
# has to bound how long a DELETED file keeps showing up. It governs the in-process
# memo as well, so the two tiers can never disagree about how old is too old.
CACHE_TTL_SECONDS = 600

# Bump when the cached shape changes; a mismatched version is treated as a miss
# rather than migrated, so a deploy can never read a stale shape. Version 2 added
# the Phase 4 walk diagnostics, which cannot be recomputed from a deduped listing —
# reading a v1 entry would report zero duplicates for a folder full of them.
CACHE_VERSION = 2


def cache_key(company_id: Any, folder_id: str) -> str:
    """``coa:folder:{company_id}:{folder_id}`` (D9).

    The folder ID is IN the key on purpose: re-pointing the dashboard at a different
    folder changes the key, which abandons the old listing instantly and for free —
    no invalidation step to forget.
    """
    return f"coa:folder:{company_id}:{folder_id}"


def serialize_index(result: WalkResult) -> str:
    """A walk → its JSON form. :func:`encode_index` compresses this for Redis.

    Only the RAW Drive fields are stored, never the derived tokens or display string,
    so a change to the tokenizer takes effect on the very next read instead of being
    frozen into every cache entry for up to ten minutes.
    """
    return json.dumps(
        {
            "v": CACHE_VERSION,
            "folders_visited": result.folders_visited,
            "files_seen": result.files_seen,
            "ignored_non_pdf": result.ignored_non_pdf,
            "capped": list(result.capped),
            "unindexable": result.unindexable,
            "duplicates_collapsed": result.duplicates_collapsed,
            "duplicate_samples": [[n, c] for n, c in result.duplicate_samples],
            "walked_at": result.walked_at,
            "files": [
                {
                    "id": d.file_id,
                    "name": d.name,
                    "modifiedTime": d.modified_time,
                    "webViewLink": d.web_view_link,
                }
                for d in result.documents
            ],
        },
        separators=(",", ":"),
    )


# Filenames repeat themselves heavily — "ACETONE USP-NF PH.EUR BP" recurs across
# hundreds of batches — so the listing compresses about 4.5x (measured: 421 KB →
# 93 KB for 1,781 real certificates, 242 → 54 bytes per document). Level 6 is
# zlib's default; the decompression it buys back costs ~1 ms against a parse that
# now happens once per TTL instead of once per search.
COMPRESS_LEVEL = 6

# zlib's own header, used to tell a compressed entry from a plain-JSON one written
# by an older deploy. Overlapping deploys must not read each other's writes as junk.
_ZLIB_MAGIC = b"\x78"


def encode_index(result: WalkResult) -> bytes:
    """A walk → the compressed bytes held in Redis."""
    return zlib.compress(serialize_index(result).encode("utf-8"), COMPRESS_LEVEL)


def decode_payload(raw: Any) -> Any:
    """Redis bytes → the JSON text :func:`deserialize_index` expects.

    Accepts an uncompressed entry unchanged so a deploy rolling out mid-TTL can read
    what the previous version wrote, and returns anything undecodable untouched —
    :func:`deserialize_index` turns it into a miss, which is the correct outcome for
    a corrupt entry either way.
    """
    if not isinstance(raw, (bytes, bytearray)):
        return raw
    if not raw[:1] == _ZLIB_MAGIC:
        return raw
    try:
        return zlib.decompress(bytes(raw)).decode("utf-8", "replace")
    except zlib.error:
        return raw


def _as_int(value: Any) -> int:
    try:
        return max(0, int(value))
    except (TypeError, ValueError):
        return 0


def _as_duplicate_samples(raw: Any) -> Tuple[Tuple[str, int], ...]:
    """A cached ``[[name, copies], …]`` → the tuple form, junk entries dropped."""
    if not isinstance(raw, list):
        return ()
    out: List[Tuple[str, int]] = []
    for item in raw[:MAX_DUPLICATE_SAMPLES]:
        if not isinstance(item, (list, tuple)) or len(item) != 2:
            continue
        name = str(item[0])[:MAX_NAME_LEN]
        copies = _as_int(item[1])
        if name and copies > 1:
            out.append((name, copies))
    return tuple(out)


def deserialize_index(raw: Any) -> Optional[WalkResult]:
    """Redis bytes → a :class:`WalkResult`, or ``None`` for anything unusable.

    Every failure mode is a cache MISS, never an exception: a truncated value, a
    version bump, or somebody else's key must cost one extra walk, not a 500.
    """
    if isinstance(raw, (bytes, bytearray)):
        raw = raw.decode("utf-8", "replace")
    if not isinstance(raw, str) or not raw.strip():
        return None
    try:
        payload = json.loads(raw)
    except ValueError:
        return None
    if not isinstance(payload, dict) or payload.get("v") != CACHE_VERSION:
        return None

    entries = payload.get("files")
    if not isinstance(entries, list):
        return None
    documents = [build_document(e) for e in entries if isinstance(e, dict)]
    capped = payload.get("capped")
    return WalkResult(
        documents=tuple(d for d in documents if d is not None),
        folders_visited=_as_int(payload.get("folders_visited")),
        files_seen=_as_int(payload.get("files_seen")),
        ignored_non_pdf=_as_int(payload.get("ignored_non_pdf")),
        capped=tuple(str(c) for c in capped) if isinstance(capped, list) else (),
        unindexable=_as_int(payload.get("unindexable")),
        duplicates_collapsed=_as_int(payload.get("duplicates_collapsed")),
        duplicate_samples=_as_duplicate_samples(payload.get("duplicate_samples")),
        walked_at=str(payload.get("walked_at") or ""),
    )


async def _cache_get(redis_client: Any, key: str) -> Optional[WalkResult]:
    """H13 — a Redis outage degrades to walking: slower, still correct, never a 500."""
    if redis_client is None:
        return None
    try:
        return deserialize_index(decode_payload(await redis_client.get(key)))
    except Exception as exc:
        logger.warning("COA cache read failed (%s)", scrub(exc))
        return None


async def _cache_put(redis_client: Any, key: str, result: WalkResult) -> None:
    if redis_client is None:
        return
    try:
        await redis_client.setex(key, CACHE_TTL_SECONDS, encode_index(result))
    except Exception as exc:
        logger.warning("COA cache write failed (%s)", scrub(exc))


# ─────────────────────────── I/O: in-process memo ───────────────────────────

# Rebuilding every CoaDocument from JSON costs ~38 ms for 1,781 real certificates —
# three to five times the search it feeds (7-14 ms) — and it was happening on EVERY
# request, because Redis stores text and the parse is not free. The memo holds the
# already-parsed listing, so a warm worker searches without touching Redis or JSON
# at all, and Redis is demoted to what it is good at: surviving a restart and
# sharing one walk across workers.
#
# WalkResult and CoaDocument are frozen and hold only tuples, so a memoized listing
# cannot be mutated by a caller — the entry is safe to hand out repeatedly.
INDEX_MEMO_MAX_ENTRIES = 8
_index_memo: "OrderedDict[str, Tuple[float, WalkResult]]" = OrderedDict()


def reset_index_memo() -> None:
    """Drop every memoized listing. For tests and for a folder re-point."""
    _index_memo.clear()


def _memo_get(key: str, now: Optional[float] = None) -> Optional[WalkResult]:
    entry = _index_memo.get(key)
    if entry is None:
        return None
    expires_at, result = entry
    if (time.monotonic() if now is None else now) >= expires_at:
        _index_memo.pop(key, None)
        return None
    _index_memo.move_to_end(key)
    return result


def _memo_put(key: str, result: WalkResult, now: Optional[float] = None) -> None:
    now = time.monotonic() if now is None else now
    _index_memo[key] = (now + CACHE_TTL_SECONDS, result)
    _index_memo.move_to_end(key)
    # Bounded so a fleet of chemical tenants cannot grow this without limit: one
    # real listing is ~2 MB of parsed objects, so 8 entries is ~16 MB worst case.
    while len(_index_memo) > INDEX_MEMO_MAX_ENTRIES:
        _index_memo.popitem(last=False)


# ───────────────────────── I/O: circuit breaker (H15) ─────────────────────────

# The failure the retry layer above does NOT fix. With Drive unreachable, nothing
# ever lands in the cache, so *every* search walks and every walk burns the full
# timeout budget — the caches only protect the healthy path. One dead folder would
# therefore hold a worker for ~10s per visitor message, indefinitely. The breaker is
# what makes a sustained outage cheap: after a few failures it fast-fails that
# company for a cooldown, then lets one probe test recovery.
#
# Per company, so one tenant's revoked share cannot slow anyone else down. In-process
# like the memo, so each worker learns independently — acceptable for the same reason.
COA_BREAKER_CONFIG = BreakerConfig(
    failure_threshold=3,
    reset_timeout_seconds=60.0,
    success_threshold=1,
    half_open_max_probes=1,
)
_breakers = BreakerRegistry(COA_BREAKER_CONFIG)


def reset_breakers() -> None:
    """Drop every breaker. For tests, and for a folder re-point."""
    global _breakers
    _breakers = BreakerRegistry(COA_BREAKER_CONFIG)


def breaker_state(company_id: Any) -> str:
    return _breakers.state_of(str(company_id)).value


async def load_index(
    company_id: Any,
    folder_id: str,
    *,
    redis_client: Any = None,
    api_key: str = "",
    client: Optional[httpx.AsyncClient] = None,
    force: bool = False,
    bypass_breaker: bool = False,
) -> Tuple[WalkResult, bool]:
    """The cached folder listing. Returns ``(result, from_cache)``.

    Three tiers, cheapest first: the in-process memo (already parsed), Redis
    (compressed text, shared across workers and surviving a restart), then Drive.
    ``from_cache`` is True for either cache, since both can be stale and both must
    therefore allow :func:`resolve`'s miss-triggered refresh.

    ``force=True`` skips both caches and re-walks — that is what makes a COA uploaded
    two minutes ago findable (§6 step 5) and why there is no cron job. H5 gates who
    may ask for that: see :func:`forced_walk_allowed`.

    ``bypass_breaker=True`` is for the owner's own Test Connection, which must reach
    Drive even while the breaker is open — the owner has usually just fixed the
    sharing setting and is clicking to find out whether it worked, and "still broken"
    from a fast-fail would be a lie. It still reports its outcome, and a success
    resets the breaker: an authoritative probe beats waiting out the cooldown.
    """
    key = cache_key(company_id, folder_id)
    if not force:
        memoized = _memo_get(key)
        if memoized is not None:
            return memoized, True
        cached = await _cache_get(redis_client, key)
        if cached is not None:
            _memo_put(key, cached)
            return cached, True

    breaker = _breakers.get(str(company_id))
    if not bypass_breaker:
        try:
            breaker.before_request()
        except BreakerOpen:
            # Deliberately the generic reason: to every caller this is "Drive is not
            # answering", which is exactly what it means.
            logger.warning("COA walk short-circuited for company %s (breaker open)", company_id)
            raise CoaDriveError("unavailable") from None

    try:
        result = await walk_folder(folder_id, api_key, client=client)
    except CoaDriveError as exc:
        # A folder ID that never passed validation, or a missing platform key, never
        # touched Drive — counting those would trip the breaker on a config mistake
        # and then hide the fix behind a cooldown.
        if exc.reason in ("invalid_folder", "not_configured"):
            breaker.on_ignore()
        else:
            breaker.on_failure()
        raise
    if bypass_breaker:
        _breakers.reset(str(company_id))
    else:
        breaker.on_success()

    # Memoized before the Redis write so a dead Redis still gets the benefit (H13):
    # the degradation becomes one walk per TTL per worker rather than one per request.
    _memo_put(key, result)
    await _cache_put(redis_client, key, result)
    return result, False


# ────────────────────── I/O: forced-walk single flight (H5) ──────────────────────

# Every miss re-walks (§6 step 5), which without a gate is a self-inflicted DoS: a
# visitor typing nonsense batch numbers, or any scanner, produces unlimited Drive
# walks, and concurrent misses each start their own.
#
# One Redis key does both jobs the plan asks for. It is claimed with SET NX before
# the walk and held for the whole cooldown, so concurrent misses across every worker
# see exactly one winner (the single flight) AND a later miss inside the window is
# refused (the cooldown). The two collapse into one key precisely because the
# cooldown is longer than a walk; a short-lived lock released on completion would let
# the next miss re-walk immediately, which is the thing being prevented.
#
# 60s is the plan's figure and now has a measurement behind it: a real walk is
# 1.4-1.7s, so the window is ~40x the work it protects.
FORCED_WALK_COOLDOWN_SECONDS = 60
_last_forced_walk: Dict[str, float] = {}


def forced_walk_key(company_id: Any) -> str:
    """Company-scoped, not folder-scoped: the point is to bound Drive traffic per
    tenant, and re-pointing the folder must not hand out a fresh allowance."""
    return f"coa:forced:{company_id}"


def _local_forced_walk_allowed(company_id: Any, now: float) -> bool:
    """The in-process half. Checks without committing, so a Redis refusal does not
    silently consume this worker's allowance too."""
    last = _last_forced_walk.get(str(company_id))
    return last is None or (now - last) >= FORCED_WALK_COOLDOWN_SECONDS


async def forced_walk_allowed(
    company_id: Any,
    redis_client: Any = None,
    *,
    now: Optional[float] = None,
) -> bool:
    """May this request force a re-walk? (H5)

    Two gates, and the cheap one first: an in-process timestamp answers most repeat
    offenders with no network call at all, and it is also the WHOLE gate when Redis is
    unavailable — a Redis outage must degrade to "one forced walk per worker per
    minute", never to "no limit at all" (H13's spirit applied to a throttle).
    """
    now = time.monotonic() if now is None else now
    if not _local_forced_walk_allowed(company_id, now):
        return False

    if redis_client is not None:
        try:
            acquired = await redis_client.set(
                forced_walk_key(company_id), b"1", nx=True, ex=FORCED_WALK_COOLDOWN_SECONDS)
        except Exception as exc:
            logger.warning("COA forced-walk gate unavailable (%s)", scrub(exc))
            acquired = True     # degrade to the in-process gate, which just passed
        if not acquired:
            return False

    _last_forced_walk[str(company_id)] = now
    return True


def reset_forced_walk_gate() -> None:
    """Drop the in-process half of the gate. For tests."""
    _last_forced_walk.clear()


async def resolve(
    company_id: Any,
    folder_id: str,
    query: Any,
    *,
    redis_client: Any = None,
    api_key: str = "",
    client: Optional[httpx.AsyncClient] = None,
) -> Optional[CoaDocument]:
    """The certificate a company's visitor has identified, or ``None`` (§4).

    **The one resolver.** Both the widget panel endpoint and the ``get_coa`` agent
    tool call this, so the conversational path and the panel can never disagree —
    the invariant ``_newest_https_row`` establishes for SDS.

    A miss against a CACHED listing triggers one forced re-walk (§6 step 5), which is
    what makes a COA uploaded two minutes ago findable and why there is no cron job.
    A miss against a listing we just walked is not retried — the file genuinely is
    not there — and that alone removes most of the stampede H5 describes; the Redis
    gate below closes the rest of it, across workers.

    Beyond the gate a miss simply answers from cache, and the caller hands off. That
    is the correct outcome and not a degradation: the visitor's batch is almost never
    a file uploaded in the last sixty seconds.

    ``query`` accepts a :class:`CoaQuery` from the two-field callers, or a plain
    value (the legacy ``q=`` string) that :func:`_matches` coerces via
    :func:`CoaQuery.from_raw` — see coa-split-lookup-fields-plan §5.2.
    """
    doc, _shape = await resolve_with_shape(
        company_id, folder_id, query, redis_client=redis_client, api_key=api_key, client=client)
    return doc


def _one(docs: List[CoaDocument], pass_name: str) -> Tuple[Optional[CoaDocument], str]:
    """Collapse a match list to the single-document contract (§4 step 5) plus its
    shape: the pass that released it, or ``"refused"`` for zero or many."""
    return (docs[0], pass_name) if len(docs) == 1 else (None, "refused")


async def resolve_with_shape(
    company_id: Any,
    folder_id: str,
    query: Any,
    *,
    redis_client: Any = None,
    api_key: str = "",
    client: Optional[httpx.AsyncClient] = None,
) -> Tuple[Optional[CoaDocument], str]:
    """Same resolution as :func:`resolve`, plus WHICH PASS released it — ``"strict"``,
    ``"tolerant"``, or ``"refused"`` (coa-split-lookup-fields-plan Phase 5, §7).

    This is the only new surface Phase 5 needed: the shape falls out of matching that
    already happens, not a second walk or a second query. :func:`resolve` is a thin
    wrapper over this that drops the shape, so every existing caller and test keeps
    its single-value contract; the widget endpoint and the ``get_coa`` tool call this
    instead so their shape-only analytics rows describe the SAME resolution the
    visitor actually experienced.
    """
    result, from_cache = await load_index(
        company_id, folder_id, redis_client=redis_client, api_key=api_key, client=client)
    docs, pass_name = _matches_by_pass(result.documents, query)
    # Only a query that matched NOTHING can be helped by walking again. An ambiguous
    # query has already found its documents — a re-walk returns the same ones and
    # refuses again — so testing "did we release a certificate" here instead of "did
    # anything match" would spend a Drive walk on every `acetone` a visitor types.
    if docs or not from_cache:
        return _one(docs, pass_name)

    if not await forced_walk_allowed(company_id, redis_client):
        return None, "refused"

    refreshed, _ = await load_index(
        company_id, folder_id, redis_client=redis_client, api_key=api_key,
        client=client, force=True)
    docs, pass_name = _matches_by_pass(refreshed.documents, query)
    return _one(docs, pass_name)


def folder_report(result: WalkResult) -> Dict[str, Any]:
    """The owner's view of their certificate library (Phase 4, §9).

    Same spirit as the near-miss warnings ``catalog_import`` gives for a catalog
    upload: the search itself is fine, and what the owner cannot otherwise see is
    which of *their* files it will never be able to find. Three such blind spots:

    * ``unindexable`` and ``ignored_non_pdf`` — files present in Drive that are not
      in the index at all, which is the only honest explanation for a short count.
    * ``duplicates`` — the safety net for D6/H16. Collapsing identical filenames is
      an assumption about this client, not a law, and a client filing per-customer
      subfolders with repeated names would silently lose documents. We do not guess
      here; we show the owner and let them tell us it is wrong.
    * ``hard_to_find`` — a one-token filename is only findable by typing that token
      exactly (§11's filename-quality ceiling). Nothing can fix it but a rename.

    Every list is a bounded sample. This payload is owner-facing and authenticated,
    so it may carry filenames — H10 bars raw filenames from *model observations*,
    which is a different path.
    """
    thin = thin_documents(result.documents)
    return {
        "indexed": result.indexed,
        "folders": result.folders_visited,
        "files_seen": result.files_seen,
        "ignored_non_pdf": result.ignored_non_pdf,
        "unindexable": result.unindexable,
        "duplicates_collapsed": result.duplicates_collapsed,
        "duplicate_samples": [{"name": n, "copies": c} for n, c in result.duplicate_samples],
        "hard_to_find": len(thin),
        "hard_to_find_samples": [d.display for d in thin[:MAX_THIN_SAMPLES]],
        "capped": list(result.capped),
        "walked_at": result.walked_at or None,
    }


def to_payload(doc: CoaDocument) -> Dict[str, Any]:
    """One result row for the panel.

    ``display`` is the cleaned-up filename (§7) and is the ONLY text shown; there are
    no labelled code/batch fields because nothing here was ever parsed into them.
    """
    return {
        "id": doc.file_id,
        "display": doc.display,
        "modified_at": doc.modified_time or None,
        "view_url": doc.web_view_link,
        "download_url": doc.download_url,
    }
