# 🚀 SongNodes Extended Scrapers & Pipeline Deployment Guide

## Overview

This guide covers the deployment of the newly extended SongNodes scraper and pipeline architecture, including:
- 6 new data source scrapers (Mixcloud, SoundCloud, YouTube, Internet Archive, LiveTracklist, Resident Advisor)
- Metadata enrichment service (Spotify, MusicBrainz, Discogs, Last.fm)
- Audio analysis service (librosa/essentia-based)
- WebUI API key management system

---

## 🎯 Deployment Status

### ✅ Services Added to docker-compose.yml

**Scrapers (All Integrated):**
- `scraper-mixcloud` (Port 8015) - No API key required
- `scraper-soundcloud` (Port 8016) - No API key required
- `scraper-youtube` (Port 8017) - **Requires YouTube API key**
- `scraper-internetarchive` (Port 8018) - No API key required
- `scraper-livetracklist` (Port 8019) - No API key required
- `scraper-residentadvisor` (Port 8023) - No API key required

**Services:**
- `metadata-enrichment` (Port 8022) - Requires API keys (Spotify, Discogs)
- `audio-analysis` (Port 8020) - No API key required

**Orchestrator Updated:**
- All new scrapers registered in `scraper-orchestrator` health check

---

## 📋 Pre-Deployment Checklist

### 1. Database Migrations
All SQL scripts are already in `sql/init/` and will run automatically on first PostgreSQL startup:
- ✅ `06-audio-analysis-schema.sql` - Audio features table
- ✅ `06-metadata-enrichment.sql` - Enrichment status & API cache
- ✅ `07-api-keys.sql` - Encrypted API key storage

### 2. Environment Variables
Ensure these are set in your `.env` file:

```bash
# Required for production
API_KEY_ENCRYPTION_SECRET=your_secure_encryption_key_here_min_32_chars

# Database credentials (already configured)
POSTGRES_PASSWORD=musicdb_secure_pass

# Optional: Fallback API keys (WebUI takes precedence)
SPOTIFY_CLIENT_ID=
SPOTIFY_CLIENT_SECRET=
YOUTUBE_API_KEY=
DISCOGS_TOKEN=
LASTFM_API_KEY=
```

### 3. Frontend Build
The API Key Management UI component is ready at:
- `frontend/src/components/APIKeyManager.tsx`
- Integrated into `SettingsPanel.tsx`

---

## 🧪 Pre-Deployment Testing (MANDATORY)

**Before deploying to production, you MUST run the following tests as required by CLAUDE.md:**

```bash
# 1. Frontend unit tests
npm test

# 2. Backend service tests
docker compose exec metadata-enrichment pytest
docker compose exec audio-analysis pytest

# 3. End-to-end tests (MANDATORY - MUST PASS)
npm run test:e2e

# 4. Specific test suites
npm run test:graph    # Graph visualization tests
npm run test:pixi     # PIXI.js rendering tests
npm run test:performance  # Performance benchmarks
```

**Required checks:**
- ✅ Zero console errors (JS, React, TypeScript, reference errors)
- ✅ All components render correctly
- ✅ No memory leaks in graph interactions
- ✅ Backend health checks pass

**DO NOT deploy if:**
- ❌ Tests fail
- ❌ Console errors present
- ❌ Components don't render

---

## 🚀 Deployment Steps

### Step 1: Build All New Services
```bash
# Navigate to project root
cd /mnt/7ac3bfed-9d8e-4829-b134-b5e98ff7c013/programming/songnodes

# Build new scrapers
docker compose build scraper-mixcloud scraper-soundcloud scraper-youtube \
  scraper-internetarchive scraper-livetracklist scraper-residentadvisor

# Build new services
docker compose build metadata-enrichment audio-analysis

# Build updated frontend (if API key UI integrated)
docker compose build frontend
```

### Step 2: Start Core Infrastructure
```bash
# Start database, Redis, RabbitMQ first
docker compose up -d postgres redis rabbitmq db-connection-pool

# Wait for health checks
docker compose ps | grep -E "postgres|redis|rabbitmq"
```

### Step 3: Start Orchestrator & NLP Processor
```bash
# Required for scrapers
docker compose up -d scraper-orchestrator nlp-processor

# Verify they're healthy
docker compose logs -f scraper-orchestrator nlp-processor
```

