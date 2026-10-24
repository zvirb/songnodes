"""Last.fm tags over HTTPS (`track.getTopTags`). Tags become genre candidates after `clean_genres`.

Verified from the official method pages: parameters `artist`, `track`, `autocorrect`, `api_key`; no user
authentication; an identifiable User-Agent is requested; error 29 is a rate-limit error. The docs show an
http:// root, so the https:// base and the JSON field names (`toptags.tag[].name/count`) are UNVERIFIED.
Last.fm returns tags for the (auto-corrected) track name, not a candidate list, so the result is a single
pseudo-candidate carrying the requested names.
"""
from typing import Any, Dict, List, Optional

from common.metadata.field_resolution import clean_genres
from common.metadata.matching import Track

from .base import HttpProvider, ProviderDisabled, ProviderError, ProviderTrack

BASE = 'https://ws.audioscrobbler.com/2.0/'
RATE_LIMIT_ERROR = 29
CONFIDENCE = 0.5


class LastFmClient(HttpProvider):
    name = 'lastfm'
    independent_group = 'lastfm'

    def __init__(self, api_key: Optional[str], **kwargs):
        kwargs.setdefault('rate_interval', 0.25)
        super().__init__(**kwargs)
        self.api_key = api_key

    def quota_exceeded(self, response) -> bool:
        try:
            body = response.json()
        except ValueError:
            return False
        return isinstance(body, dict) and body.get('error') == RATE_LIMIT_ERROR

    async def lookup(self, target: Track, genres: Optional[List[str]] = None) -> List[ProviderTrack]:
        if not self.api_key:
            raise ProviderDisabled(self.name, 'LASTFM_API_KEY is not configured')
        body: Dict[str, Any] = await self.get_json(BASE, params={
            'method': 'track.gettoptags', 'artist': target.artist, 'track': target.title, 'autocorrect': 1,
            'api_key': self.api_key, 'format': 'json'})
        if 'error' in body:
            if body['error'] in (6, 7):   # invalid parameters / resource not found: no tags for this track
                return []
            raise ProviderError(self.name, f"API error {body['error']}: {body.get('message')}")
        tags = body.get('toptags', {}).get('tag', [])
        tags = [tags] if isinstance(tags, dict) else tags
        pairs = []
        for tag in tags:
            try:
                pairs.append((tag['name'], int(tag.get('count', 0))))
            except (KeyError, TypeError, ValueError):
                continue
        genre = clean_genres(pairs)
        if not genre:
            return []
        return [ProviderTrack(self.name, Track(target.title, target.artist, None, None, f'{target.artist}|{target.title}'),
                              {'genre': genre}, {'tag_count': len(pairs)}, confidence=CONFIDENCE)]
