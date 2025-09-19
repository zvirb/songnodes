import re
import requests
import json
import logging

logger = logging.getLogger(__name__)

def parse_track_string(track_string):
    """
    Parses a complex track string to extract primary artists, featured artists,
    remixer artists, track name, and identify if it's a remix or mashup.
    This is a generalized version of the logic from the research report. [3]
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

    original_string = track_string.strip()
    temp_string = original_string

    # 1. Extract and remove common parenthetical notes (e.g., (Acappella), (VIP), (Live Edit), (Co-Prod. by X))
    # This regex captures content in parentheses and removes the parentheses themselves
    # It's important to do this first to simplify the main track string
    parenthetical_notes_matches = re.findall(r"\((.*?)\)", temp_string)
    for note in parenthetical_notes_matches:
        if "remix" not in note.lower() and "mashup" not in note.lower() and "edit" not in note.lower():
            notes.append(note.strip())
            temp_string = temp_string.replace(f"({note})", "").strip()

    # 2. Identify and extract Remixers (e.g., "(Chris Lake Remix)", "(Tiësto Mashup)")
    remix_match = re.search(r"\((.*?)\s*Remix\)", temp_string, re.IGNORECASE)
    if remix_match:
        remixer_artists.append(remix_match.group(1).strip())
        temp_string = temp_string.replace(remix_match.group(0), "").strip()
        is_remix = True

    mashup_remix_match = re.search(r"\((.*?)\s*Mashup\)", temp_string, re.IGNORECASE)
    if mashup_remix_match:
        remixer_artists.append(mashup_remix_match.group(1).strip())
        temp_string = temp_string.replace(mashup_remix_match.group(0), "").strip()
        is_remix = True # A mashup can also be a remix

    # 3. Identify Mashups (e.g., "MAMI vs. Losing My Mind")
    # This should be done before general artist-track parsing if 'vs.' is the primary separator
    vs_match = re.search(r"^(.*?)\s*vs\.\s*(.*)$", temp_string, re.IGNORECASE)
    if vs_match:
        component1 = vs_match.group(1).strip()
        component2 = vs_match.group(2).strip()
        mashup_components.extend([comp.strip() for comp in re.split(r'\s*vs\.\s*', original_string) if comp.strip()])
        track_name = f"{component1} vs. {component2}"
        is_mashup = True

        # Try to parse artists from the full original string if it's a mashup
        artist_track_match = re.search(r"^(.*?)\s*-\s*(.*)$", original_string)
        if artist_track_match:
            primary_artists.extend([a.strip() for a in re.split(r'[&,]', artist_track_match.group(1))])
        else:
            # Fallback for multi-artist mashups where artists are part of the 'vs.' string
            all_artists_in_mashup_string = re.findall(r"([A-Za-z0-9\s\.]+)(?:\s*vs\.|\s*ft\.|\s*&|\s*-\s*|$)", original_string)
            primary_artists.extend([a.strip() for a in all_artists_in_mashup_string if a.strip()])

    else:
        # 4. Handle "Artist(s) ft. Featured Artist(s) - Track Name"
        ft_match = re.search(r"^(.*?)\s*ft\.\s*(.*?)\s*-\s*(.*)$", temp_string, re.IGNORECASE)
        if ft_match:
            primary_artists.extend([a.strip() for a in re.split(r'[&,]', ft_match.group(1))])
            featured_artists.extend([a.strip() for a in re.split(r'[&,]', ft_match.group(2))])
            track_name = ft_match.group(3).strip()
        else:
            # 5. Handle "Artist(s) - Track Name"
            artist_track_match = re.search(r"^(.*?)\s*-\s*(.*)$", temp_string)
            if artist_track_match:
                primary_artists.extend([a.strip() for a in re.split(r'[&,]', artist_track_match.group(1))])
                track_name = artist_track_match.group(2).strip()
            else:
                # 6. Fallback for simple track name with no explicit artist or complex structure
                track_name = temp_string.strip()
                # If no artist is explicitly identified, it might be an ID or implied from context
                pass # For now, leave primary_artists empty if not found

    # Handle "ID - ID" or "ID Remix" for final track_name/artist_name [3]
    if track_name.lower() == "id" and (not primary_artists or not any(primary_artists)):
        is_identified = False
        # Skip unidentified tracks instead of creating "Unknown Artist" entries
        return None
    elif "id remix" in track_name.lower() and (not remixer_artists or not any(remixer_artists)):
        is_identified = False
        # remixer_artists remains an empty list if no specific remixer identified
    else:
        is_identified = True

    # Clean up empty strings from lists
    primary_artists = [a for a in primary_artists if a]
    featured_artists = [a for a in featured_artists if a]
    remixer_artists = [a for a in remixer_artists if a]
    mashup_components = [c for c in mashup_components if c]

    return {
        "track_name": track_name,
        "primary_artists": primary_artists,
        "featured_artists": featured_artists,
        "remixer_artists": remixer_artists,
        "is_remix": is_remix,
        "is_mashup": is_mashup,
        "mashup_components": mashup_components,
        "is_identified": is_identified,
        "notes": notes
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