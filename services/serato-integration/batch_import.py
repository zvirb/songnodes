#!/usr/bin/env python3
"""
Serato Batch Import Script
Scans music library and extracts Serato metadata from audio file tags

Usage:
    python batch_import.py --music-dir /path/to/music --limit 100
    python batch_import.py --music-dir /path/to/music --dry-run
    python batch_import.py --serato-dir ~/Music/_Serato_

Features:
- Scans directory recursively for audio files with Serato tags
- Extracts BPM, key, beatgrid, cue points, loops from Serato GEOB tags
- Updates database with Serato metadata
- Matches files to existing tracks by artist/title or creates new tracks
- Provides progress tracking and error reporting
- Supports dry-run mode for testing
"""

import asyncio
import argparse
import sys
from pathlib import Path
from typing import Optional, List, Dict, Any
from datetime import datetime
import structlog
from tqdm import tqdm

import asyncpg
from serato_parser import SeratoFileParser, SeratoTrackMetadata

# Configure logging
structlog.configure(
    processors=[
        structlog.stdlib.filter_by_level,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.processors.JSONRenderer()
    ],
    context_class=dict,
    logger_factory=structlog.stdlib.LoggerFactory(),
    cache_logger_on_first_use=True,
)

logger = structlog.get_logger(__name__)

# Supported audio file extensions
AUDIO_EXTENSIONS = {'.mp3', '.flac', '.aac', '.m4a', '.wav', '.aiff', '.ogg', '.wma'}


