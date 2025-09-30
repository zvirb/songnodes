"""
Vocal Detection Module
Detects vocal presence and segments using harmonic-percussive separation
"""
import logging
from typing import List, Dict

import numpy as np
import librosa

logger = logging.getLogger(__name__)


class VocalDetector:
    """
    Detects vocal segments in audio using harmonic-percussive source separation.

    Uses librosa's HPSS to isolate harmonic content, then applies
    spectral analysis to identify vocal characteristics.
    """

    def __init__(
        self,
        frame_length: int = 2048,
        hop_length: int = 512,
        harmonic_threshold: float = 0.3,
        min_segment_duration: float = 1.0
    ):
        """
        Initialize vocal detector.

        Args:
            frame_length: Frame length for STFT
            hop_length: Hop length for STFT
            harmonic_threshold: Threshold for detecting harmonic content
            min_segment_duration: Minimum duration of a vocal segment in seconds
        """
        self.frame_length = frame_length
        self.hop_length = hop_length
        self.harmonic_threshold = harmonic_threshold
        self.min_segment_duration = min_segment_duration

    def detect(self, audio_data: np.ndarray, sample_rate: int) -> List[Dict[str, any]]:
        """
        Detect vocal segments in audio.

        Args:
            audio_data: Audio waveform as numpy array
            sample_rate: Sample rate in Hz

        Returns:
            List of dicts with 'start_time', 'end_time', 'confidence', 'type' keys
        """
        try:
            # Perform harmonic-percussive source separation
            harmonic, percussive = librosa.effects.hpss(audio_data)

            # Analyze harmonic component for vocal characteristics
            vocal_segments = self._analyze_harmonic_component(harmonic, sample_rate)

            # Classify track type
            track_type = self._classify_track_type(vocal_segments, sample_rate)

            logger.info(f"Detected {len(vocal_segments)} vocal segments, track type: {track_type}")
            return vocal_segments

        except Exception as e:
            logger.error(f"Error in vocal detection: {e}")
            return []

    def _analyze_harmonic_component(
        self,
        harmonic: np.ndarray,
        sample_rate: int
    ) -> List[Dict[str, any]]:
        """
        Analyze harmonic component to detect vocal segments.

        Args:
            harmonic: Harmonic component from HPSS
            sample_rate: Sample rate in Hz

        Returns:
            List of vocal segments
        """
        # Calculate spectral centroid (brightness indicator)
        spectral_centroid = librosa.feature.spectral_centroid(
            y=harmonic,
            sr=sample_rate,
            n_fft=self.frame_length,
            hop_length=self.hop_length
        )[0]

        # Calculate RMS energy of harmonic component
        harmonic_rms = librosa.feature.rms(
            y=harmonic,
            frame_length=self.frame_length,
            hop_length=self.hop_length
        )[0]

        # Normalize
        harmonic_rms_norm = harmonic_rms / np.max(harmonic_rms) if np.max(harmonic_rms) > 0 else harmonic_rms

        # Convert to time
        times = librosa.frames_to_time(
            np.arange(len(harmonic_rms)),
            sr=sample_rate,
            hop_length=self.hop_length
        )

        # Detect vocal-like segments
        # Vocals typically have higher spectral centroid and sustained harmonic energy
        vocal_mask = (harmonic_rms_norm > self.harmonic_threshold)

        # Find contiguous segments
        segments = self._extract_segments(vocal_mask, times)

        # Add confidence scores based on spectral characteristics
        for segment in segments:
            start_idx = np.argmin(np.abs(times - segment['start_time']))
            end_idx = np.argmin(np.abs(times - segment['end_time']))

            # Calculate average spectral centroid for this segment
            avg_centroid = np.mean(spectral_centroid[start_idx:end_idx])

            # Human voice typically has centroid between 1000-4000 Hz
            # Higher confidence if in this range
            confidence = self._calculate_vocal_confidence(avg_centroid, sample_rate)
            segment['confidence'] = confidence
            segment['type'] = 'vocal' if confidence > 0.5 else 'melodic'

        return segments

    def _extract_segments(self, mask: np.ndarray, times: np.ndarray) -> List[Dict[str, float]]:
        """
        Extract contiguous segments from boolean mask.

        Args:
            mask: Boolean mask indicating vocal frames
            times: Time points corresponding to mask

        Returns:
            List of segments with start_time and end_time
        """
        segments = []
        in_segment = False
        start_time = 0.0

        for i, is_vocal in enumerate(mask):
            if is_vocal and not in_segment:
                # Start new segment
                start_time = times[i]
                in_segment = True
            elif not is_vocal and in_segment:
                # End segment
                end_time = times[i - 1]
                duration = end_time - start_time

                if duration >= self.min_segment_duration:
                    segments.append({
                        'start_time': float(start_time),
                        'end_time': float(end_time),
                        'duration': float(duration)
                    })
                in_segment = False

        # Handle case where segment extends to end
        if in_segment:
            end_time = times[-1]
            duration = end_time - start_time
            if duration >= self.min_segment_duration:
                segments.append({
                    'start_time': float(start_time),
                    'end_time': float(end_time),
                    'duration': float(duration)
                })

        return segments

    def _calculate_vocal_confidence(self, centroid: float, sample_rate: int) -> float:
        """
        Calculate confidence that segment contains vocals based on spectral centroid.

        Args:
            centroid: Average spectral centroid
            sample_rate: Sample rate in Hz

        Returns:
            Confidence score between 0 and 1
        """
        # Typical vocal range: 1000-4000 Hz
        # Map centroid to confidence score
        optimal_centroid = 2500.0  # Hz, rough center of vocal range

        # Calculate distance from optimal
        distance = abs(centroid - optimal_centroid)

        # Convert to confidence (exponential decay)
        confidence = np.exp(-distance / 2000.0)

        return float(np.clip(confidence, 0.0, 1.0))

    def _classify_track_type(
        self,
        vocal_segments: List[Dict[str, any]],
        sample_rate: int
    ) -> str:
        """
        Classify track as instrumental or vocal-heavy.

        Args:
            vocal_segments: List of detected vocal segments
            sample_rate: Sample rate in Hz

        Returns:
            'instrumental', 'vocal', or 'mixed'
        """
        if not vocal_segments:
            return 'instrumental'

        # Calculate total duration of vocal segments
        total_vocal_duration = sum(seg['duration'] for seg in vocal_segments)

        # Rough estimate: tracks are typically 30 seconds (Spotify preview)
        # If >50% has vocals, classify as vocal-heavy
        if total_vocal_duration > 15.0:
            return 'vocal'
        elif total_vocal_duration > 5.0:
            return 'mixed'
        else:
            return 'instrumental'