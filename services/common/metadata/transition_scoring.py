"""One transition scoring classifier (spec `harmonic-1`, docs/specs/HARMONIC_SCORING.md section 2).

Pure functions for one directed edge `from -> to`: key verdict, BPM verdict (with half/double time),
energy move label, compatibility score and pathfinding cost. Unknown inputs stay unknown: they never
count as a clash, a hold or a zero gap. Levels and words follow the design system (`SN.compat`,
`SN.bpmStep`); words still waiting on a design-system change are marked in the spec.
"""
import math
from dataclasses import dataclass
from decimal import ROUND_HALF_UP, Decimal
from typing import Optional

from .camelot import to_camelot
from .energy import CONTRACT_VERSION as ENERGY_CONTRACT, SCALE_MAX, SCALE_MIN, to_decimal
from .tempo import known_bpm

SCORING_VERSION = 'harmonic-1'
MOVE_VERSION = 'energy-move-1'
LEVEL_SCORE = {'perfect': 1.0, 'compatible': 0.8, 'possible': 0.5, 'clash': 0.0}
KEY_WEIGHT, BPM_WEIGHT = 0.6, 0.4
UNKNOWN_COST, EPSILON, W_COMPAT, W_EVIDENCE = 0.5, 0.05, 1.0, 1.0
MINUS = '−'  # the design system writes minus signs as U+2212

# Same-letter Camelot moves by d = (n_to - n_from) mod 12; anything not listed is a clash.
SAME_LETTER = {
    0: ('same', 'perfect', 'same key'),
    1: ('plus_one', 'compatible', '+1 key'),
    11: ('minus_one', 'compatible', MINUS + '1 key'),
    2: ('plus_two', 'possible', '+2 energy boost'),
    10: ('minus_two', 'possible', MINUS + '2 energy drop'),
    7: ('plus_seven', 'possible', '+7 lift'),
}
OCTAVE_LABEL = {'double_time': 'double time', 'half_time': 'half time'}  # final words: design system (Q-B1)


@dataclass(frozen=True)
class KeyVerdict:
    relation: str
    level: str
    label: str
    score: Optional[float]


@dataclass(frozen=True)
class BpmVerdict:
    relation: Optional[str]
    gap: Optional[int]
    level: str
    label: str
    score: Optional[float]


@dataclass(frozen=True)
class EnergyMove:
    move: str
    delta: Optional[Decimal]
    step: Optional[int]


@dataclass(frozen=True)
class Compat:
    score: Optional[float]      # shown and stored only at full coverage
    coverage: float
    partial: Optional[float]    # same formula over the known parts; for cost only


def round_half_up(value) -> int:
    """Round the absolute value half away from zero, keeping the sign (2.5 -> 3, -2.5 -> -3)."""
    number = Decimal(str(value))
    whole = int(abs(number).quantize(Decimal('1'), rounding=ROUND_HALF_UP))
    return -whole if number < 0 else whole


def key_verdict(from_key, to_key) -> KeyVerdict:
    a, b = to_camelot(from_key), to_camelot(to_key)
    if not a or not b:
        return KeyVerdict('unknown', 'unknown', 'key ?', None)
    d = (int(b[:-1]) - int(a[:-1])) % 12
    if a[-1] == b[-1] and d in SAME_LETTER:
        relation, level, label = SAME_LETTER[d]
    elif a[-1] != b[-1] and d == 0:
        relation, level, label = 'relative', 'perfect', f'relative {a[-1]}↔{b[-1]}'
    else:
        relation, level, label = 'clash', 'clash', 'key clash'
    return KeyVerdict(relation, level, label, LEVEL_SCORE[level])


def bpm_level(gap: int) -> str:
    return 'perfect' if gap <= 2 else 'compatible' if gap <= 4 else 'possible' if gap <= 8 else 'clash'


