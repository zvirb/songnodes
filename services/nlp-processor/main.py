"""NLP Processor Service for SongNodes"""
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import logging
import time
import psutil
import os
import re
import spacy
from textblob import TextBlob
import numpy as np
from pathlib import Path

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Metrics tracking
start_time = time.time()
request_count = 0
error_count = 0

class MusicNLPProcessor:
    """Enhanced NLP processor for music-related text analysis"""

    def __init__(self):
        self.nlp = None
        self.music_genres = {
            # Electronic genres
            'house', 'tech house', 'deep house', 'progressive house', 'electro house',
            'techno', 'minimal techno', 'acid techno', 'industrial techno',
            'trance', 'progressive trance', 'psytrance', 'uplifting trance',
            'dubstep', 'future bass', 'trap', 'drum and bass', 'dnb', 'jungle',
            'ambient', 'downtempo', 'chillout', 'lounge',
            'electronica', 'electronic', 'edm', 'synthwave', 'synthpop',
            # Hip-hop genres
            'hip hop', 'rap', 'trap', 'boom bap', 'drill', 'grime',
            # Rock genres
            'rock', 'alternative rock', 'indie rock', 'punk rock', 'hard rock',
            'metal', 'heavy metal', 'death metal', 'black metal',
            # Pop genres
            'pop', 'indie pop', 'synthpop', 'electropop', 'k-pop',
            # Other
            'jazz', 'classical', 'reggae', 'ska', 'funk', 'soul', 'r&b',
            'country', 'folk', 'blues', 'gospel'
        }

        self.music_keywords = {
            # Instruments
            'guitar', 'bass', 'drums', 'piano', 'keyboard', 'synthesizer', 'synth',
            'violin', 'saxophone', 'trumpet', 'vocals', 'microphone',
            # Production terms
            'beat', 'rhythm', 'melody', 'harmony', 'tempo', 'bpm', 'mix', 'remix',
            'track', 'song', 'album', 'ep', 'single', 'compilation',
            'studio', 'recording', 'mastering', 'production', 'producer',
            # Performance terms
            'concert', 'gig', 'tour', 'festival', 'venue', 'stage', 'live',
            'performance', 'setlist', 'encore', 'dj set', 'mix',
            # Audio terms
            'sound', 'audio', 'frequency', 'bass', 'treble', 'eq', 'effects',
            'reverb', 'delay', 'compression', 'distortion'
        }

        # Common DJ/Artist name patterns
        self.artist_patterns = [
            r'\b[A-Z][a-z]+\s+[A-Z][a-z]+\b',  # First Last
            r'\b[A-Z]{2,}\b',  # All caps (like DJ names)
            r'\bDJ\s+[A-Z][a-z]+\b',  # DJ Name
            r'\b[A-Z][a-z]+\s+[A-Z]\b',  # Name Initial
            r'\b[A-Z][a-z]+\d+\b',  # Name with numbers
        ]

        self.load_model()

    def load_model(self):
        """Load spaCy model with fallback"""
        try:
            # Try to load English model
            self.nlp = spacy.load("en_core_web_sm")
            logger.info("Loaded spaCy en_core_web_sm model")
        except OSError:
            try:
                # Fallback to base model
                self.nlp = spacy.load("en_core_web_md")
                logger.info("Loaded spaCy en_core_web_md model")
            except OSError:
                logger.warning("No spaCy model found, using rule-based processing")
                self.nlp = None

    def extract_entities(self, text: str) -> List[Dict[str, Any]]:
        """Extract music-related entities from text"""
        entities = []
        text_lower = text.lower()

        # Extract genres
        for genre in self.music_genres:
            if genre in text_lower:
                entities.append({
                    "type": "genre",
                    "value": genre.title(),
                    "confidence": 0.9,
                    "position": text_lower.find(genre)
                })

        # Extract artists using patterns
        artists = self.extract_artist_names(text)
        for artist, confidence in artists:
            entities.append({
                "type": "artist",
                "value": artist,
                "confidence": confidence,
                "position": text.find(artist)
            })

        # Extract music keywords
        for keyword in self.music_keywords:
            if keyword in text_lower:
                entities.append({
                    "type": "music_term",
                    "value": keyword,
                    "confidence": 0.8,
                    "position": text_lower.find(keyword)
                })

        # Use spaCy if available for additional entities
        if self.nlp:
            doc = self.nlp(text)
            for ent in doc.ents:
                if ent.label_ in ["PERSON", "ORG", "GPE"]:
                    entities.append({
                        "type": "named_entity",
                        "value": ent.text,
                        "confidence": 0.7,
                        "label": ent.label_,
                        "position": ent.start_char
                    })

        # Remove duplicates and sort by position
        unique_entities = []
        seen = set()
        for entity in sorted(entities, key=lambda x: x.get("position", 0)):
            key = (entity["type"], entity["value"].lower())
            if key not in seen:
                seen.add(key)
                unique_entities.append(entity)

        return unique_entities[:10]  # Limit to top 10

    def extract_artist_names(self, text: str) -> List[tuple]:
        """Extract potential artist names using regex patterns"""
        artists = []

        for pattern in self.artist_patterns:
            matches = re.finditer(pattern, text)
            for match in matches:
                name = match.group()
                # Filter out common non-artist words
                if name.lower() not in ['the', 'and', 'with', 'feat', 'featuring']:
                    confidence = 0.8 if len(name.split()) > 1 else 0.6
                    artists.append((name, confidence))

        # Look for "by Artist" or "feat. Artist" patterns
        by_patterns = [
            r'by\s+([A-Z][a-zA-Z\s]+)',
            r'feat\.?\s+([A-Z][a-zA-Z\s]+)',
            r'featuring\s+([A-Z][a-zA-Z\s]+)',
            r'vs\.?\s+([A-Z][a-zA-Z\s]+)',
            r'&\s+([A-Z][a-zA-Z\s]+)'
        ]

        for pattern in by_patterns:
            matches = re.finditer(pattern, text, re.IGNORECASE)
            for match in matches:
                name = match.group(1).strip()
                if len(name) > 2:
                    artists.append((name, 0.9))

        return artists[:5]  # Limit to top 5

    def analyze_sentiment(self, text: str) -> float:
        """Analyze sentiment of text"""
        try:
            blob = TextBlob(text)
            # Convert from -1,1 range to 0,1 range
            sentiment = (blob.sentiment.polarity + 1) / 2
            return round(sentiment, 3)
        except Exception as e:
            logger.warning(f"Sentiment analysis failed: {e}")
            return 0.5  # Neutral default

    def extract_keywords(self, text: str) -> List[str]:
        """Extract relevant keywords from text"""
        keywords = []
        text_lower = text.lower()

        # Add music-related keywords found in text
        for keyword in self.music_keywords:
            if keyword in text_lower:
                keywords.append(keyword)

        # Add genre keywords
        for genre in self.music_genres:
            if genre in text_lower:
                keywords.append(genre)

        # Use spaCy for additional keyword extraction if available
        if self.nlp:
            doc = self.nlp(text)
            for token in doc:
                if (token.pos_ in ["NOUN", "ADJ"] and
                    len(token.text) > 3 and
                    not token.is_stop and
                    token.text.lower() not in keywords):
                    keywords.append(token.text.lower())

        return list(set(keywords))[:8]  # Limit to 8 unique keywords

