"""Tests for validate_safe_url — SSRF protection."""
import ipaddress
import socket
from unittest.mock import patch, MagicMock

import pytest
from fastapi import HTTPException


def _import_fn():
    # Import lazily so conftest env vars are set first
    from main import validate_safe_url
    return validate_safe_url


def make_gethostbyname(ip: str):
    return lambda host: ip


class TestValidateSafeUrl:
    def test_rejects_ftp_scheme(self):
        fn = _import_fn()
        with pytest.raises(HTTPException) as exc:
            fn("ftp://example.com/file")
        assert exc.value.status_code == 400
        assert "HTTP/HTTPS" in exc.value.detail

    def test_rejects_file_scheme(self):
        fn = _import_fn()
        with pytest.raises(HTTPException):
            fn("file:///etc/passwd")

    def test_rejects_empty_hostname(self):
        fn = _import_fn()
        with pytest.raises(HTTPException) as exc:
            fn("https://")
        assert exc.value.status_code == 400

    def test_rejects_localhost_loopback(self):
        fn = _import_fn()
        with patch("socket.gethostbyname", make_gethostbyname("127.0.0.1")):
            with pytest.raises(HTTPException) as exc:
                fn("http://localhost/api")
            assert "internal" in exc.value.detail.lower() or "private" in exc.value.detail.lower()

    def test_rejects_private_192_range(self):
        fn = _import_fn()
        with patch("socket.gethostbyname", make_gethostbyname("192.168.1.100")):
            with pytest.raises(HTTPException):
                fn("http://192.168.1.100/data")

    def test_rejects_private_10_range(self):
        fn = _import_fn()
        with patch("socket.gethostbyname", make_gethostbyname("10.0.0.1")):
            with pytest.raises(HTTPException):
                fn("http://internal.corp/service")

    def test_rejects_link_local(self):
        fn = _import_fn()
        with patch("socket.gethostbyname", make_gethostbyname("169.254.169.254")):
            with pytest.raises(HTTPException):
                fn("http://169.254.169.254/latest/meta-data/")

    def test_rejects_unresolvable_hostname(self):
        fn = _import_fn()
        with patch("socket.gethostbyname", side_effect=socket.gaierror("Name not known")):
            with pytest.raises(HTTPException) as exc:
                fn("https://this-domain-does-not-exist-xyz.com")
            assert exc.value.status_code == 400

    def test_accepts_public_https_url(self):
        fn = _import_fn()
        with patch("socket.gethostbyname", make_gethostbyname("93.184.216.34")):
            # Should not raise
            fn("https://example.com/page")

    def test_accepts_public_http_url(self):
        fn = _import_fn()
        with patch("socket.gethostbyname", make_gethostbyname("8.8.8.8")):
            fn("http://dns.google/")


def _make_getaddrinfo(*ips):
    """Fake socket.getaddrinfo returning the given IPs as AF_INET sockaddrs."""
    return lambda host, port, *a, **k: [
        (socket.AF_INET, socket.SOCK_STREAM, 6, "", (ip, 0)) for ip in ips
    ]


class TestUrlResolvesToPublicIp:
    """Phase 2.3 — non-raising SSRF guard for the owner-configured sheet sink."""

    def _fn(self):
        from main import _url_resolves_to_public_ip
        return _url_resolves_to_public_ip

    def test_rejects_non_http_scheme(self):
        assert self._fn()("ftp://example.com/x") is False
        assert self._fn()("file:///etc/passwd") is False

    def test_rejects_empty_host(self):
        assert self._fn()("https://") is False

    def test_rejects_loopback(self):
        with patch("socket.getaddrinfo", _make_getaddrinfo("127.0.0.1")):
            assert self._fn()("http://localhost/hook") is False

    def test_rejects_private_ranges(self):
        for ip in ("10.0.0.1", "192.168.1.5", "172.16.0.9"):
            with patch("socket.getaddrinfo", _make_getaddrinfo(ip)):
                assert self._fn()(f"https://internal.example/hook") is False

    def test_rejects_link_local_metadata_ip(self):
        with patch("socket.getaddrinfo", _make_getaddrinfo("169.254.169.254")):
            assert self._fn()("http://169.254.169.254/latest/meta-data/") is False

    def test_rejects_if_any_resolved_ip_is_private(self):
        # DNS returning a mix (public + private) must be blocked — the private one wins.
        with patch("socket.getaddrinfo", _make_getaddrinfo("8.8.8.8", "10.0.0.1")):
            assert self._fn()("https://rebind.example/hook") is False

    def test_rejects_unresolvable(self):
        with patch("socket.getaddrinfo", side_effect=socket.gaierror("nope")):
            assert self._fn()("https://does-not-exist-xyz.example/hook") is False

    def test_accepts_public_host(self):
        with patch("socket.getaddrinfo", _make_getaddrinfo("93.184.216.34")):
            assert self._fn()("https://script.google.com/macros/s/xxx/exec") is True
