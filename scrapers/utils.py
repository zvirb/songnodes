import os
import sys

# Try importing the orchestrator util, otherwise provide the same implementation
# because scrapers directory may be run standalone
try:
    # If run in a context where services is in PYTHONPATH
    sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../services/scraper-orchestrator')))
    from utils import build_scraper_env, SCRAPER_ENV_ALLOWLIST, SCRAPER_ENV_PREFIXES
except ImportError:
    # Standalone implementation identical to services/scraper-orchestrator/utils.py
    import logging
    from typing import Mapping, Dict

    logger = logging.getLogger(__name__)

    SCRAPER_ENV_ALLOWLIST = (
        "DATABASE_URL", "DATABASE_HOST", "DATABASE_PORT", "DATABASE_USER", "DATABASE_PASSWORD", "DATABASE_NAME",
        "POSTGRES_HOST", "POSTGRES_PORT", "POSTGRES_USER", "POSTGRES_PASSWORD", "POSTGRES_DB",
        "DB_HOST", "DB_PORT", "DB_USER", "DB_PASSWORD", "DB_NAME",
        "REDIS_HOST", "REDIS_PORT", "REDIS_DB", "REDIS_PASSWORD",
        "SCRAPER_STATE_REDIS_HOST", "SCRAPER_STATE_REDIS_PORT", "SCRAPER_STATE_REDIS_DB", "SCRAPER_STATE_REDIS_PASSWORD",
        "SCRAPER_SOURCE_TTL_DAYS", "SCRAPER_RUN_TTL_HOURS", "SCRAPER_FORCE_RUN", "SCRAPER_TIMEOUT",
        "BATCH_SIZE", "SKIP_ROBOTS_CHECK",
        "UNIFIED_SCRAPER_URL", "NLP_PROCESSOR_URL", "ENABLE_NLP_FALLBACK", "NLP_MIN_TRACK_THRESHOLD", "OLLAMA_URL",
        "RABBITMQ_HOST", "RABBITMQ_PORT", "RABBITMQ_USER", "RABBITMQ_PASS",
        "DISCOGS_TOKEN", "SETLISTFM_API_KEY", "SPOTIFY_CLIENT_ID", "SPOTIFY_CLIENT_SECRET", "LASTFM_API_KEY", "API_KEY_ENCRYPTION_SECRET",
        "TRACKLISTS_1001_USERNAME", "TRACKLISTS_1001_PASSWORD",
        "PATH", "PYTHONPATH", "HOME", "LANG", "LC_ALL", "TZ", "LOG_LEVEL", "SCRAPERS_DIR",
        "SYSTEMROOT", "TEMP", "TMP"
    )

    SCRAPER_ENV_PREFIXES = (
        "SCRAPER_STATE_PREFIX",
        "TRACKLISTS_",
        "SETLISTFM_",
        "SCRAPER_",
        "PLAYWRIGHT_"
    )

    def build_scraper_env(base: Mapping[str, str]) -> Dict[str, str]:
        env = {}
        missing_vars = []
        for key in SCRAPER_ENV_ALLOWLIST:
            if key in base:
                env[key] = base[key]
            else:
                missing_vars.append(key)
        for key, value in base.items():
            if key not in env:
                for prefix in SCRAPER_ENV_PREFIXES:
                    if key.startswith(prefix):
                        env[key] = value
                        break
        if missing_vars:
            logger.debug(f"Missing allowlisted environment variables for scraper subprocess: {', '.join(missing_vars)}")
        return env