# Initialize NLP processor
nlp_processor = MusicNLPProcessor()

app = FastAPI(
    title="NLP Processor Service",
    description="Natural Language Processing for music data",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class TextAnalysisRequest(BaseModel):
    text: str
    language: str = "en"

class TextAnalysisResponse(BaseModel):
    entities: List[Dict[str, Any]]
    keywords: List[str]
    sentiment: float
    language: str

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "nlp-processor",
        "version": "1.0.0"
    }

@app.get("/metrics", response_class=PlainTextResponse)
async def metrics():
    """Prometheus-compatible metrics endpoint"""
    global request_count, error_count, start_time

    uptime = time.time() - start_time
    process = psutil.Process(os.getpid())
    memory_info = process.memory_info()

    metrics_text = f"""# HELP nlp_requests_total Total number of requests
# TYPE nlp_requests_total counter
nlp_requests_total {request_count}

# HELP nlp_errors_total Total number of errors
# TYPE nlp_errors_total counter
nlp_errors_total {error_count}

# HELP nlp_uptime_seconds Uptime in seconds
# TYPE nlp_uptime_seconds gauge
nlp_uptime_seconds {uptime}

# HELP nlp_memory_bytes Memory usage in bytes
# TYPE nlp_memory_bytes gauge
nlp_memory_bytes {memory_info.rss}

# HELP nlp_cpu_percent CPU usage percentage
# TYPE nlp_cpu_percent gauge
nlp_cpu_percent {process.cpu_percent()}
"""

    return metrics_text

@app.post("/analyze", response_model=TextAnalysisResponse)
async def analyze_text(request: TextAnalysisRequest):
    """Analyze text for music-related entities and sentiment"""
    global request_count, error_count
    request_count += 1

    try:
        # Extract entities using the music NLP processor
        entities = nlp_processor.extract_entities(request.text)

        # Extract keywords
        keywords = nlp_processor.extract_keywords(request.text)

        # Analyze sentiment
        sentiment = nlp_processor.analyze_sentiment(request.text)

        logger.info(f"Analyzed text: {len(request.text)} chars, found {len(entities)} entities")

        return TextAnalysisResponse(
            entities=entities,
            keywords=keywords,
            sentiment=sentiment,
            language=request.language
        )
    except Exception as e:
        error_count += 1
        logger.error(f"Analysis failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/extract-artists")
async def extract_artists(request: TextAnalysisRequest):
    """Extract artist names from text"""
    global request_count, error_count
    request_count += 1

    try:
        # Extract artists using the music NLP processor
        artist_data = nlp_processor.extract_artist_names(request.text)

        if artist_data:
            artists, confidence_scores = zip(*artist_data)
        else:
            artists, confidence_scores = [], []

        logger.info(f"Extracted {len(artists)} artists from text")

        return {
            "artists": list(artists),
            "confidence_scores": list(confidence_scores)
        }
    except Exception as e:
        error_count += 1
        logger.error(f"Artist extraction failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8021)