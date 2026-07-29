"""COA finder Phase 1 — the Redis cache layer (plan D9, §12 cache, H13).

The cache holds a filename listing so we do not re-walk the tree on every message.
Two properties matter more than the hit rate:

* **Every cache failure is a MISS, never an exception.** A truncated value, a
  version bump, or a Redis outage must cost one extra walk (H13), not a 500 in the
  widget.
* **The folder ID is part of the key**, so re-pointing the dashboard at a different
  folder abandons the old listing with no invalidation step to forget.
"""
import json

import httpx
import pytest

from services import coa_drive
from services.coa_drive import (
    CoaDriveError,
    WalkResult,
    build_document,
    cache_key,
    decode_payload,
    deserialize_index,
    encode_index,
    load_index,
    serialize_index,
)
from tests.test_coa_drive import API_KEY, FIXTURES, FOLDER_ID, drive, entry

COMPANY_ID = "11111111-2222-3333-4444-555555555555"


class FakeRedis:
    """Just enough async Redis. ``fail`` makes every call raise (H13)."""

    def __init__(self, fail=False):
        self.store = {}
        self.ttls = {}
        self.fail = fail
        self.gets = 0
        self.sets = 0

    async def get(self, key):
        self.gets += 1
        if self.fail:
            raise RuntimeError(f"redis down; url=redis://x?key={API_KEY}")
        return self.store.get(key)

    async def setex(self, key, ttl, value):
        self.sets += 1
        if self.fail:
            raise RuntimeError("redis down")
        self.store[key] = value.encode() if isinstance(value, str) else value
        self.ttls[key] = ttl


def walk_result(names=FIXTURES, **kw):
    docs = [build_document(entry(n)) for n in names]
    return WalkResult(
        documents=tuple(d for d in docs if d),
        folders_visited=kw.get("folders_visited", 8),
        files_seen=kw.get("files_seen", len(names)),
        ignored_non_pdf=kw.get("ignored_non_pdf", 0),
        capped=kw.get("capped", ()),
    )


class TestCacheKey:
    def test_shape_matches_the_plan(self):
        assert cache_key(COMPANY_ID, FOLDER_ID) == f"coa:folder:{COMPANY_ID}:{FOLDER_ID}"

    def test_repointing_the_folder_changes_the_key(self):
        # D9 — this is the entire cache-invalidation strategy for a re-point.
        assert cache_key(COMPANY_ID, "folder-a") != cache_key(COMPANY_ID, "folder-b")

    def test_tenants_never_share_an_entry(self):
        assert cache_key("company-a", FOLDER_ID) != cache_key("company-b", FOLDER_ID)


class TestRoundTrip:
    def test_a_walk_survives_serialization(self):
        original = walk_result()
        restored = deserialize_index(serialize_index(original))
        assert [d.name for d in restored.documents] == [d.name for d in original.documents]
        assert [d.file_id for d in restored.documents] == [d.file_id for d in original.documents]
        assert restored.folders_visited == original.folders_visited
        assert restored.files_seen == original.files_seen

    def test_restored_documents_are_searchable(self):
        restored = deserialize_index(serialize_index(walk_result()))
        found, _ = coa_drive.search(list(restored.documents), "100.26R016")
        assert len(found) == 3

    def test_derived_fields_are_not_stored(self):
        # Tokens and display are rebuilt on read, so a tokenizer change takes effect
        # on the next read instead of being frozen in for the life of the TTL.
        payload = json.loads(serialize_index(walk_result()))
        assert set(payload["files"][0]) == {"id", "name", "modifiedTime", "webViewLink"}

    def test_bytes_from_redis_decode(self):
        assert deserialize_index(serialize_index(walk_result()).encode()) is not None

    def test_capped_flags_survive(self):
        restored = deserialize_index(serialize_index(walk_result(capped=("files", "depth"))))
        assert restored.capped == ("files", "depth")


