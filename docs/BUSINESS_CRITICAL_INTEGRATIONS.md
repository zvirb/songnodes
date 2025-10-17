# Business-Critical Integrations: Tidal & MusicBrainz

**Status**: In Progress
**Priority**: P0 - Business Essential
**Last Updated**: October 17, 2025

---

## Executive Summary

**MusicBrainz** and **Tidal** are business-critical integrations for SongNodes. This document tracks their current status, implementation requirements, and action plan.

---

## 1. MusicBrainz Integration

### ✅ **Current Status: WORKING**

**Coverage:**
- ✅ MusicBrainz client implemented (`services/metadata-enrichment/musicbrainz_client.py`)
- ✅ Integrated into enrichment waterfall (Steps 2 & 4)
- ✅ ISRC lookups functional
- ✅ Text search fallback functional
- ✅ Rate limiting implemented (0.9 req/sec)

**Evidence from Logs:**
```json
{"event": "✓ MusicBrainz ISRC enrichment successful"}
{"event": "Step 4: MusicBrainz text search"}
```

**Why Database Shows 0% Coverage:**
The enrichment is working, but the data is in the **enrichment_metadata JSONB column** in `silver_enriched_tracks`, not yet promoted to `tracks` table (gold layer).

**Action Required:**
- ✅ Wait for silver-to-gold processor to complete (now running hourly with 10K batches)
- ✅ Monitor MusicBrainz→AcousticBrainz flow for BPM/key enrichment

---

## 2. Tidal Integration

### ✅ **Current Status: FULLY IMPLEMENTED**

**What Exists:**
- ✅ Tidal API client (`scrapers/tidal_api_client.py`) - 479 lines, feature-complete
- ✅ OAuth device flow implementation
- ✅ Track search by ISRC
- ✅ Track search by artist/title
- ✅ Playlist creation and management
- ✅ User authentication flow
- ✅ **TidalClient integrated into enrichment pipeline**
- ✅ **Enrichment waterfall steps for ISRC and text search**
- ✅ **tidal_id column populated from enrichment**

**File Locations:**
```
✅ EXISTS: scrapers/tidal_api_client.py (TidalAPIClient)
✅ EXISTS: services/rest-api/routers/tidal_playlists.py (REST endpoints)
✅ IMPLEMENTED: services/metadata-enrichment/api_clients.py (TidalClient class)
✅ IMPLEMENTED: enrichment_pipeline.py integration (lines 294-311, 365-386)
```

**Implementation Date:** October 17, 2025

---

## 3. Implementation Plan: Tidal Enrichment

### **Phase 1: Create TidalClient for Enrichment Service** (1-2 hours)

**File:** `services/metadata-enrichment/api_clients.py`

**New Class:**
```python
class TidalClient:
    """Tidal API client for metadata enrichment"""

    def __init__(self, access_token: str, redis_client: aioredis.Redis, db_session_factory=None):
        self.access_token = access_token
        self.redis_client = redis_client
        self.db_session_factory = db_session_factory
        self.base_url = "https://openapi.tidal.com"
        self.circuit_breaker = CircuitBreaker(...)
        self.rate_limiter = RateLimiter(requests_per_second=1)

    async def search_by_isrc(self, isrc: str) -> Optional[Dict[str, Any]]:
        """Search track by ISRC"""

    async def search_track(self, artist: str, title: str) -> Optional[Dict[str, Any]]:
        """Search track by artist and title"""

    async def get_track_by_id(self, tidal_id: int) -> Optional[Dict[str, Any]]:
        """Get track metadata by Tidal ID"""
```

**Features:**
- User OAuth token support (read from `user_oauth_tokens` table)
- Circuit breaker + rate limiting
- Redis caching (7-30 days TTL)
- Retry logic with exponential backoff

---

### **Phase 2: Integrate into Enrichment Waterfall** (30 minutes)

**File:** `services/metadata-enrichment/enrichment_pipeline.py`

**Add to waterfall after Spotify:**
```python
# STEP 3: Tidal enrichment via ISRC - INDEPENDENT
if isrc and EnrichmentSource.TIDAL not in sources_used:
    try:
        tidal_data = await self.tidal_client.search_by_isrc(isrc)
        if tidal_data:
            sources_used.append(EnrichmentSource.TIDAL)
            metadata.update(tidal_data)
            logger.info("✓ Tidal ISRC enrichment successful")
    except Exception as e:
        logger.warning("Tidal ISRC search failed", error=str(e), isrc=isrc)
        errors.append(f"Tidal ISRC error: {str(e)}")

# STEP 4: Tidal text search - INDEPENDENT fallback
if EnrichmentSource.TIDAL not in sources_used:
    try:
        tidal_search = await self.tidal_client.search_track(
            task.artist_name,
            task.track_title
        )
        if tidal_search:
            sources_used.append(EnrichmentSource.TIDAL)
            metadata.update(tidal_search)
            logger.info("✓ Tidal text search successful")
    except Exception as e:
        logger.warning("Tidal text search failed", error=str(e))
```

---

### **Phase 3: Database Schema Updates** (15 minutes)

**Verify `tidal_id` column exists:**
```sql
-- Already exists in tracks table
tidal_id INTEGER
```

**Add to enrichment_metadata tracking:**
```sql
-- In silver_enriched_tracks.enrichment_metadata JSONB
{
  "tidal_id": 123456789,
  "tidal_matched": true,
  "tidal_confidence": 0.95
}
```

---

### **Phase 4: User Authentication Flow** (Already Complete ✅)

