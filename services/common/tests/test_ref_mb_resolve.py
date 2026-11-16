"""Local MusicBrainz mirror: normalisation, ISRC ambiguity, provider order, flag off by default.

The database is mocked. Nothing here connects to a real ref_mb.
"""
import json
import sys
import uuid
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from common.datalayer.enrichment import local_review  # noqa: E402
from common.metadata.matching import Track  # noqa: E402
from common.providers.base import ProviderTrack  # noqa: E402
from common.providers.musicbrainz_local import MusicBrainzLocalProvider  # noqa: E402
from common.providers.registry import build_providers  # noqa: E402
from common.refmb.match import (  # noqa: E402
    ISRC_DURATION_TOLERANCE_MS,
    RecordingCandidate,
    choose_isrc,
    combined_lookup,
    confidence_bucket,
)
from common.refmb.resolve import (  # noqa: E402
    CANONICAL_REDIRECT_SQL,
    CANONICAL_SQL,
    FUZZY_ARTIST_SQL,
    FUZZY_THRESHOLD_SQL,
    GID_REDIRECT_SQL,
    ISRC_SQL,
    MusicBrainzResolver,
)
from common.refmb.settings import LOAD_MANIFEST_SQL, RefMBSettings, read_dump_id  # noqa: E402

ROOT = Path(__file__).resolve().parents[3]
MBID_A = '11111111-1111-4111-8111-111111111111'
MBID_B = '22222222-2222-4222-8222-222222222222'
MBID_C = '33333333-3333-4333-8333-333333333333'


def _row(**kwargs):
    return kwargs


class Scripted:
    def __init__(self, handler):
        self.handler = handler
        self.seen = []
        self.calls = []
        self.executed = []

    async def fetch(self, sql, *args):
        self.seen.append(sql)
        self.calls.append((sql, args))
        return self.handler(sql, args)

    async def fetchrow(self, sql, *args):
        rows = await self.fetch(sql, *args)
        return rows[0] if rows else None

    async def execute(self, sql, *args):
        self.executed.append(sql)

    def transaction(self):
        return self

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False


def _kind(sql: str) -> str:
    if 'FROM ref_mb.isrc' in sql:
        return 'isrc'
    if 'canonical_musicbrainz_data' in sql:
        return 'canonical'
    if 'canonical_recording_redirect' in sql:
        return 'canon-redirect'
    if 'recording_gid_redirect' in sql:
        return 'gid'
    if 'musicbrainz_unaccent(ac.name)' in sql:
        return 'fuzzy-artist'
    if 'title_sim' in sql:
        return 'fuzzy-recording'
    if 'l_genre_release_group' in sql:
        return 'genre'
    if 'release_country' in sql:
        return 'enrich'
    if 'r.gid = $1::uuid' in sql:
        return 'by-gid'
    if 'load_manifest' in sql:
        return 'manifest'
    return 'other'


def test_combined_lookup_matches_contract_vectors():
    path = ROOT / 'contracts' / 'fixtures' / 'normalise_vectors.json'
    vectors = json.loads(path.read_text(encoding='utf-8'))
    mismatches = [
        (vec['artist'], vec['title'], combined_lookup(vec['artist'], vec['title']), vec['expected'])
        for vec in vectors
        if combined_lookup(vec['artist'], vec['title']) != vec['expected']
    ]
    assert mismatches == []


def test_isrc_parameter_is_cast_to_bpchar_and_redirects_compare_uuids():
    assert '$1::bpchar' in ISRC_SQL
    assert 'isrc::text' not in ISRC_SQL
    assert 'i.isrc =' in ISRC_SQL
    assert 'g.gid = ANY($1::uuid[])' in GID_REDIRECT_SQL
    assert '::text[]' not in GID_REDIRECT_SQL
    assert '::text' not in GID_REDIRECT_SQL.split('WHERE', 1)[1]
    assert 'recording_mbid = ANY($1::uuid[])' in CANONICAL_REDIRECT_SQL
    assert '::text[]' not in CANONICAL_REDIRECT_SQL
    assert '::text' not in CANONICAL_REDIRECT_SQL.split('WHERE', 1)[1]
    assert 'combined_lookup = $1' in CANONICAL_SQL
    assert 'sn_cmd_lookup' in CANONICAL_SQL
    assert 'regexp_replace' not in CANONICAL_SQL
    assert 'musicbrainz_unaccent(ac.name)' in FUZZY_ARTIST_SQL
    assert 'FROM ref_mb.artist_credit ac' in FUZZY_ARTIST_SQL
    assert 'FROM ref_mb.artist a' not in FUZZY_ARTIST_SQL
    assert FUZZY_THRESHOLD_SQL == 'SET LOCAL pg_trgm.similarity_threshold = 0.64'


