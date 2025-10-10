# SongNodes Data Flow: Scraping to Database Storage

**Visual Guide to Data Acquisition and Storage**

---

## Part 1: The Complete Data Journey

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                         DATA ACQUISITION & STORAGE FLOW                       │
└──────────────────────────────────────────────────────────────────────────────┘

STAGE 1: WEB SCRAPING                    STAGE 2: ENRICHMENT
═══════════════════════                   ════════════════════

External Sources                          API Providers
─────────────────                         ─────────────────
┌─────────────────┐                      ┌─────────────────┐
│ 1001tracklists  │                      │    Spotify      │
│  (Playlists)    │──┐                   │  (Audio Feat.)  │──┐
└─────────────────┘  │                   └─────────────────┘  │
                     │                                        │
┌─────────────────┐  │                   ┌─────────────────┐  │
│    MixesDB      │  │                   │  MusicBrainz    │  │
│  (DJ Mixes)     │──┤                   │  (Metadata)     │──┤
└─────────────────┘  │                   └─────────────────┘  │
                     │                                        │
┌─────────────────┐  │                   ┌─────────────────┐  │
│  Resident Adv.  │  │                   │    Beatport     │  │
│   (Events)      │──┤                   │  (BPM/Key)      │──┤
└─────────────────┘  │                   └─────────────────┘  │
                     │                                        │
┌─────────────────┐  │                   ┌─────────────────┐  │
│   Mixcloud      │  │                   │    Last.fm      │  │
│  (Audio Mixes)  │──┘                   │   (Genres)      │──┘
└─────────────────┘                      └─────────────────┘
        │                                         │
        │                                         │
        ▼                                         ▼
┌──────────────────┐                     ┌──────────────────┐
│  Scrapy Spider   │                     │  API Gateway     │
│  ─────────────   │                     │  ─────────────   │
│  • XPath/CSS     │                     │  • Rate Limit    │
│  • Playwright    │                     │  • Caching       │
│  • Headers       │                     │  • Circuit Break │
│  • Retries       │                     │  • Exponential   │
└──────────────────┘                     │    Backoff       │
        │                                 └──────────────────┘
        │                                         │
        ▼                                         │
┌──────────────────┐                             │
│ Item Pipeline    │                             │
│ ───────────────  │                             │
│ 1. Validation    │                             │
│ 2. Enrichment ───┼─────────────────────────────┘
│ 3. Persistence   │
└──────────────────┘
        │
        │
        ▼
═══════════════════════════════════════════════════════════
        MEDALLION ARCHITECTURE: BRONZE → SILVER → GOLD
═══════════════════════════════════════════════════════════
```

---

## Part 2: Medallion Architecture Layers

### 🥉 **Bronze Layer: Immutable Raw Data**

```
┌─────────────────────────────────────────────────────────────────────┐
│                         BRONZE LAYER                                 │
│                    (Immutable Source Data)                           │
└─────────────────────────────────────────────────────────────────────┘

PURPOSE: Store 100% of scraped data exactly as received
RETENTION: Permanent (never modified or deleted)
BENEFIT: Complete pipeline replayability + audit trail

┌──────────────────────────────────────────────────────────────┐
│ bronze_scraped_tracks                                         │
├──────────────────────────────────────────────────────────────┤
│ id                  UUID (primary key)                        │
│ source              TEXT                                      │
│ source_url          TEXT                                      │
│ raw_data            JSONB ◄─── Complete HTML/JSON preserved  │
│ scraped_at          TIMESTAMP                                 │
│ scraper_version     TEXT                                      │
└──────────────────────────────────────────────────────────────┘

EXAMPLE RAW_DATA STRUCTURE:
{
  "track_name": "Strobe",
  "artist_name": "Deadmau5",
  "mix_name": "Essential Mix 2010",
  "position": 15,
  "timestamp": "1:23:45",
  "original_html": "<div class='track'>...</div>",
  "metadata": {
    "dj": "Pete Tong",
    "date": "2010-11-05",
    "source_id": "1001tl_12345"
  }
}

