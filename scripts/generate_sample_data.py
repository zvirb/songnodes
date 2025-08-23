#!/usr/bin/env python3
"""
Sample Music Data Generator for SongNodes
Generates realistic sample data for performance testing (100+ nodes, 500+ edges)
"""

import asyncio
import asyncpg
import random
import uuid
from datetime import datetime, timedelta
from typing import List, Dict, Any
import json

# Configuration
DATABASE_URL = "postgresql://musicdb_user:musicdb_dev_password_2024@localhost:5433/musicdb"
TARGET_ARTISTS = 120
TARGET_TRACKS = 300
TARGET_RELATIONSHIPS = 500

# Sample data pools
ELECTRONIC_GENRES = [
    "Techno", "House", "Progressive House", "Deep House", "Tech House",
    "Trance", "Progressive Trance", "Drum & Bass", "Dubstep", "Ambient",
    "Breakbeat", "Hardstyle", "Minimal Techno", "Acid House", "Electro"
]

ARTIST_NAMES = [
    "Deadmau5", "Calvin Harris", "Tiësto", "Armin van Buuren", "Martin Garrix",
    "Skrillex", "David Guetta", "Steve Aoki", "Daft Punk", "Swedish House Mafia",
    "Avicii", "Zedd", "Diplo", "Flume", "ODESZA", "Porter Robinson", "Madeon",
    "Eric Prydz", "Above & Beyond", "Sasha", "John Digweed", "Carl Cox",
    "Richie Hawtin", "Adam Beyer", "Charlotte de Witte", "Amelie Lens",
    "Tale of Us", "Artbat", "Maceo Plex", "Hot Since 82", "Camelphat",
    "Fisher", "Chris Lake", "Malaa", "Tchami", "ZHU", "Disclosure",
    "The Chemical Brothers", "Fatboy Slim", "Underworld", "Orbital",
    "Aphex Twin", "Boards of Canada", "Autechre", "Squarepusher",
    "Four Tet", "Caribou", "Jon Hopkins", "Bonobo", "Tycho", "Emancipator"
]

TRACK_PREFIXES = [
    "midnight", "neon", "cyber", "digital", "electric", "sonic", "crystal",
    "infinite", "stellar", "cosmic", "lunar", "solar", "quantum", "matrix",
    "phoenix", "aurora", "zenith", "nexus", "vortex", "pulse", "frequency",
    "wavelength", "amplitude", "resonance", "harmony", "melody", "rhythm",
    "beat", "drop", "build", "break", "anthem", "journey", "escape", "flight"
]

TRACK_SUFFIXES = [
    "dreams", "waves", "lights", "nights", "beats", "vibes", "sounds",
    "echoes", "memories", "moments", "feelings", "emotions", "energy",
    "passion", "fire", "storm", "rain", "thunder", "lightning", "wind",
    "ocean", "mountain", "sky", "star", "moon", "sun", "galaxy", "universe",
    "dimension", "realm", "world", "space", "time", "infinity", "eternity"
]

REMIX_TYPES = ["Original Mix", "Radio Edit", "Extended Mix", "Club Mix", "Dub Mix", "Instrumental"]

VENUE_NAMES = [
    "Berghain", "Fabric", "Output", "Space Ibiza", "Amnesia", "Pacha",
    "Ministry of Sound", "Warehouse Project", "Electric Brixton", "Printworks",
    "Watergate", "Tresor", "Rex Club", "Concrete", "De School", "Sisyphos",
    "About Blank", "Panorama Bar", "Sub Club", "The Hacienda", "Creamfields",
    "Ultra Music Festival", "Tomorrowland", "Electric Daisy Carnival",
    "Burning Man", "BPM Festival", "ADE", "Miami Music Week", "Sonar"
]

CITIES = [
    ("Berlin", "Germany"), ("London", "UK"), ("Amsterdam", "Netherlands"),
    ("Ibiza", "Spain"), ("Miami", "USA"), ("Las Vegas", "USA"),
    ("New York", "USA"), ("Los Angeles", "USA"), ("Paris", "France"),
    ("Barcelona", "Spain"), ("Prague", "Czech Republic"), ("Budapest", "Hungary")
]

