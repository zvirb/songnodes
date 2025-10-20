"""
API Key Helper Utilities
Provides helper functions to retrieve encrypted API keys from the database
"""

import asyncpg
import os
import logging
from typing import Optional, Dict, Any

logger = logging.getLogger(__name__)

class APIKeyHelper:
    """Helper class for retrieving API keys from database"""

    def __init__(self, db_pool: asyncpg.Pool):
        self.db_pool = db_pool
        self.encryption_secret = os.getenv('API_KEY_ENCRYPTION_SECRET')

    async def get_key(self, service_name: str, key_name: str) -> Optional[str]:
        """
        Retrieve a decrypted API key from the database

        Args:
            service_name: Service identifier (e.g., 'spotify', 'youtube')
            key_name: Key name (e.g., 'client_id', 'api_key')

        Returns:
            Decrypted API key value or None if not found

        Example:
            helper = APIKeyHelper(db_pool)
            spotify_id = await helper.get_key('spotify', 'client_id')
        """
        try:
            async with self.db_pool.acquire() as conn:
                query = "SELECT get_api_key($1, $2, $3) as key_value"
                result = await conn.fetchrow(
                    query,
                    service_name.lower(),
                    key_name,
                    self.encryption_secret
                )

                if result and result['key_value']:
                    return result['key_value']

                # Fallback to environment variable
                env_key = self._get_env_key_name(service_name, key_name)
                env_value = os.getenv(env_key)

                if env_value:
                    logger.info(
                        f"API key for {service_name}/{key_name} loaded from environment variable"
                    )
                    return env_value

                return None

        except Exception as e:
            logger.error(f"Failed to retrieve API key {service_name}/{key_name}: {str(e)}")

            # Fallback to environment variable
            env_key = self._get_env_key_name(service_name, key_name)
            env_value = os.getenv(env_key)

            if env_value:
                logger.info(
                    f"API key for {service_name}/{key_name} loaded from environment variable (database failed)"
                )
                return env_value

            return None

    async def get_all_keys_for_service(self, service_name: str) -> Dict[str, str]:
        """
        Retrieve all API keys for a specific service

        Args:
            service_name: Service identifier (e.g., 'spotify')

        Returns:
            Dictionary mapping key_name to decrypted value

        Example:
            helper = APIKeyHelper(db_pool)
            spotify_keys = await helper.get_all_keys_for_service('spotify')
            # Returns: {'client_id': '...', 'client_secret': '...'}
        """
        try:
            async with self.db_pool.acquire() as conn:
                query = """
                SELECT key_name, get_api_key(service_name, key_name, $2) as key_value
                FROM api_keys
                WHERE service_name = $1
                """
                rows = await conn.fetch(query, service_name.lower(), self.encryption_secret)

                keys = {}
                for row in rows:
                    if row['key_value']:
                        keys[row['key_name']] = row['key_value']

                # Add environment variable fallbacks
                if not keys:
                    keys = self._get_env_keys_for_service(service_name)

                return keys

        except Exception as e:
            logger.error(f"Failed to retrieve API keys for service {service_name}: {str(e)}")

            # Fallback to environment variables
            return self._get_env_keys_for_service(service_name)

    async def has_key(self, service_name: str, key_name: str) -> bool:
        """
        Check if an API key exists for a service

        Args:
            service_name: Service identifier
            key_name: Key name

        Returns:
            True if key exists, False otherwise
        """
        key_value = await self.get_key(service_name, key_name)
        return key_value is not None

    async def are_keys_configured(self, service_name: str, required_keys: list) -> bool:
        """
        Check if all required keys are configured for a service

        Args:
            service_name: Service identifier
            required_keys: List of required key names

        Returns:
            True if all required keys exist, False otherwise

        Example:
            helper = APIKeyHelper(db_pool)
            spotify_ready = await helper.are_keys_configured(
                'spotify',
                ['client_id', 'client_secret']
            )
        """
        for key_name in required_keys:
            if not await self.has_key(service_name, key_name):
                return False
        return True

    def _get_env_key_name(self, service_name: str, key_name: str) -> str:
        """
        Generate environment variable name for a service key

        Args:
            service_name: Service identifier
            key_name: Key name

        Returns:
            Environment variable name in UPPER_SNAKE_CASE

        Example:
            _get_env_key_name('spotify', 'client_id') -> 'SPOTIFY_CLIENT_ID'
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
                logger.info(f"Loaded {service_name}/{pattern.lower()} from environment")

        return keys


async def get_api_key(
    db_pool: asyncpg.Pool,
    service_name: str,
    key_name: str
) -> Optional[str]:
    """
    Convenience function to retrieve a single API key

    Args:
        db_pool: Database connection pool
        service_name: Service identifier
        key_name: Key name

    Returns:
        Decrypted API key value or None

    Example:
        spotify_id = await get_api_key(db_pool, 'spotify', 'client_id')
    """
    helper = APIKeyHelper(db_pool)
    return await helper.get_key(service_name, key_name)


async def get_service_keys(
    db_pool: asyncpg.Pool,
    service_name: str
) -> Dict[str, str]:
    """
    Convenience function to retrieve all keys for a service

    Args:
        db_pool: Database connection pool
        service_name: Service identifier

    Returns:
        Dictionary of key_name to decrypted value

    Example:
        spotify_keys = await get_service_keys(db_pool, 'spotify')
    """
    helper = APIKeyHelper(db_pool)
    return await helper.get_all_keys_for_service(service_name)