def test_unique_isrc_is_accepted_without_a_duration():
    only = RecordingCandidate(MBID_A, 'Strobe', 'deadmau5', 634000)
    choice = choose_isrc([only], 'deadmau5', None)
    assert choice.outcome == 'accept'
    assert choice.chosen.mbid == MBID_A


def test_isrc_collapse_via_canonical_redirect_accepts_one_recording():
    rows = [
        RecordingCandidate(MBID_A, 'Strobe', 'deadmau5', 634000, canonical_mbid=MBID_C),
        RecordingCandidate(MBID_B, 'Strobe', 'deadmau5', 634000, canonical_mbid=MBID_C),
    ]
    choice = choose_isrc(rows, 'deadmau5', 634000)
    assert choice.outcome == 'accept'
    assert choice.chosen.canonical == MBID_C
    assert len(choice.candidates) == 1


def test_isrc_ambiguity_accepts_only_the_duration_and_artist_singleton():
    close = RecordingCandidate(MBID_A, 'Opus', 'Eric Prydz', 600000)
    other = RecordingCandidate(MBID_B, 'Opus', 'Someone Else', 600000)
    choice = choose_isrc([close, other], 'Eric Prydz', 600000 + ISRC_DURATION_TOLERANCE_MS)
    assert choice.outcome == 'accept'
    assert choice.chosen.mbid == MBID_A
    assert {row.mbid for row in choice.candidates} == {MBID_A, MBID_B}


def test_isrc_ambiguity_is_review_when_two_recordings_still_qualify():
    rows = [
        RecordingCandidate(MBID_A, 'Opus', 'Eric Prydz', 600000),
        RecordingCandidate(MBID_B, 'Opus', 'Eric Prydz', 601000),
    ]
    choice = choose_isrc(rows, 'Eric Prydz', 600000)
    assert choice.outcome == 'review'
    assert choice.chosen is None


def test_isrc_ambiguity_is_review_when_duration_or_artist_does_not_single_one_out():
    too_far = ISRC_DURATION_TOLERANCE_MS + 1
    rows = [
        RecordingCandidate(MBID_A, 'Opus', 'Eric Prydz', 600000),
        RecordingCandidate(MBID_B, 'Opus', 'Eric Prydz', 600000),
    ]
    assert choose_isrc(rows, 'Eric Prydz', 600000 + too_far).outcome == 'review'
    different = [
        RecordingCandidate(MBID_A, 'Opus', 'Completely Different', 600000),
        RecordingCandidate(MBID_B, 'Opus', 'Another Artist', 600000),
    ]
    assert choose_isrc(different, 'Eric Prydz', 600000).outcome == 'review'
    assert choose_isrc(rows, 'Eric Prydz', None).outcome == 'review'


def test_combined_lookup_transliterates_with_unidecode():
    pytest.importorskip('unidecode')
    from unidecode import unidecode

    # CJK letters are word characters, so they survive the strip and unidecode maps them to Pinyin.
    assert combined_lookup('周杰伦', '晴天') == unidecode('周杰伦晴天')


@pytest.mark.asyncio
async def test_canonical_tier_binds_the_unidecode_combined_lookup():
    seen = {}

    def handler(sql, args):
        if _kind(sql) == 'canonical':
            seen['key'] = args[0]
            return [_row(id=None, mbid=MBID_A, title='Strobe', artist='deadmau5', duration_ms=None)]
        return []

    resolver, conn = _resolver(handler)
    result = await resolver.resolve('deadmau5', 'Strobe')
    assert result.method == 'canonical_exact'
    assert result.confidence_bucket == 'auto'
    assert seen['key'] == combined_lookup('deadmau5', 'Strobe')
    assert 'regexp_replace' not in ''.join(conn.seen)


