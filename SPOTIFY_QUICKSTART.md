# Spotify Spider - Quick Start Guide

## 🚀 5-Minute Setup

### Step 1: Get Spotify API Credentials (2 minutes)

1. Go to: https://developer.spotify.com/dashboard
2. Log in with Spotify account
3. Click **"Create app"**
4. Fill in:
   - **App name**: SongNodes
   - **App description**: Music discovery and DJ tools
   - **Website**: http://localhost:3006 (or your domain)
   - **Redirect URI**: (leave empty - not needed for Client Credentials)
   - Check "Web API" box
5. Click **"Save"**
6. Click **"Settings"**
7. Copy **Client ID** and **Client Secret**

### Step 2: Configure Credentials (1 minute)

**Option A: Via Environment Variables** (Quick)
```bash
cd /mnt/my_external_drive/programming/songnodes

# Add to .env file
echo "SPOTIFY_CLIENT_ID=your_client_id_here" >> .env
echo "SPOTIFY_CLIENT_SECRET=your_client_secret_here" >> .env
```

**Option B: Via Settings UI** (Recommended for Production)
1. Start services: `docker compose up -d`
2. Open: http://localhost:3006
3. Go to: Settings (⚙️) → API Keys tab
4. Click **"Add API Key"**
5. Enter:
   - **Service**: spotify
   - **Key Name**: client_id
   - **Key Value**: (paste Client ID)
6. Click **"Add API Key"** again
7. Enter:
   - **Service**: spotify
   - **Key Name**: client_secret
   - **Key Value**: (paste Client Secret)

### Step 3: Test Configuration (1 minute)

```bash
cd /mnt/my_external_drive/programming/songnodes/scrapers
python3 test_spotify_spider.py
```

Expected output:
```
✓ SPOTIFY_CLIENT_ID: 1a2b3c4d...
✓ SPOTIFY_CLIENT_SECRET: ********...
✓ POSTGRES_PASSWORD: ********
✓ Spider imported successfully
✅ Spider is configured and ready to run
```

### Step 4: Run Spider (1 minute)

```bash
# Start all services
docker compose up -d

# Run spider (search DJ playlists)
docker compose run scrapers scrapy crawl spotify
```

**Monitor progress**:
```bash
docker compose logs -f scrapers
```

**Expected logs**:
```
✓ Spotify credentials loaded
✓ Spotify authentication successful (expires in 3600s)
Found 15 playlists for query: DJ Mix
Processing playlist: Afterlife Presents: Top of Mind
✓ Extracted 47 tracks with audio features
```

### Step 5: Verify Results (30 seconds)

```bash
# Connect to PostgreSQL
docker compose exec postgres psql -U musicdb_user -d musicdb

# Query Spotify tracks
SELECT
    title,
    bpm,
    musical_key,
    energy,
    danceability
FROM songs
WHERE data_source = 'spotify'
ORDER BY created_at DESC
LIMIT 10;
```

**Expected output**:
```
       title       | bpm | musical_key | energy | danceability
------------------+-----+-------------+--------+--------------
 Consciousness    | 128 | Cmaj        |   0.85 |         0.92
 Tale Of Us       | 124 | Amin        |   0.78 |         0.88
 ...
```

## 🎯 Common Use Cases

### 1. Search Specific Genre
```bash
docker compose run scrapers scrapy crawl spotify -a search_query="Tech House"
```

### 2. Search Specific DJ/Artist
```bash
docker compose run scrapers scrapy crawl spotify -a search_query="Tale of Us"
```

### 3. Fetch Specific Playlist
Get playlist ID from Spotify URL: `https://open.spotify.com/playlist/37i9dQZF1DX4dyzvuaRJ0n`
```bash
docker compose run scrapers scrapy crawl spotify -a playlist_ids="37i9dQZF1DX4dyzvuaRJ0n"
```

### 4. Multiple Playlists
```bash
docker compose run scrapers scrapy crawl spotify -a playlist_ids="37i9dQZF1DX4dyzvuaRJ0n,37i9dQZF1DX0BcQWzuB7XE"
```

### 5. Limited Run (Testing)
```bash
docker compose run scrapers scrapy crawl spotify -s CLOSESPIDER_ITEMCOUNT=50
```

## 🔧 Troubleshooting

### Issue: "Spotify API credentials not found"
**Fix**: Set environment variables
```bash
export SPOTIFY_CLIENT_ID=your_id
export SPOTIFY_CLIENT_SECRET=your_secret
```

### Issue: "401 Unauthorized"
**Fix**: Check credentials are correct
```bash
# Test credentials manually
curl -X POST "https://accounts.spotify.com/api/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=client_credentials&client_id=YOUR_ID&client_secret=YOUR_SECRET"
```

### Issue: "429 Rate Limit Exceeded"
**Fix**: Increase download delay
Edit `spotify_spider.py`:
```python
download_delay = 30.0  # Increase from 20s to 30s
```

### Issue: "No playlists found"
**Fix**: Try more specific search
```bash
# Instead of generic "DJ Mix"
docker compose run scrapers scrapy crawl spotify -a search_query="Drumcode Radio"
```

### Issue: "Database connection failed"
**Fix**: Ensure services are running
```bash
docker compose up -d postgres redis
docker compose ps
```

## 📊 Performance Tuning

### Conservative (Default)
```python
download_delay = 20.0
batch_size = 50
```
**Throughput**: ~50-100 tracks/hour
**Risk**: Very low (recommended for production)

### Balanced
```python
download_delay = 10.0
batch_size = 75
```
**Throughput**: ~150-200 tracks/hour
**Risk**: Low

### Aggressive (NOT Recommended)
```python
download_delay = 3.0
batch_size = 100
```
**Throughput**: ~500+ tracks/hour
**Risk**: High (may trigger rate limiting)

## 🎉 Success Indicators

✅ **Configuration successful if you see**:
```
✓ Spotify credentials loaded (Client ID: 1a2b3c4d...)
✓ Spotify authentication successful (expires in 3600s)
```

✅ **Execution successful if you see**:
```
Found 15 playlists for query: DJ Mix
Processing playlist: Afterlife Presents: Top of Mind
✓ Extracted 47 tracks with audio features
```

✅ **Database successful if query returns**:
```
10 rows with BPM, musical_key, energy, and danceability values
```

## 📚 Next Steps

1. **Schedule regular runs**: Add to cron or Kubernetes CronJob
2. **Monitor metrics**: Check Grafana dashboard for API usage
3. **Expand searches**: Add more genre-specific queries
4. **Integrate with UI**: Display audio features in frontend

## 🆘 Support

- **Documentation**: `/scrapers/spiders/stores/README_SPOTIFY.md`
- **Implementation Summary**: `/SPOTIFY_INTEGRATION_SUMMARY.md`
- **Spider Code**: `/scrapers/spiders/stores/spotify_spider.py`
- **Test Script**: `/scrapers/test_spotify_spider.py`

---

**Total Setup Time**: ~5 minutes
**First Results**: ~10 minutes
**Status**: ✅ Production Ready
