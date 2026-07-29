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
import re
import time
import unicodedata
import zlib
from collections import OrderedDict
from dataclasses import dataclass
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple

import httpx

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

# H10 — a filename is attacker-controlled by anyone who can write to the Drive
# folder, so it is capped on ingest before it can reach a log or an observation.
MAX_NAME_LEN = 300

# §7 constraints: a 2-character floor (otherwise "1" returns the folder) and a
# result cap that drives the "keep typing to narrow" hint.
MIN_QUERY_CHARS = 2
MAX_RESULTS = 50

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

# Match strength, strongest first (§7 "exact token > prefix > substring").
MATCH_EXACT = 4
MATCH_PREFIX = 3
MATCH_SUBSTRING = 2
MATCH_NUMERIC = 1


class CoaDriveError(Exception):
    """Drive could not be reached, or refused us.

    Carries a short machine-readable ``reason`` and never any Drive response text,
    folder ID, or URL — a 403 must not be able to smuggle the API key (H3) or the
    folder ID (H11) into a widget response, a log line, or a Slack handoff.
    """

    def __init__(self, reason: str):
        super().__init__(reason)
        self.reason = reason


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
    """Filenames seen more than once, for the owner panel (H16, Phase 4)."""
    counts: Dict[str, int] = {}
    for doc in documents:
        counts[doc.name] = counts.get(doc.name, 0) + 1
    return {name: n for name, n in counts.items() if n > 1}


# ─────────────────────────────── pure: search ───────────────────────────────

def _token_score(query_token: str, tokens: Sequence[str], numeric_tokens: Sequence[str]) -> int:
    """How strongly one query token hits a file, 0 for not at all.

    Ordered strongest-first so an exact hit anywhere beats a prefix hit anywhere,
    which is what makes `100RG` rank its own certificates above `100RGX`'s.
    """
    if query_token in tokens:
        return MATCH_EXACT
    if any(t.startswith(query_token) for t in tokens):
        return MATCH_PREFIX
    if any(query_token in t for t in tokens):
        return MATCH_SUBSTRING
    if numeric_key(query_token) in numeric_tokens:
        return MATCH_NUMERIC
    return 0


def search(
    documents: Sequence[CoaDocument],
    query: Any,
    limit: Optional[int] = None,
) -> Tuple[List[CoaDocument], bool]:
    """Rank certificates against a free-text query. Returns ``(results, truncated)``.

    Two passes (§7). **Strict**: every query token must hit something, which is what
    makes ``acetone LR`` mean acetone AND LR. **Fallback**, only when strict found
    nothing: the documents that matched the MOST query tokens, so a typo or a filler
    word degrades into close suggestions instead of a dead end.

    The fallback used to admit anything matching at least one token, which made a
    single unmatched word catastrophic rather than harmless: a real visitor asking
    "I have a drum of acetone, batch 100.26R016" failed the strict pass on "drum" and
    "batch", and the fallback then returned the entire acetone catalogue — 50 rows
    capped, where the answer is 3. Keeping only the best-matching tier is what makes
    conversational phrasing behave like the clean query it contains.

    This is the ONE resolver — the panel endpoint and the ``get_coa`` agent tool both
    call it, so the conversational path and the picker can never disagree about which
    certificate wins. That is the invariant ``_newest_https_row`` establishes for SDS.
    """
    query_tokens = tokenize(query)
    # H6 — "every query token must match" is VACUOUSLY TRUE for zero tokens, so a
    # query of "___" or "..." would return the entire folder. The 2-character floor
    # does not catch it either, because it counts characters and "___" is three. Both
    # checks therefore happen AFTER tokenizing.
    if not query_tokens or sum(len(t) for t in query_tokens) < MIN_QUERY_CHARS:
        return [], False

    strict: List[Tuple[int, int, CoaDocument, int]] = []
    loose: List[Tuple[int, int, CoaDocument, int]] = []
    for doc in documents:
        scores = [_token_score(t, doc.tokens, doc.numeric_tokens) for t in query_tokens]
        matched = sum(1 for s in scores if s)
        if not matched:
            continue
        entry = (matched, sum(scores), doc, max(scores))
        (strict if matched == len(query_tokens) else loose).append(entry)

    ranked = strict
    if not ranked and loose:
        # A substring-only hit is too weak to carry a fallback result on its own:
        # short filler words match half the corpus that way ("ME" inside "METHANOL"),
        # so "please send the chloroform certificate" returned 50 rows instead of
        # chloroform's 18. Require at least one token to have hit at prefix strength
        # or better, then keep only the documents that matched the MOST tokens.
        strong = [e for e in loose if e[3] >= MATCH_PREFIX]
        if strong:
            best = max(e[0] for e in strong)
            ranked = [e for e in strong if e[0] == best]

    # Three stable sorts, least significant first — the readable way to express
    # "matched count, then score, then newest, then file ID" when the recency key is
    # a string that sorts DESCENDING while everything after it sorts ascending.
    ranked.sort(key=lambda e: e[2].file_id)
    ranked.sort(key=lambda e: e[2].modified_time or "", reverse=True)
    ranked.sort(key=lambda e: (-e[0], -e[1]))

    # Resolved here rather than as a default argument, which would bind MAX_RESULTS
    # once at import and quietly ignore any later change to it.
    limit = max(1, MAX_RESULTS if limit is None else limit)
    return [e[2] for e in ranked[:limit]], len(ranked) > limit


# ──────────────────────────────── I/O: walk ─────────────────────────────────

