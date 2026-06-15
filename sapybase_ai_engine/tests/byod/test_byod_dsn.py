"""Phase 1.4 test gate: validate_db_url() — SSRF + DNS re-check + DSN allowlist + TLS.

Exit criteria (RFC docs/rfc-byod.md §13, Phase 1.4):
    "Malicious DSNs (private IP, options=, sslrootcert=, rebinding) all rejected;
     valid accepted." (rules E4, §5.2)

All tests are pure: the DNS resolver is injected, so there is no network access
and the SSRF / rebinding cases are fully deterministic.
"""
from __future__ import annotations

import pytest

from byod_dsn import (
    DsnValidationError,
    ValidatedDsn,
    validate_db_url,
)

# A resolver that maps known hosts to fixed IPs; unknown hosts "don't resolve".
_FAKE_DNS = {
    "db.acme-tenant.example.com": ["8.8.8.8"],               # public
    "public.example.com": ["1.1.1.1"],                       # public
    "rebind.evil.example.com": ["10.0.0.5"],                 # public name → private IP
    "split.example.com": ["8.8.8.8", "127.0.0.1"],           # one good, one bad
    "metadata.google.internal": ["169.254.169.254"],
    "localhost": ["127.0.0.1"],
    "mapped.example.com": ["::ffff:10.0.0.1"],               # IPv4-mapped private
}


def fake_resolver(host: str):
    try:
        return _FAKE_DNS[host]
    except KeyError as exc:
        raise DsnValidationError("Database host could not be resolved.") from exc


def _validate(dsn: str):
    return validate_db_url(dsn, resolver=fake_resolver)


GOOD = "postgresql://app_user:s3cr3t-pw@db.acme-tenant.example.com:5432/tenantdb?sslmode=verify-full"


# ── Valid DSNs are accepted ───────────────────────────────────────────────────
class TestValidAccepted:
    def test_verify_full_accepted(self):
        result = _validate(GOOD)
        assert isinstance(result, ValidatedDsn)
        assert result.host == "db.acme-tenant.example.com"
        assert result.port == 5432
        assert result.dbname == "tenantdb"
        assert result.user == "app_user"
        assert result.sslmode == "verify-full"
        assert result.resolved_ips == ("8.8.8.8",)

    def test_sslmode_require_is_minimum(self):
        assert _validate(
            "postgresql://u:p@public.example.com/db?sslmode=require"
        ).sslmode == "require"

    def test_verify_ca_accepted(self):
        assert _validate(
            "postgres://u:p@public.example.com/db?sslmode=verify-ca"
        ).sslmode == "verify-ca"

    def test_default_port_applied(self):
        assert _validate(
            "postgresql://u:p@public.example.com/db?sslmode=require"
        ).port == _DEFAULT()

    def test_password_never_exposed_in_repr(self):
        result = _validate(GOOD)
        assert "s3cr3t-pw" not in repr(result)

    def test_multiple_public_ips_accepted(self):
        # Re-point split host to two public addresses for this case.
        result = validate_db_url(
            "postgresql://u:p@public.example.com/db?sslmode=require",
            resolver=lambda h: ["8.8.4.4", "9.9.9.9"],
        )
        assert set(result.resolved_ips) == {"8.8.4.4", "9.9.9.9"}


def _DEFAULT():
    from byod_dsn import _DEFAULT_PG_PORT
    return _DEFAULT_PG_PORT


# ── TLS enforcement (§5.3, rule 9) ────────────────────────────────────────────
class TestTlsRequired:
    @pytest.mark.parametrize("mode", ["disable", "allow", "prefer"])
    def test_weak_sslmodes_rejected(self, mode):
        with pytest.raises(DsnValidationError):
            _validate(f"postgresql://u:p@public.example.com/db?sslmode={mode}")

    def test_missing_sslmode_rejected(self):
        with pytest.raises(DsnValidationError):
            _validate("postgresql://u:p@public.example.com/db")

    def test_unknown_sslmode_rejected(self):
        with pytest.raises(DsnValidationError):
            _validate("postgresql://u:p@public.example.com/db?sslmode=bananas")

    def test_duplicate_sslmode_rejected(self):
        with pytest.raises(DsnValidationError):
            _validate(
                "postgresql://u:p@public.example.com/db?sslmode=require&sslmode=disable"
            )


