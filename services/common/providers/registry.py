"""Build the enabled providers from the environment. Credentials stay in env/secret stores only.

Order is the lookup order: TIDAL first, because it carries ISRC and duration that later providers use as a
duration guard. A provider without credentials is simply absent. `PROVIDER_GROUPS` (e.g.
`getsongbpm=deezer`) marks sources that republish the same upstream measurement so consensus counts them once.
"""
import os
from typing import Dict, List, Optional

from .base import Provider
from .deezer import DeezerClient
from .discogs import DiscogsClient
from .getsongbpm import GetSongBpmClient
from .lastfm import LastFmClient
from .musicbrainz import MusicBrainzClient
from .tidal import TidalClient

DEFAULT_ORDER = ('tidal', 'deezer', 'musicbrainz', 'discogs', 'lastfm', 'getsongbpm')


def truthy(value: Optional[str]) -> bool:
    return (value or '').strip().lower() in ('1', 'true', 'yes', 'on')


def groups_from_env(env: Dict[str, str]) -> Dict[str, str]:
    pairs = (item.split('=', 1) for item in env.get('PROVIDER_GROUPS', '').split(',') if '=' in item)
    return {k.strip(): v.strip() for k, v in pairs if k.strip() and v.strip()}


def build_providers(env: Optional[Dict[str, str]] = None, **client_kwargs) -> List[Provider]:
    env = dict(os.environ if env is None else env)
    built: Dict[str, Provider] = {}
    if env.get('TIDAL_CLIENT_ID') and env.get('TIDAL_CLIENT_SECRET'):
        built['tidal'] = TidalClient(env['TIDAL_CLIENT_ID'], env['TIDAL_CLIENT_SECRET'],
                                     env.get('TIDAL_COUNTRY_CODE', 'AU'), **client_kwargs)
    built['deezer'] = DeezerClient(**client_kwargs)
    built['musicbrainz'] = MusicBrainzClient(contact=env.get('MUSICBRAINZ_CONTACT'), **client_kwargs)
    if env.get('DISCOGS_TOKEN'):
        built['discogs'] = DiscogsClient(env['DISCOGS_TOKEN'], **client_kwargs)
    if env.get('LASTFM_API_KEY'):
        built['lastfm'] = LastFmClient(env['LASTFM_API_KEY'], **client_kwargs)
    if env.get('GETSONGBPM_API_KEY') and truthy(env.get('GETSONGBPM_ENABLED')):
        built['getsongbpm'] = GetSongBpmClient(env['GETSONGBPM_API_KEY'], enabled=True, **client_kwargs)
    groups = groups_from_env(env)
    for name, provider in built.items():
        if name in groups:
            provider.independent_group = groups[name]
    return [built[name] for name in DEFAULT_ORDER if name in built]
