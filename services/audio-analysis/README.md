# Audio Analysis Service

## Overview

The Audio Analysis Service is a specialized microservice for SongNodes that extracts DJ-specific features from audio files. It analyzes tracks to identify structural characteristics that are critical for DJ mixing and curation.

## Features Extracted

### 1. Intro/Outro Duration
- **Intro Duration**: Length of beat-only or low-energy intro section (in seconds)
- **Outro Duration**: Length of outro section suitable for mixing (in seconds)
- **Algorithm**: RMS energy analysis to detect first sustained kick drum and last energy peak

### 2. Breakdown Detection
- **Breakdown Positions**: Array of breakdown events with:
  - `timestamp`: Time position in track
  - `duration`: Length of breakdown section
  - `depth`: Magnitude of energy drop (0.0-1.0)
  - `type`: Classification (minor, moderate, major)
- **Algorithm**: Peak detection and sustained energy drop analysis

### 3. Vocal Detection
- **Vocal Segments**: Array of vocal sections with:
  - `start_time`: Vocal segment start
  - `end_time`: Vocal segment end
  - `confidence`: Detection confidence (0.0-1.0)
  - `type`: Classification (vocal, melodic, instrumental)
- **Algorithm**: Harmonic-percussive source separation (HPSS) + spectral analysis

### 4. Beat Grid Analysis
- **Beat Grid**: Precise beat positions with:
  - `position`: Beat time position
  - `confidence`: Beat detection confidence
  - `beat_number`: Sequential beat number
- **BPM**: Estimated tempo in beats per minute
- **Algorithm**: librosa beat tracking with refinement

### 5. Energy Curve
- **Energy Curve**: Time-series energy profile for visualization
- **Format**: Array of `{time, energy}` points (100 points per track)
- **Usage**: Visualizing set energy flow and transition planning

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    RabbitMQ Queue                       │
│              (audio_analysis_queue)                     │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│              Audio Analysis Service                      │
│  ┌──────────────────────────────────────────────────┐  │
│  │         Queue Consumer (main.py)                  │  │
│  └─────────────────┬────────────────────────────────┘  │
│                    │                                    │
│  ┌─────────────────▼────────────────────────────────┐  │
│  │         Audio Fetcher                             │  │
│  │  - Spotify preview URLs (30sec)                   │  │
│  │  - MinIO storage (full tracks)                    │  │
│  └─────────────────┬────────────────────────────────┘  │
│                    │                                    │
│  ┌─────────────────▼────────────────────────────────┐  │
│  │         Analysis Modules                          │  │
│  │  ┌─────────────────────────────────────────────┐ │  │
│  │  │  IntroOutroDetector                          │ │  │
│  │  │  - RMS energy analysis                       │ │  │
│  │  │  - Energy curve generation                   │ │  │
│  │  └─────────────────────────────────────────────┘ │  │
│  │  ┌─────────────────────────────────────────────┐ │  │
│  │  │  VocalDetector                               │ │  │
│  │  │  - HPSS (harmonic-percussive separation)    │ │  │
│  │  │  - Spectral centroid analysis               │ │  │
│  │  └─────────────────────────────────────────────┘ │  │
│  │  ┌─────────────────────────────────────────────┐ │  │
│  │  │  BreakdownDetector                           │ │  │
│  │  │  - Peak/valley detection                     │ │  │
│  │  │  - Energy drop measurement                   │ │  │
│  │  └─────────────────────────────────────────────┘ │  │
│  │  ┌─────────────────────────────────────────────┐ │  │
│  │  │  BeatGridAnalyzer                            │ │  │
│  │  │  - Beat tracking                             │ │  │
│  │  │  - BPM estimation and refinement             │ │  │
│  │  └─────────────────────────────────────────────┘ │  │
│  └──────────────────────────────────────────────────┘  │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│              PostgreSQL Database                         │
│         tracks_audio_analysis table                      │
│       track_enrichment_status table                      │
└─────────────────────────────────────────────────────────┘
```

## Audio Processing Pipeline

1. **Audio Acquisition**
   - Fetch from Spotify preview URL (primary, 30 seconds)
   - Fallback to MinIO storage for full tracks
   - Convert to mono, 22050 Hz sample rate

2. **Feature Extraction** (parallel processing)
   - Intro/Outro: RMS energy thresholding
   - Vocals: HPSS + spectral analysis
   - Breakdowns: Peak detection + energy profiling
   - Beat Grid: librosa beat tracking

3. **Result Storage**
   - Store in PostgreSQL with JSONB fields
   - Update enrichment status tracking
   - Emit Prometheus metrics

## Libraries Used

### Core Audio Processing
- **librosa** (0.10.1): Beat tracking, onset detection, HPSS, energy analysis
- **essentia** (2.1b6): Advanced MIR algorithms, structural segmentation
- **numpy** (1.24.3): Numerical operations
- **scipy** (1.11.4): Signal processing, peak detection
- **soundfile** (0.12.1): Audio I/O

### Service Infrastructure
- **FastAPI** (0.109.0): REST API framework
- **asyncpg** (0.29.0): Async PostgreSQL driver
- **aio-pika** (9.3.1): RabbitMQ async client
- **httpx** (0.26.0): HTTP client for audio downloads
- **prometheus-client** (0.19.0): Metrics export

## API Endpoints

### Health Check
```
GET /health
```
Returns service health status and dependency checks.

**Response:**
```json
{
  "status": "healthy",
  "service": "audio-analysis",
  "timestamp": "2025-09-30T10:00:00Z",
  "database": "healthy",
  "rabbitmq": "healthy"
}
```

### Metrics
```
GET /metrics
```
Prometheus metrics endpoint.

**Metrics exposed:**
- `audio_analysis_tracks_analyzed_total`: Total tracks analyzed
- `audio_analysis_tracks_failed_total`: Total failed analyses
- `audio_analysis_duration_seconds`: Analysis duration histogram
- `audio_analysis_queue_size`: Current queue size
- `audio_analysis_active_count`: Active analysis tasks

### Manual Analysis (Testing)
```
POST /analyze
```
Manually trigger audio analysis for a track.

**Request:**
```json
{
  "track_id": "uuid-here",
  "spotify_preview_url": "https://p.scdn.co/...",
  "audio_file_path": "optional/path/in/minio"
}
```

**Response:**
```json
{
  "track_id": "uuid-here",
  "intro_duration_seconds": 8.5,
  "outro_duration_seconds": 12.3,
  "breakdown_timestamps": [
    {
      "timestamp": 45.2,
      "duration": 8.5,
      "depth": 0.7,
      "type": "major"
    }
  ],
  "vocal_segments": [
    {
      "start_time": 15.0,
      "end_time": 40.0,
      "confidence": 0.85,
      "type": "vocal"
    }
  ],
  "energy_curve": [
    {"time": 0.0, "energy": 0.25},
    {"time": 0.3, "energy": 0.35}
  ],
  "beat_grid": [
    {"position": 0.5, "confidence": 0.95, "beat_number": 1},
    {"position": 1.0, "confidence": 0.93, "beat_number": 2}
  ],
  "bpm": 128.5,
  "analysis_version": "1.0.0",
  "analyzed_at": "2025-09-30T10:00:00Z",
  "status": "completed"
}
```

## Queue Integration

### Message Format
The service consumes messages from `audio_analysis_queue`:

```json
{
  "track_id": "uuid-here",
  "spotify_preview_url": "https://p.scdn.co/...",
  "audio_file_path": "optional/path/in/minio"
}
```

### Publishing Analysis Requests

From scraper-orchestrator or other services:

```python
import aio_pika
import json

