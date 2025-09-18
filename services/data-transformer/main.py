"""
Data Transformer Service
Handles data normalization, cleaning, and format conversion for music track data
"""

from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, validator
from typing import List, Optional, Dict, Any, Union
from datetime import datetime, timedelta
import asyncio
import logging
import json
import os
import re
from enum import Enum
import hashlib

import redis
import asyncpg
from prometheus_client import Counter, Gauge, Histogram, generate_latest
from fastapi.responses import PlainTextResponse
import httpx

# Configure logging
logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO"),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Prometheus metrics
transformation_tasks_total = Counter('transformation_tasks_total', 'Total transformation tasks', ['operation', 'status'])
active_transformations = Gauge('active_transformations', 'Number of active transformations', ['operation'])
transformation_duration = Histogram('transformation_duration_seconds', 'Transformation duration', ['operation'])
processed_records = Counter('processed_records_total', 'Total records processed', ['source', 'status'])

# Performance optimization metrics
batch_operation_duration = Histogram('batch_operation_duration_seconds', 'Batch operation duration', ['operation_type'])
batch_size_histogram = Histogram('batch_size', 'Batch operation sizes', ['operation_type'], buckets=[1, 10, 50, 100, 500, 1000, 2000, 5000])
connection_pool_usage = Gauge('connection_pool_usage', 'Connection pool utilization')
database_operation_duration = Histogram('database_operation_duration_seconds', 'Database operation duration', ['operation_type'])

