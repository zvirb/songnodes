"""
Advanced Audio Feature Analysis Module
Extracts timbre, rhythm, mood, and genre information using librosa and machine learning.
"""
import numpy as np
import librosa
from typing import Dict, List, Tuple, Any, Optional
import logging

logger = logging.getLogger(__name__)


class AdvancedAudioAnalyzer:
    """
    Analyzes advanced audio features for DJ-specific insights.

    Features extracted:
    - Timbre: spectral centroid, zero-crossing rate, MFCC, spectral rolloff
    - Rhythm: tempograms, beat histograms, rhythm complexity
    - Mood: energy, valence indicators, dynamic range
    - Genre: spectral features, rhythmic patterns
    """

    def __init__(self):
        self.sample_rate = 22050  # librosa default

    def analyze_timbre(self, audio_data: np.ndarray, sr: int) -> Dict[str, Any]:
        """
        Extract timbre characteristics using spectral analysis.

        Timbre represents the "color" or "texture" of sound - what makes
        a trumpet sound different from a piano playing the same note.

        Args:
            audio_data: Audio time series
            sr: Sample rate

        Returns:
            Dictionary containing timbre features:
            - spectral_centroid: Brightness of sound
            - zero_crossing_rate: Percussiveness/noisiness
            - mfcc: Mel-frequency cepstral coefficients (timbral texture)
            - spectral_rolloff: Frequency distribution
            - spectral_contrast: Peak-to-valley difference per band
        """
        logger.info("Analyzing timbre features")

        try:
            # Spectral Centroid - indicates "brightness"
            spectral_centroids = librosa.feature.spectral_centroid(y=audio_data, sr=sr)[0]

            # Zero Crossing Rate - indicates percussiveness
            zcr = librosa.feature.zero_crossing_rate(audio_data)[0]

            # MFCCs - compact representation of spectral envelope
            mfccs = librosa.feature.mfcc(y=audio_data, sr=sr, n_mfcc=13)

            # Spectral Rolloff - frequency below which 85% of energy is contained
            spectral_rolloff = librosa.feature.spectral_rolloff(y=audio_data, sr=sr)[0]

            # Spectral Contrast - difference between peaks and valleys
            spectral_contrast = librosa.feature.spectral_contrast(y=audio_data, sr=sr)

            # Spectral Flatness - how noise-like vs tone-like the sound is
            spectral_flatness = librosa.feature.spectral_flatness(y=audio_data)[0]

            return {
                "spectral_centroid": {
                    "mean": float(np.mean(spectral_centroids)),
                    "std": float(np.std(spectral_centroids)),
                    "min": float(np.min(spectral_centroids)),
                    "max": float(np.max(spectral_centroids))
                },
                "zero_crossing_rate": {
                    "mean": float(np.mean(zcr)),
                    "std": float(np.std(zcr))
                },
                "mfcc": {
                    "means": [float(np.mean(mfcc)) for mfcc in mfccs],
                    "stds": [float(np.std(mfcc)) for mfcc in mfccs]
                },
                "spectral_rolloff": {
                    "mean": float(np.mean(spectral_rolloff)),
                    "std": float(np.std(spectral_rolloff))
                },
                "spectral_contrast": {
                    "means": [float(np.mean(contrast)) for contrast in spectral_contrast],
                    "stds": [float(np.std(contrast)) for contrast in spectral_contrast]
                },
                "spectral_flatness": {
                    "mean": float(np.mean(spectral_flatness)),
                    "std": float(np.std(spectral_flatness))
                },
                "timbre_descriptor": self._classify_timbre(spectral_centroids, zcr, spectral_flatness)
            }

        except Exception as e:
            logger.error(f"Timbre analysis failed: {e}")
            return {}

    def analyze_rhythm(self, audio_data: np.ndarray, sr: int, bpm: Optional[float] = None) -> Dict[str, Any]:
        """
        Extract rhythm characteristics and complexity.

        Rhythm analysis helps understand the groove, complexity, and
        percussive characteristics of a track.

        Args:
            audio_data: Audio time series
            sr: Sample rate
            bpm: Optional BPM (will be detected if not provided)

        Returns:
            Dictionary containing rhythm features:
            - tempogram: Visual representation of tempo over time
            - beat_histogram: Distribution of beat strengths
            - rhythm_complexity: Measure of rhythmic variation
            - onset_strength: Percussive attack characteristics
        """
        logger.info("Analyzing rhythm features")

        try:
            # Onset strength envelope - percussive events
            onset_env = librosa.onset.onset_strength(y=audio_data, sr=sr)

            # Tempogram - tempo variations over time
            tempogram = librosa.feature.tempogram(
                onset_envelope=onset_env,
                sr=sr
            )

            # Detect tempo if not provided
            if bpm is None:
                tempo, beats = librosa.beat.beat_track(
                    onset_envelope=onset_env,
                    sr=sr
                )
                bpm = float(tempo)

            # Beat histogram - distribution of beat strengths
            beat_frames = librosa.util.peak_pick(
                onset_env,
                pre_max=3,
                post_max=3,
                pre_avg=3,
                post_avg=5,
                delta=0.5,
                wait=10
            )

            # Calculate rhythm complexity (entropy of onset strength)
            rhythm_complexity = float(self._calculate_rhythm_complexity(onset_env))

            # Pulse clarity - how clear the beat is
            pulse_clarity = float(self._calculate_pulse_clarity(tempogram))

            # Syncopation - off-beat emphasis
            syncopation = float(self._calculate_syncopation(onset_env, bpm, sr))

            return {
                "tempogram_stats": {
                    "mean": float(np.mean(tempogram)),
                    "std": float(np.std(tempogram)),
                    "dominant_tempo_bin": int(np.argmax(np.mean(tempogram, axis=1)))
                },
                "onset_strength": {
                    "mean": float(np.mean(onset_env)),
                    "std": float(np.std(onset_env)),
                    "peak_count": len(beat_frames)
                },
                "rhythm_complexity": rhythm_complexity,
                "pulse_clarity": pulse_clarity,
                "syncopation": syncopation,
                "beat_regularity": float(self._calculate_beat_regularity(beat_frames)),
                "rhythm_descriptor": self._classify_rhythm(rhythm_complexity, pulse_clarity, syncopation)
            }

        except Exception as e:
            logger.error(f"Rhythm analysis failed: {e}")
            return {}

    def analyze_mood(self, audio_data: np.ndarray, sr: int, bpm: Optional[float] = None) -> Dict[str, Any]:
        """
        Estimate mood characteristics using audio features.

        Mood analysis combines energy, valence (positivity), and other
        acoustic features to categorize the emotional quality.

        Args:
            audio_data: Audio time series
            sr: Sample rate
            bpm: Optional BPM for context

        Returns:
            Dictionary containing mood indicators:
            - energy: Overall intensity (0-1)
            - valence: Positivity/negativity estimate (0-1)
            - arousal: Excitement level (0-1)
            - mood_category: String classification
        """
        logger.info("Analyzing mood features")

        try:
            # RMS Energy - overall loudness/intensity
            rms = librosa.feature.rms(y=audio_data)[0]
            energy = float(np.mean(rms))

            # Spectral features for valence estimation
            spectral_centroids = librosa.feature.spectral_centroid(y=audio_data, sr=sr)[0]
            chroma = librosa.feature.chroma_stft(y=audio_data, sr=sr)

            # Dynamic range - variation in loudness
            dynamic_range = float(np.std(rms))

            # Estimate valence from spectral brightness and harmony
            valence = self._estimate_valence(spectral_centroids, chroma)

            # Arousal from energy and tempo
            arousal = self._estimate_arousal(energy, bpm, dynamic_range)

            # Mode detection (major/minor) for emotional context
            chroma_mean = np.mean(chroma, axis=1)
            mode = self._detect_mode(chroma_mean)

            # Classify mood based on valence-arousal model
            mood_category = self._classify_mood(valence, arousal, energy)

            return {
                "energy": float(np.clip(energy * 10, 0, 1)),  # Normalized to 0-1
                "valence": float(valence),
                "arousal": float(arousal),
                "dynamic_range": dynamic_range,
                "mode": mode,
                "mood_category": mood_category,
                "mood_score": {
                    "happy": float(max(0, valence) * arousal),
                    "sad": float(max(0, -valence) * (1 - arousal)),
                    "energetic": float(arousal * energy),
                    "calm": float((1 - arousal) * (1 - energy)),
                    "aggressive": float(arousal * energy * (1 - valence)),
                    "melancholic": float((1 - arousal) * (1 - valence))
                }
            }

        except Exception as e:
            logger.error(f"Mood analysis failed: {e}")
            return {}

    def classify_genre(self, audio_data: np.ndarray, sr: int, timbre: Dict, rhythm: Dict) -> Dict[str, Any]:
        """
        Genre classification using combined audio features.

        Uses heuristic rules based on spectral and rhythmic characteristics.
        For production, this should be replaced with a trained ML model.

        Args:
            audio_data: Audio time series
            sr: Sample rate
            timbre: Timbre analysis results
            rhythm: Rhythm analysis results

        Returns:
            Dictionary with genre predictions and confidence scores
        """
        logger.info("Classifying genre")

        try:
            # Extract additional features for genre classification
            chroma = librosa.feature.chroma_stft(y=audio_data, sr=sr)
            tonnetz = librosa.feature.tonnetz(y=audio_data, sr=sr)

            # Genre heuristics based on audio characteristics
            genre_scores = {}

            # Techno/House: High rhythm complexity, repetitive, high energy
            if rhythm.get('rhythm_complexity', 0) > 0.5 and rhythm.get('beat_regularity', 0) > 0.7:
                genre_scores['techno/house'] = 0.8

            # Ambient/Downtempo: Low rhythm complexity, low energy
            if rhythm.get('rhythm_complexity', 0) < 0.3 and timbre.get('spectral_centroid', {}).get('mean', 0) < 2000:
                genre_scores['ambient/downtempo'] = 0.7

            # Drum & Bass/Breakbeat: High rhythm complexity, fast tempo, high syncopation
            if rhythm.get('syncopation', 0) > 0.6 and rhythm.get('rhythm_complexity', 0) > 0.6:
                genre_scores['drum_and_bass/breakbeat'] = 0.75

            # Trance/Progressive: Moderate rhythm complexity, melodic
            harmonic_complexity = float(np.std(chroma))
            if harmonic_complexity > 0.15 and rhythm.get('pulse_clarity', 0) > 0.6:
                genre_scores['trance/progressive'] = 0.7

            # Dubstep/Bass Music: High spectral contrast, high bass energy
            if timbre.get('spectral_contrast', {}).get('means', [0])[0] > 20:
                genre_scores['dubstep/bass'] = 0.65

            # Normalize scores
            if genre_scores:
                max_score = max(genre_scores.values())
                genre_scores = {k: v/max_score for k, v in genre_scores.items()}

            # Get top prediction
            top_genre = max(genre_scores.items(), key=lambda x: x[1]) if genre_scores else ("unknown", 0.0)

            return {
                "primary_genre": top_genre[0],
                "confidence": top_genre[1],
                "genre_scores": genre_scores,
                "note": "Heuristic-based classification. For production use, train ML model on labeled data."
            }

        except Exception as e:
            logger.error(f"Genre classification failed: {e}")
            return {"primary_genre": "unknown", "confidence": 0.0, "genre_scores": {}}

    # Helper methods

    def _classify_timbre(self, spectral_centroids: np.ndarray, zcr: np.ndarray, flatness: np.ndarray) -> str:
        """Classify overall timbre character"""
        brightness = np.mean(spectral_centroids)
        percussiveness = np.mean(zcr)
        tonality = 1 - np.mean(flatness)

        if brightness > 3000 and percussiveness > 0.1:
            return "bright_percussive"
        elif brightness > 3000 and tonality > 0.5:
            return "bright_melodic"
        elif brightness < 2000 and percussiveness > 0.1:
            return "dark_percussive"
        elif brightness < 2000 and tonality > 0.5:
            return "dark_melodic"
        else:
            return "neutral"

    def _calculate_rhythm_complexity(self, onset_env: np.ndarray) -> float:
        """Calculate rhythm complexity using entropy"""
        # Normalize onset envelope
        onset_norm = onset_env / (np.sum(onset_env) + 1e-10)
        # Calculate entropy
        entropy = -np.sum(onset_norm * np.log2(onset_norm + 1e-10))
        # Normalize to 0-1 range
        max_entropy = np.log2(len(onset_env))
        return entropy / max_entropy if max_entropy > 0 else 0.0

    def _calculate_pulse_clarity(self, tempogram: np.ndarray) -> float:
        """Calculate how clear/steady the pulse is"""
        # Higher std means more tempo variation (less clarity)
        tempo_std = np.std(tempogram, axis=1)
        clarity = 1.0 / (1.0 + np.mean(tempo_std))
        return clarity

    def _calculate_syncopation(self, onset_env: np.ndarray, bpm: float, sr: int) -> float:
        """Calculate degree of syncopation (off-beat emphasis)"""
        if bpm == 0:
            return 0.0

        # Calculate beat positions
        beat_length = int(60.0 / bpm * sr / 512)  # hop_length = 512

        if beat_length == 0:
            return 0.0

        # Compare on-beat vs off-beat energy
        on_beat_energy = []
        off_beat_energy = []

        for i in range(0, len(onset_env) - beat_length, beat_length):
            on_beat_energy.append(onset_env[i])
            if i + beat_length // 2 < len(onset_env):
                off_beat_energy.append(onset_env[i + beat_length // 2])

        if not on_beat_energy or not off_beat_energy:
            return 0.0

        on_beat_mean = np.mean(on_beat_energy)
        off_beat_mean = np.mean(off_beat_energy)

        # Syncopation is high when off-beat energy approaches on-beat energy
        if on_beat_mean == 0:
            return 0.0

        return off_beat_mean / (on_beat_mean + off_beat_mean)

    def _calculate_beat_regularity(self, beat_frames: np.ndarray) -> float:
        """Calculate how regular the beats are"""
        if len(beat_frames) < 2:
            return 0.0

        # Calculate inter-beat intervals
        intervals = np.diff(beat_frames)

        if len(intervals) == 0:
            return 0.0

        # Regularity is inverse of coefficient of variation
        cv = np.std(intervals) / (np.mean(intervals) + 1e-10)
        regularity = 1.0 / (1.0 + cv)

        return regularity

    def _estimate_valence(self, spectral_centroids: np.ndarray, chroma: np.ndarray) -> float:
        """
        Estimate valence (positivity) from spectral features.
        Brighter, more harmonic content tends to be more positive.
        """
        brightness = np.mean(spectral_centroids) / 4000.0  # Normalize
        harmonic_clarity = np.max(chroma, axis=0).mean()  # Strong harmonic content

        # Simple combination (in production, use trained model)
        valence = (brightness * 0.6 + harmonic_clarity * 0.4)

        # Map to -1 to 1 range (negative = sad, positive = happy)
        return np.clip(valence * 2 - 1, -1, 1)

    def _estimate_arousal(self, energy: float, bpm: Optional[float], dynamic_range: float) -> float:
        """
        Estimate arousal (excitement) from energy and tempo.
        """
        # Normalize energy
        energy_norm = np.clip(energy * 10, 0, 1)

        # Normalize BPM (typical range 60-180)
        bpm_norm = 0.5 if bpm is None else np.clip((bpm - 60) / 120, 0, 1)

        # Dynamic range contributes to arousal
        dynamic_norm = np.clip(dynamic_range * 10, 0, 1)

        arousal = energy_norm * 0.5 + bpm_norm * 0.3 + dynamic_norm * 0.2

        return np.clip(arousal, 0, 1)

    def _detect_mode(self, chroma_mean: np.ndarray) -> str:
        """Detect major vs minor mode from chroma"""
        # Simple heuristic: check relative strength of major vs minor third
        major_third_idx = 4  # E in C major
        minor_third_idx = 3  # Eb in C minor

        if chroma_mean[major_third_idx] > chroma_mean[minor_third_idx]:
            return "major"
        else:
            return "minor"

    def _classify_mood(self, valence: float, arousal: float, energy: float) -> str:
        """
        Classify mood using valence-arousal model.

        Russell's circumplex model of affect:
        - High arousal, high valence: excited, happy, energetic
        - High arousal, low valence: angry, tense, aggressive
        - Low arousal, high valence: calm, peaceful, content
        - Low arousal, low valence: sad, depressed, melancholic
        """
        if arousal > 0.6:
            if valence > 0.3:
                return "energetic/happy"
            elif valence < -0.3:
                return "aggressive/tense"
            else:
                return "intense/excited"
        else:
            if valence > 0.3:
                return "calm/peaceful"
            elif valence < -0.3:
                return "sad/melancholic"
            else:
                return "neutral/ambient"


    def analyze_spotify_equivalent_features(self, audio_data: np.ndarray, sr: int, bpm: Optional[float] = None) -> Dict[str, Any]:
        """
        Extract Spotify-equivalent audio features to replace deprecated API.

        This method provides drop-in replacements for Spotify's Audio Features API:
        - danceability: Rhythm regularity + beat strength + tempo suitability
        - acousticness: Non-electronic instrument detection via HPSS
        - instrumentalness: Inverse of vocal presence
        - liveness: Audience/crowd noise detection
        - speechiness: Speech-like content detection
        - key: Musical key detection (0-11, C=0)
        - mode: Major (1) or Minor (0)

        Args:
            audio_data: Audio time series
            sr: Sample rate
            bpm: Optional BPM (detected if not provided)

        Returns:
            Dictionary with Spotify-compatible features (0.0-1.0 scales)
        """
        logger.info("Analyzing Spotify-equivalent features")

        try:
            # Detect BPM if not provided
            if bpm is None:
                tempo, _ = librosa.beat.beat_track(y=audio_data, sr=sr)
                bpm = float(tempo)

            # DANCEABILITY: Rhythm regularity + beat strength + tempo suitability
            danceability = self._calculate_danceability(audio_data, sr, bpm)

            # ACOUSTICNESS: Acoustic instrument detection via HPSS
            acousticness = self._calculate_acousticness(audio_data, sr)

            # INSTRUMENTALNESS: Inverse of vocal presence
            instrumentalness = self._calculate_instrumentalness(audio_data, sr)

            # LIVENESS: Audience/crowd noise detection
            liveness = self._calculate_liveness(audio_data, sr)

            # SPEECHINESS: Speech-like content detection
            speechiness = self._calculate_speechiness(audio_data, sr)

            # KEY DETECTION: Pitch class (0-11) and mode (0=minor, 1=major)
            key, mode, key_confidence = self._detect_key(audio_data, sr)

            return {
                "danceability": float(danceability),
                "acousticness": float(acousticness),
                "instrumentalness": float(instrumentalness),
                "liveness": float(liveness),
                "speechiness": float(speechiness),
                "key": int(key),
                "mode": int(mode),
                "key_confidence": float(key_confidence),
                "note": "Self-hosted analysis via Librosa/Essentia - no Spotify API dependency"
            }

        except Exception as e:
            logger.error(f"Spotify-equivalent feature analysis failed: {e}")
            return {}

    def _calculate_danceability(self, audio_data: np.ndarray, sr: int, bpm: float) -> float:
        """
        Calculate danceability score (0-1) based on rhythm regularity and tempo.

        Danceability combines:
        - Beat strength and regularity
        - Tempo suitability for dancing (90-140 BPM ideal)
        - Rhythm stability
        """
        # Beat tracking
        onset_env = librosa.onset.onset_strength(y=audio_data, sr=sr)
        beat_frames = librosa.util.peak_pick(
            onset_env,
            pre_max=3, post_max=3, pre_avg=3, post_avg=5,
            delta=0.5, wait=10
        )

        # Beat regularity (coefficient of variation of inter-beat intervals)
        if len(beat_frames) > 2:
            intervals = np.diff(beat_frames)
            cv = np.std(intervals) / (np.mean(intervals) + 1e-10)
            beat_regularity = 1.0 / (1.0 + cv)
        else:
            beat_regularity = 0.0

        # Beat strength (mean onset strength)
        beat_strength = np.mean(onset_env) / (np.max(onset_env) + 1e-10)

        # Tempo suitability (peak at 120 BPM, fall off outside 90-140)
        if 90 <= bpm <= 140:
            tempo_score = 1.0 - abs(bpm - 120) / 30  # Peak at 120, linear decay
        else:
            tempo_score = max(0, 1.0 - abs(bpm - 115) / 100)  # Penalize extreme tempos

        # Pulse clarity from tempogram
        tempogram = librosa.feature.tempogram(onset_envelope=onset_env, sr=sr)
        pulse_clarity = self._calculate_pulse_clarity(tempogram)

        # Weighted combination
        danceability = (
            beat_regularity * 0.35 +
            beat_strength * 0.25 +
            tempo_score * 0.25 +
            pulse_clarity * 0.15
        )

        return np.clip(danceability, 0, 1)

    def _calculate_acousticness(self, audio_data: np.ndarray, sr: int) -> float:
        """
        Calculate acousticness (0-1) - likelihood of acoustic (non-electronic) instruments.

        Uses Harmonic-Percussive Source Separation (HPSS) to detect acoustic characteristics:
        - High harmonic-to-percussive ratio
        - Natural spectral envelope (vs synthetic)
        - Absence of electronic timbres
        """
        # HPSS - separate harmonic and percussive components
        harmonic, percussive = librosa.effects.hpss(audio_data)

        # Harmonic-to-percussive energy ratio
        harmonic_energy = np.sum(harmonic ** 2)
        percussive_energy = np.sum(percussive ** 2)
        total_energy = harmonic_energy + percussive_energy + 1e-10

        harmonic_ratio = harmonic_energy / total_energy

        # Spectral flatness (low = tonal/acoustic, high = noisy/electronic)
        flatness = librosa.feature.spectral_flatness(y=audio_data)[0]
        tonality = 1 - np.mean(flatness)

        # Spectral rolloff (acoustic instruments have lower rolloff)
        rolloff = librosa.feature.spectral_rolloff(y=audio_data, sr=sr)[0]
        rolloff_score = 1 - np.clip(np.mean(rolloff) / (sr / 2), 0, 1)

        # Zero-crossing rate (acoustic has moderate ZCR, electronic can be very low or high)
        zcr = librosa.feature.zero_crossing_rate(audio_data)[0]
        zcr_mean = np.mean(zcr)
        zcr_score = 1 - abs(zcr_mean - 0.1) / 0.1  # Peak at ~0.1
        zcr_score = np.clip(zcr_score, 0, 1)

        # Weighted combination
        acousticness = (
            harmonic_ratio * 0.4 +
            tonality * 0.3 +
            rolloff_score * 0.2 +
            zcr_score * 0.1
        )

        return np.clip(acousticness, 0, 1)

    def _calculate_instrumentalness(self, audio_data: np.ndarray, sr: int) -> float:
        """
        Calculate instrumentalness (0-1) - likelihood of no vocals.

        Uses vocal detection techniques inversely:
        - Low harmonic content in vocal frequency range
        - Absence of pitch-tracked melodic lines
        - Low spectral centroid variance (vocals vary)
        """
        # HPSS to separate harmonic (melodic/vocal) from percussive
        harmonic, _ = librosa.effects.hpss(audio_data)

        # Vocal frequency range analysis (80 Hz - 1100 Hz for human voice)
        stft = librosa.stft(audio_data)
        freqs = librosa.fft_frequencies(sr=sr)
        vocal_freq_mask = (freqs >= 80) & (freqs <= 1100)

        # Energy in vocal frequency range
        vocal_band_energy = np.sum(np.abs(stft[vocal_freq_mask, :]) ** 2)
        total_energy = np.sum(np.abs(stft) ** 2) + 1e-10
        vocal_ratio = vocal_band_energy / total_energy

        # Spectral centroid variance (vocals have high variance)
        centroid = librosa.feature.spectral_centroid(y=audio_data, sr=sr)[0]
        centroid_variance = np.std(centroid) / (np.mean(centroid) + 1e-10)

        # Harmonic energy in harmonic component (vocals are very harmonic)
        harmonic_energy_ratio = np.sum(harmonic ** 2) / (np.sum(audio_data ** 2) + 1e-10)

        # Inverse of vocal indicators
        instrumentalness = (
            (1 - np.clip(vocal_ratio * 3, 0, 1)) * 0.4 +
            (1 - np.clip(centroid_variance / 0.5, 0, 1)) * 0.3 +
            (1 - np.clip(harmonic_energy_ratio, 0, 1)) * 0.3
        )

        return np.clip(instrumentalness, 0, 1)

    def _calculate_liveness(self, audio_data: np.ndarray, sr: int) -> float:
        """
        Calculate liveness (0-1) - likelihood of live audience presence.

        Detects:
        - Audience noise (crowd ambience, applause, cheering)
        - Reverberation (large venue acoustics)
        - Background noise level
        """
        # Spectral flatness - live recordings have more ambient noise
        flatness = librosa.feature.spectral_flatness(y=audio_data)[0]
        noise_floor = np.mean(flatness)

        # RMS energy variance - live has more dynamic variation
        rms = librosa.feature.rms(y=audio_data)[0]
        energy_variance = np.std(rms) / (np.mean(rms) + 1e-10)

        # High-frequency content (crowd noise, applause)
        stft = librosa.stft(audio_data)
        freqs = librosa.fft_frequencies(sr=sr)
        high_freq_mask = freqs > 4000
        high_freq_energy = np.mean(np.abs(stft[high_freq_mask, :]))
        total_energy = np.mean(np.abs(stft)) + 1e-10
        high_freq_ratio = high_freq_energy / total_energy

        # Spectral flux (live recordings have more abrupt spectral changes)
        spectral_flux = np.mean(np.diff(np.abs(stft), axis=1) ** 2)

        # Weighted combination
        liveness = (
            np.clip(noise_floor * 5, 0, 1) * 0.3 +
            np.clip(energy_variance / 2, 0, 1) * 0.3 +
            np.clip(high_freq_ratio * 5, 0, 1) * 0.2 +
            np.clip(spectral_flux / 100, 0, 1) * 0.2
        )

        return np.clip(liveness, 0, 1)

    def _calculate_speechiness(self, audio_data: np.ndarray, sr: int) -> float:
        """
        Calculate speechiness (0-1) - likelihood of spoken words.

        Speech characteristics:
        - Moderate spectral centroid (1000-3000 Hz)
        - High zero-crossing rate
        - Low harmonic stability (speech is less tonal than singing)
        - Rhythmic patterns (syllabic)
        """
        # Spectral centroid - speech peaks around 1000-3000 Hz
        centroid = librosa.feature.spectral_centroid(y=audio_data, sr=sr)[0]
        centroid_mean = np.mean(centroid)

        # Speech typically 1000-3000 Hz
        if 1000 <= centroid_mean <= 3000:
            centroid_score = 1.0
        else:
            centroid_score = max(0, 1.0 - abs(centroid_mean - 2000) / 2000)

        # Zero-crossing rate - speech has higher ZCR than music
        zcr = librosa.feature.zero_crossing_rate(audio_data)[0]
        zcr_score = np.clip(np.mean(zcr) / 0.15, 0, 1)

        # Harmonic stability - speech is less stable than singing
        tonnetz = librosa.feature.tonnetz(y=audio_data, sr=sr)
        harmonic_instability = np.std(tonnetz)
        instability_score = np.clip(harmonic_instability / 0.5, 0, 1)

        # Spectral flatness - speech is flatter than music
        flatness = librosa.feature.spectral_flatness(y=audio_data)[0]
        flatness_score = np.mean(flatness)

        # MFCC variance - speech has distinct MFCC patterns
        mfccs = librosa.feature.mfcc(y=audio_data, sr=sr, n_mfcc=13)
        mfcc_variance = np.mean(np.std(mfccs, axis=1))
        mfcc_score = np.clip(mfcc_variance / 50, 0, 1)

        # Weighted combination
        speechiness = (
            centroid_score * 0.25 +
            zcr_score * 0.25 +
            instability_score * 0.2 +
            flatness_score * 0.15 +
            mfcc_score * 0.15
        )

        return np.clip(speechiness, 0, 1)

    def _detect_key(self, audio_data: np.ndarray, sr: int) -> Tuple[int, int, float]:
        """
        Detect musical key using chroma features.

        Returns:
            (key, mode, confidence) where:
            - key: 0-11 (C, C#, D, ..., B)
            - mode: 0 (minor) or 1 (major)
            - confidence: 0-1
        """
        # Compute chromagram
        chroma = librosa.feature.chroma_cqt(y=audio_data, sr=sr)

        # Average chroma over time
        chroma_mean = np.mean(chroma, axis=1)

        # Normalize
        chroma_mean = chroma_mean / (np.sum(chroma_mean) + 1e-10)

        # Major and minor key profiles (Krumhansl-Schmuckler)
        major_profile = np.array([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88])
        minor_profile = np.array([6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17])

        # Normalize profiles
        major_profile = major_profile / np.sum(major_profile)
        minor_profile = minor_profile / np.sum(minor_profile)

        # Correlate with all 12 keys in major and minor
        max_correlation = -1
        best_key = 0
        best_mode = 1

        for shift in range(12):
            # Rotate profiles
            major_rotated = np.roll(major_profile, shift)
            minor_rotated = np.roll(minor_profile, shift)

            # Correlation
            major_corr = np.corrcoef(chroma_mean, major_rotated)[0, 1]
            minor_corr = np.corrcoef(chroma_mean, minor_rotated)[0, 1]

            if major_corr > max_correlation:
                max_correlation = major_corr
                best_key = shift
                best_mode = 1

            if minor_corr > max_correlation:
                max_correlation = minor_corr
                best_key = shift
                best_mode = 0

        # Confidence is the correlation strength
        confidence = np.clip((max_correlation + 1) / 2, 0, 1)  # Map [-1,1] to [0,1]

        return best_key, best_mode, confidence


def analyze_advanced_features(audio_data: np.ndarray, sr: int, bpm: Optional[float] = None) -> Dict[str, Any]:
    """
    Convenience function to run all advanced analysis modules.

    Args:
        audio_data: Audio time series
        sr: Sample rate
        bpm: Optional BPM (will be detected if not provided)

    Returns:
        Dictionary containing all advanced features
    """
    analyzer = AdvancedAudioAnalyzer()

    timbre = analyzer.analyze_timbre(audio_data, sr)
    rhythm = analyzer.analyze_rhythm(audio_data, sr, bpm)
    mood = analyzer.analyze_mood(audio_data, sr, bpm)
    genre = analyzer.classify_genre(audio_data, sr, timbre, rhythm)

    # NEW: Add Spotify-equivalent features
    spotify_features = analyzer.analyze_spotify_equivalent_features(audio_data, sr, bpm)

    return {
        "timbre": timbre,
        "rhythm": rhythm,
        "mood": mood,
        "genre": genre,
        "spotify_features": spotify_features  # NEW
    }