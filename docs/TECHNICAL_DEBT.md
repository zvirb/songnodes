# Technical Debt Registry

This document tracks known technical debt in the SongNodes codebase with prioritization and remediation plans.

## Active Technical Debt

### TD-001: RateLimiter Duplication (Low Priority)

**Status**: Deferred
**Priority**: Low
**Discovered**: 2025-10-10
**Component**: API clients, rate limiting

**Description**:

Two RateLimiter implementations exist in the codebase:

1. **Canonical** (`common/api_gateway/rate_limiter.py`, 473 lines)
   - Full token bucket algorithm
   - Prometheus metrics integration
   - Thread-safe (synchronous)
   - Multi-provider support
   - Rate prediction algorithms

2. **Duplicate** (`services/metadata-enrichment/api_clients.py`, lines 1127-1143, 17 lines)
   - Simple async interval-based rate limiting
   - No metrics
   - Used by 7 API clients (Spotify, MusicBrainz, Discogs, Beatport, LastFM, AcousticBrainz, GetSongBPM)

**Root Cause**:

The canonical rate limiter uses synchronous primitives (threading.Lock, time.sleep) while metadata-enrichment service requires async primitives (asyncio.Lock, asyncio.sleep) because all API clients are async/await based.

**Impact Assessment**:

- **Code Duplication**: ~17 lines (0.2% of codebase)
- **Maintenance Burden**: Low (simple implementation, rarely changes)
- **Functional Risk**: None (both implementations work correctly)
- **Performance Impact**: None (simple rate limiter is actually more efficient for this use case)

**Why Not Fixed Now**:

1. The simple async rate limiter is **appropriate for its use case**:
   - Each API client manages its own rate limiter instance
   - No multi-provider coordination needed
   - Metrics already tracked at circuit breaker level
   - Simple is sufficient and more maintainable

2. Fixing this would require **significant refactoring**:
   - Add async support to canonical rate limiter (complex)
   - Risk breaking existing synchronous users
   - Or create async wrapper (adds complexity)

3. **Low priority** compared to other quality improvements

**Remediation Options** (for future consideration):

- **Option A**: Add async/await support to canonical rate limiter
  - Create AsyncTokenBucket and AsyncRateLimiter classes
  - Preserve sync versions for backward compatibility
  - Estimate: 3-5 hours development + testing

- **Option B**: Extract shared interface
  - Define RateLimiterProtocol (typing.Protocol)
  - Keep both implementations, ensure API compatibility
  - Estimate: 1 hour

- **Option C**: Accept as permanent pattern
  - Simple async rate limiters for async contexts
  - Full canonical rate limiter for sync contexts with metrics
  - Zero effort, zero risk

**Recommendation**: Option C (accept as permanent pattern) unless metrics/prediction features are needed in async contexts.

**Related Items**:
- Circuit breaker consolidation (COMPLETED - Phase 1)
- See: `/mnt/my_external_drive/programming/songnodes/docs/ENRICHMENT_DELEGATION_MIGRATION.md`

---

## Resolved Technical Debt

### TD-000: Circuit Breaker Duplication (RESOLVED)

**Status**: Resolved
**Priority**: High
**Discovered**: 2025-10-10
**Resolved**: 2025-10-10
**Component**: API clients, circuit breaker pattern

**Description**:

Circuit breaker implementation was duplicated across multiple services (api-gateway, metadata-enrichment).

**Resolution**:

Consolidated to single canonical implementation at `common/api_gateway/circuit_breaker.py`. All services now import from shared module.

**Impact**:
- Removed ~120 lines of duplicate code
- Single source of truth for circuit breaker logic
- Consistent behavior across all API clients

**Files Modified**:
- `services/metadata-enrichment/api_clients.py` (line 19: import from common module)
- `services/api-gateway-internal/gateway.py` (import from common module)

---

## Technical Debt Guidelines

### Priority Levels

- **Critical**: Blocks production deployment, security risk, or data integrity issue
- **High**: Significant maintenance burden, performance impact, or architectural inconsistency
- **Medium**: Moderate duplication, quality concerns, or testing gaps
- **Low**: Minor duplication, acceptable for context, or cosmetic issues

### When to Defer

Defer technical debt when:
1. Current implementation is working correctly
2. Refactoring risk > benefit
3. Simple duplication is more maintainable than complex abstraction
4. Higher priority work exists

### When to Address

Address technical debt when:
1. Maintenance burden becomes significant
2. Duplication causes bugs or inconsistencies
3. New features would benefit from consolidation
4. Team has bandwidth during refactoring sprint

---

**Last Updated**: 2025-10-10
