#!/usr/bin/env python3
"""
Production-ready sample music data generator for SongNodes
Creates 100 music nodes (songs) and 500 weighted edges (relationships)
with realistic metadata for performance testing and visualization.
"""

import asyncio
import asyncpg
import logging
import os
import random
import sys
import uuid
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional, Tuple
import json
import argparse
from contextlib import asynccontextmanager

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler('/tmp/populate_sample_data.log')
    ]
)
logger = logging.getLogger(__name__)

# Database configuration
DEFAULT_DATABASE_CONFIG = {
    'host': 'localhost',
    'port': 5432,
    'database': 'songnodes',
    'user': 'songnodes_user'
}

# Target data configuration
TARGET_SONGS = 100
TARGET_RELATIONSHIPS = 500

# Realistic music data pools
ELECTRONIC_GENRES = [
    "Techno", "House", "Progressive House", "Deep House", "Tech House",
    "Trance", "Progressive Trance", "Drum & Bass", "Dubstep", "Ambient",
    "Breakbeat", "Hardstyle", "Minimal Techno", "Acid House", "Electro",
    "Future Bass", "Trap", "Synthwave", "Melodic Techno", "Psytrance"
]

MUSICAL_KEYS = [
    "C", "C#", "Db", "D", "D#", "Eb", "E", "F", "F#", "Gb", 
    "G", "G#", "Ab", "A", "A#", "Bb", "B"
]

KEY_MODES = ["maj", "min", "m", ""]

ARTIST_PREFIXES = [
    "DJ", "MC", "The", "Sound", "Deep", "Dark", "Digital", "Electric",
    "Neon", "Cyber", "Solar", "Lunar", "Cosmic", "Urban", "Future"
]

TRACK_WORDS = [
    # Emotions & Energy
    "euphoria", "bliss", "energy", "passion", "fire", "storm", "thunder",
    "lightning", "serenity", "chaos", "harmony", "tension", "release",
    
    # Time & Space
    "midnight", "dawn", "twilight", "infinity", "eternity", "moment",
    "journey", "voyage", "escape", "flight", "dimension", "universe",
    
    # Electronic/Digital
    "synthesis", "frequency", "wavelength", "amplitude", "resonance",
    "pulse", "beat", "rhythm", "bass", "melody", "harmony", "echo",
    
    # Nature & Elements
    "ocean", "mountain", "sky", "star", "moon", "sun", "wind", "rain",
    "crystal", "diamond", "gold", "silver", "phoenix", "aurora",
    
    # Urban/Club
    "underground", "city", "neon", "laser", "strobe", "dance", "floor",
    "club", "rave", "party", "festival", "stage", "lights", "sound"
]

# Musical similarity weights (used for creating realistic weighted edges)
GENRE_SIMILARITY = {
    "Techno": {"Tech House": 0.8, "Minimal Techno": 0.9, "Electro": 0.7},
    "House": {"Deep House": 0.9, "Tech House": 0.8, "Progressive House": 0.8},
    "Progressive House": {"Trance": 0.7, "House": 0.8, "Progressive Trance": 0.9},
    "Trance": {"Progressive Trance": 0.9, "Psytrance": 0.6, "Progressive House": 0.7},
    "Drum & Bass": {"Breakbeat": 0.7, "Dubstep": 0.6},
    "Dubstep": {"Future Bass": 0.8, "Trap": 0.7},
    "Ambient": {"Synthwave": 0.6}
}

class DatabaseConnectionError(Exception):
    """Raised when database connection fails"""
    pass

class DataGenerationError(Exception):
    """Raised when data generation fails"""
    pass

