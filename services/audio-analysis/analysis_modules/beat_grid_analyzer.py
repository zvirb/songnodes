"""
Beat Grid Analysis Module
Analyzes beat positions and tempo for DJ mixing applications
"""
import logging
from typing import Tuple, List, Dict

import numpy as np
import librosa

logger = logging.getLogger(__name__)


class BeatGridAnalyzer:
    """
    Analyzes beat grid and tempo for DJ applications.

    Extracts precise beat positions and estimates tempo using
    librosa's beat tracking algorithms.
    """

    def __init__(self, units: str = 'time'):
        """
        Initialize beat grid analyzer.

        Args:
            units: Units for beat positions ('time' or 'frames')
        """
        self.units = units

    def analyze(self, audio_data: np.ndarray, sample_rate: int) -> Tuple[List[Dict[str, float]], float]:
        """
        Analyze beat grid and tempo.

        Args:
            audio_data: Audio waveform as numpy array
            sample_rate: Sample rate in Hz

        Returns:
            Tuple of (beat_grid, bpm)
            - beat_grid: List of dicts with 'position', 'confidence' keys
            - bpm: Estimated tempo in BPM
        """
        try:
            # Estimate tempo
            tempo, beat_frames = librosa.beat.beat_track(
                y=audio_data,
                sr=sample_rate,
                units='frames'
            )

            # Convert to time if needed
            if self.units == 'time':
                beat_times = librosa.frames_to_time(beat_frames, sr=sample_rate)
            else:
                beat_times = beat_frames

            # Build beat grid with confidence scores
            beat_grid = self._build_beat_grid(beat_times, tempo)

            # Validate and refine BPM
            bpm = self._refine_bpm(beat_times, tempo)

            logger.info(f"Detected {len(beat_grid)} beats, tempo: {bpm:.2f} BPM")
            return beat_grid, bpm

        except Exception as e:
            logger.error(f"Error in beat grid analysis: {e}")
            return [], 0.0

    def _build_beat_grid(self, beat_positions: np.ndarray, tempo: float) -> List[Dict[str, float]]:
        """
        Build beat grid with confidence scores.

        Args:
            beat_positions: Array of beat positions (time or frames)
            tempo: Estimated tempo in BPM

        Returns:
            List of beat events with positions and confidence
        """
        beat_grid = []

        # Calculate beat intervals
        if len(beat_positions) > 1:
            intervals = np.diff(beat_positions)
            expected_interval = 60.0 / tempo if tempo > 0 else np.median(intervals)

            # Assign confidence based on deviation from expected interval
            for i, position in enumerate(beat_positions):
                if i == 0:
                    confidence = 1.0  # First beat always high confidence
                else:
                    actual_interval = beat_positions[i] - beat_positions[i - 1]
                    deviation = abs(actual_interval - expected_interval) / expected_interval
                    confidence = max(0.0, 1.0 - deviation)

                beat_grid.append({
                    'position': float(position),
                    'confidence': float(confidence),
                    'beat_number': i + 1
                })
        else:
            # Single or no beats detected
            for i, position in enumerate(beat_positions):
                beat_grid.append({
                    'position': float(position),
                    'confidence': 0.5,  # Lower confidence for sparse detections
                    'beat_number': i + 1
                })

        return beat_grid

    def _refine_bpm(self, beat_positions: np.ndarray, initial_tempo: float) -> float:
        """
        Refine BPM estimate using beat intervals.

        Args:
            beat_positions: Array of beat positions
            initial_tempo: Initial tempo estimate from beat_track

        Returns:
            Refined BPM estimate
        """
        if len(beat_positions) < 2:
            return float(initial_tempo)

        # Calculate intervals between beats
        intervals = np.diff(beat_positions)

        # Remove outliers (beats that are way off)
        median_interval = np.median(intervals)
        valid_intervals = intervals[
            (intervals > median_interval * 0.5) &
            (intervals < median_interval * 1.5)
        ]

        if len(valid_intervals) == 0:
            return float(initial_tempo)

        # Calculate refined BPM from mean interval
        mean_interval = np.mean(valid_intervals)
        refined_bpm = 60.0 / mean_interval

        # Common tempo multiples/divisions (handle double-time/half-time)
        # If detected tempo is around 2x or 0.5x the typical range, adjust
        if refined_bpm < 60:
            refined_bpm *= 2  # Likely detected half-time
        elif refined_bpm > 200:
            refined_bpm /= 2  # Likely detected double-time

        return float(refined_bpm)

    def estimate_downbeats(
        self,
        audio_data: np.ndarray,
        sample_rate: int,
        beat_positions: np.ndarray
    ) -> List[int]:
        """
        Estimate downbeat positions (first beat of bar).

        Args:
            audio_data: Audio waveform
            sample_rate: Sample rate in Hz
            beat_positions: Detected beat positions

        Returns:
            List of downbeat indices
        """
        try:
            # Use onset strength to identify stronger beats
            onset_env = librosa.onset.onset_strength(
                y=audio_data,
                sr=sample_rate
            )

            # Convert beat positions to frames
            if self.units == 'time':
                beat_frames = librosa.time_to_frames(beat_positions, sr=sample_rate)
            else:
                beat_frames = beat_positions

            # Get onset strength at each beat
            beat_strengths = onset_env[beat_frames.astype(int)]

            # Assume 4/4 time signature (most common in electronic music)
            # Downbeats typically occur every 4 beats
            downbeats = []
            for i in range(0, len(beat_frames), 4):
                if i < len(beat_frames):
                    # Find strongest beat in this group of 4
                    group_end = min(i + 4, len(beat_frames))
                    group_strengths = beat_strengths[i:group_end]
                    strongest_idx = i + np.argmax(group_strengths)
                    downbeats.append(int(strongest_idx))

            return downbeats

        except Exception as e:
            logger.error(f"Error estimating downbeats: {e}")
            return []