@pytest.mark.asyncio
async def test_dump_id_prefers_load_manifest_then_env(monkeypatch):
    monkeypatch.delenv('MB_LOCAL_DUMP_ID', raising=False)

    def with_manifest(sql, args):
        if _kind(sql) == 'manifest':
            return [_row(dump_id='dump-2026-10-24')]
        if _kind(sql) == 'canonical':
            return [_row(id=None, mbid=MBID_A, title='Strobe', artist='deadmau5', duration_ms=None)]
        return []

    resolver = MusicBrainzResolver(Scripted(with_manifest))
    result = await resolver.resolve('deadmau5', 'Strobe')
    assert result.dump_version == 'dump-2026-10-24'

    class _Missing(Exception):
        sqlstate = '42P01'

    def missing(sql, args):
        if _kind(sql) == 'manifest':
            raise _Missing('relation ref_mb.load_manifest does not exist')
        if _kind(sql) == 'canonical':
            return [_row(id=None, mbid=MBID_A, title='Strobe', artist='deadmau5', duration_ms=None)]
        return []

    monkeypatch.setenv('MB_LOCAL_DUMP_ID', 'env-dump')
    result = await MusicBrainzResolver(Scripted(missing)).resolve('deadmau5', 'Strobe')
    assert result.dump_version == 'env-dump'

    monkeypatch.delenv('MB_LOCAL_DUMP_ID', raising=False)
    result = await MusicBrainzResolver(Scripted(missing)).resolve('deadmau5', 'Strobe')
    assert result.dump_version is None

    class _Timeout(Exception):
        sqlstate = '57014'

    def timed_out(sql, args):
        if _kind(sql) == 'manifest':
            raise _Timeout('canceling statement due to statement timeout')
        if _kind(sql) == 'canonical':
            return [_row(id=None, mbid=MBID_A, title='Strobe', artist='deadmau5', duration_ms=None)]
        return []

    monkeypatch.setenv('MB_LOCAL_DUMP_ID', 'env-after-timeout')
    result = await MusicBrainzResolver(Scripted(timed_out)).resolve('deadmau5', 'Strobe')
    assert result is not None
    assert result.method == 'canonical_exact'
    assert result.confidence_bucket == 'auto'
    assert result.dump_version == 'env-after-timeout'

    monkeypatch.delenv('MB_LOCAL_DUMP_ID', raising=False)
    result = await MusicBrainzResolver(Scripted(timed_out)).resolve('deadmau5', 'Strobe')
    assert result is not None
    assert result.dump_version is None


@pytest.mark.asyncio
async def test_read_dump_id_returns_none_when_the_table_is_missing():
    class _Missing(Exception):
        sqlstate = '42P01'

    class Conn:
        async def fetchrow(self, sql, *args):
            assert 'load_manifest' in sql
            assert 'dump_meta' not in sql
            raise _Missing('relation ref_mb.load_manifest does not exist')

    assert 'dump_meta' not in LOAD_MANIFEST_SQL
    assert await read_dump_id(Conn()) is None

    class _Timeout(Exception):
        sqlstate = '57014'

    class Slow:
        async def fetchrow(self, sql, *args):
            raise _Timeout('canceling statement due to statement timeout')

    assert await read_dump_id(Slow()) is None


def test_fuzzy_bucket_is_never_auto():
    assert confidence_bucket('fuzzy', 'accept') == 'review'
    assert confidence_bucket('isrc', 'accept') == 'auto'
    assert confidence_bucket('exact_normalized', 'review') == 'review'


def _resolver(handler):
    conn = Scripted(handler)
    return MusicBrainzResolver(conn, dump_version='test'), conn


def _empty(sql, args):
    return []


@pytest.mark.asyncio
async def test_resolve_order_is_isrc_canonical_fuzzy_then_gid():
    resolver, conn = _resolver(_empty)
    result = await resolver.resolve('deadmau5', 'Strobe', isrc='USRC17607839', mbid=MBID_A)
    assert result is None
    kinds = [_kind(sql) for sql in conn.seen]
    assert kinds[:3] == ['isrc', 'canonical', 'fuzzy-artist']
    assert 'exact' not in kinds
    assert 'gid' in kinds
    assert FUZZY_THRESHOLD_SQL in conn.executed
    assert not any('enable_seqscan' in sql for sql in conn.executed)


@pytest.mark.asyncio
async def test_ambiguous_isrc_does_not_fall_through_and_stays_review():
    def handler(sql, args):
        if _kind(sql) == 'isrc':
            return [
                _row(id=1, mbid=MBID_A, title='Opus', artist='Eric Prydz', duration_ms=600000),
                _row(id=2, mbid=MBID_B, title='Opus', artist='Eric Prydz', duration_ms=601000),
            ]
        return []

    resolver, conn = _resolver(handler)
    result = await resolver.resolve('Eric Prydz', 'Opus', isrc='GBAAA0000001', duration=600000)
    assert result is not None
    assert result.confidence_bucket == 'review'
    assert result.method == 'isrc'
    assert {item['mbid'] for item in result.candidates} == {MBID_A, MBID_B}
    kinds = [_kind(sql) for sql in conn.seen]
    assert 'canonical' not in kinds
    assert 'fuzzy-artist' not in kinds


