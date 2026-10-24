"""Per-track enrichment: provider waterfall -> version-aware matching -> evidence -> consensus / field resolution.

Providers run in order (TIDAL first). The first confirmed match supplies a duration and ISRC that guard every
later provider, so a radio edit can never be accepted as an extended mix once any provider has pinned the
duration. Only confirmed matches write evidence; unconfirmed ones leave a `match_review_<provider>` reason.
Existing values are snapshotted as `legacy` evidence first, so nothing is lost and stronger values are kept.
"""
import json
from dataclasses import replace
from typing import Any, Dict, List, Optional, Sequence
from uuid import UUID

from common.metadata import matching
from common.providers.base import Provider, ProviderDisabled, ProviderError, ProviderTrack, ProviderUnavailable

from . import evidence
from .errors import CatalogError

EVIDENCE_FIELDS = ('isrc', 'duration_ms', 'mix_name', 'bpm', 'key', 'genre', 'record_label',
                   'tidal_id', 'deezer_id', 'musicbrainz_id')
CONFIDENCE = {'isrc_equal': 1.0, 'fuzzy_version_and_duration_agree': 0.8, 'unique_text_match_duration_unknown': 0.6}


def confidence_for(decision: matching.Decision, found: ProviderTrack) -> float:
    if found.confidence is not None:
        return found.confidence
    return next((CONFIDENCE[r] for r in decision.reasons if r in CONFIDENCE), 0.6)


async def enrich_track(conn, track_id: UUID, providers: Sequence[Provider], unknown_duration: str = 'unique_exact') -> Dict[str, Any]:
    row = await conn.fetchrow('SELECT id, artist_name, track_title, isrc, duration_ms, genre FROM silver_enriched_tracks WHERE id = $1', track_id)
    if row is None:
        raise CatalogError(404, 'Track not found')
    summary: Dict[str, Any] = {'matched': [], 'review': [], 'rejected': [], 'skipped': [], 'errors': {}, 'unavailable': False,
                               'evidence': 0}
    async with conn.transaction():
        await evidence.snapshot_legacy(conn, track_id)
        target = matching.Track(row['track_title'], row['artist_name'], row['isrc'], row['duration_ms'])
        genres: List[str] = list(row['genre'] or [])
        for provider in providers:
            try:
                candidates = await provider.lookup(target, genres)
            except ProviderDisabled as error:
                summary['skipped'].append(provider.name)
                summary['errors'][provider.name] = str(error)
                continue
            except ProviderUnavailable as error:
                summary['unavailable'] = True
                summary['errors'][provider.name] = str(error)
                continue
            except ProviderError as error:
                summary['errors'][provider.name] = str(error)
                continue
            if not candidates:
                summary['rejected'].append(provider.name)
                continue
            decision = matching.best_match(target, [c.track for c in candidates], unknown_duration)
            if decision.outcome == 'review':
                summary['review'].append({'provider': provider.name, 'reasons': list(decision.reasons)})
                continue
            if decision.outcome != 'match':
                summary['rejected'].append(provider.name)
                continue
            found = next(c for c in candidates if c.track is decision.candidate)
            if hasattr(provider, 'hydrate'):
                try:
                    found = await provider.hydrate(found)
                except ProviderUnavailable:
                    summary['unavailable'] = True
                except ProviderError as error:
                    summary['errors'][f'{provider.name}.hydrate'] = str(error)
            confidence = confidence_for(decision, found)
            for field in EVIDENCE_FIELDS:
                if field in found.fields:
                    source = found.field_sources.get(field, provider.name)
                    written = await evidence.record(conn, track_id, field, found.fields[field], source, method='provider_match',
                                                    independent_group=provider.independent_group, confidence=confidence,
                                                    raw={'ref': found.track.ref, 'reasons': list(decision.reasons)})
                    summary['evidence'] += int(written)
            summary['matched'].append({'provider': provider.name, 'ref': found.track.ref, 'reasons': list(decision.reasons)})
            # The first confirmed match pins duration and ISRC for the providers that follow.
            if target.duration_ms is None and found.track.duration_ms:
                target = replace(target, duration_ms=found.track.duration_ms)
            if not target.isrc and found.track.isrc:
                target = replace(target, isrc=found.track.isrc)
        await evidence._set_reasons(conn, track_id, ('match_',), [f"match_review_{r['provider']}" for r in summary['review']])
        applied = await evidence.apply_all(conn, track_id)
        # A run where providers were unavailable and nothing matched is not an attempt: leave it eligible for retry.
        attempted = not (summary['unavailable'] and not summary['matched'])
        await conn.execute("""
            UPDATE silver_enriched_tracks SET enriched_at = CASE WHEN $3 THEN NOW() ELSE enriched_at END,
                   enrichment_metadata = enrichment_metadata || jsonb_build_object('last_enrichment', $2::jsonb)
            WHERE id = $1""", track_id, json.dumps({'matched': [m['provider'] for m in summary['matched']],
                                                    'review': [r['provider'] for r in summary['review']],
                                                    'errors': sorted(summary['errors']), 'attempted': attempted}), attempted)
    summary['applied'] = applied
    return summary
