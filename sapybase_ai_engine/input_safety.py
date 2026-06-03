"""Prompt-injection / jailbreak input hardening.

Owns the mutable JAILBREAK_PATTERNS list (reloadable at runtime) plus pure
text-sanitization helpers. sanitize_message() reads the module-level patterns
at call time, so reload_patterns() takes effect immediately everywhere that
calls through this module. Extracted verbatim from main.py (no logic changes).
"""

import os
import re
import json
import logging

logger = logging.getLogger(__name__)


def _load_jailbreak_patterns():
    patterns_path = os.path.join(os.path.dirname(__file__), "jailbreak_patterns.json")
    try:
        with open(patterns_path) as f:
            return json.load(f)
    except Exception as e:
        logger.warning(f"Failed to load jailbreak_patterns.json: {e}; using empty list")
        return []


JAILBREAK_PATTERNS = _load_jailbreak_patterns()


def reload_patterns():
    """Reload patterns from disk; returns the new count. Mutates the module global
    so sanitize_message() picks up the change immediately (no restart needed)."""
    global JAILBREAK_PATTERNS
    JAILBREAK_PATTERNS = _load_jailbreak_patterns()
    return len(JAILBREAK_PATTERNS)


def sanitize_message(v):
    """Defense-in-depth: Strips known prompt injection trigger phrases from
    user input. Does NOT block the request — silently neutralizes the
    attack vector while preserving the user's legitimate intent."""
    sanitized = v
    for pattern in JAILBREAK_PATTERNS:
        sanitized = re.sub(pattern, '[FILTERED]', sanitized)
    return sanitized.strip()


def _strip_control_tags(text: str) -> str:
    """Remove our own prompt control tokens from untrusted content (retrieved
    chunks) so a poisoned document can't inject a fake delimiter to 'escape'
    its sandbox in the system prompt. Indirect-prompt-injection hardening."""
    if not text:
        return ""
    for tok in ("<knowledge_base>", "</knowledge_base>", "<user_query>", "</user_query>"):
        text = text.replace(tok, "").replace(tok.upper(), "")
    return text
