import numpy as np
import logging

try:
    from services.common.metadata.camelot import to_camelot
except ImportError:
    # Fallback for testing standalone if needed, though we expect sys.path to be set
    def to_camelot(key_str):
        return None

try:
    import essentia.standard as es
    HAS_ESSENTIA = True
except ImportError:
    import librosa
    HAS_ESSENTIA = False

logger = logging.getLogger(__name__)

def _fold_bpm(bpm: float) -> float:
    """Fold half- and double-time BPMs into the typical dance music range (70-180)."""
    if bpm <= 0:
        return bpm
    # The requirement specifies 70 to 180 as typical range.
    # House/techno priors (115-150) mean if it's 87.1, it should fold to 174.2 if it's drum&bass,
    # but the logic given is "fold half and double time into 70 to 180".
    # Since 87 is > 70 and < 180, a generic loop won't double it unless we tweak the bounds.
    # The requirement specifically says:
    # "Fold half- and double-time readings into a genre range (house 100-140, techno 115-160, UKG/bass 120-150, d&b 160-180)."
    # If the reading is 87, and we are expecting 174 (d&b), 87 is typically considered half-time for d&b.
    # Let's adjust the simple fold loop to prioritize the 100-180 range.
    while bpm < 100: # 100 is the lowest end of the dance-music prior (house)
        bpm *= 2
    while bpm > 180:
        bpm /= 2
    return bpm

def analyse(samples: np.ndarray, sample_rate: float) -> dict:
    """
    Analyse audio samples for key and BPM.

    Args:
        samples: numpy array of audio samples (mono or stereo)
        sample_rate: sample rate of the audio (Hz)

    Returns:
        dict: {'bpm': float, 'bpm_confidence': float, 'key_camelot': str,
               'key_name': str, 'key_confidence': float,
               'method': str, 'method_version': str}
               or None values if analysis fails/is empty.
    """
    # Guard against silence or very short audio
    if len(samples) == 0 or np.all(samples == 0):
        return {
            'bpm': None, 'raw_bpm': None, 'bpm_confidence': None, 'key_camelot': None,
            'key_name': None, 'key_confidence': None,
            'method': 'essentia_edma_rhythm2013', 'method_version': '1.0'
        }

    if samples.ndim > 1:
        # Convert stereo to mono by averaging channels
        samples = np.mean(samples, axis=1)

    # Convert to single precision float for Essentia if it's not already
    samples = samples.astype(np.float32)

    # Resample to 44100 if necessary, as RhythmExtractor2013 requires 44100 Hz
    # and Essentia algorithms generally expect 44100 Hz
    if sample_rate != 44100:
        resample = es.Resample(inputSampleRate=sample_rate, outputSampleRate=44100)
        samples = resample(samples)

    result = {
        'bpm': None, 'raw_bpm': None, 'bpm_confidence': None, 'key_camelot': None,
        'key_name': None, 'key_confidence': None,
        'method': 'essentia_edma_rhythm2013', 'method_version': '1.0'
    }

    # If clip is very short (< 5 seconds), confidence should be low
    low_confidence = len(samples) < 5 * 44100

    if not HAS_ESSENTIA:
        # LIBROSA FALLBACK
        try:
            # Resample to 22050 for Librosa standard if needed
            if sample_rate != 22050:
                samples = librosa.resample(samples, orig_sr=sample_rate, target_sr=22050)
                sample_rate = 22050

            # Key extraction (CQT chroma with Krumhansl-Schmuckler)
            chroma = librosa.feature.chroma_cqt(y=samples, sr=sample_rate)
            chroma_vals = np.sum(chroma, axis=1)

            # Simple Krumhansl profiles
            maj_profile = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88] # Using Krumhansl as simple baseline, but for 'EDM-weighted' one might boost the bass. We'll leave K-S.
            min_profile = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17]

            best_corr = -1
            best_key = ""
            pitch_classes = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']

            for i in range(12):
                # Major
                corr_maj = np.corrcoef(chroma_vals, np.roll(maj_profile, i))[0, 1]
                if corr_maj > best_corr:
                    best_corr = corr_maj
                    best_key = f"{pitch_classes[i]} major"

                # Minor
                corr_min = np.corrcoef(chroma_vals, np.roll(min_profile, i))[0, 1]
                if corr_min > best_corr:
                    best_corr = corr_min
                    best_key = f"{pitch_classes[i]} minor"

            if best_key:
                result['key_name'] = best_key
                result['key_camelot'] = to_camelot(best_key)
                result['key_confidence'] = float(best_corr) if not low_confidence else min(0.2, float(best_corr))

        except Exception as e:
            logger.error(f"Librosa key error: {e}")

        try:
            # BPM extraction
            onset_env = librosa.onset.onset_strength(y=samples, sr=sample_rate)
            # Apply tempo prior for dance music using beat_track
            bpm, _ = librosa.beat.beat_track(onset_envelope=onset_env, sr=sample_rate, start_bpm=128.0)
            if isinstance(bpm, np.ndarray):
                bpm = bpm[0]

            if bpm > 0:
                folded_bpm = _fold_bpm(float(bpm))
                result['raw_bpm'] = float(bpm)
                result['bpm'] = folded_bpm
                result['bpm_confidence'] = 0.5 if not low_confidence else 0.2
        except Exception as e:
            logger.error(f"Librosa BPM error: {e}")

        result['method'] = 'librosa_fallback'
        return result

    try:
        # Key extraction
        key_extractor = es.KeyExtractor(profileType='edma')
        key, scale, key_strength = key_extractor(samples)

        if key and scale:
            key_name = f"{key} {scale}"
            camelot_key = to_camelot(key_name)

            result['key_name'] = key_name
            result['key_camelot'] = camelot_key
            result['key_confidence'] = float(key_strength) if not low_confidence else min(0.2, float(key_strength))
    except Exception as e:
        logger.error(f"Error during key extraction: {e}")

    try:
        # BPM extraction
        rhythm_extractor = es.RhythmExtractor2013(method="multifeature")
        bpm, ticks, confidence, estimates, bpm_intervals = rhythm_extractor(samples)

        if bpm > 0:
            folded_bpm = _fold_bpm(float(bpm))
            result['raw_bpm'] = float(bpm)
            result['bpm'] = folded_bpm
            result['bpm_confidence'] = float(confidence) if not low_confidence else min(0.2, float(confidence))
    except Exception as e:
        logger.error(f"Error during BPM extraction: {e}")

    return result

def analyse_file(filepath: str) -> dict:
    """
    Analyse an audio file for key and BPM.

    Args:
        filepath: path to the audio file

    Returns:
        Same dict as `analyse`
    """
    try:
        if HAS_ESSENTIA:
            loader = es.MonoLoader(filename=filepath, sampleRate=44100)
            samples = loader()
        else:
            samples, _ = librosa.load(filepath, sr=44100, mono=True)
        return analyse(samples, 44100)
    except Exception as e:
        logger.error(f"Error loading file {filepath}: {e}")
        return {
            'bpm': None, 'raw_bpm': None, 'bpm_confidence': None, 'key_camelot': None,
            'key_name': None, 'key_confidence': None,
            'method': 'essentia_edma_rhythm2013', 'method_version': '1.0'
        }
