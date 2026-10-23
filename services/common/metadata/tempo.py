"""Tempo folding and agreement for BPM evidence.

Half/double-time errors are common, so a candidate BPM is folded to x2 or /2 only when a
recognised genre's tempo range justifies it. Unknown genres, out-of-range results and genres whose
tempo ranges are disjoint (e.g. House + Drum and Bass) are returned unchanged with an explicit
status; no octave is guessed.
BPM of 0 or less is "unknown", never a real tempo (Deezer reports 0 when it has no value).
"""
from typing import Iterable, Optional, Tuple

# Typical DJ-relevant tempo ranges (inclusive BPM) per genre keyword. Matching is by substring on
# the lower-cased genre, longest keyword first, so "drum and bass" wins over "bass".
GENRE_RANGES = {
    'drum and bass': (160.0, 180.0), 'drum & bass': (160.0, 180.0), 'dnb': (160.0, 180.0),
    'jungle': (160.0, 180.0), 'hardstyle': (140.0, 160.0), 'hardcore': (160.0, 200.0),
    'dubstep': (136.0, 150.0), 'trance': (125.0, 150.0), 'psytrance': (138.0, 150.0),
    'techno': (120.0, 150.0), 'tech house': (120.0, 132.0), 'deep house': (112.0, 126.0),
    'progressive house': (120.0, 132.0), 'house': (115.0, 135.0), 'electro': (120.0, 140.0),
    'uk garage': (128.0, 140.0), 'garage': (128.0, 140.0), 'disco': (100.0, 125.0),
    'afro house': (118.0, 128.0), 'melodic': (118.0, 128.0), 'breaks': (120.0, 140.0),
    'hip hop': (70.0, 110.0), 'hip-hop': (70.0, 110.0), 'reggaeton': (85.0, 100.0),
}
KEYWORDS = sorted(GENRE_RANGES, key=len, reverse=True)
OCTAVES = (1.0, 2.0, 0.5)


def known_bpm(value) -> Optional[float]:
    if value is None or isinstance(value, bool):
        return None
    try:
        bpm = float(value)
    except (TypeError, ValueError):
        return None
    return bpm if bpm > 0 and bpm == bpm and bpm != float('inf') else None


def genre_range(genre: str) -> Optional[Tuple[float, float]]:
    text = (genre or '').lower()
    return next((GENRE_RANGES[key] for key in KEYWORDS if key in text), None)


def one_family(ranges) -> bool:
    """True when the ranges chain into one contiguous tempo span (House+Techno), False for disjoint ones."""
    ordered = sorted(ranges)
    reach = ordered[0][1]
    for low, high in ordered[1:]:
        if low > reach:
            return False
        reach = max(reach, high)
    return True


def fold_tempo(bpm, genres: Optional[Iterable[str]]) -> Tuple[Optional[float], str]:
    """Return (bpm, status). Status: unknown, unknown_genre, in_range, folded, ambiguous, out_of_range."""
    value = known_bpm(bpm)
    if value is None:
        return None, 'unknown'
    ranges = [r for r in (genre_range(g) for g in (genres or [])) if r]
    if not ranges:
        return value, 'unknown_genre'
    originally_fits = any(r[0] <= value <= r[1] for r in ranges)
    if not originally_fits and not one_family(ranges):
        return value, 'ambiguous'
    fits = {(candidate, r) for r in ranges for factor in OCTAVES
            for candidate in [round(value * factor, 3)] if r[0] <= candidate <= r[1]}
    if not fits:
        return value, 'out_of_range'
    originals = {c for c, _ in fits if c == round(value, 3)}
    if originals:
        return value, 'in_range'
    candidates = {c for c, _ in fits}
    if len(candidates) > 1:
        return value, 'ambiguous'
    return candidates.pop(), 'folded'


def tempo_agreement(a, b, tolerance: float = 0.02) -> Optional[str]:
    """'exact' within tolerance, 'octave' when one is half/double the other, 'none', or None if unknown."""
    left, right = known_bpm(a), known_bpm(b)
    if left is None or right is None:
        return None
    if abs(left - right) <= tolerance * max(left, right):
        return 'exact'
    for factor in (2.0, 0.5):
        if abs(left * factor - right) <= tolerance * max(left * factor, right):
            return 'octave'
    return 'none'