class SampleDataGenerator:
    def __init__(self, database_url: str):
        self.database_url = database_url
        self.connection = None
        self.artist_ids = []
        self.track_ids = []
        self.venue_ids = []
        self.performer_ids = []

    async def connect(self):
        """Connect to the database"""
        try:
            self.connection = await asyncpg.connect(self.database_url)
            print("✓ Connected to database")
        except Exception as e:
            print(f"✗ Failed to connect to database: {e}")
            raise

    async def close(self):
        """Close database connection"""
        if self.connection:
            await self.connection.close()

    def generate_track_title(self) -> str:
        """Generate a realistic electronic music track title"""
        prefix = random.choice(TRACK_PREFIXES)
        suffix = random.choice(TRACK_SUFFIXES)
        remix_type = random.choice(REMIX_TYPES)
        
        if random.random() < 0.3:  # 30% chance of remix
            return f"{prefix.title()} {suffix.title()} ({remix_type})"
        else:
            return f"{prefix.title()} {suffix.title()}"

    def normalize_name(self, name: str) -> str:
        """Normalize text for searching"""
        return name.lower().strip()

    async def generate_artists(self):
        """Generate sample artists"""
        print(f"Generating {TARGET_ARTISTS} artists...")
        
        # Use a mix of real and generated artist names
        all_names = ARTIST_NAMES.copy()
        used_normalized_names = set()
        
        # Add real names first
        for name in ARTIST_NAMES:
            used_normalized_names.add(self.normalize_name(name))
        
        # Generate additional unique artist names
        while len(all_names) < TARGET_ARTISTS:
            prefix = random.choice(["DJ", "MC", "The", ""])
            name = f"{prefix} {random.choice(TRACK_PREFIXES).title()}"
            if random.random() < 0.5:
                name += f" {random.choice(TRACK_SUFFIXES).title()}"
            name = name.strip()
            
            # Ensure uniqueness
            normalized = self.normalize_name(name)
            if normalized not in used_normalized_names:
                all_names.append(name)
                used_normalized_names.add(normalized)

        artists_to_insert = []
        for i, name in enumerate(all_names[:TARGET_ARTISTS]):
            artist_id = str(uuid.uuid4())
            self.artist_ids.append(artist_id)
            
            artists_to_insert.append((
                artist_id,
                name,
                self.normalize_name(name),
                [name.lower()] if random.random() < 0.3 else [],  # aliases
                f"spotify_{i}" if random.random() < 0.7 else None,
                f"apple_{i}" if random.random() < 0.5 else None,
                json.dumps({
                    "genre": random.choice(ELECTRONIC_GENRES),
                    "followers": random.randint(1000, 5000000),
                    "verified": random.random() < 0.3
                })
            ))

        # Insert artists in batches
        await self.connection.executemany("""
            INSERT INTO musicdb.artists (id, name, normalized_name, aliases, spotify_id, apple_music_id, metadata)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
        """, artists_to_insert)
        
        print(f"✓ Generated {len(artists_to_insert)} artists")

    async def generate_tracks(self):
        """Generate sample tracks"""
        print(f"Generating {TARGET_TRACKS} tracks...")
        
        tracks_to_insert = []
        for i in range(TARGET_TRACKS):
            track_id = str(uuid.uuid4())
            self.track_ids.append(track_id)
            
            title = self.generate_track_title()
            genre = random.choice(ELECTRONIC_GENRES)
            
            tracks_to_insert.append((
                track_id,
                title,
                self.normalize_name(title),
                f"ISRC{i:08d}" if random.random() < 0.6 else None,
                f"spotify_track_{i}" if random.random() < 0.8 else None,
                random.randint(120000, 480000),  # duration_ms
                round(random.uniform(110, 140), 2),  # bpm
                random.choice(["A", "B", "C", "D", "E", "F", "G"]) + random.choice(["m", ""]),  # key
                round(random.uniform(0.3, 1.0), 2),  # energy
                round(random.uniform(0.4, 1.0), 2),  # danceability
                round(random.uniform(0.1, 0.9), 2),  # valence
                datetime.now().date() - timedelta(days=random.randint(0, 3650)),  # release_date
                genre,
                random.choice(["Progressive", "Melodic", "Dark", "Uplifting", "Commercial"]),  # subgenre
                random.random() < 0.15,  # is_remix
                random.random() < 0.05,  # is_mashup
                random.random() < 0.02,  # is_live
                json.dumps({
                    "popularity": random.randint(10, 100),
                    "explicit": random.random() < 0.1,
                    "tempo_confidence": round(random.uniform(0.7, 1.0), 2)
                })
            ))

        # Insert tracks in batches
        await self.connection.executemany("""
            INSERT INTO musicdb.tracks (id, title, normalized_title, isrc, spotify_id, duration_ms, 
                                       bpm, key, energy, danceability, valence, release_date, 
                                       genre, subgenre, is_remix, is_mashup, is_live, metadata)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
        """, tracks_to_insert)
        
        print(f"✓ Generated {len(tracks_to_insert)} tracks")

    async def generate_track_artist_relationships(self):
        """Generate track-artist relationships (this creates the main graph edges)"""
        print(f"Generating {TARGET_RELATIONSHIPS} track-artist relationships...")
        
        relationships = []
        relationship_count = 0
        
        while relationship_count < TARGET_RELATIONSHIPS:
            track_id = random.choice(self.track_ids)
            artist_id = random.choice(self.artist_ids)
            role = random.choice(["primary", "featured", "remixer", "producer"])
            
            # Check if this relationship already exists
            existing = await self.connection.fetchval("""
                SELECT COUNT(*) FROM musicdb.track_artists 
                WHERE track_id = $1 AND artist_id = $2 AND role = $3
            """, track_id, artist_id, role)
            
            if existing == 0:
                relationships.append((
                    str(uuid.uuid4()),
                    track_id,
                    artist_id,
                    role,
                    0  # position
                ))
                relationship_count += 1
                
                # Insert in batches of 50
                if len(relationships) >= 50:
                    await self.connection.executemany("""
                        INSERT INTO musicdb.track_artists (id, track_id, artist_id, role, position)
                        VALUES ($1, $2, $3, $4, $5)
                    """, relationships)
                    relationships = []

        # Insert remaining relationships
        if relationships:
            await self.connection.executemany("""
                INSERT INTO musicdb.track_artists (id, track_id, artist_id, role, position)
                VALUES ($1, $2, $3, $4, $5)
            """, relationships)
        
        print(f"✓ Generated {relationship_count} track-artist relationships")

    async def generate_venues_and_events(self):
        """Generate venues and events for additional graph complexity"""
        print("Generating venues and events...")
        
        # Generate venues
        venues_to_insert = []
        for i, venue_name in enumerate(VENUE_NAMES[:30]):
            venue_id = str(uuid.uuid4())
            self.venue_ids.append(venue_id)
            city, country = random.choice(CITIES)
            
            venues_to_insert.append((
                venue_id,
                venue_name,
                city,
                None,  # state
                country,
                round(random.uniform(-90, 90), 6),  # latitude
                round(random.uniform(-180, 180), 6),  # longitude
                random.randint(500, 20000),  # capacity
                random.choice(["club", "festival", "arena", "warehouse"]),
                json.dumps({
                    "website": f"https://{venue_name.lower().replace(' ', '')}.com",
                    "established": random.randint(1990, 2020)
                })
            ))

        await self.connection.executemany("""
            INSERT INTO musicdb.venues (id, name, city, state, country, latitude, longitude, 
                                       capacity, venue_type, metadata)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        """, venues_to_insert)

        # Generate performers (linking some to artists)
        performers_to_insert = []
        for i, artist_id in enumerate(random.sample(self.artist_ids, min(50, len(self.artist_ids)))):
            performer_id = str(uuid.uuid4())
            self.performer_ids.append(performer_id)
            
            # Get artist name
            artist_name = await self.connection.fetchval(
                "SELECT name FROM musicdb.artists WHERE id = $1", artist_id
            )
            
            performers_to_insert.append((
                performer_id,
                f"DJ {artist_name}",
                self.normalize_name(f"DJ {artist_name}"),
                artist_id,
                f"Bio for {artist_name}",
                random.choice([city[1] for city in CITIES]),
                json.dumps({
                    "booking_fee": random.randint(5000, 100000),
                    "social_followers": random.randint(10000, 1000000)
                })
            ))

        await self.connection.executemany("""
            INSERT INTO musicdb.performers (id, name, normalized_name, artist_id, bio, country, metadata)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
        """, performers_to_insert)

        print(f"✓ Generated {len(venues_to_insert)} venues and {len(performers_to_insert)} performers")

    async def generate_setlists(self):
        """Generate setlists to create more complex relationships"""
        print("Generating setlists...")
        
        setlists_to_insert = []
        setlist_tracks_to_insert = []
        
        # Generate 50 setlists
        for i in range(50):
            setlist_id = str(uuid.uuid4())
            
            setlists_to_insert.append((
                setlist_id,
                random.choice(self.performer_ids) if self.performer_ids else None,
                None,  # event_id (we're not creating events for simplicity)
                datetime.now() - timedelta(days=random.randint(0, 365)),
                random.randint(60, 180),  # set_length_minutes
                "1001tracklists",
                f"https://1001tracklists.com/setlist/{i}",
                f"setlist_{i}",
                True,  # is_complete
                json.dumps({
                    "venue": random.choice(VENUE_NAMES),
                    "genre": random.choice(ELECTRONIC_GENRES)
                })
            ))
            
            # Add 10-20 tracks to each setlist
            track_count = random.randint(10, 20)
            selected_tracks = random.sample(self.track_ids, min(track_count, len(self.track_ids)))
            
            for pos, track_id in enumerate(selected_tracks, 1):
                setlist_tracks_to_insert.append((
                    str(uuid.uuid4()),
                    setlist_id,
                    track_id,
                    pos,
                    random.choice(["A", "B", "C", "D", "E", "F", "G"]) + random.choice(["m", ""]),  # track_key
                    round(random.uniform(110, 140), 2),  # bpm_live
                    random.randint(7, 10) if random.random() < 0.8 else None,  # transition_rating
                    False,  # is_id
                    None,  # id_text
                    f"Track {pos} notes" if random.random() < 0.2 else None  # notes
                ))

        # Insert setlists
        await self.connection.executemany("""
            INSERT INTO musicdb.setlists (id, performer_id, event_id, set_date, set_length_minutes,
                                         source, source_url, source_id, is_complete, metadata)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        """, setlists_to_insert)

        # Insert setlist tracks in batches
        batch_size = 100
        for i in range(0, len(setlist_tracks_to_insert), batch_size):
            batch = setlist_tracks_to_insert[i:i + batch_size]
            await self.connection.executemany("""
                INSERT INTO musicdb.setlist_tracks (id, setlist_id, track_id, position, track_key,
                                                   bpm_live, transition_rating, is_id, id_text, notes)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            """, batch)

        print(f"✓ Generated {len(setlists_to_insert)} setlists with {len(setlist_tracks_to_insert)} track entries")

    async def refresh_materialized_views(self):
        """Refresh materialized views for performance"""
        print("Refreshing materialized views...")
        
        try:
            await self.connection.execute("REFRESH MATERIALIZED VIEW musicdb.popular_tracks")
            await self.connection.execute("REFRESH MATERIALIZED VIEW musicdb.artist_collaborations")
            print("✓ Refreshed materialized views")
        except Exception as e:
            print(f"⚠ Warning: Could not refresh materialized views: {e}")

    async def generate_summary_stats(self):
        """Generate summary statistics"""
        print("\n" + "="*50)
        print("SAMPLE DATA GENERATION SUMMARY")
        print("="*50)
        
        # Count records
        artist_count = await self.connection.fetchval("SELECT COUNT(*) FROM musicdb.artists")
        track_count = await self.connection.fetchval("SELECT COUNT(*) FROM musicdb.tracks")
        relationship_count = await self.connection.fetchval("SELECT COUNT(*) FROM musicdb.track_artists")
        venue_count = await self.connection.fetchval("SELECT COUNT(*) FROM musicdb.venues")
        performer_count = await self.connection.fetchval("SELECT COUNT(*) FROM musicdb.performers")
        setlist_count = await self.connection.fetchval("SELECT COUNT(*) FROM musicdb.setlists")
        setlist_track_count = await self.connection.fetchval("SELECT COUNT(*) FROM musicdb.setlist_tracks")
        
        print(f"Artists: {artist_count}")
        print(f"Tracks: {track_count}")
        print(f"Track-Artist Relationships: {relationship_count}")
        print(f"Venues: {venue_count}")
        print(f"Performers: {performer_count}")
        print(f"Setlists: {setlist_count}")
        print(f"Setlist Tracks: {setlist_track_count}")
        
        total_nodes = artist_count + track_count + venue_count + performer_count + setlist_count
        total_edges = relationship_count + setlist_track_count
        
        print(f"\nGraph Statistics:")
        print(f"Total Nodes: {total_nodes}")
        print(f"Total Edges: {total_edges}")
        print(f"Node-to-Edge Ratio: 1:{total_edges/total_nodes:.2f}")
        
        # Genre distribution
        genre_stats = await self.connection.fetch("""
            SELECT genre, COUNT(*) as count 
            FROM musicdb.tracks 
            WHERE genre IS NOT NULL 
            GROUP BY genre 
            ORDER BY count DESC 
            LIMIT 5
        """)
        
        print(f"\nTop 5 Genres:")
        for row in genre_stats:
            print(f"  {row['genre']}: {row['count']} tracks")
        
        print("="*50)
        print("✓ Sample data generation completed successfully!")
        print("  Ready for performance testing and visualization")

    async def run(self):
        """Main execution flow"""
        await self.connect()
        
        try:
            print("Starting sample data generation for SongNodes...")
            print(f"Target: {TARGET_ARTISTS} artists, {TARGET_TRACKS} tracks, {TARGET_RELATIONSHIPS} relationships")
            print()
            
            await self.generate_artists()
            await self.generate_tracks()
            await self.generate_track_artist_relationships()
            await self.generate_venues_and_events()
            await self.generate_setlists()
            await self.refresh_materialized_views()
            await self.generate_summary_stats()
            
        finally:
            await self.close()

async def main():
    generator = SampleDataGenerator(DATABASE_URL)
    await generator.run()

if __name__ == "__main__":
    asyncio.run(main())