OTHER BRONZE TABLES:
┌────────────────────────────┐  ┌────────────────────────────┐
│ bronze_scraped_playlists   │  │ bronze_scraped_artists     │
│ ────────────────────────── │  │ ────────────────────────── │
│ • Playlist metadata        │  │ • Artist profiles          │
│ • Complete tracklists      │  │ • Social links             │
│ • DJ information           │  │ • Biography                │
└────────────────────────────┘  └────────────────────────────┘

┌────────────────────────────┐
│ bronze_api_enrichments     │
│ ────────────────────────── │
│ • Spotify responses        │
│ • MusicBrainz responses    │
│ • Complete API payloads    │
└────────────────────────────┘
```

---

### 🥈 **Silver Layer: Validated & Enriched**

```
┌─────────────────────────────────────────────────────────────────────┐
│                         SILVER LAYER                                 │
│              (Validated, Enriched, Quality-Scored)                   │
└─────────────────────────────────────────────────────────────────────┘

PURPOSE: Combine scraped + API-enriched data with quality tracking
RETENTION: Permanent with updates
BENEFIT: Production-ready data with full provenance

┌──────────────────────────────────────────────────────────────┐
│ silver_enriched_tracks                                        │
├──────────────────────────────────────────────────────────────┤
│ id                       UUID (primary key)                   │
│ bronze_id                UUID ──► bronze_scraped_tracks       │
│ track_id                 TEXT (unique)                        │
│                                                               │
│ ┌─ SCRAPED DATA ────────────────────────────────────────┐    │
│ │ track_name              TEXT                          │    │
│ │ artist_names            TEXT[]                        │    │
│ │ mix_name                TEXT                          │    │
│ │ position_in_mix         INTEGER                       │    │
│ │ timestamp_in_mix        TEXT                          │    │
│ └───────────────────────────────────────────────────────┘    │
│                                                               │
│ ┌─ ENRICHED DATA (from APIs) ───────────────────────────┐    │
│ │ spotify_id              TEXT                          │    │
│ │ isrc                    TEXT                          │    │
│ │ musicbrainz_id          TEXT                          │    │
│ │ beatport_id             TEXT                          │    │
│ │                                                       │    │
│ │ bpm                     INTEGER                       │    │
│ │ key                     INTEGER (Camelot: 1-12)       │    │
│ │ key_mode               TEXT (major/minor)            │    │
│ │ energy                  FLOAT (0-1)                   │    │
│ │ danceability            FLOAT (0-1)                   │    │
│ │ valence                 FLOAT (0-1)                   │    │
│ │ acousticness            FLOAT (0-1)                   │    │
│ │ instrumentalness        FLOAT (0-1)                   │    │
│ │ liveness                FLOAT (0-1)                   │    │
│ │ speechiness             FLOAT (0-1)                   │    │
│ │ loudness                FLOAT (dB)                    │    │
│ │                                                       │    │
│ │ genres                  TEXT[]                        │    │
│ │ release_date            DATE                          │    │
│ │ release_name            TEXT                          │    │
│ │ label                   TEXT                          │    │
│ │ duration_ms             INTEGER                       │    │
│ └───────────────────────────────────────────────────────┘    │
│                                                               │
│ ┌─ QUALITY METADATA ────────────────────────────────────┐    │
│ │ data_quality_score      FLOAT (0-1)                   │    │
│ │ enrichment_metadata     JSONB ◄─── Provenance         │    │
│ │ validation_status       TEXT                          │    │
│ └───────────────────────────────────────────────────────┘    │
│                                                               │
│ created_at               TIMESTAMP                            │
│ updated_at               TIMESTAMP                            │
└──────────────────────────────────────────────────────────────┘

ENRICHMENT_METADATA STRUCTURE (JSONB):
{
  "waterfall_attempts": [
    {
      "field": "bpm",
      "provider": "beatport",
      "value": 128,
      "confidence": 0.98,
      "timestamp": "2025-10-10T06:20:15Z",
      "cached": false
    },
    {
      "field": "bpm",
      "provider": "spotify",
      "value": 128,
      "confidence": 0.85,
      "timestamp": "2025-10-10T06:20:16Z",
      "cached": true,
      "note": "fallback_attempt"
    }
  ],
  "providers_used": ["beatport", "spotify", "musicbrainz"],
  "total_api_calls": 3,
  "total_cache_hits": 1,
  "enrichment_duration_ms": 1245,
  "quality_scores": {
    "completeness": 0.92,
    "confidence": 0.87,
    "validation": 1.0
  }
}

