"""Version-aware provider matching: ISRC first, then fuzzy title/artist with a hard duration guard.

The guard exists to stop a radio edit being substituted for an extended mix (or the reverse):
candidates whose duration differs by more than 10 seconds are rejected, and when either duration
is unknown a fuzzy match is sent to review instead of being accepted automatically.
"""
import re
import unicodedata
from dataclasses import dataclass, field
from difflib import SequenceMatcher
from typing import List, Optional, Sequence, Tuple

DURATION_GUARD_MS = 10_000
TITLE_THRESHOLD = 0.92
ARTIST_THRESHOLD = 0.85

VERSION_WORDS = (
    'extended mix', 'extended', 'radio edit', 'radio mix', 'club mix', 'club edit', 'original mix', 'original',
    'instrumental', 'dub mix', 'dub', 'vip mix', 'vip', 'remix', 'edit', 'bootleg', 'mashup', 'live', 'acoustic',
    'remastered', 'remaster', 'rework', 'version')
BRACKETS = re.compile(r'[\(\[\{]([^\)\]\}]*)[\)\]\}]')
DASH_SUFFIX = re.compile(r'\s[-–—]\s([^-–—]+)$')
FEAT = re.compile(r'\s*[\(\[]?\b(?:feat\.?|featuring|ft\.?)\s+([^\)\]]+)[\)\]]?', re.IGNORECASE)


def normalize_text(value: Optional[str]) -> str:
    """NFKC + casefold; keep every Unicode letter/digit (no ASCII folding); collapse everything else to spaces."""
    text = unicodedata.normalize('NFKC', value or '').casefold()
    return ' '.join(re.sub(r'[^\w]+', ' ', text, flags=re.UNICODE).replace('_', ' ').split())


@dataclass(frozen=True)
class ParsedTitle:
    base: str
    versions: Tuple[str, ...]     # normalised version phrases; 'original mix' counts as no version
    featured: Tuple[str, ...]


def is_version(phrase: str) -> bool:
    text = normalize_text(phrase)
    return any(word in text.split() or word in text for word in VERSION_WORDS)


def parse_title(title: Optional[str]) -> ParsedTitle:
    text = title or ''
    featured = tuple(normalize_text(m.group(1)) for m in FEAT.finditer(text))
    text = FEAT.sub('', text)
    versions: List[str] = []

    def take(match):
        inner = match.group(1)
        if is_version(inner):
            versions.append(normalize_text(inner))
            return ' '
        return match.group(0)

    text = BRACKETS.sub(take, text)
    suffix = DASH_SUFFIX.search(text)
    if suffix and is_version(suffix.group(1)):
        versions.append(normalize_text(suffix.group(1)))
        text = text[:suffix.start()]
    cleaned = tuple(sorted({v for v in versions if v not in ('original mix', 'original')}))
    return ParsedTitle(normalize_text(text), cleaned, featured)


def similarity(a: str, b: str) -> float:
    return SequenceMatcher(None, a, b).ratio() if a and b else 0.0


def artist_key(value: Optional[str]) -> str:
    parts = re.split(r'\s*(?:,|&|\band\b|\bfeat\.?\b|\bft\.?\b|\bfeaturing\b|\bvs\.?\b|;)\s*', value or '', flags=re.IGNORECASE)
    return ' '.join(sorted(p for p in (normalize_text(x) for x in parts) if p))


@dataclass(frozen=True)
class Track:
    title: str
    artist: str
    isrc: Optional[str] = None
    duration_ms: Optional[int] = None
    ref: Optional[str] = None      # provider id of a candidate


@dataclass(frozen=True)
class Decision:
    outcome: str                    # match | review | reject
    score: float
    reasons: Tuple[str, ...] = field(default_factory=tuple)
    candidate: Optional[Track] = None
    title_score: float = 0.0
    artist_score: float = 0.0


