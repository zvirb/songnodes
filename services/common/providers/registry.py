"""Build the enabled providers from the environment. Credentials stay in env/secret stores only.

`ENRICHMENT_PROVIDERS` restricts which configured providers run (comma-separated names; `none` runs no provider, so
no outbound traffic). Unset means every configured provider. Order is the lookup order: TIDAL first, because it carries ISRC and duration that later providers use as a
duration guard. A provider without credentials is simply absent. `PROVIDER_GROUPS` (e.g.
`getsongbpm=deezer`) marks sources that republish the same upstream measurement so consensus counts them once.

Note: GETSONGBPM_ENABLED stays an env switch; a saved GetSongBPM key alone does not enable it.
"""
import logging
import os
from typing import Dict, List, Optional

from .base import Provider
from .saved_keys import load_sync
from .deezer import DeezerClient
from .discogs import DiscogsClient
from .getsongbpm import GetSongBpmClient
from .lastfm import LastFmClient
from .musicbrainz import MusicBrainzClient
from .musicbrainz_local import MusicBrainzLocalProvider
from .tidal import TidalClient

DEFAULT_ORDER = ('tidal', 'deezer', 'musicbrainz_local', 'musicbrainz', 'discogs', 'lastfm', 'getsongbpm')


def configured(value: Optional[str]) -> bool:
    """A credential counts only if set to something real; the Helm chart's `CHANGE_ME...` placeholders do not."""
    text = (value or '').strip()
    return bool(text) and not text.upper().startswith('CHANGE_ME')


def truthy(value: Optional[str]) -> bool:
    return (value or '').strip().lower() in ('1', 'true', 'yes', 'on')


def groups_from_env(env: Dict[str, str]) -> Dict[str, str]:
    pairs = (item.split('=', 1) for item in env.get('PROVIDER_GROUPS', '').split(',') if '=' in item)
    return {k.strip(): v.strip() for k, v in pairs if k.strip() and v.strip()}


def build_providers(env: Optional[Dict[str, str]] = None, saved: Optional[Dict[str, str]] = None, **client_kwargs) -> List[Provider]:
    source_env = dict(os.environ if env is None else env)

    if env is None and saved is None:
        dsn = source_env.get('DATABASE_URL')
        if truthy(source_env.get('SAVED_KEYS_DISABLED')) or not dsn:
            saved = {}
        else:
            saved = load_sync(dsn, source_env.get('API_KEY_ENCRYPTION_SECRET'))
    elif saved is None:
        saved = {}

    def get_credential(key: str, env_val: Optional[str] = None) -> tuple[Optional[str], str]:
        if configured(saved.get(key)):
            return saved[key], 'saved'
        if env_val is not None:
            return env_val, 'env'
        return source_env.get(key), 'env'

    listed = {n.strip() for n in (source_env.get('ENRICHMENT_PROVIDERS') or '').lower().split(',') if n.strip()}

    def wanted(name: str) -> bool:
        return not listed or ('none' not in listed and name in listed)

    built: Dict[str, Provider] = {}
    sources: Dict[str, str] = {}

    t_id, t_id_src = get_credential('TIDAL_CLIENT_ID')
    t_sec, t_sec_src = get_credential('TIDAL_CLIENT_SECRET')
    if wanted('tidal') and configured(t_id) and configured(t_sec):
        built['tidal'] = TidalClient(t_id, t_sec, source_env.get('TIDAL_COUNTRY_CODE', 'AU'), **client_kwargs)
        sources['tidal'] = 'saved' if 'saved' in (t_id_src, t_sec_src) else 'env'

    if wanted('deezer'):
        built['deezer'] = DeezerClient(**client_kwargs)
        sources['deezer'] = 'env'

    if truthy(source_env.get('MB_LOCAL_ENABLED')) and wanted('musicbrainz_local'):
        built['musicbrainz_local'] = MusicBrainzLocalProvider()
        sources['musicbrainz_local'] = 'env'

    if wanted('musicbrainz'):
        built['musicbrainz'] = MusicBrainzClient(contact=source_env.get('MUSICBRAINZ_CONTACT'), **client_kwargs)
        sources['musicbrainz'] = 'env'

    d_token, d_src = get_credential('DISCOGS_TOKEN')
    if not configured(d_token):
        d_token = source_env.get('DISCOGS_API_TOKEN')
        d_src = 'env'
    if wanted('discogs') and configured(d_token):
        built['discogs'] = DiscogsClient(d_token, **client_kwargs)
        sources['discogs'] = d_src

    l_key, l_src = get_credential('LASTFM_API_KEY')
    if wanted('lastfm') and configured(l_key):
        built['lastfm'] = LastFmClient(l_key, **client_kwargs)
        sources['lastfm'] = l_src

    g_key, g_src = get_credential('GETSONGBPM_API_KEY')
    if wanted('getsongbpm') and configured(g_key) and truthy(source_env.get('GETSONGBPM_ENABLED')):
        built['getsongbpm'] = GetSongBpmClient(g_key, enabled=True, **client_kwargs)
        sources['getsongbpm'] = g_src

    groups = groups_from_env(source_env)
    for name, provider in built.items():
        if name in groups:
            provider.independent_group = groups[name]

    order = [built[name] for name in DEFAULT_ORDER if name in built]
    logger = logging.getLogger(__name__)
    if order:
        logger.info(f"providers built: {', '.join(f'{name} from {sources[name]}' for name in DEFAULT_ORDER if name in built)}")
    else:
        logger.info("no providers built")
    return order