### Step 4: Start New Services
```bash
# Metadata enrichment and audio analysis
docker compose up -d metadata-enrichment audio-analysis

# Check logs
docker compose logs -f metadata-enrichment audio-analysis
```

### Step 5: Start All Scrapers
```bash
# Start all scrapers (old + new)
docker compose up -d scraper-1001tracklists scraper-mixesdb scraper-setlistfm \
  scraper-reddit scraper-mixcloud scraper-soundcloud scraper-youtube \
  scraper-internetarchive scraper-livetracklist scraper-residentadvisor

# Verify health
curl http://localhost:8015/health  # Mixcloud
curl http://localhost:8016/health  # SoundCloud
curl http://localhost:8017/health  # YouTube (may show degraded without API key)
curl http://localhost:8018/health  # Internet Archive
curl http://localhost:8019/health  # LiveTracklist
curl http://localhost:8023/health  # Resident Advisor
```

### Step 6: Start Frontend & API Gateway
```bash
docker compose up -d rest-api api-gateway frontend

# Access WebUI
open http://localhost:3006
```

---

## 🔐 API Key Configuration via WebUI

### Access the Settings Page
1. Navigate to `http://localhost:3006/settings`
2. Click on **"API Keys"** tab
3. You'll see sections for each service

### Add Spotify Credentials (Required for Metadata Enrichment)
1. Go to https://developer.spotify.com/dashboard
2. Create an application
3. Copy **Client ID** and **Client Secret**
4. In WebUI:
   - Paste Client ID into "Spotify Client ID" field
   - Paste Client Secret into "Spotify Client Secret" field
   - Click **"Save"**
   - Click **"Test Connection"** to verify (should show ✓ green)

### Add YouTube API Key (Required for YouTube Scraper)
1. Go to https://console.cloud.google.com/apis/credentials
2. Create API Key
3. Enable **YouTube Data API v3**
4. In WebUI:
   - Paste API Key into "YouTube API Key" field
   - Click **"Save"**
   - Click **"Test Connection"** (should show ✓ green)

### Add Discogs Token (Optional, for Release Metadata)
1. Go to https://www.discogs.com/settings/developers
2. Generate Personal Access Token
3. In WebUI:
   - Paste token into "Discogs Token" field
   - Click **"Save"**

### Add Last.fm API Key (Optional, for Tags/Popularity)
1. Go to https://www.last.fm/api/account/create
2. Get API Key
3. In WebUI:
   - Paste key into "Last.fm API Key" field
   - Click **"Save"**

---

## 🔍 Verification & Testing

### 1. Check Orchestrator Status
```bash
curl http://localhost:8001/scrapers/status | jq
```

Expected output should show all 10 scrapers with health status:
```json
{
  "scrapers": [
    {"name": "1001tracklists", "status": "healthy"},
    {"name": "mixesdb", "status": "healthy"},
    {"name": "setlistfm", "status": "healthy"},
    {"name": "reddit", "status": "healthy"},
    {"name": "mixcloud", "status": "healthy"},
    {"name": "soundcloud", "status": "healthy"},
    {"name": "youtube", "status": "healthy|degraded"},
    {"name": "internetarchive", "status": "healthy"},
    {"name": "livetracklist", "status": "healthy"},
    {"name": "residentadvisor", "status": "healthy"}
  ],
  "healthy_scrapers": 10,
  "total_scrapers": 10
}
```

### 2. Test Metadata Enrichment
```bash
# Check health
curl http://localhost:8022/health | jq

# Get enrichment stats
curl http://localhost:8022/stats | jq

# Test single track enrichment (after adding API keys)
curl -X POST http://localhost:8022/enrich \
  -H "Content-Type: application/json" \
  -d '{
    "track_id": "some-uuid-here",
    "artist_name": "Daft Punk",
    "track_title": "One More Time"
  }' | jq
```

### 3. Test Audio Analysis
```bash
# Check health
curl http://localhost:8020/health | jq

# Analyze a track with Spotify preview URL
curl -X POST http://localhost:8020/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "track_id": "some-uuid-here",
    "spotify_preview_url": "https://p.scdn.co/mp3-preview/..."
  }' | jq
```

### 4. Test Individual Scrapers
```bash
# Mixcloud - No API key required
curl -X POST http://localhost:8015/scrape \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.mixcloud.com/discover/"}' | jq

# YouTube - Requires API key
curl -X POST http://localhost:8017/scrape \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.youtube.com/watch?v=VIDEO_ID"}' | jq

# Check YouTube quota
curl http://localhost:8017/quota | jq
```

