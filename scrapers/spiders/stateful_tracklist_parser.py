"""
Stateful Tracklist Parser - Section 1.3 Framework Implementation
=================================================================

Implements the state machine algorithm for parsing multi-line tracklistswith mashup/component structures:

Algorithm:
1. Initialize empty list to hold final setlist entries
2. Initialize current_track_entry object (primary track + components)
3. Iterate through lines:
   - If line contains primary track indicator (timestamp, track number):
     * Push current_track_entry to list (if populated)
     * Start new current_track_entry
     * Parse line and store as primary track
   - If line contains component track indicator (w/, +, vs.):
     * Parse line
     * Append to components list in current_track_entry
4. After loop: push final current_track_entry to list

Example Input:
    1. [0:00] Artist - Track Name
       w/ Artist2 - Acappella Component
    2. [3:45] Another Artist - Another Track

Example Output:
    [
        {
            "position": 1,
            "timestamp": "0:00",
            "primary_track": {...},
            "components": [
                {"type": "acappella", "track": {...}}
            ]
        },
        {
            "position": 2,
            "timestamp": "3:45",
            "primary_track": {...},
            "components": []
        }
    ]
"""

import re
import logging
from typing import List, Dict, Optional
from .utils import parse_track_string

logger = logging.getLogger(__name__)


class TrackEntry:
    """Represents a single setlist entry with primary track and optional components"""

    def __init__(self, position: int, timestamp: Optional[str] = None):
        self.position = position
        self.timestamp = timestamp
        self.primary_track = None
        self.components = []

    def to_dict(self) -> Dict:
        """Convert to dictionary for database storage"""
        return {
            "position": self.position,
            "timestamp": self.timestamp,
            "primary_track": self.primary_track,
            "components": self.components
        }


class StatefulTracklistParser:
    """
    Stateful parser for tracklists with mashup/component structures.

    Maintains context across lines to correctly group primary tracks with their components.
    """

    # Component indicators (w/, +, vs. at start of line)
    COMPONENT_PATTERNS = [
        r'^\s*w/\s+',           # "w/ Artist - Track"
        r'^\s*\+\s+',           # "+ Artist - Track"
        r'^\s*vs\.?\s+',        # "vs. Artist - Track"
        r'^\s*with\s+',         # "with Artist - Track"
    ]

    # Primary track indicators (timestamp, track number)
    PRIMARY_PATTERNS = [
        r'^\s*\[?(\d{1,2}:\d{2}(?::\d{2})?)\]?\s*(.+)',  # [0:00] or 0:00 timestamp
        r'^\s*(\d{1,3})\.?\s+(.+)',                       # 1. or 1 track number
    ]

    def __init__(self):
        self.current_entry = None
        self.entries = []
        self.position_counter = 0

    def parse_tracklist(self, lines: List[str]) -> List[Dict]:
        """
        Parse a list of tracklist lines into structured entries.

        Args:
            lines: List of raw tracklist strings

        Returns:
            List of track entry dictionaries
        """
        for line in lines:
            line = line.strip()
            if not line:
                continue

            # Check if this is a component track
            if self._is_component_line(line):
                self._add_component(line)
            # Check if this is a primary track
            elif self._is_primary_track_line(line):
                self._add_primary_track(line)
            else:
                # Ambiguous line - try to parse as primary track if no current entry exists
                if self.current_entry is None:
                    self._add_primary_track(line, timestamp=None)

        # Push final entry
        if self.current_entry and self.current_entry.primary_track:
            self.entries.append(self.current_entry.to_dict())

        return self.entries

    def _is_component_line(self, line: str) -> bool:
        """Check if line starts with a component indicator"""
        for pattern in self.COMPONENT_PATTERNS:
            if re.match(pattern, line, re.IGNORECASE):
                return True
        return False

    def _is_primary_track_line(self, line: str) -> bool:
        """Check if line contains primary track indicators (timestamp or number)"""
        for pattern in self.PRIMARY_PATTERNS:
            if re.match(pattern, line):
                return True
        return False

    def _extract_timestamp_and_track(self, line: str) -> tuple:
        """Extract timestamp/number and remaining track string"""
        # Try timestamp patterns first
        for pattern in self.PRIMARY_PATTERNS:
            match = re.match(pattern, line)
            if match:
                indicator = match.group(1)  # Timestamp or track number
                track_string = match.group(2).strip()
                return indicator, track_string

        # No indicator found
        return None, line

    def _add_primary_track(self, line: str, timestamp: Optional[str] = None):
        """Add a new primary track entry"""
        # Push previous entry if it exists
        if self.current_entry and self.current_entry.primary_track:
            self.entries.append(self.current_entry.to_dict())

        # Extract timestamp and track string
        if timestamp is None:
            timestamp, track_string = self._extract_timestamp_and_track(line)
        else:
            track_string = line

        # Parse track string
        parsed = parse_track_string(track_string)

        # Skip if parsing failed (e.g., "ID - ID")
        if parsed is None:
            logger.debug(f"Skipped unidentified track: {track_string}")
            self.current_entry = None
            return

        # Create new entry
        self.position_counter += 1
        self.current_entry = TrackEntry(
            position=self.position_counter,
            timestamp=timestamp
        )
        self.current_entry.primary_track = parsed

        logger.debug(f"Added primary track (pos {self.position_counter}): {parsed['track_name']}")

    def _add_component(self, line: str):
        """Add a component track to the current entry"""
        if self.current_entry is None:
            logger.warning(f"Component track without primary track: {line}")
            return

        # Remove component indicator
        component_type = None
        clean_line = line

        for pattern in self.COMPONENT_PATTERNS:
            match = re.match(pattern, line, re.IGNORECASE)
            if match:
                # Determine component type from indicator
                indicator = match.group(0).strip().lower()
                if 'w/' in indicator or 'with' in indicator:
                    component_type = 'mashup_component'
                elif '+' in indicator:
                    component_type = 'additional'
                elif 'vs' in indicator:
                    component_type = 'versus'

                clean_line = line[match.end():].strip()
                break

        # Parse component track
        parsed = parse_track_string(clean_line)

        if parsed is None:
            logger.debug(f"Skipped unidentified component: {clean_line}")
            return

        # Detect component subtype from track name (Acappella, Instrumental, etc.)
        track_name_lower = parsed['track_name'].lower()
        if 'acappella' in track_name_lower or 'acapella' in track_name_lower:
            component_subtype = 'acappella'
        elif 'instrumental' in track_name_lower:
            component_subtype = 'instrumental'
        elif 'bootleg' in track_name_lower:
            component_subtype = 'bootleg'
        else:
            component_subtype = component_type or 'component'

        # Add to current entry
        component_data = {
            "type": component_subtype,
            "track": parsed
        }
        self.current_entry.components.append(component_data)

        logger.debug(f"Added component ({component_subtype}): {parsed['track_name']}")


