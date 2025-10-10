#!/usr/bin/env python3
# DEPRECATED: This file uses the removed database_pipeline. Use modern pipelines instead.
"""
Import script for nodes.json data into SongNodes database.
Transforms graph node data into track and playlist items for database pipeline.

⚠️  WARNING: This file imports the deprecated database_pipeline.EnhancedMusicDatabasePipeline
    which has been replaced by pipelines.persistence_pipeline.PersistencePipeline.
    This import script may require refactoring to use the modern pipeline architecture.
"""
import asyncio
import json
import logging
import uuid
import os
from datetime import datetime
from pathlib import Path
from urllib.parse import urlparse

from pipelines.persistence_pipeline import PersistencePipeline

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class NodesDataImporter:
    """Import and transform nodes.json data for SongNodes pipeline"""

    def __init__(self, nodes_file_path: str):
        self.nodes_file_path = nodes_file_path
        self.pipeline = None

    async def load_and_transform_data(self):
        """Load nodes.json and transform to pipeline format"""
        logger.info(f"Loading nodes data from {self.nodes_file_path}")

        try:
            with open(self.nodes_file_path, 'r', encoding='utf-8') as f:
                nodes_data = json.load(f)

            logger.info(f"Loaded {len(nodes_data)} track nodes")

            # Transform nodes to track items
            track_items = []
            for node in nodes_data:
                track_item = self._transform_node_to_track(node)
                track_items.append(track_item)

            # Create a sample playlist to establish adjacencies
            playlist_item = self._create_sample_playlist(nodes_data)

            # Create playlist-song relationships
            playlist_song_items = self._create_playlist_song_items(nodes_data, playlist_item['playlist_id'])

            logger.info(f"Transformed data: {len(track_items)} tracks, 1 playlist, {len(playlist_song_items)} playlist-song relationships")

            return track_items, [playlist_item], playlist_song_items

        except FileNotFoundError:
            logger.error(f"Nodes file not found: {self.nodes_file_path}")
            raise
        except json.JSONDecodeError as e:
            logger.error(f"Invalid JSON in nodes file: {e}")
            raise

    def _transform_node_to_track(self, node):
        """Transform a node object to track item format expected by pipeline"""
        return {
            'track_name': node['label'],
            'artist_name': node['artist'],
            'genre': '',  # Not provided in nodes data
            'bpm': node.get('bpm'),
            'key': node.get('key', ''),
            'source_url': '',  # Generated from scraped data, not provided
            'spotify_id': None,
            'release_year': None,
            'node_id': node['id'],  # Preserve original node ID
            'connections': node.get('connections', 0),
            'size': node.get('size', 0)
        }

    def _create_sample_playlist(self, nodes_data):
        """Create a sample playlist to group all tracks"""
        playlist_id = str(uuid.uuid4())
        return {
            'item_type': 'playlist',
            'playlist_id': playlist_id,
            'name': 'Imported Graph Nodes Dataset',
            'description': f'Imported setlist data containing {len(nodes_data)} tracks',
            'dj_name': 'Data Import',
            'venue_name': 'SongNodes Database',
            'event_name': 'Graph Data Import',
            'set_date': datetime.now().date().isoformat(),
            'source_url': '',
            'tracklist_url': '',
            'created_at': datetime.now().isoformat()
        }

    def _create_playlist_song_items(self, nodes_data, playlist_id):
        """Create playlist-song relationship items with position ordering"""
        playlist_songs = []

        # Sort by connections to create a meaningful sequence for adjacencies
        sorted_nodes = sorted(nodes_data, key=lambda x: x.get('connections', 0), reverse=True)

        for position, node in enumerate(sorted_nodes, 1):
            # Generate song_id using same method as pipeline
            song_id = str(uuid.uuid5(
                uuid.NAMESPACE_DNS,
                f"{node['label']}-{node['artist']}".lower()
            ))

            playlist_song = {
                'playlist_id': playlist_id,
                'song_id': song_id,
                'position': position,
                'track_name': node['label'],
                'artist_name': node['artist']
            }
            playlist_songs.append(playlist_song)

        return playlist_songs

    def _get_database_config(self):
        """Parse DATABASE_URL environment variable to create database config"""
        database_url = os.environ.get('DATABASE_URL')
        if not database_url:
            raise ValueError("DATABASE_URL environment variable not found")

        parsed = urlparse(database_url)
        return {
            'host': parsed.hostname,
            'port': parsed.port or 5432,
            'database': parsed.path.lstrip('/'),
            'user': parsed.username,
            'password': parsed.password
        }

    async def import_data(self):
        """Main import function"""
        logger.info("Starting nodes data import process")

        # Get database configuration from environment
        database_config = self._get_database_config()
        logger.info(f"Database config: host={database_config['host']}, port={database_config['port']}")

        # Initialize pipeline
        self.pipeline = PersistencePipeline(database_config)
        await self.pipeline.open_spider(None)

        try:
            # Load and transform data
            track_items, playlist_items, playlist_song_items = await self.load_and_transform_data()

            # Import tracks first
            logger.info("Importing track data...")
            await self.pipeline.process_batch(track_items)

            # Import playlist
            logger.info("Importing playlist data...")
            await self.pipeline.process_batch(playlist_items)

            # Import playlist-song relationships (this triggers adjacency generation)
            logger.info("Importing playlist-song relationships...")
            for playlist_song in playlist_song_items:
                await self.pipeline.process_playlist_song_item(playlist_song)

            # Flush any remaining batches
            await self.pipeline.flush_all_batches()

            logger.info("✓ Data import completed successfully")
            logger.info(f"✓ Imported {len(track_items)} tracks and {len(playlist_song_items)} relationships")

        except Exception as e:
            logger.error(f"Error during import: {e}")
            raise
        finally:
            # Clean up pipeline (Twisted-compatible cleanup)
            if self.pipeline:
                try:
                    # Close async connection pool first
                    if hasattr(self.pipeline, 'connection_pool') and self.pipeline.connection_pool:
                        await self.pipeline.connection_pool.close()
                        logger.info("✓ Closed async connection pool")

                    # Close Twisted connection pool
                    if hasattr(self.pipeline, 'dbpool') and self.pipeline.dbpool:
                        self.pipeline.dbpool.close()
                        logger.info("✓ Closed Twisted connection pool")

                except Exception as cleanup_error:
                    logger.warning(f"Error during pipeline cleanup: {cleanup_error}")

                logger.info("✓ Pipeline cleanup completed")

async def main():
    """Main entry point"""
    nodes_file = "/app/nodes.json"

    if not Path(nodes_file).exists():
        logger.error(f"Nodes file not found: {nodes_file}")
        logger.info("Please ensure the nodes.json file is available at /app/nodes.json")
        return

    importer = NodesDataImporter(nodes_file)
    await importer.import_data()

if __name__ == "__main__":
    asyncio.run(main())