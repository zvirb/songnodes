"""Official TIDAL API v2 client (JSON:API, https://openapi.tidal.com/v2).

Contract facts used here come from the published OpenAPI spec (OAS 1.10.206, read 2026-10-24):
- Bearer token from https://auth.tidal.com/v1/oauth2/token (client credentials); media type
  application/vnd.api+json; optional `countryCode` (ISO 3166-1 alpha-2).
- GET /tracks supports `filter[isrc]` and `filter[id]` with at most 20 values per request, `include`
  (artists, albums, ...), and cursor pagination through `links.next`.
- Track attributes: title, version, isrc, duration (ISO 8601), bpm, key, keyScale.
NOT verified against live responses: Basic-header versus body credentials, whether bpm/key are populated
for read responses, search query path encoding, and the Retry-After header. Those are covered by the
credential-gated live contract tests. Only documented endpoints are used; no private endpoints.
"""
import time
from typing import Any, Dict, Iterable, List, Optional
from urllib.parse import quote

from common.metadata.matching import Track, normalize_isrc

from .base import HttpProvider, ProviderDisabled, ProviderError, ProviderTrack, parse_iso_duration_ms

API = 'https://openapi.tidal.com/v2'
TOKEN_URL = 'https://auth.tidal.com/v1/oauth2/token'
MEDIA_TYPE = 'application/vnd.api+json'
BATCH = 20
MAX_PAGES = 3
KEY_NAMES = {'C': 'C', 'CSharp': 'C#', 'D': 'D', 'Eb': 'Eb', 'E': 'E', 'F': 'F', 'FSharp': 'F#', 'G': 'G',
             'Ab': 'Ab', 'A': 'A', 'Bb': 'Bb', 'B': 'B'}
SCALES = {'MAJOR': 'major', 'IONIAN': 'major', 'MINOR': 'minor', 'AEOLIAN': 'minor'}  # other modes are not mapped


def key_name(key: Optional[str], scale: Optional[str]) -> Optional[str]:
    """'A' + 'MINOR' -> 'A minor'. UNKNOWN or an unmapped mode returns None rather than a guess."""
    note, mode = KEY_NAMES.get(key or ''), SCALES.get((scale or '').upper())
    return f'{note} {mode}' if note and mode else None


def chunks(values: List[str], size: int) -> Iterable[List[str]]:
    for start in range(0, len(values), size):
        yield values[start:start + size]


