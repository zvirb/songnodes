import re
from typing import List, Optional, Tuple, Dict, Any
from dataclasses import dataclass

from services.common.metadata import matching
from contracts import normalise

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

def get_mix_class(versions: Tuple[str, ...]) -> str:
    """Uses the common version strings to categorize the mix"""
    if not versions:
        return 'original'

    classes = []
    for v in versions:
        if 'radio' in v:
            classes.append('radio')
        elif 'extended' in v:
            classes.append('extended')
        elif 'dub' in v:
            classes.append('dub')
        elif 'instrumental' in v:
            classes.append('instrumental')
        elif 'remix' in v or 'vip' in v or 'edit' in v or 'bootleg' in v:
            classes.append('remix')
        elif 'club' in v:
            classes.append('club')

    if not classes:
        return 'other'

    return '-'.join(sorted(set(classes)))

class MusicBrainzResolver:
    def __init__(self, conn: Any, dump_version: str = "2026-10-25"):
        self.conn = conn
        self.dump_version = dump_version
        self.normaliser_version = "v1"

    async def _resolve_redirects(self, recording_id: str) -> str:
        canonical = await self.conn.fetchval("""
            SELECT canonical_recording_mbid
            FROM ref_mb.canonical_recording_redirect
            WHERE recording_mbid = $1::uuid
        """, recording_id)
        return str(canonical) if canonical else recording_id

    async def resolve(
        self, artist: str, title: str,
        mix: Optional[str] = None,
        isrc: Optional[str] = None,
        duration: Optional[int] = None
    ) -> Optional[MatchResult]:

        # 0. Parse mix/version using the existing module
        full_title = f"{title} {mix}" if mix else title
        parsed_target = matching.parse_title(full_title)

        # 1. ISRC exact
        if isrc:
            norm_isrc = matching.normalize_isrc(isrc)
            if norm_isrc:
                records = await self.conn.fetch("""
                    SELECT r.gid as mbid, r.name as title, ac.name as artist, r.length as duration
                    FROM ref_mb.isrc i
                    JOIN ref_mb.recording r ON r.id = i.recording
                    JOIN ref_mb.artist_credit ac ON r.artist_credit = ac.id
                    WHERE i.isrc = $1
                """, norm_isrc)

                if records:
                    # Implement Tie-break logic
                    best = None
                    best_score = -1.0

                    target_track = matching.Track(
                        title=full_title,
                        artist=artist,
                        isrc=norm_isrc,
                        duration_ms=duration
                    )

                    for r in records:
                        c_track = matching.Track(
                            title=r['title'],
                            artist=r['artist'],
                            isrc=norm_isrc,
                            duration_ms=r['duration']
                        )
                        decision = matching.match_candidate(target_track, c_track)

                        if decision.score > best_score:
                            best_score = decision.score
                            best = r

                    if best:
                        mbid = str(best['mbid'])
                        canonical_mbid = await self._resolve_redirects(mbid)

                        return MatchResult(
                            mbid=mbid,
                            canonical_mbid=canonical_mbid,
                            method="isrc",
                            variant="exact",
                            artist_sim=1.0,
                            title_sim=1.0,
                            duration_delta=abs(duration - best['duration']) if duration and best['duration'] else None,
                            mix_class_match=True,
                            confidence_bucket="auto",
                            dump_version=self.dump_version,
                            normaliser_version=self.normaliser_version
                        )

        # 2. Exact combined_lookup
        variants = []

        # Exact with mix
        variants.append(("exact", normalise.combined_lookup(artist, full_title)))

        # If original/extended mix, try without mix
        target_mix_class = get_mix_class(parsed_target.versions)
        if target_mix_class in ('original', 'extended', 'other'):
            variants.append(("variant", normalise.combined_lookup(artist, title)))

        # Try primary artist only
        primary_artist = artist.split('feat.')[0].split(' ft.')[0].split(' vs ')[0].strip()
        if primary_artist != artist:
             variants.append(("variant_primary_artist", normalise.combined_lookup(primary_artist, full_title)))

        for variant, lookup_key in variants:
            records = await self.conn.fetch("""
                SELECT recording_mbid, score, recording_name, artist_credit_name
                FROM ref_mb.canonical_musicbrainz_data
                WHERE combined_lookup = $1
                ORDER BY score DESC
            """, lookup_key)

            if records:
                # Use matching.py for consistency
                best = None
                best_decision = None

                target_track = matching.Track(
                    title=full_title,
                    artist=artist,
                    isrc=isrc,
                    duration_ms=duration
                )

                for r in records:
                    c_track = matching.Track(
                        title=r['recording_name'],
                        artist=r['artist_credit_name'],
                    )
                    decision = matching.match_candidate(target_track, c_track)
                    if not best_decision or decision.score > best_decision.score:
                        best_decision = decision
                        best = r

                if best and best_decision:
                    mbid = str(best['recording_mbid'])

                    c_parsed = matching.parse_title(best['recording_name'])
                    mix_match = get_mix_class(parsed_target.versions) == get_mix_class(c_parsed.versions)

                    bucket = "auto" if mix_match and best_decision.outcome == 'match' else "review"
                    if best_decision.outcome == 'reject':
                        bucket = 'none'

                    if bucket != 'none':
                        return MatchResult(
                            mbid=mbid,
                            canonical_mbid=mbid,
                            method="lookup_" + variant,
                            variant=variant,
                            artist_sim=best_decision.artist_score,
                            title_sim=best_decision.title_score,
                            duration_delta=None,
                            mix_class_match=mix_match,
                            confidence_bucket=bucket,
                            dump_version=self.dump_version,
                            normaliser_version=self.normaliser_version
                        )

        # 3. Fuzzy match via trigram
        # Get top 50 candidates by trigram on recording name using <-> to rank
        norm_title = matching.normalize_text(title)
        records = await self.conn.fetch("""
            SELECT r.gid as mbid, r.name as title, ac.name as artist, r.length as duration
            FROM ref_mb.recording r
            JOIN ref_mb.artist_credit ac ON r.artist_credit = ac.id
            ORDER BY r.name <-> $1
            LIMIT 50
        """, norm_title)

        target_track = matching.Track(
            title=full_title,
            artist=artist,
            isrc=isrc,
            duration_ms=duration
        )

        best_decision = None
        best_rec = None

        for rec in records:
            c_track = matching.Track(
                title=rec['title'],
                artist=rec['artist'],
                duration_ms=rec['duration']
            )

            decision = matching.match_candidate(target_track, c_track)
            if not best_decision or decision.score > best_decision.score:
                best_decision = decision
                best_rec = rec

        if best_rec and best_decision and best_decision.outcome != 'reject':
            mbid = str(best_rec['mbid'])
            canonical_mbid = await self._resolve_redirects(mbid)

            c_parsed = matching.parse_title(best_rec['title'])
            mix_match = get_mix_class(parsed_target.versions) == get_mix_class(c_parsed.versions)

            bucket = "auto" if best_decision.outcome == 'match' else "review"

            return MatchResult(
                mbid=mbid,
                canonical_mbid=canonical_mbid,
                method="fuzzy",
                variant="fuzzy",
                artist_sim=best_decision.artist_score,
                title_sim=best_decision.title_score,
                duration_delta=abs(duration - best_rec['duration']) if duration and best_rec['duration'] else None,
                mix_class_match=mix_match,
                confidence_bucket=bucket,
                dump_version=self.dump_version,
                normaliser_version=self.normaliser_version
            )

        return None

    async def resolve_many(self, items: List[Dict[str, Any]]) -> List[Optional[MatchResult]]:
        results = []
        for item in items:
            res = await self.resolve(
                artist=item.get('artist', ''),
                title=item.get('title', ''),
                mix=item.get('mix'),
                isrc=item.get('isrc'),
                duration=item.get('duration')
            )
            results.append(res)
        return results

async def local_candidates(
    conn: Any,
    artist: str,
    title: str,
    mix: Optional[str] = None,
    isrc: Optional[str] = None,
    duration: Optional[int] = None
) -> List[matching.Track]:

    resolver = MusicBrainzResolver(conn)
    match = await resolver.resolve(artist, title, mix, isrc, duration)

    if not match:
        return []

    return [
        matching.Track(
            title=f"{title} {mix}" if mix else title,
            artist=artist,
            isrc=isrc,
            duration_ms=duration,
            ref=match.canonical_mbid
        )
    ]
