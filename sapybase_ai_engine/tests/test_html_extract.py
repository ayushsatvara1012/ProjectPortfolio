"""Unit + regression tests for the in-house URL extractor (Phase 1).

See docs/archived/url-scraper-rewrite-plan.md R7.
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


# ── Our own FAQ schema is never re-ingested (plan §1.4, F1) ──────────────────


def _loader_faq_payload() -> str:
    """Byte-shape of what public/sapybase-loader@1.js:819-829 injects."""
    import json

    return json.dumps({
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": [{
            "@type": "Question",
            "name": "Whom to contact for sales ?",
            "acceptedAnswer": {
                "@type": "Answer",
                "text": "I don't have details on file for who specifically handles export business.",
            },
        }],
    })


def test_loader_faq_roundtrip_ingests_nothing():
    html = (
        "<body><p>Real page copy about solvents</p>"
        f'<script type="application/ld+json" data-sapybase-faq="true">{_loader_faq_payload()}</script>'
        "</body>"
    )
    out = extract(html, BASE)
    assert "Real page copy about solvents" in out
    assert "Whom to contact" not in out
    assert "handles export business" not in out
    assert "FAQPage" not in out


def test_faq_schema_skipped_even_without_the_attribute():
    html = (
        "<body><p>Real page copy</p>"
        f'<script type="application/ld+json">{_loader_faq_payload()}</script></body>'
    )
    out = extract(html, BASE)
    assert "Real page copy" in out
    assert "Whom to contact" not in out
    assert "handles export business" not in out


def test_source_marker_block_is_skipped_whatever_its_type():
    payload = '{"@type":"Thing","name":"Acetone grade list","description":"📎 Source: price-list.pdf"}'
    out = extract(_jsonld(payload), BASE)
    assert "Page body text here" in out
    assert "Acetone grade list" not in out


def test_bare_question_entries_in_a_graph_are_skipped():
    payload = (
        '{"@graph":[{"@type":"Organization","name":"Expresolv"},'
        '{"@type":"Question","name":"can i get the coa for 101LR 101.26R007",'
        '"acceptedAnswer":{"@type":"Answer","text":"It should be open in a panel for you."}}]}'
    )
    out = extract(_jsonld(payload), BASE)
    assert "Expresolv" in out
    assert "101LR" not in out
    assert "open in a panel" not in out


def test_legitimate_schema_still_ingested_alongside_a_faq_block():
    html = (
        "<body><p>Body</p>"
        '<script type="application/ld+json">{"@type":"Organization","name":"Acme","telephone":"+15550001"}</script>'
        f'<script type="application/ld+json" data-sapybase-faq="true">{_loader_faq_payload()}</script>'
        "</body>"
    )
    out = extract(html, BASE)
    assert "Acme" in out and "+15550001" in out
    assert "Whom to contact" not in out


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
    links = "".join(f'<a href="/contact-{i}">Contact {i}</a>' for i in range(MAX_DISCOVERED_LINKS + 20))
    assert len(harvest_links(f"<body>{links}</body>", "https://www.example.com/")) == MAX_DISCOVERED_LINKS


def test_harvest_without_intent_match_keeps_every_same_domain_page():
    html = '<body><a href="/pricing">Pricing</a><a href="/blog/x">Blog</a><a href="/anything">Y</a></body>'
    urls = [l.url for l in harvest_links(html, "https://www.example.com/", require_intent_match=False)]
    assert urls == [
        "https://www.example.com/pricing",
        "https://www.example.com/blog/x",
        "https://www.example.com/anything",
    ]


def test_harvest_without_intent_still_rejects_offsite_and_assets():
    html = '<body><a href="https://other.com/x">Off</a><a href="/a.pdf">Asset</a><a href="/keep">Keep</a></body>'
    urls = [l.url for l in harvest_links(html, "https://www.example.com/", require_intent_match=False)]
    assert urls == ["https://www.example.com/keep"]


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


# ── Full-site route discovery: sitemap parsing + candidates ──────────────────

from services.html_extract import (
    discover_sitemap_urls,
    links_from_sitemap,
    parse_sitemap,
    _label_from_url,
)

_URLSET = (
    '<?xml version="1.0" encoding="UTF-8"?>'
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
    '<url><loc>https://www.example.com/</loc></url>'
    '<url><loc>https://www.example.com/about-us</loc></url>'
    '<url><loc>https://www.example.com/services/roof-repair</loc></url>'
    '</urlset>'
)

_INDEX = (
    '<?xml version="1.0" encoding="UTF-8"?>'
    '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
    '<sitemap><loc>https://www.example.com/sitemap-pages.xml</loc></sitemap>'
    '<sitemap><loc>https://www.example.com/sitemap-posts.xml</loc></sitemap>'
    '</sitemapindex>'
)


def test_parse_sitemap_reads_urlset():
    locs, is_index = parse_sitemap(_URLSET)
    assert is_index is False
    assert locs == [
        "https://www.example.com/",
        "https://www.example.com/about-us",
        "https://www.example.com/services/roof-repair",
    ]


def test_parse_sitemap_flags_an_index():
    locs, is_index = parse_sitemap(_INDEX)
    assert is_index is True
    assert locs[0] == "https://www.example.com/sitemap-pages.xml"


def test_parse_sitemap_on_non_xml_returns_empty():
    assert parse_sitemap("<html><body>not a sitemap</body></html>") == ([], False)
    assert parse_sitemap("") == ([], False)


def test_discover_prefers_first_available_path():
    def fetch(url):
        return _URLSET if url.endswith("/sitemap.xml") else None
    urls = discover_sitemap_urls("https://www.example.com", fetch)
    assert urls and urls[0] == "https://www.example.com/"


def test_discover_falls_through_to_second_path():
    def fetch(url):
        return _URLSET if url.endswith("/sitemap_index.xml") else None
    urls = discover_sitemap_urls("https://www.example.com", fetch)
    assert urls == parse_sitemap(_URLSET)[0]


def test_discover_follows_a_sitemap_index():
    pages = _URLSET
    posts = _URLSET.replace("/about-us", "/blog/post-1")

    def fetch(url):
        if url.endswith("/sitemap.xml"):
            return _INDEX
        if url.endswith("sitemap-pages.xml"):
            return pages
        if url.endswith("sitemap-posts.xml"):
            return posts
        return None

    urls = discover_sitemap_urls("https://www.example.com", fetch)
    assert "https://www.example.com/about-us" in urls
    assert "https://www.example.com/blog/post-1" in urls


def test_discover_returns_none_when_no_sitemap():
    assert discover_sitemap_urls("https://www.example.com", lambda u: None) is None


def test_links_from_sitemap_filters_and_labels():
    raw = [
        "https://www.example.com/",                       # entry, dropped
        "https://www.example.com/about-us",
        "https://www.example.com/services/roof-repair",
        "https://other.com/off",                          # offsite, dropped
        "https://www.example.com/brochure.pdf",           # asset, dropped
        "https://www.example.com/about-us#team",          # dup of about-us
    ]
    links = links_from_sitemap(raw, "https://www.example.com/")
    assert [(l.url, l.label) for l in links] == [
        ("https://www.example.com/about-us", "About us"),
        ("https://www.example.com/services/roof-repair", "Roof repair"),
    ]


def test_links_from_sitemap_respects_the_cap():
    raw = [f"https://www.example.com/p-{i}" for i in range(MAX_DISCOVERED_LINKS + 30)]
    assert len(links_from_sitemap(raw, "https://www.example.com/")) == MAX_DISCOVERED_LINKS


def test_label_from_url_humanises_the_slug():
    assert _label_from_url("https://x.com/about-us") == "About us"
    assert _label_from_url("https://x.com/services/roof_repair") == "Roof repair"
    assert _label_from_url("https://x.com/") == "https://x.com/"


from services.html_extract import replacement_shrink_reason, unusable_reason


class TestUnusableExtraction:
    """A successful fetch of the wrong page (bugfix/reject-unusable-extraction).

    expresolv.com answered 200 with a 51-character bot-check page. That cleared the
    old `len(text) >= 50` floor, so a retrain replaced a 60-row trained source with
    the sentence "Please wait while your request is being verified..." - the page's
    real content, gone, and nothing anywhere reported an error.
    """

    def test_the_real_interstitial_that_caused_this_is_rejected(self):
        assert unusable_reason("Please wait while your request is being verified...")

    def test_a_cloudflare_challenge_is_rejected(self):
        assert unusable_reason(
            "Checking your browser before accessing example.com. "
            "This process is automatic. DDoS protection by Cloudflare."
        )

    def test_a_javascript_shell_is_rejected(self):
        assert unusable_reason(
            "You need to enable JavaScript to run this app. " * 3
        )

    def test_an_empty_page_is_rejected(self):
        assert unusable_reason("")
        assert unusable_reason("   \n  ")

    def test_a_stub_shorter_than_the_floor_is_rejected(self):
        assert unusable_reason("Redirecting...")

    def test_real_content_passes(self):
        text = ("Expresolv supplies laboratory and industrial chemicals across India. "
                "Our leadership team is based in Ahmedabad, Gujarat, and we serve "
                "pharmaceutical, food and agricultural customers nationwide.")
        assert unusable_reason(text) is None

    def test_a_full_page_that_merely_mentions_waiting_is_still_trainable(self):
        # An order desk writing "please wait while we confirm stock" is content.
        # An interstitial IS the whole response; the phrase alone cannot decide it.
        text = ("Our order desk replies within one working day. Please wait while we "
                "confirm stock before paying. "
                + "Bulk packs of acetone, methanol and toluene ship from Ahmedabad "
                  "with full documentation on request. " * 20)
        assert len(text) > 1200
        assert unusable_reason(text) is None


class TestReplacementShrink:
    """The guard that actually saves the source, whatever the cause of the bad fetch."""

    def test_a_collapse_to_almost_nothing_is_refused(self):
        assert replacement_shrink_reason(978, 8)

    def test_an_ordinary_edit_is_allowed(self):
        assert replacement_shrink_reason(978, 900) is None

    def test_a_substantial_but_plausible_trim_is_allowed(self):
        # A real redesign can halve a page; only a collapse is suspicious.
        assert replacement_shrink_reason(1000, 400) is None

    def test_growth_is_always_allowed(self):
        assert replacement_shrink_reason(500, 5000) is None

    def test_a_source_that_held_almost_nothing_is_not_guarded(self):
        # Nothing worth protecting, and the ratio is noise at this size.
        assert replacement_shrink_reason(40, 2) is None

    def test_the_expresolv_incident_would_have_been_refused(self):
        assert replacement_shrink_reason(978, 8)
# ── Slice I: extraction hardening (docs/bot-output-quality-plan.md §4, phase 1) ──

# Verbatim from expresolv.com's homepage theme - the page §4 measured, where 12 of
# 76 child chunks were carousel testimonials. Person-name-shaped, so they are prime
# false matches for "who is ...?" and they take the reranked slots the real staff
# rows need.
EXPRESOLV_TESTIMONIAL = """
<html><body>
  <section class="tp-testimonial-area pt-120 pb-120">
    <div class="swiper-slide">
      <div class="tp-testi__item">
        <p class="tp-testi__text">Expresolv has been a reliable supplier for years.</p>
        <span class="tp-testi__ava-name">Mr. Rakesh Mehta</span>
        <span class="tp-testi__ava-position">Procurement Head</span>
      </div>
    </div>
  </section>
  <section class="about-area">
    <h2>Our products</h2>
    <p>We supply Acetone in AR and LR grades from our Ankleshwar plant.</p>
  </section>