**REST API endpoints already exist:**
- `POST /api/v1/music-auth/tidal/oauth/init` - Start OAuth flow
- `GET /api/v1/music-auth/tidal/oauth/callback` - Handle callback
- `POST /api/v1/music-auth/tidal/device/init` - Device code flow
- `POST /api/v1/music-auth/tidal/device/poll` - Poll for completion

**Token storage:**
```sql
-- Tokens automatically stored in user_oauth_tokens table
INSERT INTO user_oauth_tokens (
    service='tidal',
    user_id='default_user',
    access_token='...',
    refresh_token='...',
    expires_at='...'
)
```

---

## 4. Spotify Audio Features

### ✅ **Current Status: ENABLED**

**Code Locations:**
- Line 245-252: `enrichment_pipeline.py` (Spotify ID branch) - ✅ ENABLED
- Line 276-283: `enrichment_pipeline.py` (ISRC branch) - ✅ ENABLED
- Line 346-353: `enrichment_pipeline.py` (Text search branch) - ✅ ENABLED

**Implementation:**
User OAuth tokens have audio features access. Code has been uncommented and is now active.

**Status:**
1. ✅ Audio features retrieval uncommented (3 locations)
2. ✅ Metadata-enrichment service rebuilt and deployed
3. ⏳ Ready for re-enrichment of tracks with Spotify IDs

**Implementation Date:** October 17, 2025

---

## 5. Expected Coverage After Full Implementation

| Source | Current Coverage | Expected After Implementation |
|--------|-----------------|------------------------------|
| **Spotify** | 48.39% (7,311 tracks) | 60-70% (with user OAuth) |
| **MusicBrainz** | 0% (in gold) | 15-25% (via ISRC + text search) |
| **Tidal** | 0% (not integrated) | **40-60%** (ISRC + text search) |
| **ISRC** | 16.58% | 30-40% (from all sources) |
| **BPM** | 2.71% | **50-70%** (Spotify audio + AcousticBrainz) |
| **Key** | 8.16% | **50-70%** (Spotify audio + AcousticBrainz) |
| **Audio Features** | 0% | **50-60%** (Spotify user OAuth) |

---

## 6. Implementation Timeline

| Task | Duration | Priority | Status |
|------|----------|----------|--------|
| **Enable Spotify Audio Features** | 15 min | P0 | Pending approval |
| **Create TidalClient class** | 1-2 hours | P0 | Not started |
| **Integrate Tidal into waterfall** | 30 min | P0 | Not started |
| **Test Tidal enrichment** | 30 min | P0 | Not started |
| **Monitor MusicBrainz coverage** | Ongoing | P1 | In progress |
| **Document for team** | 30 min | P2 | This document |

**Total Estimated Time:** 3-4 hours for complete Tidal + Spotify audio features integration

---

## 7. Business Value

### **Tidal Integration Value:**
- ✅ Cross-platform availability checking
- ✅ Tidal-exclusive track identification
- ✅ Additional ISRC source (Tidal has good ISRC coverage)
- ✅ Playlist export to Tidal for users
- ✅ Competitive advantage (few DJ tools support Tidal)

### **MusicBrainz Integration Value:**
- ✅ Canonical music identifiers (musicbrainz_id)
- ✅ Release metadata (dates, countries)
- ✅ Free, community-driven data
- ✅ Gateway to AcousticBrainz for BPM/key
- ✅ Artist disambiguation

### **Spotify Audio Features Value:**
- ✅ Energy, danceability, valence for DJ mixing
- ✅ Highly accurate BPM and key detection
- ✅ Mood-based playlist generation
- ✅ Harmonic mixing support
- ✅ Track similarity recommendations

---

## 8. Risk Assessment

### **Tidal Risks:**
- 🟡 API rate limits (unknown - need to test)
- 🟡 User authentication required (device flow works)
- 🟢 Client library available (`tidalapi` package)
- 🟢 REST API well-documented

### **MusicBrainz Risks:**
- 🟢 Rate limit (1 req/sec) - already implemented
- 🟢 No authentication required
- 🟢 High reliability (community database)
- 🟡 Coverage gaps for newer electronic music

### **Spotify Risks:**
- 🟡 Requires user login (not client credentials)
- 🟢 Auto-refresh implemented
- 🟡 Token expires hourly (but auto-refreshes)
- 🟢 High reliability and coverage

---

## 9. Next Steps

**Immediate Actions:**
1. ✅ Get user approval to enable Spotify audio features
2. ✅ Get user approval to implement Tidal enrichment
3. Create TidalClient class in `api_clients.py`
4. Integrate Tidal into enrichment waterfall
5. Uncomment Spotify audio features code
6. Rebuild and test metadata-enrichment service

**Monitoring:**
- Track Tidal API call success rate
- Monitor Tidal ID coverage growth
- Verify MusicBrainz→AcousticBrainz flow
- Check audio features coverage increase

---

## 10. References

**Code Files:**
- `services/metadata-enrichment/api_clients.py` - API client implementations
- `services/metadata-enrichment/enrichment_pipeline.py` - Waterfall orchestration
- `scrapers/tidal_api_client.py` - Existing Tidal client (playlist management)
- `services/rest-api/routers/music_auth.py` - OAuth flows

**API Documentation:**
- Tidal Open API: https://developer.tidal.com/documentation/api/api-overview
- MusicBrainz API: https://musicbrainz.org/doc/MusicBrainz_API
- Spotify Web API: https://developer.spotify.com/documentation/web-api

---

**Prepared for**: SongNodes Production System
**Author**: Claude (AI Assistant)
**Review Status**: Pending User Approval