DATA QUALITY SCORE CALCULATION:
quality_score = (completeness × 0.4) + (confidence × 0.4) + (validation × 0.2)

Example:
completeness = 22/24 fields = 0.92
confidence = average of field confidences = 0.87
validation = all checks passed = 1.0
───────────────────────────────────────
quality_score = 0.896 (High Quality ✅)

OTHER SILVER TABLES:
┌────────────────────────────┐  ┌────────────────────────────┐
│ silver_enriched_artists    │  │ silver_enriched_playlists  │
│ ────────────────────────── │  │ ────────────────────────── │
│ • Artist metadata          │  │ • Playlist metadata        │
│ • Validated profiles       │  │ • Validated tracklists     │
│ • Quality scores           │  │ • Quality scores           │
└────────────────────────────┘  └────────────────────────────┘

┌────────────────────────────┐
│ silver_playlist_tracks     │
│ ────────────────────────── │
│ • Track position           │
│ • Transition data          │
│ • Timing information       │
└────────────────────────────┘
```

---

### 🥇 **Gold Layer: Business Analytics**

```
┌─────────────────────────────────────────────────────────────────────┐
│                          GOLD LAYER                                  │
│              (Business-Ready Analytics & Insights)                   │
└─────────────────────────────────────────────────────────────────────┘

PURPOSE: Aggregated, denormalized data optimized for analytics/UI
RETENTION: Refreshed from Silver layer
BENEFIT: Fast queries, pre-computed insights

┌──────────────────────────────────────────────────────────────┐
│ gold_track_analytics                                          │
├──────────────────────────────────────────────────────────────┤
│ track_id                 UUID (primary key)                   │
│                                                               │
│ ┌─ DENORMALIZED TRACK DATA ─────────────────────────────┐    │
│ │ track_name              TEXT                          │    │
│ │ primary_artist          TEXT                          │    │
│ │ all_artists             TEXT[]                        │    │
│ │ bpm                     INTEGER                       │    │
│ │ key                     INTEGER                       │    │
│ │ energy                  FLOAT                         │    │
│ │ genres                  TEXT[]                        │    │
│ │ release_year            INTEGER                       │    │
│ └───────────────────────────────────────────────────────┘    │
│                                                               │
│ ┌─ COMPUTED ANALYTICS ──────────────────────────────────┐    │
│ │ play_count              INTEGER                       │    │
│ │ playlist_appearances    INTEGER                       │    │
│ │ first_seen_date         DATE                          │    │
│ │ last_seen_date          DATE                          │    │
│ │ trending_score          FLOAT                         │    │
│ │ popularity_rank         INTEGER                       │    │
│ └───────────────────────────────────────────────────────┘    │
│                                                               │
│ ┌─ HARMONIC MIXING DATA ────────────────────────────────┐    │
│ │ compatible_keys         INTEGER[]                     │    │
│ │ harmonic_matches        UUID[]                        │    │
│ └───────────────────────────────────────────────────────┘    │
│                                                               │
│ ┌─ QUALITY INDICATORS ──────────────────────────────────┐    │
│ │ data_completeness       FLOAT                         │    │
│ │ confidence_score        FLOAT                         │    │
│ │ last_enriched           TIMESTAMP                     │    │
│ └───────────────────────────────────────────────────────┘    │
│                                                               │
│ updated_at               TIMESTAMP                            │
└──────────────────────────────────────────────────────────────┘

MATERIALIZED VIEWS (Pre-computed for Performance):