# Publish to queue
message = {
    "track_id": track_id,
    "spotify_preview_url": spotify_preview_url
}

await channel.default_exchange.publish(
    aio_pika.Message(body=json.dumps(message).encode()),
    routing_key='audio_analysis_queue'
)
```

## Database Schema

### tracks_audio_analysis Table
```sql
CREATE TABLE tracks_audio_analysis (
    id UUID PRIMARY KEY,
    track_id UUID UNIQUE REFERENCES tracks(id),
    intro_duration_seconds DECIMAL(6,2),
    outro_duration_seconds DECIMAL(6,2),
    breakdown_timestamps JSONB,
    vocal_segments JSONB,
    energy_curve JSONB,
    beat_grid JSONB,
    bpm DECIMAL(6,2),
    bpm_confidence DECIMAL(3,2),
    analysis_version VARCHAR(20),
    analyzed_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20),
    error_message TEXT,
    audio_source VARCHAR(100),
    audio_duration_seconds DECIMAL(6,2)
);
```

### Helper Functions

**Get tracks needing analysis:**
```sql
SELECT * FROM get_tracks_needing_analysis(100);
```

**Calculate mixability score:**
```sql
SELECT calculate_mixability_score('track-uuid-here');
```

## Performance Characteristics

### Processing Time
- **Spotify Preview (30s)**: 5-10 seconds per track
- **Full Track (3-5 min)**: 15-30 seconds per track
- **Timeout**: 60 seconds per track (configurable)

### Resource Usage
- **CPU**: 1-2 cores during analysis
- **Memory**: 500MB-1GB per worker
- **Network**: ~300KB per Spotify preview download

### Throughput
- **Single Worker**: ~6-12 tracks/minute (30s previews)
- **Recommended Scale**: 2-4 workers for production

### Optimization Strategies
1. **Caching**: Check database before processing
2. **Batch Processing**: Queue-based architecture
3. **Timeout Handling**: Circuit breaker for failed fetches
4. **Connection Pooling**: Database connections (5-15 pool size)

## Memory Leak Prevention

Following CLAUDE.md guidelines:

### Audio Buffer Cleanup
```python
# Audio data is properly cleaned up after processing
audio_data = None  # Explicit cleanup
gc.collect()  # Force garbage collection if needed
```

### Connection Pooling
- Database pool: min=5, max=15, timeout=30s
- RabbitMQ: Automatic reconnection with backoff
- HTTP client: Connection reuse with limits

### Resource Limits
- Container memory limit: 2GB
- Container CPU limit: 2.0 cores
- Per-track timeout: 60 seconds

## Deployment

### Docker Compose
```bash
# Build and start service
docker compose build audio-analysis
docker compose up -d audio-analysis

