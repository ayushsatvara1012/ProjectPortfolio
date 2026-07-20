"""Phase 3 Slice 2: discovery endpoint + crawl fan-out training job.

See docs/url-scraper-rewrite-plan.md Phase 3.
"""
import json

import pytest
from fastapi.testclient import TestClient
from langchain_core.documents import Document

import main as m


_ENTRY_HTML = """
<html><body>
  <nav><ul><li>Home page</li><li>Contact us</li></ul></nav>
  <main>
    <h1>Acme Interiors</h1>
    <p>We design homes and offices across the city with care and detail.</p>
  </main>
  <a href="/contact-us">Contact us</a>
  <a href="/about">About the studio</a>
  <a href="/blog">Blog</a>
  <a href="https://facebook.com/acme/contact">Find us on Facebook</a>
  <footer><p>Call +15551234567 or email hello@acme.test</p></footer>
</body></html>
"""


def _premium_user():
    return {"id": "user-1", "tier": "EXPLORE", "role": "USER"}


# ── Discovery endpoint ───────────────────────────────────────────────────────


def _discover(monkeypatch, html=_ENTRY_HTML, url="https://www.acme.test/", sitemap=None):
    async def _fake_fetch(page_url):
        return html

    monkeypatch.setattr(m, "_fetch_url_html", _fake_fetch)
    monkeypatch.setattr(m, "validate_safe_url", lambda u: None)
    # Sitemap fetch is a real requests.get; stub it so discovery is offline and
    # deterministic. Default None = "no sitemap", which exercises the nav fallback.
    monkeypatch.setattr(m, "_fetch_sitemap_text", lambda u: sitemap(u) if callable(sitemap) else sitemap)
    monkeypatch.setattr(m.limiter, "enabled", False)
    m.app.dependency_overrides[m.get_current_user] = _premium_user
    m.app.dependency_overrides[m.require_premium_tier] = _premium_user
    try:
        tc = TestClient(m.app)
        return tc.post("/api/train/discover", data={"url": url})
    finally:
        m.app.dependency_overrides.clear()


def test_discover_fallback_harvests_all_same_domain_pages(monkeypatch):
    """With no sitemap, discovery drops the intent filter and surfaces every
    same-domain link (full-site-discovery plan D1)."""
    resp = _discover(monkeypatch)
    assert resp.status_code == 200
    body = resp.json()
    assert body["entry"]["estimated_words"] > 0
    urls = [c["url"] for c in body["candidates"]]
    assert "https://www.acme.test/contact-us" in urls
    assert "https://www.acme.test/about" in urls
    assert "https://www.acme.test/blog" in urls  # non-intent page now included


_SITEMAP_XML = (
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
    '<url><loc>https://www.acme.test/</loc></url>'
    '<url><loc>https://www.acme.test/pricing</loc></url>'
    '<url><loc>https://www.acme.test/services/design</loc></url>'
    '</urlset>'
)


def test_discover_prefers_sitemap_over_nav_links(monkeypatch):
    """A reachable sitemap drives the candidate list; nav-link harvest is skipped."""
    resp = _discover(
        monkeypatch,
        sitemap=lambda u: _SITEMAP_XML if u.endswith("/sitemap.xml") else None,
    )
    body = resp.json()
    urls = [c["url"] for c in body["candidates"]]
    assert "https://www.acme.test/pricing" in urls
    assert "https://www.acme.test/services/design" in urls
    # /blog is a nav link only, not in the sitemap, so it must not appear.
    assert "https://www.acme.test/blog" not in urls
    labels = {c["label"] for c in body["candidates"]}
    assert "Pricing" in labels  # sitemap candidates are labelled from the path


def test_discover_excludes_offsite_links(monkeypatch):
    resp = _discover(monkeypatch)
    urls = [c["url"] for c in resp.json()["candidates"]]
    assert not any("facebook.com" in u for u in urls)


