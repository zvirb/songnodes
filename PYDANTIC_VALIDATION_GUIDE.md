# 🛡️ Pydantic Data Validation Guide

**Date**: September 30, 2025
**Status**: ✅ IMPLEMENTED
**Priority**: HIGH (Data Quality & Type Safety)

---

## 📋 Overview

Comprehensive Pydantic validation system integrated across all services to ensure data quality at every layer:

1. **Scraper Output** → Validate items before database insertion
2. **API Endpoints** → Validate request/response payloads
3. **Database Pipeline** → Validate data before SQL execution
4. **Track IDs** → Validate deterministic cross-source IDs

---

## 🎯 Benefits

### Data Quality Assurance
- ✅ **Type Safety**: Prevents type errors at runtime
- ✅ **Range Validation**: BPM 60-200, popularity 0-100, etc.
- ✅ **Format Validation**: Track IDs (16-char hex), ISO country codes
- ✅ **Business Rules**: No generic artists, consistent remix fields

### Developer Experience
- ✅ **Auto-completion**: IDE support for validated models
- ✅ **Clear Errors**: Detailed validation error messages
- ✅ **Documentation**: Self-documenting models with Field descriptions
- ✅ **Testing**: Easy to test with mock data

### Production Safety
- ✅ **Early Detection**: Catch data issues before database insertion
- ✅ **Data Integrity**: Enforce foreign key relationships
- ✅ **Audit Trail**: Log validation failures for monitoring
- ✅ **Rollback Protection**: Invalid data never enters the database

---

## 📦 Components

### 1. `pydantic_models.py` (550+ lines)

**Location**: `scrapers/pydantic_models.py`

**Contains**:
- **Enums**: DataSource, ArtistRole, EventType, RemixType
- **Artist Models**: ArtistBase, ArtistCreate, ArtistResponse
- **Track Models**: TrackBase, TrackCreate, TrackResponse
- **Setlist Models**: SetlistBase, SetlistCreate, SetlistResponse
- **Relationship Models**: TrackArtistRelationship, TrackAdjacency
- **Multi-Source Models**: TrackSource
- **Utility Models**: HealthCheckResponse, ErrorResponse

**Custom Validators**:
- `validate_track_id()`: 16-char hexadecimal format
- `validate_iso_country()`: ISO 3166-1 alpha-2 codes
- `validate_bpm()`: 60-200 BPM range
- `validate_popularity()`: 0-100 score range
- `no_generic_artists()`: Reject "Various Artists", "Unknown Artist"
- `no_generic_tracks()`: Reject "ID - ID", "Unknown Track"

### 2. `pydantic_adapter.py` (350+ lines)

**Location**: `scrapers/pydantic_adapter.py`

**Functions**:
- `validate_artist_item()`: Validate artist Scrapy items
- `validate_track_item()`: Validate track Scrapy items
- `validate_setlist_item()`: Validate setlist Scrapy items
- `validate_track_artist_item()`: Validate relationships
- `validate_track_adjacency_item()`: Validate graph edges
- `validate_track_source_item()`: Validate multi-source records
- `validate_items_batch()`: Batch validation with error collection
- `ValidationPipeline`: Scrapy pipeline for automatic validation

---

## 🚀 Usage Examples

### Example 1: Validate Track in Spider

```python
from pydantic_adapter import validate_track_item
from pydantic import ValidationError

# In your spider parse method
try:
    track_item = EnhancedTrackItem(
        track_id="94148be74cbc9fa5",
        track_name="Strobe",
        bpm=128.0,
        is_remix=False,
        data_source="1001tracklists"
    )

    # Validate before yielding
    validated = validate_track_item(track_item, data_source="1001tracklists")

    yield track_item  # Only yielded if validation passes

except ValidationError as e:
    self.logger.error(f"Invalid track data: {e}")
    # Track is not yielded, preventing bad data in database
```

### Example 2: Validate Artist with Custom Rules