class TestDeserializeIsAlwaysAMiss:
    @pytest.mark.parametrize("junk", [
        None, "", "   ", b"", "not json", "[]", "123", '"a string"',
        json.dumps({"files": []}),                          # no version
        json.dumps({"v": 999, "files": []}),                # future version
        json.dumps({"v": 1}),                               # no files key
        json.dumps({"v": 1, "files": "not a list"}),
    ])
    def test_unusable_payloads_return_none_rather_than_raise(self, junk):
        assert deserialize_index(junk) is None

    def test_a_truncated_value_is_a_miss(self):
        assert deserialize_index(serialize_index(walk_result())[:40]) is None

    def test_garbage_entries_inside_a_valid_payload_are_dropped(self):
        raw = json.dumps({"v": 1, "files": [
            {"id": "a", "name": "100RG_100.26R016_ACETONE RG.pdf", "webViewLink": "https://x/1"},
            {"id": "b"},                       # no name, no link
            "not a dict",
            {"name": "orphan.pdf"},            # no id
        ]})
        restored = deserialize_index(raw)
        assert len(restored.documents) == 1

    def test_negative_or_garbage_counters_normalize(self):
        raw = json.dumps({"v": 1, "files": [], "folders_visited": -5, "files_seen": "lots"})
        restored = deserialize_index(raw)
        assert restored.folders_visited == 0 and restored.files_seen == 0


class TestLoadIndex:
    @pytest.mark.asyncio
    async def test_first_call_walks_and_populates_the_cache(self):
        cache = FakeRedis()
        async with httpx.AsyncClient(transport=drive({FOLDER_ID: [entry(FIXTURES[0])]})) as client:
            result, from_cache = await load_index(
                COMPANY_ID, FOLDER_ID, redis_client=cache, api_key=API_KEY, client=client)
        assert from_cache is False and result.indexed == 1
        assert cache.sets == 1
        assert cache.ttls[cache_key(COMPANY_ID, FOLDER_ID)] == coa_drive.CACHE_TTL_SECONDS

    @pytest.mark.asyncio
    async def test_second_call_is_served_from_cache_without_touching_drive(self):
        cache = FakeRedis()
        requests = []
        transport = drive({FOLDER_ID: [entry(FIXTURES[0])]}, requests)
        async with httpx.AsyncClient(transport=transport) as client:
            await load_index(COMPANY_ID, FOLDER_ID, redis_client=cache, api_key=API_KEY, client=client)
            before = len(requests)
            result, from_cache = await load_index(
                COMPANY_ID, FOLDER_ID, redis_client=cache, api_key=API_KEY, client=client)
        assert from_cache is True and result.indexed == 1
        assert len(requests) == before, "a cache hit must not call Drive"

    @pytest.mark.asyncio
    async def test_force_skips_the_read_and_re_walks(self):
        # §6 step 5 — what makes a COA uploaded two minutes ago findable.
        cache = FakeRedis()
        requests = []
        tree = {FOLDER_ID: [entry(FIXTURES[0])]}
        transport = drive(tree, requests)
        async with httpx.AsyncClient(transport=transport) as client:
            await load_index(COMPANY_ID, FOLDER_ID, redis_client=cache, api_key=API_KEY, client=client)
            tree[FOLDER_ID].append(entry(FIXTURES[1]))
            result, from_cache = await load_index(
                COMPANY_ID, FOLDER_ID, redis_client=cache, api_key=API_KEY, client=client, force=True)
        assert from_cache is False
        assert result.indexed == 2, "a forced walk must see the newly uploaded file"

    @pytest.mark.asyncio
    async def test_repointing_the_folder_does_not_serve_the_old_listing(self):
        cache = FakeRedis()
        other = "2xYbTf9QmL4vNpR7wKzE1cHdJ0aSgU6B"
        tree = {FOLDER_ID: [entry(FIXTURES[0])], other: [entry(FIXTURES[1]), entry(FIXTURES[2])]}
        async with httpx.AsyncClient(transport=drive(tree)) as client:
            await load_index(COMPANY_ID, FOLDER_ID, redis_client=cache, api_key=API_KEY, client=client)
            result, from_cache = await load_index(
                COMPANY_ID, other, redis_client=cache, api_key=API_KEY, client=client)
        assert from_cache is False and result.indexed == 2

    @pytest.mark.asyncio
    async def test_a_drive_failure_never_writes_a_cache_entry(self):
        cache = FakeRedis()
        async with httpx.AsyncClient(transport=drive({}, status=403)) as client:
            with pytest.raises(CoaDriveError):
                await load_index(COMPANY_ID, FOLDER_ID, redis_client=cache,
                                 api_key=API_KEY, client=client)
        assert cache.store == {}, "an outage must not be cached as an empty folder"


