"""
Gold Layer Processor - Silver to Gold Transformation
Transforms enriched Silver layer data into analytics-ready Gold layer

Responsibilities:
- Denormalize Silver tracks for analytics
- Compute aggregated metrics (play counts, playlist appearances)
- Precompute harmonic mixing compatibility (Camelot wheel)
- Calculate data quality scores
- Optimize for business intelligence queries
"""

import asyncio
import logging
import os
import sys
from datetime import datetime
from decimal import Decimal
from typing import Dict, List, Optional

import asyncpg
from asyncpg import Pool

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from common.secrets_manager import get_database_config

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class GoldLayerProcessor:
    """Transforms Silver enriched tracks into Gold analytics layer"""

    # Camelot Wheel for harmonic mixing compatibility
    CAMELOT_COMPATIBILITY = {
        "1A": ["1A", "12A", "2A", "1B"],
        "2A": ["2A", "1A", "3A", "2B"],
        "3A": ["3A", "2A", "4A", "3B"],
        "4A": ["4A", "3A", "5A", "4B"],
        "5A": ["5A", "4A", "6A", "5B"],
        "6A": ["6A", "5A", "7A", "6B"],
        "7A": ["7A", "6A", "8A", "7B"],
        "8A": ["8A", "7A", "9A", "8B"],
        "9A": ["9A", "8A", "10A", "9B"],
        "10A": ["10A", "9A", "11A", "10B"],
        "11A": ["11A", "10A", "12A", "11B"],
        "12A": ["12A", "11A", "1A", "12B"],
        "1B": ["1B", "12B", "2B", "1A"],
        "2B": ["2B", "1B", "3B", "2A"],
        "3B": ["3B", "2B", "4B", "3A"],
        "4B": ["4B", "3B", "5B", "4A"],
        "5B": ["5B", "4B", "6B", "5A"],
        "6B": ["6B", "5B", "7B", "6A"],
        "7B": ["7B", "6B", "8B", "7A"],
        "8B": ["8B", "7B", "9B", "8A"],
        "9B": ["9B", "8B", "10B", "9A"],
        "10B": ["10B", "9B", "11B", "10A"],
        "11B": ["11B", "10B", "12B", "11A"],
        "12B": ["12B", "11B", "1B", "12A"],
    }

    def __init__(self, pool: Pool):
        self.pool = pool

    def _get_compatible_keys(self, key: Optional[str]) -> List[str]:
        """Get harmonically compatible keys using Camelot wheel"""
        if not key or key not in self.CAMELOT_COMPATIBILITY:
            return []
        return self.CAMELOT_COMPATIBILITY[key]

    def _get_key_family(self, key: Optional[str]) -> Optional[str]:
        """Classify key as Major (B) or Minor (A)"""
        if not key:
            return None
        return "Major" if key.endswith("B") else "Minor" if key.endswith("A") else None

    def _calculate_enrichment_completeness(
        self, track: Dict
    ) -> Decimal:
        """Calculate percentage of enrichable fields that are populated"""
        enrichable_fields = [
            "spotify_id",
            "isrc",
            "bpm",
            "key",
            "genre",
            "energy",
            "valence",
            "danceability",
        ]

        populated = sum(1 for field in enrichable_fields if track.get(field))
        return Decimal(populated) / Decimal(len(enrichable_fields))

    def _calculate_data_quality_score(self, track: Dict) -> Decimal:
        """
        Calculate data quality score based on:
        - Field completeness
        - Data validity (e.g., BPM in reasonable range)
        - Enrichment success
        """
        score = Decimal("0.0")

        # Base completeness (40%)
        required_fields = ["artist_name", "track_title"]
        if all(track.get(f) for f in required_fields):
            score += Decimal("0.4")

        # Enrichment quality (40%)
        enrichment_score = self._calculate_enrichment_completeness(track)
        score += enrichment_score * Decimal("0.4")

        # Data validity (20%)
        validity_score = Decimal("1.0")
        if track.get("bpm"):
            bpm = float(track["bpm"])
            if bpm < 40 or bpm > 200:
                validity_score -= Decimal("0.5")

        score += validity_score * Decimal("0.2")

        return min(score, Decimal("1.0"))

    async def process_silver_track(self, silver_track: Dict) -> Dict:
        """Transform a Silver track into Gold analytics format"""
        artist_name = silver_track["artist_name"]
        track_title = silver_track["track_title"]

        # Denormalize track data
        gold_track = {
            "silver_track_id": silver_track["id"],
            "artist_name": artist_name,
            "track_title": track_title,
            "full_track_name": f"{artist_name} - {track_title}",
            "spotify_id": silver_track.get("spotify_id"),
            "isrc": silver_track.get("isrc"),
            "bpm": silver_track.get("bpm"),
            "key": silver_track.get("key"),
            "genre_primary": (
                silver_track.get("genre").split(",")[0].strip()
                if silver_track.get("genre")
                else None
            ),
            "genres": (
                [g.strip() for g in silver_track["genre"].split(",")]
                if silver_track.get("genre")
                else None
            ),
            "energy": silver_track.get("energy"),
            "valence": silver_track.get("valence"),
            "danceability": silver_track.get("danceability"),
            "compatible_keys": self._get_compatible_keys(silver_track.get("key")),
            "key_family": self._get_key_family(silver_track.get("key")),
            "enrichment_completeness": self._calculate_enrichment_completeness(
                silver_track
            ),
            "data_quality_score": self._calculate_data_quality_score(silver_track),
            "first_seen_at": silver_track["created_at"],
        }

        # Aggregate playlist appearances and play counts
        # Query silver_playlist_tracks to count appearances
        appearance_query = """
            SELECT COUNT(DISTINCT playlist_id) as playlist_count
            FROM silver_playlist_tracks
            WHERE track_id = $1
        """
        result = await self.pool.fetchrow(
            appearance_query, silver_track["id"]
        )
        gold_track["playlist_appearances"] = result["playlist_count"] if result else 0
        gold_track["play_count"] = gold_track["playlist_appearances"]  # Simple proxy

        # Get last played timestamp
        last_played_query = """
            SELECT MAX(spt.created_at) as last_played
            FROM silver_playlist_tracks spt
            WHERE spt.track_id = $1
        """
        result = await self.pool.fetchrow(
            last_played_query, silver_track["id"]
        )
        gold_track["last_played_at"] = (
            result["last_played"] if result and result["last_played"] else None
        )

        gold_track["last_analyzed_at"] = datetime.utcnow()

        return gold_track

    async def upsert_gold_track(self, gold_track: Dict):
        """Upsert a Gold track (insert or update if exists)"""
        upsert_query = """
            INSERT INTO gold_track_analytics (
                silver_track_id, artist_name, track_title, full_track_name,
                spotify_id, isrc, bpm, key, genre_primary, genres,
                energy, valence, danceability, play_count, playlist_appearances,
                last_played_at, first_seen_at, compatible_keys, key_family,
                data_quality_score, enrichment_completeness, last_analyzed_at
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
                $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22
            )
            ON CONFLICT (silver_track_id)
            DO UPDATE SET
                artist_name = EXCLUDED.artist_name,
                track_title = EXCLUDED.track_title,
                full_track_name = EXCLUDED.full_track_name,
                spotify_id = EXCLUDED.spotify_id,
                isrc = EXCLUDED.isrc,
                bpm = EXCLUDED.bpm,
                key = EXCLUDED.key,
                genre_primary = EXCLUDED.genre_primary,
                genres = EXCLUDED.genres,
                energy = EXCLUDED.energy,
                valence = EXCLUDED.valence,
                danceability = EXCLUDED.danceability,
                play_count = EXCLUDED.play_count,
                playlist_appearances = EXCLUDED.playlist_appearances,
                last_played_at = EXCLUDED.last_played_at,
                compatible_keys = EXCLUDED.compatible_keys,
                key_family = EXCLUDED.key_family,
                data_quality_score = EXCLUDED.data_quality_score,
                enrichment_completeness = EXCLUDED.enrichment_completeness,
                last_analyzed_at = EXCLUDED.last_analyzed_at,
                updated_at = NOW()
        """

        # Add unique constraint on silver_track_id to Gold schema if not exists
        try:
            await self.pool.execute("""
                ALTER TABLE gold_track_analytics
                ADD CONSTRAINT gold_track_analytics_silver_track_id_unique
                UNIQUE (silver_track_id)
            """)
            logger.info("Added unique constraint on silver_track_id")
        except asyncpg.UniqueViolationError:
            pass  # Constraint already exists
        except Exception as e:
            logger.debug(f"Constraint may already exist: {e}")

        await self.pool.execute(
            upsert_query,
            gold_track["silver_track_id"],
            gold_track["artist_name"],
            gold_track["track_title"],
            gold_track["full_track_name"],
            gold_track["spotify_id"],
            gold_track["isrc"],
            gold_track["bpm"],
            gold_track["key"],
            gold_track["genre_primary"],
            gold_track["genres"],
            gold_track["energy"],
            gold_track["valence"],
            gold_track["danceability"],
            gold_track["play_count"],
            gold_track["playlist_appearances"],
            gold_track["last_played_at"],
            gold_track["first_seen_at"],
            gold_track["compatible_keys"],
            gold_track["key_family"],
            gold_track["data_quality_score"],
            gold_track["enrichment_completeness"],
            gold_track["last_analyzed_at"],
        )

    async def process_batch(self, batch_size: int = 100) -> int:
        """Process a batch of Silver tracks into Gold layer"""
        # Find Silver tracks not yet in Gold or needing update
        query = """
            SELECT s.* FROM silver_enriched_tracks s
            LEFT JOIN gold_track_analytics g ON s.id = g.silver_track_id
            WHERE g.id IS NULL OR s.updated_at > g.updated_at
            ORDER BY s.created_at DESC
            LIMIT $1
        """

        silver_tracks = await self.pool.fetch(query, batch_size)

        if not silver_tracks:
            logger.info("No Silver tracks to process")
            return 0

        logger.info(f"Processing {len(silver_tracks)} Silver tracks to Gold")

        for silver_track in silver_tracks:
            try:
                gold_track = await self.process_silver_track(dict(silver_track))
                await self.upsert_gold_track(gold_track)
                logger.debug(
                    f"Processed track: {gold_track['artist_name']} - {gold_track['track_title']}"
                )
            except Exception as e:
                logger.error(
                    f"Error processing track {silver_track['id']}: {e}",
                    exc_info=True,
                )
                continue

        logger.info(f"Successfully processed {len(silver_tracks)} tracks to Gold layer")
        return len(silver_tracks)


async def main():
    """Main processing loop"""
    db_config = get_database_config()
    processing_interval = int(os.getenv("PROCESSING_INTERVAL", "60"))  # seconds
    batch_size = int(os.getenv("BATCH_SIZE", "100"))

    logger.info("Starting Gold Layer Processor")
    logger.info(f"Processing interval: {processing_interval}s, Batch size: {batch_size}")

    # Create database pool
    pool = await asyncpg.create_pool(
        host=db_config["host"],
        port=db_config["port"],
        database=db_config["database"],
        user=db_config["user"],
        password=db_config["password"],
        min_size=2,
        max_size=10,
    )

    processor = GoldLayerProcessor(pool)

    try:
        while True:
            try:
                processed_count = await processor.process_batch(batch_size)
                logger.info(
                    f"Batch complete: {processed_count} tracks processed. "
                    f"Waiting {processing_interval}s..."
                )
            except Exception as e:
                logger.error(f"Error in processing loop: {e}", exc_info=True)

            await asyncio.sleep(processing_interval)

    except KeyboardInterrupt:
        logger.info("Shutting down Gold Layer Processor")
    finally:
        await pool.close()


if __name__ == "__main__":
    asyncio.run(main())