┌────────────────────────────────────────────────────────────┐
│ VIEW: gold_top_tracks_by_genre                              │
├────────────────────────────────────────────────────────────┤
│ SELECT                                                      │
│   genre,                                                    │
│   track_name,                                               │
│   primary_artist,                                           │
│   play_count,                                               │
│   trending_score,                                           │
│   ROW_NUMBER() OVER (                                       │
│     PARTITION BY genre                                      │
│     ORDER BY trending_score DESC                            │
│   ) as rank                                                 │
│ FROM gold_track_analytics                                   │
│ WHERE release_year >= EXTRACT(YEAR FROM NOW()) - 2         │
└────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────┐
│ VIEW: gold_harmonic_mixing_recommendations                  │
├────────────────────────────────────────────────────────────┤
│ Finds harmonically compatible tracks for DJs               │
│                                                             │
│ Rules:                                                      │
│ • Perfect match: Same key (e.g., 8A → 8A)                  │
│ • Compatible: Adjacent key (e.g., 8A → 7A, 9A, 8B)         │
│ • BPM difference: ≤ 6 BPM                                   │
│                                                             │
│ Returns:                                                    │
│   source_track_id, recommended_track_id,                    │
│   compatibility ('perfect'|'compatible'|'possible'),        │
│   bpm_difference                                            │
└────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────┐
│ VIEW: gold_artist_collaboration_network                     │
├────────────────────────────────────────────────────────────┤
│ Network analysis of artist collaborations                   │
│                                                             │
│ Returns:                                                    │
│   artist_1, artist_2,                                       │
│   collaboration_count,                                      │
│   shared_playlists,                                         │
│   genre_overlap                                             │
└────────────────────────────────────────────────────────────┘

OTHER GOLD TABLES:
┌────────────────────────────┐  ┌────────────────────────────┐
│ gold_artist_analytics      │  │ gold_playlist_analytics    │
│ ────────────────────────── │  │ ────────────────────────── │
│ • Artist popularity        │  │ • Playlist trends          │
│ • Genre distribution       │  │ • Track flow analysis      │
│ • Collaboration networks   │  │ • BPM/key progression      │
│ • Career timeline          │  │ • Energy curve             │
└────────────────────────────┘  └────────────────────────────┘
```

---

## Part 3: Detailed Scraping Example

### Example: Scraping a Mix from 1001tracklists

```
┌─────────────────────────────────────────────────────────────────────┐
│                    STEP-BY-STEP SCRAPING FLOW                        │
└─────────────────────────────────────────────────────────────────────┘

1. SPIDER STARTS
   ──────────────
   URL: https://www.1001tracklists.com/tracklist/2fnv9h39/
        pete-tong-bbc-radio-1-essential-mix-2010-11-05.html

   ▼

2. HTTP REQUEST (via Scrapy + Playwright for dynamic content)
   ────────────────────────────────────────────────────────────
   Headers:
     User-Agent: Mozilla/5.0 (realistic browser)
     Accept-Language: en-US,en;q=0.9
     Referer: https://www.1001tracklists.com/

   Response Status: 200 OK
   Content-Type: text/html; charset=utf-8

   ▼

3. HTML PARSING (XPath/CSS Selectors)
   ────────────────────────────────────
   Extract from HTML structure:

   <div class="tlTog">
     <div class="tlpItem" data-trackid="12345">
       <div class="trackPosition">15</div>
       <div class="trackTime">1:23:45</div>
       <div class="trackValue">
         <span class="trackArtist">Deadmau5</span>
         <span class="trackName">Strobe</span>
       </div>
       <meta itemprop="trackId" content="spotify:track:2VHlwTPRH7Wwxo2KYW5jR7">
     </div>
   </div>

   Extracted Data (ItemLoader):
   {
     "position": 15,
     "timestamp": "1:23:45",
     "artist": "Deadmau5",
     "title": "Strobe",
     "spotify_id": "2VHlwTPRH7Wwxo2KYW5jR7",
     "source_track_id": "12345"
   }

   ▼

4. VALIDATION PIPELINE
   ────────────────────
   Checks:
   ✅ Required fields present (artist, title)
   ✅ Artist name length: 1-200 chars
   ✅ Title length: 1-300 chars
   ✅ Position is integer > 0
   ✅ Timestamp format valid (HH:MM:SS)

   If validation fails → Item dropped + logged

   ▼

