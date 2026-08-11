"""Phase 3: the extracted ReAct loop's boundary cases.

docs/agent-runtime-restructure-plan.md Phase 3. Round exhaustion and the
>max_calls_per_round boundary had no tests at all, which is exactly why B1 and B2
survived in production code. These are those tests.
"""
import asyncio
import json

import pytest
from langchain_core.messages import HumanMessage

from services.agent_runtime.loop import (
    AGENT_FALLBACK_TEXT,
    MAX_CALLS_PER_ROUND,
    run_agent_loop,
    stream_agent_loop,
)


class FakeResp:
    def __init__(self, content="", tool_calls=None, usage_metadata=None):
        self.content = content
        self.tool_calls = tool_calls or []
        if usage_metadata is not None:
            self.usage_metadata = usage_metadata


class FakeModel:
    def __init__(self, responses, raise_on=None):
        self._responses = list(responses)
        self._raise_on = raise_on
        self.invocations = []

    async def ainvoke(self, convo):
        idx = len(self.invocations)
        self.invocations.append(list(convo))
        if self._raise_on is not None and idx == self._raise_on:
            raise RuntimeError("simulated LLM failure")
        return self._responses[idx]


def _run(coro):
    return asyncio.run(coro)


def _calls(n):
    return [{"name": "get_sds", "args": {"product_name": f"p{i}"}, "id": f"c{i}"} for i in range(n)]


def _tool_messages(convo):
    return [m for m in convo if getattr(m, "type", None) == "tool"]


class TestEveryAdvertisedCallGetsAnAnswer:
    """B1: the loop appended an AIMessage advertising N calls but executed only the
    first four, leaving the rest unanswered - the model then answered about a
    product it was never given data for, or Gemini rejected the round outright."""

    def test_a_round_over_budget_still_answers_every_call(self):
        over = MAX_CALLS_PER_ROUND + 2
        model = FakeModel([FakeResp(tool_calls=_calls(over)), FakeResp(content="Done.")])
        executed = []
        out = _run(run_agent_loop(
            model, [], lambda n, a: executed.append(a["product_name"]) or {"status": "found"}
        ))
        assert out == "Done."
        assert len(executed) == MAX_CALLS_PER_ROUND, "budget still bounds real work"
        messages = _tool_messages(model.invocations[1])
        assert len(messages) == over, "every advertised call must get a ToolMessage"

    def test_the_dropped_calls_are_reported_not_silent(self):
        over = MAX_CALLS_PER_ROUND + 1
        model = FakeModel([FakeResp(tool_calls=_calls(over)), FakeResp(content="Done.")])
        _run(run_agent_loop(model, [], lambda n, a: {"status": "found"}))
        last = json.loads(_tool_messages(model.invocations[1])[-1].content)
        assert last["status"] == "not_run"
        assert "not run" in last["message"]

    def test_tool_call_ids_are_preserved_one_to_one(self):
        over = MAX_CALLS_PER_ROUND + 2
        model = FakeModel([FakeResp(tool_calls=_calls(over)), FakeResp(content="Done.")])
        _run(run_agent_loop(model, [], lambda n, a: {"status": "found"}))
        ids = [m.tool_call_id for m in _tool_messages(model.invocations[1])]
        assert ids == [f"c{i}" for i in range(over)]

    def test_a_round_at_the_budget_runs_everything(self):
        model = FakeModel([
            FakeResp(tool_calls=_calls(MAX_CALLS_PER_ROUND)), FakeResp(content="Done.")
        ])
        executed = []
        _run(run_agent_loop(
            model, [], lambda n, a: executed.append(a["product_name"]) or {"status": "found"}
        ))
        assert len(executed) == MAX_CALLS_PER_ROUND
        assert all(
            json.loads(m.content)["status"] == "found"
            for m in _tool_messages(model.invocations[1])
        )

    def test_status_events_are_not_emitted_for_calls_that_never_ran(self):
        over = MAX_CALLS_PER_ROUND + 3
        model = FakeModel([FakeResp(tool_calls=_calls(over)), FakeResp(content="Done.")])

        async def drain():
            return [e async for e in stream_agent_loop(model, [], lambda n, a: {"status": "ok"})]

        events = _run(drain())
        assert len([e for e in events if e["type"] == "status"]) == MAX_CALLS_PER_ROUND


