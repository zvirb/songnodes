# Reddit Monitor Spider - Tier 3 Community-Driven Track Identification

## Overview

The Reddit Monitor Spider implements **Tier 3 community-driven track identification** - the "latency advantage" source that captures track IDs **hours or days before they appear on aggregators** like 1001tracklists.

### Why Reddit?

Reddit communities are goldmines for:
- **Early discoveries**: Tracks identified by the community before official tracklists
- **Unreleased/rare tracks**: IDs that may never appear on traditional aggregators
- **Real-time conversations**: Active discussions about new music
- **User expertise**: Dedicated communities with deep genre knowledge

### Target Communities

#### Direct Track ID Requests (Highest Priority)
- **r/IdentifyThisTrack** - Dedicated track identification community
- **r/NameThatSong** - Song identification requests
- **r/tipofmytongue** - "What's that song?" questions

#### Genre-Specific Communities (AUTO-TAGGED)
- **Techno**: r/Techno → Auto-tagged as "Techno"
- **Tech House**: r/tech_house → Auto-tagged as "Tech House"
- **Trance**: r/Trance → Auto-tagged as "Trance"
- **Hardstyle**: r/hardstyle → Auto-tagged as "Hardstyle"
- **House**: r/House → Auto-tagged as "House" (strict "Artist - Title" format)
- **DnB**: r/DnB → Auto-tagged as "Drum and Bass"

#### DJ Community (NEW - Priority Score 2.50 Quick Win)
- **r/Beatmatch** → Auto-tagged as "Various" (DJ learning, track recommendations)
- **r/DJs** → Auto-tagged as "Various" (professional DJ discussions)

#### Festival & Event Communities
- r/electricdaisycarnival, r/Tomorrowland, r/Ultra, r/festivals

#### General Electronic Music
- r/EDM → Auto-tagged as "Electronic Dance Music"
- r/electronicmusic → Auto-tagged as "Electronic"
- r/tracklists

---

## Setup Instructions

### 1. Create Reddit API Application

1. Visit https://www.reddit.com/prefs/apps
2. Click **"Create App"** or **"Create Another App"**
3. Fill in the form:
   - **Name**: SongNodes Music Discovery
   - **App type**: Select **"script"**
   - **Description**: Music discovery and track identification bot
   - **About URL**: (optional)
   - **Redirect URI**: http://localhost:8080 (required but not used)
4. Click **"Create App"**
5. Note your credentials:
   - **Client ID**: 14-character string under app name
   - **Client Secret**: Longer string labeled "secret"

### 2. Configure Environment Variables

Add to your `.env` file:

```bash
# Reddit API Credentials (REQUIRED)
REDDIT_CLIENT_ID=your_14_char_client_id
REDDIT_CLIENT_SECRET=your_secret_key_here
REDDIT_USER_AGENT=SongNodes/2.0 Music Discovery Bot (by /u/your_reddit_username)
```

**Important**:
- Replace `your_reddit_username` with your actual Reddit username
- User agent format must include contact information per Reddit API policy

### 3. Verify PRAW Installation

PRAW (Python Reddit API Wrapper) is already in `requirements.txt`:

```bash
cd scrapers
pip install -r requirements.txt
```

### 4. Test Connection

```bash
cd scrapers
python test_reddit_monitor.py
```

Expected output:
```
✓ PRAW initialized with user agent: SongNodes/2.0...
✓ Read-only mode: True
✓ r/Techno: 5 posts retrieved
✓ r/EDM: 5 posts retrieved
✓ ALL TESTS COMPLETED
```

---

## Running the Spider

### Manual Execution

```bash
# From scrapers directory
cd scrapers

# Monitor posts from last 24 hours (default)
scrapy crawl reddit_monitor -a time_filter=day

# Monitor posts from last hour (frequent updates)
scrapy crawl reddit_monitor -a time_filter=hour

# Monitor posts from last week (comprehensive)
scrapy crawl reddit_monitor -a time_filter=week

# Filter specific subreddits
scrapy crawl reddit_monitor -a subreddit_filter="Techno,hardstyle,Trance"
```

### Automated Scheduling