5. ENRICHMENT PIPELINE (Delegation to Metadata-Enrichment Service)
   ─────────────────────────────────────────────────────────────────
   HTTP POST http://metadata-enrichment:8020/enrich
   {
     "track_id": "uuid-generated",
     "artist_name": "Deadmau5",
     "track_title": "Strobe",
     "existing_spotify_id": "2VHlwTPRH7Wwxo2KYW5jR7"
   }

   Metadata-Enrichment Service:
   ┌──────────────────────────────────────────────────┐
   │ 1. Check Cache (Redis)                           │
   │    Key: spotify:track:2VHlwTPRH7Wwxo2KYW5jR7     │
   │    ✅ CACHE HIT (skip API call)                  │
   │                                                   │
   │ 2. If cache miss, use Configuration-Driven        │
   │    Waterfall:                                     │
   │                                                   │
   │    For field "bpm":                               │
   │    ┌─────────────────────────────────┐           │
   │    │ Priority 1: Beatport (0.98)     │           │
   │    │   ├─ API Call via Gateway       │           │
   │    │   ├─ Circuit Breaker: CLOSED    │           │
   │    │   ├─ Rate Limit: OK             │           │
   │    │   └─ Result: 128 BPM ✅         │           │
   │    │                                 │           │
   │    │ Priority 2: Spotify (0.85)      │           │
   │    │   └─ SKIPPED (P1 succeeded)     │           │
   │    └─────────────────────────────────┘           │
   │                                                   │
   │    For field "key":                               │
   │    ┌─────────────────────────────────┐           │
   │    │ Priority 1: Beatport (0.95)     │           │
   │    │   ├─ API Call                   │           │
   │    │   └─ Result: 8 (A Minor) ✅     │           │
   │    └─────────────────────────────────┘           │
   │                                                   │
   │    For field "energy":                            │
   │    ┌─────────────────────────────────┐           │
   │    │ Priority 1: Spotify (0.90)      │           │
   │    │   ├─ CACHED ✅                  │           │
   │    │   └─ Result: 0.76               │           │
   │    └─────────────────────────────────┘           │
   │                                                   │
   │ 3. Calculate Quality Score:                       │
   │    Completeness: 22/24 = 0.92                     │
   │    Confidence: avg(0.98,0.95,0.90) = 0.94         │
   │    Validation: 1.0                                │
   │    Quality: 0.95 (Excellent ✅)                   │
   └──────────────────────────────────────────────────┘

   Response to Scraper:
   {
     "track_id": "uuid-generated",
     "status": "completed",
     "sources_used": ["beatport", "spotify"],
     "metadata_acquired": {
       "spotify_id": "2VHlwTPRH7Wwxo2KYW5jR7",
       "isrc": "USUG11000123",
       "musicbrainz_id": "abc-123",
       "bpm": 128,
       "key": 8,
       "key_mode": "minor",
       "energy": 0.76,
       "danceability": 0.68,
       "valence": 0.42,
       "genres": ["progressive house", "electro house"],
       "release_date": "2009-10-26",
       "duration_ms": 645000
     },
     "enrichment_metadata": {
       "waterfall_attempts": [...],
       "total_api_calls": 2,
       "total_cache_hits": 1,
       "quality_score": 0.95
     },
     "cached": true,
     "timestamp": "2025-10-10T06:20:15Z"
   }

   ▼

6. PERSISTENCE PIPELINE (Medallion Architecture)
   ─────────────────────────────────────────────

   A. BRONZE LAYER (Raw Data)
      ─────────────────────────
      INSERT INTO bronze_scraped_tracks (
        source,
        source_url,
        raw_data,
        scraped_at,
        scraper_version
      ) VALUES (
        '1001tracklists',
        'https://www.1001tracklists.com/tracklist/2fnv9h39/...',
        '{
          "track_name": "Strobe",
          "artist_name": "Deadmau5",
          "position": 15,
          "timestamp": "1:23:45",
          "mix_name": "Pete Tong Essential Mix",
          "original_html": "<div class=tlpItem>...</div>",
          ...complete scraped data...
        }',
        NOW(),
        'v2.1.0'
      );

   B. SILVER LAYER (Enriched Data)
      ──────────────────────────────
      INSERT INTO silver_enriched_tracks (
        bronze_id,
        track_id,
        track_name,
        artist_names,
        spotify_id,
        isrc,
        musicbrainz_id,
        bpm,
        key,
        key_mode,
        energy,
        danceability,
        valence,
        genres,
        release_date,
        duration_ms,
        data_quality_score,
        enrichment_metadata,
        validation_status
      ) VALUES (
        <bronze_id>,
        'uuid-generated',
        'Strobe',
        ARRAY['Deadmau5'],
        '2VHlwTPRH7Wwxo2KYW5jR7',
        'USUG11000123',
        'abc-123',
        128,
        8,
        'minor',
        0.76,
        0.68,
        0.42,
        ARRAY['progressive house', 'electro house'],
        '2009-10-26',
        645000,
        0.95,
        '{...waterfall metadata...}',
        'validated'
      )
      ON CONFLICT (track_id) DO UPDATE SET
        bpm = COALESCE(EXCLUDED.bpm, silver_enriched_tracks.bpm),
        ...update if new data has higher confidence...;

   C. GOLD LAYER (Analytics - Updated via Trigger)
      ───────────────────────────────────────────────
      UPDATE gold_track_analytics SET
        track_name = 'Strobe',
        primary_artist = 'Deadmau5',
        bpm = 128,
        key = 8,
        energy = 0.76,
        genres = ARRAY['progressive house', 'electro house'],
        play_count = play_count + 1,
        playlist_appearances = playlist_appearances + 1,
        last_seen_date = NOW(),
        data_completeness = 0.92,
        confidence_score = 0.94,
        updated_at = NOW()
      WHERE track_id = 'uuid-generated';

   ▼

