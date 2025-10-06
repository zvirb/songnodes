# Phase 2: Probabilistic Matcher (Tier 2) - Future Enhancement

**Status**: 📋 **PLANNED - NOT IMPLEMENTED**
**Date**: October 6, 2025
**Priority**: Medium (after Phase 1 proves successful)

---

## Executive Summary

**Phase 2** will add the **Probabilistic Matcher (Tier 2)** to resolve artist names for tracks that remain unidentified after Label Hunter (Phase 1) and internal database lookup (Tier 1).

This enhancement is **deferred** to focus Phase 1 resources on the primary bottleneck (label scarcity). Phase 2 will be evaluated based on:
- Phase 1 success metrics
- Remaining "ID - ID" track volume
- Business priorities and budget
- Songstats API licensing decision

---

## Why Phase 2 is Deferred

### Strategic Decision
Per user directive: **"please use option 3"** - Focus on Label Hunter first, defer probabilistic matcher.

### Reasoning
1. **Label Hunter solves 60-75% of the problem alone**
   - Primary bottleneck: 95.9% of failed tracks lack labels
   - Phase 1 addresses this directly

2. **Probabilistic Matcher is more complex**
   - Requires commercial Songstats API license
   - Needs splink library integration (4-6 hours)
   - More sophisticated than Label Hunter

3. **Higher ROI from Phase 1**
   - Label Hunter: 2 days development, 200-280 tracks recovered
   - Probabilistic Matcher: 1-2 weeks development, uncertain recovery rate

4. **Risk Management**
   - Phase 1 uses free, legally-safe data sources
   - Phase 2 requires commercial licensing evaluation

---

## What's Included in Phase 2 (When Implemented)

### 1. Songstats API Integration
**Status**: ✅ Client created (`songstats_client.py`), ❌ NOT integrated

**Purpose**: Legal, structured access to 1001Tracklists DJ support data

**Key Features**:
- ISRC-based track lookup
- DJ support history retrieval
- Setlist context extraction
- Commercial API compliance

**Strategic Value**:
- Eliminates fragile web scraping
- Legally compliant data access
- Structured, validated data
- No maintenance burden

**Licensing Required**: Contact Songstats for commercial API access

### 2. splink Library Integration
**Status**: ❌ NOT STARTED

**Purpose**: Production-ready probabilistic record linkage

**Implementation Tasks**:
1. Add `splink==3.9.13` to requirements.txt
2. Refactor `cooccurrence_analyzer.py` to use splink
3. Define comparison levels:
   - `dj_is_candidate`
   - `artist_played_before/after`
   - `label_match_before/after`
   - `dj_label_owner`
4. Implement Expectation-Maximization training
5. Replace manual probability calculation with splink's `predict()` method

**Estimated Effort**: 4-6 hours

**Strategic Value**:
- Battle-tested algorithm (Fellegi-Sunter model)
- Unsupervised learning (no labeled data needed)
- Interactive diagnostic tools
- Better than custom probability calculations

### 3. Co-Occurrence Analyzer Enhancement
**Status**: ✅ Core logic exists, ❌ Needs data source integration

**Current State**:
- Algorithm implemented in `cooccurrence_analyzer.py`
- Manual probability calculations (should use splink)
- No data acquisition strategy

**Phase 2 Enhancements**:
- Connect to Songstats API for DJ support data
- Integrate splink for probabilistic matching
- Add setlist context window analysis
- Implement artist candidate ranking

### 4. Additional Enhancements

#### Cool-Down Queue Jitter
**Status**: ❌ NOT STARTED
**Estimated Effort**: 30 minutes

Add random jitter to exponential backoff to prevent thundering herd:
```python
import random

def _calculate_cooldown_period(...) -> int:
    base_cooldown = ... # existing logic

    # Add jitter (±10% random variation)
    jitter_percent = random.uniform(-0.1, 0.1)
    jittered_cooldown = int(base_cooldown * (1 + jitter_percent))

    return jittered_cooldown
```

#### Proxy Rotation for Web Scrapers
**Status**: ❌ NOT STARTED
**Estimated Effort**: 4-8 hours

Enhance web scraping reliability with proxy rotation to avoid IP bans.

---

## Expected Impact (Phase 2)

### Target Problem
- Tracks with artist = "ID - ID" or unknown artist
- Estimated volume: TBD after Phase 1 completion

### Expected Recovery
- Additional 50-100 tracks (estimate)
- Success rate improvement: +5-10% (on top of Phase 1)

### ROI Analysis
- **Development time**: 1-2 weeks
- **Licensing cost**: Songstats API (pricing TBD)
- **Maintenance burden**: Medium (API dependency)
- **Value**: Depends on remaining "ID - ID" volume after Phase 1

---

## Prerequisites for Phase 2

### Before Starting Phase 2
1. ✅ **Phase 1 deployed successfully**
2. ✅ **Phase 1 metrics collected** (30-60 days)
3. ❌ **Songstats API license obtained**
4. ❌ **Business case approved** (based on Phase 1 results)
5. ❌ **Remaining "ID - ID" volume assessed**

### Decision Criteria
Proceed with Phase 2 if:
- Phase 1 achieves target success rate (80-85%)
- Significant "ID - ID" track volume remains (>100 tracks)
- Songstats licensing cost is justified by expected recovery
- Business priorities support further enrichment investment

---

## Implementation Timeline (When Approved)

