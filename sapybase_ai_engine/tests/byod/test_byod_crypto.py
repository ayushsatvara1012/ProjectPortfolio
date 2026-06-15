"""Phase 1.3 test gate: DSN envelope encryption (KMS) + versioned key id.

Exit criteria (RFC docs/rfc-byod.md §13, Phase 1.3):
    "Encrypt->decrypt round-trip; ciphertext != plaintext; rotation re-encrypts."

The crypto tests are pure (no database) and run everywhere. A second layer
exercises the store integration (encrypt->persist->load->decrypt, plus key
rotation against a stored row) on a real ephemeral Postgres, skipping cleanly
when no backend is available.
"""
from __future__ import annotations

import base64
import os

import pytest

import byod_crypto
from byod_crypto import (
    DecryptionError,
    EncryptedDsn,
    KmsUnavailable,
    LocalKmsProvider,
    UnknownKeyId,
    decrypt_dsn,
    encrypt_dsn,
    generate_master_key_b64,
    kms_from_env,
    load_decrypted_dsn,
    mask_dsn,
    rotate_dsn,
    rotate_stored_dsn,
    store_encrypted_dsn,
)
from byod_store import TenantDbStatus, get_tenant_db_record

DSN = "postgresql://app_user:s3cr3t-pw@db.acme-tenant.example.com:5432/tenantdb?sslmode=verify-full"
COMPANY_A = "00000000-0000-4000-8000-00000000000a"
COMPANY_B = "00000000-0000-4000-8000-00000000000b"


def _key() -> bytes:
    return os.urandom(32)


def _kms(active: str = "v1", **extra: bytes) -> LocalKmsProvider:
    keys = {"v1": _key(), **extra}
    return LocalKmsProvider(keys, active)


# ── Pure crypto: round-trip & ciphertext properties ──────────────────────────

class TestRoundTrip:
    def test_encrypt_decrypt_roundtrip(self):
        kms = _kms()
        enc = encrypt_dsn(DSN, COMPANY_A, kms)
        assert decrypt_dsn(enc, COMPANY_A, kms) == DSN

    def test_ciphertext_differs_from_plaintext(self):
        kms = _kms()
        enc = encrypt_dsn(DSN, COMPANY_A, kms)
        assert enc.ciphertext != DSN.encode()
        # The plaintext (and the secret password) must not survive anywhere in the blob.
        for blob in (enc.ciphertext, enc.data_key, enc.nonce):
            assert b"s3cr3t-pw" not in blob
            assert DSN.encode() not in blob

    def test_encryption_is_nondeterministic(self):
        kms = _kms()
        a = encrypt_dsn(DSN, COMPANY_A, kms)
        b = encrypt_dsn(DSN, COMPANY_A, kms)
        # Fresh DEK + nonce each time → different ciphertext/nonce/wrapped-key…
        assert a.ciphertext != b.ciphertext
        assert a.nonce != b.nonce
        assert a.data_key != b.data_key
        # …yet both decrypt back to the same plaintext.
        assert decrypt_dsn(a, COMPANY_A, kms) == decrypt_dsn(b, COMPANY_A, kms) == DSN

    def test_records_active_key_id(self):
        kms = _kms(active="v1")
        assert encrypt_dsn(DSN, COMPANY_A, kms).key_id == "v1"

    def test_empty_plaintext_rejected(self):
        with pytest.raises(ValueError):
            encrypt_dsn("", COMPANY_A, _kms())