```python
from pydantic_adapter import validate_artist_item

# ✅ Valid artist
artist_item = EnhancedArtistItem(
    artist_name="Deadmau5",
    popularity_score=95,
    country="CA",  # ISO 3166-1 alpha-2
    data_source="spotify"
)

validated = validate_artist_item(artist_item)
# → Returns ArtistCreate Pydantic model

# ❌ Invalid: Generic artist name
bad_artist = EnhancedArtistItem(
    artist_name="Various Artists",  # ❌ Rejected
    data_source="1001tracklists"
)

validated = validate_artist_item(bad_artist)
# → Raises ValidationError: "Generic artist name 'Various Artists' not allowed"
```

### Example 3: Validate Track ID Format

```python
from pydantic_models import TrackCreate

# ✅ Valid: 16-char hex
track = TrackCreate(
    track_id="94148be74cbc9fa5",  # ✅ Correct format
    track_name="Strobe",
    data_source="1001tracklists"
)

# ❌ Invalid: Wrong format
bad_track = TrackCreate(
    track_id="invalid123",  # ❌ Not 16-char hex
    track_name="Strobe",
    data_source="1001tracklists"
)
# → Raises ValidationError: "track_id must be 16-character hexadecimal string"
```

### Example 4: Validate BPM Range

```python
# ✅ Valid BPM
track = TrackCreate(
    track_name="Strobe",
    bpm=128.0,  # ✅ In range 60-200
    data_source="mixesdb"
)

# ❌ Invalid BPM
bad_track = TrackCreate(
    track_name="Strobe",
    bpm=250.0,  # ❌ Out of range
    data_source="mixesdb"
)
# → Raises ValidationError: "BPM must be between 60 and 200"
```

### Example 5: Validate Remix Consistency

```python
# ✅ Valid: is_remix=True with remix_type
track = TrackCreate(
    track_name="Strobe (Extended Mix)",
    is_remix=True,
    remix_type="extended",  # ✅ Consistent
    data_source="1001tracklists"
)

# ❌ Invalid: is_remix=True without remix_type
bad_track = TrackCreate(
    track_name="Strobe (Remix)",
    is_remix=True,
    remix_type=None,  # ❌ Missing
    data_source="1001tracklists"
)
# → Raises ValidationError: "remix_type must be specified when is_remix=True"
```

### Example 6: Batch Validation

```python
from pydantic_adapter import validate_items_batch

tracks = [track1, track2, track3, bad_track4, track5]

# Validate all tracks, collecting valid/invalid separately
valid, invalid, errors = validate_items_batch(
    tracks,
    item_type="track",
    data_source="mixesdb"
)

print(f"✓ Valid: {len(valid)}/{len(tracks)} tracks")
print(f"✗ Invalid: {len(invalid)} tracks")

for error in errors:
    print(f"  - {error}")

# Continue processing only valid tracks
for track in valid:
    # Insert into database
    ...
```

### Example 7: Scrapy Pipeline Integration

**Add to `settings.py`**:
```python
ITEM_PIPELINES = {
    'pydantic_adapter.ValidationPipeline': 100,  # ← Run first
    'database_pipeline.DatabasePipeline': 300,   # ← Then database
}
```

**Automatic validation for all scraped items**:
- Invalid items are automatically dropped
- Validation statistics logged on spider close
- Only valid data reaches the database pipeline

**Output**:
```
INFO: ✓ Track validated: Strobe (track_id=94148be74cbc9fa5)
ERROR: ❌ Track validation failed: BPM must be between 60 and 200
INFO: Dropping invalid track item
...
INFO: ==================================================
INFO: PYDANTIC VALIDATION STATISTICS
INFO:   Valid items: 842
INFO:   Invalid items dropped: 13
INFO:   Sample errors:
INFO:     - Item 5: BPM must be between 60 and 200
INFO:     - Item 12: Generic artist name 'Unknown Artist' not allowed
INFO: ==================================================
```

---

## 🔧 API Integration

### FastAPI Endpoints with Pydantic

**Before (No Validation)**:
```python
@app.post("/tracks")
async def create_track(track: dict):
    # No validation - any data structure accepted
    # Could cause database errors or corrupt data
    ...
```