class TidalClient(HttpProvider):
    name = 'tidal'
    independent_group = 'tidal'

    def __init__(self, client_id: Optional[str], client_secret: Optional[str], country_code: str = 'AU',
                 array_style: str = 'comma', **kwargs):
        super().__init__(**kwargs)
        # How array filters are encoded: 'comma' (filter[id]=1,2) or 'repeat' (filter[id]=1&filter[id]=2). The OAS
        # calls them arrays without a readable style, so the live contract test confirms the choice.
        self.array_style = array_style
        self.client_id, self.client_secret, self.country_code = client_id, client_secret, country_code
        self._token: Optional[str] = None
        self._expires = 0.0

    async def token(self) -> str:
        if not self.client_id or not self.client_secret:
            raise ProviderDisabled(self.name, 'TIDAL_CLIENT_ID / TIDAL_CLIENT_SECRET are not configured')
        if self._token and time.monotonic() < self._expires - 60:
            return self._token
        response = await self.request('POST', TOKEN_URL, data={'grant_type': 'client_credentials'},
                                      auth=(self.client_id, self.client_secret))
        if response.status_code != 200:
            raise ProviderError(self.name, f'token request failed with HTTP {response.status_code}', response.status_code)
        body = response.json()
        self._token = body['access_token']
        self._expires = time.monotonic() + float(body.get('expires_in', 3600))
        return self._token

    def array(self, values: List[str]):
        return ','.join(values) if self.array_style == 'comma' else list(values)

    async def _get(self, url: str, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        headers = {'Authorization': f'Bearer {await self.token()}', 'Accept': MEDIA_TYPE}
        response = await self.request('GET', url, params=params, headers=headers)
        if response.status_code == 404:
            # A 404 on a documented collection endpoint is a contract failure, not "no matches".
            raise ProviderError(self.name, f'unexpected 404 from {url}', 404)
        if response.status_code >= 400:
            raise ProviderError(self.name, f'HTTP {response.status_code}', response.status_code)
        return response.json()

    def parse(self, document: Dict[str, Any]) -> List[ProviderTrack]:
        included = {(r.get('type'), r.get('id')): r for r in document.get('included', [])}
        out: List[ProviderTrack] = []
        for resource in document.get('data', []):
            if resource.get('type') != 'tracks':
                continue
            attributes = resource.get('attributes', {})
            artists = [included[('artists', ref['id'])]['attributes'].get('name')
                       for ref in resource.get('relationships', {}).get('artists', {}).get('data', [])
                       if ('artists', ref.get('id')) in included]
            title, version = attributes.get('title') or '', (attributes.get('version') or '').strip()
            bpm = attributes.get('bpm')
            fields: Dict[str, Any] = {'tidal_id': resource['id']}
            isrc = normalize_isrc(attributes.get('isrc'))
            duration = parse_iso_duration_ms(attributes.get('duration'))
            for name, value in (('isrc', isrc), ('duration_ms', duration), ('mix_name', version or None),
                                ('bpm', bpm if isinstance(bpm, (int, float)) and not isinstance(bpm, bool) and bpm > 0 else None),
                                ('key', key_name(attributes.get('key'), attributes.get('keyScale')))):
                if value is not None:
                    fields[name] = value
            out.append(ProviderTrack(self.name, Track(f'{title} ({version})' if version else title,
                                                      ', '.join(a for a in artists if a), isrc, duration, resource['id']),
                                     fields, {'attributes': attributes}))
        return out

    def next_url(self, document: Dict[str, Any]) -> Optional[str]:
        link = (document.get('links') or {}).get('next')
        if not link:
            return None
        if link.startswith('http'):
            return link
        return 'https://openapi.tidal.com' + link if link.startswith('/v2') else API + (link if link.startswith('/') else '/' + link)

    async def by_isrc(self, isrcs: List[str]) -> List[ProviderTrack]:
        valid = [i for i in (normalize_isrc(x) for x in isrcs) if i]
        results: List[ProviderTrack] = []
        for batch in chunks(valid, BATCH):
            params = {'filter[isrc]': self.array(batch), 'countryCode': self.country_code, 'include': 'artists,albums'}
            url: Optional[str] = f'{API}/tracks'
            for _ in range(MAX_PAGES if len(batch) == 1 else 1):  # pagination applies to a single ISRC only
                document = await self._get(url, params if url == f'{API}/tracks' else None)
                results.extend(self.parse(document))
                url = self.next_url(document)
                if not url:
                    break
        return results

    async def by_ids(self, ids: List[str]) -> List[ProviderTrack]:
        results: List[ProviderTrack] = []
        for batch in chunks(list(ids), BATCH):
            document = await self._get(f'{API}/tracks', {'filter[id]': self.array(batch), 'countryCode': self.country_code,
                                                         'include': 'artists,albums'})
            results.extend(self.parse(document))
        return results

    async def search(self, query: str, limit: int = 10) -> List[ProviderTrack]:
        """Text search: searchResults relationship ids, then hydration with artists (<= 20 ids per request)."""
        if not query.strip():
            return []
        document = await self._get(f'{API}/searchResults',
                                   {'filter[query]': query.strip(), 'countryCode': self.country_code, 'include': 'tracks'})
        res = document.get('data') or {}
        if isinstance(res, list):
            res = res[0] if res else {}
        track_data = (res.get('relationships') or {}).get('tracks', {}).get('data', [])
        ids = [r['id'] for r in track_data if r.get('type') == 'tracks'][:limit]
        if not ids:
            ids = [o['id'] for o in document.get('included', []) if o.get('type') == 'tracks'][:limit]
        return await self.by_ids(ids) if ids else []

    async def lookup(self, target: Track, genres: Optional[List[str]] = None) -> List[ProviderTrack]:
        if normalize_isrc(target.isrc):
            found = await self.by_isrc([target.isrc])
            if found:
                return found
        return await self.search(f'{target.artist} {target.title}')
