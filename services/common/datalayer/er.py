"""Entity resolution for tracks and artists (Milestone 4): deterministic features, thresholds, shadow decisions.

Scoring is rule-based (`rules` / `v1`) and recorded per (method, model_version), so another model (for example a
Splink/DuckDB one) can run beside it in shadow mode and be compared on the same pairs before anything is promoted.
Three outcomes: `auto_match`, `review`, `reject`. Nothing is merged by scoring alone:
* shadow decisions only record a pair;
* promotion goes through `identity.merge_tracks`, which is fully reversible;
* an automatic match needs an anchor (equal ISRC or a known duration within the guard), so unknown-duration pairs
  stay `review` however similar their text is.
"""
import json
import re
from dataclasses import dataclass, field
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple
from uuid import UUID

from common.metadata import matching
from common.metadata.names import is_placeholder_artist, normalize

from . import identity
from .errors import CatalogError

METHOD, MODEL_VERSION = 'rules', 'v1'
AUTO_THRESHOLD, REVIEW_THRESHOLD = 0.995, 0.85   # near-identical text only; a one-letter difference is a review item
CHECKPOINT = 'er_shadow_tracks'
MAX_TRACKS_PER_ARTIST = 400   # larger partitions are skipped and reported rather than compared pairwise


@dataclass(frozen=True)
class Thresholds:
    auto: float = AUTO_THRESHOLD
    review: float = REVIEW_THRESHOLD


@dataclass(frozen=True)
class Decision:
    score: float
    decision: str                      # auto_match | review | reject
    reasons: Tuple[str, ...] = field(default_factory=tuple)
    features: Dict[str, Any] = field(default_factory=dict)


def track_features(a: Dict[str, Any], b: Dict[str, Any]) -> Dict[str, Any]:
    pa, pb = matching.parse_title(a['track_title']), matching.parse_title(b['track_title'])
    isrc_a, isrc_b = matching.normalize_isrc(a.get('isrc')), matching.normalize_isrc(b.get('isrc'))
    duration = matching.duration_state(a.get('duration_ms'), b.get('duration_ms'))
    return {
        'title_sim': round(matching.similarity(pa.base, pb.base), 4),
        'artist_sim': round(matching.similarity(matching.artist_key(a['artist_name']), matching.artist_key(b['artist_name'])), 4),
        'version_equal': pa.versions == pb.versions,
        'isrc': 'equal' if isrc_a and isrc_b and isrc_a == isrc_b else 'conflict' if isrc_a and isrc_b else 'unknown',
        'duration': duration,
        'duration_diff_ms': abs(a['duration_ms'] - b['duration_ms']) if duration != 'unknown' else None,
    }


def score_tracks(a: Dict[str, Any], b: Dict[str, Any], thresholds: Thresholds = Thresholds()) -> Decision:
    f = track_features(a, b)
    reasons: List[str] = []
    if is_placeholder_artist(a['artist_name']) or is_placeholder_artist(b['artist_name']):
        return Decision(0.0, 'reject', ('placeholder_artist',), f)
    if not f['version_equal']:
        return Decision(round(0.5 * f['title_sim'], 4), 'reject', ('version_differs',), f)   # remix != original
    if f['duration'] == 'beyond':
        return Decision(round(0.5 * f['title_sim'], 4), 'reject', ('duration_beyond_guard',), f)
    if f['isrc'] == 'equal':
        return Decision(1.0, 'auto_match', ('isrc_equal',), f)
    if f['isrc'] == 'conflict':
        reasons.append('isrc_conflict')   # two recordings of one song (re-release, remaster) are not the same recording
    score = round(0.6 * f['title_sim'] + 0.4 * f['artist_sim'], 4)
    if f['title_sim'] < 0.8 or f['artist_sim'] < 0.8:
        return Decision(score, 'reject', tuple(reasons) + ('text_below_floor',), f)
    anchored = f['duration'] == 'within'
    if score >= thresholds.auto and anchored and not reasons:
        return Decision(score, 'auto_match', ('text_and_duration_agree',), f)
    if score >= thresholds.review:
        return Decision(score, 'review', tuple(reasons) + (() if anchored else ('no_duration_anchor',)), f)
    return Decision(score, 'reject', tuple(reasons) + ('score_below_review',), f)