The spider runs automatically via the Scraper Orchestrator:
- **Frequency**: Every 30 minutes
- **Time Filter**: Last 24 hours
- **Configured in**: `services/scraper-orchestrator/main.py`

To modify schedule:
```python
# In main.py, line 317-324
scheduler.add_job(
    scheduled_reddit_monitor,
    trigger=CronTrigger(minute="*/15"),  # Change to every 15 minutes
    id="reddit_community_monitor",
    max_instances=1,
    coalesce=True,
    misfire_grace_time=300
)
```

---

## NEW: Automatic Genre Tagging (v2.1)

**What's New**: The spider now automatically tags tracks with genre information based on the subreddit they're discovered in!

### How It Works

```python
SUBREDDIT_GENRE_MAP = {
    'Techno': 'Techno',
    'DnB': 'Drum and Bass',
    'House': 'House',
    'tech_house': 'Tech House',
    'Trance': 'Trance',
    'hardstyle': 'Hardstyle',
    'Beatmatch': 'Various',
    'DJs': 'Various',
    'electronicmusic': 'Electronic',
    'EDM': 'Electronic Dance Music'
}
```

### Example Output

**Before (v2.0)**:
```json
{
  "track_name": "Amelie Lens - In My Mind",
  "genre": null
}
```

**After (v2.1)**:
```json
{
  "track_name": "Amelie Lens - In My Mind",
  "genre": "Techno",
  "metadata": {
    "subreddit": "Techno",
    "source": "reddit"
  }
}
```

### Benefits

- **Automatic categorization** - No manual tagging needed
- **Genre filtering** - Easy to filter tracks by genre in database queries
- **Better recommendations** - Genre context improves similarity matching
- **Configurable** - Easy to add new subreddits and genre mappings

---

## Post Classification System

The spider uses NLP-enhanced classification to categorize posts:

### Classification Types

#### 1. `track_id_request`
**Confidence threshold**: 2+ ID request keywords

**Triggers**:
- "What is this track?"
- "ID request"
- "Anyone know this song?"
- "Help me find this track"

**Processing**:
- Scans comments for "Artist - Title" patterns
- Uses NLP fallback for complex answers
- Captures timestamps if provided

**Example**:
```
Post: "ID - Track from Charlotte de Witte @ Awakenings 2024"
Body: "At 45:30, there's an incredible track. Anyone know it?"
Comments:
  - "That's Amelie Lens - In My Mind (I_O Remix)"  ← EXTRACTED
```

#### 2. `mix_share`
**Confidence threshold**: 1+ tracklist keyword

**Triggers**:
- "Tracklist"
- "Setlist"
- "Playlist"
- "Full set"

**Processing**:
- Extracts full tracklist from post body
- Parses multiple formats (numbered, timestamped, bulleted)
- Creates PlaylistItem for database storage
- Yields individual TrackItems

**Example**:
```
Post: "Anyma @ Tomorrowland 2024 - Full Tracklist"
Body:
  1. Anyma - Consciousness
  2. Tale Of Us - Monument
  [00:15] Stephan Bodzin - Singularity
```

#### 3. `discussion`
**Confidence threshold**: Media link present

**Triggers**:
- SoundCloud links
- YouTube links
- Spotify links
- Mixcloud links

**Processing**:
- Extracts track mentions from text
- Parses "Artist - Title" format
- Captures casual discussions

---

## Extraction Methods

### 1. NLP-Powered Extraction (Primary)

Uses the NLP processor service for intelligent text parsing:

```python
# Automatically triggered for posts with 100+ characters
tracks = self.extract_via_nlp_sync(
    html_or_text=post_text,
    url=post_url,
    extract_timestamps=True
)
```

**Advantages**:
- Handles irregular formats
- Understands context
- Extracts timestamps automatically
- High accuracy on real-world text

### 2. Regex Pattern Matching (Fallback)

Multiple patterns for robustness:

```python
patterns = [
    r'([A-Z][A-Za-z0-9\s&]+?)\s*[-–—]\s*([A-Z][A-Za-z0-9\s\(\)\[\]]+)',  # Artist - Title
    r'"([^"]+)"\s+by\s+([A-Z][A-Za-z0-9\s&]+)',  # "Title" by Artist
    r'([A-Z][A-Za-z0-9\s&]+?):\s*([A-Z][A-Za-z0-9\s\(\)\[\]]+)',  # Artist: Title
]
```

