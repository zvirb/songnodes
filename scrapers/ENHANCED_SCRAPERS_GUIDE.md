# 🚀 Enhanced Scrapers Setup & Usage Guide

**Last Updated:** September 19, 2025

This guide provides complete instructions for running the enhanced music scrapers either in a virtual environment or using Docker containers.

---

## 📋 Quick Start

### Option 1: Virtual Environment (Recommended for Development)

```bash
# 1. Create and activate virtual environment
python3 -m venv venv
source venv/bin/activate

# 2. Install dependencies
pip install -r requirements.txt

# 3. Run a spider
scrapy crawl enhanced_1001tracklists -s CLOSESPIDER_PAGECOUNT=5
```

### Option 2: Docker (Recommended for Production)

```bash
# 1. Build and start services
./run_enhanced_scrapers.sh build
./run_enhanced_scrapers.sh start

# 2. Run a spider
./run_enhanced_scrapers.sh run-spider enhanced_1001tracklists

# 3. Run all spiders
./run_enhanced_scrapers.sh run-all
```

---

## 🕷️ Available Enhanced Spiders

| Spider Name | Target Site | Focus | Status |
|------------|-------------|-------|--------|
| `enhanced_1001tracklists` | 1001tracklists.com | DJ sets, tracklists | ✅ Ready |
| `enhanced_mixesdb` | mixesdb.com | Underground mixes | ✅ Ready |
| `setlistfm_api` | setlist.fm | Live performances | ✅ Ready |
| `enhanced_reddit` | reddit.com | Track discussions | ✅ Ready |

---

## 🐳 Docker Setup

### Prerequisites

- Docker and Docker Compose installed
- At least 2GB free disk space
- Port 5432, 6379, and 8080 available

### Directory Structure

```
scrapers/
├── Dockerfile.enhanced          # Docker image definition
├── docker-compose.enhanced.yml  # Service orchestration
├── run_enhanced_scrapers.sh     # Runner script
├── requirements.txt             # Python dependencies
├── spiders/                     # Spider implementations
│   ├── enhanced_1001tracklists_spider.py
│   ├── enhanced_mixesdb_spider.py
│   ├── enhanced_reddit_spider.py
│   └── setlistfm_api_spider.py
└── target_tracks_for_scraping.json  # Target tracks
```

### Building the Image

```bash
# Build the Docker image with all enhancements
./run_enhanced_scrapers.sh build

# Or manually:
docker compose -f docker-compose.enhanced.yml build
```

### Starting Services

```bash
# Start all services (Redis, PostgreSQL, scrapers)
./run_enhanced_scrapers.sh start

# Check status
./run_enhanced_scrapers.sh status

# View logs
./run_enhanced_scrapers.sh logs
```

### Running Spiders

```bash
# Run a specific spider
./run_enhanced_scrapers.sh run-spider enhanced_1001tracklists

# With custom settings
./run_enhanced_scrapers.sh run-spider enhanced_mixesdb \
  -s CLOSESPIDER_PAGECOUNT=10 \
  -s DOWNLOAD_DELAY=2

# Run all enhanced spiders
./run_enhanced_scrapers.sh run-all
```

### Container Shell Access

```bash
# Open shell in scrapers container
./run_enhanced_scrapers.sh shell

# Then inside the container:
scrapy list  # List available spiders
scrapy crawl enhanced_1001tracklists  # Run a spider
```

---

## 🔧 Virtual Environment Setup

### Installation

```bash
# Create virtual environment
python3 -m venv venv

# Activate (Linux/Mac)
source venv/bin/activate

# Activate (Windows)
venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

### Running Spiders

```bash
# Activate environment
source venv/bin/activate

# Set environment variables
export REDIS_HOST=localhost
export REDIS_PORT=6380
export POSTGRES_HOST=localhost
export POSTGRES_PORT=5433

# Run spider
scrapy crawl enhanced_1001tracklists

# With settings
scrapy crawl enhanced_mixesdb \
  -s CLOSESPIDER_PAGECOUNT=10 \
  -s LOG_LEVEL=DEBUG
