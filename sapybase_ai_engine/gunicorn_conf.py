"""Gunicorn config — Prometheus multiprocess lifecycle (readiness 2.1 / RFC §16.9).

With `-w N` workers, each prometheus_client metric lives in its own process, so a
single `/metrics` scrape would otherwise hit one random worker and report a fraction
of reality — and a page-on-any-occurrence counter (routing-integrity, KMS, global
ceiling) could miss an event that landed on an unscraped worker. Setting
`PROMETHEUS_MULTIPROC_DIR` makes every worker write to shared mmap files; the app's
`/metrics` endpoint aggregates them with a MultiProcessCollector.

This config keeps those files correct across the worker lifecycle:
  * on master start — clear stale `.db` files from a previous deploy (old pids).
  * on worker exit  — mark that worker's files dead so a recycled pid never
    double-counts.

Start command (Render):
    gunicorn -c gunicorn_conf.py -w 2 -k uvicorn.workers.UvicornWorker --timeout 120 main:app

If PROMETHEUS_MULTIPROC_DIR is unset, both hooks are no-ops, so this config is safe
to use even before multiprocess mode is enabled.
"""
import os


def on_starting(server):
    """Master boot: ensure the multiprocess dir exists and is free of stale files."""
    d = os.environ.get("PROMETHEUS_MULTIPROC_DIR")
    if not d:
        return
    os.makedirs(d, exist_ok=True)
    for name in os.listdir(d):
        if name.endswith(".db"):
            try:
                os.remove(os.path.join(d, name))
            except OSError:
                pass


def child_exit(server, worker):
    """Worker exit: retire that process's metric files so its pid can't double-count."""
    if not os.environ.get("PROMETHEUS_MULTIPROC_DIR"):
        return
    from prometheus_client import multiprocess

    multiprocess.mark_process_dead(worker.pid)