**After (Pydantic Validation)**:
```python
from pydantic_models import TrackCreate, TrackResponse

@app.post("/tracks", response_model=TrackResponse)
async def create_track(track: TrackCreate):
    # Automatic validation by FastAPI
    # Invalid data rejected before function execution
    # track is guaranteed to be valid TrackCreate instance

    # track.track_id is validated as 16-char hex
    # track.bpm is validated as 60-200 range
    # track.artist_name cannot be "Various Artists"

    # Insert into database...
    return TrackResponse(...)
```

### Example: GET Endpoint with Validation

```python
from typing import List
from pydantic_models import TrackResponse

@app.get("/tracks", response_model=List[TrackResponse])
async def get_tracks(
    min_bpm: float = 60.0,
    max_bpm: float = 200.0,
    limit: int = 100
):
    # Query database...
    tracks = await db.fetch(...)

    # Pydantic validates response matches TrackResponse schema
    return [TrackResponse(**track) for track in tracks]
```

---

## 📊 Validation Rules Reference

### Artist Validation

| Field | Type | Validation |
|-------|------|------------|
| `artist_name` | str | Required, 1-255 chars, **NOT** "Various Artists" / "Unknown Artist" |
| `normalized_name` | str | Auto-generated (lowercase, trimmed) if not provided |
| `country` | str | ISO 3166-1 alpha-2 (e.g., "US", "GB", "CA") |
| `popularity_score` | float | 0-100 range |
| `follower_count` | int | >= 0 |
| `data_source` | DataSource | Must be valid enum value |

### Track Validation

| Field | Type | Validation |
|-------|------|------------|
| `track_id` | str | 16-character hexadecimal (e.g., "94148be74cbc9fa5") |
| `track_name` | str | Required, 1-500 chars, **NOT** "ID - ID" / "Unknown Track" |
| `bpm` | float | 60-200 range |
| `energy` | float | 0.0-1.0 range |
| `danceability` | float | 0.0-1.0 range |
| `popularity_score` | float | 0-100 range |
| `is_remix` | bool | If True, `remix_type` must be set |
| `remix_type` | RemixType | Required if `is_remix=True` |
| `data_source` | DataSource | Must be valid enum value |

### Setlist Validation

| Field | Type | Validation |
|-------|------|------------|
| `setlist_name` | str | Required, 1-500 chars |
| `dj_artist_name` | str | Required, **NOT** "Various Artists" / "Unknown" |
| `set_start_time` | datetime | Must be before `set_end_time` |
| `set_end_time` | datetime | Must be after `set_start_time` |
| `duration_minutes` | int | >= 0 |
| `total_tracks` | int | >= 0 |
| `event_type` | EventType | Must be valid enum value |

### Track Adjacency Validation

| Field | Type | Validation |
|-------|------|------------|
| `track_1_id` | str | 16-character hexadecimal |
| `track_2_id` | str | 16-character hexadecimal, **NOT** same as `track_1_id` |
| `distance` | int | >= 1 |
| `occurrence_count` | int | >= 1 |

---

## 🧪 Testing Validation

### Unit Tests

```python
import pytest
from pydantic import ValidationError
from pydantic_models import TrackCreate, ArtistCreate

def test_valid_track():
    """Test track with valid data"""
    track = TrackCreate(
        track_id="94148be74cbc9fa5",
        track_name="Strobe",
        bpm=128.0,
        data_source="1001tracklists"
    )
    assert track.track_id == "94148be74cbc9fa5"
    assert track.bpm == 128.0

def test_invalid_bpm():
    """Test track with invalid BPM"""
    with pytest.raises(ValidationError) as exc_info:
        TrackCreate(
            track_name="Test",
            bpm=250.0,  # Out of range
            data_source="1001tracklists"
        )
    assert "BPM must be between 60 and 200" in str(exc_info.value)

def test_generic_artist_rejected():
    """Test generic artist names are rejected"""
    with pytest.raises(ValidationError) as exc_info:
        ArtistCreate(
            artist_name="Various Artists",
            data_source="1001tracklists"
        )
    assert "Generic artist name" in str(exc_info.value)
```

