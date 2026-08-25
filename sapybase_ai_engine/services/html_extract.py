"""Deterministic HTML -> markdown extraction for the "Train from URL" flow.

Jina Reader renders the page for us (``X-Return-Format: html``); this module owns
what survives into the knowledge base. Jina's own markdown mode runs a main-content
heuristic that drops footers, hours blocks, accordion FAQs, and sidebars - every one
of which is a fact an owner expects their bot to know.

The contract is the inverse: strip an explicit noise list we control, keep everything
else, and preserve structure (headings, lists, tables) because structure is what makes
a chunk retrievable.

Worst-case cost budget: parsing is O(n) over a body capped at MAX_HTML_BYTES (5 MB),
and runs inside the synchronous training handler after the Jina call has already spent
up to 3 attempts x 20 s plus backoff.
"""

from __future__ import annotations

import json
import re
from typing import Any, Callable, Iterable, NamedTuple, Optional
from urllib.parse import urldefrag, urljoin, urlparse

from bs4 import BeautifulSoup, NavigableString, Tag

MAX_HTML_BYTES = 5 * 1024 * 1024

# The only things we discard by default. Reviewable and tunable in one place -
# anything not named here reaches the knowledge base.
STRIP_TAGS = ("script", "style", "noscript", "svg", "iframe", "template", "canvas")

COOKIE_BANNER_SELECTORS = (
    "[id*='cookie' i]",
    "[class*='cookie' i]",
    "[id*='consent' i]",
    "[class*='consent' i]",
    "[aria-label*='cookie' i]",
    "[id*='gdpr' i]",
    "[class*='gdpr' i]",
    "[class*='onetrust' i]",
    "[id*='onetrust' i]",
)

# Theme testimonial and review blocks (plan §4, Slice I). These are dense with
# person names, so they are prime false matches for "who is ...?" and they compete
# with the real directory rows for the five reranked slots - measured on
# expresolv.com, where 12 of 76 homepage chunks are carousel testimonials.
#
# Matched as whole class/id *tokens*, never as substrings: `[class*='review']`
# would take `preview-box` and `product-preview` with it. Carousel vocabulary
# (swiper, slick, owl, carousel) is deliberately NOT here on its own - plenty of
# sites put real product content in a slider, and the observed damage is the
# testimonial content, not the carousel that holds it.
_NOISE_TOKENS = frozenset({
    "testimonial", "testimonials", "testi", "testimony",
    "review", "reviews", "reviewer",
    "clientsay", "clientsays", "clientfeedback", "customerfeedback",
})

# Where a token may appear. `id` and `class` only - never a text-bearing attribute.
_NOISE_ATTRS = ("class", "id")

# Never removed however they are named: emptying these takes the page with them.
_NOISE_PROTECTED = frozenset({"html", "body", "main"})

_TOKEN_SPLIT_RE = re.compile(r"[-_\s]+")

# Markup that survived as literal text - the page served it escaped, so no parser
# ever saw a tag. Observed in stored rows as `<span class="tp-testi__ava-position">`.
_LEAKED_TAG_RE = re.compile(r"</?[a-z][a-z0-9]*(?:\s[^<>]{0,200})?/?>", re.IGNORECASE)

# A line that is nothing but a CSS class name: one token, no spaces, and either a
# BEM `__` or a known layout suffix. Observed as `testimonial-area`,
# `breadcrumb-area`. Deliberately narrow - a real fact has a space in it.
_BARE_CLASS_RE = re.compile(
    r"^[a-z][a-z0-9]*(?:[-_]+[a-z0-9]+)*"
    r"(?:__[a-z0-9-]+|[-_](?:area|wrapper|wrap|inner|section|slider|carousel))$"
)
# `box` and `container` are absent on purpose: they are packaging vocabulary in the
# chemical vertical, and `carton-box` is a fact, not a class name.

# Nav fragments like "Home" or "›" are noise at any position; real facts are longer.
MIN_BLOCK_CHARS = 3

# JSON-LD in the wild nests arbitrarily; refuse to walk forever.
MAX_JSONLD_DEPTH = 12

# Malformed markup can nest thousands deep; Python's stack cannot.
MAX_DOM_DEPTH = 200

