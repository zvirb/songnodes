"""
Serato Library Parser
Extracts BPM, key, and other metadata from Serato-tagged files and database
"""

import struct
import base64
from pathlib import Path
from typing import Dict, List, Optional, Any
from dataclasses import dataclass
from datetime import datetime

import structlog
from mutagen.id3 import ID3
from mutagen import File as MutagenFile

logger = structlog.get_logger(__name__)


@dataclass
class SeratoTrackMetadata:
    """Serato track metadata extracted from file tags or database"""
    file_path: str
    bpm: Optional[float] = None
    key: Optional[str] = None
    key_text: Optional[str] = None  # Text representation (e.g., "6A", "A Minor")
    auto_gain: Optional[float] = None
    beatgrid: Optional[Dict[str, Any]] = None
    cue_points: Optional[List[Dict[str, Any]]] = None
    loops: Optional[List[Dict[str, Any]]] = None
    has_serato_data: bool = False
    track_name: Optional[str] = None
    artist_name: Optional[str] = None
    duration_ms: Optional[int] = None
    analyzed_at: Optional[datetime] = None


class SeratoTagParser:
    """Parser for Serato GEOB (General Encapsulated Object) tags in ID3"""

    # Serato tag names
    SERATO_MARKERS = 'Serato Markers_'
    SERATO_MARKERS2 = 'Serato Markers2'
    SERATO_BEATGRID = 'Serato BeatGrid'
    SERATO_AUTOTAGS = 'Serato Autotags'
    SERATO_OVERVIEW = 'Serato Overview'

    @staticmethod
    def _decode_serato_color(data: bytes, offset: int) -> tuple:
        """Decode Serato color format (RGBA)"""
        if len(data) < offset + 4:
            return None, offset

        # Serato uses 0xFF00RRGGBB format
        color_bytes = data[offset:offset+4]
        r, g, b = color_bytes[1], color_bytes[2], color_bytes[3]
        return f"#{r:02x}{g:02x}{b:02x}", offset + 4

    @staticmethod
    def _decode_utf16_string(data: bytes, offset: int) -> tuple:
        """Decode UTF-16 encoded string"""
        try:
            # Find null terminator
            end = offset
            while end < len(data) - 1:
                if data[end] == 0 and data[end+1] == 0:
                    break
                end += 2

            string = data[offset:end].decode('utf-16-be')
            return string, end + 2
        except Exception as e:
            logger.warning(f"Failed to decode UTF-16 string: {e}")
            return None, offset

    @classmethod
    def parse_markers(cls, geob_data: bytes) -> Dict[str, Any]:
        """Parse Serato Markers_ tag (cue points)"""
        try:
            if not geob_data or len(geob_data) < 20:
                return {}

            # Skip header
            offset = 16
            cue_points = []

            while offset < len(geob_data) - 20:
                # Check for CUE entry (0x00 marker)
                if geob_data[offset] != 0x00:
                    break

                offset += 1

                # Position (4 bytes)
                position = struct.unpack('>I', geob_data[offset:offset+4])[0]
                offset += 4

                # Color
                color, offset = cls._decode_serato_color(geob_data, offset)

                # Label
                label, offset = cls._decode_utf16_string(geob_data, offset)

                cue_points.append({
                    'position_ms': position,
                    'color': color,
                    'label': label
                })

            return {'cue_points': cue_points}

        except Exception as e:
            logger.warning(f"Failed to parse Serato markers: {e}")
            return {}

    @classmethod
    def parse_markers2(cls, geob_data: bytes) -> Dict[str, Any]:
        """Parse Serato Markers2 tag (extended markers, loops)"""
        try:
            if not geob_data or len(geob_data) < 20:
                return {}

            # Markers2 uses base64 encoding
            decoded = base64.b64decode(geob_data)

            offset = 0
            cue_points = []
            loops = []
            bpm = None

            while offset < len(decoded) - 10:
                # Entry type
                entry_type = decoded[offset:offset+4]
                offset += 4

                # Entry length
                if offset + 4 > len(decoded):
                    break
                entry_len = struct.unpack('>I', decoded[offset:offset+4])[0]
                offset += 4

                if offset + entry_len > len(decoded):
                    break

                entry_data = decoded[offset:offset+entry_len]
                offset += entry_len

                # Parse based on entry type
                if entry_type == b'BPMK':  # BPM Lock
                    if len(entry_data) >= 4:
                        bpm = struct.unpack('>f', entry_data[0:4])[0]
                elif entry_type == b'CUE\x00':  # Cue point
                    # Parse cue point data
                    pass
                elif entry_type == b'LOOP':  # Loop
                    # Parse loop data
                    pass

            result = {}
            if cue_points:
                result['cue_points'] = cue_points
            if loops:
                result['loops'] = loops
            if bpm:
                result['bpm'] = bpm

            return result

        except Exception as e:
            logger.warning(f"Failed to parse Serato markers2: {e}")
            return {}

    @classmethod
    def parse_beatgrid(cls, geob_data: bytes) -> Optional[Dict[str, Any]]:
        """Parse Serato BeatGrid tag"""
        try:
            if not geob_data or len(geob_data) < 20:
                return None

            # Skip header (16 bytes)
            offset = 16

            # Terminal marker count (4 bytes)
            if offset + 4 > len(geob_data):
                return None

            terminal_count = struct.unpack('>I', geob_data[offset:offset+4])[0]
            offset += 4

            # Non-terminal marker count (4 bytes)
            if offset + 4 > len(geob_data):
                return None

            non_terminal_count = struct.unpack('>I', geob_data[offset:offset+4])[0]
            offset += 4

            markers = []
            total_markers = terminal_count + non_terminal_count

            for _ in range(total_markers):
                if offset + 8 > len(geob_data):
                    break

                position = struct.unpack('>f', geob_data[offset:offset+4])[0]
                beat_number = struct.unpack('>I', geob_data[offset+4:offset+8])[0]
                offset += 8

                markers.append({
                    'position': position,
                    'beat_number': beat_number
                })

            # Calculate BPM from beatgrid
            bpm = None
            if len(markers) >= 2:
                # BPM = (beat_diff / time_diff_seconds) * 60
                first = markers[0]
                last = markers[-1]
                time_diff = last['position'] - first['position']
                beat_diff = last['beat_number'] - first['beat_number']

                if time_diff > 0:
                    bpm = (beat_diff / time_diff) * 60

            return {
                'markers': markers,
                'bpm': bpm,
                'terminal_count': terminal_count,
                'non_terminal_count': non_terminal_count
            }

        except Exception as e:
            logger.warning(f"Failed to parse Serato beatgrid: {e}")
            return None

    @classmethod
    def parse_autotags(cls, geob_data: bytes) -> Dict[str, Any]:
        """Parse Serato Autotags (includes auto-gain, key)"""
        try:
            if not geob_data or len(geob_data) < 20:
                return {}

            # Autotags use base64 encoding
            decoded = base64.b64decode(geob_data)

            result = {}
            offset = 0

            while offset < len(decoded) - 10:
                # Tag type (4 bytes)
                tag_type = decoded[offset:offset+4]
                offset += 4

                # Tag length (4 bytes)
                if offset + 4 > len(decoded):
                    break
                tag_len = struct.unpack('>I', decoded[offset:offset+4])[0]
                offset += 4

                if offset + tag_len > len(decoded):
                    break

                tag_data = decoded[offset:offset+tag_len]
                offset += tag_len

                # Parse based on tag type
                if tag_type == b'TKEY':  # Musical key
                    if len(tag_data) >= 2:
                        key_value = struct.unpack('>H', tag_data[0:2])[0]
                        # Convert to key name (Serato uses 0-25 for keys)
                        result['key_value'] = key_value
                elif tag_type == b'TGAI':  # Auto gain
                    if len(tag_data) >= 4:
                        gain = struct.unpack('>f', tag_data[0:4])[0]
                        result['auto_gain'] = gain
                elif tag_type == b'TBPM':  # BPM
                    if len(tag_data) >= 4:
                        bpm = struct.unpack('>f', tag_data[0:4])[0]
                        result['bpm'] = bpm

            return result

        except Exception as e:
            logger.warning(f"Failed to parse Serato autotags: {e}")
            return {}


