"""One place per tool: dispatch + capture shape + availability + status phrase.

docs/agent-runtime-restructure-plan.md §3. Adding or changing a tool used to mean
editing six unrelated places with nothing enforcing that they agreed - which is how
``get_coa`` came to be advertised to bots with no Drive folder configured (audit B10).
A pack still declares WHICH tools a vertical gets (``load_pack`` stays the source of
truth, per CLAUDE.md's no-hardcoded-vertical rule); this module declares HOW each one
behaves, and :func:`assert_registry_covers_packs` turns a mismatch between the two
into a boot-time error instead of a silent drift.

The runtime object is ``RuntimeTool``, deliberately not ``ToolSpec`` - that name is
already the pack-side declaration in ``packs/schema.py``, and the two are different
halves of the same tool.
"""
import inspect
import logging
from dataclasses import dataclass, field
from typing import Any, Awaitable, Callable, Dict, List, Optional, Tuple, Union

logger = logging.getLogger(__name__)

Observation = Dict[str, Any]


@dataclass
class ToolContext:
    """Everything a tool may need, assembled once per turn by the caller.

    ``runners`` holds callables the runtime cannot own itself - today only
    ``get_coa``, whose throttle/lockout wiring still lives in ``main.py``. Keeping
    it a generic mapping means no tool is special-cased in this dataclass.
    """

    company: Dict[str, Any]
    cursor: Any = None
    session_id: Optional[str] = None
    visitor_id: Optional[str] = None
    client_ip: Optional[str] = None
    coa_configured: bool = False
    runners: Dict[str, Callable] = field(default_factory=dict)

    @property
    def company_id(self) -> Any:
        return self.company.get("id")


@dataclass(frozen=True)
class RuntimeTool:
    """How one tool behaves, in one object.

    ``execute``  - (ctx, args) -> observation, sync or awaitable.
    ``capture``  - (args, observation) -> patch merged into the turn's capture dict;
                   the widget cards, the owner handoff and the sales funnel all read
                   that dict, so this is the single place a tool's UI/funnel effect
                   is defined. Keys it may emit are declared in ``capture_keys`` and
                   enforced, so a tool cannot quietly start driving another's card.
    ``available``- (ctx) -> bool. Gates the SCHEMA, so an unavailable tool is never
                   offered to the model in the first place (B10).
    """

    name: str
    execute: Callable[[ToolContext, Dict[str, Any]], Union[Observation, Awaitable[Observation]]]
    status_phrase: str = "Working on it…"
    capture: Optional[Callable[[Dict[str, Any], Observation], Dict[str, Any]]] = None
    capture_keys: Tuple[str, ...] = ()
    available: Callable[[ToolContext], bool] = lambda ctx: True


_REGISTRY: Dict[str, RuntimeTool] = {}


def register(tool: RuntimeTool) -> RuntimeTool:
    if tool.name in _REGISTRY:
        raise ValueError(f"duplicate RuntimeTool registration: {tool.name}")
    _REGISTRY[tool.name] = tool
    return tool


def get(name: str) -> Optional[RuntimeTool]:
    return _REGISTRY.get(name)


def names() -> Tuple[str, ...]:
    return tuple(sorted(_REGISTRY))


def unknown_tool_observation(name: str) -> Observation:
    """The benign error a hallucinated or unwired tool name gets - the model
    recovers and answers normally or escalates, rather than the turn raising."""
    return {
        "status": "error",
        "message": (
            f"Tool '{name}' is not available. Do not use it; answer from what you "
            "have or offer to connect the visitor to the team."
        ),
    }


def status_phrase(name: Optional[str]) -> str:
    tool = _REGISTRY.get(name or "")
    return tool.status_phrase if tool else "Working on it…"


def build_schemas(pack, ctx: Optional[ToolContext] = None) -> List[Dict[str, Any]]:
    """The pack's declared tools as ``bind_tools`` function schemas, minus any the
    context says is unavailable.

    Slots become string parameters; ``required=True`` slots are marked required.
    (``get_sds`` has no individually-required slot - CAS *or* name suffices - so its
    required list is empty; the description tells the model it needs one.)
    """
    schemas: List[Dict[str, Any]] = []
    for tool in pack.tools:
        runtime = _REGISTRY.get(tool.name)
        if ctx is not None and runtime is not None and not runtime.available(ctx):
            continue
        properties: Dict[str, Any] = {}
        required: List[str] = []
        for slot in tool.slots:
            properties[slot.name] = {
                "type": "string",
                "description": slot.description or slot.name,
            }
            if slot.required:
                required.append(slot.name)
        schemas.append(
            {
                "name": tool.name,
                "description": tool.description,
                "parameters": {
                    "type": "object",
                    "properties": properties,
                    "required": required,
                },
            }
        )
    return schemas


def _apply_capture(tool: RuntimeTool, args: Dict[str, Any], obs: Observation,
                   captured: Dict[str, Any]) -> None:
    if tool.capture is None:
        return
    try:
        patch = tool.capture(args, obs) or {}
    except Exception:
        logger.exception("registry: capture for '%s' failed", tool.name)
        return
    stray = set(patch) - set(tool.capture_keys)
    if stray:
        raise ValueError(
            f"tool '{tool.name}' captured undeclared keys {sorted(stray)}; "
            f"declare them in capture_keys"
        )
    captured.update(patch)


def _strip_private(obs: Observation) -> Observation:
    """Drop ``_``-prefixed keys before the observation reaches the model - they are
    capture-only channels (COA's raw rows, its lockout window) and must not be
    serialized into the prompt."""
    if not isinstance(obs, dict):
        return obs
    return {k: v for k, v in obs.items() if not k.startswith("_")}


def executor(ctx: ToolContext, captured: Dict[str, Any]) -> Callable:
    """A ``(tool_name, tool_args) -> observation`` callable for the agent loop.

    Same signature the loop already expects. Async tools (``get_coa`` reaches Google
    Drive) return an awaitable, which the loop awaits rather than blocking the event
    loop the SSE stream runs on.
    """

    def _run(tool_name: str, tool_args: Dict[str, Any]) -> Union[Observation, Awaitable[Observation]]:
        tool = _REGISTRY.get(tool_name)
        if tool is None or not tool.available(ctx):
            return unknown_tool_observation(tool_name)
        args = tool_args or {}
        result = tool.execute(ctx, args)
        if inspect.isawaitable(result):
            async def _await() -> Observation:
                obs = await result
                _apply_capture(tool, args, obs, captured)
                return _strip_private(obs)
            return _await()
        _apply_capture(tool, args, result, captured)
        return _strip_private(result)

    return _run


def assert_registry_covers_packs() -> None:
    """Boot-time check that every pack-declared tool has a RuntimeTool and vice
    versa. This assertion is the actual fix for "keep six files in sync": it turns
    a silent drift into a startup failure."""
    from packs.registry import known_verticals, load_pack

    declared: Dict[str, set] = {}
    for vertical in known_verticals():
        pack = load_pack(vertical)
        if pack is None:
            continue
        for name in pack.tool_names():
            declared.setdefault(name, set()).add(vertical)

    missing = sorted(set(declared) - set(_REGISTRY))
    if missing:
        raise RuntimeError(
            "pack declares tools with no RuntimeTool in services/agent_runtime/"
            f"registry.py: {missing}"
        )
    orphaned = sorted(set(_REGISTRY) - set(declared))
    if orphaned:
        raise RuntimeError(
            f"RuntimeTool registered but no pack declares it: {orphaned}"
        )


from . import tools as _tools  # noqa: E402,F401  (registers every RuntimeTool)
