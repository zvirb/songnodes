"""
Unified Secrets Management for SongNodes
=========================================

2025 Best Practices Implementation:
- Reads secrets from Docker Secrets (/run/secrets/) first
- Falls back to environment variables
- Provides consistent interface across all services
- Never exposes secrets in logs or error messages

Usage:
    from common.secrets_manager import get_secret, get_database_config

    # Get individual secret
    db_password = get_secret('POSTGRES_PASSWORD')

    # Get full database configuration
    db_config = get_database_config()
"""

import os
import logging
from pathlib import Path
from typing import Optional, Dict, Any

logger = logging.getLogger(__name__)

# Docker Secrets directories (in priority order)
DOCKER_SECRETS_DIR = Path("/run/secrets")
LOCAL_SECRETS_DIR = Path(__file__).parent.parent.parent / "secrets"  # Project root secrets/


def get_secret(
    key: str,
    default: Optional[str] = None,
    required: bool = False,
    secret_file_name: Optional[str] = None
) -> Optional[str]:
    """
    Get secret value from Docker Secrets or environment variables.

    Priority order:
    1. Docker Secret file (/run/secrets/<secret_file_name>)
    2. Environment variable
    3. Default value

    Args:
        key: Environment variable name
        default: Default value if not found
        required: If True, raises ValueError when secret not found
        secret_file_name: Custom secret file name (defaults to lowercase key)

    Returns:
        Secret value or None

    Raises:
        ValueError: If required=True and secret not found
    """
    # Determine secret file name
    if secret_file_name is None:
        secret_file_name = key.lower()

    # 1. Try Docker Secret (/run/secrets/)
    docker_secret_path = DOCKER_SECRETS_DIR / secret_file_name
    if docker_secret_path.exists():
        try:
            with open(docker_secret_path, 'r') as f:
                value = f.read().strip()
                if value:
                    logger.debug(f"Loaded secret '{key}' from Docker Secret")
                    return value
        except Exception as e:
            logger.warning(f"Failed to read Docker Secret '{key}': {e}")

    # 2. Try Local Secrets (./secrets/ - for development)
    local_secret_path = LOCAL_SECRETS_DIR / secret_file_name
    if local_secret_path.exists():
        try:
            with open(local_secret_path, 'r') as f:
                value = f.read().strip()
                if value:
                    logger.debug(f"Loaded secret '{key}' from local secrets directory")
                    return value
        except Exception as e:
            logger.warning(f"Failed to read local secret '{key}': {e}")

    # 3. Try environment variable
    value = os.getenv(key)
    if value:
        logger.debug(f"Loaded secret '{key}' from environment variable")
        return value

    # 4. Use default
    if default is not None:
        logger.debug(f"Using default value for secret '{key}'")
        return default

    # 5. Handle required secrets
    if required:
        raise ValueError(
            f"Required secret '{key}' not found in Docker Secrets or environment variables. "
            f"Set environment variable {key} or create secret file /run/secrets/{secret_file_name}"
        )

    return None


def get_database_config(
    host_override: Optional[str] = None,
    port_override: Optional[int] = None
) -> Dict[str, Any]:
    """
    Get standardized database configuration.

    Returns dictionary compatible with asyncpg, psycopg2, and SQLAlchemy.

    Args:
        host_override: Override POSTGRES_HOST (useful for localhost testing)
        port_override: Override POSTGRES_PORT (useful for external port testing)

    Returns:
        Dictionary with keys: host, port, database, user, password
    """
    return {
        "host": host_override or get_secret("POSTGRES_HOST", "postgres"),
        "port": int(port_override or get_secret("POSTGRES_PORT", "5432")),
        "database": get_secret("POSTGRES_DB", "musicdb"),
        "user": get_secret("POSTGRES_USER", "musicdb_user"),
        "password": get_secret("POSTGRES_PASSWORD", "musicdb_secure_pass_2024", required=True)
    }


def get_database_url(
    driver: str = "postgresql",
    async_driver: bool = False,
    host_override: Optional[str] = None,
    port_override: Optional[int] = None,
    use_connection_pool: bool = False
) -> str:
    """
    Get database connection URL string.

    Args:
        driver: Database driver ('postgresql', 'postgresql+asyncpg', etc.)
        async_driver: If True, uses asyncpg driver
        host_override: Override host (e.g., 'localhost' for testing)
        port_override: Override port (e.g., 5433 for external access)
        use_connection_pool: If True, uses db-connection-pool service

    Returns:
        Connection URL string
    """
    config = get_database_config(host_override, port_override)

    # Determine driver
    if async_driver and '+' not in driver:
        driver = f"{driver}+asyncpg"

    # Determine host (use connection pool if specified)
    host = "db-connection-pool" if use_connection_pool else config["host"]
    port = 6432 if use_connection_pool else config["port"]

    return (
        f"{driver}://{config['user']}:{config['password']}"
        f"@{host}:{port}/{config['database']}"
    )