def score_artists(a: str, b: str, thresholds: Thresholds = Thresholds()) -> Decision:
    """Artist variants only ever reach `review`; merging artists stays a human decision."""
    strip = lambda s: matching.normalize_text(re.sub(r'\s*[\(\[][^\)\]]*[\)\]]', '', s))  # noqa: E731
    na, nb = strip(a), strip(b)
    if is_placeholder_artist(a) or is_placeholder_artist(b) or not na or not nb:
        return Decision(0.0, 'reject', ('placeholder_artist',))
    score = 1.0 if na == nb else round(matching.similarity(na, nb), 4)
    features = {'normalized_equal': na == nb, 'similarity': score}
    if score >= thresholds.review:
        return Decision(score, 'review', ('same_name_after_normalising',) if na == nb else ('similar_name',), features)
    return Decision(score, 'reject', ('score_below_review',), features)


def evaluate(labelled: Iterable[Tuple[Dict[str, Any], Dict[str, Any], bool]], thresholds: Thresholds = Thresholds()) -> Dict[str, Any]:
    """Precision/recall of `auto_match`, and of auto+review, against labelled pairs (`same` = True when the same recording)."""
    tally = {'auto_tp': 0, 'auto_fp': 0, 'review_tp': 0, 'review_fp': 0, 'reject_fn': 0, 'positives': 0, 'negatives': 0}
    false_merges: List[Dict[str, Any]] = []
    for a, b, same in labelled:
        result = score_tracks(a, b, thresholds)
        tally['positives' if same else 'negatives'] += 1
        if result.decision == 'auto_match':
            tally['auto_tp' if same else 'auto_fp'] += 1
            if not same:
                false_merges.append({'a': a['track_title'], 'b': b['track_title'], 'score': result.score, 'reasons': list(result.reasons)})
        elif result.decision == 'review':
            tally['review_tp' if same else 'review_fp'] += 1
        elif same:
            tally['reject_fn'] += 1
    ratio = lambda num, den: round(num / den, 4) if den else None  # noqa: E731
    return {**tally, 'auto_precision': ratio(tally['auto_tp'], tally['auto_tp'] + tally['auto_fp']),
            'auto_recall': ratio(tally['auto_tp'], tally['positives']),
            'candidate_recall': ratio(tally['auto_tp'] + tally['review_tp'], tally['positives']),
            'false_merges': false_merges}


def meets_precision(report: Dict[str, Any], target: float = 0.99, minimum_pairs: int = 50) -> bool:
    """Gate for enabling automatic merges: enough labelled auto-matches at the agreed precision."""
    judged = report['auto_tp'] + report['auto_fp']
    return judged >= minimum_pairs and report['auto_precision'] is not None and report['auto_precision'] >= target


async def run_shadow(conn, max_artists: int = 25, thresholds: Thresholds = Thresholds()) -> Dict[str, Any]:
    """Compare tracks inside each canonical artist (resumable by artist) and record non-reject pairs in shadow mode."""
    state = await conn.fetchrow("""INSERT INTO backfill_checkpoints (name) VALUES ($1) ON CONFLICT (name) DO UPDATE SET name = $1
                                   RETURNING cursor, status""", CHECKPOINT)
    cursor = json.loads(state['cursor']) if isinstance(state['cursor'], str) else state['cursor']
    after = cursor.get('after_artist', '')
    artists = [r['artist_name'] for r in await conn.fetch("""
        SELECT artist_name FROM silver_enriched_tracks WHERE artist_name > $1 GROUP BY artist_name HAVING count(*) > 1
        ORDER BY artist_name LIMIT $2""", after, max_artists)]
    summary = {'artists': len(artists), 'pairs_scored': 0, 'recorded': 0, 'skipped_large': [], 'status': 'running'}
    for artist in artists:
        rows = await conn.fetch("""SELECT id, artist_name, track_title, isrc, duration_ms FROM silver_enriched_tracks
                                   WHERE artist_name = $1 ORDER BY id""", artist)
        if len(rows) > MAX_TRACKS_PER_ARTIST:
            summary['skipped_large'].append(artist)
        else:
            tracks = [dict(r) for r in rows]
            for i, left in enumerate(tracks):
                for right in tracks[i + 1:]:
                    summary['pairs_scored'] += 1
                    result = score_tracks(left, right, thresholds)
                    if result.decision == 'reject':
                        continue
                    await record(conn, 'track', left['id'], right['id'], result)
                    summary['recorded'] += 1
        await conn.execute("""UPDATE backfill_checkpoints SET cursor = jsonb_build_object('after_artist', $2::text),
                                    processed = processed + 1, updated_at = NOW() WHERE name = $1""", CHECKPOINT, artist)
    if len(artists) < max_artists:
        summary['status'] = 'complete'
        await conn.execute("UPDATE backfill_checkpoints SET status = 'complete' WHERE name = $1", CHECKPOINT)
    return summary