7. RESULT
   ───────
   ✅ Track "Strobe" by Deadmau5 now stored in all 3 layers
   ✅ Complete data lineage: Bronze → Silver → Gold
   ✅ Quality score: 0.95 (Excellent)
   ✅ Ready for UI/Analytics consumption
```

---

## Part 4: Final Database State Example

### What Gets Stored: Complete Example Record

```sql
──────────────────────────────────────────────────────────────────
🥉 BRONZE LAYER: bronze_scraped_tracks
──────────────────────────────────────────────────────────────────

id:              550e8400-e29b-41d4-a716-446655440000
source:          1001tracklists
source_url:      https://www.1001tracklists.com/tracklist/2fnv9h39/...
raw_data:        {
                   "track_name": "Strobe",
                   "artist_name": "Deadmau5",
                   "mix_name": "Pete Tong - Essential Mix",
                   "position": 15,
                   "timestamp": "1:23:45",
                   "source_track_id": "12345",
                   "html_snippet": "<div class='tlpItem'>...</div>",
                   "metadata": {
                     "dj": "Pete Tong",
                     "radio_show": "BBC Radio 1",
                     "broadcast_date": "2010-11-05",
                     "total_tracks": 42
                   },
                   "scraper_metadata": {
                     "user_agent": "Mozilla/5.0...",
                     "ip_address": "proxy-123",
                     "response_time_ms": 1245
                   }
                 }
scraped_at:      2025-10-10 06:20:10.123456
scraper_version: v2.1.0

──────────────────────────────────────────────────────────────────
🥈 SILVER LAYER: silver_enriched_tracks
──────────────────────────────────────────────────────────────────

id:                   650e8400-e29b-41d4-a716-446655440001
bronze_id:            550e8400-e29b-41d4-a716-446655440000 ──► BRONZE
track_id:             deadmau5-strobe-2009

SCRAPED DATA:
─────────────
track_name:           Strobe
artist_names:         ["Deadmau5"]
mix_name:             Pete Tong - Essential Mix
position_in_mix:      15
timestamp_in_mix:     1:23:45

ENRICHED DATA (from Spotify, Beatport, MusicBrainz):
────────────────────────────────────────────────────
spotify_id:           2VHlwTPRH7Wwxo2KYW5jR7
isrc:                 USUG11000123
musicbrainz_id:       f6f2326f-6b25-4170-b89d-e235b25508e8
beatport_id:          1234567

bpm:                  128
key:                  8 (A Minor in Camelot notation)
key_mode:             minor
energy:               0.76
danceability:         0.68
valence:              0.42
acousticness:         0.01
instrumentalness:     0.89
liveness:             0.11
speechiness:          0.04
loudness:             -6.2

genres:               ["progressive house", "electro house", "electronic"]
release_date:         2009-10-26
release_name:         For Lack of a Better Name
label:                Ultra Records
duration_ms:          645000 (10 minutes 45 seconds)

