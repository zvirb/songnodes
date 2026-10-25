import os
import logging
from typing import Mapping, Dict

logger = logging.getLogger(__name__)

SCRAPER_ENV_ALLOWLIST = (
    # Database
    "DATABASE_URL", "DATABASE_HOST", "DATABASE_PORT", "DATABASE_USER", "DATABASE_PASSWORD", "DATABASE_NAME",
    "POSTGRES_HOST", "POSTGRES_PORT", "POSTGRES_USER", "POSTGRES_PASSWORD", "POSTGRES_DB",
    "DB_HOST", "DB_PORT", "DB_USER", "DB_PASSWORD", "DB_NAME",

    # Redis
    "REDIS_HOST", "REDIS_PORT", "REDIS_DB", "REDIS_PASSWORD",
    "SCRAPER_STATE_REDIS_HOST", "SCRAPER_STATE_REDIS_PORT", "SCRAPER_STATE_REDIS_DB", "SCRAPER_STATE_REDIS_PASSWORD",

    # Scraper behaviour
    "SCRAPER_SOURCE_TTL_DAYS", "SCRAPER_RUN_TTL_HOURS", "SCRAPER_FORCE_RUN", "SCRAPER_TIMEOUT",
    "BATCH_SIZE", "SKIP_ROBOTS_CHECK",

    # Service URLs & NLP
    "UNIFIED_SCRAPER_URL", "NLP_PROCESSOR_URL", "ENABLE_NLP_FALLBACK", "NLP_MIN_TRACK_THRESHOLD", "OLLAMA_URL",

    # RabbitMQ
    "RABBITMQ_HOST", "RABBITMQ_PORT", "RABBITMQ_USER", "RABBITMQ_PASS",

    # API keys
    "DISCOGS_TOKEN", "SETLISTFM_API_KEY", "SPOTIFY_CLIENT_ID", "SPOTIFY_CLIENT_SECRET", "LASTFM_API_KEY", "API_KEY_ENCRYPTION_SECRET",
    "TRACKLISTS_1001_USERNAME", "TRACKLISTS_1001_PASSWORD",

    # Runtime basics
    "PATH", "PYTHONPATH", "HOME", "LANG", "LC_ALL", "TZ", "LOG_LEVEL", "SCRAPERS_DIR",
    "SYSTEMROOT", "TEMP", "TMP"
)

SCRAPER_ENV_PREFIXES = (
    "SCRAPER_STATE_PREFIX",
    "TRACKLISTS_",
    "SETLISTFM_",
    "SCRAPER_", # For SCRAPER_MIXESDB_URL, etc.
    "PLAYWRIGHT_"
)

def build_scraper_env(base: Mapping[str, str]) -> Dict[str, str]:
    """
    Build a bounded environment for child scraper processes.
    Filters the base environment against an allowlist and prefix list.
    """
    env = {}
    missing_vars = []

    for key in SCRAPER_ENV_ALLOWLIST:
        if key in base:
            env[key] = base[key]
        else:
            missing_vars.append(key)

    # Include prefix matches
    for key, value in base.items():
        if key not in env:
            for prefix in SCRAPER_ENV_PREFIXES:
                if key.startswith(prefix):
                    env[key] = value
                    break

    # Log missing variables from the strict allowlist
    if missing_vars:
        logger.debug(f"Missing allowlisted environment variables for scraper subprocess: {', '.join(missing_vars)}")

    return env