# Initialize FastAPI app
app = FastAPI(
    title="Data Transformer Service",
    description="Transforms and normalizes music track data",
    version="1.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for non-security-conscious app
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Redis connection
redis_client = redis.Redis(
    host=os.getenv("REDIS_HOST", "redis"),
    port=int(os.getenv("REDIS_PORT", 6379)),
    decode_responses=True
)

# Database configuration
DATABASE_CONFIG = {
    "host": os.getenv("POSTGRES_HOST", "postgres"),
    "port": int(os.getenv("POSTGRES_PORT", 5432)),
    "database": os.getenv("POSTGRES_DB", "musicdb"),
    "user": os.getenv("POSTGRES_USER", "postgres"),
    "password": os.getenv("POSTGRES_PASSWORD", "password")
}

# Database connection pool
db_pool = None

# =====================
# Data Models
# =====================

class TransformationOperation(str, Enum):
    NORMALIZE = "normalize"
    CLEAN = "clean"
    VALIDATE = "validate"
    ENRICH = "enrich"
    DEDUPLICATE = "deduplicate"
    FORMAT_CONVERT = "format_convert"

class DataSource(str, Enum):
    SCRAPED_1001TRACKLISTS = "1001tracklists"
    SCRAPED_MIXESDB = "mixesdb"
    SCRAPED_SETLISTFM = "setlistfm"
    SCRAPED_REDDIT = "reddit"
    API_SPOTIFY = "spotify"
    API_BEATPORT = "beatport"
    USER_UPLOAD = "user_upload"

class ProcessingStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    SKIPPED = "skipped"

class TrackData(BaseModel):
    """Raw track data from various sources"""
    id: Optional[str] = None
    source: DataSource
    source_id: str
    title: Optional[str] = None
    artist: Optional[str] = None
    album: Optional[str] = None
    genre: Optional[str] = None
    label: Optional[str] = None
    release_date: Optional[str] = None
    duration: Optional[str] = None
    bpm: Optional[Union[int, str]] = None
    key: Optional[str] = None
    url: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = {}
    raw_data: Optional[Dict[str, Any]] = {}
    created_at: Optional[datetime] = None

class NormalizedTrack(BaseModel):
    """Normalized track data"""
    id: str
    source: DataSource
    source_id: str
    title: str
    artist: str
    album: Optional[str] = None
    genre: Optional[str] = None
    label: Optional[str] = None
    release_date: Optional[datetime] = None
    duration_seconds: Optional[int] = None
    bpm: Optional[int] = None
    key: Optional[str] = None
    url: Optional[str] = None
    fingerprint: str
    confidence_score: float = Field(ge=0.0, le=1.0)
    metadata: Dict[str, Any] = {}
    normalized_at: datetime = Field(default_factory=datetime.now)

class TransformationTask(BaseModel):
    """Transformation task configuration"""
    id: Optional[str] = None
    operation: TransformationOperation
    source_data: Union[TrackData, List[TrackData]]
    options: Optional[Dict[str, Any]] = {}
    priority: int = Field(default=5, ge=1, le=10)
    retry_count: int = 0
    max_retries: int = 3
    status: ProcessingStatus = ProcessingStatus.PENDING
    created_at: Optional[datetime] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    error_message: Optional[str] = None

class TransformationResult(BaseModel):
    """Result of transformation operation"""
    task_id: str
    operation: TransformationOperation
    status: ProcessingStatus
    input_count: int
    output_count: int
    skipped_count: int
    error_count: int
    processing_time: float
    results: List[NormalizedTrack] = []
    errors: List[str] = []

# =====================
# Data Transformation Classes
# =====================

class DataNormalizer:
    """Normalizes raw track data to standard format"""
    
    def __init__(self):
        self.title_cleaners = [
            (r'\s*\(.*?\)\s*', ''),  # Remove content in parentheses
            (r'\s*\[.*?\]\s*', ''),  # Remove content in brackets
            (r'\s+', ' '),           # Multiple spaces to single
            (r'^\s+|\s+$', ''),      # Trim whitespace
        ]
        
        self.artist_cleaners = [
            (r'\s*feat\.?\s*.*$', ''),  # Remove featuring artists
            (r'\s*ft\.?\s*.*$', ''),    # Remove ft. artists
            (r'\s*vs\.?\s*.*$', ''),    # Remove vs. artists
            (r'\s*&.*$', ''),           # Remove & collaborations
            (r'\s+', ' '),              # Multiple spaces to single
            (r'^\s+|\s+$', ''),         # Trim whitespace
        ]
        
        self.genre_mapping = {
            # Electronic genres
            'house': 'House', 'tech house': 'Tech House', 'techno': 'Techno',
            'trance': 'Trance', 'progressive': 'Progressive', 'dubstep': 'Dubstep',
            'drum and bass': 'Drum & Bass', 'dnb': 'Drum & Bass',
            'ambient': 'Ambient', 'downtempo': 'Downtempo',
            # Hip-hop genres
            'hip hop': 'Hip-Hop', 'rap': 'Hip-Hop', 'trap': 'Trap',
            # Rock genres
            'rock': 'Rock', 'alternative': 'Alternative Rock', 'indie': 'Indie Rock',
            # Pop genres
            'pop': 'Pop', 'indie pop': 'Indie Pop',
            # Other
            'jazz': 'Jazz', 'classical': 'Classical', 'reggae': 'Reggae'
        }
    
    async def normalize_track(self, track_data: TrackData) -> NormalizedTrack:
        """Normalize a single track"""
        try:
            # Generate unique ID
            track_id = self._generate_track_id(track_data)
            
            # Clean and normalize fields
            title = self._clean_title(track_data.title or "Unknown Title")
            artist = self._clean_artist(track_data.artist or "Unknown Artist")
            album = self._clean_text(track_data.album) if track_data.album else None
            genre = self._normalize_genre(track_data.genre) if track_data.genre else None
            label = self._clean_text(track_data.label) if track_data.label else None
            
            # Parse dates and durations
            release_date = self._parse_date(track_data.release_date) if track_data.release_date else None
            duration_seconds = self._parse_duration(track_data.duration) if track_data.duration else None
            
            # Parse BPM
            bpm = self._parse_bpm(track_data.bpm) if track_data.bpm else None
            
            # Normalize key
            key = self._normalize_key(track_data.key) if track_data.key else None
            
            # Generate fingerprint for deduplication
            fingerprint = self._generate_fingerprint(title, artist, album)
            
            # Calculate confidence score
            confidence_score = self._calculate_confidence(track_data)
            
            normalized_track = NormalizedTrack(
                id=track_id,
                source=track_data.source,
                source_id=track_data.source_id,
                title=title,
                artist=artist,
                album=album,
                genre=genre,
                label=label,
                release_date=release_date,
                duration_seconds=duration_seconds,
                bpm=bpm,
                key=key,
                url=track_data.url,
                fingerprint=fingerprint,
                confidence_score=confidence_score,
                metadata={
                    "original_title": track_data.title,
                    "original_artist": track_data.artist,
                    "raw_metadata": track_data.metadata,
                    "transformation_timestamp": datetime.now().isoformat()
                }
            )
            
            return normalized_track
            
        except Exception as e:
            logger.error(f"Error normalizing track {track_data.source_id}: {str(e)}")
            raise
    
    def _clean_title(self, title: str) -> str:
        """Clean track title"""
        cleaned = title
        for pattern, replacement in self.title_cleaners:
            cleaned = re.sub(pattern, replacement, cleaned, flags=re.IGNORECASE)
        return cleaned.strip() or "Unknown Title"
    
    def _clean_artist(self, artist: str) -> str:
        """Clean artist name"""
        cleaned = artist
        for pattern, replacement in self.artist_cleaners:
            cleaned = re.sub(pattern, replacement, cleaned, flags=re.IGNORECASE)
        return cleaned.strip() or "Unknown Artist"
    
    def _clean_text(self, text: str) -> str:
        """Generic text cleaning"""
        if not text:
            return None
        return re.sub(r'\s+', ' ', text.strip())
    
    def _normalize_genre(self, genre: str) -> str:
        """Normalize genre to standard categories"""
        if not genre:
            return None
        
        genre_lower = genre.lower().strip()
        return self.genre_mapping.get(genre_lower, genre.title())
    
    def _parse_date(self, date_str: str) -> Optional[datetime]:
        """Parse various date formats"""
        if not date_str:
            return None
        
        # Common date formats
        date_formats = [
            "%Y-%m-%d",
            "%Y/%m/%d",
            "%d/%m/%Y",
            "%m/%d/%Y",
            "%Y-%m",
            "%Y",
            "%B %d, %Y",
            "%b %d, %Y"
        ]
        
        for fmt in date_formats:
            try:
                return datetime.strptime(date_str.strip(), fmt)
            except ValueError:
                continue
        
        logger.warning(f"Could not parse date: {date_str}")
        return None
    
    def _parse_duration(self, duration_str: str) -> Optional[int]:
        """Parse duration to seconds"""
        if not duration_str:
            return None
        
        # Handle different duration formats
        duration_str = str(duration_str).strip()
        
        # Format: MM:SS or HH:MM:SS
        if ':' in duration_str:
            parts = duration_str.split(':')
            try:
                if len(parts) == 2:  # MM:SS
                    minutes, seconds = map(int, parts)
                    return minutes * 60 + seconds
                elif len(parts) == 3:  # HH:MM:SS
                    hours, minutes, seconds = map(int, parts)
                    return hours * 3600 + minutes * 60 + seconds
            except ValueError:
                pass
        
        # Format: seconds only
        try:
            return int(float(duration_str))
        except ValueError:
            logger.warning(f"Could not parse duration: {duration_str}")
            return None
    
    def _parse_bpm(self, bpm_value: Union[int, str]) -> Optional[int]:
        """Parse BPM value"""
        if bpm_value is None:
            return None
        
        try:
            bpm = int(float(str(bpm_value)))
            # Validate reasonable BPM range
            if 50 <= bpm <= 200:
                return bpm
            else:
                logger.warning(f"BPM {bpm} outside reasonable range (50-200)")
                return None
        except (ValueError, TypeError):
            logger.warning(f"Could not parse BPM: {bpm_value}")
            return None
    
    def _normalize_key(self, key_str: str) -> Optional[str]:
        """Normalize musical key notation"""
        if not key_str:
            return None
        
        # Standard key mapping
        key_mapping = {
            'c': 'C', 'c#': 'C#', 'db': 'Db', 'd': 'D', 'd#': 'D#', 'eb': 'Eb',
            'e': 'E', 'f': 'F', 'f#': 'F#', 'gb': 'Gb', 'g': 'G', 'g#': 'G#',
            'ab': 'Ab', 'a': 'A', 'a#': 'A#', 'bb': 'Bb', 'b': 'B'
        }
        
        key_clean = key_str.strip().lower()
        
        # Handle major/minor notation
        if key_clean.endswith('m') or key_clean.endswith('min'):
            key_note = key_clean.replace('m', '').replace('in', '').strip()
            if key_note in key_mapping:
                return f"{key_mapping[key_note]}m"
        else:
            key_note = key_clean.replace('maj', '').strip()
            if key_note in key_mapping:
                return key_mapping[key_note]
        
        return key_str  # Return original if can't normalize
    
    def _generate_track_id(self, track_data: TrackData) -> str:
        """Generate unique track ID"""
        source_prefix = track_data.source.value[:3].upper()
        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        source_hash = hashlib.md5(track_data.source_id.encode()).hexdigest()[:8]
        return f"{source_prefix}_{timestamp}_{source_hash}"
    
    def _generate_fingerprint(self, title: str, artist: str, album: Optional[str] = None) -> str:
        """Generate fingerprint for deduplication"""
        fingerprint_data = f"{title.lower()}|{artist.lower()}"
        if album:
            fingerprint_data += f"|{album.lower()}"
        return hashlib.sha256(fingerprint_data.encode()).hexdigest()[:16]
    
    def _calculate_confidence(self, track_data: TrackData) -> float:
        """Calculate confidence score based on data completeness"""
        score = 0.0
        
        # Required fields
        if track_data.title:
            score += 0.3
        if track_data.artist:
            score += 0.3
        
        # Optional but valuable fields
        if track_data.album:
            score += 0.1
        if track_data.genre:
            score += 0.1
        if track_data.release_date:
            score += 0.1
        if track_data.duration:
            score += 0.05
        if track_data.bpm:
            score += 0.05
        
        return min(score, 1.0)

class DataEnricher:
    """Enriches normalized track data with additional metadata"""
    
    def __init__(self):
        self.external_apis = {
            "musicbrainz": "https://musicbrainz.org/ws/2/",
            "lastfm": "https://ws.audioscrobbler.com/2.0/",
            "spotify": "https://api.spotify.com/v1/"
        }
    
    async def enrich_track(self, track: NormalizedTrack) -> NormalizedTrack:
        """Enrich track with external data"""
        try:
            # Add genre classification
            if not track.genre:
                track.genre = await self._classify_genre(track)
            
            # Add missing metadata
            if not track.bpm:
                track.bpm = await self._estimate_bpm(track)
            
            # Update confidence score
            track.confidence_score = min(track.confidence_score + 0.1, 1.0)
            
            return track
            
        except Exception as e:
            logger.error(f"Error enriching track {track.id}: {str(e)}")
            return track
    
    async def _classify_genre(self, track: NormalizedTrack) -> Optional[str]:
        """Classify genre based on track metadata"""
        # Simple genre classification based on patterns
        title_lower = track.title.lower()
        artist_lower = track.artist.lower()
        
        # Electronic music patterns
        if any(pattern in title_lower for pattern in ['remix', 'mix', 'edit', 'bootleg']):
            if track.bpm and track.bpm > 120:
                return "Electronic"
        
        # Classical patterns
        if any(pattern in title_lower for pattern in ['symphony', 'concerto', 'sonata', 'prelude']):
            return "Classical"
        
        return None
    
    async def _estimate_bpm(self, track: NormalizedTrack) -> Optional[int]:
        """Estimate BPM based on genre and metadata"""
        if not track.genre:
            return None
        
        # Genre-based BPM ranges
        bpm_ranges = {
            "House": (120, 130),
            "Tech House": (125, 132),
            "Techno": (130, 140),
            "Trance": (128, 138),
            "Dubstep": (140, 150),
            "Drum & Bass": (160, 180),
            "Hip-Hop": (80, 100),
            "Pop": (100, 120)
        }
        
        if track.genre in bpm_ranges:
            min_bpm, max_bpm = bpm_ranges[track.genre]
            # Return middle of range as estimate
            return (min_bpm + max_bpm) // 2
        
        return None

# =====================
# Transformation Engine
# =====================

class TransformationEngine:
    """Main transformation processing engine"""
    
    def __init__(self):
        self.normalizer = DataNormalizer()
        self.enricher = DataEnricher()
        self.batch_size = int(os.getenv("BATCH_SIZE", 100))
    
    async def process_task(self, task: TransformationTask) -> TransformationResult:
        """Process a transformation task"""
        start_time = datetime.now()
        task.status = ProcessingStatus.PROCESSING
        task.started_at = start_time
        
        # Store task status in Redis
        await self._update_task_status(task)
        
        try:
            # Convert source_data to list if single item
            if isinstance(task.source_data, TrackData):
                input_data = [task.source_data]
            else:
                input_data = task.source_data
            
            # Process based on operation type
            if task.operation == TransformationOperation.NORMALIZE:
                results = await self._normalize_tracks(input_data)
            elif task.operation == TransformationOperation.CLEAN:
                results = await self._clean_tracks(input_data)
            elif task.operation == TransformationOperation.ENRICH:
                results = await self._enrich_tracks(input_data)
            elif task.operation == TransformationOperation.DEDUPLICATE:
                results = await self._deduplicate_tracks(input_data)
            else:
                raise ValueError(f"Unsupported operation: {task.operation}")
            
            # Update task status
            task.status = ProcessingStatus.COMPLETED
            task.completed_at = datetime.now()
            
            # Calculate metrics
            processing_time = (task.completed_at - start_time).total_seconds()
            
            result = TransformationResult(
                task_id=task.id,
                operation=task.operation,
                status=task.status,
                input_count=len(input_data),
                output_count=len(results),
                skipped_count=0,
                error_count=0,
                processing_time=processing_time,
                results=results
            )
            
            # Update metrics
            transformation_tasks_total.labels(
                operation=task.operation.value,
                status="success"
            ).inc()
            transformation_duration.labels(operation=task.operation.value).observe(processing_time)
            
            # Store result in database
            await self._store_results(result)
            
            return result
            
        except Exception as e:
            task.status = ProcessingStatus.FAILED
            task.error_message = str(e)
            task.completed_at = datetime.now()
            
            logger.error(f"Task {task.id} failed: {str(e)}")
            
            transformation_tasks_total.labels(
                operation=task.operation.value,
                status="failed"
            ).inc()
            
            result = TransformationResult(
                task_id=task.id,
                operation=task.operation,
                status=task.status,
                input_count=len(input_data) if 'input_data' in locals() else 0,
                output_count=0,
                skipped_count=0,
                error_count=1,
                processing_time=(task.completed_at - start_time).total_seconds(),
                errors=[str(e)]
            )
            
            return result
        
        finally:
            await self._update_task_status(task)
    
    async def _normalize_tracks(self, tracks: List[TrackData]) -> List[NormalizedTrack]:
        """Normalize track data"""
        results = []
        for track in tracks:
            try:
                normalized = await self.normalizer.normalize_track(track)
                results.append(normalized)
                processed_records.labels(source=track.source.value, status="success").inc()
            except Exception as e:
                logger.error(f"Failed to normalize track {track.source_id}: {str(e)}")
                processed_records.labels(source=track.source.value, status="failed").inc()
        
        return results
    
    async def _clean_tracks(self, tracks: List[TrackData]) -> List[NormalizedTrack]:
        """Clean and normalize tracks (same as normalize for now)"""
        return await self._normalize_tracks(tracks)
    
    async def _enrich_tracks(self, tracks: List[TrackData]) -> List[NormalizedTrack]:
        """Enrich tracks with additional metadata"""
        # First normalize
        normalized_tracks = await self._normalize_tracks(tracks)
        
        # Then enrich
        enriched_tracks = []
        for track in normalized_tracks:
            try:
                enriched = await self.enricher.enrich_track(track)
                enriched_tracks.append(enriched)
            except Exception as e:
                logger.error(f"Failed to enrich track {track.id}: {str(e)}")
                enriched_tracks.append(track)  # Keep original if enrichment fails
        
        return enriched_tracks
    
    async def _deduplicate_tracks(self, tracks: List[TrackData]) -> List[NormalizedTrack]:
        """Remove duplicate tracks"""
        normalized_tracks = await self._normalize_tracks(tracks)
        
        # Group by fingerprint
        fingerprint_groups = {}
        for track in normalized_tracks:
            fingerprint = track.fingerprint
            if fingerprint not in fingerprint_groups:
                fingerprint_groups[fingerprint] = []
            fingerprint_groups[fingerprint].append(track)
        
        # Keep highest confidence track from each group
        deduplicated = []
        for tracks_group in fingerprint_groups.values():
            if len(tracks_group) == 1:
                deduplicated.append(tracks_group[0])
            else:
                # Keep track with highest confidence
                best_track = max(tracks_group, key=lambda t: t.confidence_score)
                deduplicated.append(best_track)
                logger.info(f"Deduplicated {len(tracks_group)} tracks to 1")
        
        return deduplicated
    
    async def _update_task_status(self, task: TransformationTask):
        """Update task status in Redis"""
        task_key = f"transformation:task:{task.id}"
        redis_client.hset(task_key, mapping=task.dict())
        redis_client.expire(task_key, 86400)  # Expire after 24 hours
    
    async def _store_results(self, result: TransformationResult):
        """Store transformation results in database with optimized batch operations"""
        if not db_pool:
            return
        
        # Performance measurement
        store_start_time = datetime.now()
        
        try:
            # Monitor connection pool usage
            if hasattr(db_pool, '_holders'):
                pool_usage = len(db_pool._holders) / db_pool._maxsize if db_pool._maxsize > 0 else 0
                connection_pool_usage.set(pool_usage)
            
            async with db_pool.acquire() as conn:
                # Use a transaction for atomic batch operations
                async with conn.transaction():
                    # Store transformation result record
                    db_start = datetime.now()
                    await conn.execute("""
                        INSERT INTO transformation_results 
                        (task_id, operation, status, input_count, output_count, processing_time, created_at)
                        VALUES ($1, $2, $3, $4, $5, $6, $7)
                    """, result.task_id, result.operation.value, result.status.value,
                        result.input_count, result.output_count, result.processing_time,
                        datetime.now())
                    
                    db_duration = (datetime.now() - db_start).total_seconds()
                    database_operation_duration.labels(operation_type="insert_result").observe(db_duration)
                    
                    # OPTIMIZED: Batch INSERT for normalized tracks
                    if result.results:
                        batch_start = datetime.now()
                        batch_size = len(result.results)
                        
                        # Record batch size metrics
                        batch_size_histogram.labels(operation_type="track_insert").observe(batch_size)
                        
                        # Prepare batch data for all tracks
                        batch_data = []
                        for track in result.results:
                            batch_data.append((
                                track.id, track.source.value, track.source_id, track.title,
                                track.artist, track.album, track.genre, track.label,
                                track.release_date, track.duration_seconds, track.bpm,
                                track.key, track.url, track.fingerprint, track.confidence_score,
                                json.dumps(track.metadata), track.normalized_at
                            ))
                        
                        # Single batch operation instead of N individual INSERTs
                        await conn.executemany("""
                            INSERT INTO normalized_tracks 
                            (id, source, source_id, title, artist, album, genre, label,
                             release_date, duration_seconds, bpm, key, url, fingerprint,
                             confidence_score, metadata, normalized_at)
                            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
                            ON CONFLICT (id) DO UPDATE SET
                            confidence_score = EXCLUDED.confidence_score,
                            metadata = EXCLUDED.metadata,
                            normalized_at = EXCLUDED.normalized_at
                        """, batch_data)
                        
                        # Record batch operation metrics
                        batch_duration = (datetime.now() - batch_start).total_seconds()
                        batch_operation_duration.labels(operation_type="track_batch_insert").observe(batch_duration)
                        database_operation_duration.labels(operation_type="batch_insert").observe(batch_duration)
                        
                        # Log performance improvement with detailed metrics
                        store_duration = (datetime.now() - store_start_time).total_seconds()
                        avg_per_track = (store_duration / batch_size * 1000) if batch_size > 0 else 0
                        throughput = batch_size / store_duration if store_duration > 0 else 0
                        
                        logger.info(f"PERFORMANCE: Batch stored {batch_size} tracks in {store_duration:.3f}s "
                                  f"(avg {avg_per_track:.1f}ms per track, {throughput:.1f} tracks/sec)")
                        
                        # Performance threshold monitoring
                        if store_duration > 1.0:
                            logger.warning(f"SLOW_BATCH: Batch operation took {store_duration:.3f}s for {batch_size} tracks")
                        elif store_duration < 0.1:
                            logger.info(f"FAST_BATCH: High performance batch completed in {store_duration:.3f}s")
                
        except Exception as e:
            store_duration = (datetime.now() - store_start_time).total_seconds()
            logger.error(f"Failed to store results after {store_duration:.3f}s: {str(e)}")

# Initialize transformation engine
transformation_engine = TransformationEngine()

# =====================
# Database Initialization
# =====================

async def init_database():
    """Initialize database connection pool with optimized configuration for batch operations"""
    global db_pool
    try:
        # Optimized pool configuration for batch operations
        pool_config = {
            **DATABASE_CONFIG,
            "min_size": 10,          # Increased minimum connections for consistent performance
            "max_size": 50,          # Increased maximum for high throughput
            "command_timeout": 60,   # Increased timeout for batch operations
            "server_settings": {
                "jit": "off"         # Disable JIT for consistent performance
            }
        }
        
        db_pool = await asyncpg.create_pool(**pool_config)
        logger.info("Optimized database connection pool initialized with batch operation support")
        logger.info(f"Pool configuration: min_size=10, max_size=50, command_timeout=60s")
        
        # Create tables if they don't exist
        async with db_pool.acquire() as conn:
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS normalized_tracks (
                    id VARCHAR(255) PRIMARY KEY,
                    source VARCHAR(50) NOT NULL,
                    source_id VARCHAR(255) NOT NULL,
                    title TEXT NOT NULL,
                    artist TEXT NOT NULL,
                    album TEXT,
                    genre VARCHAR(100),
                    label VARCHAR(255),
                    release_date TIMESTAMP,
                    duration_seconds INTEGER,
                    bpm INTEGER,
                    key VARCHAR(10),
                    url TEXT,
                    fingerprint VARCHAR(32) NOT NULL,
                    confidence_score FLOAT NOT NULL,
                    metadata JSONB,
                    normalized_at TIMESTAMP NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(source, source_id)
                );
                
                CREATE INDEX IF NOT EXISTS idx_normalized_tracks_fingerprint ON normalized_tracks(fingerprint);
                CREATE INDEX IF NOT EXISTS idx_normalized_tracks_source ON normalized_tracks(source);
                CREATE INDEX IF NOT EXISTS idx_normalized_tracks_artist ON normalized_tracks(artist);
                CREATE INDEX IF NOT EXISTS idx_normalized_tracks_genre ON normalized_tracks(genre);
                
                CREATE TABLE IF NOT EXISTS transformation_results (
                    id SERIAL PRIMARY KEY,
                    task_id VARCHAR(255) NOT NULL,
                    operation VARCHAR(50) NOT NULL,
                    status VARCHAR(20) NOT NULL,
                    input_count INTEGER NOT NULL,
                    output_count INTEGER NOT NULL,
                    processing_time FLOAT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            """)
            
    except Exception as e:
        logger.error(f"Failed to initialize database: {str(e)}")

# =====================
# Background Workers
# =====================

async def task_processor():
    """Background worker to process transformation tasks from Redis queue"""
    while True:
        try:
            # Get next task from Redis queue
            task_data = redis_client.blpop("transformation:queue", timeout=5)
            
            if task_data:
                task_json = task_data[1]
                task_dict = json.loads(task_json)
                task = TransformationTask(**task_dict)
                
                # Process task
                active_transformations.labels(operation=task.operation.value).inc()
                try:
                    result = await transformation_engine.process_task(task)
                    logger.info(f"Completed task {task.id}: {result.output_count} tracks processed")
                finally:
                    active_transformations.labels(operation=task.operation.value).dec()
            
            await asyncio.sleep(0.1)
            
        except Exception as e:
            logger.error(f"Error in task processor: {str(e)}")
            await asyncio.sleep(5)

# =====================
# API Endpoints
# =====================

@app.on_event("startup")
async def startup_event():
    """Initialize services on startup"""
    await init_database()
    
    # Start background workers
    asyncio.create_task(task_processor())
    
    logger.info("Data Transformer Service started")

@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown"""
    if db_pool:
        await db_pool.close()
    logger.info("Data Transformer Service stopped")

@app.get("/health")
async def health_check():
    """Enhanced health check endpoint with performance metrics"""
    # Check database connection
    db_status = "healthy"
    db_response_time = None
    pool_stats = {}
    
    if db_pool:
        try:
            db_start = datetime.now()
            async with db_pool.acquire() as conn:
                await conn.fetchval("SELECT 1")
            db_response_time = (datetime.now() - db_start).total_seconds() * 1000  # ms
            
            # Get connection pool statistics
            if hasattr(db_pool, '_holders') and hasattr(db_pool, '_maxsize'):
                pool_stats = {
                    "active_connections": len(db_pool._holders),
                    "max_connections": db_pool._maxsize,
                    "utilization_percent": round((len(db_pool._holders) / db_pool._maxsize) * 100, 1) if db_pool._maxsize > 0 else 0
                }
                
        except Exception as e:
            db_status = "unhealthy"
            logger.error(f"Database health check failed: {str(e)}")
    else:
        db_status = "not_initialized"
    
    # Check Redis connection
    redis_status = "healthy"
    redis_response_time = None
    try:
        redis_start = datetime.now()
        redis_client.ping()
        redis_response_time = (datetime.now() - redis_start).total_seconds() * 1000  # ms
    except Exception as e:
        redis_status = "unhealthy"
        logger.error(f"Redis health check failed: {str(e)}")
    
    # Performance status assessment
    performance_status = "optimal"
    performance_issues = []
    
    if db_response_time and db_response_time > 100:  # > 100ms is concerning
        performance_status = "degraded"
        performance_issues.append(f"Database response time: {db_response_time:.1f}ms")
    
    if pool_stats.get("utilization_percent", 0) > 80:
        performance_status = "degraded"
        performance_issues.append(f"High connection pool utilization: {pool_stats['utilization_percent']}%")
    
    overall_status = "healthy" if db_status == "healthy" and redis_status == "healthy" else "unhealthy"
    
    return {
        "status": overall_status,
        "performance_status": performance_status,
        "timestamp": datetime.now().isoformat(),
        "components": {
            "database": {
                "status": db_status,
                "response_time_ms": db_response_time,
                "connection_pool": pool_stats
            },
            "redis": {
                "status": redis_status,
                "response_time_ms": redis_response_time
            }
        },
        "performance_issues": performance_issues if performance_issues else None,
        "optimization_info": {
            "batch_operations": "enabled",
            "connection_pooling": "optimized",
            "performance_monitoring": "active"
        }
    }

@app.post("/transform")
async def submit_transformation_task(task: TransformationTask):
    """Submit a transformation task"""
    # Generate task ID if not provided
    if not task.id:
        task.id = f"transform_{datetime.now().timestamp()}"
    
    task.created_at = datetime.now()
    
    # Add to Redis queue
    task_json = json.dumps(task.dict(), default=str)
    redis_client.rpush("transformation:queue", task_json)
    
    # Store task metadata
    task_key = f"transformation:task:{task.id}"
    redis_client.hset(task_key, mapping=task.dict())
    redis_client.expire(task_key, 86400)
    
    return {"task_id": task.id, "status": "queued"}

@app.get("/tasks/{task_id}")
async def get_task_status(task_id: str):
    """Get status of a transformation task"""
    task_key = f"transformation:task:{task_id}"
    task_data = redis_client.hgetall(task_key)
    
    if not task_data:
        raise HTTPException(status_code=404, detail="Task not found")
    
    return task_data

@app.get("/tasks")
async def get_tasks(status: Optional[ProcessingStatus] = None, limit: int = 100):
    """Get list of transformation tasks"""
    task_keys = redis_client.keys("transformation:task:*")
    tasks = []
    
    for key in task_keys[:limit]:
        task_data = redis_client.hgetall(key)
        if task_data:
            if status and task_data.get("status") != status.value:
                continue
            tasks.append(task_data)
    
    return {"tasks": tasks, "count": len(tasks)}

@app.get("/stats")
async def get_transformation_stats():
    """Get transformation statistics"""
    if not db_pool:
        return {"error": "Database not available"}
    
    try:
        async with db_pool.acquire() as conn:
            # Get counts by source
            source_counts = await conn.fetch("""
                SELECT source, COUNT(*) as count
                FROM normalized_tracks
                GROUP BY source
            """)
            
            # Get recent transformations
            recent_transformations = await conn.fetch("""
                SELECT operation, status, COUNT(*) as count
                FROM transformation_results
                WHERE created_at > NOW() - INTERVAL '24 hours'
                GROUP BY operation, status
            """)
            
            # Get quality metrics
            quality_stats = await conn.fetchrow("""
                SELECT 
                    AVG(confidence_score) as avg_confidence,
                    COUNT(CASE WHEN confidence_score > 0.8 THEN 1 END) as high_confidence_count,
                    COUNT(*) as total_tracks
                FROM normalized_tracks
            """)
            
            return {
                "source_distribution": [dict(row) for row in source_counts],
                "recent_transformations": [dict(row) for row in recent_transformations],
                "quality_metrics": dict(quality_stats) if quality_stats else {}
            }
            
    except Exception as e:
        logger.error(f"Error getting stats: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to get statistics")

@app.get("/metrics")
async def get_metrics():
    """Prometheus metrics endpoint"""
    return PlainTextResponse(generate_latest())

@app.post("/normalize")
async def normalize_tracks(tracks: List[TrackData]):
    """Directly normalize tracks (synchronous)"""
    try:
        results = []
        for track_data in tracks:
            normalized = await transformation_engine.normalizer.normalize_track(track_data)
            results.append(normalized)
        
        return {
            "status": "success",
            "input_count": len(tracks),
            "output_count": len(results),
            "results": results
        }
        
    except Exception as e:
        logger.error(f"Error in direct normalization: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/fingerprints/duplicates")
async def find_duplicates():
    """Find potential duplicate tracks by fingerprint"""
    if not db_pool:
        raise HTTPException(status_code=503, detail="Database not available")
    
    try:
        async with db_pool.acquire() as conn:
            duplicates = await conn.fetch("""
                SELECT fingerprint, COUNT(*) as count, 
                       array_agg(id) as track_ids,
                       array_agg(title || ' - ' || artist) as track_info
                FROM normalized_tracks
                GROUP BY fingerprint
                HAVING COUNT(*) > 1
                ORDER BY count DESC
            """)
            
            return {
                "duplicate_groups": [dict(row) for row in duplicates],
                "total_groups": len(duplicates)
            }
            
    except Exception as e:
        logger.error(f"Error finding duplicates: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to find duplicates")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8002)