def parse_tracklist_with_state(lines: List[str]) -> List[Dict]:
    """
    Convenience function to parse a tracklist with state machine.

    Args:
        lines: List of tracklist lines (strings)

    Returns:
        List of structured track entries with components

    Example:
        >>> lines = [
        ...     "1. [0:00] Artist - Track",
        ...     "   w/ Artist2 - Acappella",
        ...     "2. [3:45] Another Artist - Track"
        ... ]
        >>> entries = parse_tracklist_with_state(lines)
        >>> len(entries)
        2
        >>> entries[0]['components']
        [{'type': 'acappella', 'track': {...}}]
    """
    parser = StatefulTracklistParser()
    return parser.parse_tracklist(lines)


# Test cases
if __name__ == "__main__":
    logging.basicConfig(level=logging.DEBUG)

    print("=" * 70)
    print("STATEFUL TRACKLIST PARSER TESTS")
    print("=" * 70)

    # Test 1: Simple tracklist with components
    test_lines_1 = [
        "1. [0:00] Anyma & Adam Sellouk ft. Carly Gibert - Consciousness",
        "   w/ Dave & Central Cee - Sprinter (Acappella)",
        "2. [3:30] FISHER - Losing It",
        "   + Chris Lake - Turn Off The Lights (Bootleg)"
    ]

    print("\nTest 1: Tracklist with mashup components")
    print("-" * 70)
    for line in test_lines_1:
        print(f"  {line}")

    entries_1 = parse_tracklist_with_state(test_lines_1)
    print(f"\nParsed {len(entries_1)} entries:")
    for entry in entries_1:
        print(f"  Position {entry['position']}: {entry['primary_track']['track_name']}")
        if entry['components']:
            for comp in entry['components']:
                print(f"    └─ ({comp['type']}) {comp['track']['track_name']}")

    # Test 2: Tracklist without components
    test_lines_2 = [
        "[0:00] Artist 1 - Track 1",
        "[3:00] Artist 2 - Track 2",
        "[6:00] Artist 3 - Track 3"
    ]

    print("\n" + "=" * 70)
    print("Test 2: Simple tracklist (no components)")
    print("-" * 70)
    entries_2 = parse_tracklist_with_state(test_lines_2)
    print(f"Parsed {len(entries_2)} entries:")
    for entry in entries_2:
        print(f"  {entry['timestamp']}: {entry['primary_track']['track_name']}")

    # Test 3: Mixed format
    test_lines_3 = [
        "1. Deadmau5 - Strobe",
        "   vs. Kaskade - 4 AM",
        "2. [5:30] Eric Prydz - Opus (Extended Mix)",
        "FISHER - Losing It"
    ]

    print("\n" + "=" * 70)
    print("Test 3: Mixed format (with vs. component)")
    print("-" * 70)
    entries_3 = parse_tracklist_with_state(test_lines_3)
    print(f"Parsed {len(entries_3)} entries:")
    for entry in entries_3:
        primary = entry['primary_track']
        print(f"  Position {entry['position']}: {primary['track_name']}")
        if entry['components']:
            for comp in entry['components']:
                print(f"    └─ ({comp['type']}) {comp['track']['track_name']}")

    print("\n" + "=" * 70)
    print("✓ ALL TESTS COMPLETE")
    print("=" * 70)
