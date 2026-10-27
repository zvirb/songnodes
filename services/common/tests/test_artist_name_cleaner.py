"""
Unit tests for artist_name_cleaner module.
Verifies artifact cleaning, normalization, timestamp extraction, artifact detection, and memoization behavior.
"""

from services.common.artist_name_cleaner import (
    clean_artist_name,
    normalize_artist_name,
    extract_timestamp_from_artist,
    has_formatting_artifacts,
)


def test_clean_artist_name_timestamps():
    assert clean_artist_name("[40:54] Laurent Wolf") == "Laurent Wolf"
    assert clean_artist_name("[0:12] Deadmau5") == "Deadmau5"
    assert clean_artist_name("[??:??] CamelPhat") == "CamelPhat"
    assert clean_artist_name("[?:??:??] Eric Prydz") == "Eric Prydz"


def test_clean_artist_name_brackets_and_prefixes():
    assert clean_artist_name("[??] ARTBAT") == "ARTBAT"
    assert clean_artist_name("[420] Skrillex") == "Skrillex"
    assert clean_artist_name("+ # Deadmau5") == "Deadmau5"
    assert clean_artist_name("+ CamelPhat") == "CamelPhat"
    assert clean_artist_name("- David Guetta") == "David Guetta"
    assert clean_artist_name("* Eric Prydz") == "Eric Prydz"


def test_clean_artist_name_combined():
    assert clean_artist_name("[??:??] + CamelPhat") == "CamelPhat"
    assert clean_artist_name("[40:54] + # Laurent Wolf") == "Laurent Wolf"


def test_clean_artist_name_edge_cases():
    assert clean_artist_name("") == ""
    assert clean_artist_name(None) is None
    # Safety: if cleaning removes all characters, return original
    assert clean_artist_name("[40:54]") == "[40:54]"


def test_normalize_artist_name():
    assert normalize_artist_name("[40:54] Laurent Wolf") == "Laurent Wolf"
    assert normalize_artist_name("The Chemical Brothers") == "Chemical Brothers"
    assert normalize_artist_name("Daft  Punk") == "Daft Punk"
    assert normalize_artist_name("Simon & Garfunkel") == "Simon and Garfunkel"
    assert normalize_artist_name("") == ""
    assert normalize_artist_name(None) is None


def test_extract_timestamp_from_artist():
    assert extract_timestamp_from_artist("[40:54] Laurent Wolf") == "40:54"
    assert extract_timestamp_from_artist("[0:05] Artist") == "0:05"
    assert extract_timestamp_from_artist("+ # Deadmau5") is None
    assert extract_timestamp_from_artist("ARTBAT") is None
    assert extract_timestamp_from_artist("") is None
    assert extract_timestamp_from_artist(None) is None


def test_has_formatting_artifacts():
    assert has_formatting_artifacts("[40:54] Laurent Wolf") is True
    assert has_formatting_artifacts("+ # Deadmau5") is True
    assert has_formatting_artifacts("[??] ARTBAT") is True
    assert has_formatting_artifacts("- David Guetta") is True
    assert has_formatting_artifacts("* Eric Prydz") is True
    assert has_formatting_artifacts("Laurent Wolf") is False
    assert has_formatting_artifacts("") is False
    assert has_formatting_artifacts(None) is False


def test_memoization_cache_hits():
    clean_artist_name.cache_clear()
    normalize_artist_name.cache_clear()

    # Initial call (cache miss)
    res1 = clean_artist_name("[40:54] Test Artist")
    info1 = clean_artist_name.cache_info()
    assert info1.hits == 0

    # Repeated call (cache hit)
    res2 = clean_artist_name("[40:54] Test Artist")
    info2 = clean_artist_name.cache_info()
    assert res1 == res2 == "Test Artist"
    assert info2.hits == 1