class SeratoBatchImporter:
    """Batch importer for Serato metadata from audio files"""

    def __init__(self, db_pool: asyncpg.Pool, dry_run: bool = False):
        self.db_pool = db_pool
        self.dry_run = dry_run
        self.parser = SeratoFileParser()
        self.stats = {
            'files_scanned': 0,
            'files_with_serato': 0,
            'tracks_updated': 0,
            'tracks_created': 0,
            'errors': 0,
            'skipped': 0
        }

    async def scan_directory(self, music_dir: Path, limit: Optional[int] = None) -> List[Path]:
        """
        Recursively scan directory for audio files with Serato data

        Args:
            music_dir: Root directory to scan
            limit: Maximum number of files to process (None = unlimited)

        Returns:
            List of audio file paths that have Serato metadata
        """
        logger.info(f"Scanning directory for audio files", path=str(music_dir))

        audio_files = []
        for ext in AUDIO_EXTENSIONS:
            audio_files.extend(music_dir.rglob(f"*{ext}"))

        logger.info(f"Found {len(audio_files)} audio files", total=len(audio_files))

        # Quick scan to find files with Serato data
        serato_files = []
        for file_path in tqdm(audio_files, desc="Scanning for Serato data", unit="files"):
            if limit and len(serato_files) >= limit:
                break

            self.stats['files_scanned'] += 1

            try:
                metadata = self.parser.extract_metadata(file_path)
                if metadata and metadata.has_serato_data:
                    serato_files.append(file_path)
                    self.stats['files_with_serato'] += 1
            except Exception as e:
                logger.warning(f"Failed to scan file", file=str(file_path), error=str(e))
                self.stats['errors'] += 1

        logger.info(
            f"Found {len(serato_files)} files with Serato metadata",
            total=len(serato_files),
            coverage_pct=round((len(serato_files) / len(audio_files) * 100), 2) if audio_files else 0
        )

        return serato_files

    async def find_matching_track(self, metadata: SeratoTrackMetadata) -> Optional[str]:
        """
        Find matching track in database by artist/title

        Args:
            metadata: Serato track metadata

        Returns:
            track_id if found, None otherwise
        """
        if not metadata.artist_name or not metadata.track_name:
            return None

        async with self.db_pool.acquire() as conn:
            # Try exact match first
            result = await conn.fetchrow(
                """
                SELECT track_id
                FROM tracks
                WHERE LOWER(artist_name) = LOWER($1)
                AND LOWER(track_name) = LOWER($2)
                LIMIT 1
                """,
                metadata.artist_name,
                metadata.track_name
            )

            if result:
                return str(result['track_id'])

            # Try fuzzy match using similarity (requires pg_trgm extension)
            result = await conn.fetchrow(
                """
                SELECT track_id
                FROM tracks
                WHERE similarity(artist_name, $1) > 0.8
                AND similarity(track_name, $2) > 0.8
                ORDER BY
                    similarity(artist_name, $1) + similarity(track_name, $2) DESC
                LIMIT 1
                """,
                metadata.artist_name,
                metadata.track_name
            )

            return str(result['track_id']) if result else None

    async def update_track_metadata(self, track_id: str, metadata: SeratoTrackMetadata) -> bool:
        """
        Update track with Serato metadata

        Args:
            track_id: Track UUID
            metadata: Serato track metadata

        Returns:
            True if successful, False otherwise
        """
        if self.dry_run:
            logger.info(
                "DRY RUN: Would update track",
                track_id=track_id,
                artist=metadata.artist_name,
                title=metadata.track_name,
                bpm=metadata.bpm,
                key=metadata.key_text
            )
            return True

        try:
            async with self.db_pool.acquire() as conn:
                await conn.execute(
                    """
                    UPDATE tracks
                    SET
                        serato_bpm = $2,
                        serato_key = $3,
                        serato_key_text = $4,
                        serato_auto_gain = $5,
                        serato_beatgrid = $6,
                        serato_cues = $7,
                        serato_loops = $8,
                        serato_analyzed_at = $9,
                        file_path = $10,
                        duration_ms = COALESCE(duration_ms, $11)
                    WHERE track_id = $1
                    """,
                    track_id,
                    metadata.bpm,
                    metadata.key,
                    metadata.key_text,
                    metadata.auto_gain,
                    metadata.beatgrid,
                    metadata.cue_points,
                    metadata.loops,
                    metadata.analyzed_at,
                    metadata.file_path,
                    metadata.duration_ms
                )

            logger.info(
                "Updated track with Serato metadata",
                track_id=track_id,
                bpm=metadata.bpm,
                key=metadata.key_text
            )
            self.stats['tracks_updated'] += 1
            return True

        except Exception as e:
            logger.error(f"Failed to update track", track_id=track_id, error=str(e))
            self.stats['errors'] += 1
            return False

    async def create_track_from_metadata(self, metadata: SeratoTrackMetadata) -> Optional[str]:
        """
        Create new track from Serato metadata

        Args:
            metadata: Serato track metadata

        Returns:
            track_id if created, None otherwise
        """
        if self.dry_run:
            logger.info(
                "DRY RUN: Would create track",
                artist=metadata.artist_name,
                title=metadata.track_name,
                bpm=metadata.bpm,
                key=metadata.key_text
            )
            return "dry-run-uuid"

        if not metadata.artist_name or not metadata.track_name:
            logger.warning("Cannot create track without artist/title", file=metadata.file_path)
            self.stats['skipped'] += 1
            return None

        try:
            async with self.db_pool.acquire() as conn:
                result = await conn.fetchrow(
                    """
                    INSERT INTO tracks (
                        artist_name,
                        track_name,
                        file_path,
                        duration_ms,
                        serato_bpm,
                        serato_key,
                        serato_key_text,
                        serato_auto_gain,
                        serato_beatgrid,
                        serato_cues,
                        serato_loops,
                        serato_analyzed_at,
                        created_at
                    ) VALUES (
                        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, CURRENT_TIMESTAMP
                    )
                    RETURNING track_id
                    """,
                    metadata.artist_name,
                    metadata.track_name,
                    metadata.file_path,
                    metadata.duration_ms,
                    metadata.bpm,
                    metadata.key,
                    metadata.key_text,
                    metadata.auto_gain,
                    metadata.beatgrid,
                    metadata.cue_points,
                    metadata.loops,
                    metadata.analyzed_at
                )

            track_id = str(result['track_id'])
            logger.info(
                "Created new track from Serato metadata",
                track_id=track_id,
                artist=metadata.artist_name,
                title=metadata.track_name
            )
            self.stats['tracks_created'] += 1
            return track_id

        except Exception as e:
            logger.error(
                f"Failed to create track",
                artist=metadata.artist_name,
                title=metadata.track_name,
                error=str(e)
            )
            self.stats['errors'] += 1
            return None

    async def process_file(self, file_path: Path) -> bool:
        """
        Process a single audio file: extract Serato metadata and update database

        Args:
            file_path: Path to audio file

        Returns:
            True if processed successfully, False otherwise
        """
        try:
            # Extract Serato metadata
            metadata = self.parser.extract_metadata(file_path)

            if not metadata or not metadata.has_serato_data:
                logger.debug(f"No Serato data in file", file=str(file_path))
                self.stats['skipped'] += 1
                return False

            # Try to find matching track
            track_id = await self.find_matching_track(metadata)

            if track_id:
                # Update existing track
                return await self.update_track_metadata(track_id, metadata)
            else:
                # Create new track
                track_id = await self.create_track_from_metadata(metadata)
                return track_id is not None

        except Exception as e:
            logger.error(f"Failed to process file", file=str(file_path), error=str(e))
            self.stats['errors'] += 1
            return False

    async def run(self, music_dir: Path, limit: Optional[int] = None) -> Dict[str, Any]:
        """
        Run batch import process

        Args:
            music_dir: Root directory to scan
            limit: Maximum number of files to process

        Returns:
            Statistics dictionary
        """
        start_time = datetime.now()
        logger.info(
            "Starting Serato batch import",
            music_dir=str(music_dir),
            limit=limit,
            dry_run=self.dry_run
        )

        # Scan for audio files with Serato data
        serato_files = await self.scan_directory(music_dir, limit)

        if not serato_files:
            logger.warning("No files with Serato metadata found")
            return self.stats

        # Process each file
        logger.info(f"Processing {len(serato_files)} files with Serato metadata")
        for file_path in tqdm(serato_files, desc="Importing Serato metadata", unit="files"):
            await self.process_file(file_path)

        # Calculate elapsed time
        elapsed = (datetime.now() - start_time).total_seconds()
        self.stats['elapsed_seconds'] = round(elapsed, 2)
        self.stats['files_per_second'] = round(self.stats['files_scanned'] / elapsed, 2)

        # Log final statistics
        logger.info(
            "Serato batch import completed",
            **self.stats
        )

        return self.stats


