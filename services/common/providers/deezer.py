"""Deezer public API client (https://api.deezer.com).

Behaviour implemented from the project's specification (the developer documentation was not readable
without a login, so these details are UNVERIFIED and covered by the credential-free live contract test):
- ISRC-first lookup `/track/isrc:{ISRC}`, text search `/search/track`, detail `/track/{id}`, album `/album/{id}`.
- `bpm` of 0 means unknown, never a real tempo. `duration` is in seconds. `title_version` is the mix name.
- Errors arrive as HTTP 200 with {"error": {"code": ...}}: code 4 is a quota error (back off and retry),
  code 800 means no data. `preview` URLs are carried only in `raw`; availability is not permission to analyse audio.
"""
import re
from typing import Any, Dict, List, Optional

import httpx

from common.metadata.matching import Track, normalize_isrc, parse_title

from .base import HttpProvider, ProviderError, ProviderTrack

BASE = 'https://api.deezer.com'
QUOTA_CODE = 4
NO_DATA_CODE = 800
MAX_CANDIDATES = 5


def error_of(body: Any) -> Optional[Dict[str, Any]]:
    return body.get('error') if isinstance(body, dict) and isinstance(body.get('error'), dict) else None


class DeezerClient(HttpProvider):
    name = 'deezer'
    independent_group = 'deezer'

    def __init__(self, **kwargs):
        kwargs.setdefault('rate_interval', 0.12)   # ~8 requests/s, under the documented 50 per 5 s
        super().__init__(**kwargs)

    def quota_exceeded(self, response: httpx.Response) -> bool:
        try:
            error = error_of(response.json())
        except ValueError:
            return False
        return bool(error and error.get('code') == QUOTA_CODE)

    async def _json(self, path: str, params: Optional[Dict[str, Any]] = None) -> Optional[Dict[str, Any]]:
        body = await self.get_json(f'{BASE}{path}', params=params)
        error = error_of(body)
        if error:
            if error.get('code') == NO_DATA_CODE:
                return None
            raise ProviderError(self.name, f"API error {error.get('code')}: {error.get('message')}")
        return body

    def parse(self, body: Dict[str, Any]) -> Optional[ProviderTrack]:
        if not body or 'id' not in body:
            return None
        version = re.sub(r'^\(|\)$', '', (body.get('title_version') or '').strip()).strip()
        title = body.get('title') or body.get('title_short') or ''
        seconds = body.get('duration')
        duration = int(seconds) * 1000 if isinstance(seconds, (int, float)) and seconds > 0 else None
        isrc = normalize_isrc(body.get('isrc'))
        bpm = body.get('bpm')
        fields: Dict[str, Any] = {'deezer_id': str(body['id'])}
        for name, value in (('isrc', isrc), ('duration_ms', duration), ('mix_name', version or None),
                            ('bpm', bpm if isinstance(bpm, (int, float)) and not isinstance(bpm, bool) and bpm > 0 else None)):
            if value is not None:
                fields[name] = value
        album = body.get('album') or {}
        raw = {'gain': body.get('gain'), 'preview': body.get('preview'), 'album_id': album.get('id')}
        return ProviderTrack(self.name, Track(f'{title} ({version})' if version else title,
                                              (body.get('artist') or {}).get('name') or '', isrc, duration, str(body['id'])),
                             fields, raw)

    async def by_isrc(self, isrc: str) -> List[ProviderTrack]:
        code = normalize_isrc(isrc)
        found = self.parse(await self._json(f'/track/isrc:{code}') or {}) if code else None
        return [found] if found else []

    async def detail(self, track_id: str) -> Optional[ProviderTrack]:
        return self.parse(await self._json(f'/track/{track_id}') or {})

    async def search(self, artist: str, title: str, extended: bool = False) -> List[ProviderTrack]:
        query = f'artist:"{artist}" track:"{title}"' if not extended else f'{artist} {title} extended'
        body = await self._json('/search/track', {'q': query, 'limit': MAX_CANDIDATES})
        ids = [str(item['id']) for item in (body or {}).get('data', []) if 'id' in item][:MAX_CANDIDATES]
        out: List[ProviderTrack] = []
        for track_id in ids:  # search results omit bpm and ISRC, so hydrate each candidate
            candidate = await self.detail(track_id)
            if candidate:
                out.append(candidate)
        return out

    async def lookup(self, target: Track, genres: Optional[List[str]] = None) -> List[ProviderTrack]:
        if normalize_isrc(target.isrc):
            found = await self.by_isrc(target.isrc)
            if found:
                return found
        parsed = parse_title(target.title)
        results = await self.search(target.artist, parsed.base)
        if any('extended' in v for v in parsed.versions):
            seen = {r.track.ref for r in results}
            results += [r for r in await self.search(target.artist, parsed.base, extended=True) if r.track.ref not in seen]
        return results

    async def hydrate(self, found: ProviderTrack) -> ProviderTrack:
        """Album genres and label for the matched track; recorded as the distinct source `deezer_album`."""
        album_id = found.raw.get('album_id')
        body = await self._json(f'/album/{album_id}') if album_id else None
        if not body:
            return found
        fields, sources = dict(found.fields), dict(found.field_sources)
        genres = [g.get('name') for g in (body.get('genres') or {}).get('data', []) if g.get('name')]
        if genres:
            fields['genre'], sources['genre'] = genres, 'deezer_album'
        if body.get('label'):
            fields['record_label'], sources['record_label'] = body['label'], 'deezer_album'
        return ProviderTrack(found.provider, found.track, fields, found.raw, sources, found.confidence)