</body></html>
"""


def test_testimonial_block_is_dropped_and_the_adjacent_section_survives():
    out = extract(EXPRESOLV_TESTIMONIAL, BASE)
    assert "Rakesh Mehta" not in out
    assert "Procurement Head" not in out
    assert "reliable supplier" not in out
    # The content next to it is the whole point - an over-broad selector takes this.
    assert "Acetone in AR and LR grades" in out
    assert "Our products" in out


def test_a_page_with_no_testimonial_markup_is_untouched():
    html = """
    <html><body>
      <section class="about-area"><h2>Contact</h2>
      <p>Call us on +91 98250 12345 or email sales@example.com.</p></section>
    </body></html>
    """
    assert extract(html, BASE) == extract(html, BASE)
    out = extract(html, BASE)
    assert "+91 98250 12345" in out
    assert "sales@example.com" in out
    assert "Contact" in out


def test_a_review_token_does_not_match_preview():
    # `[class*='review']` would take both of these; whole-token matching takes one.
    html = """
    <html><body>
      <div class="product-preview"><p>Acetone technical grade, 200L drum.</p></div>
      <div class="customer-reviews"><p>Five stars from Mr. Arun Shrestha.</p></div>
    </body></html>
    """
    out = extract(html, BASE)
    assert "200L drum" in out
    assert "Arun Shrestha" not in out


def test_leaked_markup_is_stripped_from_body_text():
    # The page served the tag escaped, so no parser ever saw it as markup.
    html = """
    <html><body><p>&lt;span class="tp-testi__ava-position"&gt;Methanol is stocked.</p>
    </body></html>
    """
    out = extract(html, BASE)
    assert "tp-testi" not in out
    assert "span class" not in out
    assert "Methanol is stocked." in out


def test_a_bare_css_class_line_is_dropped_but_real_copy_is_not():
    html = """
    <html><body>
      <p>testimonial-area</p>
      <p>breadcrumb-area</p>
      <p>tp-testi__ava-position</p>
      <p>carton-box</p>
      <p>Acetone is available in AR grade.</p>
    </body></html>
    """
    out = extract(html, BASE)
    assert "testimonial-area" not in out
    assert "breadcrumb-area" not in out
    assert "Acetone is available in AR grade." in out
    # Packaging vocabulary is a fact in this vertical, not a class name.
    assert "carton-box" in out


def test_a_less_than_sign_in_a_spec_is_not_read_as_markup():
    html = "<html><body><p>Moisture content &lt;0.1% and &lt; 50 ppm chloride.</p></body></html>"
    out = extract(html, BASE)
    assert "<0.1%" in out
    assert "< 50 ppm chloride" in out


def test_breadcrumb_and_publishing_metadata_are_not_ingested():
    html = """
    <html><head>
    <script type="application/ld+json">
    {"@context":"https://schema.org","@graph":[
      {"@type":"BreadcrumbList","itemListElement":[
        {"@type":"ListItem","position":1,"name":"Home"},
        {"@type":"ListItem","position":2,"name":"Products"}]},
      {"@type":"Organization","name":"Expresolv","telephone":"+91 99999 11111",
       "dateModified":"2026-08-01","inLanguage":"en-US"}]}
    </script>
    </head><body><p>Body copy.</p></body></html>
    """
    out = extract(html, BASE)
    assert "Expresolv" in out
    assert "+91 99999 11111" in out
    assert "BreadcrumbList" not in out
    assert "dateModified" not in out
    assert "inLanguage" not in out


def test_the_faq_round_trip_still_holds_after_slice_i():
    # Slice F1's guarantee must survive this phase (plan §9: the most important
    # test in the plan). Loader-shaped JSON-LD in, zero chunks out.
    html = """
    <html><head>
    <script type="application/ld+json" data-sapybase-faq="true">
    {"@context":"https://schema.org","@type":"FAQPage","mainEntity":[
      {"@type":"Question","name":"Whom to contact for sales ?",
       "acceptedAnswer":{"@type":"Answer","text":"I don't have details on file."}}]}
    </script>
    </head><body><p>Real page copy.</p></body></html>
    """
    out = extract(html, BASE)
    assert "Whom to contact for sales" not in out
    assert "Real page copy." in out
