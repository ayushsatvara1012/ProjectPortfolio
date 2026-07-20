"""Unit + regression tests for the in-house URL extractor (Phase 1).

See docs/url-scraper-rewrite-plan.md R7.
"""

import pytest

from services.html_extract import MAX_HTML_BYTES, extract

BASE = "https://example.com/"


def test_footer_contact_survives():
    html = """
    <html><body>
      <main><h1>Studio</h1><p>We design things.</p></main>
      <footer id="contact">
        <h2>Contact</h2>
        <a href="mailto:hello@example.com">Email us</a>
        <a href="tel:+918980775017">Call</a>
        <p>12 Market Street, Ahmedabad</p>
      </footer>
    </body></html>
    """
    out = extract(html, BASE)
    assert "hello@example.com" in out
    assert "+918980775017" in out
    assert "12 Market Street, Ahmedabad" in out


def test_details_accordion_kept():
    html = """
    <body><details><summary>What are your hours?</summary>
    <p>Mon-Fri 9am to 6pm</p></details></body>
    """
    out = extract(html, BASE)
    assert "What are your hours?" in out
    assert "Mon-Fri 9am to 6pm" in out


def test_aside_kept():
    out = extract("<body><aside><p>Open on public holidays</p></aside></body>", BASE)
    assert "Open on public holidays" in out


def test_table_becomes_markdown():
    html = """
    <body><table>
      <tr><th>Service</th><th>Price</th></tr>
      <tr><td>Deep clean</td><td>$120</td></tr>
    </table></body>
    """
    out = extract(html, BASE)
    assert "| Service | Price |" in out
    assert "| --- | --- |" in out
    assert "| Deep clean | $120 |" in out


def test_headings_and_lists_preserved():
    html = "<body><h2>Services</h2><ul><li>Painting</li><li>Plumbing</li></ul><ol><li>First step</li></ol></body>"
    out = extract(html, BASE)
    assert "## Services" in out
    assert "- Painting" in out
    assert "- Plumbing" in out
    assert "1. First step" in out


def test_definition_list_pairs():
    out = extract("<body><dl><dt>Saturday</dt><dd>10am to 4pm</dd></dl></body>", BASE)
    assert "**Saturday**" in out
    assert "10am to 4pm" in out


def test_noise_tags_stripped():
    html = """
    <body>
      <script>var secret = 'tracking';</script>
      <style>.a{color:red}</style>
      <noscript>Enable JavaScript</noscript>
      <p>Real content about our workshop</p>
    </body>
    """
    out = extract(html, BASE)
    assert "Real content about our workshop" in out
    assert "tracking" not in out
    assert "color:red" not in out
    assert "Enable JavaScript" not in out


def test_cookie_banner_stripped():
    html = """
    <body>
      <div id="cookie-consent-banner"><p>We use cookies to improve your experience</p></div>
      <p>Our bakery opens at seven</p>
    </body>
    """
    out = extract(html, BASE)
    assert "Our bakery opens at seven" in out
    assert "We use cookies" not in out


def test_repeated_nav_deduped():
    html = """
    <body>
      <nav><ul><li>Services offered</li><li>Contact us today</li></ul></nav>
      <p>Body copy</p>
      <footer><ul><li>Services offered</li><li>Contact us today</li></ul></footer>
    </body>
    """
    out = extract(html, BASE)
    assert out.count("Services offered") == 1
    assert out.count("Contact us today") == 1


def test_dedup_ignores_punctuation_differences():
    html = "<body><p>+1 (555) 123-4567</p><p>+15551234567</p><p>Distinct line here</p></body>"
    out = extract(html, BASE)
    assert len([ln for ln in out.split("\n") if "555" in ln]) == 1


def test_short_fragments_dropped():
    out = extract("<body><p>›</p><p>A meaningful sentence about pricing</p></body>", BASE)
    assert "›" not in out
    assert "A meaningful sentence about pricing" in out


