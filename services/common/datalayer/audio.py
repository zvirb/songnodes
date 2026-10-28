"""Fill missing key and BPM from Deezer 30-second previews (AA2).

The recurring 'audio_analysis' job picks silver tracks that have a Deezer id but no bpm or no key, fetches a fresh
preview URL from Deezer /track/{id} (preview URLs are short-lived), sends it to the audio-analysis service
(`POST /analyze-url`, AA1's Essentia analyser) and records the result as metadata evidence. The same consensus step
enrichment uses (`evidence.apply_all`) then derives the track columns; this module never writes bpm or key itself.

Only the fields a track is missing are recorded, so an existing value (manual, Beatport, a provider or a legacy
import) is never replaced by a single audio reading. Switch the job off with AUDIO_ANALYSIS_ENABLED=false; see
docs/audio-analysis/deezer-previews.md for the Deezer terms check.
"""
import logging
import os
from typing import Any, Dict, Optional, Sequence

import httpx

from common.metadata import camelot
from common.providers.base import ProviderError, ProviderUnavailable
from common.providers.deezer import DeezerClient

from . import evidence

logger = logging.getLogger('songnodes.audio_analysis')

SOURCE = 'audio_analysis'
METHOD = 'audio'
COOLDOWN_DAYS = 30
ESSENTIA_RHYTHM_MAX_CONFIDENCE = 5.32   # RhythmExtractor2013 multifeature confidence runs 0 to 5.32

SELECT_SQL = """
    SELECT t.id, t.deezer_id, t.bpm, t.key
    FROM silver_enriched_tracks t
    WHERE t.deezer_id IS NOT NULL AND t.deezer_id <> ''
      AND (t.bpm IS NULL OR t.key IS NULL)
      AND NOT EXISTS (SELECT 1 FROM silver_track_metadata_evidence e
                      WHERE e.track_id = t.id AND e.source = 'audio_analysis'
                        AND e.retrieved_at > NOW() - make_interval(days => $2))
      AND COALESCE((t.enrichment_metadata->'audio_analysis'->>'attempted_at')::timestamptz, '-infinity')
          < NOW() - make_interval(days => $2)
    ORDER BY EXISTS (SELECT 1 FROM library.tracks l WHERE l.id = t.id) DESC, t.created_at, t.id
    LIMIT $1
"""


class AnalyserUnavailable(Exception):
    """The audio-analysis service is down or overloaded; stop the run and retry later."""


def enabled() -> bool:
    return os.getenv('AUDIO_ANALYSIS_ENABLED', 'true').strip().lower() == 'true'


def analyser_url() -> str:
    return os.getenv('AUDIO_ANALYSIS_URL', 'http://audio-analysis:8020').rstrip('/')


def unit_confidence(value: Any) -> Optional[float]:
    """Evidence confidence must be 0..1; Essentia's rhythm confidence is 0..5.32, its key strength is 0..1."""
    if not isinstance(value, (int, float)) or isinstance(value, bool) or value < 0:
        return None
    value = float(value)
    if value > 1:
        value /= ESSENTIA_RHYTHM_MAX_CONFIDENCE
    return round(min(value, 1.0), 3)


async def mark_attempt(conn, track_id, outcome: str) -> None:
    """Remember the attempt (also failures and missing previews) so the track rests for COOLDOWN_DAYS."""
    await conn.execute("""
        UPDATE silver_enriched_tracks
        SET enrichment_metadata = COALESCE(enrichment_metadata, '{}'::jsonb)
            || jsonb_build_object('audio_analysis', jsonb_build_object('attempted_at', NOW(), 'outcome', $2::text))
        WHERE id = $1""", track_id, outcome)


async def analyse(http: httpx.AsyncClient, preview: str) -> Optional[Dict[str, Any]]:
    """AA1's result for one preview, or None when this clip cannot be analysed (expired, not audio, too big)."""
    try:
        response = await http.post(f'{analyser_url()}/analyze-url', json={'url': preview}, timeout=90)
    except httpx.TransportError as error:
        raise AnalyserUnavailable(f'audio-analysis unreachable: {error.__class__.__name__}') from error
    if response.status_code in (429, 500, 503):
        raise AnalyserUnavailable(f'audio-analysis returned HTTP {response.status_code}')
    if response.status_code != 200:
        return None   # 4xx, or 502/504 for a clip download that failed: a problem with this clip only
    return response.json()


