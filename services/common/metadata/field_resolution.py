"""Configured per-field resolution with provenance (replaces blind `metadata.update` overwrites).

Priority lists follow the requested defaults. A candidate never overwrites a stronger existing value:
manual values always win, then lower index in the field's priority list. Disagreements are kept as
alternatives and flagged for review. BPM and key are not resolved here; they use `consensus`.
"""
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Sequence, Tuple

DEFAULT_PRIORITIES: Dict[str, Tuple[str, ...]] = {
    'isrc': ('tidal', 'deezer', 'musicbrainz'),
    'duration_ms': ('tidal', 'deezer'),
    'mix_name': ('tidal', 'deezer'),
    'genre': ('discogs', 'deezer_album', 'lastfm'),
    'record_label': ('discogs', 'deezer_album'),
}
MANUAL = 'manual'
GENERIC_TAGS = {'seen live', 'favorites', 'favourites', 'favorite', 'love', 'loved', 'awesome', 'good', 'best',
                'albums i own', 'my music', 'spotify', 'under 2000 listeners', 'catchy', 'cool'}


@dataclass(frozen=True)
class Candidate:
    source: str
    value: Any
    confidence: Optional[float] = None
    evidence_ref: Optional[str] = None


@dataclass(frozen=True)
class Existing:
    value: Any
    source: Optional[str] = None     # None = legacy value of unknown origin (weakest)


@dataclass(frozen=True)
class Resolution:
    field: str
    action: str                      # set | keep_existing | none
    value: Any = None
    source: Optional[str] = None
    alternatives: Tuple[Candidate, ...] = field(default_factory=tuple)
    review: bool = False
    reason: str = ''


def is_known(value: Any) -> bool:
    if value is None or isinstance(value, bool):
        return value is not None
    if isinstance(value, (str, list, tuple, set, dict)):
        return len(value) > 0 and (not isinstance(value, str) or value.strip() != '')
    if isinstance(value, (int, float)):
        return value == value
    return True


def comparable(value: Any) -> Any:
    if isinstance(value, str):
        return value.strip().casefold()
    if isinstance(value, (list, tuple)):
        return tuple(sorted(str(v).strip().casefold() for v in value))
    return value


DURATION_TOLERANCE_MS = 2000   # providers report the same recording within a fraction of a second


def same(field: str, a: Any, b: Any) -> bool:
    """Field-aware equality: durations agree within DURATION_TOLERANCE_MS; everything else compares normalised."""
    if field == 'duration_ms':
        try:
            return abs(float(a) - float(b)) <= DURATION_TOLERANCE_MS
        except (TypeError, ValueError):
            return False
    return comparable(a) == comparable(b)


def rank(source: Optional[str], priority: Sequence[str]) -> int:
    """Lower is stronger: manual -1, listed sources by index, unlisted sources and legacy last."""
    if source == MANUAL:
        return -1
    if source in priority:
        return priority.index(source)
    return len(priority) + (1 if source is None else 0)


def resolve_field(name: str, candidates: Sequence[Candidate], existing: Optional[Existing] = None,
                  priorities: Optional[Dict[str, Sequence[str]]] = None) -> Resolution:
    priority = (priorities or DEFAULT_PRIORITIES).get(name)
    if priority is None:
        raise KeyError(f'No resolution priority configured for field {name!r}')
    usable = sorted((c for c in candidates if is_known(c.value)),
                    key=lambda c: (rank(c.source, priority), -(c.confidence or 0.0)))
    existing_known = existing is not None and is_known(existing.value)
    if not usable:
        return Resolution(name, 'keep_existing' if existing_known else 'none',
                          existing.value if existing_known else None, existing.source if existing_known else None,
                          reason='no candidate value')
    best = usable[0]
    disagreeing = tuple(c for c in usable[1:] if not same(name, c.value, best.value))
    if existing_known:
        if rank(existing.source, priority) <= rank(best.source, priority):
            conflict = not same(name, existing.value, best.value)
            return Resolution(name, 'keep_existing', existing.value, existing.source, usable if conflict else (),
                              review=conflict and existing.source != MANUAL,
                              reason='existing value is at least as strong')
        if same(name, existing.value, best.value):
            return Resolution(name, 'keep_existing', existing.value, existing.source, reason='already equal')
    return Resolution(name, 'set', best.value, best.source, disagreeing, review=bool(disagreeing),
                      reason=f'highest-priority source {best.source}')


def clean_genres(tags: Sequence[Tuple[str, int]], minimum_count: int = 20, limit: int = 5) -> List[str]:
    """Last.fm-style (name, count) tags -> genres: drop generic/personal tags and years, keep order by count."""
    out: List[str] = []
    for name, count in sorted(tags, key=lambda t: -t[1]):
        text = (name or '').strip()
        key = text.casefold()
        if count < minimum_count or not text or key in GENERIC_TAGS or text.isdigit() or key.endswith('s') and key[:-1].isdigit():
            continue
        if key not in {g.casefold() for g in out}:
            out.append(text)
        if len(out) >= limit:
            break
    return out
