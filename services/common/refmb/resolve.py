"""Read-only lookup against a local MusicBrainz mirror (`ref_mb`).

The connection is expected to have `search_path` set to the mirror schema plus `public`
(see `refmb.settings.create_pool`) and to be read-only. Queries use stock MusicBrainz
column names (SCHEMA_SEQUENCE 31) plus the canonical dump tables. Names that are not in
this repository are called out in `ASSUMPTIONS`.

Order: ISRC (canonical-collapsed) → exact normalised artist+title → canonical
`combined_lookup` → artist-first trigram fuzzy (review only) → recording gid redirect.
"""
from __future__ import annotations

import os
import re
from dataclasses import dataclass, field
from typing import Any, List, Optional, Sequence, Tuple

from common.metadata.matching import Track, normalize_isrc

from .match import (
    FUZZY_SIMILARITY_FLOOR,
    RecordingCandidate,
    choose_isrc,
    combined_lookup,
    confidence_bucket,
)

_UUID = re.compile(r'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$')

# isrc.isrc is char(12). A text parameter does not use the index; ::bpchar does.
ISRC_SQL = """
SELECT r.id, r.gid::text AS mbid, r.name AS title, ac.name AS artist, r.length AS duration_ms
FROM ref_mb.isrc i
JOIN ref_mb.recording r ON r.id = i.recording
JOIN ref_mb.artist_credit ac ON ac.id = r.artist_credit
WHERE i.isrc = $1::bpchar
"""

# Assumed expression of the custom index sn_cmd_lookup. Not created by this repository.
EXACT_SQL = """
/* sn_cmd_lookup: assumed expression index on this predicate */
SELECT r.id, r.gid::text AS mbid, r.name AS title, ac.name AS artist, r.length AS duration_ms
FROM ref_mb.recording r
JOIN ref_mb.artist_credit ac ON ac.id = r.artist_credit
WHERE lower(regexp_replace(public.unaccent(ac.name || r.name), '[^\\w]+', '', 'g')) = $1
LIMIT 25
"""

CANONICAL_SQL = """
SELECT NULL::int AS id, recording_mbid::text AS mbid, recording_name AS title,
       artist_credit_name AS artist, NULL::int AS duration_ms
FROM ref_mb.canonical_musicbrainz_data
WHERE combined_lookup = $1
ORDER BY score DESC
LIMIT 5
"""

FUZZY_ARTIST_SQL = """
SELECT a.id AS artist_id, similarity(lower(public.unaccent(a.name)), lower(public.unaccent($1))) AS sim
FROM ref_mb.artist a
WHERE lower(public.unaccent(a.name)) % lower(public.unaccent($1))
ORDER BY lower(public.unaccent(a.name)) <-> lower(public.unaccent($1))
LIMIT 5
"""

FUZZY_RECORDING_SQL = """
SELECT r.id, r.gid::text AS mbid, r.name AS title, ac.name AS artist, r.length AS duration_ms,
       similarity(lower(public.unaccent(r.name)), lower(public.unaccent($2))) AS title_sim
FROM ref_mb.artist_credit_name acn
JOIN ref_mb.artist_credit ac ON ac.id = acn.artist_credit
JOIN ref_mb.recording r ON r.artist_credit = ac.id
WHERE acn.artist = $1 AND acn.position = 0
ORDER BY lower(public.unaccent(r.name)) <-> lower(public.unaccent($2))
LIMIT 20
"""

GID_REDIRECT_SQL = """
SELECT g.gid::text AS old_gid, r.id, r.gid::text AS mbid, r.name AS title, ac.name AS artist, r.length AS duration_ms
FROM ref_mb.recording_gid_redirect g
JOIN ref_mb.recording r ON r.id = g.new_id
JOIN ref_mb.artist_credit ac ON ac.id = r.artist_credit
WHERE g.gid::text = ANY($1::text[])
"""

CANONICAL_REDIRECT_SQL = """
SELECT recording_mbid::text AS recording_mbid, canonical_recording_mbid::text AS canonical_recording_mbid
FROM ref_mb.canonical_recording_redirect
WHERE recording_mbid::text = ANY($1::text[])
"""