_HEADINGS = {"h1": "#", "h2": "##", "h3": "###", "h4": "####", "h5": "#####", "h6": "######"}
_BLOCK_TAGS = {
    "p", "div", "section", "article", "main", "header", "footer", "aside", "nav",
    "details", "summary", "blockquote", "figure", "figcaption", "address", "form",
    "label", "li", "dt", "dd", "tr", "br", "hr", "pre",
}

_WS_RE = re.compile(r"[ \t]+")
_BLANK_LINES_RE = re.compile(r"\n{3,}")
_DEDUP_NORMALISE_RE = re.compile(r"[^a-z0-9]+")

_JSONLD_SKIP_KEYS = {
    "@context", "@id", "image", "logo", "url", "sameAs", "potentialAction",
    # Slice I: publishing metadata and breadcrumb scaffolding. None of it answers a
    # visitor's question, and all of it is stored and billed per page.
    "dateModified", "datePublished", "inLanguage", "position", "breadcrumb",
    "isPartOf", "primaryImageOfPage", "thumbnailUrl", "wordCount",
}

# Our own loader publishes the bot's answers back onto the merchant's page as
# FAQPage schema; ingesting it would make the bot its own source (plan §1.4, F1).
_JSONLD_SKIP_TYPES = {"faqpage", "question", "answer"}

# Navigational scaffolding, not content (Slice I). Separate from the set above
# because that one exists for a different reason - F1's feedback loop - and the two
# must stay independently reviewable.
_JSONLD_NOISE_TYPES = {"breadcrumblist", "listitem"}

# `faqScript.dataset.sapybaseFaq = 'true'` in public/sapybase-loader@1.js:818.
_SAPYBASE_FAQ_ATTR = "data-sapybase-faq"

# Last-resort marker for renderers that drop data-* attributes.
_SOURCE_MARKER_RE = re.compile(r"📎\s*source\s*:", re.IGNORECASE)

# Marks the appended schema.org section, so callers can separate the site-wide
# structured block from page-specific body copy.
STRUCTURED_DATA_HEADING = "## Structured data"


def extract(html: str, base_url: str, seen_blocks: set[str] | None = None) -> str:
    """Turn rendered HTML into structured markdown.

    Returns an empty string when there is nothing worth storing; the caller is
    responsible for falling back to Jina's markdown in that case.

    ``seen_blocks`` carries dedup state *across* pages and is mutated in place.
    A crawl passes one set through every page so the nav and footer that repeat on
    all of them are stored once, not N times. Omit it for single-page extraction.
    """
    if not html:
        return ""
    if len(html) > MAX_HTML_BYTES:
        html = html[:MAX_HTML_BYTES]

    soup = BeautifulSoup(html, "lxml")

    for tag in soup(list(STRIP_TAGS)):
        # JSON-LD lives in a <script>, so lift it before the strip pass removes it.
        tag.decompose()

    jsonld_blocks = _collect_jsonld(BeautifulSoup(html, "lxml"), seen_blocks)

    for selector in COOKIE_BANNER_SELECTORS:
        try:
            for node in soup.select(selector):
                node.decompose()
        except Exception:
            continue

    _strip_noise_blocks(soup)

    root = soup.body or soup
    lines: list[str] = []
    _render(root, lines)

    body = _finalise(lines, seen_blocks)
    if jsonld_blocks:
        heading = STRUCTURED_DATA_HEADING
        joined = "\n".join(jsonld_blocks)
        body = f"{body}\n\n{heading}\n\n{joined}" if body else f"{heading}\n\n{joined}"

    return body.strip()


def _strip_noise_blocks(soup: BeautifulSoup) -> None:
    """Remove testimonial and review containers before anything is rendered.

    Runs on whole class/id tokens rather than a CSS substring selector, so
    ``preview-box`` survives and ``tp-testi__ava-position`` does not. ``_finalise``
    already dedups blocks repeated *across* pages, which cannot catch these: a
    testimonial carousel appears once, on the homepage (plan §4).
    """
    for node in soup.find_all(True):
        if node.name in _NOISE_PROTECTED or node.parent is None:
            continue
        if _is_noise_node(node):
            node.decompose()


def _is_noise_node(node: Tag) -> bool:
    for attr in _NOISE_ATTRS:
        value = node.get(attr)
        if not value:
            continue
        raw = " ".join(value) if isinstance(value, list) else str(value)
        for token in _TOKEN_SPLIT_RE.split(raw.lower()):
            if token in _NOISE_TOKENS:
                return True
    return False


