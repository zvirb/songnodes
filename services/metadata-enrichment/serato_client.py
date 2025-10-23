"""
Serato Client for Enrichment Pipeline
Extracts metadata from Serato-tagged audio files
"""

import sys
from pathlib import Path
from typing import Dict, Optional, Any
import structlog

# Add serato-integration to path
sys.path.append('/app/serato-integration')

try:
    from serato_parser import SeratoFileParser, SeratoTrackMetadata
except ImportError:
    # If running locally without Docker
    try:
        sys.path.append('../serato-integration')
        from serato_parser import SeratoFileParser, SeratoTrackMetadata
    except ImportError:
        SeratoFileParser = None
        SeratoTrackMetadata = None

logger = structlog.get_logger(__name__)


class SeratoClient:
    """
    Client for extracting Serato metadata from audio file tags

    Unlike other enrichment clients (Spotify, MusicBrainz, etc.) that query APIs,
    this client reads metadata directly from local audio files that have been
    analyzed by Serato Pro DJ software.

    Serato stores metadata in ID3 GEOB (General Encapsulated Object) tags:
    - BPM from beatgrid analysis (sub-beat accuracy)
    - Musical key from Serato's key detection
    - Camelot notation (DJ-friendly key system)
    - Cue points and loops
    - Auto-gain values

    This client is typically used in two scenarios:
    1. Batch import: Scan music library and extract Serato data
    2. Real-time enrichment: Extract Serato data during track enrichment if file_path available
    """

    def __init__(self):
        """Initialize Serato client with file parser"""
        if SeratoFileParser is None:
            logger.warning(
                "SeratoFileParser not available - Serato enrichment disabled",
                error="serato_parser module not found"
            )
            self.parser = None
        else:
            self.parser = SeratoFileParser()
            logger.info("Serato client initialized successfully")

    def is_available(self) -> bool:
        """Check if Serato parser is available"""
        return self.parser is not None

    async def extract_from_file(self, file_path: str) -> Optional[Dict[str, Any]]:
        """
        Extract Serato metadata from an audio file

        Args:
            file_path: Absolute path to audio file

        Returns:
            Dictionary with Serato metadata, or None if no Serato data found

        Example return value:
        {
            'serato_bpm': 128.0,
            'serato_key': 'A Minor',
            'serato_key_text': '8A',
            'serato_auto_gain': -2.5,
            'serato_beatgrid': {'markers': [...], 'bpm': 128.0},
            'serato_cues': [{'position_ms': 1000, 'color': '#FF0000', 'label': 'Drop'}],
            'serato_loops': [{'start_ms': 1000, 'end_ms': 5000}],
            'serato_analyzed_at': '2025-10-23T12:00:00Z'
        }
        """
        if not self.parser:
            logger.warning("Serato parser not available")
            return None

        try:
            path = Path(file_path)

            if not path.exists():
                logger.warning(f"File not found", file_path=file_path)
                return None

            if not path.is_file():
                logger.warning(f"Path is not a file", file_path=file_path)
                return None

            # Extract Serato metadata using parser
            metadata: SeratoTrackMetadata = self.parser.extract_metadata(path)

            if not metadata or not metadata.has_serato_data:
                logger.debug(f"No Serato data in file", file_path=file_path)
                return None

            # Convert to enrichment format
            enrichment_data = {
                'serato_bpm': metadata.bpm,
                'serato_key': metadata.key,
                'serato_key_text': metadata.key_text,
                'serato_auto_gain': metadata.auto_gain,
                'serato_beatgrid': metadata.beatgrid,
                'serato_cues': metadata.cue_points,
                'serato_loops': metadata.loops,
                'serato_analyzed_at': metadata.analyzed_at.isoformat() if metadata.analyzed_at else None
            }

            # Remove None values
            enrichment_data = {k: v for k, v in enrichment_data.items() if v is not None}

            logger.info(
                "Extracted Serato metadata from file",
                file_path=file_path,
                bpm=metadata.bpm,
                key=metadata.key_text,
                has_cues=bool(metadata.cue_points),
                has_loops=bool(metadata.loops)
            )

            return enrichment_data

        except Exception as e:
            logger.error(
                f"Failed to extract Serato metadata from file",
                file_path=file_path,
                error=str(e)
            )
            return None

    async def get_track_metadata_summary(self, file_path: str) -> Dict[str, Any]:
        """
        Get a summary of Serato metadata availability

        Args:
            file_path: Absolute path to audio file

        Returns:
            Summary dictionary with boolean flags

        Example:
        {
            'has_serato_data': True,
            'has_bpm': True,
            'has_key': True,
            'has_beatgrid': True,
            'has_cues': True,
            'has_loops': False
        }
        """
        if not self.parser:
            return {
                'has_serato_data': False,
                'error': 'Serato parser not available'
            }

        try:
            path = Path(file_path)
            if not path.exists():
                return {
                    'has_serato_data': False,
                    'error': 'File not found'
                }

            metadata: SeratoTrackMetadata = self.parser.extract_metadata(path)

            if not metadata:
                return {
                    'has_serato_data': False
                }

            return {
                'has_serato_data': metadata.has_serato_data,
                'has_bpm': metadata.bpm is not None,
                'has_key': metadata.key is not None,
                'has_beatgrid': metadata.beatgrid is not None,
                'has_cues': bool(metadata.cue_points),
                'has_loops': bool(metadata.loops),
                'analyzed_at': metadata.analyzed_at.isoformat() if metadata.analyzed_at else None
            }

        except Exception as e:
            return {
                'has_serato_data': False,
                'error': str(e)
            }
