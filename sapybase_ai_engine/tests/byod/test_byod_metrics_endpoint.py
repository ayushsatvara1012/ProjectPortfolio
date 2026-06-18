"""GET /metrics scrape-token gate (BYOD readiness 2.2).

On a public Render web service a single path can't be made network-private, so the
scrape is protected by METRICS_SCRAPE_TOKEN: open when unset (pre-prod), 403 without
the token when set, 200 with it (Authorization: Bearer … or x-metrics-token).
"""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient


@pytest.fixture(scope="module")
def app_client():
    import main

    return main, TestClient(main.app)


def test_metrics_open_when_token_unset(app_client, monkeypatch):
    main, client = app_client
    monkeypatch.setattr(main, "METRICS_SCRAPE_TOKEN", "")
    assert client.get("/metrics").status_code == 200


def test_metrics_gated_when_token_set(app_client, monkeypatch):
    main, client = app_client
    monkeypatch.setattr(main, "METRICS_SCRAPE_TOKEN", "secret123")
    # No / wrong token → rejected.
    assert client.get("/metrics").status_code == 403
    assert client.get("/metrics", headers={"x-metrics-token": "nope"}).status_code == 403
    assert client.get("/metrics", headers={"Authorization": "Bearer wrong"}).status_code == 403
    # Correct token via either header → allowed.
    assert client.get("/metrics", headers={"Authorization": "Bearer secret123"}).status_code == 200
    assert client.get("/metrics", headers={"x-metrics-token": "secret123"}).status_code == 200