def _render(node: Any, out: list[str], depth: int = 0) -> None:
    if depth > MAX_DOM_DEPTH:
        return
    if isinstance(node, NavigableString):
        text = _clean(str(node))
        if text:
            out.append(text)
        return
    if not isinstance(node, Tag):
        return

    name = node.name

    if name in _HEADINGS:
        text = _inline_text(node)
        if text:
            out.append(f"\n\n{_HEADINGS[name]} {text}\n\n")
        return

    if name == "table":
        rendered = _render_table(node)
        if rendered:
            out.append(f"\n\n{rendered}\n\n")
        return

    if name in ("ul", "ol"):
        out.append("\n\n")
        ordered = name == "ol"
        for index, item in enumerate(node.find_all("li", recursive=False), start=1):
            text = _inline_text(item)
            if text:
                marker = f"{index}." if ordered else "-"
                out.append(f"{marker} {text}\n")
        out.append("\n")
        return

    if name == "dl":
        out.append("\n\n")
        for child in node.find_all(["dt", "dd"], recursive=False):
            text = _inline_text(child)
            if not text:
                continue
            out.append(f"**{text}**\n" if child.name == "dt" else f"{text}\n\n")
        out.append("\n")
        return

    if name == "a":
        text = _inline_text(node)
        href = (node.get("href") or "").strip()
        # mailto:/tel: hold the fact itself; a bare anchor label would lose it.
        if href.lower().startswith(("mailto:", "tel:")):
            value = href.split(":", 1)[1]
            out.append(f"{text} ({value})" if text and value not in text else (text or value))
        elif text:
            out.append(text)
        return

    if name == "img":
        return  # chat has no image rendering; matches _strip_markdown_images

    if name == "br":
        out.append("\n")
        return

    if name == "hr":
        out.append("\n\n---\n\n")
        return

    is_block = name in _BLOCK_TAGS
    if is_block:
        out.append("\n\n")
    for child in node.children:
        _render(child, out, depth + 1)
    if is_block:
        out.append("\n\n")


def _render_table(table: Tag) -> str:
    rows: list[list[str]] = []
    for tr in table.find_all("tr"):
        cells = [_inline_text(cell) for cell in tr.find_all(["th", "td"])]
        if any(cells):
            rows.append(cells)
    if not rows:
        return ""

    width = max(len(row) for row in rows)
    rows = [row + [""] * (width - len(row)) for row in rows]
    header, *body = rows
    lines = ["| " + " | ".join(header) + " |", "| " + " | ".join(["---"] * width) + " |"]
    lines += ["| " + " | ".join(row) + " |" for row in body]
    return "\n".join(lines)


def _inline_text(node: Tag, depth: int = 0) -> str:
    """Flatten a node's *children* to one line.

    Rendering the node itself would re-enter the same dispatch branch that called
    us (a heading rendering its own heading, forever).
    """
    parts: list[str] = []
    for child in node.children:
        _render(child, parts, depth + 1)
    return _WS_RE.sub(" ", " ".join(parts).replace("\n", " ")).strip()


def _clean(text: str) -> str:
    # Markup that arrived escaped is text to the parser but noise to the index.
    # The pattern needs a letter straight after `<`, so "< 50" and "<5>" survive.
    text = _LEAKED_TAG_RE.sub(" ", text.replace("\xa0", " "))
    return _WS_RE.sub(" ", text).strip()


def _finalise(parts: Iterable[str], seen_blocks: set[str] | None = None) -> str:
    text = "".join(parts)
    text = "\n".join(_WS_RE.sub(" ", line).strip() for line in text.split("\n"))
    text = _BLANK_LINES_RE.sub("\n\n", text)

    # Boilerplate dedup: repeated nav/CTA blocks flood the index and burn the
    # tenant's word quota. Compare on alphanumerics only, so "+1 (555) 123-4567"
    # and "+15551234567" collapse to one fact.
    seen: set[str] = set() if seen_blocks is None else seen_blocks
    kept: list[str] = []
    for block in text.split("\n"):
        stripped = block.strip()
        if not stripped:
            kept.append("")
            continue
        if len(stripped) < MIN_BLOCK_CHARS:
            continue
        if _BARE_CLASS_RE.match(stripped):
            continue
        key = _DEDUP_NORMALISE_RE.sub("", stripped.lower())
        if not key:
            kept.append(stripped)  # markdown scaffolding (table rules, ---) carries no key
            continue
        if key in seen:
            continue
        seen.add(key)
        kept.append(stripped)

    return _BLANK_LINES_RE.sub("\n\n", "\n".join(kept)).strip()


