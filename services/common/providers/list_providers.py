"""Provider list configuration and ordering for metadata enrichment."""
import os
from typing import Dict, List, Optional
from .registry import build_providers as registry_build_providers, DEFAULT_ORDER

DEFAULT_PROVIDER_ORDER: List[str] = [
    'tidal',
    'deezer',
    'musicbrainz_local',
    'musicbrainz',
    'discogs',
    'lastfm',
    'getsongbpm',
]


def list_providers(env: Optional[Dict[str, str]] = None) -> List[str]:
    """Return the list of configured provider names in execution order.

    Ensures local MusicBrainz provider (musicbrainz_local) is registered
    ahead of web MusicBrainz provider (musicbrainz).
    """
    source_env = dict(os.environ if env is None else env)
    listed = {n.strip() for n in (source_env.get('ENRICHMENT_PROVIDERS') or '').lower().split(',') if n.strip()}

    if listed and 'none' not in listed:
        return [p for p in DEFAULT_PROVIDER_ORDER if p in listed]
    elif listed and 'none' in listed:
        return []

    return list(DEFAULT_PROVIDER_ORDER)


def get_providers(env: Optional[Dict[str, str]] = None, **kwargs):
    """Build and return instantiated provider clients in execution order."""
    return registry_build_providers(env=env, **kwargs)
