# NLP Processor API Documentation

## Overview

Enhanced NLP Processor service with spaCy integration for improved tracklist extraction in SongNodes.

**Version:** 2.0.0
**Port:** 8021
**Technologies:** FastAPI, spaCy 3.7.2, TextBlob, Redis

---

## Features

### Core Capabilities
- **Multi-Strategy Tracklist Extraction**: Combines spaCy NER, regex patterns, and heuristics
- **Timestamp Detection**: Supports [00:00] and 00:00 formats
- **Collaboration Detection**: Recognizes feat., ft., vs, x patterns
- **Format Analysis**: Identifies tracklist structure and format
- **Artist Name Extraction**: Music-specific entity recognition
- **Sentiment Analysis**: Analyzes text sentiment
- **Keyword Extraction**: Extracts music-related terms

### Extraction Strategies

1. **Structured Patterns (Confidence: 0.85-0.95)**
   - Bracketed timestamps: `[00:00] Artist - Track`
   - Plain timestamps: `00:00 Artist - Track`
   - Numbered lists: `1. Artist - Track`
   - With labels: `Artist - Track [Label]`

2. **spaCy NER (Confidence: 0.7-0.8)**
   - Named entity recognition
   - PERSON entities as artists
   - WORK_OF_ART entities as tracks
   - Collaboration pattern detection

3. **Fallback Patterns (Confidence: 0.5)**
   - Basic capitalization patterns
   - Artist - Track format detection

---

## API Endpoints

### 1. Health Check

**GET** `/health`

Check service status and model availability.

**Response:**
```json
{
  "status": "healthy",
  "service": "nlp-processor",
  "version": "2.0.0",
  "spacy_loaded": true,
  "tracklist_extractor_loaded": true
}
```

### 2. Extract Tracklist

**POST** `/extract_tracklist`

Extract tracklist from text using multi-strategy approach.

**Request:**
```json
{
  "text": "[00:00] Daft Punk - One More Time\n[03:45] Justice - D.A.N.C.E.",
  "source_url": "https://example.com/tracklist",
  "extract_timestamps": true
}
```

**Response:**
```json
{
  "tracks": [
    {
      "artist": "Daft Punk",
      "title": "One More Time",
      "timestamp": "00:00",
      "confidence": 0.95
    },
    {
      "artist": "Justice",
      "title": "D.A.N.C.E.",
      "timestamp": "03:45",
      "confidence": 0.95
    }
  ],
  "count": 2,
  "methods_used": ["spacy", "regex", "patterns"]
}
```

### 3. Analyze Text Structure

**POST** `/analyze_text`

Analyze text structure and format for debugging.

**Request:**
```json
{
  "text": "Your tracklist text here"
}
```

**Response:**
```json
{
  "entities": [
    {"text": "Daft Punk", "label": "PERSON"},
    {"text": "One More Time", "label": "WORK_OF_ART"}
  ],
  "sentences": 5,
  "tokens": 42,
  "pos_tags": [
    {"text": "Daft", "pos": "PROPN"},
    {"text": "Punk", "pos": "PROPN"}
  ],
  "format_analysis": {
    "has_timestamps": true,
    "has_numbering": false,
    "format_type": "bracketed_timestamps",
    "separator_type": "dash",
    "estimated_tracks": 2
  }
}
```

### 4. Extract Timestamps

**POST** `/extract_timestamps`

Extract only timestamps and their context.

**Request:**
```json
{
  "text": "[00:00] First track\n03:45 Second track"
}
```

**Response:**
```json
{
  "timestamps": [
    {"timestamp": "00:00", "context": "First track"},
    {"timestamp": "03:45", "context": "Second track"}
  ],
  "count": 2
}
```

### 5. Analyze General Text

**POST** `/analyze`

General text analysis for music-related entities.

**Request:**
```json
{
  "text": "Amazing techno set by Adam Beyer at Awakenings",
  "language": "en"
}
```

**Response:**
```json
{
  "entities": [
    {"type": "artist", "value": "Adam Beyer", "confidence": 0.8},
    {"type": "genre", "value": "Techno", "confidence": 0.9}
  ],
  "keywords": ["techno", "set", "amazing"],
  "sentiment": 0.8,
  "language": "en"
}
```

### 6. Extract Artists

**POST** `/extract-artists`

Extract artist names from text.

**Request:**
```json
{
  "text": "Track by Daft Punk feat. Pharrell Williams"
}
```

**Response:**
```json
{
  "artists": ["Daft Punk", "Pharrell Williams"],
  "confidence_scores": [0.9, 0.9]
}
```

### 7. Metrics

**GET** `/metrics`

Prometheus-compatible metrics.

**Response (text/plain):**
```
# HELP nlp_requests_total Total number of requests
# TYPE nlp_requests_total counter
nlp_requests_total 1234

# HELP nlp_errors_total Total number of errors
# TYPE nlp_errors_total counter
nlp_errors_total 5

# HELP nlp_uptime_seconds Uptime in seconds
# TYPE nlp_uptime_seconds gauge
nlp_uptime_seconds 86400

# HELP nlp_memory_bytes Memory usage in bytes
# TYPE nlp_memory_bytes gauge
nlp_memory_bytes 524288000

# HELP nlp_cpu_percent CPU usage percentage
# TYPE nlp_cpu_percent gauge
nlp_cpu_percent 12.5
```