def _collect_jsonld(soup: BeautifulSoup, seen_blocks: set[str] | None = None) -> list[str]:
    """Flatten schema.org blocks - the highest-signal data on most business sites,
    and invisible to any text extractor.

    Shares the caller's dedup set so a crawl does not store the same Organization
    block once per page - most sites emit an identical one site-wide.

    Three skips guard against re-ingesting our own published answers, in order of
    exactness: the loader's own attribute, the source-citation marker, and the
    Q&A schema types themselves.
    """
    lines: list[str] = []
    seen: set[str] = set() if seen_blocks is None else seen_blocks
    for script in soup.find_all("script", attrs={"type": re.compile(r"ld\+json", re.I)}):
        if script.has_attr(_SAPYBASE_FAQ_ATTR):
            continue
        raw = script.string or script.get_text() or ""
        if _SOURCE_MARKER_RE.search(raw):
            continue
        try:
            payload = json.loads(raw.strip())
        except Exception:
            continue  # malformed JSON-LD is common; never fail the document
        for entry in _walk_jsonld(payload, 0):
            if _is_qa_schema(entry) or _is_noise_schema(entry):
                continue
            for line in _flatten_entity(entry, 0):
                key = _DEDUP_NORMALISE_RE.sub("", line.lower())
                if key and key not in seen:
                    seen.add(key)
                    lines.append(line)
    return lines


def _is_qa_schema(entity: Any) -> bool:
    return _has_type(entity, _JSONLD_SKIP_TYPES)


def _is_noise_schema(entity: Any) -> bool:
    return _has_type(entity, _JSONLD_NOISE_TYPES)


def _has_type(entity: Any, types: set[str]) -> bool:
    if not isinstance(entity, dict):
        return False
    raw_type = entity.get("@type")
    declared = raw_type if isinstance(raw_type, list) else [raw_type]
    return any(str(t).strip().lower() in types for t in declared if t)


def _walk_jsonld(payload: Any, depth: int) -> list[dict]:
    if depth > MAX_JSONLD_DEPTH:
        return []
    if isinstance(payload, list):
        entries: list[dict] = []
        for item in payload:
            entries.extend(_walk_jsonld(item, depth + 1))
        return entries
    if isinstance(payload, dict):
        if "@graph" in payload:
            return _walk_jsonld(payload["@graph"], depth + 1)
        return [payload]
    return []


def _flatten_entity(entity: dict, depth: int) -> list[str]:
    if depth > MAX_JSONLD_DEPTH or not isinstance(entity, dict):
        return []

    lines: list[str] = []
    raw_type = entity.get("@type")
    if isinstance(raw_type, list):
        type_name = ", ".join(str(t) for t in raw_type)
    elif raw_type:
        type_name = str(raw_type)
    else:
        type_name = ""
    if type_name and depth == 0:
        lines.append(f"- {type_name}")

    for key, value in entity.items():
        if key in _JSONLD_SKIP_KEYS or key == "@type":
            continue
        rendered = _flatten_value(value, depth)
        for item in rendered:
            lines.append(f"{'  ' * (depth + 1)}- {key}: {item}" if not item.startswith("-") else item)
    return lines


def _flatten_value(value: Any, depth: int) -> list[str]:
    if depth > MAX_JSONLD_DEPTH:
        return []
    if isinstance(value, (str, int, float)):
        text = str(value).strip()
        return [text] if text else []
    if isinstance(value, bool):
        return [str(value)]
    if isinstance(value, list):
        out: list[str] = []
        for item in value:
            out.extend(_flatten_value(item, depth + 1))
        return out
    if isinstance(value, dict):
        if _is_qa_schema(value) or _is_noise_schema(value):
            return []
        parts: list[str] = []
        for key, inner in value.items():
            if key in _JSONLD_SKIP_KEYS or key == "@type":
                continue
            for rendered in _flatten_value(inner, depth + 1):
                parts.append(f"{key}: {rendered}")
        return [", ".join(parts)] if parts else []
    return []