async def record_result(conn, row, result: Dict[str, Any]) -> int:
    """Record evidence for the fields the track lacks; returns how many measurements were usable."""
    method_version = '/'.join(str(p) for p in (result.get('method'), result.get('method_version')) if p)
    raw = {'deezer_id': str(row['deezer_id']), 'raw_bpm': result.get('raw_bpm'), 'key_name': result.get('key_name'),
           'clip': 'deezer_preview'}
    usable = 0
    bpm = result.get('bpm')
    if row['bpm'] is None and isinstance(bpm, (int, float)) and bpm > 0:
        await evidence.record(conn, row['id'], 'bpm', round(float(bpm), 2), SOURCE, method=METHOD, method_version=method_version,
                              independent_group=SOURCE, confidence=unit_confidence(result.get('bpm_confidence')), raw=raw)
        usable += 1
    # The analyser image cannot import common.metadata, so key_camelot may be empty: derive it from the key name.
    code = camelot.to_camelot(result.get('key_camelot')) or camelot.to_camelot(result.get('key_name'))
    if row['key'] is None and code:
        await evidence.record(conn, row['id'], 'key', code, SOURCE, method=METHOD, method_version=method_version,
                              independent_group=SOURCE, confidence=unit_confidence(result.get('key_confidence')), raw=raw)
        usable += 1
    return usable


async def run(conn, providers: Sequence[Any] = (), http: Optional[httpx.AsyncClient] = None,
              deezer: Optional[Any] = None) -> Dict[str, Any]:
    """One run: up to AUDIO_ANALYSIS_PER_RUN tracks, library tracks first. Returns {selected, analysed, no_preview, failed}."""
    summary: Dict[str, Any] = {'enabled': enabled(), 'selected': 0, 'analysed': 0, 'no_preview': 0, 'failed': 0}
    if not summary['enabled']:
        return summary
    rows = await conn.fetch(SELECT_SQL, int(os.getenv('AUDIO_ANALYSIS_PER_RUN', '10')), COOLDOWN_DAYS)
    summary['selected'] = len(rows)
    if not rows:
        logger.info('audio_analysis run: selected=0 analysed=0 no_preview=0 failed=0')
        return summary
    # A Deezer client from the enrichment registry if it is enabled there, otherwise one of our own: this job's
    # Deezer calls are governed by AUDIO_ANALYSIS_ENABLED, not ENRICHMENT_PROVIDERS.
    own_deezer = deezer is None and not any(getattr(p, 'name', '') == 'deezer' for p in providers)
    deezer = deezer or next((p for p in providers if getattr(p, 'name', '') == 'deezer'), None) or DeezerClient()
    own_http = http is None
    http = http or httpx.AsyncClient()
    try:
        for row in rows:
            try:
                found = await deezer.detail(str(row['deezer_id']))
            except ProviderUnavailable as error:   # quota (error code 4) after the client's own backoff, or network
                summary['stopped'] = f'deezer unavailable: {error}'
                break
            except ProviderError:
                summary['failed'] += 1
                await mark_attempt(conn, row['id'], 'deezer_error')
                continue
            preview = (found.raw.get('preview') if found else None) or None
            if not preview:
                summary['no_preview'] += 1
                await mark_attempt(conn, row['id'], 'no_preview')
                continue
            try:
                result = await analyse(http, preview)
            except AnalyserUnavailable as error:
                summary['stopped'] = str(error)
                break
            async with conn.transaction():
                await evidence.snapshot_legacy(conn, row['id'])   # as enrichment does, before any new evidence
                usable = await record_result(conn, row, result) if result else 0
                if usable:
                    await evidence.apply_all(conn, row['id'])   # consensus sets bpm/key/camelot_key from evidence
                await mark_attempt(conn, row['id'], 'analysed' if usable else 'failed')
            summary['analysed' if usable else 'failed'] += 1
    finally:
        if own_http:
            await http.aclose()
        if own_deezer:
            await deezer.aclose()
    logger.info('audio_analysis run: selected=%d analysed=%d no_preview=%d failed=%d%s', summary['selected'],
                summary['analysed'], summary['no_preview'], summary['failed'],
                f" stopped={summary['stopped']}" if summary.get('stopped') else '')
    return summary