---

## Usage Examples

### Python

```python
import requests

# Extract tracklist
response = requests.post(
    "http://localhost:8021/extract_tracklist",
    json={
        "text": """
        [00:00] Daft Punk - One More Time
        [03:45] Justice - D.A.N.C.E.
        [07:30] The Chemical Brothers - Block Rockin' Beats
        """,
        "extract_timestamps": True
    }
)

tracks = response.json()["tracks"]
for track in tracks:
    print(f"{track['timestamp']} - {track['artist']} - {track['title']}")
```

### cURL

```bash
# Extract tracklist
curl -X POST http://localhost:8021/extract_tracklist \
  -H "Content-Type: application/json" \
  -d '{
    "text": "[00:00] Daft Punk - One More Time",
    "extract_timestamps": true
  }'

# Health check
curl http://localhost:8021/health

# Get metrics
curl http://localhost:8021/metrics
```

### JavaScript/TypeScript

```typescript
const extractTracklist = async (text: string) => {
  const response = await fetch('http://localhost:8021/extract_tracklist', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text,
      extract_timestamps: true
    })
  });

  const data = await response.json();
  return data.tracks;
};
```

---

## Supported Tracklist Formats

### 1. Bracketed Timestamps
```
[00:00] Artist - Track Title
[03:45] Another Artist - Another Track
```

### 2. Plain Timestamps
```
00:00 Artist - Track Title
03:45 Another Artist - Another Track
```

### 3. Numbered Lists
```
1. Artist - Track Title
2. Another Artist - Another Track
```

### 4. With Labels
```
Artist - Track Title [Label Name]
Another Artist - Track (Remix Info)
```

### 5. Collaborations
```
Artist A feat. Artist B - Track Title
Artist X vs Artist Y - Track Title
Artist 1 x Artist 2 - Track Title
```

---

## Testing

### Run Test Suite

```bash
# Inside container or with Python environment
cd /app
python test_spacy.py
```

### Test Output
The test script validates:
- Structured timestamp extraction
- Unstructured text parsing
- Collaboration detection
- Format analysis
- Entity recognition

---

## Performance

### Resource Usage
- **Memory**: 1.5GB-3GB (with spaCy model)
- **CPU**: 1-2 cores recommended
- **Startup Time**: ~180 seconds (model loading)

### Benchmarks
- Simple tracklist (10 tracks): ~50ms
- Complex text (100 lines): ~200ms
- Entity recognition: ~100ms per document

---

## Error Handling

### Common Errors

**503 Service Unavailable**
```json
{
  "detail": "spaCy model not loaded"
}
```
Solution: Ensure model download completed during build.

**500 Internal Server Error**
```json
{
  "detail": "Extraction failed: [error message]"
}
```
Solution: Check input text format and service logs.

---

## Configuration

### Environment Variables

```bash
MODEL_PATH=/models              # Path for spaCy models
REDIS_HOST=redis               # Redis connection
DATABASE_URL=postgresql://...  # Database connection
```

### Docker Compose Resources

```yaml
deploy:
  resources:
    limits:
      cpus: '2.0'
      memory: 3G
    reservations:
      cpus: '1.0'
      memory: 1.5G
```

---

## Integration with Scrapers

All scrapers can use the NLP processor as a fallback:

```python
import requests

async def extract_tracklist_with_nlp(text: str) -> list:
    try:
        response = requests.post(
            f"{NLP_PROCESSOR_URL}/extract_tracklist",
            json={"text": text},
            timeout=60
        )
        if response.status_code == 200:
            return response.json()["tracks"]
    except Exception as e:
        logger.error(f"NLP extraction failed: {e}")
    return []
```

---

## Monitoring

### Health Check
- Endpoint: `GET /health`
- Interval: 60 seconds
- Timeout: 15 seconds
- Start Period: 180 seconds

### Metrics Collection
- Prometheus scraping on `/metrics`
- Request count tracking
- Error rate monitoring
- Memory and CPU usage

---

## Troubleshooting

### Model Not Loading
```bash
# Check model installation
docker compose exec nlp-processor python -c "import spacy; print(spacy.load('en_core_web_sm'))"

# Rebuild container
docker compose build nlp-processor && docker compose up -d nlp-processor
```

### Low Extraction Quality
1. Check input text format with `/analyze_text`
2. Review confidence scores in output
3. Consider using structured formats for better accuracy

### High Memory Usage
- Reduce concurrent requests
- Monitor with `docker stats nlp-processor`
- Adjust resource limits if needed

---

## Development

### Local Testing

```bash
# Install dependencies
pip install -r requirements.txt

# Download models
python download_models.py

# Run service
uvicorn main:app --reload --port 8021
```

### Adding New Patterns

Edit `tracklist_extractor.py` and add patterns to:
- `_extract_structured_patterns()` for regex patterns
- `_extract_with_spacy()` for NER-based extraction
- `_extract_fallback_patterns()` for last-resort patterns

---

## Version History

### 2.0.0 (2025-09-30)
- Added spaCy integration for NER
- Multi-strategy tracklist extraction
- Format analysis endpoint
- Timestamp extraction endpoint
- Enhanced collaboration detection
- Improved confidence scoring

### 1.0.0 (Initial)
- Basic NLP processing
- Music entity recognition
- Sentiment analysis
- Keyword extraction