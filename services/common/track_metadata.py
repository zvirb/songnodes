"""Expose stored metadata without inventing measurements or changing energy scales.

Core silver columns are authoritative, including explicit NULLs. Optional fields
can be read from legacy JSONB until their versioned column migration is applied.
"""
import json
import math
from decimal import Decimal

from .metadata import energy as energy_contract


def object_value(value):
    if isinstance(value, str):
        try:
            value = json.loads(value)
        except (ValueError, TypeError):
            return {}
    return value if isinstance(value, dict) else {}


def stored_metadata(record):
    legacy = {**object_value(record.get('enrichment_metadata')), **object_value(record.get('metadata'))}

    def field(name, *aliases, authoritative=False):
        if authoritative and name in record:
            return record[name]
        for source in (record, legacy):
            for key in (name, *aliases):
                value = source.get(key)
                if isinstance(value, dict):
                    value = value.get('value')
                if value is not None and value != '':
                    return value
        return None

    def number(name, *, authoritative=False):
        value = field(name, authoritative=authoritative)
        if value is None or isinstance(value, bool):
            return None
        try:
            result = float(value)
            return result if math.isfinite(result) else None
        except (ValueError, TypeError):
            return None

    def string(name, *aliases):
        value = field(name, *aliases)
        return str(value) if isinstance(value, (str, int)) and not isinstance(value, bool) else None

    duration_ms = number('duration_ms', authoritative=True)
    key = field('key', authoritative=True)
    # Canonical 1-10 energy (versioned contract). Legacy 0-1 `energy` is never relabelled as this; the band is only
    # present for calibrated values, so unknown or uncalibrated energy has no band.
    canonical = number('energy_canonical', authoritative=True)
    calibrated = record.get('energy_calibrated') if canonical is not None else None
    reasons = record.get('metadata_review_reasons')
    return {
        'bpm': number('bpm', authoritative=True), 'key': key, 'musical_key': key,
        'camelot_key': string('camelot_key', 'camelotKey'),
        'energy': number('energy', authoritative=True), 'energy_scale': string('energy_scale'),
        'danceability': number('danceability', authoritative=True),
        'valence': number('valence', authoritative=True),
        'duration_ms': duration_ms, 'duration': duration_ms / 1000 if duration_ms is not None else None,
        'isrc': field('isrc', authoritative=True), 'spotify_id': string('spotify_id'),
        'apple_music_id': string('apple_music_id'), 'beatport_id': string('beatport_id'),
        'tidal_id': string('tidal_id'), 'deezer_id': string('deezer_id'),
        'record_label': string('record_label', 'label'), 'mix_name': string('mix_name', 'version'),
        'energy_canonical': canonical, 'energy_calibrated': bool(calibrated) if calibrated is not None else None,
        'energy_source': record.get('energy_source') if canonical is not None else None,
        'energy_contract_version': record.get('energy_contract_version') if canonical is not None else None,
        'energy_band': energy_contract.classify_band(Decimal(str(canonical)), bool(calibrated)) if canonical is not None else None,
        'metadata_review': bool(record.get('metadata_review')),
        'metadata_review_reasons': list(reasons) if reasons else [],
    }
