# 🧠 Scraper NLP Integration Guide

## Overview

Not all scrapers require NLP processing. The NLP processor service (`nlp-processor:8021`) is only needed for scrapers that extract tracklists from **unstructured text** (descriptions, comments, etc.) rather than structured data.

---

## 📊 Scraper NLP Usage Matrix

| Scraper | Uses NLP? | Data Source | Reason |
|---------|-----------|-------------|---------|
| **1001tracklists** | ❌ No | API | Structured tracklist data from API |
| **MixesDB** | ❌ No | Web scraping | Structured HTML tables |
| **Setlist.fm** | ❌ No | API | Structured setlist data from API |
| **Reddit** | ❌ No | API + Spider | Uses its own pattern matching |
| **Mixcloud** | ❌ No | JSON extraction | `__NEXT_DATA__` has structured tracks |
| **SoundCloud** | ✅ **Yes** | Widget API + Text | Descriptions need NLP parsing |
| **YouTube** | ✅ **Yes** | Data API v3 + Text | Descriptions and comments need NLP |
| **Internet Archive** | ✅ **Yes** | Metadata API + Text | Audio descriptions need NLP parsing |
| **LiveTracklist** | ❌ No | Web scraping | Structured HTML lists/tables |
| **Resident Advisor** | ❌ No | JSON extraction | `__NEXT_DATA__` structured data |

---

## 🎯 NLP Service Purpose

The NLP processor (`services/nlp-processor/`) extracts structured tracklist data from unstructured text using:

1. **Named Entity Recognition (NER)** - Identifies artist and track names
2. **Pattern Matching** - Recognizes common tracklist formats
3. **Timestamp Extraction** - Parses time markers (00:00, 1:30, etc.)
4. **Track Relationship Detection** - Identifies "vs", "feat", "remix by" patterns

### Common Input Formats NLP Handles:

```
00:00 Artist Name - Track Title
01:15 Another Artist feat. Vocalist - Song Name
02:30 [Artist] Track (Original Mix)
03:45 DJ Name vs. Producer - Collaboration Track
```

---

## 🔗 Integration Pattern

### Scrapers That Use NLP

#### **SoundCloud Scraper** (`scraper-soundcloud:8016`)
```python
# Extracts tracklist from description
description = soundcloud_data['description']
tracks = await extract_tracklist_via_nlp(description)
```

**Why NLP Needed:** SoundCloud doesn't provide structured tracklist data. DJs manually write tracklists in descriptions with varying formats.

#### **YouTube Scraper** (`scraper-youtube:8017`)
```python
# Combines description + comments
video_description = youtube_data['description']
comments = get_video_comments(video_id)
full_text = f"{video_description}\n\n{''.join(comments)}"
tracks = await extract_tracklist_via_nlp(full_text)
```

**Why NLP Needed:** YouTube descriptions often contain manually typed tracklists. Sometimes tracklists are in pinned comments.

#### **Internet Archive Scraper** (`scraper-internetarchive:8018`)
```python
# Extracts from audio/collection metadata
metadata_text = archive_metadata['description']
tracks = await extract_tracklist_via_nlp(metadata_text)
```

**Why NLP Needed:** Archive.org descriptions for DJ mixes contain unstructured tracklist information.

---

## 🏗️ NLP Service Architecture

### Endpoint
```
POST http://nlp-processor:8021/extract_tracklist
Content-Type: application/json

{
  "text": "00:00 Daft Punk - One More Time\n01:30 Justice - D.A.N.C.E."
}
```

### Response
```json
{
  "tracks": [
    {
      "timestamp": "00:00",
      "artist": "Daft Punk",
      "title": "One More Time",
      "confidence": 0.95
    },
    {
      "timestamp": "01:30",
      "artist": "Justice",
      "title": "D.A.N.C.E.",
      "confidence": 0.92
    }
  ]
}
```

### Fallback Behavior
All NLP-using scrapers have **fallback basic pattern matching** if the NLP service is unavailable:

```python
async def extract_tracklist_via_nlp(text: str) -> List[Dict]:
    try:
        # Try NLP processor first
        response = await client.post(f"{NLP_PROCESSOR_URL}/extract_tracklist", json={"text": text})
        return response.json()['tracks']
    except Exception as e:
        logger.warning(f"NLP processor unavailable, using basic patterns: {e}")
        return parse_description_basic(text)  # Regex fallback
```

