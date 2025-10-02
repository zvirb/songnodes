# Fresh Deployment Guide - Tracks Schema Migration
**Date**: 2025-10-02
**For**: Setting up SongNodes on a new computer/server

---

## Prerequisites

1. Docker and Docker Compose installed
2. Git installed
3. `.env` file configured (copy from `.env.example`)

---

## Fresh Deployment Steps

### 1. Clone Repository

```bash
git clone <repository-url>
cd songnodes
```

### 2. Configure Environment

```bash
# Copy example environment file
cp .env.example .env

# Edit .env and set your credentials:
# - Database passwords
# - API keys (Spotify, YouTube, etc.)
# - Service ports (if needed)
nano .env
```

### 3. Start Services

```bash
# Build and start all services
docker compose up -d

# Wait for database to be ready (30 seconds)
sleep 30
```

### 4. Run Database Migrations

The migration will automatically:
- Create `tracks` table (modern schema)
- Create `track_artists` junction table with roles
- Create `albums` and `album_tracks` tables
- Add `normalized_name` to artists table
- Set up all foreign keys and indexes

```bash
# Run the migration
cat sql/migrations/005_migrate_songs_to_tracks_up.sql | \
  docker compose exec -T postgres psql -U musicdb_user -d musicdb

# Verify migration succeeded
docker compose exec -T postgres psql -U musicdb_user -d musicdb -c \
  "SELECT version, applied_at FROM schema_migrations ORDER BY applied_at DESC LIMIT 1;"
```

**Expected Output:**
```
           version           |          applied_at
-----------------------------+-------------------------------
 005_migrate_songs_to_tracks | 2025-10-02 XX:XX:XX.XXXXXX+00
```

### 5. Verify Database Schema

```bash
docker compose exec -T postgres psql -U musicdb_user -d musicdb << 'EOF'
-- Check tracks table exists
SELECT COUNT(*) as track_count FROM tracks;

-- Check track_artists table exists
SELECT COUNT(*) as relationship_count FROM track_artists;

-- Check artists.normalized_name exists
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'artists' AND column_name = 'normalized_name';
EOF
```

**Expected Output:**
```
 track_count
-------------
           0  (or more if data exists)

 relationship_count
--------------------
                  0  (or more if data exists)

   column_name   |     data_type     | is_nullable
-----------------+-------------------+-------------
 normalized_name | character varying | NO
```

### 6. Test Scraper

```bash
cd scrapers

# Test with a small scrape
scrapy crawl mixesdb -a search_artists="deadmau5" -a max_mixes=2

# Monitor logs for success messages:
# ✓ Detected track-artist relationship: Artist (featured) - Track
# ✓ Flushing remaining X track_artists...
# ✓ Database pipeline closed successfully
```

### 7. Verify Data Population

```bash
docker compose exec -T postgres psql -U musicdb_user -d musicdb << 'EOF'
-- Check data was inserted
SELECT 'Tracks' as table_name, COUNT(*) as count FROM tracks
UNION ALL
SELECT 'Artists', COUNT(*) FROM artists
UNION ALL
SELECT 'Track-Artist Relationships', COUNT(*) FROM track_artists
UNION ALL
SELECT 'Graph Edges', COUNT(*) FROM song_adjacency;

-- Check multi-artist relationships by role
SELECT role, COUNT(*) as count
FROM track_artists
GROUP BY role
ORDER BY count DESC;
EOF
```

**Expected Output:**
```
table_name                  | count
----------------------------+-------
Tracks                      |    XX
Artists                     |    XX
Track-Artist Relationships  |    XX
Graph Edges                 |    XX

  role   | count
---------+-------
 primary |    XX
featured |    XX  (if featured artists were scraped)
remixer  |    XX  (if remixes were scraped)
```

---

## Critical Files for Deployment

### Must Be Committed to Git

1. **Database Pipeline** (CRITICAL)
   - `scrapers/database_pipeline.py` - Handles all item processing
   - Contains track_artists batch processing
   - Populates artists.normalized_name

2. **Migration Scripts** (CRITICAL)
   - `sql/migrations/005_migrate_songs_to_tracks_up.sql` - Creates new schema
   - `sql/migrations/005_migrate_songs_to_tracks_down.sql` - Rollback if needed
   - Includes artists.normalized_name fix

