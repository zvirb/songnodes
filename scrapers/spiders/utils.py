import re
import requests
import json
import logging

logger = logging.getLogger(__name__)

# MixesDB and other sources frequently emit en/em dashes (and related variants) between
# artist and title. Normalise those to a plain hyphen before parsing so the downstream
# split logic remains robust even when the source HTML changes typography.
_DASH_NORMALISER = re.compile(r"[\u2010-\u2015\u2212]")


def _normalise_dashes(value: str) -> str:
    if not value:
        return value
    return _DASH_NORMALISER.sub("-", value)

def parse_track_string(track_string):
    """
    Parses a complex track string to extract primary artists, featured artists,
    remixer artists, track name, and identify if it's a remix or mashup.

    Implements Table 1.1: Universal Track String Deconstruction Algorithm
    Order of extraction (critical for accuracy):
    1. Mix Version (Extended, Radio, VIP, etc.)
    2. Remixer Artist (Artist Name Remix/Edit)
    3. Featured Artist(s) (ft./feat./featuring)
    4. Primary Artist(s) & Track Title
    5. Normalization
    """
    primary_artists = []
    featured_artists = []
    remixer_artists = []
    track_name = ""
    is_remix = False
    is_mashup = False
    mashup_components = []
    notes = []
    is_identified = True
    version_type = None

    original_string = track_string.strip()
    normalised_string = _normalise_dashes(original_string)
    temp_string = normalised_string

    # STEP 1: Extract Mix Version (MUST BE FIRST per Table 1.1)
    # Pattern: \((?P<version>[^)]*(?:Original|Extended|Radio|Club|VIP|Instrumental|Acapella|Intro|Dub)[^)]*)\)
    version_pattern = r'\((?P<version>[^)]*(?:Original|Extended|Radio|Club|VIP|Instrumental|Acapella|Intro|Dub)[^)]*)\)'
    version_match = re.search(version_pattern, temp_string, re.IGNORECASE)
    if version_match:
        version_type = version_match.group('version').strip()
        notes.append(version_type)
        temp_string = temp_string.replace(version_match.group(0), "").strip()

    # STEP 2: Extract Remixer Artist (SECOND per Table 1.1)
    # Pattern: \((?P<remixer>[^)]+?)\s+(?:Remix|Edit|Flip|Rework|Bootleg)\)
    remixer_pattern = r'\((?P<remixer>[^)]+?)\s+(?:Remix|Edit|Flip|Rework|Bootleg)\)'
    remix_match = re.search(remixer_pattern, temp_string, re.IGNORECASE)
    if remix_match:
        remixer_name = remix_match.group('remixer').strip()
        # Apply Universal Artist Parser Phase 2 to remixer if multiple
        remixer_artists.extend([a.strip() for a in re.split(r'\s*(?:&|vs\.?|,|/)\s*', remixer_name)])
        temp_string = temp_string.replace(remix_match.group(0), "").strip()
        is_remix = True

    # Also handle mashup remixers
    mashup_remix_match = re.search(r"\((.*?)\s*Mashup\)", temp_string, re.IGNORECASE)
    if mashup_remix_match:
        remixer_name = mashup_remix_match.group(1).strip()
        remixer_artists.extend([a.strip() for a in re.split(r'\s*(?:&|vs\.?|,|/)\s*', remixer_name)])
        temp_string = temp_string.replace(mashup_remix_match.group(0), "").strip()
        is_remix = True

    # Extract remaining parenthetical notes (after version and remix extraction)
    parenthetical_notes_matches = re.findall(r"\((.*?)\)", temp_string)
    for note in parenthetical_notes_matches:
        notes.append(note.strip())
        temp_string = temp_string.replace(f"({note})", "").strip()

    # STEP 3: Featured Artist Extraction (THIRD per Table 1.1)
    # Pattern: (?i)(?:ft|feat|featuring)\.?(?:\s+)?(?P<featured>.+)
    # This MUST be done before mashup detection to avoid misinterpreting "vs." in featured clauses

    # Check for "vs." to identify mashups BEFORE featured artist extraction
    vs_match = re.search(r"^(.*?)\s*vs\.\s*(.*)$", temp_string, re.IGNORECASE)
    if vs_match:
        # STEP 3a: Mashup detected - handle separately
        component1 = vs_match.group(1).strip()
        component2 = vs_match.group(2).strip()
        mashup_components.extend([comp.strip() for comp in re.split(r'\s*vs\.\s*', normalised_string) if comp.strip()])
        track_name = f"{component1} vs. {component2}"
        is_mashup = True

        # Try to parse artists from the full original string if it's a mashup
        artist_track_match = re.search(r"^(.*?)\s*-\s*(.*)$", normalised_string)
        if artist_track_match:
            # Universal Artist Parser Phase 2: Split by &, vs., feat., ft., comma, /
            primary_artists.extend([a.strip() for a in re.split(r'\s*(?:&|vs\.?|feat\.?|ft\.?|,|/)\s*', artist_track_match.group(1))])
        else:
            # Fallback for multi-artist mashups where artists are part of the 'vs.' string
            all_artists_in_mashup_string = re.findall(r"([A-Za-z0-9\s\.]+)(?:\s*vs\.|\s*ft\.|\s*&|\s*-\s*|$)", normalised_string)
            primary_artists.extend([a.strip() for a in all_artists_in_mashup_string if a.strip()])

    else:
        # STEP 3b: Featured Artist Extraction (Universal Artist Parser Phase 1)
        # Pattern matches "ft.", "feat.", "featuring" with optional period and whitespace
        ft_pattern = r'(?i)(?:ft|feat|featuring)\.?\s+(?P<featured>.+)'

        # Check if featured clause exists BEFORE the main " - " separator
        # Split on " - " first to get artist and title parts
        artist_title_parts = temp_string.split(' - ', 1)

        if len(artist_title_parts) == 2:
            artist_part = artist_title_parts[0].strip()
            title_part = artist_title_parts[1].strip()

            # Check for featured artists in artist part
            ft_match = re.search(ft_pattern, artist_part)
            if ft_match:
                # Extract featured artists
                featured_string = ft_match.group('featured').strip()
                # Universal Artist Parser Phase 2: Split featured artists by delimiters
                featured_artists.extend([a.strip() for a in re.split(r'\s*(?:&|,|/)\s*', featured_string)])

                # Remove featured clause from artist part
                artist_part = artist_part[:ft_match.start()].strip()

            # STEP 4: Primary Artist(s) & Track Title extraction
            # Universal Artist Parser Phase 2: Split primary artists by &, comma, /
            # Clean up label brackets from artist names before splitting
            artist_part_clean = re.sub(r'\s*\[[^\]]+\]', '', artist_part)

            # Split by collaboration delimiters (&, comma, /)
            artist_candidates = re.split(r'\s*(?:&|,|/)\s*', artist_part_clean)

            # Add each cleaned artist to primary_artists
            for artist in artist_candidates:
                cleaned_artist = artist.strip()
                if cleaned_artist:  # Only add non-empty artists
                    primary_artists.append(cleaned_artist)

            # Clean track title by removing label brackets
            track_name = re.sub(r'\s*\[[^\]]+\]', '', title_part).strip()
        else:
            # No " - " separator found
            track_name = temp_string.strip()

    # STEP 5: Normalization and validation
    # Handle "ID - ID" or "ID Remix" for final track_name/artist_name
    if track_name.lower() == "id" and (not primary_artists or not any(primary_artists)):
        is_identified = False
        # Skip unidentified tracks instead of creating "Unknown Artist" entries
        return None
    elif "id remix" in track_name.lower() and (not remixer_artists or not any(remixer_artists)):
        is_identified = False
        # remixer_artists remains an empty list if no specific remixer identified
    else:
        is_identified = True

    # Clean up empty strings from lists (normalization)
    primary_artists = [a for a in primary_artists if a]
    featured_artists = [a for a in featured_artists if a]
    remixer_artists = [a for a in remixer_artists if a]
    mashup_components = [c for c in mashup_components if c]

    # Return parsed data with version_type included
    return {
        "track_name": track_name,
        "primary_artists": primary_artists,
        "featured_artists": featured_artists,
        "remixer_artists": remixer_artists,
        "is_remix": is_remix,
        "is_mashup": is_mashup,
        "mashup_components": mashup_components,
        "is_identified": is_identified,
        "notes": notes,
        "version_type": version_type  # Added for Table 1.1 completeness
    }