**Supported formats**:
- `Charlotte de Witte - Selected` (standard format)
- `[00:45] Amelie Lens - In My Mind` (with timestamp)
- `1. Anyma - Consciousness` (numbered list)
- `• Ben Klock - Subzero (Original Mix)` (bulleted list)
- `"Losing It" by FISHER` (reversed format)
- `[Drumcode] Adam Beyer - Your Mind` (with label prefix)
- `ID - Chris Lake - Turn Off The Lights` (with ID prefix)

### Enhanced r/House Format Detection (NEW)

The spider now has **specialized parsing for r/House's strict "Artist - Title" format**:

```python
# Strict format enforcement
r'(?:^|[\n\r])\s*([A-Z][A-Za-z0-9\s&\.\'\-]+?)\s*[-–—]\s*([A-Z][A-Za-z0-9\s\(\)\[\]\.\'\-]+?)'
```

**Key improvements**:
- Must start with capital letter (filters out noise)
- No number prefixes allowed (pure "Artist - Title")
- Supports apostrophes, periods, hyphens in names
- Automatic remix detection: `Track Name (Someone Remix)`
- Label prefix support: `[Toolroom] Mark Knight - Your Love`

**Example r/House post parsing**:

```
Input (r/House post):
Green Velvet - La La Land
Duke Dumont - Ocean Drive
Chris Lake - Turn Off The Lights (John Summit Remix)

Output:
✓ 3 tracks extracted
✓ All auto-tagged as genre="House"
✓ Remix detected and flagged for track 3
```

---

## Rate Limiting & API Quotas

### Reddit API Limits

**Read-only access** (used by this spider):
- **60 requests per minute**
- **600 requests per 10 minutes**

### Spider Configuration

```python
custom_settings = {
    'DOWNLOAD_DELAY': 1.0,  # 1 second between requests
    'RANDOMIZE_DOWNLOAD_DELAY': 0.2,  # ±0.2 second variation
    'CONCURRENT_REQUESTS': 1,  # Single request at a time
    'CONCURRENT_REQUESTS_PER_DOMAIN': 1
}
```

**Actual rate**: ~50-55 requests/minute (safely under limit)

### Quota Management

- **Deduplication**: Redis-backed post tracking (30-day TTL)
- **Batch limiting**: Fetches 50-100 posts per subreddit
- **Smart filtering**: Only processes relevant posts
- **Respectful delays**: 1 second minimum between requests

---

## Sample Output

### Successful Track ID Extraction

```
[2025-10-01 14:23:45] INFO: 🔍 Monitoring r/Techno for new posts...
[2025-10-01 14:23:47] INFO: 📌 Processing track_id_request post: "ID - Track from Adam Beyer set?" (confidence: 0.80)
[2025-10-01 14:23:48] INFO: ✓ Found track ID in comment: {'artist': 'Amelie Lens', 'title': 'In Verruf'}
[2025-10-01 14:23:48] INFO: ✓ Created track item: track_id=amelielens_inverruf_original
[2025-10-01 14:23:48] INFO: ✓ Yielded EnhancedTrackItem(track_name="Amelie Lens - In Verruf", source="reddit")
```

### Tracklist Extraction

```
[2025-10-01 14:30:12] INFO: 📌 Processing mix_share post: "Ben Klock @ Berghain 2024 - Full Set" (confidence: 0.90)
[2025-10-01 14:30:13] INFO: ✓ NLP extracted 18 tracks from tracklist post
[2025-10-01 14:30:13] INFO: ✓ Created PlaylistItem: "Ben Klock @ Berghain 2024" (18 tracks)
[2025-10-01 14:30:14] INFO: ✓ Yielded 18 EnhancedTrackItems
[2025-10-01 14:30:14] INFO: ✓ Yielded 18 EnhancedTrackArtistItems (artist relationships)
```

### Statistics Summary