# ── Phase 3: depth-1 link discovery ──────────────────────────────────────────

# Pages an owner expects the bot to know about, matched against the URL path and
# the anchor's own text. Intent-based, not vertical-specific: every business has
# a contact page, none of these encode a domain.
LINK_INTENT_PATTERNS = (
    r"contact",
    r"about",
    r"hours",
    r"location",
    r"branch",
    r"visit",
    r"reach[-_ ]?us",
    r"find[-_ ]?us",
    r"get[-_ ]?in[-_ ]?touch",
)

_LINK_INTENT_RE = re.compile("|".join(LINK_INTENT_PATTERNS), re.I)

# Bounds the checklist the owner sees. Sitemaps can list thousands of routes;
# capping keeps the picker usable and stops an accidental "train everything" from
# blowing a tenant's word quota in one click (full-site-discovery plan D2).
MAX_DISCOVERED_LINKS = 100

_NON_PAGE_SUFFIXES = (
    ".pdf", ".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".ico",
    ".zip", ".mp4", ".mp3", ".css", ".js", ".xml", ".rss",
)


class DiscoveredLink(NamedTuple):
    url: str
    label: str


def harvest_links(
    html: str,
    base_url: str,
    limit: int = MAX_DISCOVERED_LINKS,
    require_intent_match: bool = True,
) -> list[DiscoveredLink]:
    """Find depth-1, same-registrable-domain pages worth crawling.

    Returns at most ``limit`` links, deduped and in document order. The caller
    still owns SSRF validation of every URL returned here - these hrefs come from
    attacker-controlled markup and must not be fetched unchecked.

    ``require_intent_match`` keeps only links whose path or anchor text hits the
    intent list (contact/about/hours/...). Full-site discovery sets it False to
    surface every same-domain page when a sitemap is unavailable.
    """
    if not html:
        return []
    if len(html) > MAX_HTML_BYTES:
        html = html[:MAX_HTML_BYTES]

    try:
        soup = BeautifulSoup(html, "lxml")
    except Exception:
        return []

    base_host = _registrable_host(base_url)
    entry_key = _canonical(base_url)

    found: list[DiscoveredLink] = []
    seen: set[str] = {entry_key}

    for anchor in soup.find_all("a", href=True):
        href = (anchor.get("href") or "").strip()
        if not href or href.startswith(("#", "mailto:", "tel:", "javascript:", "data:")):
            continue

        absolute = urljoin(base_url, href)
        parsed = urlparse(absolute)
        if parsed.scheme not in ("http", "https"):
            continue
        if _registrable_host(absolute) != base_host:
            continue
        if parsed.path.lower().endswith(_NON_PAGE_SUFFIXES):
            continue

        label = _inline_text(anchor)
        if require_intent_match and not _LINK_INTENT_RE.search(parsed.path) and not _LINK_INTENT_RE.search(label):
            continue

        key = _canonical(absolute)
        if key in seen:
            continue
        seen.add(key)
        found.append(DiscoveredLink(url=urldefrag(absolute)[0], label=label or parsed.path))
        if len(found) >= limit:
            break

    return found


def _registrable_host(url: str) -> str:
    """Host without a leading ``www.``, so www and apex count as the same site."""
    host = (urlparse(url).hostname or "").lower()
    return host[4:] if host.startswith("www.") else host


def _canonical(url: str) -> str:
    """Dedup key: fragment dropped, trailing slash and www normalised."""
    parsed = urlparse(urldefrag(url)[0])
    path = parsed.path.rstrip("/") or "/"
    query = f"?{parsed.query}" if parsed.query else ""
    return f"{_registrable_host(url)}{path.lower()}{query}"


# ── Full-site route discovery: sitemap-first ─────────────────────────────────

# Well-known sitemap locations, tried in order.
SITEMAP_PATHS = ("/sitemap.xml", "/sitemap_index.xml")

# A <sitemapindex> chains to nested sitemap files; fetch at most this many so a
# huge index can't fan out into an unbounded number of HTTP requests.
MAX_NESTED_SITEMAPS = 5