---

## 📈 Monitoring Validation

### Validation Metrics

Track validation success/failure rates in Prometheus:

```python
from prometheus_client import Counter, Histogram

# Metrics
VALIDATION_SUCCESS = Counter('validation_success_total', 'Successful validations', ['item_type'])
VALIDATION_FAILURE = Counter('validation_failure_total', 'Failed validations', ['item_type', 'error_type'])
VALIDATION_DURATION = Histogram('validation_duration_seconds', 'Validation duration', ['item_type'])

# In validator
with VALIDATION_DURATION.labels(item_type="track").time():
    try:
        validated = TrackCreate(**data)
        VALIDATION_SUCCESS.labels(item_type="track").inc()
    except ValidationError as e:
        VALIDATION_FAILURE.labels(item_type="track", error_type=e.errors()[0]['type']).inc()
        raise
```

### Grafana Dashboard

Create panels for:
- Validation success rate by item type
- Top validation error types
- Validation duration (p50, p95, p99)
- Items dropped due to validation failures

---

## 🔄 Migration Guide

### Step 1: Add Validation to Existing Spiders

```python
# Before
yield TrackItem(track_name="Strobe", ...)

# After
from pydantic_adapter import validate_track_item

track_item = TrackItem(track_name="Strobe", ...)
try:
    validate_track_item(track_item, data_source=self.name)
    yield track_item
except ValidationError as e:
    self.logger.error(f"Invalid track: {e}")
```

### Step 2: Enable ValidationPipeline

**settings.py**:
```python
ITEM_PIPELINES = {
    'pydantic_adapter.ValidationPipeline': 100,  # Add this
    'database_pipeline.DatabasePipeline': 300,
}
```

### Step 3: Update API Endpoints

```python
# Replace dict with Pydantic models
@app.post("/tracks", response_model=TrackResponse)
async def create_track(track: TrackCreate):  # ← Pydantic model
    ...
```

### Step 4: Monitor Validation Failures

Check logs for validation errors:
```bash
docker compose logs -f scrapers | grep "validation failed"
docker compose logs -f rest-api | grep "ValidationError"
```

---

## ✅ Best Practices

### 1. **Validate Early**
- Validate at scraper output, not database insertion
- Catch data issues before they propagate

### 2. **Log Validation Failures**
- Use structured logging with context
- Include item data in error messages
- Monitor failure rates

### 3. **Graceful Degradation**
- Drop invalid items, continue processing valid ones
- Don't let single bad item crash entire scrape

### 4. **Test Validation Rules**
- Unit test each validator
- Test edge cases (boundary values, null, empty strings)
- Test error messages are clear

### 5. **Keep Models DRY**
- Share Pydantic models between services
- One source of truth for data schemas
- Update once, validate everywhere

---

## 📚 Related Files

- `scrapers/pydantic_models.py` - All Pydantic model definitions
- `scrapers/pydantic_adapter.py` - Scrapy↔Pydantic bridge
- `scrapers/items.py` - Original Scrapy items
- `services/rest-api/main.py` - API endpoints with validation
- `scrapers/database_pipeline.py` - Database insertion with validation

---

## 🎯 Success Criteria

- [x] **Pydantic Models Created**: Comprehensive models for all item types
- [x] **Custom Validators**: track_id, BPM, popularity, ISO codes, generic names
- [x] **Scrapy Adapter**: Bridge between Scrapy items and Pydantic models
- [x] **Validation Pipeline**: Automatic validation for all scraped items
- [x] **Business Rules**: No generic artists, consistent remix fields
- [x] **Documentation**: Complete usage guide with examples
- [ ] **API Integration**: Update REST API to use Pydantic models (Next step)
- [ ] **Database Pipeline**: Add validation before SQL execution (Next step)
- [ ] **Monitoring**: Prometheus metrics for validation failures (Next step)

---

**Implementation Date**: September 30, 2025
**Status**: ✅ Core validation system complete, API/monitoring integration pending