```
============================================================
REDDIT MONITOR SPIDER COMPLETED
============================================================
Posts processed: 247
Track IDs found: 43
Tracklists found: 7
ID requests found: 15
============================================================
```

---

## Database Integration

### Items Created

#### 1. EnhancedTrackItem
```python
{
    'track_id': 'amelielens_consciousness_original',  # Deterministic ID
    'track_name': 'Amelie Lens - Consciousness',
    'normalized_title': 'consciousness',
    'is_remix': False,
    'is_mashup': False,
    'source_context': 'Reddit ID Request: What track is this?',
    'track_type': 'Reddit Discovery',
    'external_urls': {'reddit': 'https://reddit.com/r/Techno/comments/xyz'},
    'metadata': {
        'source': 'reddit',
        'extracted_at': '2025-10-01T14:23:45Z',
        'context': 'Reddit ID Request'
    },
    'data_source': 'reddit_monitor',
    'scrape_timestamp': '2025-10-01T14:23:45Z'
}
```

#### 2. PlaylistItem (for tracklists)
```python
{
    'item_type': 'playlist',
    'name': 'Amelie Lens @ Tomorrowland 2024',
    'source': 'reddit',
    'source_url': 'https://reddit.com/r/EDM/comments/xyz',
    'dj_name': 'Amelie Lens',
    'curator': 'u/music_lover_123',
    'event_name': 'Tomorrowland 2024',
    'tracks': ['Amelie Lens - Track 1', 'Tale Of Us - Track 2', ...],
    'total_tracks': 18,
    'data_source': 'reddit_monitor'
}
```

#### 3. EnhancedTrackArtistItem (relationships)
```python
{
    'track_name': 'Amelie Lens - Consciousness',
    'artist_name': 'Amelie Lens',
    'artist_role': 'primary',
    'data_source': 'reddit_monitor'
}
```

---

## Monitoring & Metrics

### Prometheus Metrics

Available at `http://localhost:9091/metrics`:

```prometheus
# Scraping operations
search_operations_total{platform="reddit",status="success"} 142
search_operations_total{platform="reddit",status="error"} 3
search_operations_total{platform="reddit",status="timeout"} 0

# Active scrapers
active_scrapers{scraper="reddit_monitor"} 1

# Task duration
scraping_duration_seconds{scraper="reddit_monitor"} 45.2
```

### Health Check

```bash
curl http://localhost:8085/health
```

Response:
```json
{
  "service": "scraper-orchestrator-2025",
  "status": "healthy",
  "connections": {
    "database": "healthy",
    "redis": "healthy"
  },
  "searcher": {
    "reddit_monitor": {
      "status": "active",
      "last_run": "2025-10-01T14:30:00Z",
      "tracks_found": 43
    }
  }
}
```

---

## Troubleshooting

### Issue: "PRAW not initialized"

**Symptoms**: Spider fails immediately with authentication error

**Solution**:
1. Verify credentials in `.env`:
   ```bash
   grep REDDIT_ .env
   ```
2. Test PRAW connection:
   ```bash
   python test_reddit_monitor.py
   ```
3. Check Reddit app still exists: https://www.reddit.com/prefs/apps

---

### Issue: "Rate limit exceeded"

**Symptoms**: 429 errors in logs

**Solution**:
1. Increase `DOWNLOAD_DELAY` in spider:
   ```python
   'DOWNLOAD_DELAY': 2.0,  # Increase from 1.0 to 2.0
   ```
2. Reduce subreddit count:
   ```bash
   scrapy crawl reddit_monitor -a subreddit_filter="Techno,EDM"
   ```
3. Increase scheduling interval to 60 minutes

---

### Issue: "No tracks extracted"

**Symptoms**: Spider runs but finds 0 tracks

**Possible causes**:
1. **Time filter too restrictive**: Change from `hour` to `day` or `week`
2. **Subreddits not active**: Try different communities
3. **Classification too strict**: Lower confidence thresholds
4. **NLP service down**: Check `http://nlp-processor:8021/health`

**Solution**:
```bash
# Use longer time window
scrapy crawl reddit_monitor -a time_filter=week

# Test with high-activity subreddits
scrapy crawl reddit_monitor -a subreddit_filter="EDM,electronicmusic"
```