QUALITY METADATA:
─────────────────
data_quality_score:   0.95
enrichment_metadata:  {
                        "waterfall_attempts": [
                          {
                            "field": "bpm",
                            "provider": "beatport",
                            "value": 128,
                            "confidence": 0.98,
                            "timestamp": "2025-10-10T06:20:12Z",
                            "cached": false,
                            "response_time_ms": 234
                          },
                          {
                            "field": "key",
                            "provider": "beatport",
                            "value": 8,
                            "confidence": 0.95,
                            "timestamp": "2025-10-10T06:20:12Z",
                            "cached": false
                          },
                          {
                            "field": "energy",
                            "provider": "spotify",
                            "value": 0.76,
                            "confidence": 0.90,
                            "timestamp": "2025-10-10T06:20:13Z",
                            "cached": true
                          }
                        ],
                        "providers_used": ["beatport", "spotify", "musicbrainz"],
                        "total_api_calls": 3,
                        "total_cache_hits": 1,
                        "enrichment_duration_ms": 1456,
                        "quality_scores": {
                          "completeness": 0.92,
                          "confidence": 0.94,
                          "validation": 1.0
                        }
                      }
validation_status:    validated
created_at:           2025-10-10 06:20:10.456789
updated_at:           2025-10-10 06:20:14.567890

──────────────────────────────────────────────────────────────────
🥇 GOLD LAYER: gold_track_analytics
──────────────────────────────────────────────────────────────────

track_id:             deadmau5-strobe-2009
track_name:           Strobe
primary_artist:       Deadmau5
all_artists:          ["Deadmau5"]

CORE DATA:
──────────
bpm:                  128
key:                  8
energy:               0.76
genres:               ["progressive house", "electro house"]
release_year:         2009

COMPUTED ANALYTICS:
───────────────────
play_count:           1247  ◄─── Tracks how many times seen
playlist_appearances: 89    ◄─── Number of playlists/mixes
first_seen_date:      2010-11-05
last_seen_date:       2025-10-10
trending_score:       0.87  ◄─── Based on recent appearances
popularity_rank:      15    ◄─── Overall ranking

HARMONIC MIXING:
────────────────
compatible_keys:      [7, 8, 9, 8]  ◄─── 7A, 8A, 9A, 8B (Camelot)
harmonic_matches:     [uuid1, uuid2, uuid3, ...]  ◄─── Compatible tracks

QUALITY:
────────
data_completeness:    0.92
confidence_score:     0.94
last_enriched:        2025-10-10 06:20:14

updated_at:           2025-10-10 06:20:15
```

---

## Part 5: Query Examples

### Querying the Medallion Architecture

```sql
──────────────────────────────────────────────────────────────────
EXAMPLE 1: Get Complete Track History (Bronze → Silver → Gold)
──────────────────────────────────────────────────────────────────

SELECT
  -- Bronze: Source data
  b.source,
  b.source_url,
  b.raw_data->>'track_name' as original_track_name,
  b.scraped_at,

  -- Silver: Enriched data
  s.track_name as validated_track_name,
  s.bpm,
  s.key,
  s.energy,
  s.data_quality_score,
  s.enrichment_metadata->>'providers_used' as providers,

  -- Gold: Analytics
  g.play_count,
  g.playlist_appearances,
  g.trending_score,
  g.popularity_rank

FROM bronze_scraped_tracks b
LEFT JOIN silver_enriched_tracks s ON s.bronze_id = b.id
LEFT JOIN gold_track_analytics g ON g.track_id = s.track_id

WHERE b.raw_data->>'track_name' ILIKE '%strobe%'
  AND b.raw_data->>'artist_name' ILIKE '%deadmau5%';

──────────────────────────────────────────────────────────────────
EXAMPLE 2: Find Harmonically Compatible Tracks for DJing
──────────────────────────────────────────────────────────────────

SELECT
  current.track_name as "Current Track",
  current.primary_artist as "Artist",
  current.bpm as "BPM",
  current.key as "Key",

  compatible.track_name as "Compatible Track",
  compatible.primary_artist as "Compatible Artist",
  compatible.bpm as "Compatible BPM",
  compatible.key as "Compatible Key",

  ABS(current.bpm - compatible.bpm) as "BPM Difference",

  CASE
    WHEN current.key = compatible.key THEN 'Perfect Match ✅'
    WHEN ABS(current.key - compatible.key) = 1 THEN 'Adjacent Key'
    WHEN current.key % 12 + 1 = compatible.key THEN 'Energy Boost (+1)'
    ELSE 'Possible'
  END as "Compatibility"

