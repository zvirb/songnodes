"""
Database API Key Helper
Retrieves API keys from PostgreSQL database with encryption support
Falls back to environment variables if database is unavailable
"""

import asyncpg
import os
import logging
from typing import Optional, Dict

logger = logging.getLogger(__name__)

class DatabaseAPIKeyHelper:
    """Helper class for retrieving API keys from database"""

    def __init__(self, database_url: str):
        self.database_url = database_url
        self.encryption_secret = os.getenv('API_KEY_ENCRYPTION_SECRET')
        self._pool: Optional[asyncpg.Pool] = None

    async def initialize(self):
        """Initialize database connection pool"""
        try:
            self._pool = await asyncpg.create_pool(
                self.database_url,
                min_size=2,
                max_size=5,
                command_timeout=10
            )
            logger.info("Database API key helper initialized")
        except Exception as e:
            logger.warning(f"Failed to initialize database pool: {str(e)}")
            logger.warning("Will fall back to environment variables")

    async def close(self):
        """Close database connection pool"""
        if self._pool:
            await self._pool.close()

    async def get_key(self, service_name: str, key_name: str) -> Optional[str]:
        """
        Retrieve a decrypted API key from the database

        Args:
            service_name: Service identifier (e.g., 'spotify', 'youtube')
            key_name: Key name (e.g., 'client_id', 'api_key')

        Returns:
            Decrypted API key value or None if not found
        """
        # Try database first
        if self._pool:
            try:
                async with self._pool.acquire() as conn:
                    query = "SELECT get_api_key($1, $2, $3) as key_value"
                    result = await conn.fetchrow(
                        query,
                        service_name.lower(),
                        key_name,
                        self.encryption_secret
                    )

                    if result and result['key_value']:
                        logger.info(f"Retrieved API key for {service_name}/{key_name} from database")
                        return result['key_value']

            except Exception as e:
                logger.warning(f"Failed to retrieve API key from database: {str(e)}")

        # Fallback to environment variable
        env_key = self._get_env_key_name(service_name, key_name)
        env_value = os.getenv(env_key)

        if env_value:
            logger.info(f"Retrieved API key for {service_name}/{key_name} from environment")
            return env_value

        logger.warning(f"API key not found for {service_name}/{key_name}")
        return None

    async def get_all_keys_for_service(self, service_name: str) -> Dict[str, str]:
        """
        Retrieve all API keys for a specific service

        Args:
            service_name: Service identifier (e.g., 'spotify')

        Returns:
            Dictionary mapping key_name to decrypted value
        """
        keys = {}

        # Try database first
        if self._pool:
            try:
                async with self._pool.acquire() as conn:
                    query = """
                    SELECT key_name, get_api_key(service_name, key_name, $2) as key_value
                    FROM api_keys
                    WHERE service_name = $1
                    """
                    rows = await conn.fetch(query, service_name.lower(), self.encryption_secret)

                    for row in rows:
                        if row['key_value']:
                            keys[row['key_name']] = row['key_value']

                    if keys:
                        logger.info(f"Retrieved {len(keys)} API keys for {service_name} from database")
                        return keys

            except Exception as e:
                logger.warning(f"Failed to retrieve API keys from database: {str(e)}")

        # Fallback to environment variables
        keys = self._get_env_keys_for_service(service_name)
        if keys:
            logger.info(f"Retrieved {len(keys)} API keys for {service_name} from environment")

        return keys

    def _get_env_key_name(self, service_name: str, key_name: str) -> str:
        """
        Generate environment variable name for a service key

        Args:
            service_name: Service identifier
            key_name: Key name

        Returns:
            Environment variable name in UPPER_SNAKE_CASE
        """
        return f"{service_name.upper()}_{key_name.upper()}"

    def _get_env_keys_for_service(self, service_name: str) -> Dict[str, str]:
        """
        Get all environment variable keys for a service (fallback)

        Args:
            service_name: Service identifier

        Returns:
            Dictionary of key_name to value from environment variables
        """
        keys = {}
        service_upper = service_name.upper()

        # Service-specific key patterns
        key_patterns = {
            'spotify': ['CLIENT_ID', 'CLIENT_SECRET'],
            'youtube': ['API_KEY'],
            'discogs': ['TOKEN'],
            'lastfm': ['API_KEY'],
            'beatport': ['API_KEY'],
            'musicbrainz': ['USER_AGENT']
        }

        patterns = key_patterns.get(service_name.lower(), [])

        for pattern in patterns:
            env_key = f"{service_upper}_{pattern}"
            value = os.getenv(env_key)
            if value:
                keys[pattern.lower()] = value

        return keys


# Global instance
_api_key_helper: Optional[DatabaseAPIKeyHelper] = None


async def initialize_api_key_helper(database_url: str):
    """Initialize the global API key helper"""
    global _api_key_helper
    _api_key_helper = DatabaseAPIKeyHelper(database_url)
    await _api_key_helper.initialize()


async def get_api_key(service_name: str, key_name: str) -> Optional[str]:
    """
    Convenience function to retrieve a single API key

    Args:
        service_name: Service identifier
        key_name: Key name

    Returns:
        Decrypted API key value or None
    """
    if not _api_key_helper:
        # Fallback to environment variable if helper not initialized
        env_key = f"{service_name.upper()}_{key_name.upper()}"
        return os.getenv(env_key)

    return await _api_key_helper.get_key(service_name, key_name)


async def get_service_keys(service_name: str) -> Dict[str, str]:
    """
    Convenience function to retrieve all keys for a service

    Args:
        service_name: Service identifier

    Returns:
        Dictionary of key_name to decrypted value
    """
    if not _api_key_helper:
        # Fallback to environment variables if helper not initialized
        helper = DatabaseAPIKeyHelper("")
        return helper._get_env_keys_for_service(service_name)

    return await _api_key_helper.get_all_keys_for_service(service_name)


async def close_api_key_helper():
    """Close the global API key helper"""
    global _api_key_helper
    if _api_key_helper:
        await _api_key_helper.close()
        _api_key_helper = None