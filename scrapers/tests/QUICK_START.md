# Quick Start: Adjacency Preservation Tests

## Run All Tests (30 seconds)

```bash
cd /mnt/my_external_drive/programming/songnodes/scrapers
python3 -m pytest tests/test_adjacency_preservation.py -v
```

## Expected Output

```
======================= 17 passed in 0.39s =======================
```

## Test Categories

| Category | Tests | Description |
|----------|-------|-------------|
| **Item Structure** | 4 | Validates adjacency item fields and values |
| **Generation** | 1 | Tests spider adjacency generation logic |
| **Pipeline** | 3 | Validates validation, enrichment, persistence |
| **Database** | 3 | Tests database integration and upserts |
| **Queries** | 2 | Validates graph query compatibility |
| **NULL Handling** | 2 | Tests COALESCE fix requirement |
| **Integration** | 2 | End-to-end workflow tests |

## Critical Finding

**COALESCE Fix Required:** Line 715 in `persistence_pipeline.py`

```sql
-- Current (BUG):
avg_distance = ((song_adjacency.avg_distance * ...

-- Fixed (REQUIRED):
avg_distance = ((COALESCE(song_adjacency.avg_distance, 0) * ...
```

See `COALESCE_FIX_REQUIRED.md` for details.

## Test Individual Components

```bash
# Test adjacency item structure
pytest tests/test_adjacency_preservation.py::TestAdjacencyItemStructure -v

# Test generation logic
pytest tests/test_adjacency_preservation.py::TestAdjacencyGeneration -v

# Test pipeline processing
pytest tests/test_adjacency_preservation.py::TestPipelineProcessing -v

# Test NULL handling (CRITICAL)
pytest tests/test_adjacency_preservation.py::TestNullHandling -v
```

## Run with Coverage

```bash
pytest tests/test_adjacency_preservation.py --cov=pipelines --cov=items --cov-report=html
```

Then open `htmlcov/index.html` in browser.

## Verify Graph Query Works

```bash
# After scraping some data, test the query:
docker compose exec postgres psql -U musicdb_user -d musicdb
```

```sql
SELECT s1.song_id as source_song_id, s1.title as source_title,
       s2.song_id as target_song_id, s2.title as target_title,
       sa.occurrence_count, sa.avg_distance, sa.transition_type
FROM song_adjacency sa
JOIN songs s1 ON sa.song_id_1 = s1.song_id
JOIN songs s2 ON sa.song_id_2 = s2.song_id
LIMIT 10;
```

## Troubleshooting

### Import Errors
```bash
export PYTHONPATH=/mnt/my_external_drive/programming/songnodes/scrapers:$PYTHONPATH
python3 -m pytest tests/test_adjacency_preservation.py -v
```

### Async Errors
```bash
pip install pytest-asyncio
```

### Missing Dependencies
```bash
pip install pytest pytest-asyncio asyncpg
```

## Next Steps

1. ✅ All tests pass (17/17)
2. ⚠️ Apply COALESCE fix to `persistence_pipeline.py` line 715
3. ✅ Verify graph adjacencies are generated correctly
4. ✅ Test with real scraper runs
5. ✅ Deploy to production

## File Locations

- Tests: `/mnt/my_external_drive/programming/songnodes/scrapers/tests/test_adjacency_preservation.py`
- Pipeline: `/mnt/my_external_drive/programming/songnodes/scrapers/pipelines/persistence_pipeline.py`
- Items: `/mnt/my_external_drive/programming/songnodes/scrapers/items.py`
- Documentation: `/mnt/my_external_drive/programming/songnodes/scrapers/tests/README.md`
