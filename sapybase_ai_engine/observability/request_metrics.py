"""Shared/tenant HTTP request-metrics middleware (Phase 1.2, §16.9).

Emits ``sapybase_http_requests_total`` + ``sapybase_http_request_duration_seconds``
for EVERY request — the numerator/denominator of the shared-plane error-rate
regression gate and the dashboard latency panels. Kept in its own import-light
module (no ``main`` dependency) so it is unit-testable against a minimal app.

Implemented as a **pure ASGI middleware** (not Starlette's ``BaseHTTPMiddleware``)
on purpose: BaseHTTPMiddleware runs the downstream app in a child task, so neither
``request.state`` nor contextvars set by the endpoint propagate back up to it — the
tenant-plane tag would silently never take effect. A pure ASGI middleware shares
the very same ``scope`` with the endpoint and adds no task boundary, so the plane
tag set by a handler on ``request.state`` (i.e. ``scope['state']``) is visible here.

Labels:
  * ``route`` — the matched path template (``scope['route'].path_format``), NOT the
    raw URL, so per-path-param cardinality cannot explode. Unmatched requests
    (404s) collapse to ``"unmatched"``.
  * ``status_class`` — 2xx/4xx/5xx (a handler exception is recorded as 5xx).
  * ``plane`` / ``company_id`` — default ("shared", ""); a handler that routes to a
    BYOD tenant DB upgrades them to ("tenant", <cid>) via ``request.state``.

Fail-soft: the metrics façade swallows its own errors, so instrumentation can
never break request handling.
"""
from __future__ import annotations

import time


class RequestMetricsMiddleware:
    """Pure ASGI middleware emitting per-request rate + latency with plane labels."""

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        from . import metrics

        status_code = 500  # if the app raises before responding → 5xx

        async def send_wrapper(message):
            nonlocal status_code
            if message["type"] == "http.response.start":
                status_code = message["status"]
            await send(message)

        start = time.perf_counter()
        try:
            await self.app(scope, receive, send_wrapper)
        finally:
            elapsed = time.perf_counter() - start
            route_obj = scope.get("route")
            route = getattr(route_obj, "path_format", None) or "unmatched"
            # Handlers tag tenant traffic on request.state, i.e. scope["state"].
            state = scope.get("state") or {}
            plane = state.get("metrics_plane", "shared")
            company_id = state.get("metrics_company_id", "") or ""
            status_class = f"{status_code // 100}xx"
            metrics.http_request(route, status_class, plane, company_id)
            metrics.observe_http_duration(route, plane, company_id, elapsed)