@pytest.mark.asyncio
async def test_isrc_hit_stores_canonical_mbid_label_and_year():
    def handler(sql, args):
        kind = _kind(sql)
        if kind == 'isrc':
            return [_row(id=10, mbid=MBID_A, title='Strobe', artist='deadmau5', duration_ms=634000)]
        if kind == 'canon-redirect':
            return [_row(recording_mbid=MBID_A, canonical_recording_mbid=MBID_C)]
        if kind == 'enrich':
            return [_row(label='mau5trap', country_year=2009, country_month=9, country_day=22,
                         unknown_year=None, unknown_month=None, unknown_day=None)]
        if kind == 'genre':
            return [_row(name='Progressive House')]
        return []

    resolver, conn = _resolver(handler)
    result = await resolver.resolve('deadmau5', 'Strobe', isrc='USRC17607839', duration=634000)
    assert result.confidence_bucket == 'auto'
    assert result.canonical_mbid == MBID_C
    assert result.record_label == 'mau5trap'
    assert result.release_year == 2009
    assert result.release_date == '2009-09-22'
    assert result.genres == ('Progressive House',)
    assert result.candidates[0]['canonical_mbid'] == MBID_C
    assert '$1::bpchar' in conn.seen[0]
    gid_args = [args for sql, args in conn.calls if _kind(sql) == 'gid']
    canon_args = [args for sql, args in conn.calls if _kind(sql) == 'canon-redirect']
    assert gid_args[0][0] == [uuid.UUID(MBID_A)]
    assert canon_args[0][0] == [uuid.UUID(MBID_A)]


class _MissingRelation(Exception):
    sqlstate = '42P01'


@pytest.mark.asyncio
async def test_missing_genre_table_does_not_drop_an_isrc_match():
    def handler(sql, args):
        if _kind(sql) == 'isrc':
            return [_row(id=10, mbid=MBID_A, title='Strobe', artist='deadmau5', duration_ms=634000)]
        if _kind(sql) == 'genre':
            raise _MissingRelation('relation ref_mb.l_genre_release_group does not exist')
        return []

    resolver, _conn = _resolver(handler)
    result = await resolver.resolve('deadmau5', 'Strobe', isrc='USRC17607839', duration=634000)
    assert result is not None
    assert result.confidence_bucket == 'auto'
    assert result.canonical_mbid == MBID_A
    assert result.genres == ()


@pytest.mark.asyncio
async def test_fuzzy_hit_is_review_even_above_the_similarity_floor():
    def handler(sql, args):
        kind = _kind(sql)
        if kind == 'fuzzy-artist':
            return [_row(artist_id=7, sim=0.64)]
        if kind == 'fuzzy-recording':
            return [_row(id=3, mbid=MBID_B, title='Strobe', artist='deadmau5', duration_ms=634000, title_sim=0.9)]
        return []

    resolver, _conn = _resolver(handler)
    result = await resolver.resolve('deadmau5', 'Strobe')
    assert result.method == 'fuzzy'
    assert result.confidence_bucket == 'review'


@pytest.mark.asyncio
async def test_fuzzy_below_the_floor_is_not_returned():
    def handler(sql, args):
        if _kind(sql) == 'fuzzy-artist':
            return [_row(artist_id=7, sim=0.63)]
        return []

    resolver, conn = _resolver(handler)
    assert await resolver.resolve('deadmau5', 'Strobe') is None
    assert 'fuzzy-recording' not in [_kind(sql) for sql in conn.seen]


def test_local_provider_is_disabled_unless_the_flag_is_on():
    off = [provider.name for provider in build_providers({}, saved={})]
    assert 'musicbrainz' in off
    assert 'musicbrainz_local' not in off
    on = [provider.name for provider in build_providers({'MB_LOCAL_ENABLED': '1'}, saved={})]
    assert on.index('musicbrainz_local') < on.index('musicbrainz')


def test_settings_default_off(monkeypatch):
    for key in ('MB_LOCAL_ENABLED', 'MB_LOCAL_HOST', 'MB_LOCAL_PORT', 'MB_LOCAL_DATABASE',
                'MB_LOCAL_SCHEMA', 'MB_LOCAL_USER', 'MB_LOCAL_PASSWORD'):
        monkeypatch.delenv(key, raising=False)
    settings = RefMBSettings.from_env()
    assert settings.enabled is False
    assert settings.host == 'host.docker.internal'
    assert settings.port == 55433
    assert settings.database == 'ref_mb'
    assert settings.schema == 'ref_mb'
    assert settings.user == 'ref_mb_reader'
    assert 'password' not in settings.__dict__


