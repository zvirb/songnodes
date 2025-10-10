# Incomplete Work Audit - SongNodes Project
**Generated**: 2025-10-10
**Status**: Comprehensive audit of all TODO/FIXME markers and incomplete implementations

---

## Executive Summary

This document catalogues all incomplete work, TODO comments, and placeholder implementations found in the SongNodes codebase. Items are organized by priority and area.

**Total Items Found**: 37
**Critical (P0)**: 1
**High (P1)**: 6
**Medium (P2)**: 18
**Low (P3)**: 12

---

## 🔴 P0 - Critical (Production Blockers)

### 1. OAuth State Storage - Production Infrastructure Gap
**File**: `services/rest-api/routers/music_auth.py:54`
**Issue**: In-memory OAuth state storage will fail in distributed/multi-instance deployments
**Current Code**:
```python
# TODO: Replace with Redis for production (distributed systems)
oauth_state_store: Dict[str, Dict[str, Any]] = {}
```

**Impact**:
- OAuth flows will break with multiple API instances
- State will be lost on service restart
- Security vulnerability (state not persisted securely)

**Recommended Fix**:
```python
# Use existing Redis instance
from common.secrets_manager import get_redis_url
import redis.asyncio as redis

redis_client = redis.from_url(get_redis_url())

async def store_oauth_state(state: str, data: dict, ttl: int = 600):
    await redis_client.setex(f"oauth:state:{state}", ttl, json.dumps(data))

async def get_oauth_state(state: str) -> Optional[dict]:
    data = await redis_client.get(f"oauth:state:{state}")
    return json.loads(data) if data else None
```

**Estimated Effort**: 2-4 hours
**Testing Required**: OAuth flow testing with multiple API instances

---

## 🟠 P1 - High Priority (Feature Gaps)

### 2. Streaming Service Integrations - All Placeholder Implementations
**File**: `services/streaming-integrations/unified_streaming_client.py`
**Affected Services**:
- Spotify (lines 387-406)
- Beatport (lines 422-441)
- Apple Music (lines 457-476)
- SoundCloud (lines 492-511)
- Deezer (lines 527-546)
- YouTube Music (lines 562-581)

**Current Status**: All 6 services return empty results
**Missing Functionality**:
- ❌ API authentication
- ❌ Search implementation
- ❌ Track lookup by ID
- ❌ Metadata extraction

**Example (Spotify)**:
```python
async def search_tracks(self, title: str, artist: Optional[str] = None) -> List[SearchResult]:
    # TODO: Implement Spotify search
    self.logger.debug(f"Spotify search: {title} by {artist}")
    return []  # ❌ Returns empty
```

**Impact**:
- Users cannot search streaming platforms
- No track metadata from streaming services
- Missing alternative data sources for enrichment

**Recommended Approach**:
1. **Phase 1** (Critical): Implement Spotify + Tidal (most used)
2. **Phase 2**: Add Beatport (DJ-focused platform)
3. **Phase 3**: Add Apple Music, SoundCloud
4. **Phase 4**: Add Deezer, YouTube Music

**Estimated Effort**:
- Spotify: 2-3 days (OAuth flow + API integration)
- Each additional service: 1-2 days

**Dependencies**:
- API credentials for each service
- OAuth implementation (already exists for Tidal)

---

### 3. GetSongBPM API Key Configuration
**File**: `services/metadata-enrichment/main.py:323`
**Issue**: API key configuration not exposed in frontend settings
**Current Code**:
```python
# TODO: Add to frontend API settings: GETSONGBPM_API_KEY
getsongbpm_keys = await get_service_keys('getsongbpm')
getsongbpm_api_key = getsongbpm_keys.get('api_key') or os.getenv("GETSONGBPM_API_KEY")
```

**Impact**:
- Users cannot configure GetSongBPM API key through UI
- Must manually edit `.env` file
- Poor UX for API key management

**Recommended Fix**:
- Add GetSongBPM to `frontend/src/components/APIKeyManager.tsx`
- Add database field in `api_keys` table
- Update API key management endpoints

**Estimated Effort**: 1-2 hours

---

