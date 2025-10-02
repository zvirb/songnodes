"""
Base Scrapy settings for SongNodes project.

Core, environment-agnostic configuration.
All settings here apply to both development and production unless overridden.
"""
import os

# ============================================================================
# CORE PROJECT SETTINGS
# ============================================================================

BOT_NAME = 'songnodes_scrapers'

SPIDER_MODULES = ['spiders.aggregators', 'spiders.community', 'spiders.stores', 'spiders.events', 'spiders']
NEWSPIDER_MODULE = 'spiders'

# ============================================================================
# BROWSER AUTOMATION (scrapy-playwright)
# ============================================================================

# CRITICAL: Enable asyncio reactor for scrapy-playwright support
TWISTED_REACTOR = "twisted.internet.asyncioreactor.AsyncioSelectorReactor"

# Download handlers for scrapy-playwright
DOWNLOAD_HANDLERS = {
    "http": "scrapy_playwright.handler.ScrapyPlaywrightDownloadHandler",
    "https": "scrapy_playwright.handler.ScrapyPlaywrightDownloadHandler",
}

# Playwright browser configuration
PLAYWRIGHT_BROWSER_TYPE = 'chromium'
PLAYWRIGHT_LAUNCH_OPTIONS = {
    'headless': os.getenv('TRACKLISTS_1001_HEADLESS', 'True').lower() == 'true',
    'args': [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-software-rasterizer',
        '--single-process',  # Helps in containerized environments
    ]
}

# ============================================================================
# ANTI-DETECTION & EVASION FRAMEWORK
# ============================================================================

# Disable robots.txt for data acquisition targets
ROBOTSTXT_OBEY = False

# Enable cookies to maintain session state
COOKIES_ENABLED = True

# Default user agent (overridden by DynamicHeaderMiddleware)
USER_AGENT = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

# Default request headers (overridden by DynamicHeaderMiddleware per-request)
DEFAULT_REQUEST_HEADERS = {
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'DNT': '1',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Linux"'
}

# ============================================================================
# DOWNLOADER MIDDLEWARES (Multi-Layered Evasion Framework)
# Spec Section IV - Priority order is critical!
# ============================================================================

DOWNLOADER_MIDDLEWARES = {
    # Disable default user-agent middleware (replaced by DynamicHeaderMiddleware)
    'scrapy.downloadermiddlewares.useragent.UserAgentMiddleware': None,

    # Custom middleware stack (ordered by priority - lower runs first)
    'middlewares.retry_middleware.EnhancedRetryMiddleware': 550,          # Spec priority: 550
    'middlewares.captcha_middleware.CaptchaSolvingMiddleware': 600,       # Spec priority: 600
    'middlewares.proxy_middleware.IntelligentProxyMiddleware': 650,       # Spec priority: 650
    'middlewares.headers_middleware.DynamicHeaderMiddleware': 700,        # Spec priority: 700
    'scrapy.downloadermiddlewares.httpproxy.HttpProxyMiddleware': 750,    # Spec priority: 750
}

# ============================================================================
# SPIDER MIDDLEWARES (Processing spider output)
# ============================================================================

SPIDER_MIDDLEWARES = {
    # Backward compatibility layer for ItemLoader migration
    # Automatically fixes items from old spiders that don't use ItemLoaders
    'compat.BackwardCompatibilityMiddleware': 100,
}

# Compatibility middleware configuration
COMPAT_MIDDLEWARE_ENABLED = True  # Enable automatic compatibility fixes
COMPAT_MIDDLEWARE_LOG_FIXES = True  # Log when fixes are applied
COMPAT_MIDDLEWARE_STATS = True  # Track migration statistics

# ============================================================================
# ITEM PIPELINES (Separation of Concerns)
# Spec Section VI - Validation → Enrichment → Persistence
# ============================================================================

ITEM_PIPELINES = {
    'pipelines.validation_pipeline.ValidationPipeline': 100,       # Holistic validation
    'pipelines.enrichment_pipeline.EnrichmentPipeline': 200,       # NLP, fuzzy matching, external data
    'pipelines.persistence_pipeline.PersistencePipeline': 300,     # Database upsert
}

# ============================================================================
# CONCURRENCY & POLITENESS (Environment-agnostic defaults)
# Spec Section VII - Override in spider custom_settings for target-specific tuning
# ============================================================================

# IMPORTANT: These are DEFAULTS only. Each spider MUST define custom_settings
# with target-specific values to prevent cross-contamination.

CONCURRENT_REQUESTS = 16  # Global default (individual spiders override this)
CONCURRENT_REQUESTS_PER_DOMAIN = 1  # Conservative default
DOWNLOAD_DELAY = 2  # Default delay (spiders override for specific targets)
RANDOMIZE_DOWNLOAD_DELAY = True

# ============================================================================
# AUTOTHROTTLE EXTENSION (Adaptive Rate Limiting)
# Spec Section VII.1 - Mandatory for production
# ============================================================================

