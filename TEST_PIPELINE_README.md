# SongNodes Pipeline End-to-End Test Suite

## Overview

This comprehensive test suite verifies the complete SongNodes pipeline from start to finish. It tests the entire workflow of music data scraping, processing, and visualization.

## What It Tests

The test suite performs these steps:

1. **Service Management**: Starts all services via `docker-compose`
2. **Database Verification**: Verifies target tracks are in database (should be 145)
3. **Orchestrator Trigger**: Triggers orchestrator to search for one test target track
4. **Queue Monitoring**: Monitors RabbitMQ queue for scraping tasks
5. **Scraping Completion**: Waits for scraping to complete
6. **Data Verification**: Verifies playlists table has entries
7. **Graph Data Check**: Verifies songs and song_adjacency tables are populated
8. **Junction Tables**: Checks that playlist_songs junction table links playlists to songs
9. **API Testing**: Tests the REST API endpoints for target tracks
10. **Reporting**: Generates a report showing record counts in all tables

## Prerequisites

- Docker and Docker Compose installed
- Python 3.8 or higher
- SongNodes project properly configured

## Setup

1. **Install test dependencies**:
   ```bash
   python setup_test_environment.py
   ```

   Or manually:
   ```bash
   pip install asyncpg>=0.28.0 httpx>=0.24.0
   ```

2. **Ensure environment variables** are set in `.env` file:
   ```bash
   POSTGRES_PASSWORD=musicdb_secure_pass
   RABBITMQ_USER=musicdb
   RABBITMQ_PASS=musicdb_pass
   ```

## Running the Tests

### Full Test Suite

Run the complete end-to-end test:

```bash
python test_pipeline.py
```

### Environment Check

Before running tests, ensure services are healthy:

```bash
docker compose ps
```

## Test Output

The test suite provides:

- **Console Output**: Real-time progress with colored status indicators
- **Log File**: Detailed logging saved to `test_pipeline.log`
- **JSON Report**: Comprehensive results in `test_pipeline_report_YYYYMMDD_HHMMSS.json`

### Status Indicators

- ✅ Success
- ❌ Failure
- ⚠️  Warning
- 📦 Service operations
- 🗄️  Database operations
- 🎵 Music data operations
- 🎯 Orchestrator operations
- 📬 Queue monitoring
- 📊 Data verification
- 🌐 API testing
- 📋 Reporting

## Expected Results

### Healthy System

For a properly functioning system, you should see:

- All services start successfully
- Target tracks loaded (around 145 tracks)
- Orchestrator accepts scraping tasks
- Tasks execute (may fail due to external API limits)
- Database tables populated with some data
- API endpoints respond correctly

### Common Issues

1. **Services Not Starting**
   ```
   ❌ Failed to start services
   ```
   - Check Docker is running
   - Verify port availability (5433, 6380, 5673, etc.)
   - Check disk space

2. **Database Connection Issues**
   ```
   ❌ Failed to connect to database
   ```
   - Ensure PostgreSQL service is healthy
   - Check database credentials in `.env`
   - Verify port 5433 is accessible

3. **No Target Tracks**
   ```
   ⚠️ Expected ~145 target tracks, found 0
   ```
   - Check `scrapers/target_tracks_for_scraping.json` exists
   - Verify database schema is properly initialized

4. **Scraping Tasks Fail**
   ```
   ⚠️ All scraping tasks failed
   ```
   - External websites may be blocking requests
   - Rate limiting may be active
   - This is often expected in testing scenarios

## Test Results Analysis

### Database Table Counts

The test reports record counts for all tables:

```
📊 DATABASE RECORD COUNTS:
   albums              :        0
   artists             :      142
   edges               :        0
   nodes               :        0
   playlist_tracks     :        0
   playlists           :        0
   setlist_tracks      :    1,234
   setlists            :       87
   song_adjacency      :      456
   songs               :      789
   target_tracks       :      145
   track_artists       :      234
   tracks              :      567
   TOTAL              :    3,634
```

### API Endpoint Status

```
🌐 API ENDPOINT TESTS:
   ✅ orchestrator_health      : 200
   ✅ orchestrator_status      : 200
   ✅ api_gateway_health       : 200
   ❌ rest_api_health          : 503
   ✅ graph_api_health         : 200
```

## Troubleshooting

### Service Health Issues

Check individual service logs:
```bash
docker compose logs -f [service-name]
```

Common services to check:
- `postgres`
- `redis`
- `rabbitmq`
- `scraper-orchestrator`
- `api-gateway`

### Database Issues

Connect to database directly:
```bash
docker compose exec postgres psql -U musicdb_user -d musicdb
```

Check table existence:
```sql
\dt musicdb.*
```

### Port Conflicts

If ports are already in use, update `docker-compose.yml` or stop conflicting services:
```bash
sudo lsof -i :5433  # Check what's using PostgreSQL port
```

## Test Configuration

### Timeouts

The test uses these timeouts:
- Service startup: 300 seconds
- Health checks: 30 seconds
- Task monitoring: 300 seconds (5 minutes)
- Database operations: 30 seconds

### Customization

Edit `test_pipeline.py` to modify:
- Service endpoints (ports)
- Database configuration
- Test timeouts
- Expected data counts

## Continuous Integration

For CI/CD environments, run tests in headless mode:

```bash
python test_pipeline.py 2>&1 | tee test_results.log
```

Check exit code:
```bash
echo $?  # 0 = success, 1 = failure
```

## Support

For issues with the test suite:

1. Check this README
2. Review `test_pipeline.log` for detailed errors
3. Verify SongNodes configuration
4. Check Docker service health

The test suite is designed to be fault-tolerant and will continue running even if some components fail, providing a comprehensive view of system health.