# Hard ceiling on <loc> URLs read from a sitemap (before same-domain filtering),
# so a sitemap listing tens of thousands of URLs can't be held in memory whole.
MAX_SITEMAP_URLS = 5000

# Fetches a URL's text body, or returns None on any failure. Injected by the
# caller so it owns HTTP policy (timeout, SSRF) and this module stays testable.
SitemapFetcher = Callable[[str], "str | None"]


def parse_sitemap(xml: str) -> tuple[list[str], bool]:
    """Parse sitemap XML into ``(loc_urls, is_index)``.

    ``is_index`` is True for a ``<sitemapindex>`` (the ``loc``s point at nested
    sitemap files, not pages). Returns ``([], False)`` for empty or non-XML
    input so the caller falls back to nav-link harvesting.
    """
    if not xml:
        return [], False
    if len(xml) > MAX_HTML_BYTES:
        xml = xml[:MAX_HTML_BYTES]
    try:
        soup = BeautifulSoup(xml, "xml")
    except Exception:
        return [], False

    is_index = soup.find("sitemapindex") is not None
    locs: list[str] = []
    for loc in soup.find_all("loc"):
        text = (loc.get_text() or "").strip()
        if text:
            locs.append(text)
        if len(locs) >= MAX_SITEMAP_URLS:
            break
    return locs, is_index


def discover_sitemap_urls(origin: str, fetch: SitemapFetcher) -> list[str] | None:
    """Return a site's sitemap-listed page URLs, or ``None`` if none is usable.

    Tries the well-known sitemap paths under ``origin``; on a ``<sitemapindex>``
    it follows one level of nesting (bounded by ``MAX_NESTED_SITEMAPS``). Returns
    raw, unfiltered ``<loc>`` URLs - the caller applies same-domain/suffix
    filtering and SSRF validation. ``None`` signals "no sitemap" so the caller
    can fall back to harvesting nav links from the entry HTML.
    """
    for path in SITEMAP_PATHS:
        xml = fetch(urljoin(origin, path))
        if not xml:
            continue
        locs = _collect_sitemap_locs(xml, fetch)
        if locs:
            return locs
    return None


def _collect_sitemap_locs(xml: str, fetch: SitemapFetcher) -> list[str]:
    entries, is_index = parse_sitemap(xml)
    if not entries:
        return []
    if not is_index:
        return entries[:MAX_SITEMAP_URLS]

    urls: list[str] = []
    for nested in entries[:MAX_NESTED_SITEMAPS]:
        nested_xml = fetch(nested)
        if not nested_xml:
            continue
        child, _ = parse_sitemap(nested_xml)
        urls.extend(child)
        if len(urls) >= MAX_SITEMAP_URLS:
            break
    return urls[:MAX_SITEMAP_URLS]


def links_from_sitemap(
    urls: Iterable[str], base_url: str, limit: int = MAX_DISCOVERED_LINKS
) -> list[DiscoveredLink]:
    """Turn raw sitemap ``<loc>`` URLs into filtered, labelled candidates.

    Same same-registrable-domain / non-page-suffix / dedup / entry-drop rules as
    ``harvest_links``, but sourced from a sitemap (no anchor text), so labels are
    derived from the URL path. Sitemap order is preserved (often priority-ordered).
    The caller still owns SSRF validation of every URL returned here.
    """
    base_host = _registrable_host(base_url)
    found: list[DiscoveredLink] = []
    seen: set[str] = {_canonical(base_url)}

    for raw in urls:
        href = (raw or "").strip()
        if not href:
            continue
        absolute = urljoin(base_url, href)  # <loc> is usually absolute, but tolerate relative
        parsed = urlparse(absolute)
        if parsed.scheme not in ("http", "https"):
            continue
        if _registrable_host(absolute) != base_host:
            continue
        if parsed.path.lower().endswith(_NON_PAGE_SUFFIXES):
            continue

        key = _canonical(absolute)
        if key in seen:
            continue
        seen.add(key)
        clean = urldefrag(absolute)[0]
        found.append(DiscoveredLink(url=clean, label=_label_from_url(clean)))
        if len(found) >= limit:
            break

    return found


_LABEL_EXT_RE = re.compile(r"\.[a-z0-9]{1,5}$", re.I)
_LABEL_SPLIT_RE = re.compile(r"[-_]+")


