# Key and BPM Analysis

This module (`services/audio-analysis/analysis_modules/key_bpm.py`) performs key and BPM detection on audio files and sample arrays. It was implemented as WP3 (Method B) for track metadata retrieval.

## Method

The analysis leverages the **Essentia** library:
* **Key Estimation**: Uses `KeyExtractor` with `profileType='edma'`. This profile has been specifically tuned for electronic dance music, improving performance over traditional profiles like Krumhansl. The extracted key string is mapped to Camelot format (`8A`, `8B`, etc.) via the shared `to_camelot` function in `services/common/metadata/camelot.py`.
* **BPM Estimation**: Uses `RhythmExtractor2013` (multifeature method). Since BPM estimations can often suffer from octave errors (predicting half-time or double-time values), we perform BPM folding to snap the detected BPM into the common dance music range (e.g. folding up readings <90 BPM and folding down >180 BPM).

If an input audio clip is less than 5 seconds long, the output confidences are capped at a maximum of `0.2` to denote low reliability. Short silence or zero-padding outputs `None`.

## Synthetic Test Set

To avoid committing copyrighted commercial audio, accuracy is verified against a synthetic test audio generator (`tests/synthetic_audio.py`). It synthesizes:
* A 4-on-the-floor sine wave kick drum on every beat.
* A high-passed noise hi-hat on every off-beat.
* Claps on the 2nd and 4th beats.
* A sustained triad chord progression representing the specific key, using simple sine waves with an LFO volume tremolo matching the BPM.

The test suite asserts that the module perfectly recovers:
* Exact Camelot Key.
* BPM within a `±1` threshold (including correct handling of intentional 2% tempo drift clips and half-time BPM folds).

Run tests with:
```bash
cd services/audio-analysis
python -m pytest tests/unit/test_key_bpm.py -q
```

## Local Benchmark

A script is provided to benchmark the performance locally on the owner's tagged music library (which is never committed).
It compares the Essentia estimations against existing ID3 tags (e.g., `TKEY`, `TBPM`, and `Mixed In Key` comments).

### How to Run

On Windows (Git Bash):
```bash
# Optional: run from a virtual environment containing mutagen and essentia
python scripts/benchmark-key-bpm.py "/path/to/music/folder" --csv results.csv --clip 30
```
* `--clip 30` processes only the first 30 seconds (useful for simulating Deezer API previews).
* `--csv results.csv` exports detailed file-by-file outcomes.

### Result Fields
* **Exact Key %**: The percentage of tracks where the detected Camelot key perfectly matched the tag.
* **Key within 1 step/relative %**: The percentage of tracks where the detected key was identical, the relative major/minor (e.g., 8A vs 8B), or ±1 step away on the Circle of Fifths (e.g., 8A vs 7A or 9A).
* **BPM within ±1% %**: The percentage of tracks where the estimated BPM was within 1% of the tagged BPM.
* **BPM off by double/half %**: The percentage of tracks where the estimated BPM was accurate but off by a factor of exactly 0.5x or 2.0x (unfolded errors).
