"""Enhanced tracklist extraction using spaCy NER + regex patterns"""
import spacy
import re
from typing import List, Dict, Optional
import logging

logger = logging.getLogger(__name__)

class TracklistExtractor:
    """Enhanced tracklist extraction using spaCy NER + regex patterns"""

    def __init__(self):
        # Load spaCy model
        try:
            self.nlp = spacy.load("en_core_web_sm")
            logger.info("spaCy model loaded successfully for tracklist extraction")
        except Exception as e:
            logger.error(f"Failed to load spaCy model: {e}")
            self.nlp = None

    def extract_tracklist(
        self,
        text: str,
        source_url: Optional[str] = None,
        extract_timestamps: bool = True
    ) -> List[Dict]:
        """
        Extract tracklist from text using multi-strategy approach:
        1. spaCy NER for artist/track identification
        2. Regex patterns for structured formats
        3. Timestamp extraction
        """
        tracks = []

        # Strategy 1: Structured patterns (most reliable)
        structured_tracks = self._extract_structured_patterns(text, extract_timestamps)
        if structured_tracks:
            tracks.extend(structured_tracks)

        # Strategy 2: spaCy NER (for unstructured text)
        if not tracks and self.nlp:
            ner_tracks = self._extract_with_spacy(text)
            if ner_tracks:
                tracks.extend(ner_tracks)

        # Strategy 3: Fallback regex patterns
        if not tracks:
            fallback_tracks = self._extract_fallback_patterns(text)
            tracks.extend(fallback_tracks)

        return self._deduplicate_tracks(tracks)

    def _extract_structured_patterns(self, text: str, extract_timestamps: bool) -> List[Dict]:
        """Extract from well-formatted tracklists using expanded pattern library"""
        tracks = []

        # Pattern 1: [00:00] Artist - Track
        pattern1 = r'\[(\d{1,2}:\d{2}(?::\d{2})?)\]\s*([^-\n]+)\s*-\s*([^\n]+)'
        for match in re.finditer(pattern1, text, re.MULTILINE):
            tracks.append({
                'timestamp': match.group(1),
                'artist': self._clean_text(match.group(2)),
                'title': self._clean_text(match.group(3)),
                'confidence': 0.95
            })

        # Pattern 2: 00:00 Artist - Track
        if not tracks:
            pattern2 = r'(\d{1,2}:\d{2}(?::\d{2})?)\s+([^-\n]+)\s+-\s+([^\n]+)'
            for match in re.finditer(pattern2, text, re.MULTILINE):
                tracks.append({
                    'timestamp': match.group(1),
                    'artist': self._clean_text(match.group(2)),
                    'title': self._clean_text(match.group(3)),
                    'confidence': 0.9
                })

        # Pattern 3: 1. Artist - Track (numbered with period)
        if not tracks:
            pattern3 = r'^\s*\d+\.\s+([^-\n]+)\s+-\s+([^\n]+)'
            for match in re.finditer(pattern3, text, re.MULTILINE):
                tracks.append({
                    'artist': self._clean_text(match.group(1)),
                    'title': self._clean_text(match.group(2)),
                    'confidence': 0.85
                })

        # Pattern 4: 01) Artist - Track (numbered with parenthesis)
        if not tracks:
            pattern4_parens = r'^\s*\d+\)\s+([^-\n]+)\s+-\s+([^\n]+)'
            for match in re.finditer(pattern4_parens, text, re.MULTILINE):
                tracks.append({
                    'artist': self._clean_text(match.group(1)),
                    'title': self._clean_text(match.group(2)),
                    'confidence': 0.85
                })

        # Pattern 5: Artist / Track (DJ-style slash separator)
        if not tracks:
            pattern5_slash = r'^\s*([A-Z][^/\n]{2,40})\s*/\s*([^\n]+)'
            for match in re.finditer(pattern5_slash, text, re.MULTILINE):
                tracks.append({
                    'artist': self._clean_text(match.group(1)),
                    'title': self._clean_text(match.group(2)),
                    'confidence': 0.80
                })

        # Pattern 6: [CAT123] Artist - Track (catalog number prefix)
        if not tracks:
            pattern6_catalog = r'\[([^\]]+)\]\s+([^-\n]+)\s+-\s+([^\n]+)'
            for match in re.finditer(pattern6_catalog, text, re.MULTILINE):
                # Check if first group looks like catalog number
                catalog = match.group(1)
                if re.match(r'^[A-Z]{2,5}\d{2,6}$|^[A-Z]+\s*\d+$', catalog):
                    tracks.append({
                        'artist': self._clean_text(match.group(2)),
                        'title': self._clean_text(match.group(3)),
                        'catalog_number': self._clean_text(catalog),
                        'confidence': 0.88
                    })

        # Pattern 7: Track 01: Artist - Track
        if not tracks:
            pattern7_track_prefix = r'Track\s+\d+:\s+([^-\n]+)\s+-\s+([^\n]+)'
            for match in re.finditer(pattern7_track_prefix, text, re.MULTILINE | re.IGNORECASE):
                tracks.append({
                    'artist': self._clean_text(match.group(1)),
                    'title': self._clean_text(match.group(2)),
                    'confidence': 0.87
                })

        # Pattern 8: Artist – Track (em dash)
        if not tracks:
            pattern8_emdash = r'^\s*([A-Z][^–\n]{2,40})\s*–\s*([^\n]+)'
            for match in re.finditer(pattern8_emdash, text, re.MULTILINE):
                tracks.append({
                    'artist': self._clean_text(match.group(1)),
                    'title': self._clean_text(match.group(2)),
                    'confidence': 0.83
                })

        # Pattern 9: [Label] Artist - Track
        if not tracks:
            pattern9_label_prefix = r'\[([A-Za-z\s&]+)\]\s+([^-\n]+)\s+-\s+([^\n]+)'
            for match in re.finditer(pattern9_label_prefix, text, re.MULTILINE):
                label = match.group(1).strip()
                # Check if it looks like a label (not a catalog number or time)
                if not re.match(r'^\d', label) and len(label) > 2:
                    tracks.append({
                        'artist': self._clean_text(match.group(2)),
                        'title': self._clean_text(match.group(3)),
                        'label': self._clean_text(label),
                        'confidence': 0.84
                    })

        # Pattern 10: "Artist" - "Track" (quoted format)
        if not tracks:
            pattern10_quoted = r'\"([^\"]+)\"\s*-\s*\"([^\"]+)\"'
            for match in re.finditer(pattern10_quoted, text, re.MULTILINE):
                tracks.append({
                    'artist': self._clean_text(match.group(1)),
                    'title': self._clean_text(match.group(2)),
                    'confidence': 0.86
                })

        # Pattern 11: Artist - Track (ID) [Label] (original Pattern 4 from before)
        if not tracks:
            pattern11 = r'([A-Z][a-zA-Z\s&]+)\s+-\s+([^\[\(\n]+)(?:\s*\[([^\]]+)\])?(?:\s*\(([^\)]+)\))?'
            for match in re.finditer(pattern11, text, re.MULTILINE):
                track = {
                    'artist': self._clean_text(match.group(1)),
                    'title': self._clean_text(match.group(2)),
                    'confidence': 0.75
                }
                if match.group(3):  # Label
                    track['label'] = self._clean_text(match.group(3))
                if match.group(4):  # ID/Remix info
                    track['remix_info'] = self._clean_text(match.group(4))
                tracks.append(track)

        # Pattern 12: Detect "ID - ID" or "Unknown - Unknown" (mark explicitly)
        if not tracks:
            pattern12_id = r'(?:ID|Unknown|TBD|TBA)\s*-\s*(?:ID|Unknown|TBD|TBA)'
            for match in re.finditer(pattern12_id, text, re.MULTILINE | re.IGNORECASE):
                # Mark these explicitly as unknown so we don't waste enrichment API calls
                tracks.append({
                    'artist': 'ID',
                    'title': 'ID',
                    'confidence': 0.99,  # High confidence that it's intentionally unknown
                    'is_id': True  # Flag for special handling
                })

        return tracks

    def _extract_with_spacy(self, text: str) -> List[Dict]:
        """Use spaCy NER to identify artists and tracks"""
        if not self.nlp:
            return []

        doc = self.nlp(text)
        tracks = []

        # Look for PERSON entities (likely artists) followed by WORK_OF_ART (tracks)
        entities = list(doc.ents)
        for i, ent in enumerate(entities):
            if ent.label_ == "PERSON":
                # Look for following entities that might be track names
                if i + 1 < len(entities):
                    next_ent = entities[i + 1]
                    if next_ent.label_ in ["WORK_OF_ART", "PRODUCT"]:
                        tracks.append({
                            'artist': self._clean_text(ent.text),
                            'title': self._clean_text(next_ent.text),
                            'confidence': 0.7
                        })

        # Alternative: Look for "feat.", "vs", "x" patterns
        feat_pattern = r'([A-Z][a-zA-Z\s]+)\s+(?:feat\.|ft\.|vs\.?|x)\s+([A-Z][a-zA-Z\s]+)\s+-\s+([^\n]+)'
        for match in re.finditer(feat_pattern, text):
            tracks.append({
                'artist': self._clean_text(f"{match.group(1)} feat. {match.group(2)}"),
                'title': self._clean_text(match.group(3)),
                'confidence': 0.75
            })

        # Look for common collaboration patterns using spaCy
        for sent in doc.sents:
            sent_text = sent.text
            # Check for artist collaboration indicators
            if any(collab in sent_text.lower() for collab in ['feat.', 'ft.', 'featuring', 'vs', 'x', '&']):
                # Extract using pattern
                collab_pattern = r'([A-Z][a-zA-Z\s&]+?)\s+(?:feat\.|ft\.|featuring|vs\.?|x|&)\s+([A-Z][a-zA-Z\s&]+?)\s+-\s+(.+?)(?:\n|$)'
                match = re.search(collab_pattern, sent_text)
                if match:
                    tracks.append({
                        'artist': self._clean_text(f"{match.group(1)} feat. {match.group(2)}"),
                        'title': self._clean_text(match.group(3)),
                        'confidence': 0.8
                    })

        return tracks

    def _extract_fallback_patterns(self, text: str) -> List[Dict]:
        """Last resort: basic patterns"""
        tracks = []

        # Pattern: Any capitalized words followed by dash
        pattern = r'([A-Z][a-zA-Z\s&]+)\s+-\s+([^\n]+)'
        for match in re.finditer(pattern, text):
            artist = self._clean_text(match.group(1))
            title = self._clean_text(match.group(2))

            # Filter out obvious non-tracks
            if len(artist) > 2 and len(title) > 2 and len(artist) < 50:
                tracks.append({
                    'artist': artist,
                    'title': title,
                    'confidence': 0.5
                })

        return tracks[:30]  # Limit fallback results

    def _clean_text(self, text: str) -> str:
        """Clean extracted text"""
        # Remove extra whitespace
        text = re.sub(r'\s+', ' ', text)
        # Remove common prefixes/suffixes
        text = re.sub(r'\[.*?\]|\(.*?\)', '', text)
        # Remove leading/trailing whitespace and punctuation
        text = text.strip().strip('.,;:')
        return text

    def _deduplicate_tracks(self, tracks: List[Dict]) -> List[Dict]:
        """Remove duplicate tracks, keeping highest confidence"""
        seen = {}
        for track in tracks:
            key = f"{track.get('artist', '')}||{track.get('title', '')}"
            if key not in seen or track.get('confidence', 0) > seen[key].get('confidence', 0):
                seen[key] = track

        return list(seen.values())

    def extract_timestamps(self, text: str) -> List[Dict]:
        """Extract timestamps and their context"""
        timestamps = []

        # Pattern: [00:00] or 00:00 format
        pattern = r'(?:\[)?(\d{1,2}:\d{2}(?::\d{2})?)(?:\])?(.{0,100})'

        for match in re.finditer(pattern, text):
            timestamp = match.group(1)
            context = self._clean_text(match.group(2))

            if context:
                timestamps.append({
                    'timestamp': timestamp,
                    'context': context
                })

        return timestamps

    def analyze_tracklist_format(self, text: str) -> Dict[str, any]:
        """Analyze the format and structure of a tracklist"""
        analysis = {
            'has_timestamps': False,
            'has_numbering': False,
            'format_type': 'unstructured',
            'separator_type': None,
            'estimated_tracks': 0
        }

        # Check for timestamps
        if re.search(r'\d{1,2}:\d{2}', text):
            analysis['has_timestamps'] = True

        # Check for numbering
        if re.search(r'^\s*\d+\.\s+', text, re.MULTILINE):
            analysis['has_numbering'] = True

        # Check separator type
        if ' - ' in text:
            analysis['separator_type'] = 'dash'
        elif ' – ' in text:  # En dash
            analysis['separator_type'] = 'en_dash'

        # Determine format type
        if analysis['has_timestamps']:
            if re.search(r'\[(\d{1,2}:\d{2})\]', text):
                analysis['format_type'] = 'bracketed_timestamps'
            else:
                analysis['format_type'] = 'plain_timestamps'
        elif analysis['has_numbering']:
            analysis['format_type'] = 'numbered_list'
        elif analysis['separator_type']:
            analysis['format_type'] = 'simple_list'

        # Estimate number of tracks
        # Count lines with artist - track pattern
        track_lines = re.findall(r'[A-Z][a-zA-Z\s&]+ - [^\n]+', text)
        analysis['estimated_tracks'] = len(track_lines)

        return analysis