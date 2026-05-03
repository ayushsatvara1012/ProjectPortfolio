"""Tests for normalize_source_url — URL canonicalization."""
import pytest


def _import_fn():
    from main import normalize_source_url
    return normalize_source_url


class TestNormalizeSourceUrl:
    def test_strips_utm_source(self):
        fn = _import_fn()
        result = fn("https://example.com/page?utm_source=google&q=hello")
        assert "utm_source" not in result
        assert "q=hello" in result

    def test_strips_all_utm_params(self):
        fn = _import_fn()
        url = "https://example.com/?utm_source=email&utm_medium=cta&utm_campaign=launch"
        result = fn(url)
        assert "utm_" not in result

    def test_strips_fbclid(self):
        fn = _import_fn()
        result = fn("https://example.com/blog?fbclid=abc123")
        assert "fbclid" not in result

    def test_strips_trailing_slash_from_path(self):
        fn = _import_fn()
        result = fn("https://example.com/docs/")
        assert result == "https://example.com/docs"

    def test_preserves_root_slash(self):
        fn = _import_fn()
        result = fn("https://example.com/")
        assert result == "https://example.com/"

    def test_lowercases_scheme(self):
        fn = _import_fn()
        result = fn("HTTPS://Example.COM/path")
        assert result.startswith("https://")

    def test_lowercases_hostname(self):
        fn = _import_fn()
        result = fn("https://EXAMPLE.COM/page")
        assert "example.com" in result

    def test_strips_fragment(self):
        fn = _import_fn()
        result = fn("https://example.com/page#section-2")
        assert "#" not in result

    def test_preserves_non_tracking_query_params(self):
        fn = _import_fn()
        result = fn("https://example.com/search?q=ai+chatbot&page=2")
        assert "q=ai" in result.replace("+", " ").replace("%20", " ") or "q=" in result
        assert "page=2" in result

    def test_idempotent_on_clean_url(self):
        fn = _import_fn()
        url = "https://example.com/docs/api"
        assert fn(url) == fn(fn(url))

    def test_same_page_different_tracking_normalizes_identically(self):
        fn = _import_fn()
        url_a = "https://blog.example.com/post?utm_source=twitter"
        url_b = "https://blog.example.com/post?utm_source=linkedin&utm_medium=social"
        assert fn(url_a) == fn(url_b)
