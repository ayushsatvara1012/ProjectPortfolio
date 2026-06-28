"""BYOD DSN envelope encryption (KMS-backed) + versioned key id.

RFC docs/rfc-byod.md Phase 1.3 (§5.1 credential protection, §16.5 KMS resilience).

Scheme (textbook envelope encryption):
  1. A random per-record **data key** (DEK, 32 bytes) encrypts the DB URL with
     AES-256-GCM (AEAD) -> ``dsn_ciphertext`` + ``dsn_nonce``.
  2. A **KMS-managed master key** wraps that DEK -> ``dsn_data_key`` (the wrap
     nonce is prepended to the wrapped bytes) tagged with a **versioned key id**
     (``dsn_key_id``). Only ciphertext is ever stored (RFC §5.1).
  3. The tenant's ``company_id`` is bound into BOTH layers as AEAD additional
     authenticated data, so a ciphertext is cryptographically pinned to its
     tenant — a row copied to another company_id fails to decrypt (defends
     routing integrity, §6/E5).

These four outputs map 1:1 onto the control-plane columns created in Phase 1.2
(:mod:`byod_store`). Decryption happens **only in memory**, only when needed;
plaintext is never logged, persisted, or returned in a repr (RFC rule 7).

Key rotation (§16.5): a record carries the id of the master key that wrapped its
DEK, so old and new master keys coexist. :func:`rotate_dsn` re-encrypts a record
under the **active** key, producing fresh ciphertext.

KMS abstraction: :class:`KmsProvider` is the seam. :class:`LocalKmsProvider`
(master keys from env) is the default; a real AWS KMS / Vault Transit backend can
drop in behind the same interface without touching callers. The short-lived
decrypted-DSN cache that absorbs KMS blips (§16.5) belongs at connection time
(Phase 1.5) and is intentionally not here.
"""
from __future__ import annotations

import base64
import json
import os
from dataclasses import dataclass
from typing import Optional, Protocol
from urllib.parse import urlparse

from cryptography.exceptions import InvalidTag
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from db import byod_store
from db.byod_store import TenantDbRecord, TenantDbStatus

# AES-256-GCM parameters.
_DEK_BYTES = 32      # 256-bit data key
_NONCE_BYTES = 12    # 96-bit GCM nonce (standard)

_BULLET = "•"  # • — masking glyph for UI display


# ── Errors (fail closed) ─────────────────────────────────────────────────────
class CryptoError(Exception):
    """Base class for all BYOD crypto failures."""


class KmsUnavailable(CryptoError):
    """KMS is not configured / reachable — every BYOD decrypt fails closed (§16.5)."""


class UnknownKeyId(CryptoError):
    """A record references a master key id the KMS keyring does not hold."""


class DecryptionError(CryptoError):
    """Authenticated decryption failed (wrong key, tampered data, or wrong tenant)."""


# ── KMS seam ─────────────────────────────────────────────────────────────────
class KmsProvider(Protocol):
    """Wraps/unwraps a per-record data key under a versioned master key.

    Mirrors the shape of a real KMS (AWS KMS GenerateDataKey/Decrypt, Vault
    Transit) so the local implementation can be swapped out without changing
    callers. ``aad`` binds the wrap to a context (the company_id).
    """

    @property
    def active_key_id(self) -> str: ...

    def wrap_data_key(self, dek: bytes, aad: bytes) -> tuple[bytes, str]:
        """Encrypt ``dek`` under the active master key; return (wrapped, key_id)."""
        ...

    def unwrap_data_key(self, wrapped: bytes, key_id: str, aad: bytes) -> bytes:
        """Decrypt ``wrapped`` using the master key named ``key_id``."""
        ...


class LocalKmsProvider:
    """KMS backed by in-process master keys (from env or constructed in tests).

    The master keys never leave the process; they wrap per-record DEKs with
    AES-256-GCM. Holding multiple keys lets old/new coexist during rotation;
    ``active_key_id`` is the one used for new wraps.
    """

    def __init__(self, keys: dict[str, bytes], active_key_id: str):
        if not keys:
            raise KmsUnavailable("LocalKmsProvider requires at least one master key")
        if active_key_id not in keys:
            raise KmsUnavailable(
                f"active key id {active_key_id!r} is not among configured keys {sorted(keys)}"
            )
        for kid, key in keys.items():
            if len(key) != _DEK_BYTES:
                raise KmsUnavailable(f"master key {kid!r} must be {_DEK_BYTES} bytes, got {len(key)}")
        self._keys = dict(keys)
        self._active = active_key_id

    @property
    def active_key_id(self) -> str:
        return self._active

    def wrap_data_key(self, dek: bytes, aad: bytes) -> tuple[bytes, str]:
        key_id = self._active
        nonce = os.urandom(_NONCE_BYTES)
        wrapped = AESGCM(self._keys[key_id]).encrypt(nonce, dek, aad)
        return nonce + wrapped, key_id  # prepend wrap nonce (no extra column needed)

    def unwrap_data_key(self, wrapped: bytes, key_id: str, aad: bytes) -> bytes:
        master = self._keys.get(key_id)
        if master is None:
            raise UnknownKeyId(f"master key id {key_id!r} not in KMS keyring")
        nonce, body = wrapped[:_NONCE_BYTES], wrapped[_NONCE_BYTES:]
        try:
            return AESGCM(master).decrypt(nonce, body, aad)
        except InvalidTag as exc:
            raise DecryptionError("data key unwrap failed (key/context mismatch)") from exc


