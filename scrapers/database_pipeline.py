"""
Database pipeline for SongNodes - handles database connections and operations
"""
import asyncio
import logging
from typing import List, Dict, Any, Optional
import asyncpg
import os
from datetime import datetime

logger = logging.getLogger(__name__)

class DatabasePipeline:
    """Database pipeline for handling async PostgreSQL operations"""

    def __init__(self):
        self.pool: Optional[asyncpg.Pool] = None
        self.connection_string = self._build_connection_string()

    def _build_connection_string(self) -> str:
        """Build PostgreSQL connection string from environment variables"""
        # Default connection parameters
        defaults = {
            'host': 'localhost',
            'port': '5432',
            'database': 'songnodes',
            'user': 'postgres',
            'password': 'password'
        }

        # Try to get from environment variables
        db_config = {
            'host': os.getenv('DB_HOST', defaults['host']),
            'port': os.getenv('DB_PORT', defaults['port']),
            'database': os.getenv('DB_NAME', defaults['database']),
            'user': os.getenv('DB_USER', defaults['user']),
            'password': os.getenv('DB_PASSWORD', defaults['password'])
        }

        return f"postgresql://{db_config['user']}:{db_config['password']}@{db_config['host']}:{db_config['port']}/{db_config['database']}"

    async def initialize(self):
        """Initialize the database connection pool"""
        try:
            self.pool = await asyncpg.create_pool(
                self.connection_string,
                min_size=1,
                max_size=10,
                command_timeout=60
            )
            logger.info("Database connection pool initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize database pool: {e}")
            raise

    async def close(self):
        """Close the database connection pool"""
        if self.pool:
            await self.pool.close()
            logger.info("Database connection pool closed")

    async def fetch_all(self, query: str, params: Dict[str, Any] = None) -> List[Dict[str, Any]]:
        """Execute a SELECT query and return all results"""
        if not self.pool:
            await self.initialize()

        async with self.pool.acquire() as connection:
            try:
                if params:
                    # Handle SQLAlchemy text queries with named parameters
                    if ':' in query:
                        # Replace SQLAlchemy named parameters with asyncpg positional parameters
                        param_list = []
                        processed_query = query
                        for i, (key, value) in enumerate(params.items(), 1):
                            processed_query = processed_query.replace(f':{key}', f'${i}')
                            param_list.append(value)
                        rows = await connection.fetch(processed_query, *param_list)
                    else:
                        # Assume positional parameters
                        rows = await connection.fetch(query, *params.values())
                else:
                    rows = await connection.fetch(query)

                # Convert rows to dictionaries
                return [dict(row) for row in rows]
            except Exception as e:
                logger.error(f"Database query error: {e}")
                logger.error(f"Query: {query}")
                logger.error(f"Params: {params}")
                raise

    async def fetch_one(self, query: str, params: Dict[str, Any] = None) -> Optional[Dict[str, Any]]:
        """Execute a SELECT query and return one result"""
        if not self.pool:
            await self.initialize()

        async with self.pool.acquire() as connection:
            try:
                if params:
                    # Handle SQLAlchemy text queries with named parameters
                    if ':' in query:
                        # Replace SQLAlchemy named parameters with asyncpg positional parameters
                        param_list = []
                        processed_query = query
                        for i, (key, value) in enumerate(params.items(), 1):
                            processed_query = processed_query.replace(f':{key}', f'${i}')
                            param_list.append(value)
                        row = await connection.fetchrow(processed_query, *param_list)
                    else:
                        # Assume positional parameters
                        row = await connection.fetchrow(query, *params.values())
                else:
                    row = await connection.fetchrow(query)

                return dict(row) if row else None
            except Exception as e:
                logger.error(f"Database query error: {e}")
                logger.error(f"Query: {query}")
                logger.error(f"Params: {params}")
                raise

    async def execute(self, query: str, params: Dict[str, Any] = None) -> str:
        """Execute an INSERT/UPDATE/DELETE query"""
        if not self.pool:
            await self.initialize()

        async with self.pool.acquire() as connection:
            try:
                if params:
                    # Handle SQLAlchemy text queries with named parameters
                    if ':' in query:
                        # Replace SQLAlchemy named parameters with asyncpg positional parameters
                        param_list = []
                        processed_query = query
                        for i, (key, value) in enumerate(params.items(), 1):
                            processed_query = processed_query.replace(f':{key}', f'${i}')
                            param_list.append(value)
                        result = await connection.execute(processed_query, *param_list)
                    else:
                        # Assume positional parameters
                        result = await connection.execute(query, *params.values())
                else:
                    result = await connection.execute(query)

                return result
            except Exception as e:
                logger.error(f"Database execute error: {e}")
                logger.error(f"Query: {query}")
                logger.error(f"Params: {params}")
                raise

    async def get_songs_for_availability_check(self, limit: int = 100) -> List[Dict[str, Any]]:
        """Get songs that need availability checking"""
        query = """
            SELECT id, artist, title, isrc, tidal_id, updated_at
            FROM songs
            WHERE tidal_id IS NULL OR tidal_last_checked < NOW() - INTERVAL '7 days'
            ORDER BY updated_at DESC
            LIMIT $1
        """

        if not self.pool:
            await self.initialize()

        async with self.pool.acquire() as connection:
            try:
                rows = await connection.fetch(query, limit)
                return [dict(row) for row in rows]
            except Exception as e:
                logger.error(f"Error fetching songs for availability check: {e}")
                return []

    async def update_song_tidal_info(self, song_id: str, tidal_id: Optional[int], available: bool = True):
        """Update song with Tidal information"""
        query = """
            UPDATE songs
            SET tidal_id = $2,
                tidal_available = $3,
                tidal_last_checked = NOW(),
                updated_at = NOW()
            WHERE id = $1
        """

        if not self.pool:
            await self.initialize()

        async with self.pool.acquire() as connection:
            try:
                await connection.execute(query, song_id, tidal_id, available)
                logger.debug(f"Updated song {song_id} with Tidal ID {tidal_id}")
            except Exception as e:
                logger.error(f"Error updating song Tidal info: {e}")
                raise

    async def get_setlist_tracks(self, setlist_id: str) -> List[Dict[str, Any]]:
        """Get tracks for a specific setlist"""
        query = """
            SELECT s.id, s.artist, s.title, s.isrc, st.position
            FROM songs s
            JOIN setlist_tracks st ON s.id = st.track_id
            WHERE st.setlist_id = $1
            ORDER BY st.position
        """

        if not self.pool:
            await self.initialize()

        async with self.pool.acquire() as connection:
            try:
                rows = await connection.fetch(query, setlist_id)
                return [dict(row) for row in rows]
            except Exception as e:
                logger.error(f"Error fetching setlist tracks: {e}")
                return []

    async def health_check(self) -> bool:
        """Check if database connection is healthy"""
        try:
            if not self.pool:
                await self.initialize()

            async with self.pool.acquire() as connection:
                await connection.fetchval("SELECT 1")
                return True
        except Exception as e:
            logger.error(f"Database health check failed: {e}")
            return False

# Create a global instance
db_pipeline = DatabasePipeline()

async def get_database() -> DatabasePipeline:
    """Dependency injection for FastAPI"""
    if not db_pipeline.pool:
        await db_pipeline.initialize()
    return db_pipeline