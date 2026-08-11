"""``get_coa`` - certificate-of-analysis lookup against the owner's Drive folder.

The only async tool: it reaches Google Drive, not Postgres, so its executor returns
an awaitable the loop awaits rather than blocking the SSE event loop.

Two things are deliberate here.
Availability is gated on the company actually having a COA folder configured
(audit B10): the pack declares ``get_coa`` for every chemical bot, so without this
the model was offered a tool that could only ever answer "not set up".
The throttle/lockout wiring still lives in ``main.py`` and is injected as
``ctx.runners["get_coa"]``; a lockout is captured as well as a certificate, so a
visitor inside a cooldown finds the panel already disabled when they reach it from
the conversation rather than discovering it by pressing Request.
"""
from ..registry import RuntimeTool, ToolContext, register, unknown_tool_observation


def _execute(ctx: ToolContext, args: dict):
    runner = ctx.runners.get("get_coa")
    if runner is None:
        return unknown_tool_observation("get_coa")
    return runner(
        ctx.company, args, visitor_id=ctx.visitor_id, client_ip=ctx.client_ip
    )


def _capture(args: dict, obs: dict) -> dict:
    if not isinstance(obs, dict):
        return {}
    rows = obs.get("_rows")
    if rows is not None:
        return {
            "coa": {
                "status": obs.get("status"),
                "results": rows,
                "query": (args.get("query") or "").strip(),
            }
        }
    lockout = obs.get("_lockout")
    if lockout:
        return {
            "coa": {"status": "locked_out", "results": [], "retry_after": lockout}
        }
    return {}


TOOL = register(
    RuntimeTool(
        name="get_coa",
        execute=_execute,
        status_phrase="Looking up the certificate…",
        capture=_capture,
        capture_keys=("coa",),
        available=lambda ctx: bool(ctx.coa_configured),
    )
)