@pytest.mark.asyncio
async def test_provider_review_hit_has_no_accepted_mbid(monkeypatch):
    monkeypatch.setenv('MB_LOCAL_ENABLED', 'true')

    class _Pool:
        def acquire(self):
            return self

        async def __aenter__(self):
            return Scripted(lambda sql, args: [])

        async def __aexit__(self, *args):
            return False

    provider = MusicBrainzLocalProvider(RefMBSettings(enabled=True))
    provider.pool = _Pool()

    async def resolve(self, **kwargs):
        return type('M', (), {
            'method': 'fuzzy', 'confidence_bucket': 'auto', 'canonical_mbid': MBID_A, 'mbid': MBID_A,
            'isrc': 'USRC17607839', 'duration_ms': 1000, 'record_label': 'mau5trap', 'genres': ('House',),
            'candidates': ({'mbid': MBID_A, 'canonical_mbid': MBID_A},), 'release_date': '2009',
            'release_year': 2009, 'matched_title': 'Strobe', 'matched_artist': 'deadmau5',
            'dump_version': 'test',
        })()

    monkeypatch.setattr(MusicBrainzResolver, 'resolve', resolve)
    found = await provider.lookup(Track('Strobe', 'deadmau5'))
    assert found[0].raw['confidence_bucket'] == 'review'
    assert 'musicbrainz_id' not in found[0].fields
    assert local_review(found)


def test_superseded_migration_does_not_execute_unique_ddl():
    text = (ROOT / 'scrapers' / 'sql' / 'migrations' / '001_add_mbid_and_camelot.sql').read_text(encoding='utf-8')
    notice, _comment, historical = text.partition('/*')
    assert 'SUPERSEDED' in notice
    assert 'RAISE NOTICE' in notice
    runnable = '\n'.join(line for line in notice.splitlines() if line.strip() and not line.strip().startswith('--'))
    assert 'UNIQUE' not in runnable
    assert 'ALTER' not in runnable
    assert 'ADD COLUMN IF NOT EXISTS musicbrainz_id VARCHAR(100) UNIQUE' in historical
    up = (ROOT / 'sql' / 'migrations' / '100_ref_mb_schema_up.sql').read_text(encoding='utf-8')
    down = (ROOT / 'sql' / 'migrations' / '100_ref_mb_schema_down.sql').read_text(encoding='utf-8')
    assert 'NO-OP' in up and 'NO-OP' in down
    assert 'CREATE TABLE ref_mb.' not in up
    assert 'DROP SCHEMA IF EXISTS ref_mb' not in down

    def executable(sql: str) -> str:
        return '\n'.join(line for line in sql.splitlines() if line.strip() and not line.strip().startswith('--'))

    assert executable(up) == ''
    assert executable(down) == ''
    indexes = (ROOT / 'sql' / 'migrations' / '140_mb_indexes_up.sql').read_text(encoding='utf-8')
    assert executable(indexes) == ''
    assert 'NO-OP' in indexes


@pytest.mark.asyncio
async def test_enrichment_does_not_auto_accept_a_review_bucket(monkeypatch):
    from unittest.mock import AsyncMock

    from common.datalayer import enrichment

    recorded = AsyncMock()
    monkeypatch.setattr(enrichment.evidence, 'snapshot_legacy', AsyncMock(return_value=0))
    monkeypatch.setattr(enrichment.evidence, 'record', recorded)
    monkeypatch.setattr(enrichment.evidence, '_set_reasons', AsyncMock())
    monkeypatch.setattr(enrichment.evidence, 'apply_all', AsyncMock(return_value={}))

    class Conn:
        def transaction(self):
            return self

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return False

        async def fetchrow(self, *args, **kwargs):
            return {'id': uuid.uuid4(), 'artist_name': 'deadmau5', 'track_title': 'Strobe',
                    'isrc': None, 'duration_ms': 634000, 'genre': []}

        async def execute(self, *args, **kwargs):
            return None

    class Provider:
        name = 'musicbrainz_local'
        independent_group = 'musicbrainz'

        async def lookup(self, target, genres=None):
            # Identical text and duration would be an automatic fuzzy match without the review flag.
            return [ProviderTrack(
                'musicbrainz_local',
                Track('Strobe', 'deadmau5', duration_ms=634000, ref=MBID_A),
                fields={'musicbrainz_id': MBID_A},
                raw={'confidence_bucket': 'review', 'candidates': [{'mbid': MBID_A}, {'mbid': MBID_B}]},
            )]

    summary = await enrichment.enrich_track(Conn(), uuid.uuid4(), [Provider()])
    assert summary['matched'] == []
    assert summary['review'][0]['provider'] == 'musicbrainz_local'
    assert summary['review'][0]['candidate_mbids'] == [MBID_A, MBID_B]
    recorded.assert_not_called()