class TestCompression:
    """The listing is compressed into Redis (~4.5x on real data)."""

    def test_a_walk_survives_the_compressed_round_trip(self):
        original = walk_result()
        restored = deserialize_index(decode_payload(encode_index(original)))
        assert [d.name for d in restored.documents] == [d.name for d in original.documents]

    def test_the_stored_bytes_are_actually_compressed(self):
        original = walk_result()
        assert len(encode_index(original)) < len(serialize_index(original))

    def test_an_uncompressed_entry_from_an_older_deploy_still_reads(self):
        # Overlapping deploys share one Redis and one 600s TTL, so the new code must
        # read what the old code wrote rather than treating it as a corrupt entry.
        legacy = serialize_index(walk_result())
        restored = deserialize_index(decode_payload(legacy.encode()))
        assert restored is not None and restored.indexed == walk_result().indexed

    @pytest.mark.parametrize("junk", [
        b"", b"\x78not really compressed", b"\x00\x01\x02", "plain text", None,
    ])
    def test_undecodable_bytes_are_a_miss_not_an_exception(self, junk):
        assert deserialize_index(decode_payload(junk)) is None

    @pytest.mark.asyncio
    async def test_what_lands_in_redis_is_compressed_and_reads_back(self):
        cache = FakeRedis()
        async with httpx.AsyncClient(transport=drive({FOLDER_ID: [entry(FIXTURES[0])]})) as client:
            await load_index(COMPANY_ID, FOLDER_ID, redis_client=cache,
                             api_key=API_KEY, client=client)
            stored = cache.store[cache_key(COMPANY_ID, FOLDER_ID)]
            assert isinstance(stored, (bytes, bytearray)) and stored[:1] == b"\x78"
            coa_drive.reset_index_memo()
            result, from_cache = await load_index(
                COMPANY_ID, FOLDER_ID, redis_client=cache, api_key=API_KEY, client=client)
        assert from_cache is True and result.indexed == 1


class TestIndexMemo:
    """The parsed listing is held in process, so a warm worker never re-parses it."""

    @pytest.mark.asyncio
    async def test_a_second_search_touches_neither_redis_nor_drive(self):
        cache = FakeRedis()
        requests = []
        transport = drive({FOLDER_ID: [entry(FIXTURES[0])]}, requests)
        async with httpx.AsyncClient(transport=transport) as client:
            await load_index(COMPANY_ID, FOLDER_ID, redis_client=cache,
                             api_key=API_KEY, client=client)
            gets_before = cache.gets
            result, from_cache = await load_index(
                COMPANY_ID, FOLDER_ID, redis_client=cache, api_key=API_KEY, client=client)
        assert from_cache is True and result.indexed == 1
        assert cache.gets == gets_before, "a memo hit must not read Redis"
        assert len(requests) == 1

    @pytest.mark.asyncio
    async def test_a_redis_hit_populates_the_memo(self):
        # Two workers: the second must warm its memo from Redis rather than walking.
        cache = FakeRedis()
        requests = []
        transport = drive({FOLDER_ID: [entry(FIXTURES[0])]}, requests)
        async with httpx.AsyncClient(transport=transport) as client:
            await load_index(COMPANY_ID, FOLDER_ID, redis_client=cache,
                             api_key=API_KEY, client=client)
            coa_drive.reset_index_memo()          # a cold worker
            await load_index(COMPANY_ID, FOLDER_ID, redis_client=cache,
                             api_key=API_KEY, client=client)
            gets_before = cache.gets
            await load_index(COMPANY_ID, FOLDER_ID, redis_client=cache,
                             api_key=API_KEY, client=client)
        assert cache.gets == gets_before, "the Redis hit should have warmed the memo"
        assert len(requests) == 1, "a cold worker reads Redis, it does not re-walk"

    @pytest.mark.asyncio
    async def test_force_bypasses_the_memo_and_refreshes_it(self):
        # §6 step 5 — a stale memo must not be what makes a new COA unfindable.
        cache = FakeRedis()
        tree = {FOLDER_ID: [entry(FIXTURES[0])]}
        async with httpx.AsyncClient(transport=drive(tree)) as client:
            await load_index(COMPANY_ID, FOLDER_ID, redis_client=cache,
                             api_key=API_KEY, client=client)
            tree[FOLDER_ID].append(entry(FIXTURES[1]))
            forced, _ = await load_index(COMPANY_ID, FOLDER_ID, redis_client=cache,
                                         api_key=API_KEY, client=client, force=True)
            after, from_cache = await load_index(
                COMPANY_ID, FOLDER_ID, redis_client=cache, api_key=API_KEY, client=client)
        assert forced.indexed == 2
        assert from_cache is True and after.indexed == 2, "the forced walk must replace the memo"

    def test_an_expired_entry_is_dropped(self):
        result = walk_result()
        coa_drive._memo_put("k", result, now=0.0)
        assert coa_drive._memo_get("k", now=coa_drive.CACHE_TTL_SECONDS - 1) is result
        assert coa_drive._memo_get("k", now=coa_drive.CACHE_TTL_SECONDS) is None

    def test_the_memo_is_bounded_and_evicts_the_least_recently_used(self):
        # One real listing is ~2 MB of parsed objects, so this bound is what stops a
        # fleet of chemical tenants from growing the worker without limit.
        for i in range(coa_drive.INDEX_MEMO_MAX_ENTRIES + 3):
            coa_drive._memo_put(f"k{i}", walk_result(), now=0.0)
        assert len(coa_drive._index_memo) == coa_drive.INDEX_MEMO_MAX_ENTRIES
        assert coa_drive._memo_get("k0", now=1.0) is None
        assert coa_drive._memo_get("k10", now=1.0) is not None

    def test_tenants_never_share_a_memo_entry(self):
        a, b = walk_result(), walk_result(names=FIXTURES[:1])
        coa_drive._memo_put(cache_key("company-a", FOLDER_ID), a, now=0.0)
        coa_drive._memo_put(cache_key("company-b", FOLDER_ID), b, now=0.0)
        assert coa_drive._memo_get(cache_key("company-a", FOLDER_ID), now=1.0) is a
        assert coa_drive._memo_get(cache_key("company-b", FOLDER_ID), now=1.0) is b


