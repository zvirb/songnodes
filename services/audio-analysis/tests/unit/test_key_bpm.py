import pytest
import numpy as np
import sys
import os

# Ensure the root of the project is in the path to import services.common...
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../../../..')))

from analysis_modules.key_bpm import analyse
from tests.synthetic_audio import generate_synthetic_audio

@pytest.mark.slow
def test_synthetic_clips():
    sample_rate = 44100
    test_cases = [
        # bpm, key, expected_camelot, max_bpm_err
        (124, "A minor", "8A", 2.0),
        (128, "C major", "8B", 2.0),
        (174, "F minor", "4A", 2.0),
        (122, "Db major", "3B", 2.0),
        (120, "C major", "8B", 3.0), # Drift case handling, larger err margin
        (64, "C major", "8B", 2.0) # Fold case
    ]

    for target_bpm, key_name, expected_camelot, max_bpm_err in test_cases:
        actual_bpm = target_bpm
        # apply drift to the 120 bpm case
        if target_bpm == 120:
            actual_bpm = 120 * 1.02 # 2% drift -> ~122.4

        audio = generate_synthetic_audio(actual_bpm, key_name, duration=30.0, sample_rate=sample_rate)

        result = analyse(audio, sample_rate)

        expected_bpm = target_bpm if target_bpm != 120 else 121.2
        if target_bpm == 64:
            expected_bpm = 128
        elif target_bpm == 174:
            expected_bpm = 174

        assert result['bpm'] is not None

        bpm_diff = abs(result['bpm'] - expected_bpm)
        print(f"Target: {target_bpm} BPM, {key_name} -> Measured: {result['bpm']:.1f} BPM, {result['key_name']} ({result['key_camelot']})")
        assert bpm_diff <= max_bpm_err, f"BPM difference {bpm_diff} exceeded max {max_bpm_err} for {target_bpm} BPM"

        if target_bpm == 120:
            # Allow relative major/minor for drift clip
            allowed = [expected_camelot, "8A"] # C major relative is A minor
            assert result['key_camelot'] in allowed, f"Key {result['key_camelot']} not in {allowed}"
        else:
            assert result['key_camelot'] == expected_camelot, f"Key mismatch for {key_name}"

def test_silence():
    sample_rate = 44100
    audio = np.zeros(sample_rate * 5, dtype=np.float32)
    result = analyse(audio, sample_rate)

    assert result['bpm'] is None
    assert result['key_camelot'] is None

def test_short_clip():
    sample_rate = 44100
    audio = generate_synthetic_audio(128, "C major", duration=4.0, sample_rate=sample_rate)
    result = analyse(audio, sample_rate)

    assert result['bpm_confidence'] <= 0.2
    assert result['key_confidence'] <= 0.2