---

### Issue: "Redis deduplication not working"

**Symptoms**: Processing same posts multiple times

**Solution**:
1. Check Redis connection:
   ```bash
   docker compose exec redis redis-cli ping
   ```
2. Verify Redis keys:
   ```bash
   docker compose exec redis redis-cli KEYS "scraped:reddit:posts:*"
   ```
3. Clear Redis cache if needed:
   ```bash
   docker compose exec redis redis-cli FLUSHDB
   ```

---

## Performance Optimization

### High-Volume Monitoring

For 24/7 monitoring with maximum throughput:

```python
# In reddit_monitor_spider.py
SUBREDDITS = {
    'id_requests': ['IdentifyThisTrack'],  # Focus on highest-value
    'genre_specific': ['Techno', 'Trance'],  # Limit genres
}

# Reduce post limits
posts = subreddit.new(limit=25)  # Instead of 100
```

### Low-Resource Mode

For limited infrastructure:

```bash
# Run once per hour instead of every 30 minutes
# In orchestrator main.py:
trigger=CronTrigger(minute="0")  # Top of every hour
```

---

## Integration with Existing Spiders

The Reddit Monitor Spider complements other data sources:

### Data Flow

```
Reddit Community → reddit_monitor_spider → Database
                                              ↓
                                    Enhanced with metadata
                                              ↓
                        1001tracklists_spider finds same track
                                              ↓
                        Cross-reference confirms authenticity
```

### Latency Advantage Example

**Timeline**:
1. **Hour 0**: User asks "ID?" on r/Techno → reddit_monitor extracts answer
2. **Hour 6**: Same track appears in DJ set → Still not on 1001tracklists
3. **Hour 24**: DJ posts set to 1001tracklists → 1001tracklists_spider finds it
4. **Result**: SongNodes has track 24 hours earlier than aggregator-only systems

---

## API Access (Orchestrator)

### Trigger Manual Run

```bash
curl -X POST http://localhost:8085/api/scrape \
  -H "Content-Type: application/json" \
  -d '{
    "scraper": "reddit_monitor",
    "priority": "high",
    "params": {
      "time_filter": "day",
      "subreddit_filter": "Techno,hardstyle"
    }
  }'
```

### Check Status

```bash
curl http://localhost:8085/api/scrapers/reddit_monitor/status
```

---

## Future Enhancements

### Planned Features

1. **Sentiment Analysis**: Track community excitement about new releases
2. **User Credibility Scoring**: Weight IDs from known experts higher
3. **Multi-language Support**: Parse non-English communities
4. **Image/Video Analysis**: Extract tracks from Shazam screenshots
5. **Comment Thread Analysis**: Follow conversations for additional context

### Experimental Features

- **Discord integration**: Monitor Discord music communities
- **Twitter/X monitoring**: Track DJ announcements
- **Instagram parsing**: Extract tracklists from stories

---

## References

- **Reddit API Documentation**: https://www.reddit.com/dev/api
- **PRAW Documentation**: https://praw.readthedocs.io/
- **Rate Limiting Info**: https://github.com/reddit-archive/reddit/wiki/API
- **User Agreement**: https://www.redditinc.com/policies/user-agreement

---

## Support

For issues or questions:
1. Check logs: `docker compose logs scraper-orchestrator -f`
2. Run test suite: `python test_reddit_monitor.py`
3. Review metrics: `http://localhost:9091/metrics`
4. Open GitHub issue with logs and configuration

---

**Last Updated**: 2025-10-01
**Spider Version**: 2.1 (Enhanced Genre Tagging & r/House Support)
**Minimum PRAW Version**: 7.7.1

**Changelog v2.1**:
- ✨ Added automatic genre tagging based on subreddit
- ✨ Added r/Beatmatch and r/DJs to target subreddits
- ✨ Enhanced "Artist - Title" parsing for r/House strict format
- ✨ Improved duplicate detection and filtering
- ✨ Added label prefix support: `[Label] Artist - Title`
- 🐛 Fixed false positive detection in track parsing
- 📚 Expanded SUBREDDIT_GENRE_MAP with 10 genre mappings
