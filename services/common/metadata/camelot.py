"""One Camelot/Open Key specification shared by enrichment, graph scoring and migrations.

Camelot numbers: major keys (B) 8B = C, then up a fifth per step; minor keys (A) 8A = A minor.
Open Key: `1d` = C major (= 8B), `1m` = A minor (= 8A); Camelot number = ((open - 1 + 7) % 12) + 1.
Unparseable input returns None. Nothing here guesses a key or a mode.
"""
from functools import lru_cache
import re
from typing import Optional, Tuple

PITCH_CLASS = {'c': 0, 'd': 2, 'e': 4, 'f': 5, 'g': 7, 'a': 9, 'b': 11}
CIRCLE_OF_FIFTHS_MAJOR = {0: 8, 7: 9, 2: 10, 9: 11, 4: 12, 11: 1, 6: 2, 1: 3, 8: 4, 3: 5, 10: 6, 5: 7}
# A relative minor shares its Camelot number with the major a minor third above its tonic (A minor, C major).
CAMELOT_MAJOR_BY_PC = CIRCLE_OF_FIFTHS_MAJOR
CAMELOT_MINOR_BY_PC = {(pc + 9) % 12: number for pc, number in CIRCLE_OF_FIFTHS_MAJOR.items()}

CAMELOT_RE = re.compile(r'^\s*0?([1-9]|1[0-2])\s*([ab])\s*$', re.IGNORECASE)
OPEN_KEY_RE = re.compile(r'^\s*0?([1-9]|1[0-2])\s*([md])\s*$', re.IGNORECASE)
KEY_NAME_RE = re.compile(
    r'^\s*([A-Ga-g])\s*([#♯b♭]|(?i:sharp|flat))?\s*[-\s]?\s*((?i:major|minor|maj|min|dur|moll)|m|M)?\s*$')

MINOR_WORDS = {'minor', 'min', 'm', 'moll'}
MAJOR_WORDS = {'major', 'maj', 'dur'}


def format_camelot(number: int, mode: str) -> str:
    return f'{number}{"A" if mode == "minor" else "B"}'


def camelot_from_pitch_class(pitch_class: int, mode: str) -> Optional[str]:
    """`mode` is 'major' or 'minor'; pitch class 0 = C. Returns None for out-of-range input."""
    if mode not in ('major', 'minor') or not isinstance(pitch_class, int) or isinstance(pitch_class, bool):
        return None
    table = CAMELOT_MAJOR_BY_PC if mode == 'major' else CAMELOT_MINOR_BY_PC
    number = table.get(pitch_class % 12)
    return format_camelot(number, mode) if number else None


def from_camelot(code: Optional[str]) -> Optional[Tuple[int, str]]:
    """Camelot code -> (tonic pitch class, 'major'|'minor')."""
    match = CAMELOT_RE.match(code or '')
    if not match:
        return None
    number, letter = int(match.group(1)), match.group(2).upper()
    mode = 'minor' if letter == 'A' else 'major'
    table = CAMELOT_MINOR_BY_PC if mode == 'minor' else CAMELOT_MAJOR_BY_PC
    for pitch_class, value in table.items():
        if value == number:
            return pitch_class, mode
    return None


def parse_key_name(value: Optional[str]) -> Optional[Tuple[int, str]]:
    """Parse 'A minor', 'F#m', 'Bb', 'f♯ min', 'Abmaj' -> (pitch class, mode). Bare letters are major."""
    if not value or not isinstance(value, str):
        return None
    match = KEY_NAME_RE.match(value.strip())
    if not match:
        return None
    letter, accidental, mode_word = match.group(1).lower(), match.group(2), match.group(3)
    pitch_class = PITCH_CLASS[letter]
    accidental = (accidental or '').lower()
    if accidental in ('#', '♯', 'sharp'):
        pitch_class += 1
    elif accidental in ('b', '♭', 'flat'):
        pitch_class -= 1
    if mode_word is None or mode_word == 'M' or mode_word.lower() in MAJOR_WORDS:
        mode = 'major'
    elif mode_word.lower() in MINOR_WORDS:
        mode = 'minor'
    else:
        return None
    return pitch_class % 12, mode


# Bolt optimization: Memoize key normalization to eliminate regex overhead on repeated key lookups (~10x speedup).
@lru_cache(maxsize=1024)
def to_camelot(value: Optional[str]) -> Optional[str]:
    """Normalise Camelot ('08a'), Open Key ('1m') or a musical key name to a Camelot code, else None."""
    if not value or not isinstance(value, str):
        return None
    text = value.strip()
    camelot = CAMELOT_RE.match(text)
    if camelot:
        return f'{int(camelot.group(1))}{camelot.group(2).upper()}'
    open_key = OPEN_KEY_RE.match(text)
    if open_key:
        number = ((int(open_key.group(1)) - 1 + 7) % 12) + 1
        return format_camelot(number, 'minor' if open_key.group(2).lower() == 'm' else 'major')
    parsed = parse_key_name(text)
    return camelot_from_pitch_class(*parsed) if parsed else None


def to_open_key(value: Optional[str]) -> Optional[str]:
    camelot = to_camelot(value)
    if not camelot:
        return None
    number, letter = int(camelot[:-1]), camelot[-1]
    return f'{((number - 1 - 7) % 12) + 1}{"m" if letter == "A" else "d"}'


def relative_camelot(code: str) -> Optional[str]:
    camelot = to_camelot(code)
    if not camelot:
        return None
    return camelot[:-1] + ('B' if camelot.endswith('A') else 'A')


def legacy_minor_to_correct(code: str) -> Optional[str]:
    """Map a minor code produced by the retired `_key_to_camelot`/`_derive_camelot_key` tables to the true code.

    The retired tables placed A minor at 1A instead of 8A, so every minor was 7 positions too low.
    Only valid for values known to come from those tables; use `recompute` when the original key exists.
    """
    camelot = to_camelot(code)
    if not camelot or not camelot.endswith('A'):
        return None
    return format_camelot(((int(camelot[:-1]) - 1 + 7) % 12) + 1, 'minor')


def recompute(original_key: Optional[str], stored_camelot: Optional[str] = None) -> Tuple[Optional[str], str]:
    """Recompute a stored Camelot value from the original musical key.

    Returns (code, status): 'unchanged', 'corrected', 'derived' (nothing stored before),
    'unrecoverable' (cannot decide; flag for review, keep original) or 'unknown' (no input).
    """
    derived = to_camelot(original_key) if original_key else None
    stored = to_camelot(stored_camelot) if stored_camelot else None
    if derived is None:
        if stored_camelot and not stored:
            return None, 'unrecoverable'
        return (None, 'unrecoverable') if stored else (None, 'unknown')
    if stored is None:
        return derived, 'derived'
    return (derived, 'unchanged') if derived == stored else (derived, 'corrected')