3. **Item Definitions**
   - `scrapers/items.py` - Defines EnhancedTrackArtistItem, etc.

4. **Environment Template**
   - `.env.example` - Template for configuration

### Deployment Configuration Files

- `docker-compose.yml` - Service definitions
- `scrapers/requirements.txt` - Python dependencies
- `scrapers/settings.py` - Scrapy settings

---

## Verification Checklist

After deployment, verify:

- [ ] Database containers running (`docker compose ps`)
- [ ] Migration applied (`SELECT * FROM schema_migrations;`)
- [ ] `tracks` table exists
- [ ] `track_artists` table exists
- [ ] `artists.normalized_name` column exists and populated
- [ ] Scrapers can connect to database
- [ ] Test scrape succeeds
- [ ] Multi-artist relationships captured (check track_artists table)
- [ ] Graph edges created (check song_adjacency table)

---

## Troubleshooting

### Issue: Migration Fails

```bash
# Check database logs
docker compose logs postgres | tail -50

# Verify database is ready
docker compose exec postgres pg_isready -U musicdb_user
```

### Issue: Scrapers Can't Connect

```bash
# Check environment variables
docker compose exec scrapers env | grep DATABASE

# Test database connection
docker compose exec scrapers python3 << 'EOF'
import psycopg2
conn = psycopg2.connect(
    host='postgres',
    port=5432,
    database='musicdb',
    user='musicdb_user',
    password='musicdb_secure_pass_2024'
)
print("✅ Connection successful")
conn.close()
EOF
```

### Issue: Artists normalized_name Missing

```bash
# Manually add if migration didn't run
docker compose exec -T postgres psql -U musicdb_user -d musicdb << 'EOF'
ALTER TABLE artists ADD COLUMN IF NOT EXISTS normalized_name VARCHAR(255);
UPDATE artists SET normalized_name = LOWER(TRIM(REGEXP_REPLACE(name, '\s+', ' ', 'g'))) WHERE normalized_name IS NULL;
ALTER TABLE artists ALTER COLUMN normalized_name SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_artists_normalized_name ON artists(normalized_name);
EOF
```

### Issue: Track-Artist Relationships Not Created

**Check**: Verify database_pipeline.py has `_process_track_artist_item` method

```bash
grep -n "_process_track_artist_item" scrapers/database_pipeline.py
```

**Expected**: Should show line numbers where method is defined and called

**Check**: Verify track_artists batch exists

```bash
grep -n "'track_artists'" scrapers/database_pipeline.py
```

---

## Rollback Instructions

If you need to rollback to the old schema:

```bash
# Rollback migration
cat sql/migrations/005_migrate_songs_to_tracks_down.sql | \
  docker compose exec -T postgres psql -U musicdb_user -d musicdb

# Verify rollback
docker compose exec -T postgres psql -U musicdb_user -d musicdb -c \
  "SELECT table_name FROM information_schema.tables WHERE table_name IN ('songs', 'tracks') ORDER BY table_name;"
```

**⚠️ WARNING**: Rollback will delete all data in `tracks`, `track_artists`, `albums`, and `album_tracks` tables!

---

## Fresh vs. Existing Deployment

### Fresh Deployment (New Computer)
1. Clone repo
2. Configure .env
3. Run `docker compose up -d`
4. Run migration (005_migrate_songs_to_tracks_up.sql)
5. Start scraping

### Existing Deployment (Already Running)
- Migration already applied
- Database already has tracks/track_artists tables
- Code changes deployed via git pull
- Restart scrapers: `docker compose restart scrapers`

---

## Success Criteria

Your deployment is successful when:

1. ✅ All containers running (`docker compose ps` shows "Up")
2. ✅ Migration shows in database (`schema_migrations` table)
3. ✅ `tracks` table exists with correct columns
4. ✅ `track_artists` table exists with `role` column
5. ✅ `artists.normalized_name` exists and populated
6. ✅ Test scrape completes without errors
7. ✅ Multi-artist relationships appear in `track_artists` table
8. ✅ Graph edges appear in `song_adjacency` table

---

## Next Steps After Deployment

1. Configure API keys in `.env` (Spotify, YouTube, etc.)
2. Run full scrapes for your target artists
3. Monitor logs for any errors
4. Check database for complete data population
5. Access frontend at http://localhost:3006

**Deployment Complete!** 🎉