### Week 1: Data Acquisition
- Day 1-2: Songstats API integration testing
- Day 3-4: Connect Songstats to co-occurrence analyzer
- Day 5: Integration testing

### Week 2: Algorithm Enhancement
- Day 1-3: splink library integration
- Day 4: Expectation-Maximization training
- Day 5: Testing and validation

### Week 3: Polish and Deploy
- Day 1-2: Cool-down queue jitter
- Day 3-4: Comprehensive testing
- Day 5: Documentation and deployment

---

## Architecture Diagram (Phase 2)

```
┌─────────────────────────────────────────────────────────────┐
│  Track: "Frozen Ground" (artist=Unknown, label=NULL)         │
└──────────────────────┬──────────────────────────────────────┘
                       │
          ┌────────────▼───────────────┐
          │  TIER 0: Label Hunter       │
          │  (PHASE 1 - COMPLETE)       │
          │  Priority 2: MusicBrainz ✅ │
          └────────────┬───────────────┘
                       │ Found: "Anjunabeats"
          ┌────────────▼───────────────┐
          │  TIER 1: Internal DB        │
          │  Artist-label association   │
          │  (EXISTING)                 │
          └────────────┬───────────────┘
                       │ ❌ Not found
          ┌────────────▼───────────────┐
          │  TIER 2: Probabilistic      │
          │  (PHASE 2 - DEFERRED)       │
          │                             │
          │  DATA: Songstats API ⏭️     │
          │  ALGO: splink ⏭️            │
          │  Co-Occurrence Analysis     │
          └────────────┬───────────────┘
                       │ ✅ Found: "Ilan Bluestone" (92% prob)
          ┌────────────▼───────────────┐
          │  TIER 3: Feedback Loop      │
          │  Update track               │
          │  Enrich internal DB         │
          └────────────────────────────┘
```

---

## Files Created (Not Integrated)

### New Files ✅
- `songstats_client.py` (300 lines) - Songstats API client (ready but not integrated)
- `STRATEGIC_ALIGNMENT_CORRECTIONS.md` - Gap analysis and corrective plan

### Files Requiring Modification (Phase 2)
- `cooccurrence_analyzer.py` - Needs splink integration and Songstats connection
- `cooldown_queue.py` - Needs jitter addition
- `requirements.txt` - Needs splink addition
- `main.py` - Add probabilistic matcher endpoint

---

## Dependencies (Phase 2 Only)

### Required Additions to requirements.txt
```python
splink==3.9.13  # Probabilistic record linkage
```

### External Services
```
Songstats API - Commercial license required
Contact: https://songstats.com/api
```

---

## Success Metrics (When Deployed)

### Key Metrics
1. **Probabilistic Match Success Rate**
   - Target: >80% of "ID - ID" tracks resolved

2. **Confidence Distribution**
   - High confidence (>0.85): >60% of matches
   - Medium confidence (0.70-0.85): <30% of matches
   - Low confidence (<0.70): <10% of matches (reject)

3. **False Positive Rate**
   - Target: <5% incorrect artist assignments
   - Validation: Manual spot-checking

4. **Data Source Coverage**
   - Songstats DJ supports: >70% of tracks have data
   - Average DJ plays per track: >3

---

## Monitoring & Observability (Phase 2)

### Recommended Dashboards
1. **Probabilistic Matcher Performance**
   - Match success rate
   - Confidence score distribution
   - Processing time per track

2. **Songstats API Usage**
   - API calls per day
   - Rate limit status
   - Error rate
   - Cost tracking

3. **Data Quality**
   - DJ support data coverage
   - Average matches per track
   - False positive rate (manual validation)

---

## Risk Assessment

### Technical Risks
- **splink Integration Complexity**: Medium (proven library, good docs)
- **Songstats API Reliability**: Low-Medium (commercial service)
- **Algorithm Tuning**: Medium (requires EM training, threshold optimization)

### Business Risks
- **Licensing Cost**: Medium (Songstats pricing unknown)
- **Maintenance Burden**: Medium (API dependency, algorithm tuning)
- **ROI Uncertainty**: High (depends on Phase 1 results)

### Mitigation Strategies
1. **Pilot Testing**: Small batch testing before full deployment
2. **Manual Validation**: Spot-check matches for false positives
3. **Confidence Thresholds**: Conservative thresholds initially (>0.85)
4. **Gradual Rollout**: Start with high-confidence matches only

---

## Summary

### Phase 2 Scope
⏭️ Songstats API integration
⏭️ splink probabilistic matching
⏭️ Co-occurrence analysis enhancement
⏭️ Cool-down queue jitter
⏭️ Proxy rotation (optional)

### Phase 2 Timeline
**Estimated**: 1-2 weeks development + 1 week testing

### Phase 2 Prerequisites
❌ Phase 1 success metrics
❌ Songstats API license
❌ Business case approval
❌ Remaining "ID - ID" volume assessment

### Strategic Outcome
Phase 2 will **complete the multi-tier enrichment system**, enabling resolution of even the most challenging "ID - ID" tracks through probabilistic co-occurrence analysis. However, Phase 1 must prove successful first before investing in Phase 2.

---

**Decision Point**: ⏸️ **ON HOLD - Pending Phase 1 Results**
**Review Date**: After 30-60 days of Phase 1 operation
**Approval Required**: Business stakeholder sign-off on Songstats licensing
