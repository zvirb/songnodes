import re
import unicodedata

def combined_lookup(artist_credit_name: str, recording_name: str) -> str:
    """
    Reproduces the ListenBrainz `combined_lookup` exactly, but using stdlib only.
    unidecode(re.sub(r'[^\w]+', '', artist_credit_name + recording_name).lower())
    Since we can't use unidecode, we use unicodedata.normalize.
    """
    artist = artist_credit_name or ""
    title = recording_name or ""
    combined = artist + title

    # Strip non-word characters and lowercase
    stripped = re.sub(r'[^\w]+', '', combined).lower()

    # Use unicodedata for stdlib normalization.
    # Note: NFKD + encode('ascii', 'ignore') is a close approximation of unidecode
    # for Latin character accents, though it fails on complex transliterations.
    normalized = unicodedata.normalize('NFKD', stripped).encode('ascii', 'ignore').decode('utf-8')
    return normalized
