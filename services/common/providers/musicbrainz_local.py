import asyncio
from typing import Any, Dict, List, Optional
import traceback

from common.metadata.matching import Track, parse_title
from common.refmb.settings import RefMBSettings, create_pool
from common.providers.base import Provider, ProviderTrack

try:
    from services.reference_data.resolver.resolver import MusicBrainzResolver, local_candidates
except ImportError:
    # Need to be able to import when running pytest
    from reference_data.resolver.resolver import MusicBrainzResolver, local_candidates

class MusicBrainzLocalProvider(Provider):
    name = 'musicbrainz_local'
    independent_group = 'musicbrainz'

    def __init__(self, settings: Optional[RefMBSettings] = None):
        self.settings = settings or RefMBSettings.from_env()
        self.pool = None

    async def _get_pool(self):
        if self.pool is None:
            if not self.settings.enabled:
                return None
            self.pool = await create_pool(self.settings)
        return self.pool

    async def lookup(self, target: Track, genres: Optional[List[str]] = None) -> List[ProviderTrack]:
        if not self.settings.enabled:
            return []

        pool = await self._get_pool()
        if not pool:
            return []

        try:
            async with pool.acquire() as conn:
                resolver = MusicBrainzResolver(conn)

                mix_str = None
                parsed = parse_title(target.title)
                if parsed.versions:
                    mix_str = " ".join(parsed.versions)

                # local_candidates expects a mix argument separately, or just let resolver handle it via title
                match = await resolver.resolve(
                    artist=target.artist,
                    title=parsed.base,
                    mix=mix_str,
                    isrc=target.isrc,
                    duration=target.duration_ms
                )

                if not match:
                    return []

                # fetch recording details
                recording_id = match.canonical_mbid or match.mbid

                # fetch metadata we want to set as evidence
                # we need recording length and isrcs

                # This could be improved, but this will get us the metadata for fields
                # musicbrainz_id, isrc, duration_ms

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

                # Evidence mapped output fields, dump_version, licence
                # Set CC0; CC-BY-NC-SA-3.0 for tag-derived genre (which we aren't supporting currently)

                # Compute confidence from match bucket
                confidence = 0.95 if match.confidence_bucket == "auto" else 0.5
                if match.method == 'isrc':
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
                        'matched_by': match.method,
                        'dump_version': match.dump_version,
                        'licence': 'CC0',
                    },
                    field_sources={},
                    confidence=confidence
                )
                return [pt]

        except Exception as e:
            # We catch any exception to avoid crashing waterfall, we can log it if needed
            print(f"MusicBrainzLocalProvider error: {e}")
            traceback.print_exc()
            return []