class TestTamperAndBinding:
    def test_company_id_is_bound_as_aad(self):
        # A ciphertext for company A must not decrypt under company B (anti cross-tenant).
        kms = _kms()
        enc = encrypt_dsn(DSN, COMPANY_A, kms)
        with pytest.raises(DecryptionError):
            decrypt_dsn(enc, COMPANY_B, kms)

    def test_tampered_ciphertext_fails_closed(self):
        kms = _kms()
        enc = encrypt_dsn(DSN, COMPANY_A, kms)
        flipped = bytearray(enc.ciphertext)
        flipped[0] ^= 0x01
        tampered = EncryptedDsn(bytes(flipped), enc.data_key, enc.nonce, enc.key_id)
        with pytest.raises(DecryptionError):
            decrypt_dsn(tampered, COMPANY_A, kms)

    def test_tampered_wrapped_key_fails_closed(self):
        kms = _kms()
        enc = encrypt_dsn(DSN, COMPANY_A, kms)
        flipped = bytearray(enc.data_key)
        flipped[-1] ^= 0x01
        tampered = EncryptedDsn(enc.ciphertext, bytes(flipped), enc.nonce, enc.key_id)
        with pytest.raises(DecryptionError):
            decrypt_dsn(tampered, COMPANY_A, kms)

    def test_unknown_key_id_fails_closed(self):
        enc = encrypt_dsn(DSN, COMPANY_A, _kms(active="v1"))
        other = LocalKmsProvider({"v2": _key()}, "v2")  # different keyring, no v1
        with pytest.raises(UnknownKeyId):
            decrypt_dsn(enc, COMPANY_A, other)


# ── Rotation (versioned key id; old/new coexist) ─────────────────────────────

class TestRotation:
    def test_rotation_reencrypts_under_active_key(self):
        v2 = _key()
        kms_v1 = _kms(active="v1")
        enc_v1 = encrypt_dsn(DSN, COMPANY_A, kms_v1)

        # Rotation keyring holds both v1 (to read the old record) and v2 (active).
        kms_v2 = LocalKmsProvider({"v1": kms_v1._keys["v1"], "v2": v2}, "v2")
        enc_v2 = rotate_dsn(enc_v1, COMPANY_A, kms_v2)

        assert enc_v2.key_id == "v2"
        assert enc_v2.ciphertext != enc_v1.ciphertext      # genuinely re-encrypted
        assert enc_v2.data_key != enc_v1.data_key
        assert decrypt_dsn(enc_v2, COMPANY_A, kms_v2) == DSN  # still the same secret

    def test_old_key_alone_cannot_read_rotated_record(self):
        kms_v1 = _kms(active="v1")
        enc_v1 = encrypt_dsn(DSN, COMPANY_A, kms_v1)
        kms_v2 = LocalKmsProvider({"v1": kms_v1._keys["v1"], "v2": _key()}, "v2")
        enc_v2 = rotate_dsn(enc_v1, COMPANY_A, kms_v2)
        # A node that only has the retired v1 key cannot decrypt the rotated record.
        with pytest.raises(UnknownKeyId):
            decrypt_dsn(enc_v2, COMPANY_A, kms_v1)

    def test_versioned_keys_coexist_during_rollout(self):
        # Mid-rotation a node holds both keys and must read old AND new records.
        k1, k2 = _key(), _key()
        old_record = encrypt_dsn(DSN, COMPANY_A, LocalKmsProvider({"v1": k1}, "v1"))
        both = LocalKmsProvider({"v1": k1, "v2": k2}, "v2")
        new_record = encrypt_dsn(DSN, COMPANY_B, both)
        assert decrypt_dsn(old_record, COMPANY_A, both) == DSN
        assert decrypt_dsn(new_record, COMPANY_B, both) == DSN


# ── KMS provider config / env ────────────────────────────────────────────────