def test_images_dropped():
    out = extract('<body><img src="/logo.png" alt="Logo"><p>Text stays</p></body>', BASE)
    assert "logo.png" not in out
    assert "Text stays" in out


def test_empty_document_returns_empty():
    assert extract("<html><body></body></html>", BASE) == ""
    assert extract("", BASE) == ""


# ── JSON-LD shapes (R1) ──────────────────────────────────────────────────────


def _jsonld(payload: str) -> str:
    return f'<body><p>Page body text here</p><script type="application/ld+json">{payload}</script></body>'


def test_jsonld_single_object():
    out = extract(_jsonld('{"@type":"Organization","name":"Acme","telephone":"+15550001"}'), BASE)
    assert "Acme" in out
    assert "+15550001" in out


def test_jsonld_array_top_level():
    out = extract(_jsonld('[{"@type":"Organization","name":"Acme"},{"@type":"Person","name":"Riya"}]'), BASE)
    assert "Acme" in out
    assert "Riya" in out


def test_jsonld_graph_wrapper():
    out = extract(_jsonld('{"@graph":[{"@type":"LocalBusiness","name":"Corner Cafe"}]}'), BASE)
    assert "Corner Cafe" in out


def test_jsonld_type_as_array():
    out = extract(_jsonld('{"@type":["Organization","LocalBusiness"],"name":"Dual Co"}'), BASE)
    assert "Dual Co" in out
    assert "LocalBusiness" in out


def test_jsonld_telephone_array_and_nested_address():
    payload = (
        '{"@type":"LocalBusiness","telephone":["+15550001","+15550002"],'
        '"address":{"@type":"PostalAddress","streetAddress":"9 Elm Rd","addressLocality":"Pune"}}'
    )
    out = extract(_jsonld(payload), BASE)
    assert "+15550001" in out and "+15550002" in out
    assert "9 Elm Rd" in out and "Pune" in out


def test_jsonld_multiple_blocks():
    html = (
        "<body><p>Body copy line</p>"
        '<script type="application/ld+json">{"@type":"Organization","name":"First Co"}</script>'
        '<script type="application/ld+json">{"@type":"Person","name":"Second Person"}</script>'
        "</body>"
    )
    out = extract(html, BASE)
    assert "First Co" in out and "Second Person" in out


def test_malformed_jsonld_never_fails_document():
    html = (
        "<body><p>Still extracted body text</p>"
        '<script type="application/ld+json">{not valid json,,,}</script></body>'
    )
    out = extract(html, BASE)
    assert "Still extracted body text" in out


def test_deeply_nested_jsonld_terminates():
    payload = {"@type": "Thing", "name": "Deep"}
    node = payload
    for i in range(50):
        node["child"] = {"@type": "Thing", "name": f"level{i}"}
        node = node["child"]
    import json

    out = extract(_jsonld(json.dumps(payload)), BASE)
    assert "Deep" in out


# ── Guard rails ──────────────────────────────────────────────────────────────


def test_oversized_html_is_truncated_not_parsed_whole():
    html = "<body><p>Opening fact</p>" + ("<p>filler paragraph</p>" * 400000) + "</body>"
    assert len(html) > MAX_HTML_BYTES
    out = extract(html, BASE)
    assert "Opening fact" in out


def test_entity_declaration_is_not_expanded():
    html = (
        '<!DOCTYPE t [<!ENTITY xxe SYSTEM "file:///etc/passwd">]>'
        "<body><p>Safe body content here</p><p>&xxe;</p></body>"
    )
    out = extract(html, BASE)
    assert "Safe body content here" in out
    assert "root:" not in out


@pytest.mark.parametrize("tag", ["svg", "iframe", "template", "canvas"])
def test_additional_noise_tags_stripped(tag):
    html = f"<body><{tag}>hidden noise payload</{tag}><p>Visible content stays</p></body>"
    out = extract(html, BASE)
    assert "Visible content stays" in out
    assert "hidden noise payload" not in out


# ── Word-count regression (R4) ───────────────────────────────────────────────

