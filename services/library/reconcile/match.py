from typing import List, Dict, Any
from dataclasses import dataclass

from contracts.normalise import combined_lookup
from common.metadata.matching import parse_title

@dataclass
class Candidate:
    library_id: str
    silver_id: str
    library_artist: str
    library_title: str
    silver_artist: str
    silver_title: str
    evidence: List[Dict[str, str]]

def find_candidates(library_rows: List[Dict[str, Any]], silver_rows: List[Dict[str, Any]]) -> List[Candidate]:
    candidates = []

    for lib in library_rows:
        for sil in silver_rows:
            if str(lib['id']) == str(sil['id']):
                continue

            evidence = []

            # 1. Check ISRC equality
            if lib.get('isrc') and sil.get('isrc') and lib['isrc'] == sil['isrc']:
                evidence.append({"rule": "isrc_equality", "value": lib['isrc']})

            # 2. Check MBID equality (only when both sides have one)
            if lib.get('musicbrainz_id') and sil.get('musicbrainz_id') and lib['musicbrainz_id'] == sil['musicbrainz_id']:
                evidence.append({"rule": "mbid_equality", "value": lib['musicbrainz_id']})

            # 3. Check norm key equality
            # Compute the silver side's key with contracts/normalise.py::combined_lookup(artist, title)
            # so both sides use the contract normaliser and never an ad-hoc lowercase.

            lib_norm_key = lib.get('norm_key') or combined_lookup(lib.get('artist_name', ''), lib.get('track_title', ''))
            sil_norm_key = combined_lookup(sil.get('artist_name', ''), sil.get('track_title', ''))

            if lib_norm_key == sil_norm_key:
                # Basic guard against mix-name near-miss using parsed titles
                lib_parsed = parse_title(lib.get('track_title', ''))
                sil_parsed = parse_title(sil.get('track_title', ''))

                if lib_parsed.versions and sil_parsed.versions and lib_parsed.versions != sil_parsed.versions:
                    pass
                else:
                    evidence.append({"rule": "norm_key_equality", "value": lib_norm_key})

            if evidence:
                candidates.append(Candidate(
                    library_id=str(lib['id']),
                    silver_id=str(sil['id']),
                    library_artist=str(lib.get('artist_name', '')),
                    library_title=str(lib.get('track_title', '')),
                    silver_artist=str(sil.get('artist_name', '')),
                    silver_title=str(sil.get('track_title', '')),
                    evidence=evidence
                ))

    return candidates