class TestKmsProvider:
    def test_rejects_wrong_length_key(self):
        with pytest.raises(KmsUnavailable):
            LocalKmsProvider({"v1": b"too-short"}, "v1")

    def test_rejects_active_not_in_keyring(self):
        with pytest.raises(KmsUnavailable):
            LocalKmsProvider({"v1": _key()}, "v2")

    def test_rejects_empty_keyring(self):
        with pytest.raises(KmsUnavailable):
            LocalKmsProvider({}, "v1")

    def test_generate_master_key_is_32_bytes(self):
        assert len(base64.b64decode(generate_master_key_b64())) == 32

    def test_from_env_roundtrip(self, monkeypatch):
        keys = {"v1": generate_master_key_b64(), "v2": generate_master_key_b64()}
        monkeypatch.setenv("BYOD_KMS_MASTER_KEYS", _json(keys))
        monkeypatch.setenv("BYOD_KMS_ACTIVE_KEY_ID", "v2")
        kms = kms_from_env()
        assert kms.active_key_id == "v2"
        enc = encrypt_dsn(DSN, COMPANY_A, kms)
        assert enc.key_id == "v2"
        assert decrypt_dsn(enc, COMPANY_A, kms) == DSN

    def test_from_env_unset_fails_closed(self, monkeypatch):
        monkeypatch.delenv("BYOD_KMS_MASTER_KEYS", raising=False)
        monkeypatch.delenv("BYOD_KMS_ACTIVE_KEY_ID", raising=False)
        with pytest.raises(KmsUnavailable):
            kms_from_env()

    def test_from_env_malformed_fails_closed(self, monkeypatch):
        monkeypatch.setenv("BYOD_KMS_MASTER_KEYS", "not-json")
        monkeypatch.setenv("BYOD_KMS_ACTIVE_KEY_ID", "v1")
        with pytest.raises(KmsUnavailable):
            kms_from_env()


# ── Masking & no-leak discipline ─────────────────────────────────────────────

class TestMaskingAndLeaks:
    def test_mask_hides_credentials_and_host_keeps_db(self):
        masked = mask_dsn(DSN)
        assert "s3cr3t-pw" not in masked
        assert "app_user" not in masked
        assert "acme-tenant" not in masked
        assert masked.endswith("/tenantdb")
        assert masked.startswith("postgresql://")

    def test_mask_empty_is_all_bullets(self):
        assert set(mask_dsn("")) == {"•"}
        assert set(mask_dsn(None)) == {"•"}

    def test_encrypted_repr_does_not_leak(self):
        enc = encrypt_dsn(DSN, COMPANY_A, _kms())
        r = repr(enc)
        assert "s3cr3t-pw" not in r
        assert "key_id" in r and "ciphertext_len" in r


def _json(d: dict) -> str:
    import json

    return json.dumps(d)


# ── Store integration (needs Postgres) ───────────────────────────────────────

def test_store_and_load_encrypted_dsn_roundtrip(cp_conn, make_company):
    company_id = make_company()
    kms = _kms()
    with cp_conn.cursor() as cur:
        rec = store_encrypted_dsn(cur, company_id, DSN, kms, status=TenantDbStatus.PENDING)
        # What's persisted is ciphertext — the plaintext/secret never lands in the row.
        assert rec.dsn_ciphertext != DSN.encode()
        assert b"s3cr3t-pw" not in rec.dsn_ciphertext
        loaded = load_decrypted_dsn(cur, company_id, kms)
    cp_conn.commit()
    assert loaded == DSN


def test_load_missing_returns_none(cp_conn):
    import uuid

    with cp_conn.cursor() as cur:
        assert load_decrypted_dsn(cur, str(uuid.uuid4()), _kms()) is None


def test_rotate_stored_dsn_under_new_key(cp_conn, make_company):
    company_id = make_company()
    k1 = _key()
    kms_v1 = LocalKmsProvider({"v1": k1}, "v1")
    with cp_conn.cursor() as cur:
        store_encrypted_dsn(cur, company_id, DSN, kms_v1,
                            status=TenantDbStatus.LIVE, schema_version="0003")
        before = get_tenant_db_record(cur, company_id)

        kms_v2 = LocalKmsProvider({"v1": k1, "v2": _key()}, "v2")
        rotated = rotate_stored_dsn(cur, company_id, kms_v2)
        after = get_tenant_db_record(cur, company_id)
        # Decrypts to the same DSN under the new key.
        assert load_decrypted_dsn(cur, company_id, kms_v2) == DSN
    cp_conn.commit()

    assert before.dsn_key_id == "v1" and after.dsn_key_id == "v2"
    assert after.dsn_ciphertext != before.dsn_ciphertext   # re-encrypted at rest
    # Lifecycle fields preserved across rotation.
    assert after.status == TenantDbStatus.LIVE
    assert after.schema_version == "0003"
    assert rotated.dsn_key_id == "v2"
