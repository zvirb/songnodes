"""Discogs database search (https://api.discogs.com). Supplies release-level genre/style and record label.

Request form follows the project's specification (docs not readable during this task; UNVERIFIED):
`GET /database/search?type=release&artist=..&track=..` with `Authorization: Discogs token=<token>`.
Discogs describes RELEASES, not recordings, so candidates only confirm artist + that the release holds the
searched track name; they never supply ISRC, duration or BPM. Genres combine `genre` and `style`.
"""
from typing import Any, Dict, List, Optional

from common.metadata.matching import Track, parse_title

from .base import HttpProvider, ProviderDisabled, ProviderTrack

BASE = 'https://api.discogs.com'
CONFIDENCE = 0.6


class DiscogsClient(HttpProvider):
    name = 'discogs'
    independent_group = 'discogs'

    def __init__(self, token: Optional[str], **kwargs):
        kwargs.setdefault('rate_interval', 1.0)   # 60 requests/minute when authenticated
        super().__init__(**kwargs)
        self.token = token

    def parse(self, item: Dict[str, Any], target: Track) -> Optional[ProviderTrack]:
        title = item.get('title') or ''
        artist = title.split(' - ', 1)[0].strip() if ' - ' in title else ''
        if not artist:
            return None
        genres: List[str] = []
        for value in (item.get('genre') or []) + (item.get('style') or []):
            if value and value not in genres:
                genres.append(value)
        labels = [l for l in (item.get('label') or []) if l and l.lower() != 'not on label']
        fields: Dict[str, Any] = {}
        if genres:
            fields['genre'] = genres
        if labels:
            fields['record_label'] = labels[0]
        # The search was filtered by track name, so the target's own title stands in for the release track.
        return ProviderTrack(self.name, Track(target.title, artist, None, None, str(item.get('id'))), fields,
                             {'release': title, 'year': item.get('year')}, confidence=CONFIDENCE)

    async def lookup(self, target: Track, genres: Optional[List[str]] = None) -> List[ProviderTrack]:
        if not self.token:
            raise ProviderDisabled(self.name, 'DISCOGS_TOKEN is not configured')
        body = await self.get_json(f'{BASE}/database/search', params={
            'type': 'release', 'artist': target.artist, 'track': parse_title(target.title).base, 'per_page': 5},
            headers={'Authorization': f'Discogs token={self.token}'})
        return [p for p in (self.parse(r, target) for r in body.get('results', [])) if p]
