"""Versioned canonical energy contract (Milestone 3).

* Canonical scale 1-10, one decimal place, three bands. Band names/boundaries below are
  PROVISIONAL (energy-1) until ratified; the contract version is stored with every reading so a
  ratified change becomes `energy-2` and projections rebuild instead of silently drifting.
* Missing energy is unknown. Legacy 0-1 values convert linearly but stay flagged
  `calibrated=False` and never receive a band; only manual ratings and calibrated extractors do.
* Raw value, raw scale, source, method/version, calibration version, confidence and measurement
  time are preserved on every reading.
"""
from dataclasses import dataclass, field, replace
from datetime import datetime
from decimal import ROUND_HALF_UP, Decimal
from typing import Dict, List, Optional, Sequence, Tuple

CONTRACT_VERSION = 'energy-1'
SCALE_MIN, SCALE_MAX = Decimal('1'), Decimal('10')
PRECISION = Decimal('0.1')


@dataclass(frozen=True)
class Band:
    key: str
    label: str
    low: Decimal   # inclusive
    high: Decimal  # inclusive; adjacent bands differ by exactly PRECISION so no value falls in a gap


BANDS: Tuple[Band, ...] = (
    Band('warm', 'Warm', Decimal('1.0'), Decimal('3.9')),
    Band('building', 'Building', Decimal('4.0'), Decimal('6.9')),
    Band('peak', 'Peak', Decimal('7.0'), Decimal('10.0')),
)

# Higher wins when readings disagree. `legacy_linear` and `provider` are uncalibrated unless stated.
SOURCE_PRECEDENCE: Dict[str, int] = {'legacy_linear': 1, 'provider': 2, 'calibrated_extractor': 3, 'manual_rating': 4}
CALIBRATED_SOURCES = {'manual_rating', 'calibrated_extractor'}
CONFLICT_THRESHOLD = Decimal('1.0')
KNOWN_SCALES = {'1-10': (Decimal('1'), Decimal('10')), '0-1': (Decimal('0'), Decimal('1')),
                '0-100': (Decimal('0'), Decimal('100')), '0-10': (Decimal('0'), Decimal('10'))}


@dataclass(frozen=True)
class EnergyReading:
    value: Optional[Decimal]          # canonical 1-10, one decimal; None = unknown
    source: str                       # key of SOURCE_PRECEDENCE
    method: str
    method_version: Optional[str] = None
    calibration_version: Optional[str] = None
    confidence: Optional[float] = None
    measured_at: Optional[datetime] = None
    raw_value: Optional[Decimal] = None
    raw_scale: Optional[str] = None
    contract_version: str = CONTRACT_VERSION

    @property
    def calibrated(self) -> bool:
        return self.source in CALIBRATED_SOURCES


def to_decimal(value) -> Optional[Decimal]:
    if value is None or isinstance(value, bool):
        return None
    try:
        number = Decimal(str(value))
    except Exception:
        return None
    return number if number.is_finite() else None


def quantize(value: Decimal) -> Decimal:
    return value.quantize(PRECISION, rounding=ROUND_HALF_UP)


def convert(value, scale: str) -> Optional[Decimal]:
    """Linear conversion of `value` on a known scale to canonical 1-10; None if unknown or out of range."""
    raw, bounds = to_decimal(value), KNOWN_SCALES.get(scale)
    if raw is None or bounds is None or not bounds[0] <= raw <= bounds[1]:
        return None
    low, high = bounds
    return quantize(SCALE_MIN + (raw - low) * (SCALE_MAX - SCALE_MIN) / (high - low))


def reading(value, scale: str, source: str, method: str, **extra) -> EnergyReading:
    """Build a reading from a raw value on `scale`, preserving the raw value and scale."""
    if source not in SOURCE_PRECEDENCE:
        raise ValueError(f'Unknown energy source: {source}')
    return EnergyReading(value=convert(value, scale), source=source, method=method,
                         raw_value=to_decimal(value), raw_scale=scale, **extra)


def legacy_reading(value) -> EnergyReading:
    """A legacy 0-1 `energy` column value: converted for display but flagged uncalibrated."""
    return reading(value, '0-1', 'legacy_linear', 'linear-0-1', method_version='1')


def classify_band(value: Optional[Decimal], calibrated: bool) -> Optional[str]:
    """Band key for a calibrated value; None for unknown or uncalibrated energy."""
    number = to_decimal(value)
    if number is None or not calibrated or not SCALE_MIN <= number <= SCALE_MAX:
        return None
    number = quantize(number)
    return next((band.key for band in BANDS if band.low <= number <= band.high), None)


@dataclass(frozen=True)
class Reconciled:
    chosen: Optional[EnergyReading]
    band: Optional[str]
    conflicts: Tuple[EnergyReading, ...] = field(default_factory=tuple)


def reconcile(readings: Sequence[EnergyReading]) -> Reconciled:
    """Pick one canonical reading. Highest source precedence wins; a manual rating ties by most recent,
    others by confidence then recency. Readings differing from the chosen by >= 1.0 are conflicts."""
    usable: List[EnergyReading] = [r for r in readings if r.value is not None]
    if not usable:
        return Reconciled(None, None)
    epoch = datetime.min

    def rank(r: EnergyReading):
        manual = r.source == 'manual_rating'
        return (SOURCE_PRECEDENCE[r.source], r.measured_at or epoch if manual else r.confidence or 0.0,
                r.measured_at or epoch)

    chosen = max(usable, key=rank)
    conflicts = tuple(r for r in usable if r is not chosen and abs(r.value - chosen.value) >= CONFLICT_THRESHOLD)
    return Reconciled(chosen, classify_band(chosen.value, chosen.calibrated), conflicts)


def contract_summary() -> dict:
    return {'version': CONTRACT_VERSION, 'scale': [int(SCALE_MIN), int(SCALE_MAX)], 'precision': str(PRECISION),
            'provisional': True, 'bands': [{'key': b.key, 'label': b.label, 'low': str(b.low), 'high': str(b.high)}
                                           for b in BANDS]}


__all__ = ['BANDS', 'CONTRACT_VERSION', 'EnergyReading', 'classify_band', 'contract_summary', 'convert',
           'legacy_reading', 'reading', 'reconcile', 'replace']
