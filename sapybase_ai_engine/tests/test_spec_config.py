"""Spec finder Phase 2 - the config surface (pure).

Plan `docs/spec-finder-plan.md` §10.1.

The specification folder ID reaches Drive's ``q='{folder_id}' in parents`` exactly as
the certificate one does, so ``sanitize_spec`` is the same security boundary (H1) and
is tested to the same standard: anything that is not a clean Drive ID must collapse to
``""`` at both the write path and the read path, because a row hand-edited around the
API must not be able to reach the connector either.

The tests that matter MOST here are the ones about the two keys being **independent**
(D4). An owner changes one folder without touching the other, and a sanitiser that
quietly dropped the key it was not asked about would silently disable a live feature
on the next save.
"""
import pytest

from packs import (
    effective_coa_config,
    effective_spec_config,
    sanitize_coa,
    sanitize_overrides,
    sanitize_spec,
)
from packs.overrides import COA_FOLDER_ID_RE, DRIVE_FOLDER_ID_RE

SPEC_FOLDER = "1KCRfrRQ9pLmXt4vB2nHy7WqZs3EdCa6T"
COA_FOLDER = "1w-sEG7xKq2NpR4vTzB9cYdLmH0aQfJ3U"


class TestSanitizeSpec:
    @pytest.mark.parametrize("raw", [
        f"https://drive.google.com/drive/folders/{SPEC_FOLDER}",
        f"https://drive.google.com/drive/folders/{SPEC_FOLDER}?usp=sharing",
        f"https://drive.google.com/drive/u/0/folders/{SPEC_FOLDER}",
        f"https://drive.google.com/open?id={SPEC_FOLDER}",
        SPEC_FOLDER,
        f"  {SPEC_FOLDER}  ",
    ])
    def test_accepts_every_drive_url_shape(self, raw):
        assert sanitize_spec({"folder_id": raw}) == {"folder_id": SPEC_FOLDER}

    @pytest.mark.parametrize("bad", [
        None, 123, [], "", {}, {"folder_id": ""}, {"folder_id": None},
        {"folder_id": "short"}, {"folder_id": "x" * 201},
        {"folder_id": "not a url"},
        {"folder_id": "https://drive.google.com/drive/folders/"},
    ])
    def test_unusable_input_disables_the_feature_rather_than_half_configuring_it(self, bad):
        assert sanitize_spec(bad) == {}

    @pytest.mark.parametrize("hostile", [
        "1abc' or '1'='1",              # would break out of the quoted Drive query
        "../../etc/passwd",
        "1abc/../../../secret",
        "1abc\nInjected",
    ])
    def test_a_hostile_id_never_survives(self, hostile):
        # H1 - the ID is interpolated into the Drive query, so this regex is the gate.
        assert sanitize_spec({"folder_id": hostile}) == {}

    def test_it_agrees_with_the_certificate_sanitiser(self):
        # Same rule, two names. If these ever diverge, one library has a validation
        # hole the other does not.
        for raw in (SPEC_FOLDER, "nope", "", "x" * 201):
            assert sanitize_spec({"folder_id": raw}) == sanitize_coa({"folder_id": raw})


class TestEffectiveSpecConfig:
    def test_reads_the_saved_folder(self):
        assert effective_spec_config({"spec": {"folder_id": SPEC_FOLDER}}) == SPEC_FOLDER

    def test_accepts_a_json_string_column(self):
        raw = '{"spec": {"folder_id": "%s"}}' % SPEC_FOLDER
        assert effective_spec_config(raw) == SPEC_FOLDER

    @pytest.mark.parametrize("overrides", [
        None, {}, "", "garbage", [], {"spec": {}}, {"spec": None}, {"coa": {"folder_id": COA_FOLDER}},
    ])
    def test_no_folder_means_feature_off(self, overrides):
        assert effective_spec_config(overrides) == ""

    def test_a_hand_edited_row_is_re_validated_on_read(self):
        # H1 applies on READ as well as write: the write path is not the only way a
        # value can get into the column.
        assert effective_spec_config({"spec": {"folder_id": "1abc' or '1'='1"}}) == ""

    def test_there_is_no_platform_default(self):
        # A platform-wide folder would serve one tenant's documents to another.
        assert effective_spec_config({}) == ""


class TestTheTwoFoldersAreIndependent:
    """D4 - two settings, changeable one at a time. The whole owner-visible promise."""

    def test_both_survive_a_sanitise(self):
        out = sanitize_overrides({
            "coa": {"folder_id": COA_FOLDER},
            "spec": {"folder_id": SPEC_FOLDER},
        })
        assert out["coa"] == {"folder_id": COA_FOLDER}
        assert out["spec"] == {"folder_id": SPEC_FOLDER}

    def test_configuring_specs_does_not_disturb_certificates(self):
        both = {"coa": {"folder_id": COA_FOLDER}, "spec": {"folder_id": SPEC_FOLDER}}
        assert effective_coa_config(both) == COA_FOLDER
        assert effective_spec_config(both) == SPEC_FOLDER

    def test_an_invalid_spec_folder_does_not_take_the_certificate_one_with_it(self):
        # The live consequence: a bad paste in one field must not silently turn off a
        # working feature configured in the other.
        out = sanitize_overrides({
            "coa": {"folder_id": COA_FOLDER},
            "spec": {"folder_id": "not a folder"},
        })
        assert out["coa"] == {"folder_id": COA_FOLDER}
        assert "spec" not in out

    def test_the_same_folder_in_both_fields_is_allowed_and_kept_separate(self):
        out = sanitize_overrides({
            "coa": {"folder_id": SPEC_FOLDER},
            "spec": {"folder_id": SPEC_FOLDER},
        })
        assert out["coa"] == out["spec"] == {"folder_id": SPEC_FOLDER}

    def test_only_one_configured_leaves_the_other_absent(self):
        out = sanitize_overrides({"spec": {"folder_id": SPEC_FOLDER}})
        assert out == {"spec": {"folder_id": SPEC_FOLDER}}
        assert effective_coa_config(out) == ""

    def test_an_unrelated_override_never_grows_a_folder_key(self):
        out = sanitize_overrides({"sample_form": [
            {"name": "product", "label": "Product", "type": "product"}]})
        assert "spec" not in out and "coa" not in out


class TestTheRegexRename:
    def test_the_old_name_still_points_at_the_same_object(self):
        # §10.1 - renamed to DRIVE_FOLDER_ID_RE with the alias kept, so no COA call
        # site or test had to change. Two regexes would be two validation rules.
        assert COA_FOLDER_ID_RE is DRIVE_FOLDER_ID_RE