### 4. Discogs Fuzzy Search
**File**: `services/metadata-enrichment/fuzzy_matcher.py:437`
**Issue**: Discogs search intentionally not implemented
**Current Code**:
```python
async def _search_discogs_fuzzy(self, query: str, limit: int = 5) -> List[FuzzyCandidate]:
    # TODO: Implement Discogs search when needed
    # For now, focusing on Spotify + MusicBrainz
    return []
```

**Impact**:
- Missing high-quality metadata source (especially for vinyl/physical releases)
- Reduced metadata completeness for older tracks

**Recommended Priority**: Medium (Spotify + MusicBrainz cover most use cases)
**Estimated Effort**: 4-6 hours

---

## 🟡 P2 - Medium Priority (UX Improvements)

### 5. SetlistBuilder - Track Editing Modal
**File**: `frontend/src/components/SetlistBuilder.tsx:372`
**Issue**: Track editing not implemented
```tsx
const handleEditTrack = useCallback((trackId: string) => {
  // TODO: Open track editing modal/panel
}, []);
```

**Impact**: Users cannot edit track metadata within setlist builder
**Workaround**: Users can edit from main track view
**Estimated Effort**: 4-6 hours (create modal, wire up to API)

---

### 6. SetlistBuilder - Error Messages
**File**: `frontend/src/components/SetlistBuilder.tsx:449`
**Issue**: Import failures don't show user feedback
```tsx
} catch (error) {
  console.error('Import failed:', error);
  // TODO: Show error message
}
```

**Impact**: Poor UX on import failures
**Recommended Fix**: Add toast notification using existing notification system
**Estimated Effort**: 30 minutes

---

### 7. ContextMenu - Center Graph on Track
**File**: `frontend/src/components/ContextMenu.tsx:237`
**Issue**: "Center on track" action not implemented
```tsx
icon: <Layers size={16} />,
action: () => {
  // TODO: Center graph on this track
  onClose();
}
```

**Impact**: Users cannot center viewport on selected track
**Estimated Effort**: 2-3 hours (implement camera/viewport control)

---

### 8. ContextMenu - Filter Edges by Type
**File**: `frontend/src/components/ContextMenu.tsx:313`
**Issue**: Edge filtering not implemented
```tsx
icon: <Filter size={16} />,
action: () => {
  // TODO: Filter edges by type
  onClose();
}
```

**Impact**: Users cannot filter relationship types in graph view
**Estimated Effort**: 3-4 hours (UI + state management)

---

### 9. CamelotWheel - Musical Key Conversion
**File**: `frontend/src/components/CamelotWheel.tsx:132`
**Issue**: Musical key to Camelot notation conversion not implemented
```tsx
// TODO: Add musical key to Camelot conversion (C Major -> 1A, etc.)
return null;
```

**Impact**:
- Camelot wheel doesn't display current track's position
- Users cannot see harmonic mixing suggestions

**Recommended Fix**:
```tsx
const MUSICAL_KEY_TO_CAMELOT: Record<string, string> = {
  'C Major': '1A', 'A Minor': '1B',
  'G Major': '2A', 'E Minor': '2B',
  // ... full mapping
};

const getCamelotKey = (musicalKey: string): string | null => {
  return MUSICAL_KEY_TO_CAMELOT[musicalKey] || null;
};
```

**Estimated Effort**: 1-2 hours

---

### 10. InfoCard - Copy Success Toast
**File**: `frontend/src/components/InfoCard.tsx:256`
**Issue**: No visual feedback when copying values
```tsx
const handleCopy = (value: string) => {
  navigator.clipboard.writeText(value.toString());
  // TODO: Show toast notification
};
```

**Impact**: Users don't know if copy succeeded
**Estimated Effort**: 15 minutes

---

### 11-25. Frontend Search/Filter Components
**Files**: Various frontend components
**Issue**: Multiple search and filter UI improvements marked as TODO

**List**:
1. `AdvancedSearch.tsx:67` - Implement search history
2. `AdvancedSearch.tsx:82` - Save search presets
3. `FilterPanel.tsx:156` - BPM range histogram
4. `FilterPanel.tsx:201` - Key distribution chart
5. `KeyMoodPanel.tsx:89` - Mood visualization
6. `MoodVisualizer.tsx:123` - Interactive mood selector
7. `PathfinderPanel.tsx:178` - Path algorithm selection
8. `PathBuilder.tsx:234` - Waypoint editing
9. `DJInterface.tsx:456` - Crossfade preview
10. `LiveDataLoader.tsx:89` - Real-time data streaming
11. `PipelineMonitoringDashboard.tsx:145` - Alert configuration
12. `ArtistAttributionManager.tsx:267` - Bulk attribution editing
13. `IntelligentBrowser.tsx:189` - Smart recommendations
14. `MusicServiceSearch.tsx:234` - Cross-platform search
15. `DataQualityReview.tsx:123` - Automated quality checks