async def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(
        description="Serato Batch Import: Extract Serato metadata from audio files"
    )
    parser.add_argument(
        '--music-dir',
        type=Path,
        required=True,
        help='Root directory of music library to scan'
    )
    parser.add_argument(
        '--serato-dir',
        type=Path,
        help='Serato library directory (e.g., ~/Music/_Serato_/) - currently not used'
    )
    parser.add_argument(
        '--limit',
        type=int,
        help='Maximum number of files to process (for testing)'
    )
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Scan files but do not update database'
    )
    parser.add_argument(
        '--db-host',
        default='localhost',
        help='Database host (default: localhost)'
    )
    parser.add_argument(
        '--db-port',
        type=int,
        default=5433,
        help='Database port (default: 5433 for external access)'
    )
    parser.add_argument(
        '--db-name',
        default='musicdb',
        help='Database name (default: musicdb)'
    )
    parser.add_argument(
        '--db-user',
        default='musicdb_user',
        help='Database user (default: musicdb_user)'
    )
    parser.add_argument(
        '--db-password',
        default='musicdb_secure_pass_2024',
        help='Database password'
    )

    args = parser.parse_args()

    # Validate music directory
    if not args.music_dir.exists():
        logger.error(f"Music directory does not exist: {args.music_dir}")
        sys.exit(1)

    if not args.music_dir.is_dir():
        logger.error(f"Music directory is not a directory: {args.music_dir}")
        sys.exit(1)

    # Connect to database
    try:
        db_pool = await asyncpg.create_pool(
            host=args.db_host,
            port=args.db_port,
            database=args.db_name,
            user=args.db_user,
            password=args.db_password,
            min_size=2,
            max_size=10,
            command_timeout=60
        )
        logger.info("Connected to database")
    except Exception as e:
        logger.error(f"Failed to connect to database: {e}")
        sys.exit(1)

    try:
        # Create importer and run
        importer = SeratoBatchImporter(db_pool, dry_run=args.dry_run)
        stats = await importer.run(args.music_dir, limit=args.limit)

        # Print summary
        print("\n" + "=" * 80)
        print("SERATO BATCH IMPORT SUMMARY")
        print("=" * 80)
        print(f"Files scanned:        {stats['files_scanned']}")
        print(f"Files with Serato:    {stats['files_with_serato']}")
        print(f"Tracks updated:       {stats['tracks_updated']}")
        print(f"Tracks created:       {stats['tracks_created']}")
        print(f"Errors:               {stats['errors']}")
        print(f"Skipped:              {stats['skipped']}")
        print(f"Elapsed time:         {stats.get('elapsed_seconds', 0)} seconds")
        print(f"Processing rate:      {stats.get('files_per_second', 0)} files/sec")
        print("=" * 80)

        if args.dry_run:
            print("\n⚠️  DRY RUN MODE - No database changes were made")

    finally:
        await db_pool.close()


if __name__ == '__main__':
    asyncio.run(main())