def get_redis_config() -> Dict[str, Any]:
    """Get standardized Redis configuration."""
    return {
        "host": get_secret("REDIS_HOST", "redis"),
        "port": int(get_secret("REDIS_PORT", "6379")),
        "password": get_secret("REDIS_PASSWORD", "redis_secure_pass_2024"),
        "decode_responses": True
    }


def get_rabbitmq_config() -> Dict[str, Any]:
    """Get standardized RabbitMQ configuration."""
    return {
        "host": get_secret("RABBITMQ_HOST", "rabbitmq"),
        "port": int(get_secret("RABBITMQ_PORT", "5672")),
        "username": get_secret("RABBITMQ_USER", "musicdb_user"),
        "password": get_secret("RABBITMQ_PASS", "rabbitmq_secure_pass_2024"),
        "vhost": get_secret("RABBITMQ_VHOST", "musicdb")
    }


def get_rabbitmq_url() -> str:
    """Get RabbitMQ connection URL string."""
    config = get_rabbitmq_config()
    return (
        f"amqp://{config['username']}:{config['password']}"
        f"@{config['host']}:{config['port']}/{config['vhost']}"
    )


def get_api_keys() -> Dict[str, str]:
    """Get all API keys for external services."""
    return {
        "setlistfm": get_secret("SETLISTFM_API_KEY", ""),
        "spotify_client_id": get_secret("SPOTIFY_CLIENT_ID", ""),
        "spotify_client_secret": get_secret("SPOTIFY_CLIENT_SECRET", ""),
        "reddit_client_id": get_secret("REDDIT_CLIENT_ID", ""),
        "reddit_client_secret": get_secret("REDDIT_CLIENT_SECRET", ""),
        "tidal_client_id": get_secret("TIDAL_CLIENT_ID", ""),
        "tidal_client_secret": get_secret("TIDAL_CLIENT_SECRET", ""),
        "jwt_secret": get_secret("JWT_SECRET", ""),
        "api_key": get_secret("API_KEY", ""),
        "rapidapi_key": get_secret("RAPIDAPI_KEY", ""),
        "rapidapi_application": get_secret("RAPIDAPI_APPLICATION", ""),
        "rapidapi_host": get_secret("RAPIDAPI_HOST", "rapidapi.com")
    }


def get_infrastructure_passwords() -> Dict[str, str]:
    """Get infrastructure service passwords."""
    return {
        "grafana": get_secret("GRAFANA_PASSWORD", "admin"),
        "minio": get_secret("MINIO_ROOT_PASSWORD", ""),
        "pgbouncer": get_secret("PGBOUNCER_ADMIN_PASSWORD", "")
    }


def mask_secret(value: str, show_chars: int = 4) -> str:
    """
    Mask secret for safe logging.

    Args:
        value: Secret value to mask
        show_chars: Number of characters to show at end

    Returns:
        Masked string like "****cdef"
    """
    if not value or len(value) <= show_chars:
        return "****"

    return "*" * (len(value) - show_chars) + value[-show_chars:]


def validate_secrets() -> bool:
    """
    Validate all required secrets are available.

    Returns:
        True if all required secrets found, False otherwise
    """
    required_secrets = [
        "POSTGRES_PASSWORD",
        "POSTGRES_USER",
        "POSTGRES_DB"
    ]

    missing = []
    for secret_key in required_secrets:
        try:
            value = get_secret(secret_key, required=True)
            logger.info(f"✓ {secret_key}: {mask_secret(value)}")
        except ValueError:
            missing.append(secret_key)
            logger.error(f"✗ {secret_key}: MISSING")

    if missing:
        logger.error(f"Missing required secrets: {', '.join(missing)}")
        return False

    logger.info("✓ All required secrets validated")
    return True


# Convenience exports
__all__ = [
    'get_secret',
    'get_database_config',
    'get_database_url',
    'get_redis_config',
    'get_rabbitmq_config',
    'get_rabbitmq_url',
    'get_api_keys',
    'get_infrastructure_passwords',
    'mask_secret',
    'validate_secrets'
]