# ── DSN parameter allowlist (E4) ──────────────────────────────────────────────
class TestParamAllowlist:
    @pytest.mark.parametrize(
        "param",
        [
            "options=-c%20search_path%3Dpublic",  # arbitrary server-side GUCs
            "sslrootcert=/etc/passwd",
            "sslcert=/tmp/x.crt",
            "sslkey=/tmp/x.key",
            "host=evil.internal",                  # redirect past SSRF check
            "hostaddr=10.0.0.1",
            "service=prod",
            "passfile=/root/.pgpass",
            "target_session_attrs=read-write",
            "gssencmode=disable",
        ],
    )
    def test_disallowed_params_rejected(self, param):
        with pytest.raises(DsnValidationError):
            _validate(
                f"postgresql://u:p@public.example.com/db?sslmode=require&{param}"
            )

    def test_options_alone_rejected(self):
        with pytest.raises(DsnValidationError):
            _validate(
                "postgresql://u:p@public.example.com/db?options=-c%20statement_timeout%3D0&sslmode=require"
            )


# ── SSRF: host blocklist + resolved-IP re-check (§5.2, rule 8) ────────────────
class TestSsrf:
    @pytest.mark.parametrize(
        "host",
        [
            "127.0.0.1",
            "10.1.2.3",
            "192.168.0.5",
            "172.16.4.9",
            "169.254.169.254",   # cloud metadata
            "0.0.0.0",
            "[::1]",             # IPv6 loopback literal
            "localhost",
        ],
    )
    def test_private_and_loopback_hosts_rejected(self, host):
        with pytest.raises(DsnValidationError):
            validate_db_url(
                f"postgresql://u:p@{host}:5432/db?sslmode=require",
                # literal IPs/loopback resolve to themselves
                resolver=lambda h: [h.strip("[]")] if h not in _FAKE_DNS else _FAKE_DNS[h],
            )

    def test_internal_suffix_host_rejected(self):
        with pytest.raises(DsnValidationError):
            _validate("postgresql://u:p@db.corp.internal/db?sslmode=require")

    def test_metadata_hostname_rejected(self):
        with pytest.raises(DsnValidationError):
            _validate("postgresql://u:p@metadata.google.internal/db?sslmode=require")

    def test_dns_rebinding_public_name_private_ip_rejected(self):
        # Host is not on the textual blocklist, but resolves to a private IP.
        with pytest.raises(DsnValidationError):
            _validate("postgresql://u:p@rebind.evil.example.com/db?sslmode=require")

    def test_split_horizon_one_bad_ip_rejected(self):
        # All resolved IPs must be public; a single private answer fails closed.
        with pytest.raises(DsnValidationError):
            _validate("postgresql://u:p@split.example.com/db?sslmode=require")

    def test_ipv4_mapped_ipv6_private_rejected(self):
        with pytest.raises(DsnValidationError):
            _validate("postgresql://u:p@mapped.example.com/db?sslmode=require")

    def test_unresolvable_host_rejected(self):
        with pytest.raises(DsnValidationError):
            _validate("postgresql://u:p@nope.example.com/db?sslmode=require")


# ── Shape / scheme / structure ────────────────────────────────────────────────
class TestShape:
    def test_empty_rejected(self):
        with pytest.raises(DsnValidationError):
            _validate("   ")

    @pytest.mark.parametrize(
        "dsn",
        [
            "http://public.example.com/db?sslmode=require",
            "mysql://u:p@public.example.com/db",
            "redis://public.example.com",
        ],
    )
    def test_non_postgres_scheme_rejected(self, dsn):
        with pytest.raises(DsnValidationError):
            _validate(dsn)

    def test_keyword_value_dsn_rejected(self):
        # libpq kv-form is the easy way to smuggle options=; reject it outright.
        with pytest.raises(DsnValidationError):
            _validate("host=public.example.com dbname=db options=-cfoo sslmode=require")

    def test_missing_username_rejected(self):
        with pytest.raises(DsnValidationError):
            _validate("postgresql://public.example.com/db?sslmode=require")

    def test_missing_password_rejected(self):
        with pytest.raises(DsnValidationError):
            _validate("postgresql://justuser@public.example.com/db?sslmode=require")

    def test_missing_dbname_rejected(self):
        with pytest.raises(DsnValidationError):
            _validate("postgresql://u:p@public.example.com/?sslmode=require")

    def test_multi_segment_path_rejected(self):
        with pytest.raises(DsnValidationError):
            _validate("postgresql://u:p@public.example.com/db/extra?sslmode=require")

    def test_invalid_port_rejected(self):
        with pytest.raises(DsnValidationError):
            _validate("postgresql://u:p@public.example.com:notaport/db?sslmode=require")


# ── No credential leakage in error messages (rule 7) ──────────────────────────
def test_error_messages_never_contain_password():
    bad = "postgresql://u:sup3r-secret@10.0.0.1/db?sslmode=disable"
    with pytest.raises(DsnValidationError) as ei:
        validate_db_url(bad, resolver=lambda h: ["10.0.0.1"])
    assert "sup3r-secret" not in str(ei.value)