FROM gold_track_analytics current
CROSS JOIN gold_track_analytics compatible

WHERE current.track_name = 'Strobe'
  AND current.primary_artist = 'Deadmau5'
  AND compatible.track_id != current.track_id
  AND ABS(current.bpm - compatible.bpm) <= 6
  AND (
    current.key = compatible.key OR
    ABS(current.key - compatible.key) <= 1
  )

ORDER BY ABS(current.bpm - compatible.bpm), "Compatibility"
LIMIT 10;

──────────────────────────────────────────────────────────────────
EXAMPLE 3: Track Enrichment Quality Report
──────────────────────────────────────────────────────────────────

SELECT
  COUNT(*) as total_tracks,

  -- Quality distribution
  COUNT(*) FILTER (WHERE data_quality_score >= 0.9) as excellent,
  COUNT(*) FILTER (WHERE data_quality_score >= 0.7 AND data_quality_score < 0.9) as good,
  COUNT(*) FILTER (WHERE data_quality_score < 0.7) as needs_improvement,

  -- Average completeness
  AVG(data_completeness) as avg_completeness,
  AVG(confidence_score) as avg_confidence,

  -- Provider usage
  COUNT(*) FILTER (WHERE enrichment_metadata->'providers_used' ? 'spotify') as spotify_count,
  COUNT(*) FILTER (WHERE enrichment_metadata->'providers_used' ? 'beatport') as beatport_count,
  COUNT(*) FILTER (WHERE enrichment_metadata->'providers_used' ? 'musicbrainz') as musicbrainz_count

FROM silver_enriched_tracks;

──────────────────────────────────────────────────────────────────
EXAMPLE 4: Top Trending Tracks This Month
──────────────────────────────────────────────────────────────────

SELECT
  track_name,
  primary_artist,
  genres[1] as primary_genre,
  bpm,
  key,
  play_count,
  playlist_appearances,
  trending_score,
  ROW_NUMBER() OVER (ORDER BY trending_score DESC) as rank

FROM gold_track_analytics

WHERE last_seen_date >= NOW() - INTERVAL '30 days'

ORDER BY trending_score DESC
LIMIT 50;
```

---

## Summary: What Information Is Retained

### ✅ **Complete Data Retention Across 3 Layers**

| Layer | Data Retained | Purpose | Retention |
|:------|:--------------|:--------|:----------|
| **🥉 Bronze** | 100% of scraped HTML/JSON | Audit trail, replay capability | Permanent |
| **🥈 Silver** | Validated + enriched metadata | Production data layer | Permanent with updates |
| **🥇 Gold** | Aggregated analytics | Fast queries, UI consumption | Refreshed from Silver |

### 📊 **Total Fields Captured Per Track: 40+**

**From Scraping (8 fields):**
- Track name, Artist names, Mix name, Position, Timestamp, Source URL, Source metadata

**From API Enrichment (24+ fields):**
- IDs: Spotify, ISRC, MusicBrainz, Beatport
- Audio Features: BPM, Key, Energy, Danceability, Valence, Acousticness, Instrumentalness, Liveness, Speechiness, Loudness
- Metadata: Genres, Release Date, Release Name, Label, Duration

**Quality Metadata (8 fields):**
- Quality score, Completeness, Confidence, Validation status, Provider provenance, API call tracking, Cache statistics

**Analytics (10+ computed fields):**
- Play count, Playlist appearances, Trending score, Popularity rank, Harmonic compatibility, First/last seen dates

### 🔄 **Complete Data Lineage**

Every enriched field includes:
- **Source provider** (Spotify, Beatport, MusicBrainz, etc.)
- **Confidence score** (0.60 - 0.98)
- **Timestamp** of acquisition
- **Cache status** (hit/miss)
- **API call metadata** (response time, errors)

This enables:
- **Pipeline replay** from Bronze layer
- **Quality debugging** (which provider gave which value)
- **Cost tracking** (API calls per track)
- **Performance optimization** (cache effectiveness)

---

**Your data flows from raw HTML to business-ready analytics with complete traceability at every step!** 🎯
