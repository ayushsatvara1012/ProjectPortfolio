# BYOD — Client Onboarding Requirements

What a customer must provide and configure to connect their own PostgreSQL database
to Sapybase (the "Build-Your-Own-Database" plan). These are the exact rules the
engine enforces at connection time — see [RFC §4.1 / §5](rfc-byod.md) and
`byod_dsn.py` / `byod_probe.py`.

The customer provides **one thing: a PostgreSQL connection string.** Sapybase does
the rest (schema provisioning, a least-privilege runtime role, credential encryption).

---

## 1. Network — allowlist Sapybase's egress IPs

Sapybase connects to your database from these **static outbound IP ranges**. If your
database firewall restricts inbound connections by source IP, allowlist **both**:

```
74.220.48.0/24
74.220.56.0/24
```

The database host must be **publicly resolvable and reachable** — the engine rejects
hosts that resolve to private, loopback, link-local, or reserved addresses (SSRF /
DNS-rebinding defense, RFC §5.2). A DB reachable only inside a private VPC won't work
unless it's exposed via a public endpoint.

## 2. Transport — TLS is mandatory

The connection string **must** set `sslmode=require` (or the stronger `verify-ca` /
`verify-full`). `disable`, `allow`, `prefer`, or an absent `sslmode` are rejected —
they permit a plaintext fallback. `sslmode` is the **only** query parameter allowed
in the DSN (no `options=`, `passfile=`, etc.).

## 3. Database engine — PostgreSQL + pgvector

- **pgvector ≥ 0.5.0** installed (or installable by the provided role) — required for
  HNSW vector indexes.
- A **`vector(768)`** column must be creatable (Sapybase embeds with a 768-dim model).
- A **fresh / empty database** (no conflicting schema). Sapybase provisions its own
  data-plane schema during onboarding.

## 4. Privileges on the connection string you provide

The role in your DSN is used **once**, for provisioning, and must be able to:
- `CREATE EXTENSION vector` (if pgvector isn't already enabled),
- create the data-plane tables/indexes,
- create a role (Sapybase creates a **DML-only `vaayu_runtime` role** for day-to-day
  traffic — your provisioning credentials are not used for serving requests).

After provisioning, Sapybase **encrypts and stores** the credentials (envelope
encryption / KMS) and connects only over TLS via the locked-down runtime role.

## 5. Connection string format

```
postgresql://USER:PASSWORD@HOST:5432/DBNAME?sslmode=require
```

Paste this into the dashboard once. It is stored encrypted, shown masked, and reused
silently — never re-entered on normal logins. To change it later, use the dashboard's
**Update connection** action (validated + rotated atomically).

---

## Onboarding checklist (give to the client)

- [ ] Allowlist `74.220.48.0/24` and `74.220.56.0/24` on the DB firewall.
- [ ] DB host is publicly reachable over TLS.
- [ ] pgvector ≥ 0.5.0 available; `vector(768)` creatable.
- [ ] A fresh database with no conflicting schema.
- [ ] Provisioning role can create the extension, tables, and a role.
- [ ] Connection string includes `sslmode=require`.
- [ ] DPA / contract covers BYOD data handling.