RECORDING_BY_GID_SQL = """
SELECT r.id, r.gid::text AS mbid, r.name AS title, ac.name AS artist, r.length AS duration_ms
FROM ref_mb.recording r
JOIN ref_mb.artist_credit ac ON ac.id = r.artist_credit
WHERE r.gid = $1::uuid
"""

ENRICH_SQL = """
SELECT lab.name AS label,
       rc.date_year AS country_year, rc.date_month AS country_month, rc.date_day AS country_day,
       ru.date_year AS unknown_year, ru.date_month AS unknown_month, ru.date_day AS unknown_day
FROM ref_mb.track t
JOIN ref_mb.medium m ON m.id = t.medium
JOIN ref_mb.release rel ON rel.id = m.release
LEFT JOIN ref_mb.release_label rl ON rl.release = rel.id
LEFT JOIN ref_mb.label lab ON lab.id = rl.label
LEFT JOIN ref_mb.release_country rc ON rc.release = rel.id
LEFT JOIN ref_mb.release_unknown_country ru ON ru.release = rel.id
WHERE t.recording = $1
LIMIT 40
"""

# CC0 genre vocabulary via l_genre_release_group (entity0 = genre, entity1 = release group).
# recording_tag is non-commercial and is not queried. The link table may be absent.
GENRE_SQL = """
SELECT DISTINCT g.name
FROM ref_mb.track t
JOIN ref_mb.medium m ON m.id = t.medium
JOIN ref_mb.release rel ON rel.id = m.release
JOIN ref_mb.l_genre_release_group lg ON lg.entity1 = rel.release_group
JOIN ref_mb.genre g ON g.id = lg.entity0
WHERE t.recording = $1
LIMIT 8
"""

ASSUMPTIONS = (
    'isrc.isrc is char(12); the parameter is cast to bpchar so the index is used',
    'sn_cmd_lookup is the expression index on lower(regexp_replace(unaccent(artist_credit.name || recording.name), non-word, empty))',
    'canonical_musicbrainz_data.combined_lookup matches ListenBrainz combined_lookup; higher score is preferred; there is no year column',
    'canonical_recording_redirect columns are recording_mbid, canonical_recording_mbid (uuid text)',
    'artist-first fuzzy uses pg_trgm on lower(unaccent(artist.name)) with enable_seqscan off; similarity >= 0.64 is review only',
    'release dates come from release_country and release_unknown_country (CC0), not the derived first-release table',
    'genre comes only from CC0 l_genre_release_group; tag votes are not loaded',
    'recording_gid_redirect.new_id is recording.id',
)


def _skippable(exc: BaseException) -> bool:
    """Missing relation/function, or the statement timeout on a tier we can skip."""
    sqlstate = getattr(exc, 'sqlstate', None)
    if sqlstate in {'42P01', '42883', '57014'}:
        return True
    text = str(exc).lower()
    return 'does not exist' in text or 'statement timeout' in text or 'undefined' in text


def _int(value: Any) -> Optional[int]:
    if value is None or value == '':
        return None
    try:
        number = int(value)
    except (TypeError, ValueError):
        return None
    return number if number > 0 else None


def _float(value: Any) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0


def _text(value: Any) -> str:
    return '' if value is None else str(value)


def _field(row: Any, name: str) -> Any:
    try:
        return row[name]
    except (KeyError, IndexError, TypeError):
        return None


def _candidate(row: Any, canonical: Optional[str] = None) -> RecordingCandidate:
    return RecordingCandidate(
        mbid=_text(_field(row, 'mbid')),
        title=_text(_field(row, 'title')),
        artist=_text(_field(row, 'artist')),
        duration_ms=_int(_field(row, 'duration_ms')),
        canonical_mbid=canonical,
        recording_id=_int(_field(row, 'id')),
    )


@dataclass(frozen=True)
class MatchResult:
    mbid: str
    canonical_mbid: Optional[str]
    method: str
    variant: str
    artist_sim: float
    title_sim: float
    duration_delta: Optional[int]
    mix_class_match: bool
    confidence_bucket: str
    dump_version: str
    normaliser_version: str
    isrc: Optional[str] = None
    duration_ms: Optional[int] = None
    record_label: Optional[str] = None
    release_date: Optional[str] = None
    release_year: Optional[int] = None
    genres: Tuple[str, ...] = ()
    candidates: Tuple[dict, ...] = ()
    matched_title: str = ''
    matched_artist: str = ''
    assumptions: Tuple[str, ...] = field(default_factory=lambda: ASSUMPTIONS)