class SampleDataPopulator:
    """
    Production-ready sample data populator for SongNodes music database.
    Creates realistic music data with weighted relationships for testing.
    """
    
    def __init__(self, database_config: Dict[str, Any]):
        self.database_config = database_config
        self.connection_pool: Optional[asyncpg.Pool] = None
        self.song_ids: List[str] = []
        self.artist_ids: List[str] = []
        self.generated_stats = {
            'songs': 0,
            'artists': 0,
            'relationships': 0,
            'start_time': None,
            'end_time': None
        }
    
    @asynccontextmanager
    async def get_connection(self):
        """Context manager for database connections with proper error handling"""
        if not self.connection_pool:
            raise DatabaseConnectionError("Connection pool not initialized")
        
        connection = None
        try:
            connection = await self.connection_pool.acquire()
            yield connection
        except Exception as e:
            logger.error(f"Database operation failed: {e}")
            raise
        finally:
            if connection:
                await self.connection_pool.release(connection)
    
    async def initialize_connection_pool(self) -> None:
        """Initialize database connection pool with retry logic"""
        max_retries = 3
        retry_delay = 2
        
        for attempt in range(max_retries):
            try:
                # Get password from environment
                password = os.getenv('POSTGRES_PASSWORD')
                if not password:
                    logger.warning("POSTGRES_PASSWORD not set, using default")
                    password = 'musicdb_secure_pass'
                
                # Build connection string
                connection_string = (
                    f"postgresql://{self.database_config['user']}:{password}@"
                    f"{self.database_config['host']}:{self.database_config['port']}/"
                    f"{self.database_config['database']}"
                )
                
                self.connection_pool = await asyncpg.create_pool(
                    connection_string,
                    min_size=5,
                    max_size=20,
                    command_timeout=30,
                    server_settings={
                        'jit': 'off',  # Disable JIT for faster connection
                        'application_name': 'songnodes_sample_data_populator'
                    }
                )
                
                # Test connection
                async with self.get_connection() as conn:
                    await conn.fetchval("SELECT 1")
                
                logger.info("✓ Database connection pool initialized successfully")
                return
                
            except Exception as e:
                logger.warning(f"Connection attempt {attempt + 1} failed: {e}")
                if attempt < max_retries - 1:
                    await asyncio.sleep(retry_delay)
                    retry_delay *= 2
                else:
                    raise DatabaseConnectionError(f"Failed to connect after {max_retries} attempts: {e}")
    
    async def close_connection_pool(self) -> None:
        """Close database connection pool"""
        if self.connection_pool:
            await self.connection_pool.close()
            logger.info("✓ Database connection pool closed")
    
    def generate_track_title(self) -> str:
        """Generate realistic electronic music track title"""
        # 70% chance of single word + descriptor, 30% chance of complex title
        if random.random() < 0.7:
            word1 = random.choice(TRACK_WORDS)
            word2 = random.choice(TRACK_WORDS)
            # Ensure different words
            while word2 == word1:
                word2 = random.choice(TRACK_WORDS)
            
            # Sometimes add remix/version info
            if random.random() < 0.25:
                remix_types = ["Original Mix", "Extended Mix", "Radio Edit", "Club Mix", "VIP Mix"]
                return f"{word1.title()} {word2.title()} ({random.choice(remix_types)})"
            else:
                return f"{word1.title()} {word2.title()}"
        else:
            # More complex titles
            words = random.sample(TRACK_WORDS, 3)
            return " ".join(word.title() for word in words)
    
    def generate_artist_name(self) -> str:
        """Generate realistic artist/DJ name"""
        if random.random() < 0.4:
            # Use prefix
            prefix = random.choice(ARTIST_PREFIXES)
            word = random.choice(TRACK_WORDS)
            return f"{prefix} {word.title()}"
        else:
            # Use 1-2 words
            if random.random() < 0.6:
                return random.choice(TRACK_WORDS).title()
            else:
                word1 = random.choice(TRACK_WORDS)
                word2 = random.choice(TRACK_WORDS)
                return f"{word1.title()}{word2.title()}"
    
    def normalize_name(self, name: str) -> str:
        """Normalize name for database storage and searching"""
        return name.lower().strip().replace("  ", " ")
    
    def generate_musical_key(self) -> str:
        """Generate realistic musical key"""
        key = random.choice(MUSICAL_KEYS)
        mode = random.choice(KEY_MODES)
        return f"{key}{mode}"
    
    def calculate_bpm_similarity(self, bpm1: float, bpm2: float) -> float:
        """Calculate similarity based on BPM difference (for weighted edges)"""
        bpm_diff = abs(bpm1 - bpm2)
        if bpm_diff <= 2:
            return 0.9
        elif bpm_diff <= 5:
            return 0.7
        elif bpm_diff <= 10:
            return 0.5
        elif bpm_diff <= 20:
            return 0.3
        else:
            return 0.1
    
    def calculate_key_similarity(self, key1: str, key2: str) -> float:
        """Calculate similarity based on musical key compatibility"""
        # Simplified key compatibility (music theory would be more complex)
        if key1 == key2:
            return 1.0
        
        # Extract base notes (simplified)
        base1 = key1.replace('maj', '').replace('min', '').replace('m', '')
        base2 = key2.replace('maj', '').replace('min', '').replace('m', '')
        
        # Perfect fifth relationships have high compatibility
        fifth_relationships = {
            'C': 'G', 'G': 'D', 'D': 'A', 'A': 'E', 'E': 'B', 'B': 'F#',
            'F#': 'C#', 'C#': 'G#', 'G#': 'D#', 'D#': 'A#', 'A#': 'F', 'F': 'C'
        }
        
        if fifth_relationships.get(base1) == base2 or fifth_relationships.get(base2) == base1:
            return 0.8
        
        # Major/minor relationships
        if base1 == base2:
            return 0.6
        
        return 0.2
    
    async def clear_existing_data(self) -> None:
        """Clear existing sample data (optional, for clean slate)"""
        logger.info("Clearing existing sample data...")
        
        async with self.get_connection() as conn:
            # Clear in reverse dependency order
            await conn.execute("DELETE FROM musicdb.track_artists WHERE 1=1")
            await conn.execute("DELETE FROM musicdb.tracks WHERE metadata->>'sample_data' = 'true'")
            await conn.execute("DELETE FROM musicdb.artists WHERE metadata->>'sample_data' = 'true'")
        
        logger.info("✓ Existing sample data cleared")
    
    async def generate_artists(self) -> None:
        """Generate sample artists"""
        logger.info(f"Generating artists for {TARGET_SONGS} songs...")
        
        # Generate 40-60 unique artists (multiple songs per artist for realism)
        target_artists = random.randint(40, 60)
        generated_names = set()
        artists_data = []
        
        for i in range(target_artists):
            # Ensure unique artist names
            attempts = 0
            while attempts < 10:
                name = self.generate_artist_name()
                normalized = self.normalize_name(name)
                if normalized not in generated_names:
                    generated_names.add(normalized)
                    break
                attempts += 1
            else:
                # Fallback if we can't generate unique name
                name = f"Artist {i:03d}"
                normalized = self.normalize_name(name)
            
            artist_id = str(uuid.uuid4())
            self.artist_ids.append(artist_id)
            
            # Generate realistic metadata
            metadata = {
                'sample_data': True,
                'genre_preference': random.choice(ELECTRONIC_GENRES),
                'followers': random.randint(1000, 500000),
                'verified': random.random() < 0.3,
                'active_years': random.randint(2010, 2024),
                'country': random.choice(['USA', 'UK', 'Germany', 'Netherlands', 'France', 'Spain'])
            }
            
            artists_data.append({
                'id': artist_id,
                'name': name,
                'normalized_name': normalized,
                'aliases': [name.lower()] if random.random() < 0.2 else [],
                'spotify_id': f"spotify_artist_{i}" if random.random() < 0.7 else None,
                'apple_music_id': f"apple_artist_{i}" if random.random() < 0.5 else None,
                'metadata': json.dumps(metadata)
            })
        
        # Batch insert artists
        async with self.get_connection() as conn:
            await conn.executemany("""
                INSERT INTO musicdb.artists (id, name, normalized_name, aliases, spotify_id, apple_music_id, metadata)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
            """, [
                (a['id'], a['name'], a['normalized_name'], a['aliases'], 
                 a['spotify_id'], a['apple_music_id'], a['metadata'])
                for a in artists_data
            ])
        
        self.generated_stats['artists'] = len(artists_data)
        logger.info(f"✓ Generated {len(artists_data)} artists")
    
    async def generate_songs(self) -> None:
        """Generate sample songs (tracks)"""
        logger.info(f"Generating {TARGET_SONGS} songs...")
        
        songs_data = []
        used_titles = set()
        
        for i in range(TARGET_SONGS):
            # Generate unique title
            attempts = 0
            while attempts < 10:
                title = self.generate_track_title()
                if title not in used_titles:
                    used_titles.add(title)
                    break
                attempts += 1
            else:
                title = f"Track {i:03d}"
            
            song_id = str(uuid.uuid4())
            self.song_ids.append(song_id)
            
            # Generate realistic musical metadata
            bpm = round(random.uniform(110, 140), 2)  # Typical electronic music BPM
            genre = random.choice(ELECTRONIC_GENRES)
            key = self.generate_musical_key()
            
            # Generate audio features (inspired by Spotify's audio features)
            energy = round(random.uniform(0.3, 1.0), 3)
            danceability = round(random.uniform(0.4, 1.0), 3)
            valence = round(random.uniform(0.1, 0.9), 3)  # Emotional positivity
            
            # Release date (last 5 years, weighted toward recent)
            days_ago = int(random.expovariate(1/365))  # Exponential distribution favoring recent
            days_ago = min(days_ago, 1825)  # Cap at 5 years
            release_date = datetime.now().date() - timedelta(days=days_ago)
            
            metadata = {
                'sample_data': True,
                'popularity': random.randint(10, 100),
                'explicit': random.random() < 0.05,
                'tempo_confidence': round(random.uniform(0.8, 1.0), 3),
                'acousticness': round(random.uniform(0.0, 0.2), 3),  # Electronic music is typically not acoustic
                'instrumentalness': round(random.uniform(0.5, 1.0), 3),  # Often instrumental
                'liveness': round(random.uniform(0.0, 0.3), 3),
                'speechiness': round(random.uniform(0.0, 0.1), 3)
            }
            
            songs_data.append({
                'id': song_id,
                'title': title,
                'normalized_title': self.normalize_name(title),
                'isrc': f"TEST{i:08d}" if random.random() < 0.6 else None,
                'spotify_id': f"spotify_track_{i}" if random.random() < 0.8 else None,
                'duration_ms': random.randint(180000, 480000),  # 3-8 minutes
                'bpm': bpm,
                'key': key,
                'energy': energy,
                'danceability': danceability,
                'valence': valence,
                'release_date': release_date,
                'genre': genre,
                'subgenre': random.choice(['Progressive', 'Melodic', 'Dark', 'Uplifting', 'Commercial', 'Underground']),
                'is_remix': random.random() < 0.3,
                'is_mashup': random.random() < 0.05,
                'is_live': random.random() < 0.02,
                'is_cover': random.random() < 0.01,
                'metadata': json.dumps(metadata)
            })
        
        # Batch insert songs
        async with self.get_connection() as conn:
            await conn.executemany("""
                INSERT INTO musicdb.tracks (
                    id, title, normalized_title, isrc, spotify_id, duration_ms, bpm, key,
                    energy, danceability, valence, release_date, genre, subgenre,
                    is_remix, is_mashup, is_live, is_cover, metadata
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
            """, [
                (s['id'], s['title'], s['normalized_title'], s['isrc'], s['spotify_id'],
                 s['duration_ms'], s['bpm'], s['key'], s['energy'], s['danceability'],
                 s['valence'], s['release_date'], s['genre'], s['subgenre'],
                 s['is_remix'], s['is_mashup'], s['is_live'], s['is_cover'], s['metadata'])
                for s in songs_data
            ])
        
        self.generated_stats['songs'] = len(songs_data)
        logger.info(f"✓ Generated {TARGET_SONGS} songs")
    
    async def generate_weighted_relationships(self) -> None:
        """Generate weighted edges between songs and artists based on musical similarity"""
        logger.info(f"Generating {TARGET_RELATIONSHIPS} weighted relationships...")
        
        # Get song data for similarity calculations
        async with self.get_connection() as conn:
            songs = await conn.fetch("""
                SELECT id, bpm, key, genre, energy, danceability
                FROM musicdb.tracks
                WHERE metadata->>'sample_data' = 'true'
            """)
        
        # Convert to dict for easier access
        song_data = {str(song['id']): dict(song) for song in songs}
        
        relationships = []
        created_pairs = set()
        
        # First, create artist-track relationships (every song needs at least one artist)
        for song_id in self.song_ids:
            # Primary artist
            artist_id = random.choice(self.artist_ids)
            relationships.append({
                'id': str(uuid.uuid4()),
                'track_id': song_id,
                'artist_id': artist_id,
                'role': 'primary',
                'position': 0
            })
            created_pairs.add((song_id, artist_id))
            
            # Sometimes add featured artists or remixers
            if random.random() < 0.3:  # 30% chance of featured artist
                featured_artist = random.choice(self.artist_ids)
                if (song_id, featured_artist) not in created_pairs:
                    relationships.append({
                        'id': str(uuid.uuid4()),
                        'track_id': song_id,
                        'artist_id': featured_artist,
                        'role': 'featured',
                        'position': 1
                    })
                    created_pairs.add((song_id, featured_artist))
        
        # Now create additional weighted relationships between songs based on similarity
        attempts = 0
        max_attempts = TARGET_RELATIONSHIPS * 3
        
        while len(relationships) < TARGET_RELATIONSHIPS and attempts < max_attempts:
            attempts += 1
            
            # Select two random songs
            song1_id = random.choice(self.song_ids)
            song2_id = random.choice(self.song_ids)
            
            if song1_id == song2_id:
                continue
            
            # Check if relationship already exists (in either direction)
            pair1 = (song1_id, song2_id)
            pair2 = (song2_id, song1_id)
            
            if pair1 in created_pairs or pair2 in created_pairs:
                continue
            
            # Calculate similarity weight
            song1_data = song_data[song1_id]
            song2_data = song_data[song2_id]
            
            # BPM similarity
            bpm_similarity = self.calculate_bpm_similarity(song1_data['bpm'], song2_data['bpm'])
            
            # Key similarity
            key_similarity = self.calculate_key_similarity(song1_data['key'], song2_data['key'])
            
            # Genre similarity
            genre_similarity = GENRE_SIMILARITY.get(song1_data['genre'], {}).get(song2_data['genre'], 0.2)
            
            # Energy and danceability similarity
            energy_similarity = 1.0 - abs(song1_data['energy'] - song2_data['energy'])
            dance_similarity = 1.0 - abs(song1_data['danceability'] - song2_data['danceability'])
            
            # Combined weighted similarity
            total_similarity = (
                bpm_similarity * 0.3 +
                key_similarity * 0.25 +
                genre_similarity * 0.25 +
                energy_similarity * 0.1 +
                dance_similarity * 0.1
            )
            
            # Only create relationship if similarity is above threshold
            similarity_threshold = 0.4
            if total_similarity >= similarity_threshold:
                # Create a "similarity" relationship
                # We'll use the artist table creatively to represent song-song relationships
                # Or we could add to a custom similarity table if it exists
                
                # For now, let's create additional artist relationships with different roles
                artist_id = random.choice(self.artist_ids)
                if (song1_id, artist_id) not in created_pairs:
                    relationships.append({
                        'id': str(uuid.uuid4()),
                        'track_id': song1_id,
                        'artist_id': artist_id,
                        'role': random.choice(['producer', 'remixer']),
                        'position': 0
                    })
                    created_pairs.add((song1_id, artist_id))
        
        # Insert all relationships
        if relationships:
            async with self.get_connection() as conn:
                await conn.executemany("""
                    INSERT INTO musicdb.track_artists (id, track_id, artist_id, role, position)
                    VALUES ($1, $2, $3, $4, $5)
                """, [
                    (r['id'], r['track_id'], r['artist_id'], r['role'], r['position'])
                    for r in relationships
                ])
        
        self.generated_stats['relationships'] = len(relationships)
        logger.info(f"✓ Generated {len(relationships)} weighted relationships")
    
    async def create_graph_indexes(self) -> None:
        """Create indexes optimized for graph queries"""
        logger.info("Creating graph optimization indexes...")
        
        async with self.get_connection() as conn:
            # Index for fast graph traversal
            await conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_sample_track_artists_graph
                ON musicdb.track_artists (track_id, artist_id)
                WHERE track_id IN (
                    SELECT id FROM musicdb.tracks WHERE metadata->>'sample_data' = 'true'
                )
            """)
            
            # Index for similarity queries
            await conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_sample_tracks_similarity
                ON musicdb.tracks (genre, bpm, key)
                WHERE metadata->>'sample_data' = 'true'
            """)
            
            # Full-text search optimization
            await conn.execute("""
                UPDATE musicdb.tracks 
                SET search_vector = to_tsvector('english', title)
                WHERE metadata->>'sample_data' = 'true'
            """)
        
        logger.info("✓ Graph optimization indexes created")
    
    async def generate_statistics(self) -> Dict[str, Any]:
        """Generate and display comprehensive statistics"""
        logger.info("Generating statistics...")
        
        async with self.get_connection() as conn:
            # Basic counts
            song_count = await conn.fetchval("""
                SELECT COUNT(*) FROM musicdb.tracks WHERE metadata->>'sample_data' = 'true'
            """)
            
            artist_count = await conn.fetchval("""
                SELECT COUNT(*) FROM musicdb.artists WHERE metadata->>'sample_data' = 'true'
            """)
            
            relationship_count = await conn.fetchval("""
                SELECT COUNT(*) FROM musicdb.track_artists ta
                JOIN musicdb.tracks t ON ta.track_id = t.id
                WHERE t.metadata->>'sample_data' = 'true'
            """)
            
            # Genre distribution
            genre_stats = await conn.fetch("""
                SELECT genre, COUNT(*) as count
                FROM musicdb.tracks
                WHERE metadata->>'sample_data' = 'true'
                GROUP BY genre
                ORDER BY count DESC
            """)
            
            # BPM distribution
            bpm_stats = await conn.fetchrow("""
                SELECT 
                    AVG(bpm) as avg_bpm,
                    MIN(bpm) as min_bpm,
                    MAX(bpm) as max_bpm,
                    STDDEV(bpm) as stddev_bpm
                FROM musicdb.tracks
                WHERE metadata->>'sample_data' = 'true'
            """)
            
            # Relationship role distribution
            role_stats = await conn.fetch("""
                SELECT role, COUNT(*) as count
                FROM musicdb.track_artists ta
                JOIN musicdb.tracks t ON ta.track_id = t.id
                WHERE t.metadata->>'sample_data' = 'true'
                GROUP BY role
                ORDER BY count DESC
            """)
        
        stats = {
            'generation_time': (self.generated_stats['end_time'] - self.generated_stats['start_time']).total_seconds(),
            'nodes': {
                'songs': song_count,
                'artists': artist_count,
                'total': song_count + artist_count
            },
            'edges': {
                'relationships': relationship_count
            },
            'graph_metrics': {
                'node_edge_ratio': relationship_count / (song_count + artist_count) if (song_count + artist_count) > 0 else 0,
                'avg_connections_per_song': relationship_count / song_count if song_count > 0 else 0
            },
            'music_metadata': {
                'genres': [{'genre': row['genre'], 'count': row['count']} for row in genre_stats],
                'bpm_stats': dict(bpm_stats) if bpm_stats else {},
                'role_distribution': [{'role': row['role'], 'count': row['count']} for row in role_stats]
            }
        }
        
        return stats
    
    async def run(self, clear_existing: bool = False) -> Dict[str, Any]:
        """Main execution flow"""
        try:
            self.generated_stats['start_time'] = datetime.now()
            
            await self.initialize_connection_pool()
            
            if clear_existing:
                await self.clear_existing_data()
            
            logger.info(f"Starting sample data generation for SongNodes...")
            logger.info(f"Target: {TARGET_SONGS} songs, {TARGET_RELATIONSHIPS} relationships")
            
            await self.generate_artists()
            await self.generate_songs()
            await self.generate_weighted_relationships()
            await self.create_graph_indexes()
            
            self.generated_stats['end_time'] = datetime.now()
            
            stats = await self.generate_statistics()
            
            # Display summary
            logger.info("\n" + "="*60)
            logger.info("SAMPLE DATA GENERATION COMPLETED")
            logger.info("="*60)
            logger.info(f"✓ Songs: {stats['nodes']['songs']}")
            logger.info(f"✓ Artists: {stats['nodes']['artists']}")
            logger.info(f"✓ Relationships: {stats['edges']['relationships']}")
            logger.info(f"✓ Total Nodes: {stats['nodes']['total']}")
            logger.info(f"✓ Node-Edge Ratio: 1:{stats['graph_metrics']['node_edge_ratio']:.2f}")
            logger.info(f"✓ Generation Time: {stats['generation_time']:.2f} seconds")
            logger.info("\nTop Genres:")
            for genre_info in stats['music_metadata']['genres'][:5]:
                logger.info(f"  • {genre_info['genre']}: {genre_info['count']} songs")
            logger.info(f"\nBPM Range: {stats['music_metadata']['bpm_stats'].get('min_bpm', 0):.1f} - {stats['music_metadata']['bpm_stats'].get('max_bpm', 0):.1f}")
            logger.info("="*60)
            logger.info("✓ Ready for graph visualization and performance testing!")
            
            return stats
            
        except Exception as e:
            logger.error(f"✗ Sample data generation failed: {e}")
            raise DataGenerationError(f"Generation failed: {e}")
        
        finally:
            await self.close_connection_pool()