---

## 🚀 Docker Compose Dependencies

### NLP-Dependent Scrapers
```yaml
scraper-soundcloud:
  depends_on:
    - scraper-orchestrator
    - nlp-processor  # Required for tracklist extraction

scraper-youtube:
  depends_on:
    - scraper-orchestrator
    - nlp-processor  # Required for description parsing

scraper-internetarchive:
  depends_on:
    - scraper-orchestrator
    - nlp-processor  # Required for metadata parsing
```

### Non-NLP Scrapers
```yaml
scraper-mixcloud:
  depends_on:
    - scraper-orchestrator
    # No nlp-processor dependency - uses structured JSON

scraper-livetracklist:
  depends_on:
    - scraper-orchestrator
    # No nlp-processor dependency - scrapes structured HTML tables
```

---

## 📊 Performance Impact

### NLP Processing Time
- **Average**: 500-1000ms per description
- **Max**: 3 seconds for very long texts
- **Fallback (regex)**: 50-100ms

### When to Use NLP vs Structured Extraction

| Scenario | Recommended Approach | Example |
|----------|----------------------|---------|
| API returns structured tracks | ❌ No NLP | 1001tracklists API, Setlist.fm API |
| HTML has `<table>` or `<ul>` of tracks | ❌ No NLP | LiveTracklist, MixesDB |
| JSON with track arrays | ❌ No NLP | Mixcloud `__NEXT_DATA__` |
| Free-form text descriptions | ✅ Use NLP | YouTube descriptions, SoundCloud bios |
| User comments/forums | ✅ Use NLP | Reddit posts, YouTube comments |

---

## 🔧 NLP Service Configuration

### Environment Variables
```bash
# In docker-compose.yml for NLP-using scrapers
NLP_PROCESSOR_URL=http://nlp-processor:8021
```

### Health Check
```bash
curl http://localhost:8021/health
```

Expected response:
```json
{
  "status": "healthy",
  "service": "nlp-processor",
  "models_loaded": true
}
```

---

## 🐛 Troubleshooting

### NLP Service Not Responding
**Symptoms:** Scrapers fail with "NLP processor error"
**Solution:**
```bash
# Check if NLP service is running
docker compose ps nlp-processor

# View logs
docker compose logs nlp-processor

# Restart if needed
docker compose restart nlp-processor
```

### Low Extraction Quality
**Symptoms:** NLP returns very few tracks or incorrect data
**Causes:**
1. Text format doesn't match training patterns
2. Non-English text (model trained on English)
3. Very unusual formatting

**Solutions:**
- Improve basic regex fallback patterns
- Add training data for specific formats
- Use structured scraping instead when possible

### Fallback Always Triggers
**Symptoms:** Logs show "using basic patterns" consistently
**Cause:** NLP service unreachable
**Solution:**
```bash
# Verify network connectivity
docker compose exec scraper-youtube curl http://nlp-processor:8021/health
```

---

## 📈 Best Practices

### 1. Prefer Structured Data
Always try to find structured data sources before resorting to NLP text parsing:
- APIs with tracklist endpoints
- `__NEXT_DATA__` JSON in React apps
- Structured HTML tables

### 2. Implement Robust Fallbacks
Every NLP call should have a regex fallback for basic patterns.

### 3. Cache NLP Results
```python
# Check cache before calling NLP
cache_key = f"nlp:tracklist:{hash(text)}"
cached_result = await redis.get(cache_key)
if cached_result:
    return json.loads(cached_result)
```

### 4. Monitor NLP Success Rate
Track metrics:
- `nlp_calls_total{status="success|fallback|error"}`
- `nlp_extraction_time_seconds`
- `nlp_tracks_extracted_total`

---

## 📝 Summary

**3 out of 10 scrapers use NLP:**
- ✅ SoundCloud (unstructured descriptions)
- ✅ YouTube (descriptions + comments)
- ✅ Internet Archive (metadata text)

**7 scrapers don't need NLP:**
- ❌ 1001tracklists, MixesDB, Setlist.fm (APIs)
- ❌ Mixcloud, Resident Advisor (JSON extraction)
- ❌ LiveTracklist (structured HTML)
- ❌ Reddit (custom pattern matching)

**The NLP processor is only a dependency for scrapers dealing with unstructured user-generated text content.**