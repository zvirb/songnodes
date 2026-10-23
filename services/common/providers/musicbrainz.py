"""MusicBrainz web service v2 client (https://musicbrainz.org/ws/2).

Implemented from the project's specification (documentation not readable during this task; UNVERIFIED):
- JSON via `fmt=json`; an identifying User-Agent is required and the rate limit is one request per second.
- Recording search by `isrc:` and by title/artist; `inc=isrcs` on lookup. The ISRC list is read from BOTH
  shapes that exist: search results carry `isrcs: [{"id": ...}]`, a lookup carries `isrcs: ["..."]`.
"""
import os
from typing import Any, Dict, List, Optional

from common.metadata.matching import Track, normalize_isrc

from .base import HttpProvider, ProviderTrack

BASE = 'https://musicbrainz.org/ws/2'


def isrcs_of(recording: Dict[str, Any]) -> List[str]:
    out = []
    for item in recording.get('isrcs') or []:
        code = normalize_isrc(item.get('id') if isinstance(item, dict) else item)
        if code:
            out.append(code)
    return out


def artist_of(recording: Dict[str, Any]) -> str:
    return ''.join(f"{c.get('name') or (c.get('artist') or {}).get('name', '')}{c.get('joinphrase', '')}"
                   for c in recording.get('artist-credit') or [])


class MusicBrainzClient(HttpProvider):
    name = 'musicbrainz'
    independent_group = 'musicbrainz'

    def __init__(self, contact: Optional[str] = None, **kwargs):
        kwargs.setdefault('rate_interval', 1.1)
        super().__init__(**kwargs)
        self.client.headers['User-Agent'] = f"SongNodes/1.0 ( {contact or os.getenv('MUSICBRAINZ_CONTACT', 'contact-not-configured')} )"

    def parse(self, recording: Dict[str, Any]) -> ProviderTrack:
        isrcs = isrcs_of(recording)
        length = recording.get('length')
        duration = int(length) if isinstance(length, (int, float)) and length > 0 else None
        disambiguation = (recording.get('disambiguation') or '').strip()
        title = recording.get('title') or ''
        fields: Dict[str, Any] = {'musicbrainz_id': recording['id']}
        if isrcs:
            fields['isrc'] = isrcs[0]
        if duration:
            fields['duration_ms'] = duration
        return ProviderTrack(self.name, Track(f'{title} ({disambiguation})' if disambiguation else title, artist_of(recording),
                                              isrcs[0] if isrcs else None, duration, recording['id']),
                             fields, {'isrcs': isrcs})

    async def search(self, query: str, limit: int = 5) -> List[ProviderTrack]:
        body = await self.get_json(f'{BASE}/recording', params={'query': query, 'fmt': 'json', 'limit': limit})
        return [self.parse(r) for r in body.get('recordings', []) if r.get('id')]

    async def by_isrc(self, isrc: str) -> List[ProviderTrack]:
        code = normalize_isrc(isrc)
        return await self.search(f'isrc:{code}') if code else []

    async def lookup(self, target: Track, genres: Optional[List[str]] = None) -> List[ProviderTrack]:
        if normalize_isrc(target.isrc):
            found = await self.by_isrc(target.isrc)
            if found:
                return found
        escape = lambda text: text.replace('\\', '\\\\').replace('"', '\\"')  # noqa: E731
        return await self.search(f'recording:"{escape(target.title)}" AND artist:"{escape(target.artist)}"')

    async def isrcs_for(self, mbid: str) -> List[str]:
        """Lookup form (`inc=isrcs`), used to complete a matched recording's ISRC list."""
        body = await self.get_json(f'{BASE}/recording/{mbid}', params={'inc': 'isrcs', 'fmt': 'json'})
        return isrcs_of(body)
