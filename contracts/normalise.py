import re
from unidecode import unidecode

def combined_lookup(artist_credit_name: str, recording_name: str) -> str:
    """
    Reproduces the ListenBrainz `combined_lookup` exactly:
    unidecode(re.sub(r'[^\w]+', '', artist_credit_name + recording_name).lower())
    """
    artist = artist_credit_name or ""
    title = recording_name or ""
    combined = artist + title

    # Strip non-word characters and lowercase
    stripped = re.sub(r'[^\w]+', '', combined).lower()

    # Unidecode to handle accents
    return unidecode(stripped)
