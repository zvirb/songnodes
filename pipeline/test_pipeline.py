import os
import sys

import pytest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from pipeline.run_weekly import build_record, choose_version


def test_tidal_none_bpm_inherits_deezer_bpm():
    tv = {"title": "Test Track", "version": "TIDAL", "bpm": None}
    dz = {"title": "Test Track", "version": "Deezer", "bpm": 124.0}

    record = build_record(tv, dz)
    assert record is not None
    assert record["bpm"] == 124
    assert isinstance(record["bpm"], int)


def test_tidal_zero_bpm_inherits_deezer_bpm():
    tv = {"title": "Test Track", "version": "TIDAL", "bpm": 0}
    dz = {"title": "Test Track", "version": "Deezer", "bpm": 128.0}

    record = build_record(tv, dz)
    assert record is not None
    assert record["bpm"] == 128


def test_tidal_populated_bpm_not_overwritten():
    tv = {"title": "Test Track", "version": "TIDAL", "bpm": 130}
    dz = {"title": "Test Track", "version": "Deezer", "bpm": 124.0}

    record = build_record(tv, dz)
    assert record is not None
    assert record["bpm"] == 130


def test_neither_has_valid_bpm_preserves_none():
    tv = {"title": "Test Track", "version": "TIDAL", "bpm": None}
    dz = {"title": "Test Track", "version": "Deezer", "bpm": None}

    record = build_record(tv, dz)
    assert record is not None
    assert record["bpm"] is None


def test_no_version_returns_none():
    assert build_record(None, None) is None


def test_deezer_only_version():
    dz = {"title": "Test Track", "version": "Deezer", "bpm": 122.0}
    record = build_record(None, dz)
    assert record is not None
    assert record["bpm"] == 122
