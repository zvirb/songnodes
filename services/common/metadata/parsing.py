"""Deterministic "Artist - Title (Version)" parsing, run before any probabilistic matching (Milestone 4).

Rules: the original string and all Unicode are preserved (normalisation is for comparison only); featured artists,
versions and remixers are separated from the title instead of being discarded; collaborations split only on explicit
separators (`&`, `,`, `vs`, `feat`, `with`, and a *spaced* `x`), never on a bare `x`, so "Alex Xavier" stays whole;
names the caller recognises as one artist (e.g. "Above & Beyond") are never split; unidentified entries ("ID - ID")
produce no artist, so they cannot become graph nodes.
"""
import re
from dataclasses import dataclass, field
from typing import Callable, List, Optional, Tuple

from .matching import FEAT, normalize_text, parse_title
from .names import is_placeholder_artist

TITLE_SEPARATORS = re.compile(r'\s+[-–—]\s+')
ARTIST_SEPARATORS = re.compile(
    r'\s*(?:,|;|\s&\s|\s+and\s+|\s+vs\.?\s+|\s+x\s+|\s+with\s+|\s+(?:feat\.?|ft\.?|featuring)\s+)\s*', re.IGNORECASE)
REMIX_WORDS = ('remix', 'rework', 'bootleg', 'edit', 'vip mix', 'vip', 'mashup', 'flip', 'dub')
REMIXER = re.compile(r'^(?P<name>.+?)\s+(?P<kind>' + '|'.join(re.escape(w) for w in sorted(REMIX_WORDS, key=len, reverse=True)) + r')$',
                     re.IGNORECASE)
GENERIC_VERSIONS = {'extended', 'extended mix', 'original', 'original mix', 'radio', 'radio edit', 'club', 'club mix', 'instrumental',
                    'vocal', 'vocal mix', 'dub', 'dub mix', 'acoustic', 'live', 'remastered', 'edit'}


@dataclass(frozen=True)
class ParsedTrack:
    original: str
    artist_string: str                       # exactly as written before the title separator
    artists: Tuple[str, ...]                 # split, original casing
    featured: Tuple[str, ...]
    title: str                               # without version/feature decorations, original casing
    versions: Tuple[str, ...]                # normalised phrases; "original mix" is the default and is dropped
    remixers: Tuple[str, ...]
    unidentified: bool = False
    notes: Tuple[str, ...] = field(default_factory=tuple)


def split_artists(text: str, is_known_artist: Optional[Callable[[str], bool]] = None) -> Tuple[List[str], List[str]]:
    """Return (artists, featured). A whole string the caller knows as one artist is kept intact."""
    text = text.strip()
    if not text or is_placeholder_artist(text):
        return [], []
    if is_known_artist and is_known_artist(text):
        return [text], []
    lead, *rest = re.split(r'\s+(?:feat\.?|ft\.?|featuring)\s+', text, maxsplit=1, flags=re.IGNORECASE)
    featured = [p for p in (x.strip() for x in ARTIST_SEPARATORS.split(rest[0])) if p] if rest else []
    artists = [p for p in (x.strip() for x in ARTIST_SEPARATORS.split(lead)) if p]
    if is_known_artist:  # protect compounds the catalogue already knows: rejoin adjacent parts that form a known name
        joined, i = [], 0
        while i < len(artists):
            for span in range(len(artists), i + 1, -1):
                candidate = ' & '.join(artists[i:span])
                if is_known_artist(candidate):
                    joined.append(candidate)
                    i = span
                    break
            else:
                joined.append(artists[i])
                i += 1
        artists = joined
    return artists, featured


def remixer_of(phrase: str) -> Optional[str]:
    """'Eric Prydz Remix' -> 'Eric Prydz'; generic phrases ('Extended Mix', 'Radio Edit') have no remixer."""
    if normalize_text(phrase) in GENERIC_VERSIONS:
        return None
    match = REMIXER.match(phrase.strip())
    if not match:
        return None
    name = match.group('name').strip()
    return None if normalize_text(name) in GENERIC_VERSIONS or normalize_text(name) in {'club', 'radio', 'extended', 'original'} else name


def parse_track(raw: str, is_known_artist: Optional[Callable[[str], bool]] = None) -> ParsedTrack:
    original = raw or ''
    text = original.strip()
    parts = TITLE_SEPARATORS.split(text, maxsplit=1)
    artist_string, title_text = (parts[0].strip(), parts[1].strip()) if len(parts) == 2 else ('', text)
    artists, featured = split_artists(artist_string, is_known_artist)
    # Version suffix after the final dash ("Artist - Title - Eric Prydz Remix") counts as part of the title.
    parsed = parse_title(title_text)
    title = clean_title(title_text)
    featured += [f.strip() for f in (m.group(1) for m in FEAT.finditer(title_text)) for f in re.split(ARTIST_SEPARATORS, f) if f.strip()]
    remixers = []
    for phrase in re.findall(r'[\(\[]([^\)\]]*)[\)\]]', title_text) + re.findall(r'\s[-–—]\s([^-–—\(\)\[\]]+)$', title_text):
        name = remixer_of(phrase)
        if name and name.lower() not in {r.lower() for r in remixers}:
            remixers.append(name)
    unidentified = (artist_string != '' and not artists) or normalize_text(title) in ('id', '')
    notes = ('unidentified',) if unidentified else ()
    return ParsedTrack(original, artist_string, tuple(artists), tuple(dict.fromkeys(featured)), title, parsed.versions,
                       tuple(remixers), unidentified, notes)


def clean_title(title_text: str) -> str:
    """Title without version brackets, feature clauses or a trailing dash version, original casing kept."""
    text = FEAT.sub('', title_text)

    def drop(match):
        return ' ' if parse_title(f'x ({match.group(1)})').versions else match.group(0)

    text = re.sub(r'[\(\[\{]([^\)\]\}]*)[\)\]\}]', drop, text)
    suffix = re.search(r'\s[-–—]\s([^-–—]+)$', text)
    if suffix and parse_title(f'x - {suffix.group(1)}').versions:
        text = text[:suffix.start()]
    return ' '.join(text.split())
