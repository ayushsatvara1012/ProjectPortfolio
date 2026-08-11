"""``TurnResult`` - the one object every layer of the runtime returns and reads.

docs/agent-runtime-restructure-plan.md §2. Today the same information is spread
across a bare answer string, ``is_unanswered``, ``confidence``, the ``_captured``
dict and a separate sources list, none of which agree with each other; the
restructure replaces all of them with this.
"""
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from .states import RefusalCause, TurnState


@dataclass
class ToolCall:
    """One tool invocation the loop actually performed, in order."""

    name: str
    args: Dict[str, Any] = field(default_factory=dict)
    status: str = ""
    error: Optional[str] = None


@dataclass
class TurnEvent:
    """A side-channel emission for the client (a quote card, an SDS panel, an
    escalation form). A list, not a single slot per type - two quotes in one turn
    are two entries (plan §6, audit B4)."""

    type: str
    payload: Dict[str, Any] = field(default_factory=dict)


@dataclass
class TurnResult:
    """The settled outcome of one visitor turn."""

    state: TurnState
    text: str = ""
    cause: Optional[RefusalCause] = None
    #: Owner-facing attribution entries, same dict shape ``chat_logs.sources`` stores.
    sources: List[Dict[str, Any]] = field(default_factory=list)
    tool_trace: List[ToolCall] = field(default_factory=list)
    events: List[TurnEvent] = field(default_factory=list)
    #: The conversation topic this outcome belongs to, for the rule-8 check.
    topic: Optional[str] = None

    def __post_init__(self) -> None:
        if self.state == TurnState.ANSWERED and not self.sources:
            raise ValueError("ANSWERED requires at least one source (rule 3)")
        if self.state in (TurnState.NO_DATA, TurnState.SYSTEM_ERROR) and self.cause is None:
            raise ValueError(f"{self.state.value} requires a refusal cause")

    @property
    def is_escalating(self) -> bool:
        return any(e.type == "escalate" for e in self.events)

    def add_event(self, type: str, **payload: Any) -> "TurnResult":
        self.events.append(TurnEvent(type=type, payload=payload))
        return self

    def add_source(self, **source: Any) -> "TurnResult":
        self.sources.append(source)
        return self