class TestRedisUnavailable:
    """H13 — degrade to walking per request: slower, still correct, never a 500."""

    @pytest.mark.asyncio
    async def test_no_redis_client_at_all_still_returns_results(self):
        async with httpx.AsyncClient(transport=drive({FOLDER_ID: [entry(FIXTURES[0])]})) as client:
            result, from_cache = await load_index(
                COMPANY_ID, FOLDER_ID, redis_client=None, api_key=API_KEY, client=client)
        assert result.indexed == 1 and from_cache is False

    @pytest.mark.asyncio
    async def test_a_failing_redis_still_returns_correct_results(self):
        cache = FakeRedis(fail=True)
        requests = []
        transport = drive({FOLDER_ID: [entry(FIXTURES[0])]}, requests)
        async with httpx.AsyncClient(transport=transport) as client:
            for _ in range(3):
                result, _ = await load_index(
                    COMPANY_ID, FOLDER_ID, redis_client=cache, api_key=API_KEY, client=client)
                assert result.indexed == 1, "a dead cache must never change the answer"
        assert len(requests) == 1, (
            "the in-process memo absorbs the repeats — H13's degradation is one walk "
            "per TTL per worker, not one per request"
        )

    @pytest.mark.asyncio
    async def test_a_failing_redis_walks_again_once_the_memo_expires(self):
        # The memo must not turn a Redis outage into a permanently frozen listing.
        cache = FakeRedis(fail=True)
        requests = []
        transport = drive({FOLDER_ID: [entry(FIXTURES[0])]}, requests)
        async with httpx.AsyncClient(transport=transport) as client:
            await load_index(COMPANY_ID, FOLDER_ID, redis_client=cache,
                             api_key=API_KEY, client=client)
            coa_drive.reset_index_memo()
            await load_index(COMPANY_ID, FOLDER_ID, redis_client=cache,
                             api_key=API_KEY, client=client)
        assert len(requests) == 2

    @pytest.mark.asyncio
    async def test_h3_a_redis_error_carrying_the_key_is_scrubbed_before_logging(self, caplog):
        cache = FakeRedis(fail=True)
        async with httpx.AsyncClient(transport=drive({FOLDER_ID: []})) as client:
            with caplog.at_level("WARNING"):
                await load_index(COMPANY_ID, FOLDER_ID, redis_client=cache,
                                 api_key=API_KEY, client=client)
        assert caplog.text, "a cache failure should be visible in the logs"
        assert API_KEY not in caplog.text
        assert "key=[redacted]" in caplog.text
