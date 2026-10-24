"""Artist-name rules shared by the API, ingestion and entity resolution."""
from typing import Optional

PLACEHOLDER_ARTISTS = ('', 'unknown', 'unknown artist', 'various', 'various artists', 'va', 'id', 'id id')
PLACEHOLDER_PREFIXES = ('va @', 'various artists @', 'unknown artist,', 'unknown artist @')


def clean_name(value: Optional[str]) -> str:
    return (value or '').strip()


def normalize(name: str) -> str:
    return name.lower().strip()


def is_placeholder_artist(name: Optional[str]) -> bool:
    """Empty or generic names that must never appear as an artist in the graph (CLAUDE.md requirement 1)."""
    key = normalize(name or '')
    return key in PLACEHOLDER_ARTISTS or key.startswith(PLACEHOLDER_PREFIXES)
