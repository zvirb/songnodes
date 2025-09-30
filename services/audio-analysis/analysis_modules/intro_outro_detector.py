"""
Intro/Outro Detection Module
Detects beat-only intro and outro sections using energy analysis
"""
import logging
from typing import Tuple, List, Dict

import numpy as np
import librosa

logger = logging.getLogger(__name__)


class IntroOutroDetector:
    """
    Detects intro and outro durations for DJ mixing purposes.

    Uses RMS energy analysis to identify:
    - Intro: Time until energy exceeds threshold (first kick drum)
    - Outro: Time from last energy peak to end
    """

    def __init__(
        self,
        frame_length: int = 2048,
        hop_length: int = 512,
        energy_threshold: float = 0.02,
        min_intro_duration: float = 0.5,
        min_outro_duration: float = 0.5
    ):
        """
        Initialize intro/outro detector.

        Args:
            frame_length: Frame length for RMS calculation
            hop_length: Hop length for RMS calculation
            energy_threshold: Threshold for detecting energy onset (relative to max)
            min_intro_duration: Minimum intro duration in seconds
            min_outro_duration: Minimum outro duration in seconds
        """
        self.frame_length = frame_length
        self.hop_length = hop_length
        self.energy_threshold = energy_threshold
        self.min_intro_duration = min_intro_duration
        self.min_outro_duration = min_outro_duration

    def detect(self, audio_data: np.ndarray, sample_rate: int) -> Tuple[float, float]:
        """
        Detect intro and outro durations.

        Args:
            audio_data: Audio waveform as numpy array
            sample_rate: Sample rate in Hz

        Returns:
            Tuple of (intro_duration, outro_duration) in seconds
        """
        try:
            # Calculate RMS energy
            rms = librosa.feature.rms(
                y=audio_data,
                frame_length=self.frame_length,
                hop_length=self.hop_length
            )[0]

            # Normalize RMS to [0, 1]
            rms_normalized = rms / np.max(rms) if np.max(rms) > 0 else rms

            # Convert frame indices to time
            times = librosa.frames_to_time(
                np.arange(len(rms)),
                sr=sample_rate,
                hop_length=self.hop_length
            )

            # Detect intro
            intro_duration = self._detect_intro(rms_normalized, times)

            # Detect outro
            outro_duration = self._detect_outro(rms_normalized, times)

            logger.info(f"Detected intro: {intro_duration:.2f}s, outro: {outro_duration:.2f}s")
            return intro_duration, outro_duration

        except Exception as e:
            logger.error(f"Error in intro/outro detection: {e}")
            return 0.0, 0.0

    def _detect_intro(self, rms_normalized: np.ndarray, times: np.ndarray) -> float:
        """
        Detect intro duration.

        Finds the first point where energy consistently exceeds threshold.

        Args:
            rms_normalized: Normalized RMS energy
            times: Time points corresponding to RMS frames

        Returns:
            Intro duration in seconds
        """
        # Find first point where energy exceeds threshold
        energy_indices = np.where(rms_normalized > self.energy_threshold)[0]

        if len(energy_indices) == 0:
            return 0.0

        # First sustained energy point
        intro_end_frame = energy_indices[0]

        # Verify it's sustained (next few frames also exceed threshold)
        sustained_frames = 5
        if intro_end_frame + sustained_frames < len(rms_normalized):
            if np.all(rms_normalized[intro_end_frame:intro_end_frame + sustained_frames] > self.energy_threshold):
                intro_duration = times[intro_end_frame]
                return max(intro_duration, self.min_intro_duration)

        return max(times[intro_end_frame], self.min_intro_duration)

    def _detect_outro(self, rms_normalized: np.ndarray, times: np.ndarray) -> float:
        """
        Detect outro duration.

        Finds the last significant energy peak and measures time to end.

        Args:
            rms_normalized: Normalized RMS energy
            times: Time points corresponding to RMS frames

        Returns:
            Outro duration in seconds
        """
        # Find last point where energy exceeds threshold
        energy_indices = np.where(rms_normalized > self.energy_threshold)[0]

        if len(energy_indices) == 0:
            return 0.0

        # Last sustained energy point
        outro_start_frame = energy_indices[-1]

        # Calculate duration from this point to end
        total_duration = times[-1]
        outro_duration = total_duration - times[outro_start_frame]

        return max(outro_duration, self.min_outro_duration)

    def calculate_energy_curve(
        self,
        audio_data: np.ndarray,
        sample_rate: int,
        num_points: int = 100
    ) -> List[Dict[str, float]]:
        """
        Calculate energy curve for the entire track.

        Args:
            audio_data: Audio waveform as numpy array
            sample_rate: Sample rate in Hz
            num_points: Number of points in the energy curve

        Returns:
            List of dicts with 'time' and 'energy' keys
        """
        try:
            # Calculate RMS energy with shorter frames for better resolution
            rms = librosa.feature.rms(
                y=audio_data,
                frame_length=self.frame_length,
                hop_length=self.hop_length
            )[0]

            # Normalize
            rms_normalized = rms / np.max(rms) if np.max(rms) > 0 else rms

            # Get time points
            times = librosa.frames_to_time(
                np.arange(len(rms)),
                sr=sample_rate,
                hop_length=self.hop_length
            )

            # Downsample to num_points for storage efficiency
            if len(times) > num_points:
                indices = np.linspace(0, len(times) - 1, num_points, dtype=int)
                times = times[indices]
                rms_normalized = rms_normalized[indices]

            # Build energy curve
            energy_curve = [
                {"time": float(t), "energy": float(e)}
                for t, e in zip(times, rms_normalized)
            ]

            return energy_curve

        except Exception as e:
            logger.error(f"Error calculating energy curve: {e}")
            return []