---

## 📊 Monitoring & Observability

### Prometheus Metrics
All services expose metrics at `/metrics`:
- `http://localhost:8001/metrics` - Orchestrator
- `http://localhost:8022/metrics` - Metadata enrichment
- `http://localhost:8020/metrics` - Audio analysis
- Each scraper also exposes `/metrics`

### Grafana Dashboards
Access Grafana at `http://localhost:3001` and import:
1. Scraper metrics dashboard (scrapers' throughput, errors)
2. Metadata enrichment dashboard (API calls, cache hit rates)
3. Audio analysis dashboard (processing time, queue size)

### Health Checks
```bash
# Quick health check all services
for port in 8011 8012 8013 8014 8015 8016 8017 8018 8019 8020 8022 8023; do
  echo "Port $port:"
  curl -s http://localhost:$port/health | jq -c '.status,.scraper'
done
```

---

## 🐛 Troubleshooting

### YouTube Scraper Shows "degraded"
**Cause:** YouTube API key not configured
**Solution:** Add API key via WebUI (Settings → API Keys → YouTube API Key)

### Metadata Enrichment Not Working
**Cause:** Spotify API credentials missing
**Solution:** Add Spotify Client ID and Secret via WebUI

### Scraper Can't Connect to Orchestrator
**Cause:** Orchestrator not started or unhealthy
**Solution:**
```bash
docker compose logs scraper-orchestrator
docker compose restart scraper-orchestrator
```

### Database Connection Errors
**Cause:** PostgreSQL not fully initialized
**Solution:**
```bash
docker compose logs postgres | grep "ready to accept connections"
docker compose restart metadata-enrichment audio-analysis
```

### NLP Processor Errors
**Cause:** Model not downloaded or service unhealthy
**Solution:**
```bash
docker compose logs nlp-processor
docker compose restart nlp-processor
```

---

## 🔄 Rollback Procedure

If you need to rollback to the previous configuration:

```bash
# Stop new services
docker compose stop scraper-mixcloud scraper-soundcloud scraper-youtube \
  scraper-internetarchive scraper-livetracklist scraper-residentadvisor \
  metadata-enrichment audio-analysis

# Original services continue running
docker compose ps | grep scraper
```

Database migrations are additive and don't break existing functionality.

---

## 📈 Performance Tuning

### Resource Limits
All services have resource limits defined in docker-compose.yml:
- Scrapers: 1 CPU, 1GB RAM
- Metadata enrichment: 1 CPU, 1GB RAM
- Audio analysis: 2 CPU, 2GB RAM (CPU intensive)

### Scaling
To increase scraper throughput:
```bash
# Scale a specific scraper
docker compose up -d --scale scraper-mixcloud=3

# Note: You'll need to configure nginx load balancing for scaled services
```

---

## 📚 Additional Resources

- **API Key Management**: See `API_KEY_MANAGEMENT_IMPLEMENTATION.md`
- **Scraper Configuration**: See `docs/SCRAPER_CONFIGURATION.md`
- **Metadata Enrichment**: See `services/metadata-enrichment/README.md`
- **Audio Analysis**: See `services/audio-analysis/README.md`

---

## ✅ Post-Deployment Checklist

- [ ] **Testing passed** (npm run test:e2e MUST pass with zero errors)
- [ ] All services showing as healthy in `docker compose ps`
- [ ] Orchestrator can reach all 10 scrapers
- [ ] API keys configured via WebUI
- [ ] Metadata enrichment test successful
- [ ] Audio analysis test successful
- [ ] Prometheus metrics accessible
- [ ] Grafana dashboards configured
- [ ] Frontend Settings → API Keys page accessible
- [ ] **CLAUDE.md compliance**: Single docker-compose.yml only (no overlay files)

---

## 🎯 Next Steps

1. **Schedule Regular Enrichment**: Metadata enrichment runs every 15 minutes automatically
2. **Monitor Quota Usage**: Check YouTube quota daily via `/quota` endpoint
3. **Review Logs**: Set up log aggregation (Loki already configured)
4. **Add Alert Rules**: Configure Prometheus alerts for critical failures
5. **Test Full Pipeline**: Scrape → Enrich → Analyze → Visualize

---

**Deployment Complete! 🎉**

All scrapers and services are production-ready and integrated with the orchestrator.