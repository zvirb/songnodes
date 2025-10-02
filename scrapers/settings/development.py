"""
Development settings for SongNodes scrapers.

Overrides base settings for local development:
- Lower concurrency for easier debugging
- Verbose logging
- HTTP caching enabled
- Shorter delays for faster iteration
"""
from .base import *

# ============================================================================
# DEVELOPMENT-SPECIFIC OVERRIDES
# ============================================================================

# Verbose logging for debugging
LOG_LEVEL = 'DEBUG'

# Lower concurrency for easier debugging and log following
CONCURRENT_REQUESTS = 4
CONCURRENT_REQUESTS_PER_DOMAIN = 1

# Shorter delays for faster development iteration
DOWNLOAD_DELAY = 1
AUTOTHROTTLE_START_DELAY = 1
AUTOTHROTTLE_MAX_DELAY = 10
AUTOTHROTTLE_DEBUG = True  # Show throttle adjustments

# ============================================================================
# HTTP CACHING (Enabled for development to avoid re-scraping)
# ============================================================================

HTTPCACHE_ENABLED = True
HTTPCACHE_EXPIRATION_SECS = 3600  # 1 hour cache
HTTPCACHE_DIR = '.httpcache_dev'
HTTPCACHE_IGNORE_HTTP_CODES = [500, 502, 503, 504]
HTTPCACHE_STORAGE = 'scrapy.extensions.httpcache.FilesystemCacheStorage'

# ============================================================================
# DEVELOPMENT DATABASE (Local instance)
# ============================================================================

# Connect to localhost ports (not container names)
DATABASE_HOST = 'localhost'
DATABASE_PORT = 5433  # External port from docker-compose
REDIS_HOST = 'localhost'
REDIS_PORT = 6380  # External port from docker-compose

# ============================================================================
# RELAXED RETRY SETTINGS (Fail fast for debugging)
# ============================================================================

RETRY_TIMES = 2  # Fewer retries for faster failure feedback

# ============================================================================
# PLAYWRIGHT (Visible browser for debugging)
# ============================================================================

# Override headless mode for visual debugging
PLAYWRIGHT_LAUNCH_OPTIONS = {
    'headless': True,  # Must be True for Docker containers (no display available)
    'args': [
        '--no-sandbox',
        '--disable-setuid-sandbox',
    ],
    'slow_mo': 100,  # Slow down for observation (100ms per action)
}

# ============================================================================
# MONITORING (Disabled in dev for simplicity)
# ============================================================================

PROMETHEUS_ENABLED = False

# ============================================================================
# DEVELOPMENT TELNET CONSOLE (Enabled for debugging)
# ============================================================================

EXTENSIONS = {
    'scrapy.extensions.telnet.TelnetConsole': 500,  # Enable telnet
    'scrapy.extensions.corestats.CoreStats': 500,
    'scrapy.extensions.memusage.MemoryUsage': 500,
}

TELNETCONSOLE_ENABLED = False  # Disabled to avoid port range errors in containers
# TELNETCONSOLE_PORT = 6023  # Use single port if re-enabling

# ============================================================================
# DEVELOPMENT DOWNLOADER MIDDLEWARES (Disable missing middlewares)
# ============================================================================

# Override base settings to disable missing middleware modules
# All custom middlewares disabled for development (missing dependencies)
DOWNLOADER_MIDDLEWARES = {
    'scrapy.downloadermiddlewares.useragent.UserAgentMiddleware': None,
    # Disable missing middlewares for development
    # 'middlewares.retry_middleware.EnhancedRetryMiddleware': None,
    # 'middlewares.captcha_middleware.CaptchaSolvingMiddleware': None,
    # 'middlewares.proxy_middleware.IntelligentProxyMiddleware': None,  # Requires aiohttp
    # 'middlewares.headers_middleware.DynamicHeaderMiddleware': None,
    # 'scrapy.downloadermiddlewares.httpproxy.HttpProxyMiddleware': 750,
}

# Use the same pipeline as production (single source of truth per CLAUDE.md)
# Development uses base.py settings - no override needed
# ITEM_PIPELINES defined in base.py

# ============================================================================
# DEVELOPMENT ITEM PIPELINES (Optional: Disable persistence for testing)
# ============================================================================

# Uncomment to test without database writes:
# ITEM_PIPELINES = {
#     'pipelines.validation_pipeline.ValidationPipeline': 100,
#     'pipelines.enrichment_pipeline.EnrichmentPipeline': 200,
#     # 'pipelines.persistence_pipeline.PersistencePipeline': 300,  # Disabled
# }

print("🔧 Development settings loaded")
print(f"   LOG_LEVEL: {LOG_LEVEL}")
print(f"   HTTPCACHE_ENABLED: {HTTPCACHE_ENABLED}")
print(f"   PLAYWRIGHT headless: {PLAYWRIGHT_LAUNCH_OPTIONS['headless']}")
