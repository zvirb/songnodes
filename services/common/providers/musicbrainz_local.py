import os
import asyncio
from typing import Any, Dict, List, Optional
import urllib.parse

from common.metadata.matching import Track, parse_title
from common.refmb.settings import RefMBSettings, create_pool
from common.providers.base import Provider, ProviderTrack

try:
    from services.reference_data.resolver.resolver import MusicBrainzResolver, local_candidates
except ImportError:
    try:
        from reference_data.resolver.resolver import MusicBrainzResolver, local_candidates
    except ImportError:
        MusicBrainzResolver = None
        local_candidates = None


def _settings_from_env_or_db_url(settings: Optional[RefMBSettings] = None) -> RefMBSettings:
    if settings is not None:
        return settings

    db_url = os.getenv("REFMB_DATABASE_URL", "").strip()
    if db_url:
        try:
            parsed = urllib.parse.urlparse(db_url)
            return RefMBSettings(
                enabled=True,
                host=parsed.hostname or "localhost",
                port=parsed.port or 5432,
                database=parsed.path.lstrip("/") or "ref_mb",
                user=parsed.username or "ref_mb_reader",
            )
        except Exception:
            pass
    return RefMBSettings.from_env()


class MusicBrainzLocalProvider(Provider):
    name = 'musicbrainz_local'
    independent_group = 'musicbrainz'

    def __init__(self, settings: Optional[RefMBSettings] = None):
        self.settings = _settings_from_env_or_db_url(settings)
        self.pool = None

    async def _get_pool(self):
        if self.pool is None:
            db_url = os.getenv("REFMB_DATABASE_URL", "").strip()
            mb_enabled = os.getenv("MB_LOCAL_ENABLED", "").strip().lower() in ("true", "1", "yes")
            if not db_url and not mb_enabled and not self.settings.enabled:
                return None
            try:
                self.pool = await create_pool(self.settings)
            except Exception:
                return None
        return self.pool

    async def lookup(self, target: Track, genres: Optional[List[str]] = None) -> Optional[List[ProviderTrack]]:
        db_url = os.getenv("REFMB_DATABASE_URL", "").strip()
        mb_enabled = os.getenv("MB_LOCAL_ENABLED", "").strip().lower() in ("true", "1", "yes")

        if not db_url and not mb_enabled and not self.settings.enabled:
            return None

        if MusicBrainzResolver is None:
            return None

        try:
            pool = await self._get_pool()
            if not pool:
                return None
        except Exception:
            return None

        try:
            async with pool.acquire() as conn:
                resolver = MusicBrainzResolver(conn)

                mix_str = None
                parsed = parse_title(target.title)
                if parsed.versions:
                    mix_str = " ".join(parsed.versions)

                match = await resolver.resolve(
                    artist=target.artist,
                    title=parsed.base,
                    mix=mix_str,
                    isrc=target.isrc,
                    duration=target.duration_ms
                )

                if not match:
                    return None

                recording_id = str(match.canonical_mbid or match.mbid)

                isrc_row = await conn.fetchrow("""
                    SELECT isrc FROM ref_mb.isrc
                    WHERE recording = $1::uuid
                    LIMIT 1
                """, recording_id)
                found_isrc = isrc_row['isrc'] if isrc_row else None

                length_row = await conn.fetchrow("""
                    SELECT length FROM ref_mb.recording
                    WHERE id = $1::uuid
                """, recording_id)
                duration = length_row['length'] if length_row and length_row['length'] else None

                fields: Dict[str, Any] = {'musicbrainz_id': recording_id}
                if found_isrc:
                    fields['isrc'] = found_isrc
                if duration:
                    fields['duration_ms'] = duration

                confidence = 0.95 if getattr(match, "confidence_bucket", "") == "auto" else 0.5
                if getattr(match, "method", "") == 'isrc':
                    confidence = 1.0

                pt = ProviderTrack(
                    provider=self.name,
                    track=Track(
                        title=target.title,
                        artist=target.artist,
                        isrc=found_isrc or target.isrc,
                        duration_ms=duration or target.duration_ms,
                        ref=recording_id
                    ),
                    fields=fields,
                    raw={
                        'matched_by': getattr(match, "method", "unknown"),
                        'dump_version': getattr(match, "dump_version", None),
                        'licence': 'CC0',
                    },
                    field_sources={},
                    confidence=confidence
                )
                return [pt]

        except Exception:
            return None