def _partial_date(year: Any, month: Any, day: Any) -> Optional[tuple]:
    y = _int(year)
    if not y:
        return None
    m = _int(month)
    d = _int(day)
    if m and d:
        return (y, m, d, f'{y:04d}-{m:02d}-{d:02d}')
    if m:
        return (y, m, 0, f'{y:04d}-{m:02d}')
    return (y, 0, 0, f'{y:04d}')


class MusicBrainzResolver:
    def __init__(self, conn: Any, dump_version: Optional[str] = None):
        self.conn = conn
        self.dump_version = dump_version or os.getenv('MB_LOCAL_DUMP_ID', '') or 'unspecified'
        self.normaliser_version = 'combined_lookup-v1'

    async def _fetch(self, sql: str, *args) -> list:
        try:
            rows = await self.conn.fetch(sql, *args)
        except Exception as exc:
            if _skippable(exc):
                return []
            raise
        return list(rows or [])

    async def _redirect_maps(self, mbids: Sequence[str]) -> tuple:
        ids = [mbid for mbid in mbids if mbid]
        if not ids:
            return {}, {}
        gid_rows = await self._fetch(GID_REDIRECT_SQL, ids)
        canonical_rows = await self._fetch(CANONICAL_REDIRECT_SQL, ids)
        gid_map = {_text(row['old_gid']): row for row in gid_rows}
        canonical_map = {_text(row['recording_mbid']): _text(row['canonical_recording_mbid'])
                         for row in canonical_rows if row['canonical_recording_mbid']}
        return gid_map, canonical_map

    def _canonical_of(self, mbid: str, gid_map: dict, canonical_map: dict) -> str:
        current = mbid
        for _ in range(3):
            redirected = gid_map.get(current)
            nxt = _text(redirected['mbid']) if redirected is not None else ''
            if not nxt or nxt == current:
                break
            current = nxt
        return canonical_map.get(current) or canonical_map.get(mbid) or current

    async def _decorate(self, rows: Sequence[Any]) -> List[RecordingCandidate]:
        if not rows:
            return []
        gid_map, canonical_map = await self._redirect_maps([_text(row['mbid']) for row in rows])
        decorated = []
        for row in rows:
            mbid = _text(row['mbid'])
            canonical = self._canonical_of(mbid, gid_map, canonical_map)
            decorated.append(_candidate(row, canonical))
        return decorated

    async def _recording_id_for(self, mbid: str) -> Optional[int]:
        if not _UUID.match(mbid or ''):
            return None
        rows = await self._fetch(RECORDING_BY_GID_SQL, mbid)
        return _int(_field(rows[0], 'id')) if rows else None

    async def _enrich(self, recording_id: Optional[int]) -> dict:
        empty = {'record_label': None, 'release_date': None, 'release_year': None, 'genres': ()}
        if not recording_id:
            return empty
        rows = await self._fetch(ENRICH_SQL, recording_id)
        label = next((_text(_field(row, 'label')) for row in rows if _text(_field(row, 'label'))), None)
        dates = []
        for row in rows:
            for key in (('country_year', 'country_month', 'country_day'),
                        ('unknown_year', 'unknown_month', 'unknown_day')):
                parsed = _partial_date(_field(row, key[0]), _field(row, key[1]), _field(row, key[2]))
                if parsed:
                    dates.append(parsed)
        release_date = release_year = None
        if dates:
            dates.sort()
            release_year = dates[0][0]
            release_date = dates[0][3]
        genres = tuple(_text(_field(row, 'name')) for row in await self._fetch(GENRE_SQL, recording_id)
                       if _text(_field(row, 'name')))
        return {'record_label': label or None, 'release_date': release_date, 'release_year': release_year,
                'genres': genres}

    def _evidence(self, candidates: Sequence[RecordingCandidate]) -> Tuple[dict, ...]:
        return tuple(
            {'mbid': row.mbid, 'canonical_mbid': row.canonical, 'title': row.title, 'artist': row.artist,
             'duration_ms': row.duration_ms}
            for row in candidates
        )

    async def _finish(self, method: str, outcome: str, chosen: Optional[RecordingCandidate],
                      candidates: Sequence[RecordingCandidate], *, variant: str, isrc: Optional[str] = None,
                      artist_sim: float = 0.0, title_sim: float = 0.0,
                      duration_delta: Optional[int] = None) -> MatchResult:
        chosen = chosen or (candidates[0] if candidates else None)
        if chosen is not None and not chosen.recording_id:
            recording_id = await self._recording_id_for(chosen.canonical) or await self._recording_id_for(chosen.mbid)
            if recording_id:
                chosen = RecordingCandidate(chosen.mbid, chosen.title, chosen.artist, chosen.duration_ms,
                                            chosen.canonical_mbid, recording_id)
        canonical = chosen.canonical if chosen else ''
        meta = await self._enrich(chosen.recording_id if chosen else None)
        bucket = confidence_bucket(method, outcome)
        return MatchResult(
            mbid=chosen.mbid if chosen else '',
            canonical_mbid=canonical or None,
            method=method,
            variant=variant,
            artist_sim=artist_sim,
            title_sim=title_sim,
            duration_delta=duration_delta,
            mix_class_match=method != 'fuzzy',
            confidence_bucket=bucket,
            dump_version=self.dump_version,
            normaliser_version=self.normaliser_version,
            isrc=isrc,
            duration_ms=chosen.duration_ms if chosen else None,
            record_label=meta['record_label'],
            release_date=meta['release_date'],
            release_year=meta['release_year'],
            genres=meta['genres'],
            candidates=self._evidence(candidates),
            matched_title=chosen.title if chosen else '',
            matched_artist=chosen.artist if chosen else '',
        )

    async def _by_isrc(self, isrc: str, artist: str, duration_ms: Optional[int]) -> Optional[MatchResult]:
        rows = await self._fetch(ISRC_SQL, isrc)
        if not rows:
            return None
        choice = choose_isrc(await self._decorate(rows), artist, duration_ms)
        if choice.outcome == 'miss':
            return None
        delta = None
        if choice.chosen and choice.chosen.duration_ms and duration_ms:
            delta = abs(int(duration_ms) - choice.chosen.duration_ms)
        return await self._finish(
            'isrc', choice.outcome, choice.chosen, choice.candidates, variant=choice.outcome,
            isrc=isrc, artist_sim=1.0 if choice.outcome == 'accept' else 0.0, title_sim=1.0 if choice.outcome == 'accept' else 0.0,
            duration_delta=delta,
        )

    async def _by_exact(self, key: str) -> Optional[MatchResult]:
        rows = await self._decorate(await self._fetch(EXACT_SQL, key))
        if not rows:
            return None
        unique = {row.canonical: row for row in rows}
        outcome = 'accept' if len(unique) == 1 else 'review'
        chosen = next(iter(unique.values())) if outcome == 'accept' else None
        return await self._finish('exact_normalized', outcome, chosen, list(unique.values()), variant='sn_cmd_lookup',
                                  artist_sim=1.0 if outcome == 'accept' else 0.0, title_sim=1.0 if outcome == 'accept' else 0.0)

    async def _by_canonical(self, key: str) -> Optional[MatchResult]:
        rows = await self._decorate(await self._fetch(CANONICAL_SQL, key))
        if not rows:
            return None
        # The dump is already one preferred row per lookup; disagreeing MBIDs stay in review.
        unique = []
        seen = set()
        for row in rows:
            if row.canonical in seen:
                continue
            seen.add(row.canonical)
            unique.append(row)
        outcome = 'accept' if len(unique) == 1 else 'review'
        return await self._finish('canonical_exact', outcome, unique[0] if outcome == 'accept' else None, unique,
                                  variant='combined_lookup', artist_sim=1.0 if outcome == 'accept' else 0.0,
                                  title_sim=1.0 if outcome == 'accept' else 0.0)

    async def _by_fuzzy(self, artist: str, title: str) -> Optional[MatchResult]:
        try:
            transaction = getattr(self.conn, 'transaction', None)
            if transaction is None:
                picked = await self._fuzzy_pick(artist, title)
            else:
                async with self.conn.transaction():
                    picked = await self._fuzzy_pick(artist, title, set_local=True)
        except Exception as exc:
            if _skippable(exc):
                return None
            raise
        if picked is None:
            return None
        recording, artist_sim, title_sim = picked
        decorated = await self._decorate([recording])
        if not decorated:
            return None
        # Always review. confidence_bucket() also forces this for method 'fuzzy'.
        return await self._finish('fuzzy', 'review', decorated[0], decorated, variant='artist_trgm',
                                  artist_sim=artist_sim, title_sim=title_sim)

    async def _fuzzy_pick(self, artist: str, title: str, set_local: bool = False):
        """Artist and title scans only. Enrichment runs afterwards so a missing optional
        table cannot abort the transaction that holds this candidate."""
        if set_local:
            try:
                await self.conn.execute('SET LOCAL enable_seqscan = off')
            except Exception as exc:
                if not _skippable(exc):
                    raise
        artists = await self._fetch(FUZZY_ARTIST_SQL, artist)
        for artist_row in artists:
            artist_sim = _float(artist_row['sim'])
            if artist_sim < FUZZY_SIMILARITY_FLOOR:
                continue
            recordings = await self._fetch(FUZZY_RECORDING_SQL, artist_row['artist_id'], title)
            ranked = sorted(recordings, key=lambda row: _float(_field(row, 'title_sim')), reverse=True)
            for recording in ranked:
                title_sim = _float(_field(recording, 'title_sim'))
                if title_sim < FUZZY_SIMILARITY_FLOOR:
                    continue
                return recording, artist_sim, title_sim
        return None

    async def _by_gid(self, mbid: str) -> Optional[MatchResult]:
        if not _UUID.match(mbid or ''):
            return None
        rows = await self._fetch(GID_REDIRECT_SQL, [mbid])
        if not rows:
            rows = await self._fetch(RECORDING_BY_GID_SQL, mbid)
            # A current gid is not a new match; only a redirect (or a gid that canonicalises
            # to a different recording) is this tier.
            decorated = await self._decorate(rows)
            if not decorated or decorated[0].canonical == mbid:
                return None
            rows = []
            chosen_rows = decorated
        else:
            chosen_rows = await self._decorate(rows)
        if not chosen_rows:
            return None
        return await self._finish('gid_redirect', 'accept', chosen_rows[0], chosen_rows, variant='recording_gid_redirect',
                                  artist_sim=1.0, title_sim=1.0)

    async def resolve(self, artist: str, title: str, mix: Optional[str] = None, isrc: Optional[str] = None,
                      duration: Optional[int] = None, mbid: Optional[str] = None) -> Optional[MatchResult]:
        full_title = f'{title} {mix}'.strip() if mix else (title or '')
        code = normalize_isrc(isrc)
        if code:
            found = await self._by_isrc(code, artist or '', duration)
            if found is not None:
                return found
        key = combined_lookup(artist or '', full_title)
        if key:
            found = await self._by_exact(key)
            if found is not None:
                return found
            found = await self._by_canonical(key)
            if found is not None:
                return found
        found = await self._by_fuzzy(artist or '', full_title)
        if found is not None:
            return found
        if mbid:
            return await self._by_gid(mbid)
        return None

    async def resolve_many(self, items: List[dict]) -> List[Optional[MatchResult]]:
        return [await self.resolve(artist=item.get('artist', ''), title=item.get('title', ''), mix=item.get('mix'),
                                   isrc=item.get('isrc'), duration=item.get('duration'), mbid=item.get('mbid'))
                for item in items]


async def local_candidates(conn: Any, artist: str, title: str, mix: Optional[str] = None,
                           isrc: Optional[str] = None, duration: Optional[int] = None) -> List[Track]:
    match = await MusicBrainzResolver(conn).resolve(artist, title, mix, isrc, duration)
    if not match or match.confidence_bucket != 'auto':
        return []
    return [Track(title=match.matched_title or title, artist=match.matched_artist or artist, isrc=isrc,
                  duration_ms=match.duration_ms or duration, ref=match.canonical_mbid)]