def kms_from_env() -> LocalKmsProvider:
    """Build a :class:`LocalKmsProvider` from environment configuration.

    Env (fail-closed — both required):
      * ``BYOD_KMS_MASTER_KEYS`` — JSON object ``{"<key_id>": "<base64 32-byte key>"}``.
      * ``BYOD_KMS_ACTIVE_KEY_ID`` — which key new records are encrypted under.

    Read at call time so rotation can add a key + flip the active id without a
    code change. Raises :class:`KmsUnavailable` if unset/malformed.
    """
    raw = os.getenv("BYOD_KMS_MASTER_KEYS")
    active = os.getenv("BYOD_KMS_ACTIVE_KEY_ID")
    if not raw or not active:
        raise KmsUnavailable(
            "BYOD KMS not configured: set BYOD_KMS_MASTER_KEYS (JSON id->base64 key) "
            "and BYOD_KMS_ACTIVE_KEY_ID."
        )
    try:
        parsed = json.loads(raw)
        keys = {kid: base64.b64decode(b64) for kid, b64 in parsed.items()}
    except (ValueError, TypeError) as exc:
        raise KmsUnavailable(f"BYOD_KMS_MASTER_KEYS is malformed: {exc}") from exc
    return LocalKmsProvider(keys, active)


def generate_master_key_b64() -> str:
    """Helper for operators/tests: a fresh base64-encoded 256-bit master key."""
    return base64.b64encode(os.urandom(_DEK_BYTES)).decode("ascii")


# ── Encrypted record ─────────────────────────────────────────────────────────
@dataclass(frozen=True)
class EncryptedDsn:
    """Envelope-encrypted DSN — maps 1:1 onto the byod_store columns."""

    ciphertext: bytes   # DSN encrypted under the DEK (-> dsn_ciphertext)
    data_key: bytes     # DEK wrapped by the KMS master key (-> dsn_data_key)
    nonce: bytes        # AEAD nonce for the DSN encryption (-> dsn_nonce)
    key_id: str         # versioned master-key id (-> dsn_key_id)

    def __repr__(self) -> str:  # never leak ciphertext bytes into logs/tracebacks
        return f"EncryptedDsn(key_id={self.key_id!r}, ciphertext_len={len(self.ciphertext)})"


def _aad(company_id: str) -> bytes:
    """Additional authenticated data binding a ciphertext to its tenant."""
    return f"byod:company:{company_id}".encode("utf-8")


def encrypt_dsn(plaintext_dsn: str, company_id: str, kms: KmsProvider) -> EncryptedDsn:
    """Envelope-encrypt a DSN for ``company_id`` under the KMS active key."""
    if not plaintext_dsn:
        raise ValueError("plaintext_dsn must be non-empty")
    aad = _aad(company_id)
    dek = os.urandom(_DEK_BYTES)
    nonce = os.urandom(_NONCE_BYTES)
    ciphertext = AESGCM(dek).encrypt(nonce, plaintext_dsn.encode("utf-8"), aad)
    wrapped, key_id = kms.wrap_data_key(dek, aad)
    return EncryptedDsn(ciphertext=ciphertext, data_key=wrapped, nonce=nonce, key_id=key_id)


def decrypt_dsn(enc: EncryptedDsn, company_id: str, kms: KmsProvider) -> str:
    """Recover the plaintext DSN. In-memory only; never log the return value."""
    aad = _aad(company_id)
    dek = kms.unwrap_data_key(enc.data_key, enc.key_id, aad)  # may raise UnknownKeyId/DecryptionError
    try:
        plaintext = AESGCM(dek).decrypt(enc.nonce, enc.ciphertext, aad)
    except InvalidTag as exc:
        raise DecryptionError("DSN decryption failed (tampered ciphertext or wrong tenant)") from exc
    return plaintext.decode("utf-8")


def rotate_dsn(enc: EncryptedDsn, company_id: str, kms: KmsProvider) -> EncryptedDsn:
    """Re-encrypt a record under the KMS **active** key (master-key rotation, §16.5).

    Decrypts with the record's own key id (must still be in the keyring), then
    re-encrypts with a fresh DEK/nonce under the active key — producing new
    ciphertext tagged with the active key id. A no-op-looking call (active id ==
    record id) still rotates the DEK.
    """
    plaintext = decrypt_dsn(enc, company_id, kms)
    return encrypt_dsn(plaintext, company_id, kms)