def test_discover_estimates_exclude_sitewide_jsonld(monkeypatch):
    html = (
        '<html><body><a href="/contact">Contact</a>'
        '<p>Real body copy for the estimate here.</p>'
        '<script type="application/ld+json">'
        '{"@type":"Organization","name":"Acme","telephone":"+15550000000"}'
        '</script></body></html>'
    )
    resp = _discover(monkeypatch, html=html)
    body = resp.json()
    # The candidate estimate is body-only (JSON-LD dedups site-wide to zero), so it
    # is strictly less than the entry's full word count including the JSON-LD block.
    assert body["candidates"][0]["estimated_words"] < body["entry"]["estimated_words"]


def test_discover_marks_counts_as_estimates(monkeypatch):
    resp = _discover(monkeypatch)
    assert "estimate" in resp.json()["estimate_note"].lower()


# ── Crawl fan-out endpoint ───────────────────────────────────────────────────


class _CompanyCursor:
    def execute(self, sql, params=None):
        self._sql = sql

    def fetchone(self):
        if "FROM companies" in self._sql:
            return ("comp-1", "generic")
        return (0,)

    def close(self):
        pass


class _CompanyConn:
    def cursor(self):
        return _CompanyCursor()

    def commit(self):
        pass

    def rollback(self):
        pass


def _train_crawl(monkeypatch, urls_payload):
    captured = {}

    def _capture(fn, *args, **kwargs):
        captured["fn"] = fn
        captured["args"] = args

    async def _noop_status(*a, **k):
        return None

    monkeypatch.setattr(m, "get_db_connection", lambda: _CompanyConn())
    monkeypatch.setattr(m, "release_db_connection", lambda c: None)
    monkeypatch.setattr(m, "get_plan", lambda *a, **k: {"words": 12000})
    monkeypatch.setattr(m, "set_job_status", _noop_status)
    monkeypatch.setattr(m, "validate_safe_url", lambda u: None)
    monkeypatch.setattr(m, "r", None)
    monkeypatch.setattr(m.limiter, "enabled", False)
    monkeypatch.setattr(m.BackgroundTasks, "add_task", lambda self, fn, *a, **k: _capture(fn, *a, **k))
    m.app.dependency_overrides[m.get_current_user] = _premium_user
    m.app.dependency_overrides[m.require_premium_tier] = _premium_user
    try:
        tc = TestClient(m.app)
        resp = tc.post("/api/train", data={"urls": json.dumps(urls_payload), "company_id": "comp-1"})
        return resp, captured
    finally:
        m.app.dependency_overrides.clear()


def test_crawl_fanout_queues_one_crawl_job(monkeypatch):
    resp, captured = _train_crawl(monkeypatch, [
        "https://www.acme.test/",
        "https://www.acme.test/contact-us",
    ])
    assert resp.status_code == 200
    body = resp.json()
    assert body["mode"] == "crawl"
    assert body["page_count"] == 2
    assert captured["fn"] is m.run_crawl_training_job


def test_crawl_dedupes_same_source(monkeypatch):
    resp, captured = _train_crawl(monkeypatch, [
        "https://www.acme.test/contact-us",
        "https://www.acme.test/contact-us/",  # normalises to the same source
    ])
    assert resp.json()["page_count"] == 1


def test_crawl_rejects_mixed_single_and_crawl(monkeypatch):
    monkeypatch.setattr(m, "get_db_connection", lambda: _CompanyConn())
    monkeypatch.setattr(m, "release_db_connection", lambda c: None)
    monkeypatch.setattr(m, "get_plan", lambda *a, **k: {"words": 12000})
    monkeypatch.setattr(m, "validate_safe_url", lambda u: None)
    monkeypatch.setattr(m.limiter, "enabled", False)
    m.app.dependency_overrides[m.get_current_user] = _premium_user
    m.app.dependency_overrides[m.require_premium_tier] = _premium_user
    try:
        tc = TestClient(m.app)
        resp = tc.post("/api/train", data={
            "urls": json.dumps(["https://www.acme.test/a"]),
            "url": "https://www.acme.test/b",
            "company_id": "comp-1",
        })
        assert resp.status_code == 400
    finally:
        m.app.dependency_overrides.clear()