# View logs
docker compose logs -f audio-analysis

# Check health
curl http://localhost:8020/health

# View metrics
curl http://localhost:8020/metrics
```

### Environment Variables
```env
DATABASE_URL=postgresql://user:pass@db:5432/musicdb
REDIS_HOST=redis
REDIS_PORT=6379
RABBITMQ_HOST=rabbitmq
RABBITMQ_PORT=5672
RABBITMQ_USER=musicdb
RABBITMQ_PASS=musicdb_pass
MINIO_ENDPOINT=http://minio:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
```

## Integration with Scraper Orchestrator

### Queue Track for Analysis

Add to scraper-orchestrator's track processing:

```python
async def queue_track_for_analysis(track_id: str, spotify_id: str):
    """Queue track for audio analysis after scraping."""
    # Get Spotify preview URL from Spotify API
    spotify_preview_url = await get_spotify_preview_url(spotify_id)

    if spotify_preview_url:
        # Publish to audio analysis queue
        message = {
            "track_id": track_id,
            "spotify_preview_url": spotify_preview_url
        }

        await rabbitmq_channel.default_exchange.publish(
            aio_pika.Message(body=json.dumps(message).encode()),
            routing_key='audio_analysis_queue'
        )

        logger.info(f"Queued track {track_id} for audio analysis")
```

## Monitoring & Alerting

### Key Metrics to Monitor

1. **Processing Rate**: `rate(audio_analysis_tracks_analyzed_total[5m])`
2. **Error Rate**: `rate(audio_analysis_tracks_failed_total[5m])`
3. **Queue Size**: `audio_analysis_queue_size`
4. **Processing Duration**: `histogram_quantile(0.95, audio_analysis_duration_seconds)`

### Prometheus Alerts

```yaml
groups:
  - name: audio_analysis
    rules:
      - alert: AudioAnalysisHighFailureRate
        expr: rate(audio_analysis_tracks_failed_total[5m]) > 0.1
        for: 5m
        annotations:
          summary: "High failure rate in audio analysis"

      - alert: AudioAnalysisQueueBacklog
        expr: audio_analysis_queue_size > 1000
        for: 10m
        annotations:
          summary: "Audio analysis queue backlog"
```

## Testing

### Unit Tests
```bash
# Run unit tests for analysis modules
pytest services/audio-analysis/tests/
```

### Integration Test
```bash
# Manual test with sample track
curl -X POST http://localhost:8020/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "track_id": "test-uuid",
    "spotify_preview_url": "https://p.scdn.co/..."
  }'
```

## Troubleshooting

### Common Issues

**Issue**: Audio fetching fails
- Check Spotify preview URL validity
- Verify MinIO access credentials
- Check network connectivity

**Issue**: Analysis timeout
- Increase timeout value in main.py
- Check audio file size/duration
- Monitor CPU/memory usage

**Issue**: Queue not consuming
- Verify RabbitMQ connection
- Check queue declaration
- Review consumer logs

**Issue**: Database connection errors
- Verify DATABASE_URL format
- Check connection pool settings
- Monitor database connections

## Future Enhancements

1. **Advanced Features**
   - Key detection using Essentia
   - Camelot wheel notation
   - Harmonic compatibility scoring
   - Drop position detection

2. **Performance**
   - GPU acceleration for STFT
   - Parallel processing of modules
   - Audio preprocessing cache

3. **Quality**
   - Confidence scoring refinement
   - Manual correction interface
   - A/B testing of algorithms

## References

- [librosa Documentation](https://librosa.org/doc/latest/)
- [Essentia Documentation](https://essentia.upf.edu/documentation/)
- [Research: Section 3.2 - Track Structure Analysis](../../docs/research/research_sources_gemini.md)
- [DJ Mixing Techniques](../../docs/research/research_souces_claude.md)

## License

Part of the SongNodes project.