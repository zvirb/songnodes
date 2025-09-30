"""
Breakdown Detection Module
Detects energy drops and breakdown sections in tracks
"""
import logging
from typing import List, Dict

import numpy as np
import librosa
from scipy.signal import find_peaks

logger = logging.getLogger(__name__)


class BreakdownDetector:
    """
    Detects breakdowns and energy drops in electronic music.

    Identifies sustained drops in energy that are characteristic
    of breakdown sections in dance music.
    """

    def __init__(
        self,
        frame_length: int = 2048,
        hop_length: int = 512,
        energy_drop_threshold: float = 0.4,
        min_breakdown_duration: float = 4.0
    ):
        """
        Initialize breakdown detector.

        Args:
            frame_length: Frame length for RMS calculation
            hop_length: Hop length for RMS calculation
            energy_drop_threshold: Relative drop in energy to detect breakdown
            min_breakdown_duration: Minimum breakdown duration in seconds
        """
        self.frame_length = frame_length
        self.hop_length = hop_length
        self.energy_drop_threshold = energy_drop_threshold
        self.min_breakdown_duration = min_breakdown_duration

    def detect(self, audio_data: np.ndarray, sample_rate: int) -> List[Dict[str, any]]:
        """
        Detect breakdown positions in audio.

        Args:
            audio_data: Audio waveform as numpy array
            sample_rate: Sample rate in Hz

        Returns:
            List of dicts with 'timestamp', 'duration', 'depth', 'type' keys
        """
        try:
            # Calculate RMS energy
            rms = librosa.feature.rms(
                y=audio_data,
                frame_length=self.frame_length,
                hop_length=self.hop_length
            )[0]

            # Smooth energy curve
            rms_smooth = self._smooth_curve(rms, window_size=10)

            # Normalize
            rms_normalized = rms_smooth / np.max(rms_smooth) if np.max(rms_smooth) > 0 else rms_smooth

            # Convert to time
            times = librosa.frames_to_time(
                np.arange(len(rms_normalized)),
                sr=sample_rate,
                hop_length=self.hop_length
            )

            # Detect energy drops
            breakdowns = self._detect_energy_drops(rms_normalized, times)

            logger.info(f"Detected {len(breakdowns)} breakdown sections")
            return breakdowns

        except Exception as e:
            logger.error(f"Error in breakdown detection: {e}")
            return []

    def _smooth_curve(self, curve: np.ndarray, window_size: int = 10) -> np.ndarray:
        """
        Smooth curve using moving average.

        Args:
            curve: Input curve
            window_size: Size of smoothing window

        Returns:
            Smoothed curve
        """
        if len(curve) < window_size:
            return curve

        kernel = np.ones(window_size) / window_size
        smoothed = np.convolve(curve, kernel, mode='same')
        return smoothed

    def _detect_energy_drops(
        self,
        energy: np.ndarray,
        times: np.ndarray
    ) -> List[Dict[str, any]]:
        """
        Detect sustained energy drops indicating breakdowns.

        Args:
            energy: Normalized energy curve
            times: Time points

        Returns:
            List of breakdown events
        """
        breakdowns = []

        # Find local maxima (energy peaks)
        peaks, _ = find_peaks(energy, distance=20, prominence=0.1)

        # Find local minima (energy valleys)
        valleys, _ = find_peaks(-energy, distance=20, prominence=0.1)

        if len(peaks) == 0 or len(valleys) == 0:
            return breakdowns

        # For each valley, check if it's a significant drop from nearby peaks
        for valley_idx in valleys:
            valley_time = times[valley_idx]
            valley_energy = energy[valley_idx]

            # Find nearby peaks before and after
            peaks_before = peaks[peaks < valley_idx]
            peaks_after = peaks[peaks > valley_idx]

            if len(peaks_before) == 0 and len(peaks_after) == 0:
                continue

            # Get closest peaks
            peak_before_energy = energy[peaks_before[-1]] if len(peaks_before) > 0 else 0
            peak_after_energy = energy[peaks_after[0]] if len(peaks_after) > 0 else 0

            # Calculate energy drop
            reference_energy = max(peak_before_energy, peak_after_energy)
            energy_drop = reference_energy - valley_energy

            # Check if drop is significant
            if energy_drop >= self.energy_drop_threshold:
                # Estimate breakdown duration
                duration = self._estimate_breakdown_duration(
                    valley_idx, energy, times
                )

                if duration >= self.min_breakdown_duration:
                    # Classify breakdown type
                    breakdown_type = self._classify_breakdown(energy_drop)

                    breakdowns.append({
                        'timestamp': float(valley_time),
                        'duration': float(duration),
                        'depth': float(energy_drop),
                        'type': breakdown_type
                    })

        return breakdowns

    def _estimate_breakdown_duration(
        self,
        valley_idx: int,
        energy: np.ndarray,
        times: np.ndarray
    ) -> float:
        """
        Estimate duration of breakdown section.

        Args:
            valley_idx: Index of energy valley
            energy: Energy curve
            times: Time points

        Returns:
            Estimated duration in seconds
        """
        valley_energy = energy[valley_idx]
        threshold = valley_energy + 0.1  # Energy must stay below this

        # Find start of breakdown (going backward)
        start_idx = valley_idx
        for i in range(valley_idx - 1, -1, -1):
            if energy[i] > threshold:
                start_idx = i + 1
                break
        else:
            start_idx = 0

        # Find end of breakdown (going forward)
        end_idx = valley_idx
        for i in range(valley_idx + 1, len(energy)):
            if energy[i] > threshold:
                end_idx = i - 1
                break
        else:
            end_idx = len(energy) - 1

        duration = times[end_idx] - times[start_idx]
        return duration

    def _classify_breakdown(self, energy_drop: float) -> str:
        """
        Classify breakdown by depth.

        Args:
            energy_drop: Magnitude of energy drop

        Returns:
            Breakdown type: 'minor', 'moderate', or 'major'
        """
        if energy_drop >= 0.7:
            return 'major'
        elif energy_drop >= 0.5:
            return 'moderate'
        else:
            return 'minor'