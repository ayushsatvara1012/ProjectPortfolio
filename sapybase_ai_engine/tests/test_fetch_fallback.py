"""Direct browser-UA fetch fallback when the Reader is served a challenge page.

docs/bot-output-quality-plan.md §1.4b. expresolv.com answers `r.jina.ai` with a
bot-verification interstitial and a normal browser UA with the real page. Their
/leadership source was recovered by hand exactly this way after a retrain gutted
it; this makes the rescue automatic, for every WAF'd tenant rather than one.

The SSRF tests are the important ones. Jina was an indirection layer, so fetching
server-side ourselves is a new surface - including via redirect, which `requests`
follows by default.
"""
import asyncio
from unittest.mock import AsyncMock, patch

import pytest

import main
from fastapi import HTTPException


INTERSTITIAL = "<html><body><p>Please wait while your request is being verified...</p></body></html>"
REAL_PAGE = (
    "<html><body><h1>Leadership</h1>"
    "<p>Mr.Pratik Shome heads sales at Expresolv and can be reached on 9974561140. "
    "Ms.Ida Sebastian covers the western region for industrial solvents.</p>"
    "</body></html>"
)


class _Resp:
    def __init__(self, body, status=200, url="https://expresolv.com/leadership"):
        self.content = body.encode()
        self.status_code = status
        self.headers = {"Content-Type": "text/html; charset=utf-8"}
        self.url = url


def _run(coro):
    """Drive one coroutine on its OWN loop.

    Not ``get_event_loop()``: by the time the full suite reaches this file another
    test has already consumed the ambient loop, and these pass alone but fail in
    the suite with "no current event loop". ``asyncio.run`` makes a fresh one.
    """
    return asyncio.run(coro)


class TestFallbackTriggering:
    def test_a_usable_jina_body_never_triggers_a_direct_fetch(self):
        # The common path must not double-fetch every page on the platform.
        with patch.object(main, "_fetch_via_jina", new=AsyncMock(return_value=REAL_PAGE)) as jina, \
             patch.object(main, "_fetch_direct_html", new=AsyncMock()) as direct:
            out = _run(main._fetch_url_html("https://expresolv.com/leadership"))
        assert "Pratik Shome" in out
        direct.assert_not_called()
        assert jina.called

    def test_an_interstitial_falls_back_and_returns_the_real_page(self):
        with patch.object(main, "_fetch_via_jina", new=AsyncMock(return_value=INTERSTITIAL)), \
             patch.object(main, "_fetch_direct_html", new=AsyncMock(return_value=REAL_PAGE)):
            out = _run(main._fetch_url_html("https://expresolv.com/leadership"))
        assert "Pratik Shome" in out
        assert "being verified" not in out

    def test_when_both_routes_fail_the_original_body_is_returned(self):
        # A failed rescue must not change the diagnosis the caller's guards give.
        with patch.object(main, "_fetch_via_jina", new=AsyncMock(return_value=INTERSTITIAL)), \
             patch.object(main, "_fetch_direct_html", new=AsyncMock(return_value=None)):
            out = _run(main._fetch_url_html("https://expresolv.com/leadership"))
        assert "being verified" in out

    def test_a_direct_body_that_is_also_a_challenge_is_rejected(self):
        with patch.object(main, "_fetch_via_jina", new=AsyncMock(return_value=INTERSTITIAL)), \
             patch.object(main, "_fetch_direct_html", new=AsyncMock(return_value=INTERSTITIAL)):
            out = _run(main._fetch_url_html("https://x.com/p"))
        assert "being verified" in out


class TestDirectFetchSsrf:
    def test_a_private_host_is_refused_before_any_request(self):
        with patch.object(main, "validate_safe_url",
                          side_effect=HTTPException(status_code=400, detail="private")), \
             patch("main.requests.get") as get:
            assert _run(main._fetch_direct_html("http://169.254.169.254/latest/meta-data")) is None
        get.assert_not_called()

    def test_a_redirect_into_a_blocked_host_is_discarded(self):
        # requests follows redirects by default, so a public host can 302 inward.
        calls = {"n": 0}

        def fake_validate(url):
            calls["n"] += 1
            if calls["n"] > 1:          # the landing URL
                raise HTTPException(status_code=400, detail="private")

        with patch.object(main, "validate_safe_url", side_effect=fake_validate), \
             patch("main.requests.get",
                   return_value=_Resp(REAL_PAGE, url="http://127.0.0.1/admin")):
            assert _run(main._fetch_direct_html("https://public.example.com/p")) is None

    def test_a_same_url_response_is_not_revalidated_twice(self):
        with patch.object(main, "validate_safe_url") as v, \
             patch("main.requests.get", return_value=_Resp(REAL_PAGE)):
            out = _run(main._fetch_direct_html("https://expresolv.com/leadership"))
        assert out and "Pratik Shome" in out
        assert v.call_count == 1


class TestDirectFetchFailureModes:
    def test_a_network_error_returns_none_rather_than_raising(self):
        import requests as rq
        with patch.object(main, "validate_safe_url"), \
             patch("main.requests.get", side_effect=rq.RequestException("boom")):
            assert _run(main._fetch_direct_html("https://x.com/p")) is None

    def test_a_non_200_returns_none(self):
        with patch.object(main, "validate_safe_url"), \
             patch("main.requests.get", return_value=_Resp(REAL_PAGE, status=403)):
            assert _run(main._fetch_direct_html("https://x.com/p")) is None

    def test_an_empty_body_returns_none(self):
        with patch.object(main, "validate_safe_url"), \
             patch("main.requests.get", return_value=_Resp("hi")):
            assert _run(main._fetch_direct_html("https://x.com/p")) is None

    def test_the_browser_ua_is_actually_sent(self):
        # The whole point: SapybaseBot/1.0 is what the WAF rejects.
        with patch.object(main, "validate_safe_url"), \
             patch("main.requests.get", return_value=_Resp(REAL_PAGE)) as get:
            _run(main._fetch_direct_html("https://x.com/p"))
        ua = get.call_args.kwargs["headers"]["User-Agent"]
        assert "Mozilla/5.0" in ua and "Chrome" in ua
        assert "Sapybase" not in ua
