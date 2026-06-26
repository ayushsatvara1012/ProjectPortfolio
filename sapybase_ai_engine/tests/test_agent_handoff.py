"""Tests for the transactional owner-handoff builders (Phase 4b, §10).

Pure functions — no network. They turn a captured request dict into a Slack
Block Kit payload and an email (subject + html). We assert the human-facing
content, the money/POR framing, and that visitor-supplied text is escaped for
each channel (a security property: product/contact strings are interpolated).
"""
import json

from agent_handoff import (
    build_agent_request_email,
    build_agent_request_slack_payload,
    summarize_agent_request,
)


def _sample(**over):
    base = {
        "kind": "sample", "product": "Acetone", "grade": "AR", "pack_size": "2.5 Ltr",
        "quantity": 3, "note": None, "contact_name": "Asha",
        "contact_email": "asha@acme.com", "contact_phone": None,
    }
    base.update(over)
    return base


def _quote(**over):
    base = {
        "kind": "quote", "status": "quoted", "product": "Acetone", "grade": "AR",
        "pack_size": "500 ml", "quantity": 2, "unit_price": 413.0, "subtotal": 826.0,
        "gst_rate": 18.0, "currency": "INR", "is_por": False,
        "contact_name": "Asha", "contact_email": "asha@acme.com", "contact_phone": None,
    }
    base.update(over)
    return base


class TestSummarize:
    def test_sample_line(self):
        s = summarize_agent_request(_sample())
        assert "sample" in s.lower()
        assert "Acetone" in s and "AR" in s

    def test_quote_line_has_money_and_gst(self):
        s = summarize_agent_request(_quote())
        assert "₹826" in s and "GST" in s

    def test_por_quote_reads_as_on_request(self):
        s = summarize_agent_request(_quote(status="price_on_request", is_por=True,
                                           subtotal=None, unit_price=None))
        assert "price on request" in s.lower()
        assert "₹" not in s   # never invent a number for a POR


class TestSlackPayload:
    def test_shape_and_fallback(self):
        p = build_agent_request_slack_payload("ChemBot", _sample())
        assert "text" in p and isinstance(p["blocks"], list) and len(p["blocks"]) == 2
        json.dumps(p)  # webhook-serializable
        assert p["blocks"][0]["type"] == "header"

    def test_quote_shows_total(self):
        p = build_agent_request_slack_payload("ChemBot", _quote())
        section = p["blocks"][1]["text"]["text"]
        assert "₹826" in section and "GST extra" in section

    def test_por_shows_on_request_not_a_number(self):
        p = build_agent_request_slack_payload(
            "ChemBot", _quote(status="price_on_request", is_por=True,
                              subtotal=None, unit_price=None))
        section = p["blocks"][1]["text"]["text"]
        assert "on request" in section.lower()

    def test_visitor_text_is_slack_escaped(self):
        p = build_agent_request_slack_payload(
            "ChemBot", _sample(product="Acid <b>& base</b>", note="<script>x</script>"))
        section = p["blocks"][1]["text"]["text"]
        assert "<b>" not in section and "&amp;" in section
        assert "<script>" not in section

    def test_no_contact_is_stated(self):
        p = build_agent_request_slack_payload(
            "ChemBot", _sample(contact_name=None, contact_email=None, contact_phone=None))
        section = p["blocks"][1]["text"]["text"]
        assert "No contact" in section


class TestEmail:
    def test_subject_and_html(self):
        subject, html = build_agent_request_email("ChemBot", _sample())
        assert subject.startswith("[ChemBot]")
        assert "Acetone" in html and "asha@acme.com" in html

    def test_quote_email_shows_total(self):
        _subject, html = build_agent_request_email("ChemBot", _quote())
        assert "₹826" in html and "GST extra" in html

    def test_visitor_text_is_html_escaped(self):
        _subject, html = build_agent_request_email(
            "ChemBot", _sample(product="Acid <b>& base</b>"))
        assert "<b>& base</b>" not in html      # the visitor's tag is neutralized
        assert "&lt;b&gt;" in html and "&amp;" in html