async def record(conn, entity_type: str, left: UUID, right: UUID, result: Decision, method: str = METHOD,
                 version: str = MODEL_VERSION) -> None:
    low, high = sorted((left, right), key=str)
    await conn.execute("""
        INSERT INTO er_decisions (entity_type, left_id, right_id, score, decision, method, model_version, features)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
        ON CONFLICT (entity_type, left_id, right_id, method, model_version) DO UPDATE SET
            score = EXCLUDED.score, decision = EXCLUDED.decision, features = EXCLUDED.features, decided_at = NOW()
        WHERE er_decisions.reviewed_outcome IS NULL AND er_decisions.mode = 'shadow'
    """, entity_type, low, high, result.score, result.decision, method, version,
                       json.dumps({**result.features, 'reasons': list(result.reasons)}))


async def pending_review(conn, limit: int = 50, offset: int = 0) -> List[Any]:
    return await conn.fetch("""
        SELECT d.id, d.entity_type, d.left_id, d.right_id, d.score, d.decision, d.features, d.decided_at,
               l.artist_name AS left_artist, l.track_title AS left_title, r.track_title AS right_title
        FROM er_decisions d
        LEFT JOIN silver_enriched_tracks l ON d.entity_type = 'track' AND l.id = d.left_id
        LEFT JOIN silver_enriched_tracks r ON d.entity_type = 'track' AND r.id = d.right_id
        WHERE d.reviewed_outcome IS NULL AND d.mode = 'shadow' AND d.decision IN ('review', 'auto_match')
        ORDER BY d.score DESC, d.id LIMIT $1 OFFSET $2""", limit, offset)


async def review(conn, decision_id: int, outcome: str) -> Dict[str, Any]:
    """Record a human verdict. `same` promotes the pair through the reversible merge; `different` blocks it for good."""
    if outcome not in ('same', 'different'):
        raise CatalogError(422, "outcome must be 'same' or 'different'")
    async with conn.transaction():
        row = await conn.fetchrow('SELECT * FROM er_decisions WHERE id = $1 FOR UPDATE', decision_id)
        if row is None:
            raise CatalogError(404, 'Decision not found')
        if row['reviewed_outcome'] is not None:
            raise CatalogError(409, 'Decision was already reviewed')
        history = None
        if outcome == 'same':
            history = await promote(conn, row)
        await conn.execute('UPDATE er_decisions SET reviewed_outcome = $2 WHERE id = $1', decision_id, outcome)
    return {'decision_id': decision_id, 'outcome': outcome, 'merge_history_id': history}


async def promote(conn, decision) -> int:
    """Merge a track pair; the survivor is the older record so established ids stay stable."""
    if decision['entity_type'] != 'track':
        raise CatalogError(422, 'Only track merges can be promoted; artist merges are manual')
    left, right = decision['left_id'], decision['right_id']
    older = await conn.fetchval("""SELECT id FROM silver_enriched_tracks WHERE id = ANY($1::uuid[])
                                   ORDER BY created_at, id LIMIT 1""", [left, right])
    if older is None:
        raise CatalogError(409, 'One of the tracks no longer exists')
    survivor = older
    duplicate = right if survivor == left else left
    history = await identity.merge_tracks(conn, survivor, duplicate, f"er:{decision['method']}:{decision['model_version']}:{decision['score']}")
    await conn.execute("UPDATE er_decisions SET mode = 'active' WHERE id = $1", decision['id'])
    return history
