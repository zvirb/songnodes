"""Local read-only MusicBrainz mirror. Registered ahead of the web provider when enabled.

Disabled unless `MB_LOCAL_ENABLED` is truthy (or `REFMB_DATABASE_URL` / an explicit enabled
settings object is supplied). A mirror that is down or unconfigured returns no candidates
so the web MusicBrainz provider still runs.
"""
import os
import urllib.parse
from typing import Any, List, Optional

from common.metadata.matching import Track, parse_title
from common.refmb.resolve import MusicBrainzResolver
from common.refmb.settings import RefMBSettings, create_pool
from common.providers.base import Provider, ProviderTrack

_TRUTHY = ('true', '1', 'yes', 'on')


def _as_text(value: Any) -> Optional[str]:
    return value if isinstance(value, str) and value.strip() else None


def _as_int(value: Any) -> Optional[int]:
    return value if isinstance(value, int) and not isinstance(value, bool) else None


def _as_tuple(value: Any) -> tuple:
    if isinstance(value, (list, tuple)):
        return tuple(value)
    return ()


class MusicBrainzLocalProvider(Provider):
    name = 'musicbrainz_local'
    independent_group = 'musicbrainz'

    def __init__(self, settings: Optional[RefMBSettings] = None):
        self.settings = settings if settings is not None else RefMBSettings.from_env()
        self.pool = None

    def _enabled(self) -> bool:
        if self.settings is not None and self.settings.enabled:
            return True
        if os.getenv('MB_LOCAL_ENABLED', '').strip().lower() in _TRUTHY:
            return True
        return bool(os.getenv('REFMB_DATABASE_URL', '').strip())

    def _connect_settings(self) -> RefMBSettings:
        if self.settings is not None and self.settings.enabled:
            return self.settings
        url = os.getenv('REFMB_DATABASE_URL', '').strip()
        if url:
            parsed = urllib.parse.urlparse(url)
            return RefMBSettings(
                enabled=True,
                host=parsed.hostname or 'localhost',
                port=parsed.port or 5432,
                database=(parsed.path or '/ref_mb').lstrip('/') or 'ref_mb',
                user=urllib.parse.unquote(parsed.username) if parsed.username else 'ref_mb_reader',
            )
        return RefMBSettings.from_env()

    async def _get_pool(self):
        if self.pool is None:
            if not self._enabled():
                return None
            try:
                self.pool = await create_pool(self._connect_settings())
            except Exception:
                return None
        return self.pool

    async def lookup(self, target: Track, genres: Optional[List[str]] = None) -> Optional[List[ProviderTrack]]:
        if not self._enabled():
            return None
        try:
            pool = await self._get_pool()
            if not pool:
                return None
            async with pool.acquire() as conn:
                parsed = parse_title(target.title)
                mix = ' '.join(parsed.versions) if parsed.versions else None
                match = await MusicBrainzResolver(conn).resolve(
                    artist=target.artist,
                    title=parsed.base or target.title,
                    mix=mix,
                    isrc=target.isrc,
                    duration=target.duration_ms,
                    mbid=target.ref,
                )
        except Exception:
            return None
        if not match:
            return None
        return [_provider_track(self.name, target, match)]


def _provider_track(provider: str, target: Track, match: Any) -> ProviderTrack:
    method = _as_text(getattr(match, 'method', None)) or 'unknown'
    bucket = _as_text(getattr(match, 'confidence_bucket', None)) or 'review'
    if method == 'fuzzy':
        bucket = 'review'
    auto = bucket == 'auto'
    canonical = _as_text(getattr(match, 'canonical_mbid', None)) or _as_text(getattr(match, 'mbid', None))
    if canonical is None and getattr(match, 'canonical_mbid', None) is not None:
        canonical = str(match.canonical_mbid)
    found_isrc = _as_text(getattr(match, 'isrc', None))
    duration = _as_int(getattr(match, 'duration_ms', None))
    label = _as_text(getattr(match, 'record_label', None))
    genre_values = [item for item in _as_tuple(getattr(match, 'genres', ())) if isinstance(item, str) and item]
    candidates = [item for item in _as_tuple(getattr(match, 'candidates', ())) if isinstance(item, dict)]
    fields: dict = {}
    if auto and canonical:
        fields['musicbrainz_id'] = canonical
        if found_isrc:
            fields['isrc'] = found_isrc
        if duration:
            fields['duration_ms'] = duration
        if label:
            fields['record_label'] = label
        if genre_values:
            fields['genre'] = genre_values
    confidence = 1.0 if auto and method == 'isrc' else (0.95 if auto else 0.5)
    return ProviderTrack(
        provider=provider,
        track=Track(
            title=_as_text(getattr(match, 'matched_title', None)) or target.title,
            artist=_as_text(getattr(match, 'matched_artist', None)) or target.artist,
            isrc=found_isrc or (target.isrc if auto else None),
            duration_ms=duration or (target.duration_ms if auto else None),
            ref=canonical if auto else None,
        ),
        fields=fields,
        raw={
            'matched_by': method,
            'confidence_bucket': bucket,
            'dump_version': _as_text(getattr(match, 'dump_version', None)),
            'licence': 'CC0',
            'candidates': candidates,
            'release_date': _as_text(getattr(match, 'release_date', None)),
            'release_year': _as_int(getattr(match, 'release_year', None)),
            'record_label': label,
            'genres': genre_values,
        },
        field_sources={'genre': 'musicbrainz_local', 'record_label': 'musicbrainz_local'} if auto else {},
        confidence=confidence,
    )