AUTOTHROTTLE_ENABLED = True
AUTOTHROTTLE_START_DELAY = 2  # Default starting delay
AUTOTHROTTLE_MAX_DELAY = 60  # Maximum delay
AUTOTHROTTLE_TARGET_CONCURRENCY = 1.0  # Target requests in flight
AUTOTHROTTLE_DEBUG = False  # Enable in development.py

# ============================================================================
# RETRY SETTINGS (Resilience)
# Spec Section IV - RetryMiddleware configuration
# ============================================================================

RETRY_ENABLED = True
RETRY_TIMES = 5  # Maximum retry attempts
RETRY_HTTP_CODES = [500, 502, 503, 504, 522, 524, 408, 429, 403]  # Include rate limit codes

# ============================================================================
# NLP FALLBACK CONFIGURATION
# ============================================================================

ENABLE_NLP_FALLBACK = True
NLP_PROCESSOR_URL = 'http://nlp-processor:8086'
NLP_FALLBACK_TIMEOUT = 60
NLP_MIN_TRACK_THRESHOLD = 3

# ============================================================================
# MONITORING & OBSERVABILITY
# Spec Section VII.2 - Production monitoring requirements
# ============================================================================

# Prometheus metrics endpoint
PROMETHEUS_ENABLED = os.getenv('PROMETHEUS_ENABLED', 'true').lower() == 'true'
PROMETHEUS_PORT = int(os.getenv('PROMETHEUS_PORT', '9091'))

# Stats collection
STATS_CLASS = 'scrapy.statscollectors.MemoryStatsCollector'

# ============================================================================
# LOGGING
# ============================================================================

LOG_LEVEL = 'INFO'  # Override in development.py for DEBUG
LOG_FORMAT = '%(asctime)s [%(name)s] %(levelname)s: %(message)s'
LOG_DATEFORMAT = '%Y-%m-%d %H:%M:%S'

# ============================================================================
# EXTENSIONS
# ============================================================================

EXTENSIONS = {
    'scrapy.extensions.telnet.TelnetConsole': None,  # Disable telnet
    'scrapy.extensions.corestats.CoreStats': 500,
    'scrapy.extensions.memusage.MemoryUsage': 500,
}

# Memory usage thresholds (MB)
MEMUSAGE_LIMIT_MB = 2048  # 2GB limit
MEMUSAGE_WARNING_MB = 1536  # Warning at 1.5GB

# ============================================================================
# HTTP CACHING (Disabled by default, enable in development)
# ============================================================================

HTTPCACHE_ENABLED = False
HTTPCACHE_EXPIRATION_SECS = 0
HTTPCACHE_DIR = 'httpcache'
HTTPCACHE_IGNORE_HTTP_CODES = [500, 502, 503, 504]
HTTPCACHE_STORAGE = 'scrapy.extensions.httpcache.FilesystemCacheStorage'

# ============================================================================
# CAPTCHA SOLVING CONFIGURATION (Spec Section IV.2)
# ============================================================================

# Enable CAPTCHA solving middleware
CAPTCHA_ENABLED = os.getenv('CAPTCHA_ENABLED', 'false').lower() == 'true'

# Primary CAPTCHA provider (2captcha, anticaptcha)
CAPTCHA_BACKEND = os.getenv('CAPTCHA_BACKEND', '2captcha')

# API keys for CAPTCHA services
CAPTCHA_API_KEY = os.getenv('CAPTCHA_API_KEY', os.getenv('CAPTCHA_2CAPTCHA_API_KEY'))

# Fallback provider configuration
CAPTCHA_FALLBACK_PROVIDER = os.getenv('CAPTCHA_FALLBACK_PROVIDER', 'anticaptcha')
CAPTCHA_FALLBACK_API_KEY = os.getenv('CAPTCHA_ANTICAPTCHA_API_KEY')

# Budget control (USD) - prevents excessive spending
CAPTCHA_BUDGET_LIMIT = float(os.getenv('CAPTCHA_BUDGET_LIMIT', '100.0'))
CAPTCHA_MAX_DAILY_BUDGET = float(os.getenv('CAPTCHA_MAX_DAILY_BUDGET', '100.0'))

# Retry and timeout settings
CAPTCHA_MAX_RETRIES = int(os.getenv('CAPTCHA_MAX_RETRIES', '3'))
CAPTCHA_TIMEOUT = int(os.getenv('CAPTCHA_TIMEOUT', '120'))  # seconds

# Mock backend (development/testing only)
CAPTCHA_ALLOW_MOCK = os.getenv('CAPTCHA_ALLOW_MOCK', 'false').lower() == 'true'

# ============================================================================
# OLLAMA INTEGRATION (Conceptual - for future AI-based parsing)
# ============================================================================

OLLAMA_HOST = os.getenv('OLLAMA_HOST', 'http://ollama:11434')
OLLAMA_MODEL = os.getenv('OLLAMA_MODEL', 'nomad-embed-text:latest')
