import pytest
import numpy as np
import librosa
from datetime import datetime

# Tests will generate a mock sine wave
def generate_sine_wave(freq, duration_sec, sr=22050):
    t = np.linspace(0, duration_sec, int(sr * duration_sec), endpoint=False)
    # Generate a pure sine wave at a specific frequency
    x = 0.5 * np.sin(2 * np.pi * freq * t)
    return x

def test_imports():
    """Verify that all core dependencies can be imported successfully."""
    import numpy
    import scipy
    import librosa
    import numba
    import soundfile

    assert numpy.__version__ is not None
    assert scipy.__version__ is not None
    assert librosa.__version__ is not None
    assert numba.__version__ is not None
    assert soundfile.__version__ is not None

def test_tempo_estimation():
    """Verify librosa tempo estimation works with our numpy/scipy versions."""
    sr = 22050
    # Generate a simple 120 BPM click track (2 beats per second)
    duration = 5.0
    t = np.linspace(0, duration, int(sr * duration), endpoint=False)
    # Generate impulses at 0.5s intervals (120 BPM)
    x = np.zeros_like(t)
    click = np.sin(2 * np.pi * 1000 * np.linspace(0, 0.05, int(sr * 0.05)))

    for i in range(10):
        start = int(i * 0.5 * sr)
        if start + len(click) < len(x):
            x[start:start+len(click)] = click

    # Get tempo
    onset_env = librosa.onset.onset_strength(y=x, sr=sr)
    tempo = librosa.beat.beat_track(onset_envelope=onset_env, sr=sr)[0]

    # Extract the tempo scalar if it's an array
    if hasattr(tempo, 'item'):
        tempo_val = tempo.item()
    elif isinstance(tempo, (list, np.ndarray)):
        tempo_val = tempo[0]
    else:
        tempo_val = tempo

    # Verify tempo is around 120 BPM (+/- 5 BPM tolerance)
    assert 115 <= tempo_val <= 125, f"Expected ~120 BPM, got {tempo_val}"

def test_pitch_estimation():
    """Verify librosa pitch estimation works."""
    sr = 22050
    # A4 is 440 Hz
    x = generate_sine_wave(440.0, 2.0, sr)

    # Calculate chromagram
    chroma = librosa.feature.chroma_cqt(y=x, sr=sr)

    # Get mean chroma across time
    mean_chroma = np.mean(chroma, axis=1)

    # 440 Hz should be A, which is pitch class 9 in C-based 0-indexed scale (C=0, C#=1... A=9)
    estimated_pitch_class = np.argmax(mean_chroma)

    assert estimated_pitch_class == 9, f"Expected pitch class 9 (A), got {estimated_pitch_class}"