def bpm_verdict(from_bpm, to_bpm) -> BpmVerdict:
    a, b = known_bpm(from_bpm), known_bpm(to_bpm)
    if a is None or b is None:
        return BpmVerdict(None, None, 'unknown', 'BPM ?', None)
    signed = round_half_up(Decimal(str(b)) - Decimal(str(a)))
    direct = abs(signed)
    as_double = abs(round_half_up(Decimal(str(b)) / 2 - Decimal(str(a))))
    as_half = abs(round_half_up(Decimal(str(b)) * 2 - Decimal(str(a))))
    relation, gap = ('double_time', as_double) if as_double <= as_half else ('half_time', as_half)
    if gap < direct and gap <= 8:
        level = bpm_level(gap)
        if level == 'perfect':
            level = 'compatible'  # Q-B1: an octave move is never perfect
        return BpmVerdict(relation, gap, level, OCTAVE_LABEL[relation], LEVEL_SCORE[level])
    level = bpm_level(direct)
    label = 'same BPM' if signed == 0 else f'{"+" if signed > 0 else MINUS}{direct} BPM'
    return BpmVerdict('direct', direct, level, label, LEVEL_SCORE[level])


def known_energy(value) -> Optional[Decimal]:
    number = to_decimal(value)
    return number if number is not None and SCALE_MIN <= number <= SCALE_MAX else None


def energy_move(from_energy, to_energy) -> EnergyMove:
    """`energy-move-1` label from the one-decimal delta rounded half away from zero (Q-E1, Q-E2, Q-E3)."""
    a, b = known_energy(from_energy), known_energy(to_energy)
    if a is None or b is None:
        return EnergyMove('unknown', None, None)
    delta = b - a
    n = round_half_up(delta)
    if n == 0:
        move = 'hold'
    elif n == 1:
        move = 'step_up'
    elif n in (2, 3):
        move = 'lift'
    elif n == -1:
        move = 'step_down'
    elif -4 <= n <= -2:
        move = 'reset_drop'
    else:
        move = 'jarring'  # rises of 4 or more, drops of 5 or more
    return EnergyMove(move, delta, n)


def compat_score(key_score: Optional[float], bpm_score: Optional[float]) -> Compat:
    """Weighted geometric mean key^0.6 x BPM^0.4; energy is a separate fact and never part of it."""
    parts = [(s, w) for s, w in ((key_score, KEY_WEIGHT), (bpm_score, BPM_WEIGHT)) if s is not None]
    coverage = round(sum(w for _, w in parts), 10)
    if not parts:
        return Compat(None, 0.0, None)
    partial = math.prod(s ** (w / coverage) for s, w in parts)
    return Compat(partial if coverage == 1.0 else None, coverage, partial)


def display_score(compat: Compat) -> Optional[int]:
    return None if compat.score is None else round_half_up(Decimal(repr(compat.score)) * 100)


def path_cost(compat: Compat, occurrence_count: int) -> float:
    """Lower is better and always > 0. `occurrence_count` 0 means an inferred, unobserved edge."""
    if compat.coverage == 1.0:
        c_compat = 1 - compat.score
    elif compat.coverage > 0:
        c_compat = compat.coverage * (1 - compat.partial) + (1 - compat.coverage) * UNKNOWN_COST
    else:
        c_compat = UNKNOWN_COST
    n = max(int(occurrence_count or 0), 0)
    c_evidence = 1 / (1 + math.log2(1 + n)) if n >= 1 else 1.0
    return EPSILON + W_COMPAT * c_compat + W_EVIDENCE * c_evidence


def score_transition(from_track: dict, to_track: dict, occurrence_count: int = 0) -> dict:
    """All stored edge fields of spec section 2.7 for one directed edge (cost is query-time only)."""
    key = key_verdict(from_track.get('key'), to_track.get('key'))
    bpm = bpm_verdict(from_track.get('bpm'), to_track.get('bpm'))
    move = energy_move(from_track.get('energy'), to_track.get('energy'))
    compat = compat_score(key.score, bpm.score)
    return {
        'occurrence_count': occurrence_count, 'key_relation': key.relation, 'key_level': key.level,
        'key_label': key.label, 'key_score': key.score, 'bpm_relation': bpm.relation, 'bpm_gap': bpm.gap,
        'bpm_level': bpm.level, 'bpm_label': bpm.label, 'bpm_score': bpm.score,
        'compat_score': compat.score, 'compat_coverage': compat.coverage, 'display_score': display_score(compat),
        'energy_from': known_energy(from_track.get('energy')), 'energy_to': known_energy(to_track.get('energy')),
        'energy_delta': move.delta, 'energy_move': move.move, 'energy_contract': ENERGY_CONTRACT,
        'move_version': MOVE_VERSION, 'scoring_version': SCORING_VERSION,
    }