async def main():
    """CLI entry point with argument parsing"""
    parser = argparse.ArgumentParser(
        description="Generate sample music data for SongNodes",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python populate_sample_data.py
  python populate_sample_data.py --clear-existing
  python populate_sample_data.py --host postgres --port 5432
  POSTGRES_PASSWORD=mypass python populate_sample_data.py
        """
    )
    
    parser.add_argument('--host', default='localhost', help='Database host (default: localhost)')
    parser.add_argument('--port', type=int, default=5432, help='Database port (default: 5432)')
    parser.add_argument('--database', default='songnodes', help='Database name (default: songnodes)')
    parser.add_argument('--user', default='songnodes_user', help='Database user (default: songnodes_user)')
    parser.add_argument('--clear-existing', action='store_true', 
                       help='Clear existing sample data before generating new data')
    parser.add_argument('--verbose', '-v', action='store_true', help='Enable verbose logging')
    
    args = parser.parse_args()
    
    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)
    
    # Build database config
    database_config = {
        'host': args.host,
        'port': args.port,
        'database': args.database,
        'user': args.user
    }
    
    # Validate environment
    if not os.getenv('POSTGRES_PASSWORD'):
        logger.warning("⚠ POSTGRES_PASSWORD environment variable not set")
        logger.info("  Using default password. Set POSTGRES_PASSWORD for production.")
    
    try:
        populator = SampleDataPopulator(database_config)
        stats = await populator.run(clear_existing=args.clear_existing)
        
        # Exit with success
        logger.info("✓ Sample data population completed successfully")
        return 0
        
    except KeyboardInterrupt:
        logger.info("✗ Generation interrupted by user")
        return 130
    except Exception as e:
        logger.error(f"✗ Generation failed: {e}")
        return 1

if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)