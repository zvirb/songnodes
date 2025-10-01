"""
Production settings for SongNodes scrapers.

Optimized for production deployment:
- High concurrency with resource limits
- Conservative logging
- No caching
- Aggressive AutoThrottle
- Full monitoring enabled
"""
from .base import *

# ============================================================================
# PRODUCTION OPTIMIZATIONS
# ============================================================================

# Production logging (INFO level, no DEBUG spam)
LOG_LEVEL = 'INFO'

# Higher concurrency for throughput (with AutoThrottle protection)
CONCURRENT_REQUESTS = 32
CONCURRENT_REQUESTS_PER_DOMAIN = 2  # Still conservative per domain

# Production delays (AutoThrottle will adjust dynamically)
DOWNLOAD_DELAY = 3
AUTOTHROTTLE_START_DELAY = 3
AUTOTHROTTLE_MAX_DELAY = 120  # Up to 2 minutes if server is slow
AUTOTHROTTLE_TARGET_CONCURRENCY = 2.0  # Higher throughput target
AUTOTHROTTLE_DEBUG = False  # Disable verbose throttle logs

# ============================================================================
# NO HTTP CACHING IN PRODUCTION (Always fetch fresh data)
# ============================================================================

HTTPCACHE_ENABLED = False

# ============================================================================
# PRODUCTION DATABASE (Container network)
# ============================================================================

# Use container service names (resolved by Docker network)
DATABASE_HOST = 'postgres'
DATABASE_PORT = 5432  # Internal container port
REDIS_HOST = 'redis'
REDIS_PORT = 6379  # Internal container port

# ============================================================================
# AGGRESSIVE RETRY SETTINGS (Resilience for production)
# ============================================================================

RETRY_TIMES = 10  # More retries for transient failures
RETRY_HTTP_CODES = [500, 502, 503, 504, 522, 524, 408, 429, 403]

# ============================================================================
# PLAYWRIGHT (Headless for production)
# ============================================================================

PLAYWRIGHT_LAUNCH_OPTIONS = {
    'headless': True,  # Always headless in production
    'args': [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-software-rasterizer',
        '--single-process',
        '--disable-extensions',
        '--disable-background-networking',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-breakpad',
        '--disable-component-extensions-with-background-pages',
        '--disable-features=TranslateUI',
        '--disable-ipc-flooding-protection',
        '--disable-renderer-backgrounding',
        '--force-color-profile=srgb',
        '--metrics-recording-only',
        '--mute-audio',
    ]
}

# Playwright context limits (prevent memory leaks)
PLAYWRIGHT_MAX_CONTEXTS = 5
PLAYWRIGHT_MAX_PAGES_PER_CONTEXT = 3

# ============================================================================
# MONITORING (Full observability in production)
# ============================================================================

PROMETHEUS_ENABLED = True
PROMETHEUS_PORT = 9091

# ============================================================================
# PRODUCTION EXTENSIONS (No telnet console)
# ============================================================================

EXTENSIONS = {
    'scrapy.extensions.telnet.TelnetConsole': None,  # Disabled in production
    'scrapy.extensions.corestats.CoreStats': 500,
    'scrapy.extensions.memusage.MemoryUsage': 500,
    'scrapy.extensions.logstats.LogStats': 500,
}

# Production memory limits (stricter)
MEMUSAGE_LIMIT_MB = 4096  # 4GB hard limit
MEMUSAGE_WARNING_MB = 3072  # Warning at 3GB

# ============================================================================
# PRODUCTION SECURITY
# ============================================================================

# Disable telnet completely
TELNETCONSOLE_ENABLED = False

# ============================================================================
# PRODUCTION CLOSESPIDER SETTINGS (Resource protection)
# ============================================================================

# Close spider after processing limits (prevent runaway spiders)
CLOSESPIDER_TIMEOUT = 3600  # 1 hour max runtime
CLOSESPIDER_ITEMCOUNT = 100000  # Max 100k items per run
CLOSESPIDER_PAGECOUNT = 50000  # Max 50k pages per run
CLOSESPIDER_ERRORCOUNT = 1000  # Close if 1000 errors

# ============================================================================
# PRODUCTION FEED EXPORT (Optional: Export to S3/MinIO)
# ============================================================================

# Uncomment for production data exports:
# FEEDS = {
#     's3://songnodes-scraped-data/%(name)s/%(time)s.jsonl': {
#         'format': 'jsonlines',
#         'encoding': 'utf8',
#         'store_empty': False,
#         'fields': None,
#         'indent': None,
#     }
# }

print("🚀 Production settings loaded")
print(f"   CONCURRENT_REQUESTS: {CONCURRENT_REQUESTS}")
print(f"   AUTOTHROTTLE_TARGET_CONCURRENCY: {AUTOTHROTTLE_TARGET_CONCURRENCY}")
print(f"   PROMETHEUS_ENABLED: {PROMETHEUS_ENABLED}")