```

---

## ⚙️ Configuration

### Environment Variables

```bash
# Redis Configuration
REDIS_HOST=localhost          # Redis server host
REDIS_PORT=6379               # Redis server port

# PostgreSQL Configuration
POSTGRES_HOST=localhost       # Database host
POSTGRES_PORT=5432           # Database port
POSTGRES_DB=musicdb          # Database name
POSTGRES_USER=musicuser      # Database user
POSTGRES_PASSWORD=musicpass  # Database password

# Scraper Settings
SCRAPER_STATE_PREFIX=scraped:setlists  # Redis key prefix
SCRAPER_SOURCE_TTL_DAYS=30            # Source TTL in days
SCRAPER_RUN_TTL_HOURS=24              # Run TTL in hours
SCRAPER_FORCE_RUN=0                   # Force run (bypass quota)

# Batch Settings
TRACKLISTS_URL_BATCH_SIZE=20          # 1001tracklists batch size
MIXESDB_ARTIST_BATCH_SIZE=10          # MixesDB batch size
SETLISTFM_ARTIST_BATCH_SIZE=12        # Setlist.fm batch size
REDDIT_SUBREDDIT_BATCH_SIZE=10        # Reddit batch size
```

### Scrapy Settings

```python
# Common settings for all spiders
DOWNLOAD_DELAY = 1.5          # Delay between requests
CONCURRENT_REQUESTS = 2       # Parallel requests
ROBOTSTXT_OBEY = True        # Respect robots.txt
CLOSESPIDER_PAGECOUNT = 10   # Max pages to crawl
LOG_LEVEL = 'INFO'          # Logging level
```

---

## 🎯 Features

### Enhanced Capabilities

1. **Redis State Management**
   - Cross-run deduplication
   - Persistent source tracking
   - Daily quota enforcement

2. **Intelligent Rotation**
   - Artist batch rotation
   - URL batch cycling
   - Time-based selection

3. **Contemporary Focus**
   - 2023-2025 track targeting
   - Popular artist prioritization
   - Festival and venue searches

4. **Improved Search Strategies**
   - Artist-first searches
   - Genre-based discovery
   - Direct tracklist URLs
   - Multiple selector patterns

---

## 📊 Database Schema

The scrapers write to a PostgreSQL database with the following main tables:

- `tracks` - Track information
- `artists` - Artist details
- `setlists` - DJ sets and mixes
- `track_artists` - Track-artist relationships
- `setlist_tracks` - Setlist-track relationships

---

## 🔍 Monitoring

### Built-in Monitoring Commands

```bash
# Basic monitoring dashboard
./run_enhanced_scrapers.sh monitor

# Detailed monitoring with recent activity
./run_enhanced_scrapers.sh monitor detailed

# Live monitoring with auto-refresh (5-second intervals)
./run_enhanced_scrapers.sh monitor-live

# Scraping statistics and metrics
./run_enhanced_scrapers.sh stats

# System health check
./run_enhanced_scrapers.sh health
```

### Python Monitoring Tool

```bash
# Using the standalone monitoring script
python3 monitor_scrapers.py live        # Live monitoring
python3 monitor_scrapers.py report      # Generate report
python3 monitor_scrapers.py health      # Health check
python3 monitor_scrapers.py stats       # Statistics

# With options
python3 monitor_scrapers.py live --interval 10  # 10-second refresh
python3 monitor_scrapers.py stats --json        # JSON output
```

### Monitoring Features

1. **Service Health**
   - Redis connectivity and memory usage
   - PostgreSQL database status
   - Container health checks
   - Disk and memory usage

2. **Scraping Metrics**
   - Total keys in Redis (deduplication tracking)
   - Keys per spider
   - Deduplication rate
   - Sources processed per spider
   - Last run times

3. **Database Statistics**
   - Record counts per table
   - Recent activity (last hour/24h)
   - Top artists by track count
   - Scraping rate over time

4. **Live Monitoring**
   - Real-time container status
   - Redis operations per second
   - Active database connections
   - Recent spider activity logs
   - Auto-refresh every 5 seconds

### Dashboard Views

#### Basic Monitor
Shows:
- Service health status
- Redis state management stats
- Database record counts

#### Detailed Monitor
Includes everything from basic plus:
- Recent scraping activity (last 10 tracks)
- Track names and artists
- Timestamps

#### Live Monitor
Real-time updates showing:
- Container status
- Redis operations/sec
- Database connections
- Recent log entries

#### Statistics
Comprehensive metrics:
- Hourly scraping activity (24h)
- Spider performance metrics
- Top 10 artists
- Processing rates

#### Health Check
System assessment:
- ✓/✗ for each component
- Health score (0-5)
- Disk space check
- Memory usage check
- Issue identification

### Check Scraping Progress

```bash
# View real-time logs
./run_enhanced_scrapers.sh logs