def call_ollama_for_ner(text, ollama_host, ollama_model):
    """
    Conceptual function to call the Ollama container for Named Entity Recognition.
    This would be used for highly unstructured text, e.g., from Reddit. [4, 3]
    """
    if not ollama_host or not ollama_model:
        logger.warning("Ollama host or model not configured. Skipping NER.")
        return None

    try:
        response = requests.post(
            f"{ollama_host}/api/generate",
            json={
                "model": ollama_model,
                "prompt": f"Extract entities (artists, track names, events) from the following text: {text}",
                "stream": False
            },
            timeout=10 # Set a timeout for the request
        )
        response.raise_for_status() # Raise an exception for HTTP errors
        result = response.json()

        # Parse the 'response' field from Ollama's output
        if 'response' in result:
            raw_ollama_response_text = result['response'].strip()
            logger.debug(f"Raw Ollama response text: {raw_ollama_response_text}")

            # Attempt 1: Try to parse the entire response as JSON directly
            try:
                extracted_entities = json.loads(raw_ollama_response_text)
                if isinstance(extracted_entities, dict): # Or any other expected structure
                    logger.debug("Successfully parsed Ollama response as direct JSON.")
                    return extracted_entities
                else:
                    logger.warning(f"Ollama response parsed as JSON but is not a dict: {type(extracted_entities)}. Content: {raw_ollama_response_text}")
                    return None # Or handle as an error/unexpected format
            except json.JSONDecodeError:
                logger.debug("Ollama response is not a direct JSON object. Attempting conceptual text parsing...")
                # Attempt 2: Conceptual parsing for text embedding JSON (original placeholder)
                # This part is highly dependent on the actual output format of your Ollama model
                # and the prompt used. The following is a placeholder.
                try:
                    # Example: Ollama might return "Entities: {'artists': ['Artist'], 'tracks': ['Track']}"
                    # This assumes a prefix "Entities: " followed by a JSON string.
                    if "Entities: " in raw_ollama_response_text:
                        json_str_candidate = raw_ollama_response_text.split("Entities: ", 1)[-1].strip()
                        extracted_entities_from_text = json.loads(json_str_candidate)
                        logger.debug(f"Successfully parsed JSON from text after 'Entities: ' prefix: {json_str_candidate}")
                        return extracted_entities_from_text
                    else:
                        logger.warning(f"Ollama response does not contain 'Entities: ' prefix for conceptual parsing. Raw response: {raw_ollama_response_text}")
                        return None
                except json.JSONDecodeError:
                    logger.error(f"Failed to parse JSON from Ollama's text response after attempting conceptual split: {raw_ollama_response_text}")
                    return None
                except Exception as e_conceptual:
                    logger.error(f"Unexpected error during conceptual parsing of Ollama response: {e_conceptual}. Raw response: {raw_ollama_response_text}")
                    return None
        else:
            logger.warning("Ollama response JSON did not contain a 'response' field.")
            return None
    except requests.exceptions.RequestException as e:
        logger.error(f"Error calling Ollama: {e}")
        return None
    except Exception as e:
        logger.error(f"An unexpected error occurred with Ollama: {e}")
        return None
