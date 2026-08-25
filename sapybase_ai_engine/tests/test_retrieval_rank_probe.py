"""Slice H's measurement harness - the pure helpers only.

docs/bot-output-quality-plan.md §11 phase 2. The probe itself is read-only against
production and cannot be unit tested; what CAN be wrong without anyone noticing is
the term extraction and the bucketing, because a bad gold term silently turns a
real retrieval failure into a NO_GOLD row and the verdict flips.

Skipped when DATABASE_URL is unset: the script connects at import time by design -
it is an operator tool, not a library.
"""
import importlib.util
import os
from pathlib import Path

import pytest

pytestmark = pytest.mark.skipif(not os.getenv("DATABASE_URL"),
                                reason="probe imports the live app at module scope")

_PATH = Path(__file__).resolve().parent.parent / "scripts" / "retrieval_rank_probe.py"


@pytest.fixture(scope="module")
def probe():
    spec = importlib.util.spec_from_file_location("retrieval_rank_probe", _PATH)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class TestQueryTerms:
    def test_a_named_person_reduces_to_the_name(self, probe):
        assert probe._query_terms("can i get contact detail of aayush patel") == \
            ["aayush", "patel"]

    def test_a_role_question_keeps_the_discriminating_word(self, probe):
        # "business" is scaffolding on a B2B site and is stopworded out; "export"
        # is what makes this query answerable.
        terms = probe._query_terms("who is responsible for export business")
        assert "export" in terms
        assert "business" not in terms

    def test_terms_come_back_longest_first(self, probe):
        # A longer token is more likely the name or the product than a short one.
        terms = probe._query_terms("methanol cas grade")
        assert terms == sorted(terms, key=len, reverse=True)

    def test_a_query_of_pure_scaffolding_yields_nothing(self, probe):
        assert probe._query_terms("can you please tell me more about this") == []

    def test_duplicates_collapse(self, probe):
        assert probe._query_terms("acetone acetone acetone") == ["acetone"]


class TestFirstRank:
    def test_the_rank_is_one_indexed(self, probe):
        rows = [("Ms.Himani Zaveri, Export Manager",), ("Acetone AR grade",)]
        assert probe._first_rank(rows, "himani") == 1

    def test_it_reports_the_first_match_not_the_last(self, probe):
        rows = [("nothing here",), ("Himani again",), ("Himani once more",)]
        assert probe._first_rank(rows, "himani") == 2

    def test_a_term_absent_from_every_row_is_none(self, probe):
        assert probe._first_rank([("acetone",)], "himani") is None

    def test_matching_is_word_bounded(self, probe):
        # Substring matching would score this a hit and hide a real failure.
        assert probe._first_rank([("exported goods",)], "export") is None
        assert probe._first_rank([("export desk",)], "export") == 1

    def test_empty_rows_do_not_raise(self, probe):
        assert probe._first_rank([], "x") is None
        assert probe._first_rank(None, "x") is None


class TestBucket:
    def test_in_the_final_five_is_working(self, probe):
        assert probe._bucket(3, 3) == "IN_TOP5"

    def test_in_the_pool_but_cut_is_the_raise_top_k_case(self, probe):
        assert probe._bucket(9, None) == "RANK_6_15"

    def test_absent_from_the_pool_is_the_arch_d_case(self, probe):
        # top_k cannot recover a chunk retrieval never returned.
        assert probe._bucket(None, None) == "NOT_IN_POOL"


class TestVerdictBuckets:
    def test_measured_and_unmeasured_buckets_do_not_overlap(self, probe):
        # The verdict divides by the measured set only; an overlap would let a
        # harness limitation count as a retrieval failure.
        assert not set(probe._MEASURED_BUCKETS) & set(probe._UNMEASURED_BUCKETS)

    def test_every_bucket_gold_term_can_return_is_accounted_for(self, probe):
        # A bucket name that appears in _gold_term but in neither tuple would be
        # silently dropped from the summary.
        known = set(probe._MEASURED_BUCKETS) | set(probe._UNMEASURED_BUCKETS)
        assert {"NO_GOLD", "TOO_COMMON", "NO_TERMS"} <= known

    def test_a_tie_is_not_a_verdict(self, probe):
        # The first dry run produced 1 recoverable and 1 never-retrieved, and the
        # naive comparison reported that as a definitive answer.
        assert probe.MIN_VERDICT_SAMPLE > 2
