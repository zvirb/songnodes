import os
import tempfile
import logging
from typing import Optional, Dict, Any

import requests

logger = logging.getLogger(__name__)

# Import to_camelot from pipeline.djlib.camelot if available, else fall back to common metadata
try:
    from pipeline.djlib.camelot import to_camelot
except ImportError:
    try:
        from services.common.metadata.camelot import to_camelot
    except ImportError:
        to_camelot = None


def analyze_preview(preview_url: str) -> Optional[Dict[str, Any]]:
    """
    Downloads a Deezer preview MP3 (or any preview audio URL) and computes
    estimated BPM and Camelot Key using Essentia or Librosa.

    Returns:
        dict: {"bpm": float, "musical_key": str, "camelot_key": str, "confidence": float}
        or None if download or analysis fails.
    """
    if not preview_url or not isinstance(preview_url, str):
        return None

    tmp_path = None
    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        }
        response = requests.get(preview_url, headers=headers, timeout=(5, 10), stream=True)
        if response.status_code != 200:
            logger.warning(f"Failed to download audio from {preview_url}, status code: {response.status_code}")
            return None

        with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as tmp_file:
            for chunk in response.iter_content(chunk_size=8192):
                if chunk:
                    tmp_file.write(chunk)
            tmp_path = tmp_file.name

        if not os.path.exists(tmp_path) or os.path.getsize(tmp_path) == 0:
            logger.warning("Downloaded audio file is empty")
            return None

        # 1. Try Essentia first if available
        try:
            import essentia.standard as es
            import numpy as np

            audio = es.MonoLoader(filename=tmp_path)()
            if audio is None or len(audio) == 0:
                raise ValueError("Empty audio loaded by Essentia")

            rhythm_extractor = es.RhythmExtractor2013(method="multifeature")
            bpm, _, _, _, _ = rhythm_extractor(audio)

            key_extractor = es.KeyExtractor(profileType="edma")
            key, scale, key_confidence = key_extractor(audio)

            musical_key = f"{key} {scale}"
            cam_key = to_camelot(musical_key) if callable(to_camelot) else None

            if bpm and bpm > 0 and cam_key:
                return {
                    "bpm": round(float(bpm), 1),
                    "musical_key": musical_key,
                    "camelot_key": cam_key,
                    "confidence": round(float(key_confidence), 3)
                }
        except (ImportError, Exception) as es_err:
            logger.debug(f"Essentia extraction failed or unavailable, falling back to librosa: {es_err}")

        # 2. Fallback to Librosa if available
        try:
            import librosa
            import numpy as np

            y, sr = librosa.load(tmp_path, sr=None)
            if y is None or len(y) == 0:
                return None

            tempo, _ = librosa.beat.beat_track(y=y, sr=sr)
            bpm = float(np.atleast_1d(tempo)[0])

            chroma = librosa.feature.chroma_cqt(y=y, sr=sr)
            chroma_sum = np.sum(chroma, axis=1)

            pitch_names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
            kk_major = np.array([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88])
            kk_minor = np.array([6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 2.54, 3.30, 3.05, 2.41])

            best_corr = -2.0
            best_key = None

            for i in range(12):
                corr_maj = np.corrcoef(chroma_sum, np.roll(kk_major, i))[0, 1]
                if corr_maj > best_corr:
                    best_corr = corr_maj
                    best_key = f"{pitch_names[i]} major"

                corr_min = np.corrcoef(chroma_sum, np.roll(kk_minor, i))[0, 1]
                if corr_min > best_corr:
                    best_corr = corr_min
                    best_key = f"{pitch_names[i]} minor"

            cam_key = to_camelot(best_key) if callable(to_camelot) else None

            if bpm and bpm > 0 and cam_key:
                return {
                    "bpm": round(bpm, 1),
                    "musical_key": best_key,
                    "camelot_key": cam_key,
                    "confidence": round(float(max(0.0, best_corr)), 3)
                }
        except (ImportError, Exception) as lib_err:
            logger.error(f"Librosa extraction failed: {lib_err}")

        return None

    except Exception as e:
        logger.error(f"Error in analyze_preview: {e}")
        return None
    finally:
        if tmp_path and os.path.exists(tmp_path):
            try:
                os.remove(tmp_path)
            except OSError:
                pass