FULL_PAGE = """
<html><head><title>SP Designing</title>
<script type="application/ld+json">
{"@context":"https://schema.org","@type":["Organization","LocalBusiness"],
 "name":"SP Designing","telephone":"+918980775017","email":"spdesigns28@gmail.com"}
</script></head>
<body>
  <nav><ul><li>Home page</li><li>About us</li><li>Contact us</li></ul></nav>
  <main>
    <h1>Interior design studio</h1>
    <p>We build residential and commercial interiors across the city.</p>
    <details><summary>Do you offer site visits?</summary><p>Yes, free within city limits.</p></details>
    <table><tr><th>Package</th><th>Price</th></tr><tr><td>Consult</td><td>$99</td></tr></table>
  </main>
  <footer id="contact">
    <h2>Contact</h2>
    <a href="mailto:spdesigns28@gmail.com">Mail</a>
    <a href="tel:+918980775017">Phone</a>
    <p>Studio 4, Prahlad Nagar, Ahmedabad 380015</p>
  </footer>
</body></html>
"""

# What Jina's markdown mode returned for the same page: main content only.
JINA_MARKDOWN_EQUIVALENT = """
# Interior design studio

We build residential and commercial interiors across the city.
"""


def test_extraction_keeps_more_than_jina_markdown():
    out = extract(FULL_PAGE, BASE)
    assert len(out.split()) > len(JINA_MARKDOWN_EQUIVALENT.split())


def test_reported_site_facts_all_survive():
    out = extract(FULL_PAGE, BASE)
    for fact in (
        "spdesigns28@gmail.com",
        "+918980775017",
        "Prahlad Nagar",
        "Do you offer site visits?",
        "| Consult | $99 |",
    ):
        assert fact in out, fact


# ── Phase 3: depth-1 link discovery ──────────────────────────────────────────

from services.html_extract import MAX_DISCOVERED_LINKS, harvest_links


def _urls(html, base="https://www.example.com/"):
    return [link.url for link in harvest_links(html, base)]


def test_harvest_matches_intent_paths():
    html = '<body><a href="/contact-us">Reach out</a><a href="/about">About</a><a href="/blog">Blog</a></body>'
    urls = _urls(html)
    assert "https://www.example.com/contact-us" in urls
    assert "https://www.example.com/about" in urls
    assert "https://www.example.com/blog" not in urls


def test_harvest_matches_on_anchor_label_too():
    html = '<body><a href="/t">Visit us in store</a></body>'
    assert "https://www.example.com/t" in _urls(html)


def test_harvest_rejects_offsite_links():
    html = '<body><a href="https://facebook.com/acme/contact">Contact on FB</a></body>'
    assert _urls(html) == []


def test_harvest_treats_www_and_apex_as_same_site():
    html = '<body><a href="https://example.com/contact">Contact</a></body>'
    assert _urls(html) == ["https://example.com/contact"]


def test_harvest_rejects_non_http_schemes():
    html = '<body><a href="javascript:void(0)">contact</a><a href="mailto:a@b.com">contact</a></body>'
    assert _urls(html) == []


def test_harvest_rejects_asset_files():
    html = '<body><a href="/contact-brochure.pdf">Contact brochure</a><a href="/logo-about.png">about</a></body>'
    assert _urls(html) == []


def test_harvest_dedupes_and_drops_fragments():
    html = (
        '<body><a href="/contact">A</a><a href="/contact/">B</a>'
        '<a href="/contact#form">C</a></body>'
    )
    assert _urls(html) == ["https://www.example.com/contact"]


def test_harvest_excludes_the_entry_url_itself():
    html = '<body><a href="/about">About</a><a href="https://www.example.com/about/">Same</a></body>'
    assert _urls(html, "https://www.example.com/about") == []


def test_harvest_respects_the_cap():
    links = "".join(f'<a href="/contact-{i}">Contact {i}</a>' for i in range(40))
    assert len(harvest_links(f"<body>{links}</body>", "https://www.example.com/")) == MAX_DISCOVERED_LINKS


