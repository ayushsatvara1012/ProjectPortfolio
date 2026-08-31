"""Transport-level tests for ``_fire_sheet_sink`` — the sample-request spreadsheet push.

The case that drove these: a Google Apps Script web app answers a SUCCESSFUL
``doPost`` with a 302 to script.googleusercontent.com (the row is already appended
by then). Read as a non-2xx failure, that both told the owner "Failed · HTTP 302"
about a working sheet and made the retry append a second row on every submission.
"""
import httpx
import pytest

import main as m

URL = "https://script.google.com/macros/s/AKtest/exec"
PAYLOAD = {"event": "sample_request", "fields": {"product": "Acetone"}}


async def _no_sleep(_seconds):
    return None


def _wire(monkeypatch, *statuses):
    """Route every client the helper opens through a MockTransport.

    Returns the list of requests it actually made — its length is the assertion
    that matters for "did we double-post?".
    """
    seen = []

    def handler(request):
        seen.append(request)
        status = statuses[min(len(seen), len(statuses)) - 1]
        return httpx.Response(status, text="ok")

    real_client = httpx.AsyncClient

    def patched(*args, **kwargs):
        kwargs.pop("transport", None)
        return real_client(*args, transport=httpx.MockTransport(handler), **kwargs)

    monkeypatch.setattr(m.httpx, "AsyncClient", patched)
    monkeypatch.setattr(m, "_url_resolves_to_public_ip", lambda _u: True)
    monkeypatch.setattr(m.asyncio, "sleep", _no_sleep)
    return seen


class TestRedirects:
    @pytest.mark.asyncio
    async def test_apps_script_302_is_a_delivery_and_is_not_retried(self, monkeypatch):
        seen = _wire(monkeypatch, 302)
        ok, detail = await m._fire_sheet_sink(URL, "", PAYLOAD)
        assert ok is True
        assert detail == "HTTP 302 (redirect)"
        assert len(seen) == 1  # a second POST here is a duplicate row in the sheet

    @pytest.mark.asyncio
    @pytest.mark.parametrize("status", [301, 303])
    async def test_the_other_body_completing_redirects_also_count(self, monkeypatch, status):
        seen = _wire(monkeypatch, status)
        ok, _ = await m._fire_sheet_sink(URL, "", PAYLOAD)
        assert ok is True and len(seen) == 1

    @pytest.mark.asyncio
    async def test_307_stays_a_failure(self, monkeypatch):
        # 307/308 ask for the body to be re-sent to a location we never follow, so
        # nothing was delivered — the owner must see that.
        seen = _wire(monkeypatch, 307)
        ok, detail = await m._fire_sheet_sink(URL, "", PAYLOAD)
        assert ok is False and detail == "HTTP 307"
        assert len(seen) == 2


class TestOutcomes:
    @pytest.mark.asyncio
    async def test_200_is_delivered_first_try(self, monkeypatch):
        seen = _wire(monkeypatch, 200)
        assert await m._fire_sheet_sink(URL, "", PAYLOAD) == (True, "HTTP 200")
        assert len(seen) == 1

    @pytest.mark.asyncio
    async def test_a_500_retries_once_then_reports_the_status(self, monkeypatch):
        seen = _wire(monkeypatch, 500)
        assert await m._fire_sheet_sink(URL, "", PAYLOAD) == (False, "HTTP 500")
        assert len(seen) == 2

    @pytest.mark.asyncio
    async def test_a_transient_500_then_200_succeeds(self, monkeypatch):
        seen = _wire(monkeypatch, 500, 200)
        assert await m._fire_sheet_sink(URL, "", PAYLOAD) == (True, "HTTP 200")
        assert len(seen) == 2

    @pytest.mark.asyncio
    async def test_an_unconfigured_sink_is_dormant_not_an_error(self, monkeypatch):
        seen = _wire(monkeypatch, 200)
        assert await m._fire_sheet_sink("", "", PAYLOAD) == (False, "not configured")
        assert seen == []

    @pytest.mark.asyncio
    async def test_a_non_public_host_is_blocked_before_any_request(self, monkeypatch):
        seen = _wire(monkeypatch, 200)
        monkeypatch.setattr(m, "_url_resolves_to_public_ip", lambda _u: False)
        ok, detail = await m._fire_sheet_sink("https://internal.local/hook", "", PAYLOAD)
        assert ok is False and "blocked" in detail
        assert seen == []


class TestSigning:
    @pytest.mark.asyncio
    async def test_the_secret_signs_the_exact_body_sent(self, monkeypatch):
        import hashlib
        import hmac as _hmac

        seen = _wire(monkeypatch, 302)
        await m._fire_sheet_sink(URL, "s3cret", PAYLOAD)
        sent = seen[0]
        expected = _hmac.new(b"s3cret", sent.read(), hashlib.sha256).hexdigest()
        assert sent.headers["X-Sapybase-Signature"] == expected

    @pytest.mark.asyncio
    async def test_no_secret_means_no_signature_header(self, monkeypatch):
        seen = _wire(monkeypatch, 302)
        await m._fire_sheet_sink(URL, "", PAYLOAD)
        assert "X-Sapybase-Signature" not in seen[0].headers