# Access database via Adminer
# Open browser: http://localhost:8080
# Server: postgres
# Username: musicuser
# Password: musicpass
# Database: musicdb
```

### Redis Monitoring

```bash
# Connect to Redis
docker exec -it scrapers-redis redis-cli

# Check keys
KEYS scraped:*

# Get key count
DBSIZE

# Check specific spider keys
KEYS scraped:*:1001tracklists*
KEYS scraped:*:mixesdb*
```

---

## 🧪 Testing

### Run Test Suite

```bash
# Using Docker
./run_enhanced_scrapers.sh test

# Using venv
source venv/bin/activate
python test_multi_spider.py
```

### Test Individual Spider

```bash
# Quick test with limited pages
scrapy crawl enhanced_1001tracklists \
  -s CLOSESPIDER_PAGECOUNT=2 \
  -s LOG_LEVEL=DEBUG
```

---

## 🛠️ Troubleshooting

### Common Issues

1. **Import Errors**
   ```bash
   # Ensure all dependencies installed
   pip install -r requirements.txt
   ```

2. **Redis Connection Failed**
   ```bash
   # Check Redis is running
   docker ps | grep redis
   # Or start manually
   docker run -p 6379:6379 redis:7-alpine
   ```

3. **Database Connection Failed**
   ```bash
   # Check PostgreSQL is running
   docker ps | grep postgres
   # Check connection
   psql -h localhost -p 5432 -U musicuser -d musicdb
   ```

4. **Spider Not Found**
   ```bash
   # List available spiders
   scrapy list
   ```

### Debug Mode

```bash
# Run with debug logging
scrapy crawl enhanced_1001tracklists -L DEBUG

# Test with minimal pages
scrapy crawl enhanced_mixesdb \
  -s CLOSESPIDER_PAGECOUNT=1 \
  -s LOG_LEVEL=DEBUG
```

---

## 🚀 Production Deployment

### Using Docker Compose

```bash
# Production build
docker compose -f docker-compose.enhanced.yml build --no-cache

# Start in detached mode
docker compose -f docker-compose.enhanced.yml up -d

# Scale if needed
docker compose -f docker-compose.enhanced.yml scale enhanced-scrapers=3
```

### Scheduled Runs

```bash
# Add to crontab for daily runs
0 2 * * * /path/to/run_enhanced_scrapers.sh run-all >> /var/log/scrapers.log 2>&1
```

---

## 📝 Development Notes

### Adding New Spiders

1. Create spider file in `spiders/` directory
2. Inherit from `scrapy.Spider`
3. Add Redis state management
4. Update `improved_search_strategies.py`
5. Test with limited pages

### Modifying Search Strategies

Edit `spiders/improved_search_strategies.py` to:
- Add new artists
- Update search URLs
- Modify rotation logic
- Change batch sizes

---

## 🎵 Target Tracks

The scrapers look for tracks defined in `target_tracks_for_scraping.json`. This includes:
- 149 contemporary electronic tracks (2023-2025)
- Popular artists like FISHER, Anyma, Fred again..
- Various genres: tech house, melodic techno, progressive house

---

## 📞 Support

For issues or questions:
1. Check the logs: `./run_enhanced_scrapers.sh logs`
2. Review test report: `ORCHESTRATOR_TEST_REPORT.md`
3. Verify service health: `./run_enhanced_scrapers.sh status`

---

**Happy Scraping! 🕷️🎵**