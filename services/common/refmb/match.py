"""Pure matching rules for the local MusicBrainz mirror.

No database access. The resolver applies these decisions to rows it has already loaded.

Assumptions, measured on the owner's mirror and not re-checked here:
- Exact normalised precision is about 0.94–0.96, so a single exact hit may be accepted.
- Fuzzy precision stays around 0.93–0.945 even at its best cutoff (~0.64 similarity),
  so a fuzzy hit is always review and never an automatic accept.
- An ISRC that still points at more than one canonical recording is accepted only when
  duration within ±5 s and artist similarity ≥ 0.85 leave exactly one recording.
"""
from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass
from typing import Optional, Sequence

from common.metadata.matching import ARTIST_THRESHOLD, artist_key, similarity

ISRC_DURATION_TOLERANCE_MS = 5_000
FUZZY_SIMILARITY_FLOOR = 0.64
# ListenBrainz combined_lookup: strip non-word characters, lowercase, then transliterate.
_NON_WORD = re.compile(r'[^\w]+', re.UNICODE)


@dataclass(frozen=True)
class RecordingCandidate:
    mbid: str
    title: str
    artist: str
    duration_ms: Optional[int] = None
    canonical_mbid: Optional[str] = None
    recording_id: Optional[int] = None

    @property
    def canonical(self) -> str:
        return self.canonical_mbid or self.mbid


@dataclass(frozen=True)
class IsrcChoice:
    outcome: str  # accept | review | miss
    chosen: Optional[RecordingCandidate]
    candidates: tuple


def combined_lookup(artist: str, title: str) -> str:
    """Key for the canonical dump's `combined_lookup` column and for `sn_cmd_lookup`.

    Uses `unidecode` when it is installed (the ListenBrainz implementation). Otherwise
    NFKD accent-folding, which matches unidecode for Latin accents and can differ for
    characters such as ß. The worker image installs unidecode so the two agree.
    """
    stripped = _NON_WORD.sub('', f'{artist or ""}{title or ""}').lower()
    try:
        from unidecode import unidecode
    except ImportError:
        decomposed = unicodedata.normalize('NFKD', stripped)
        return ''.join(ch for ch in decomposed if not unicodedata.combining(ch))
    return unidecode(stripped)


def collapse_canonical(candidates: Sequence[RecordingCandidate]) -> list:
    """One row per canonical recording MBID. Prefer the row that already is that MBID."""
    grouped: dict = {}
    for candidate in candidates:
        key = candidate.canonical
        current = grouped.get(key)
        if current is None or (candidate.mbid == key and current.mbid != key):
            grouped[key] = candidate
    return list(grouped.values())


def _duration_close(target_ms: Optional[int], candidate_ms: Optional[int]) -> bool:
    if target_ms is None or candidate_ms is None:
        return False
    if target_ms <= 0 or candidate_ms <= 0:
        return False
    return abs(int(target_ms) - int(candidate_ms)) <= ISRC_DURATION_TOLERANCE_MS


def _artist_close(target_artist: str, candidate_artist: str) -> bool:
    return similarity(artist_key(target_artist), artist_key(candidate_artist)) >= ARTIST_THRESHOLD


def choose_isrc(candidates: Sequence[RecordingCandidate], artist: str,
                duration_ms: Optional[int]) -> IsrcChoice:
    """Apply the ISRC ambiguity rule after canonical collapse.

    A single canonical recording is accepted. Several are accepted only when duration
    (±5 s) and artist similarity (≥ 0.85) single out exactly one. Anything else is
    review: the caller must not fall through to a weaker tier.
    """
    collapsed = collapse_canonical(candidates)
    if not collapsed:
        return IsrcChoice('miss', None, ())
    if len(collapsed) == 1:
        return IsrcChoice('accept', collapsed[0], tuple(collapsed))
    singled = [row for row in collapsed
               if _duration_close(duration_ms, row.duration_ms) and _artist_close(artist, row.artist)]
    if len(singled) == 1:
        return IsrcChoice('accept', singled[0], tuple(collapsed))
    return IsrcChoice('review', None, tuple(collapsed))


def confidence_bucket(method: str, outcome: str) -> str:
    """Fuzzy never auto-accepts. Only an explicit accept on a non-fuzzy tier does."""
    if outcome != 'accept' or method == 'fuzzy':
        return 'review'
    return 'auto'
