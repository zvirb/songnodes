# CRITICAL: COALESCE Fix Required in Persistence Pipeline

## Issue Summary

**File:** `/mnt/my_external_drive/programming/songnodes/scrapers/pipelines/persistence_pipeline.py`
**Line:** 715
**Severity:** HIGH
**Impact:** Graph adjacency updates will fail when `avg_distance` is NULL

## Problem Description

The current implementation of adjacency upsert logic does not handle NULL values correctly when calculating the average distance between tracks. If the existing `avg_distance` in the database is NULL (which can happen on first insert or due to migration), the calculation will fail.

### Current Code (Line 715-717)

```sql
avg_distance = ((song_adjacency.avg_distance * song_adjacency.occurrence_count) +
                (EXCLUDED.avg_distance * EXCLUDED.occurrence_count)) /
               (song_adjacency.occurrence_count + EXCLUDED.occurrence_count)
```

### Issue

In SQL, `NULL * number = NULL`, which means the entire calculation becomes NULL, preventing proper averaging of distances across multiple observations of the same track pair.

## Required Fix

### Fixed Code

```sql
avg_distance = ((COALESCE(song_adjacency.avg_distance, 0) * song_adjacency.occurrence_count) +
                (EXCLUDED.avg_distance * EXCLUDED.occurrence_count)) /
               (song_adjacency.occurrence_count + EXCLUDED.occurrence_count)
```

### What COALESCE Does

`COALESCE(song_adjacency.avg_distance, 0)` returns:
- The value of `avg_distance` if it's not NULL
- `0` if `avg_distance` is NULL

This ensures the calculation always uses a numeric value, even when dealing with NULL data.

## Test Validation

The test suite (`test_adjacency_preservation.py`) includes specific tests for this issue:

### TestNullHandling::test_coalesce_fix_required
Documents the difference between buggy and fixed queries.

### TestNullHandling::test_avg_distance_calculation_with_null
Validates the calculation logic with NULL values:

```python
# Initial: occurrence_count=1, avg_distance=NULL (treated as 0)
# New: occurrence_count=1, avg_distance=1.5
# Result: avg_distance = ((0 * 1) + (1.5 * 1)) / (1 + 1) = 0.75
```

## Impact Without Fix

1. **First Scenario: Initial Insert**
   - First adjacency insert: `avg_distance` could be NULL
   - Second insert (same track pair): Calculation fails due to NULL multiplication
   - Result: Graph edges are not properly weighted

2. **Second Scenario: Migration**
   - Existing adjacencies may have NULL `avg_distance` values
   - Any subsequent update will fail
   - Result: Graph cannot be updated with new data

3. **Third Scenario: Data Quality**
   - Some sources may not provide distance information
   - NULL propagation breaks the entire calculation
   - Result: Loss of valuable adjacency data

## Implementation Steps

1. **Locate the code:**
   ```bash
   /mnt/my_external_drive/programming/songnodes/scrapers/pipelines/persistence_pipeline.py
   Line 715
   ```

2. **Apply the fix:**
   Replace line 715:
   ```python
   avg_distance = ((song_adjacency.avg_distance * song_adjacency.occurrence_count) +
   ```

   With:
   ```python
   avg_distance = ((COALESCE(song_adjacency.avg_distance, 0) * song_adjacency.occurrence_count) +
   ```

3. **Verify with tests:**
   ```bash
   cd /mnt/my_external_drive/programming/songnodes/scrapers
   pytest tests/test_adjacency_preservation.py::TestNullHandling -v
   ```

4. **Test with real data:**
   - Insert test adjacency with NULL avg_distance
   - Verify update succeeds
   - Verify avg_distance is calculated correctly

## Database Verification

After applying the fix, verify in PostgreSQL:

```sql
-- Insert test adjacency with NULL avg_distance
INSERT INTO song_adjacency (song_id_1, song_id_2, occurrence_count, avg_distance)
VALUES (1, 2, 1, NULL);

-- Verify NULL is stored
SELECT * FROM song_adjacency WHERE song_id_1 = 1 AND song_id_2 = 2;
-- Expected: occurrence_count=1, avg_distance=NULL

-- Insert duplicate (should trigger COALESCE logic)
INSERT INTO song_adjacency (song_id_1, song_id_2, occurrence_count, avg_distance)
VALUES (1, 2, 1, 1.5)
ON CONFLICT (song_id_1, song_id_2) DO UPDATE SET
    occurrence_count = song_adjacency.occurrence_count + EXCLUDED.occurrence_count,
    avg_distance = ((COALESCE(song_adjacency.avg_distance, 0) * song_adjacency.occurrence_count) +
                    (EXCLUDED.avg_distance * EXCLUDED.occurrence_count)) /
                   (song_adjacency.occurrence_count + EXCLUDED.occurrence_count);

-- Verify calculation succeeded
SELECT * FROM song_adjacency WHERE song_id_1 = 1 AND song_id_2 = 2;
-- Expected: occurrence_count=2, avg_distance=0.75
```

## Alternative Solutions Considered

1. **Default value in schema:**
   ```sql
   ALTER TABLE song_adjacency ALTER COLUMN avg_distance SET DEFAULT 0;
   ```
   - Pros: Prevents NULL at insert time
   - Cons: Doesn't fix existing NULLs, may mask missing data

2. **Separate NULL check:**
   ```sql
   avg_distance = CASE
       WHEN song_adjacency.avg_distance IS NULL THEN EXCLUDED.avg_distance
       ELSE ((song_adjacency.avg_distance * song_adjacency.occurrence_count) + ...) / ...
   END
   ```
   - Pros: Explicit handling
   - Cons: More complex, harder to maintain

3. **COALESCE (RECOMMENDED):**
   - Pros: Simple, clear intent, handles NULL gracefully
   - Cons: None

## References

- PostgreSQL COALESCE documentation: https://www.postgresql.org/docs/current/functions-conditional.html
- Test suite: `/mnt/my_external_drive/programming/songnodes/scrapers/tests/test_adjacency_preservation.py`
- Related issue: Graph adjacency preservation after migration

## Sign-off

- [ ] Code fix applied
- [ ] Tests pass
- [ ] Database verified
- [ ] Deployed to production

**Date:** 2025-10-01
**Author:** Test Automation Engineer
**Reviewer:** [Pending]