def mask_dsn(dsn: Optional[str]) -> str:
    """Render a DSN for UI/logs with credentials + host masked (RFC §5.1).

    ``postgresql://user:pass@host:5432/appdb`` -> ``postgresql://••••@••••/appdb``.
    Best-effort: anything unparseable collapses to all-bullets (never leaks).
    """
    if not dsn:
        return _BULLET * 8
    try:
        p = urlparse(dsn)
        scheme = p.scheme or "postgresql"
        db = (p.path or "").lstrip("/")
        masked = f"{scheme}://{_BULLET * 4}@{_BULLET * 4}"
        return f"{masked}/{db}" if db else masked
    except Exception:
        return _BULLET * 8


# ── Store integration ────────────────────────────────────────────────────────
# Thin bridges between the crypto here and the control-plane store (Phase 1.2).
# Kept in this module (not byod_store) so byod_store stays import-light for the
# Alembic migration context. Caller owns the DB transaction (no commit).

def _encrypted_from_record(rec: TenantDbRecord) -> EncryptedDsn:
    if rec.dsn_data_key is None or rec.dsn_nonce is None:
        # A row written before envelope encryption was wired (Phase 1.2 dummy).
        raise CryptoError("record is not envelope-encrypted (missing data_key/nonce)")
    return EncryptedDsn(
        ciphertext=rec.dsn_ciphertext,
        data_key=rec.dsn_data_key,
        nonce=rec.dsn_nonce,
        key_id=rec.dsn_key_id,
    )


def store_encrypted_dsn(
    cur,
    company_id: str,
    plaintext_dsn: str,
    kms: KmsProvider,
    *,
    schema_version: Optional[str] = None,
    status: str = TenantDbStatus.PENDING,
) -> TenantDbRecord:
    """Encrypt ``plaintext_dsn`` and persist it (onboarding / rotation entry point)."""
    enc = encrypt_dsn(plaintext_dsn, company_id, kms)
    return byod_store.store_tenant_db_record(
        cur,
        company_id,
        dsn_ciphertext=enc.ciphertext,
        dsn_key_id=enc.key_id,
        dsn_data_key=enc.data_key,
        dsn_nonce=enc.nonce,
        schema_version=schema_version,
        status=status,
    )


def load_decrypted_dsn(cur, company_id: str, kms: KmsProvider) -> Optional[str]:
    """Resolve + decrypt a tenant DSN, or None if no record. In-memory only."""
    rec = byod_store.get_tenant_db_record(cur, company_id)
    if rec is None:
        return None
    return decrypt_dsn(_encrypted_from_record(rec), company_id, kms)


def _encrypted_from_runtime_record(rec: TenantDbRecord) -> EncryptedDsn:
    if (
        rec.runtime_dsn_ciphertext is None
        or rec.runtime_dsn_data_key is None
        or rec.runtime_dsn_nonce is None
        or rec.runtime_dsn_key_id is None
    ):
        raise CryptoError("record has no envelope-encrypted runtime DSN")
    return EncryptedDsn(
        ciphertext=rec.runtime_dsn_ciphertext,
        data_key=rec.runtime_dsn_data_key,
        nonce=rec.runtime_dsn_nonce,
        key_id=rec.runtime_dsn_key_id,
    )


def store_encrypted_runtime_dsn(
    cur, company_id: str, plaintext_runtime_dsn: str, kms: KmsProvider
) -> bool:
    """Encrypt + persist the DML-only runtime (vaayu_runtime) DSN (RFC §5.4 /
    Phase 2.3). Returns True if the tenant row was updated. The runtime DSN is
    bound to the same ``company_id`` AAD as the migrate DSN; never logged."""
    enc = encrypt_dsn(plaintext_runtime_dsn, company_id, kms)
    return byod_store.set_runtime_dsn(
        cur,
        company_id,
        runtime_dsn_ciphertext=enc.ciphertext,
        runtime_dsn_key_id=enc.key_id,
        runtime_dsn_data_key=enc.data_key,
        runtime_dsn_nonce=enc.nonce,
    )


def load_decrypted_runtime_dsn(cur, company_id: str, kms: KmsProvider) -> Optional[str]:
    """Resolve + decrypt the runtime DSN the engine request path uses (Phase 3),
    or None if no record / no runtime DSN stored yet. In-memory only."""
    rec = byod_store.get_tenant_db_record(cur, company_id)
    if rec is None or rec.runtime_dsn_ciphertext is None:
        return None
    return decrypt_dsn(_encrypted_from_runtime_record(rec), company_id, kms)


def rotate_stored_dsn(cur, company_id: str, kms: KmsProvider) -> Optional[TenantDbRecord]:
    """Re-encrypt the stored DSN under the KMS active key (key-rotation runbook, §16.5).

    Preserves the record's status/schema_version; only the ciphertext + key id
    change. Returns the updated record, or None if the tenant has no record.
    """
    rec = byod_store.get_tenant_db_record(cur, company_id)
    if rec is None:
        return None
    enc = rotate_dsn(_encrypted_from_record(rec), company_id, kms)
    return byod_store.store_tenant_db_record(
        cur,
        company_id,
        dsn_ciphertext=enc.ciphertext,
        dsn_key_id=enc.key_id,
        dsn_data_key=enc.data_key,
        dsn_nonce=enc.nonce,
        schema_version=rec.schema_version,
        status=rec.status,
    )
