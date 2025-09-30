"""
Audio Fetcher Module
Downloads audio from Spotify preview URLs or MinIO storage
"""
import logging
import tempfile
import os
from typing import Optional, Tuple

import httpx
import librosa
import numpy as np

logger = logging.getLogger(__name__)


class AudioFetcher:
    """Fetches audio from various sources for analysis"""

    def __init__(self):
        self.http_client = httpx.AsyncClient(timeout=30.0)
        self.minio_endpoint = os.getenv('MINIO_ENDPOINT', 'http://minio:9000')
        self.minio_access_key = os.getenv('MINIO_ACCESS_KEY', 'minioadmin')
        self.minio_secret_key = os.getenv('MINIO_SECRET_KEY', 'minioadmin')

    async def fetch_audio(
        self,
        spotify_preview_url: Optional[str] = None,
        audio_file_path: Optional[str] = None
    ) -> Tuple[Optional[np.ndarray], Optional[int]]:
        """
        Fetch audio from Spotify preview or MinIO storage.

        Args:
            spotify_preview_url: Spotify 30-second preview URL
            audio_file_path: Path to audio file in MinIO

        Returns:
            Tuple of (audio_data, sample_rate) or (None, None) if failed
        """
        # Try Spotify preview first (most common case)
        if spotify_preview_url:
            try:
                audio_data, sample_rate = await self._fetch_from_spotify(spotify_preview_url)
                if audio_data is not None:
                    logger.info("Successfully fetched audio from Spotify preview")
                    return audio_data, sample_rate
            except Exception as e:
                logger.warning(f"Failed to fetch from Spotify: {e}")

        # Fallback to MinIO if available
        if audio_file_path:
            try:
                audio_data, sample_rate = await self._fetch_from_minio(audio_file_path)
                if audio_data is not None:
                    logger.info("Successfully fetched audio from MinIO")
                    return audio_data, sample_rate
            except Exception as e:
                logger.warning(f"Failed to fetch from MinIO: {e}")

        logger.error("Failed to fetch audio from any source")
        return None, None

    async def _fetch_from_spotify(self, preview_url: str) -> Tuple[Optional[np.ndarray], Optional[int]]:
        """
        Download audio from Spotify preview URL.

        Args:
            preview_url: Spotify preview MP3 URL

        Returns:
            Tuple of (audio_data, sample_rate)
        """
        try:
            # Download preview
            response = await self.http_client.get(preview_url)
            response.raise_for_status()

            # Write to temporary file
            with tempfile.NamedTemporaryFile(suffix='.mp3', delete=False) as temp_file:
                temp_file.write(response.content)
                temp_path = temp_file.name

            try:
                # Load with librosa
                audio_data, sample_rate = librosa.load(temp_path, sr=22050, mono=True)
                return audio_data, sample_rate
            finally:
                # Clean up temp file
                if os.path.exists(temp_path):
                    os.unlink(temp_path)

        except Exception as e:
            logger.error(f"Error fetching from Spotify: {e}")
            return None, None

    async def _fetch_from_minio(self, file_path: str) -> Tuple[Optional[np.ndarray], Optional[int]]:
        """
        Download audio from MinIO object storage.

        Args:
            file_path: Path to audio file in MinIO bucket

        Returns:
            Tuple of (audio_data, sample_rate)
        """
        try:
            # Construct MinIO URL
            # Assuming bucket name is 'audio' and file_path is relative
            url = f"{self.minio_endpoint}/audio/{file_path}"

            # Download file
            response = await self.http_client.get(
                url,
                auth=(self.minio_access_key, self.minio_secret_key)
            )
            response.raise_for_status()

            # Write to temporary file
            suffix = os.path.splitext(file_path)[1] or '.mp3'
            with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as temp_file:
                temp_file.write(response.content)
                temp_path = temp_file.name

            try:
                # Load with librosa
                audio_data, sample_rate = librosa.load(temp_path, sr=22050, mono=True)
                return audio_data, sample_rate
            finally:
                # Clean up temp file
                if os.path.exists(temp_path):
                    os.unlink(temp_path)

        except Exception as e:
            logger.error(f"Error fetching from MinIO: {e}")
            return None, None

    async def close(self):
        """Close HTTP client"""
        await self.http_client.aclose()