@dataclass(frozen=True)
class WalkResult:
    """One recursive walk. The counters are what Test Connection reports.

    ``files_seen`` counts every file Drive returned and ``ignored_non_pdf`` the ones
    dropped, so "connected, 0 files" is distinguishable from "connected, N files" —
    H2's requirement, because a Shared Drive folder read without the ``allDrives``
    flags returns zero files with HTTP 200 and looks exactly like an empty folder.
    """

    documents: Tuple[CoaDocument, ...]
    folders_visited: int
    files_seen: int
    ignored_non_pdf: int
    capped: Tuple[str, ...]

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
        async with semaphore:
            try:
                response = await client.get(
                    DRIVE_FILES_ENDPOINT, params=_list_params(folder_id, api_key, page_token)
                )
            except httpx.HTTPError as exc:
                logger.warning("COA walk: Drive request failed (%s)", scrub(exc))
                raise CoaDriveError("unreachable") from None

        if response.status_code == 404:
            raise CoaDriveError("not_found")
        if response.status_code in (401, 403):
            # H15 — `userRateLimitExceeded` and a revoked share both land here, and
            # neither means "no certificate exists". Retry-with-backoff is §13.1.
            logger.warning("COA walk: Drive refused the request (HTTP %s)", response.status_code)
            raise CoaDriveError("forbidden")
        if response.status_code != 200:
            logger.warning("COA walk: unexpected Drive status %s", response.status_code)
            raise CoaDriveError("unavailable")

        try:
            payload = response.json()
        except ValueError:
            raise CoaDriveError("unavailable") from None

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
                if doc is not None:
                    documents.append(doc)

        frontier = next_frontier
        depth += 1

    if capped:
        logger.warning("COA walk hit guard rails: %s", ", ".join(capped))

    return WalkResult(
        documents=tuple(dedupe(documents)),
        folders_visited=len(visited),
        files_seen=files_seen,
        ignored_non_pdf=ignored_non_pdf,
        capped=tuple(capped),
    )


# ─────────────────────────────── I/O: cache ─────────────────────────────────

# D9 — the miss-refresh path (§6 step 5) is what removes staleness, so the TTL only
# has to bound how long a DELETED file keeps showing up. It governs the in-process
# memo as well, so the two tiers can never disagree about how old is too old.
CACHE_TTL_SECONDS = 600

# Bump when the cached shape changes; a mismatched version is treated as a miss
# rather than migrated, so a deploy can never read a stale shape.
CACHE_VERSION = 1


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


async def load_index(
    company_id: Any,
    folder_id: str,
    *,
    redis_client: Any = None,
    api_key: str = "",
    client: Optional[httpx.AsyncClient] = None,
    force: bool = False,
) -> Tuple[WalkResult, bool]:
    """The cached folder listing. Returns ``(result, from_cache)``.

    Three tiers, cheapest first: the in-process memo (already parsed), Redis
    (compressed text, shared across workers and surviving a restart), then Drive.
    ``from_cache`` is True for either cache, since both can be stale and both must
    therefore allow :func:`resolve`'s miss-triggered refresh.

    ``force=True`` skips both caches and re-walks — that is what makes a COA uploaded
    two minutes ago findable (§6 step 5) and why there is no cron job. The forced
    path is also the self-inflicted-DoS risk H5 addresses, so callers must not wire
    it to an unauthenticated miss until the single-flight lock and cooldown land.
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

    result = await walk_folder(folder_id, api_key, client=client)
    # Memoized before the Redis write so a dead Redis still gets the benefit (H13):
    # the degradation becomes one walk per TTL per worker rather than one per request.
    _memo_put(key, result)
    await _cache_put(redis_client, key, result)
    return result, False


# Miss-refresh throttle. This is NOT H5 — H5 needs a Redis single-flight lock to be
# correct across workers, and is still owed (plan §13.1). This in-process cooldown
# is the cheap part of it: it bounds one worker's forced walks while that lands.
FORCED_WALK_COOLDOWN_SECONDS = 60
_last_forced_walk: Dict[str, float] = {}


def _forced_walk_allowed(company_id: Any, now: Optional[float] = None) -> bool:
    key = str(company_id)
    now = time.monotonic() if now is None else now
    last = _last_forced_walk.get(key)
    if last is not None and (now - last) < FORCED_WALK_COOLDOWN_SECONDS:
        return False
    _last_forced_walk[key] = now
    return True


async def resolve(
    company_id: Any,
    folder_id: str,
    query: Any,
    *,
    redis_client: Any = None,
    api_key: str = "",
    client: Optional[httpx.AsyncClient] = None,
    limit: Optional[int] = None,
) -> Tuple[List[CoaDocument], bool]:
    """Search a company's certificates. Returns ``(results, truncated)``.

    **The one resolver.** Both the widget panel endpoint and the ``get_coa`` agent
    tool call this, so the conversational path and the picker can never disagree —
    the invariant ``_newest_https_row`` establishes for SDS.

    A miss against a CACHED listing triggers one forced re-walk (§6 step 5), which is
    what makes a COA uploaded two minutes ago findable and why there is no cron job.
    A miss against a listing we just walked is not retried — the file genuinely is
    not there — and that alone removes most of the stampede H5 describes.
    """
    result, from_cache = await load_index(
        company_id, folder_id, redis_client=redis_client, api_key=api_key, client=client)
    results, truncated = search(result.documents, query, limit=limit)
    if results or not from_cache:
        return results, truncated

    if not _forced_walk_allowed(company_id):
        return results, truncated

    refreshed, _ = await load_index(
        company_id, folder_id, redis_client=redis_client, api_key=api_key,
        client=client, force=True)
    return search(refreshed.documents, query, limit=limit)


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