def test_crawl_rejects_malformed_urls_json(monkeypatch):
    resp, _ = _train_crawl(monkeypatch, "not-a-list")
    # json.dumps("not-a-list") is valid JSON but not a list -> 400
    assert resp.status_code == 400


# ── Crawl training job ───────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_crawl_job_shares_dedup_across_pages(monkeypatch):
    shared = "Shared navigation and footer boilerplate that repeats on every page"
    page_a = f"<body><nav><p>{shared}</p></nav><p>Page A has its own distinct paragraph of body copy here</p></body>"
    page_b = f"<body><nav><p>{shared}</p></nav><p>Page B has its own distinct paragraph of body copy here</p></body>"
    htmls = {"https://s.test/a": page_a, "https://s.test/b": page_b}

    async def _fake_fetch(page_url):
        return htmls[page_url]

    trained_docs = []

    async def _fake_run_training_job(job_id, company_id, docs, *a, **k):
        trained_docs.append((job_id, docs[0].page_content))
        await m.set_job_status(job_id, {"status": "done", "chunks_added": 5})

    statuses = {}

    async def _set_status(job_id, status):
        statuses[job_id] = status

    async def _get_status(job_id):
        return statuses.get(job_id)

    monkeypatch.setattr(m, "_fetch_url_html", _fake_fetch)
    monkeypatch.setattr(m, "run_training_job", _fake_run_training_job)
    monkeypatch.setattr(m, "set_job_status", _set_status)
    monkeypatch.setattr(m, "get_job_status", _get_status)
    monkeypatch.setattr(m, "_source_exists", lambda c, s: False)
    monkeypatch.setattr(m, "r", None)

    await m.run_crawl_training_job(
        "crawl-1", "comp-1",
        [("https://s.test/a", "s.test/a"), ("https://s.test/b", "s.test/b")],
        _premium_user(), 12000,
    )

    a_text = next(t for jid, t in trained_docs if t and "Page A" in t)
    b_text = next(t for jid, t in trained_docs if t and "Page B" in t)
    assert shared in a_text
    assert shared not in b_text  # deduped across pages

    final = statuses["crawl-1"]
    assert final["status"] == "done"
    assert len(final["trained"]) == 2
    assert final["chunks_added"] == 10


@pytest.mark.asyncio
async def test_crawl_job_reports_quota_skips_and_fetch_failures(monkeypatch):
    async def _fake_fetch(page_url):
        if "bad" in page_url:
            raise m.HTTPException(status_code=400, detail="Failed to extract sufficient text from the URL.")
        return "<body><p>Good page body copy that is comfortably longer than the fifty character floor.</p></body>"

    async def _fake_run_training_job(job_id, company_id, docs, *a, **k):
        # Simulate quota already exhausted: nothing stored.
        await m.set_job_status(job_id, {"status": "done", "chunks_added": 0})

    statuses = {}

    async def _set_status(job_id, status):
        statuses[job_id] = status

    async def _get_status(job_id):
        return statuses.get(job_id)

    monkeypatch.setattr(m, "_fetch_url_html", _fake_fetch)
    monkeypatch.setattr(m, "run_training_job", _fake_run_training_job)
    monkeypatch.setattr(m, "set_job_status", _set_status)
    monkeypatch.setattr(m, "get_job_status", _get_status)
    monkeypatch.setattr(m, "_source_exists", lambda c, s: False)
    monkeypatch.setattr(m, "r", None)

    await m.run_crawl_training_job(
        "crawl-2", "comp-1",
        [("https://s.test/good", "s.test/good"), ("https://s.test/bad", "s.test/bad")],
        _premium_user(), 12000,
    )

    final = statuses["crawl-2"]
    assert final["status"] == "done"
    assert [s["url"] for s in final["skipped_quota"]] == ["https://s.test/good"]
    assert [f["url"] for f in final["failed"]] == ["https://s.test/bad"]
