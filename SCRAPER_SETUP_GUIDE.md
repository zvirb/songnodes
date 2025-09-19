# SongNodes Scrapers Setup and Usage Guide

## Overview

This guide covers the setup and usage of the SongNodes music data scrapers that collect information from:
- **1001tracklists.com**: DJ tracklists and mix data
- **mixesdb.com**: Electronic music mix metadata
- **setlist.fm**: Live performance setlists via API

## Architecture

The scraping system consists of:
1. **Individual Scrapers**: Scrapy spiders for each data source
2. **Database Pipeline**: PostgreSQL integration for data storage
3. **Orchestrator Service**: Manages and schedules scraper execution
4. **REST API**: Serves scraped data to the frontend

## Quick Start

### 1. Install Dependencies

```bash
# Navigate to scrapers directory
cd /mnt/7ac3bfed-9d8e-4829-b134-b5e98ff7c013/programming/songnodes/scrapers

# Install required packages
pip install scrapy psycopg2-binary redis httpx python-dateutil
```

### 2. Environment Setup

Set required environment variables:

```bash
export POSTGRES_HOST=localhost
export POSTGRES_PORT=5432
export POSTGRES_DB=musicdb
export POSTGRES_USER=musicdb_app
export POSTGRES_PASSWORD=musicdb_pass
export SETLISTFM_API_KEY=8xTq8eBNbEZCWKg1ZrGpgsRQlU9GlNYNZVtG
```

### 3. Run Individual Scrapers

```bash
# Run 1001tracklists scraper
cd scrapers
scrapy crawl 1001tracklists

# Run MixesDB scraper
scrapy crawl mixesdb

# Run Setlist.fm API scraper
scrapy crawl setlistfm_api
```

### 4. Run All Scrapers

Use the unified runner script:

```bash
cd /mnt/7ac3bfed-9d8e-4829-b134-b5e98ff7c013/programming/songnodes
python3 run_scrapers.py --scrapers all
```

## Scraper Details

### 1001tracklists Spider (`1001tracklists`)

**Purpose**: Extracts DJ tracklists and mix information from 1001tracklists.com

**Features**:
- Rate limiting (1.5s delay between requests)
- Retry logic with exponential backoff
- Multiple selector fallbacks for site changes
- Handles track parsing with artist, remix, and mashup detection

**Data Collected**:
- Setlist metadata (DJ, event, venue, date)
- Individual tracks with timestamps
- Artist relationships (primary, featured, remixer)
- Track order and position data

### MixesDB Spider (`mixesdb`)

**Purpose**: Collects electronic music mix metadata from mixesdb.com

**Features**:
- Conservative rate limiting (2.0s delay)
- Handles wiki-style page structure
- Manages incomplete/ID tracks
- Extracts last updated dates

**Data Collected**:
- Mix information (DJ, date, venue)
- Track listings with timestamps
- Cover track detection
- Source and update metadata

### Setlist.fm API Spider (`setlistfm_api`)

**Purpose**: Fetches live performance data via the official setlist.fm API

**Features**:
- Official API integration with authentication
- Pagination support
- Artist-specific and general searches
- Rate limiting compliance (10 req/sec max)

**Data Collected**:
- Live performance setlists
- Venue and event information
- Artist performance data
- Cover song detection

## Database Integration

### Pipeline Components

1. **MusicDataPipeline**: Exports data to CSV files
2. **PostgreSQLPipeline**: Stores data directly in database

### Database Schema

The scrapers populate these main tables:
- `artists`: Artist information and metadata
- `tracks`: Track details with audio features
- `setlists`: Performance and mix information
- `performers`: DJ and artist performance data
- `venues`: Venue location data
- `events`: Event and festival information

### Data Relationships

- Artists ↔ Tracks (many-to-many via `track_artists`)
- Setlists ↔ Tracks (many-to-many via `setlist_tracks`)
- Performers ↔ Events ↔ Venues (hierarchical)

## API Integration

### REST Endpoints

The enhanced REST API provides access to scraped data:

```
GET /api/v1/artists          # List artists with search
GET /api/v1/tracks           # List tracks with filters
GET /api/v1/setlists         # List setlists/performances
GET /api/v1/graph/nodes      # Graph visualization data
GET /api/v1/stats            # Database statistics
```

### Scraper Management

```
POST /api/v1/scrape/trigger  # Trigger new scraping job
GET /api/v1/scrape/status/{task_id}  # Check job status
```

## Configuration

### Rate Limiting

Each scraper has conservative rate limits:
- **1001tracklists**: 1.5s delay, max 1 concurrent request
- **MixesDB**: 2.0s delay, max 1 concurrent request
- **Setlist.fm API**: 0.1s delay, respects API limits

### Error Handling

- Automatic retries with exponential backoff
- Graceful handling of site structure changes
- Comprehensive logging and monitoring
- Fallback selectors for different page layouts

### Data Quality

- Text normalization and cleaning
- Duplicate detection and handling
- Relationship validation
- Metadata preservation

## Monitoring

### Metrics Available

- Items scraped per source
- Success/failure rates
- Response times and delays
- Database insertion statistics

### Health Checks

- Database connectivity
- API availability
- Scraper status monitoring
- Rate limit compliance

## Production Deployment

### Docker Integration

The scrapers integrate with the existing Docker setup:
- Scraper Orchestrator service manages execution
- Database connections via connection pooling
- Redis for task queuing and state management

### Scheduling

- Automatic daily scraping via cron schedules
- Priority-based task queuing
- Resource management and throttling

## Troubleshooting

### Common Issues

1. **Import Errors**: Ensure Scrapy is installed
2. **Database Connection**: Check PostgreSQL credentials
3. **Rate Limiting**: Monitor delays and concurrent requests
4. **API Limits**: Verify Setlist.fm API key and quotas

### Debug Commands

```bash
# Test scraper syntax
scrapy check spider_name

# Run with debug output
scrapy crawl spider_name -L DEBUG

# Test database connection
python3 -c "import psycopg2; print('DB OK')"
```

### Log Analysis

Scrapers log to stdout with structured formats:
- INFO: Normal operation events
- WARNING: Handled errors and fallbacks
- ERROR: Failed requests and data issues

## Performance Optimization

### Recommendations

1. **Database**: Use connection pooling and batch inserts
2. **Network**: Implement caching for repeated requests
3. **Storage**: Regular cleanup of old scraping data
4. **Monitoring**: Track performance metrics and bottlenecks

### Scaling

- Horizontal scaling via multiple scraper instances
- Load balancing across data sources
- Distributed task queues for large-scale operations

## Security Considerations

- API keys stored in environment variables
- Rate limiting to avoid overwhelming sources
- User-agent identification for transparency
- Respectful scraping practices following robots.txt

---

## Files Modified/Created

### Core Scrapers
- `scrapers/spiders/1001tracklists_spider.py` - Enhanced with better error handling
- `scrapers/spiders/mixesdb_spider.py` - Fixed imports and added rate limiting
- `scrapers/spiders/setlistfm_api_spider.py` - Corrected item field mappings

### Pipeline & Infrastructure
- `scrapers/db_pipeline.py` - NEW: PostgreSQL integration pipeline
- `scrapers/settings.py` - Updated to include database pipeline
- `run_scrapers.py` - NEW: Unified scraper execution script
- `test_scrapers.py` - NEW: Validation and testing script

### API Enhancement
- `services/rest-api/main_enhanced.py` - NEW: Database-integrated REST API

This setup provides a robust, scalable music data collection system that actively gathers fresh data from multiple sources and makes it available to the SongNodes frontend through a comprehensive API.