class TestRoundExhaustionComposes:
    """B2: exhaustion threw away a resolved product, a valid SDS URL and a priced
    SKU, and returned the generic 'trouble reaching our product system' line."""

    def _looping(self, rounds=4, then=None):
        looping = FakeResp(tool_calls=[{"name": "get_sds", "args": {}, "id": "c"}])
        return FakeModel([looping] * rounds + ([then] if then else []))

    def test_the_compose_round_sees_the_observations(self):
        model = self._looping(then=FakeResp(content="I found the AR grade only."))
        out = _run(run_agent_loop(model, [], lambda n, a: {"status": "found", "grade": "AR"}))
        assert out == "I found the AR grade only."
        compose_convo = model.invocations[-1]
        assert any('"grade": "AR"' in getattr(m, "content", "") for m in _tool_messages(compose_convo))

    def test_the_compose_round_is_told_not_to_call_tools(self):
        model = self._looping(then=FakeResp(content="ok"))
        _run(run_agent_loop(model, [], lambda n, a: {"status": "found"}))
        last = model.invocations[-1][-1]
        assert isinstance(last, HumanMessage)
        assert "Do not call" in last.content

    def test_an_empty_compose_falls_back(self):
        model = self._looping(then=FakeResp(content=""))
        out = _run(run_agent_loop(model, [], lambda n, a: {"status": "found"}))
        assert out == AGENT_FALLBACK_TEXT

    def test_a_failing_compose_falls_back_rather_than_raising(self):
        model = self._looping(then=FakeResp(content="never reached"))
        model._raise_on = 4
        out = _run(run_agent_loop(model, [], lambda n, a: {"status": "found"}))
        assert out == AGENT_FALLBACK_TEXT

    def test_a_separate_compose_model_is_used_when_given(self):
        model = self._looping()
        composer = FakeModel([FakeResp(content="Composed elsewhere.")])
        out = _run(run_agent_loop(
            model, [], lambda n, a: {"status": "found"}, compose_model=composer
        ))
        assert out == "Composed elsewhere."
        assert len(model.invocations) == 4 and len(composer.invocations) == 1

    def test_no_compose_round_when_no_tool_ever_ran(self):
        # Nothing was gathered, so there is nothing to compose over - don't spend
        # a model call to reword the fallback.
        model = FakeModel([FakeResp(content=""), FakeResp(content="")])
        out = _run(run_agent_loop(model, [], lambda n, a: {}, max_rounds=1))
        assert out == AGENT_FALLBACK_TEXT
        assert len(model.invocations) == 2  # the round + its empty-response retry

    def test_compose_usage_is_metered(self):
        model = self._looping(then=FakeResp(
            content="ok", usage_metadata={"input_tokens": 10, "output_tokens": 5}
        ))
        usage = {}
        _run(run_agent_loop(model, [], lambda n, a: {"status": "found"}, usage_out=usage))
        assert usage["input_tokens"] == 10 and usage["output_tokens"] == 5


class TestStatusPhrasesComeFromTheRegistry:
    def test_a_registered_tool_gets_its_own_phrase(self):
        model = FakeModel([
            FakeResp(tool_calls=[{"name": "request_quote", "args": {}, "id": "c"}]),
            FakeResp(content="Done."),
        ])

        async def drain():
            return [e async for e in stream_agent_loop(model, [], lambda n, a: {"status": "ok"})]

        status = [e for e in _run(drain()) if e["type"] == "status"][0]
        assert status["label"] == "Checking pricing…"


class TestToolTrace:
    """Phase 4: escalation needs to see a `not_found` rather than infer one from
    the wording of the reply, so the loop records what each call returned."""

    def test_every_call_is_recorded_in_order_with_its_status(self):
        model = FakeModel([
            FakeResp(tool_calls=[
                {"name": "get_sds", "args": {"product_name": "acetone"}, "id": "a"},
                {"name": "get_product_spec", "args": {"product_name": "xyz"}, "id": "b"},
            ]),
            FakeResp(content="Done."),
        ])
        statuses = {"get_sds": "found", "get_product_spec": "not_found"}
        trace = []
        _run(run_agent_loop(
            model, [], lambda n, a: {"status": statuses[n]}, trace_out=trace,
        ))
        assert [(c.name, c.status) for c in trace] == [
            ("get_sds", "found"), ("get_product_spec", "not_found")
        ]
        assert trace[0].args == {"product_name": "acetone"}

    def test_a_call_the_budget_refused_to_run_is_traced_as_not_run(self):
        over = MAX_CALLS_PER_ROUND + 1
        model = FakeModel([FakeResp(tool_calls=_calls(over)), FakeResp(content="Done.")])
        trace = []
        _run(run_agent_loop(model, [], lambda n, a: {"status": "found"}, trace_out=trace))
        assert len(trace) == over
        assert trace[-1].status == "not_run"

    def test_a_tool_that_raised_is_traced_as_an_error(self):
        def boom(name, args):
            raise RuntimeError("drive is down")

        model = FakeModel([
            FakeResp(tool_calls=[{"name": "get_coa", "args": {}, "id": "a"}]),
            FakeResp(content="Sorry."),
        ])
        trace = []
        _run(run_agent_loop(model, [], boom, trace_out=trace))
        assert [(c.name, c.status) for c in trace] == [("get_coa", "error")]

    def test_omitting_trace_out_changes_nothing(self):
        model = FakeModel([
            FakeResp(tool_calls=[{"name": "get_sds", "args": {}, "id": "a"}]),
            FakeResp(content="Done."),
        ])
        assert _run(run_agent_loop(model, [], lambda n, a: {"status": "found"})) == "Done."