def normalize_isrc(value: Optional[str]) -> Optional[str]:
    text = re.sub(r'[\s-]', '', value or '').upper()
    return text if re.fullmatch(r'[A-Z]{2}[A-Z0-9]{3}\d{7}', text) else None


def duration_state(a: Optional[int], b: Optional[int]) -> str:
    if not a or not b or a <= 0 or b <= 0:
        return 'unknown'
    return 'within' if abs(a - b) <= DURATION_GUARD_MS else 'beyond'


def match_candidate(target: Track, candidate: Track) -> Decision:
    reasons: List[str] = []
    duration = duration_state(target.duration_ms, candidate.duration_ms)
    isrc_a, isrc_b = normalize_isrc(target.isrc), normalize_isrc(candidate.isrc)
    if isrc_a and isrc_b and isrc_a == isrc_b:
        if duration == 'beyond':
            return Decision('review', 0.9, ('isrc_equal', 'duration_beyond_guard'), candidate)
        return Decision('match', 1.0, ('isrc_equal',) + (('duration_unknown',) if duration == 'unknown' else ()), candidate)
    if isrc_a and isrc_b:
        reasons.append('isrc_differs')

    parsed_t, parsed_c = parse_title(target.title), parse_title(candidate.title)
    title_score = similarity(parsed_t.base, parsed_c.base)
    artist_score = similarity(artist_key(target.artist), artist_key(candidate.artist))
    score = round(0.6 * title_score + 0.4 * artist_score, 4)
    scores = {'title_score': title_score, 'artist_score': artist_score}
    if title_score < TITLE_THRESHOLD or artist_score < ARTIST_THRESHOLD:
        return Decision('reject', score, tuple(reasons) + ('title_or_artist_below_threshold',), candidate, **scores)
    if parsed_t.versions != parsed_c.versions:
        return Decision('reject', score, tuple(reasons) + ('version_mismatch',), candidate, **scores)
    if duration == 'beyond':
        return Decision('reject', score, tuple(reasons) + ('duration_beyond_guard',), candidate, **scores)
    if duration == 'unknown':
        return Decision('review', score, tuple(reasons) + ('duration_unknown',), candidate, **scores)
    return Decision('match', score, tuple(reasons) + ('fuzzy_version_and_duration_agree',), candidate, **scores)


UNIQUE_TITLE, UNIQUE_ARTIST = 0.97, 0.92


def best_match(target: Track, candidates: Sequence[Track], unknown_duration: str = 'review') -> Decision:
    """Pick one candidate. Several automatic matches on different recordings are ambiguous -> review.

    `unknown_duration='unique_exact'` lets a candidate through when no duration is known on one side only if
    it is the single candidate whose title (version included) and artist match almost exactly; with several
    such candidates, or weaker text agreement, it stays a review item.
    """
    decisions = sorted((match_candidate(target, c) for c in candidates), key=lambda d: (-d.score, d.candidate.ref or ''))
    matches = [d for d in decisions if d.outcome == 'match']
    isrc_matches = [d for d in matches if 'isrc_equal' in d.reasons]
    if isrc_matches:
        return isrc_matches[0]
    if len(matches) == 1:
        return matches[0]
    if len(matches) > 1:
        return Decision('review', matches[0].score, ('ambiguous_multiple_matches',), matches[0].candidate)
    reviews = [d for d in decisions if d.outcome == 'review']
    if unknown_duration == 'unique_exact':
        exact = [d for d in reviews if d.reasons[-1:] == ('duration_unknown',)
                 and d.title_score >= UNIQUE_TITLE and d.artist_score >= UNIQUE_ARTIST]
        if len(exact) == 1:
            only = exact[0]
            return Decision('match', only.score, only.reasons + ('unique_text_match_duration_unknown',), only.candidate,
                            only.title_score, only.artist_score)
        if len(exact) > 1:
            return Decision('review', exact[0].score, ('ambiguous_multiple_matches',), exact[0].candidate)
    if reviews:
        return reviews[0]
    return decisions[0] if decisions else Decision('reject', 0.0, ('no_candidates',))