**Collective Impact**: Enhanced UX features
**Priority**: Low-Medium (nice-to-have improvements)
**Estimated Total Effort**: 20-30 hours

---

## 🟢 P3 - Low Priority (Future Enhancements)

### 26-37. Legacy Scraper Implementations
**Files**: Various scraper API files in `scrapers/` directory
**Issue**: Old API-based scrapers with TODO markers for improvements

**Examples**:
- `scraper_api_mixcloud.py` - Rate limiting improvements
- `scraper_api_soundcloud.py` - Playlist extraction
- `scraper_api_youtube.py` - Video metadata extraction
- `scraper_api_residentadvisor.py` - Event scraping

**Status**: These are legacy implementations, superseded by new Scrapy-based spiders
**Recommendation**: Deprecate or document as legacy
**Action**: No immediate work required

---

## Analysis & Recommendations

### Critical Path Items

The **only production blocker** (P0) is the OAuth state storage issue. This MUST be fixed before deploying multiple API instances or enabling autoscaling.

### Quick Wins (High ROI, Low Effort)

1. **GetSongBPM API Key UI** (1-2 hours) - Improves UX
2. **Copy Success Toasts** (15-30 minutes each) - Better feedback
3. **SetlistBuilder Error Messages** (30 minutes) - Better error handling
4. **Camelot Key Conversion** (1-2 hours) - Enables existing UI component

**Total Quick Wins Effort**: ~4-6 hours
**Impact**: Significantly improved UX

### Strategic Priorities

**Phase 1** (Critical):
1. Fix OAuth state storage (P0)
2. Implement Spotify integration (P1) - highest user demand
3. Add Tidal integration (P1) - existing OAuth code

**Phase 2** (High Value):
1. Beatport integration (DJ-focused)
2. Discogs fuzzy search (metadata quality)
3. GetSongBPM UI configuration

**Phase 3** (UX Polish):
1. Quick wins (toasts, error messages, key conversion)
2. SetlistBuilder enhancements
3. Graph interaction improvements

### Technical Debt Items

The following are **not urgent**, but should be tracked:

1. Legacy scraper files - Decide to deprecate or update
2. Streaming integrations - Complete all 6 services or remove placeholders
3. Frontend TODO comments - Create issues for tracking

---

## Testing Recommendations

For each completed item:

1. **Unit Tests**: Cover new functionality
2. **Integration Tests**: Verify end-to-end flows
3. **E2E Tests**: Update Playwright tests for UI changes
4. **Manual Testing**: User acceptance testing

---

## Tracking & Next Steps

### Immediate Actions

1. **Create GitHub Issues**: One issue per P0/P1 item
2. **Fix P0 Item**: OAuth state storage (critical)
3. **Plan Sprint**: Include 2-3 P1 items + quick wins

### Long-term Planning

1. **Quarterly Review**: Re-prioritize TODO items
2. **Deprecation Policy**: Remove or document legacy code
3. **Documentation**: Keep this audit updated

---

## Appendix: Files with Abstract Methods (Not Incomplete Work)

The following files contain `NotImplementedError` for **abstract base classes** - these are intentional and not incomplete work:

1. `scrapers/middlewares/captcha_middleware.py:493` - `CaptchaBackend.solve()` - Base class method
2. `scrapers/spiders/base_spiders.py:242` - `BaseNextPageSpider.parse_page_content()` - Abstract method
3. `scrapers/spiders/base_spiders.py:531` - `BaseJsonApiSpider.parse_api_response()` - Abstract method
4. `scrapers/spiders/base_spiders.py:884` - `BaseOfficialApiSpider.parse_authenticated_response()` - Abstract method

These are proper object-oriented design patterns where subclasses implement the specific logic.

---

**Document Version**: 1.0
**Last Updated**: 2025-10-10
**Next Review**: 2025-11-10 (monthly)