class SeratoFileParser:
    """Extract Serato metadata from audio file ID3 tags"""

    # Camelot to musical key mapping
    CAMELOT_TO_KEY = {
        '1A': 'Ab minor', '1B': 'B major',
        '2A': 'Eb minor', '2B': 'F# major',
        '3A': 'Bb minor', '3B': 'Db major',
        '4A': 'F minor', '4B': 'Ab major',
        '5A': 'C minor', '5B': 'Eb major',
        '6A': 'G minor', '6B': 'Bb major',
        '7A': 'D minor', '7B': 'F major',
        '8A': 'A minor', '8B': 'C major',
        '9A': 'E minor', '9B': 'G major',
        '10A': 'B minor', '10B': 'D major',
        '11A': 'F# minor', '11B': 'A major',
        '12A': 'C# minor', '12B': 'E major',
    }

    def __init__(self):
        self.tag_parser = SeratoTagParser()

    def extract_metadata(self, file_path: Path) -> Optional[SeratoTrackMetadata]:
        """
        Extract Serato metadata from an audio file's ID3 tags

        Args:
            file_path: Path to audio file

        Returns:
            SeratoTrackMetadata object with extracted data, or None if no Serato data found
        """
        try:
            if not file_path.exists():
                logger.warning(f"File not found: {file_path}")
                return None

            # Try to load ID3 tags
            try:
                tags = ID3(str(file_path))
            except Exception as e:
                logger.debug(f"No ID3 tags in file {file_path}: {e}")
                return None

            # Initialize metadata
            metadata = SeratoTrackMetadata(file_path=str(file_path))

            # Extract basic file info using mutagen
            try:
                audio = MutagenFile(str(file_path))
                if audio:
                    if hasattr(audio.info, 'length'):
                        metadata.duration_ms = int(audio.info.length * 1000)

                    # Try to get track/artist from tags
                    if 'TIT2' in tags:  # Title
                        metadata.track_name = str(tags['TIT2'])
                    if 'TPE1' in tags:  # Artist
                        metadata.artist_name = str(tags['TPE1'])
            except Exception as e:
                logger.debug(f"Failed to extract basic file info: {e}")

            # Look for Serato GEOB tags
            has_serato = False

            for key, value in tags.items():
                if not key.startswith('GEOB:'):
                    continue

                # Extract GEOB description
                geob_desc = key.split(':', 1)[1] if ':' in key else ''

                if not geob_desc.startswith('Serato '):
                    continue

                has_serato = True
                geob_data = value.data

                # Parse based on tag type
                if SeratoTagParser.SERATO_MARKERS in geob_desc:
                    markers = self.tag_parser.parse_markers(geob_data)
                    if 'cue_points' in markers:
                        metadata.cue_points = markers['cue_points']

                elif SeratoTagParser.SERATO_MARKERS2 in geob_desc:
                    markers2 = self.tag_parser.parse_markers2(geob_data)
                    if 'bpm' in markers2 and not metadata.bpm:
                        metadata.bpm = markers2['bpm']
                    if 'cue_points' in markers2:
                        metadata.cue_points = markers2['cue_points']
                    if 'loops' in markers2:
                        metadata.loops = markers2['loops']

                elif SeratoTagParser.SERATO_BEATGRID in geob_desc:
                    beatgrid = self.tag_parser.parse_beatgrid(geob_data)
                    if beatgrid:
                        metadata.beatgrid = beatgrid
                        # Prefer beatgrid BPM (more accurate)
                        if 'bpm' in beatgrid and beatgrid['bpm']:
                            metadata.bpm = beatgrid['bpm']

                elif SeratoTagParser.SERATO_AUTOTAGS in geob_desc:
                    autotags = self.tag_parser.parse_autotags(geob_data)
                    if 'bpm' in autotags and not metadata.bpm:
                        metadata.bpm = autotags['bpm']
                    if 'auto_gain' in autotags:
                        metadata.auto_gain = autotags['auto_gain']
                    if 'key_value' in autotags:
                        # Convert Serato key value to key name
                        key_val = autotags['key_value']
                        camelot_key = self._serato_key_to_camelot(key_val)
                        metadata.key_text = camelot_key
                        if camelot_key in self.CAMELOT_TO_KEY:
                            metadata.key = self.CAMELOT_TO_KEY[camelot_key]

            if has_serato:
                metadata.has_serato_data = True
                metadata.analyzed_at = datetime.now()
                logger.info(f"Extracted Serato metadata from {file_path.name}", bpm=metadata.bpm, key=metadata.key)
                return metadata

            return None

        except Exception as e:
            logger.error(f"Failed to extract Serato metadata from {file_path}: {e}")
            return None

    @staticmethod
    def _serato_key_to_camelot(key_value: int) -> str:
        """Convert Serato key value (0-25) to Camelot notation"""
        if key_value < 0 or key_value > 25:
            return None

        # Serato uses 0-11 for minor (A), 12-23 for major (B)
        # 0 = 8A, 1 = 9A, ..., 11 = 7A
        # 12 = 8B, 13 = 9B, ..., 23 = 7B

        if key_value < 12:
            # Minor keys (A)
            camelot_num = ((key_value + 7) % 12) + 1
            return f"{camelot_num}A"
        else:
            # Major keys (B)
            camelot_num = ((key_value - 12 + 7) % 12) + 1
            return f"{camelot_num}B"


class SeratoDatabaseParser:
    """Parse Serato Database V2 file"""

    def __init__(self, serato_dir: Path):
        """
        Initialize parser

        Args:
            serato_dir: Path to Serato library directory (e.g., ~/Music/_Serato_/)
        """
        self.serato_dir = serato_dir
        self.database_file = serato_dir / "database V2"

    def parse(self) -> List[SeratoTrackMetadata]:
        """
        Parse Serato database and extract track metadata

        Returns:
            List of SeratoTrackMetadata objects
        """
        if not self.database_file.exists():
            logger.error(f"Serato database not found: {self.database_file}")
            return []

        logger.info(f"Parsing Serato database: {self.database_file}")

        # TODO: Implement database parsing
        # Note: Serato Database V2 is encrypted/obfuscated
        # For now, we'll rely on file tag extraction which is more reliable

        logger.warning("Serato database parsing not yet implemented - use file tag extraction instead")
        return []