def test_harvest_handles_relative_and_absolute_paths():
    html = '<body><a href="about">Rel</a><a href="/hours">Abs</a></body>'
    urls = _urls(html, "https://www.example.com/pages/")
    assert "https://www.example.com/pages/about" in urls
    assert "https://www.example.com/hours" in urls


def test_harvest_on_empty_html():
    assert harvest_links("", "https://www.example.com/") == []


# ── Phase 3: cross-page boilerplate dedup ────────────────────────────────────

_PAGE_A = """
<body>
  <nav><ul><li>Home page link</li><li>Contact us today</li></ul></nav>
  <main><p>Page A unique body copy</p></main>
  <footer><p>Call us on +15551234567</p></footer>
</body>
"""

_PAGE_B = """
<body>
  <nav><ul><li>Home page link</li><li>Contact us today</li></ul></nav>
  <main><p>Page B unique body copy</p></main>
  <footer><p>Call us on +15551234567</p></footer>
</body>
"""


def test_shared_seen_set_drops_repeated_boilerplate_on_later_pages():
    seen: set[str] = set()
    a = extract(_PAGE_A, "https://example.com/a", seen_blocks=seen)
    b = extract(_PAGE_B, "https://example.com/b", seen_blocks=seen)

    assert "Page A unique body copy" in a
    assert "Page B unique body copy" in b
    # Boilerplate is kept once, on the first page that carried it.
    assert "+15551234567" in a
    assert "+15551234567" not in b
    assert "Home page link" in a
    assert "Home page link" not in b


def test_without_shared_set_each_page_keeps_its_own_boilerplate():
    a = extract(_PAGE_A, "https://example.com/a")
    b = extract(_PAGE_B, "https://example.com/b")
    assert "+15551234567" in a and "+15551234567" in b


def test_shared_set_is_mutated_in_place_for_the_caller():
    seen: set[str] = set()
    extract(_PAGE_A, "https://example.com/a", seen_blocks=seen)
    assert seen, "crawl state must persist across pages"


_JSONLD_PAGE = (
    '<body><p>{body}</p>'
    '<script type="application/ld+json">'
    '{{"@type":"Organization","name":"Site Wide Co","telephone":"+15559990000"}}'
    '</script></body>'
)


def test_jsonld_is_deduped_across_pages():
    """Most sites emit an identical Organization block on every page; a crawl must
    not store it N times."""
    seen: set[str] = set()
    a = extract(_JSONLD_PAGE.format(body="First page copy"), "https://example.com/a", seen_blocks=seen)
    b = extract(_JSONLD_PAGE.format(body="Second page copy"), "https://example.com/b", seen_blocks=seen)

    assert "Site Wide Co" in a
    assert "Second page copy" in b
    assert "Site Wide Co" not in b
    assert "+15559990000" not in b


def test_jsonld_still_kept_for_single_page_extraction():
    out = extract(_JSONLD_PAGE.format(body="Only page"), "https://example.com/a")
    assert "Site Wide Co" in out


# ── Phase 3: free crawl-cost estimation ──────────────────────────────────────

from services.html_extract import STRUCTURED_DATA_HEADING, marginal_words


def test_marginal_words_excludes_the_sitewide_jsonld_block():
    """Discovery estimates crawl cost without fetching candidates, so the estimate
    must not count the JSON-LD that cross-page dedup collapses to zero."""
    page = extract(_JSONLD_PAGE.format(body="Some real body copy here"), "https://example.com/a")
    assert "Site Wide Co" in page

    body_only, _, structured = page.partition(STRUCTURED_DATA_HEADING)
    assert structured, "fixture must actually carry a structured-data section"
    assert marginal_words(page) == len(body_only.split())
    assert marginal_words(page) < len(page.split())


def test_marginal_words_equals_total_when_no_structured_data():
    page = extract("<body><p>Just body copy and nothing else at all</p></body>", BASE)
    assert marginal_words(page) == len(page.split())


def test_marginal_words_on_empty_input():
    assert marginal_words("") == 0