def _label_from_url(url: str) -> str:
    """Human label for a sitemap URL: ``/about-us`` -> ``About us``."""
    path = urlparse(url).path.strip("/")
    if not path:
        return url
    slug = _LABEL_EXT_RE.sub("", path.split("/")[-1])
    words = [w for w in _LABEL_SPLIT_RE.split(slug) if w]
    label = " ".join(words).strip()
    if not label:
        return path
    return label[:1].upper() + label[1:]


#: Shortest extraction worth storing at all. A page under this is a redirect stub
#: or an error body, never content.
MIN_USABLE_CHARS = 50

#: What a bot-check, paywall or JS-shell page says instead of the page. These fetch
#: with HTTP 200 and clear any length floor a stub check would set - expresolv.com
#: served exactly 51 characters of "Please wait while your request is being
#: verified...", which was enough to replace a whole trained source with itself.
_INTERSTITIAL_PATTERNS = (
    r"request is being verified",
    r"checking your browser",
    r"verifying you are human",
    r"please wait while",
    r"enable javascript (?:to|and)",
    r"javascript is (?:required|disabled)",
    r"cf-browser-verification",
    r"attention required!\s*\|\s*cloudflare",
    r"access denied",
    r"are you a robot",
    r"ddos protection by",
)
_INTERSTITIAL_RE = re.compile("|".join(_INTERSTITIAL_PATTERNS), re.IGNORECASE)

#: Above this an interstitial phrase is incidental copy, not the page. Real
#: challenge bodies are tiny - the one that caused this was 51 characters, and a
#: Cloudflare block page extracts to a few hundred.
INTERSTITIAL_MAX_CHARS = 1200

#: How much smaller a re-ingest may be before it is treated as a failed fetch
#: rather than an edited page. Deliberately generous - real edits and redesigns
#: shrink pages, and a false refusal here only costs the owner a delete-and-re-add.
REPLACEMENT_SHRINK_FLOOR = 0.25

#: Sources below this never trigger the shrink guard: a page that held almost
#: nothing has nothing to protect, and the ratio is noise at that size.
SHRINK_GUARD_MIN_WORDS = 100


def unusable_reason(extracted: str) -> Optional[str]:
    """Why this extraction must not be stored, or None when it is usable.

    Length alone cannot answer this. An interstitial is a successful fetch of the
    wrong page: HTTP 200, plausible length, and no error anywhere for a caller to
    notice - so it has to be recognised by what it says.
    """
    text = (extracted or "").strip()
    if not text:
        return "the page returned no text"
    if len(text) < MIN_USABLE_CHARS:
        return f"only {len(text)} characters of text were found"
    # Only short pages: an interstitial IS the whole response, so the phrase
    # carries the page. On a full page the same words are ordinary copy - an order
    # desk writing "please wait while we confirm stock" must still be trainable.
    if len(text) <= INTERSTITIAL_MAX_CHARS and _INTERSTITIAL_RE.search(text):
        return ("the site returned a bot-verification or access-denied page "
                "instead of the content")
    return None


def replacement_shrink_reason(old_words: int, new_words: int) -> Optional[str]:
    """Why this re-ingest must not replace the stored source, or None to proceed.

    The guard that matters: whatever the cause - a challenge page, an outage, a
    redesign behind a login - swapping a rich source for a near-empty one destroys
    knowledge the owner cannot get back, and it looks to them like the bot simply
    forgot. Refusing costs a delete-and-re-add; accepting costs the source.
    """
    if old_words < SHRINK_GUARD_MIN_WORDS:
        return None
    if new_words >= old_words * REPLACEMENT_SHRINK_FLOOR:
        return None
    return (f"the new version has {new_words} words against {old_words} already "
            f"stored, so it looks like a failed fetch rather than an edit")


def marginal_words(extracted: str) -> int:
    """Words a *sibling* page is expected to add on top of an already-crawled page.

    Discovery must estimate crawl cost without fetching every candidate - fetches
    are the scarce shared resource (one Jina quota across all tenants). The JSON-LD
    block is emitted site-wide and identical, so cross-page dedup collapses it to
    zero after the first page; only body copy is genuinely new. On the reference
    site that is 170 of 340 words, i.e. a naive estimate would overstate by 2x.
    """
    body, _, _ = extracted.partition(STRUCTURED_DATA_HEADING)
    return len(body.split())
