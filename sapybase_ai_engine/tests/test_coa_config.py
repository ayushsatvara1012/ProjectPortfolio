"""COA finder Phase 0 — the config surface (pure).

The COA folder ID is interpolated into Drive's ``q='{folder_id}' in parents``, so
``extract_folder_id`` is a security boundary, not a convenience parser (plan H1).
These tests hammer the rejection paths hardest: anything that is not a clean Drive
ID must collapse to "" at BOTH the write path (``sanitize_coa``) and the read path
(``effective_coa_config``), because a row hand-edited around the API must not be
able to reach the connector either.
"""
import pytest

from packs import effective_coa_config, extract_folder_id, sanitize_coa, sanitize_overrides
from packs.overrides import COA_FOLDER_ID_RE

# A realistic Drive folder ID: 33 chars of the unreserved alphabet.
FOLDER_ID = "1w-sEG7xKq2NpR4vTzB9cYdLmH0aQfJ3U"


class TestExtractFolderId:
    @pytest.mark.parametrize("url", [
        f"https://drive.google.com/drive/folders/{FOLDER_ID}",
        f"https://drive.google.com/drive/folders/{FOLDER_ID}?usp=sharing",
        f"https://drive.google.com/drive/folders/{FOLDER_ID}?usp=drive_link",
        f"https://drive.google.com/drive/u/0/folders/{FOLDER_ID}",
        f"https://drive.google.com/drive/u/2/folders/{FOLDER_ID}?usp=sharing",
        f"https://drive.google.com/open?id={FOLDER_ID}",
        f"https://drive.google.com/drive/folders/{FOLDER_ID}#anchor",
        FOLDER_ID,                      # owner pasted the bare ID
        f"  {FOLDER_ID}  ",             # ...with whitespace from the clipboard
    ])
    def test_accepts_every_drive_url_shape(self, url):
        assert extract_folder_id(url) == FOLDER_ID

    @pytest.mark.parametrize("bad", [
        None, 123, [], {}, True,        # non-strings
        "", "   ",                      # blank
        "not a url",
        "https://drive.google.com/drive/folders/",   # no id
        "https://drive.google.com/",
        "short",                        # under the 10-char minimum
        "x" * 201,                      # over the 200-char maximum
    ])
    def test_rejects_unusable_input(self, bad):
        assert extract_folder_id(bad) == ""

    def test_rejects_oversized_paste_without_scanning_it(self):
        assert extract_folder_id("https://drive.google.com/drive/folders/" + "a" * 4000) == ""


class TestFolderIdInjection:
    """H1 — a folder ID containing a quote would break out of Drive's quoted
    ``q`` string and rewrite the query. Every one of these must be refused."""

    @pytest.mark.parametrize("hostile", [
        "abc'def'ghi'jkl",                              # bare apostrophe
        "1w-sEG7xKq2NpR4' or '1'='1",                   # query rewrite
        "1w-sEG7xKq2NpR4vTz' in parents or 'x",         # clause injection
        "1w-sEG7xKq2 NpR4vTzB9",                        # space
        "1w-sEG7xKq2&NpR4vTzB9",                        # ampersand
        "1w-sEG7xKq2NpR4vTzB9/../etc",                  # traversal-ish
        "1w-sEG7xKq2NpR4vTzB9%27",                      # url-encoded quote
        "1w-sEG7\nxKq2NpR4vTzB9",                       # newline
    ])
    def test_hostile_ids_rejected_bare(self, hostile):
        assert extract_folder_id(hostile) == ""
        assert sanitize_coa({"folder_id": hostile}) == {}
        assert effective_coa_config({"coa": {"folder_id": hostile}}) == ""

    @pytest.mark.parametrize("hostile", [
        "abc'def'ghi'jkl",
        "1w-sEG7xKq2NpR4' or '1'='1",
        "1w-sEG7xKq2 NpR4vTzB9",
        "1w-sEG7xKq2&NpR4vTzB9",
    ])
    def test_hostile_ids_rejected_inside_a_url(self, hostile):
        assert extract_folder_id(f"https://drive.google.com/drive/folders/{hostile}") == ""

    def test_regex_is_the_only_gate_and_is_anchored(self):
        # An unanchored regex would pass "evil'/{id}" by matching the tail.
        assert COA_FOLDER_ID_RE.match(f"evil'{FOLDER_ID}") is None
        assert COA_FOLDER_ID_RE.match(f"{FOLDER_ID}'evil") is None


class TestSanitizeCoa:
    def test_extracts_id_from_a_pasted_url(self):
        out = sanitize_coa({"folder_id": f"https://drive.google.com/drive/folders/{FOLDER_ID}?usp=sharing"})
        assert out == {"folder_id": FOLDER_ID}

    @pytest.mark.parametrize("bad", [None, "", [], "nonsense", {"folder_id": ""}, {"folder_id": None}])
    def test_unusable_collapses_to_empty_dict(self, bad):
        assert sanitize_coa(bad if isinstance(bad, dict) else {"folder_id": bad}) == {}

    def test_ignores_unknown_keys(self):
        out = sanitize_coa({"folder_id": FOLDER_ID, "enabled": True, "pattern": "{code}_{batch}"})
        assert out == {"folder_id": FOLDER_ID}


class TestSanitizeOverridesIntegration:
    def test_coa_survives_a_full_overrides_round_trip(self):
        out = sanitize_overrides({"coa": {"folder_id": f"https://drive.google.com/drive/folders/{FOLDER_ID}"}})
        assert out["coa"] == {"folder_id": FOLDER_ID}

    def test_invalid_coa_is_dropped_from_storage(self):
        assert "coa" not in sanitize_overrides({"coa": {"folder_id": "junk"}})

    def test_absent_coa_stays_absent(self):
        assert "coa" not in sanitize_overrides({"sample_form": []})

    def test_coa_does_not_disturb_the_sample_sink(self):
        out = sanitize_overrides({
            "coa": {"folder_id": FOLDER_ID},
            "sample_sink": {"url": "https://hook.example.com/x", "secret": "s3cret"},
        })
        assert out["coa"]["folder_id"] == FOLDER_ID
        assert out["sample_sink"]["url"] == "https://hook.example.com/x"


class TestEffectiveCoaConfig:
    def test_resolves_the_stored_folder(self):
        assert effective_coa_config({"coa": {"folder_id": FOLDER_ID}}) == FOLDER_ID

    def test_accepts_a_json_string_column(self):
        # psycopg2 hands JSONB back as either a dict or a str depending on adapter
        # registration, so the read path must survive both.
        assert effective_coa_config('{"coa": {"folder_id": "%s"}}' % FOLDER_ID) == FOLDER_ID

    @pytest.mark.parametrize("stored", [
        None, {}, "", "not json", [], {"coa": None}, {"coa": {}},
        {"coa": {"folder_id": ""}}, {"coa": "a string"}, {"coa": []},
    ])
    def test_no_folder_configured_means_feature_off(self, stored):
        assert effective_coa_config(stored) == ""

    def test_never_raises_on_garbage(self):
        for junk in (object(), 3.14, b"bytes", {"coa": {"folder_id": {"nested": 1}}}):
            assert effective_coa_config(junk) == ""

    def test_there_is_no_pack_or_env_default(self, monkeypatch):
        # A platform-wide folder would serve one tenant's certificates to another.
        monkeypatch.setenv("COA_FOLDER_ID", FOLDER_ID)
        monkeypatch.setenv("GOOGLE_DRIVE_FOLDER_ID", FOLDER_ID)
        assert effective_coa_config({}) == ""
