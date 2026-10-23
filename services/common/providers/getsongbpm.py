"""GetSongBPM client. DISABLED BY DEFAULT.

The provider's terms and API reference could not be read during this task (HTTP 403), and its terms
require a visible backlink. The client therefore refuses to run until `GETSONGBPM_ENABLED=true` is set
AFTER the terms have been checked; the attribution that must be shown is exposed by `ATTRIBUTION` and
served by the REST API (`/api/v1/attributions`) for the interface to render.

Request/response handling follows the project's specification and is UNVERIFIED against the live API:
search `type=both&lookup=song:{title} artist:{artist}` with the API key sent as a header; results under
`search`, with `tempo`, `key_of` and an Open Key/Camelot field. Tempo 0 is unknown.
"""
from typing import Any, Dict, List, Optional

from common.metadata.camelot import to_camelot
from common.metadata.matching import Track, parse_title
from common.metadata.tempo import known_bpm

from .base import HttpProvider, ProviderDisabled, ProviderTrack

BASE = 'https://api.getsong.co'
ATTRIBUTION = {'provider': 'getsongbpm', 'text': 'BPM and key data provided by GetSongBPM', 'url': 'https://getsongbpm.com'}


class GetSongBpmClient(HttpProvider):
    name = 'getsongbpm'
    independent_group = 'getsongbpm'

    def __init__(self, api_key: Optional[str], enabled: bool = False, **kwargs):
        kwargs.setdefault('rate_interval', 0.5)
        super().__init__(**kwargs)
        self.api_key, self.enabled = api_key, enabled

    def parse(self, item: Dict[str, Any]) -> Optional[ProviderTrack]:
        title = item.get('song_title') or item.get('title')
        if not title:
            return None
        artist = (item.get('artist') or {}).get('name') if isinstance(item.get('artist'), dict) else item.get('artist')
        fields: Dict[str, Any] = {}
        tempo = known_bpm(item.get('tempo'))
        if tempo:
            fields['bpm'] = tempo
        key = next((item[k] for k in ('key_of', 'camelot', 'open_key') if item.get(k) and to_camelot(str(item[k]))), None)
        if key:
            fields['key'] = str(key)
        return ProviderTrack(self.name, Track(title, artist or '', None, None, str(item.get('song_id') or item.get('id') or title)),
                             fields, {'attribution': ATTRIBUTION['text']})

    async def lookup(self, target: Track, genres: Optional[List[str]] = None) -> List[ProviderTrack]:
        if not self.enabled or not self.api_key:
            raise ProviderDisabled(self.name, 'disabled until the provider terms are verified and the backlink is shown')
        base = parse_title(target.title).base
        body = await self.get_json(f'{BASE}/search/', params={'type': 'both', 'lookup': f'song:{base} artist:{target.artist}'},
                                   headers={'x-api-key': self.api_key})
        results = body.get('search') if isinstance(body, dict) else None
        return [p for p in (self.parse(i) for i in (results if isinstance(results, list) else [])) if p]
