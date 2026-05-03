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
