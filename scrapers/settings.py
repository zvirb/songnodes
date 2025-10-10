import sys
print("SYS_PATH:", sys.path)

# CRITICAL: Enable asyncio reactor for scrapy-playwright support
TWISTED_REACTOR = "twisted.internet.asyncioreactor.AsyncioSelectorReactor"

# Scrapy settings for music_scraper project
#
# For simplicity, this file contains only settings considered important or
# commonly used. You can find more settings consulting the documentation:
#
#     https://docs.scrapy.org/en/latest/topics/settings.html
#     https://docs.scrapy.org/en/latest/topics/downloader-middleware.html
#     https://docs.scrapy.org/en/latest/topics/spider-middleware.html

BOT_NAME = 'scrapers'

SPIDER_MODULES = ['spiders']
NEWSPIDER_MODULE = 'spiders'

# Use realistic user agent to avoid bot detection
USER_AGENT = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

# Disable robots.txt to avoid restrictions
ROBOTSTXT_OBEY = False

# Reduce concurrent requests to avoid triggering rate limits
CONCURRENT_REQUESTS = 1

# Increase delays significantly to mimic human behavior and avoid CAPTCHA blocking
DOWNLOAD_DELAY = 90  # 90 seconds between requests to avoid IP bans
RANDOMIZE_DOWNLOAD_DELAY = 0.3  # 0.5 * to 1.5 * DOWNLOAD_DELAY (63-135 seconds)

# The download delay setting will honor only one of:
# CONCURRENT_REQUESTS_PER_DOMAIN = 1
# CONCURRENT_REQUESTS_PER_IP = 1

# Enable cookies to maintain session state
COOKIES_ENABLED = True

# Disable Telnet Console (enabled by default)
TELNETCONSOLE_ENABLED = False

# Override the default request headers to mimic browser behavior:
DEFAULT_REQUEST_HEADERS = {
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
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

# Enable or disable spider middlewares
# See https://docs.scrapy.org/en/latest/topics/spider-middleware.html
# SPIDER_MIDDLEWARES = {
#    'project_musicdb.middlewares.MusicScraperSpiderMiddleware': 543, # If you add middlewares
# }

# Enable or disable downloader middlewares
# See https://docs.scrapy.org/en/latest/topics/downloader-middleware.html
DOWNLOADER_MIDDLEWARES = {
    # Playwright download handler (newer scrapy-playwright versions use DOWNLOAD_HANDLERS instead)
}

# Download handlers for scrapy-playwright
DOWNLOAD_HANDLERS = {
    "http": "scrapy_playwright.handler.ScrapyPlaywrightDownloadHandler",
    "https": "scrapy_playwright.handler.ScrapyPlaywrightDownloadHandler",
}

# Enable or disable extensions
# See https://docs.scrapy.org/en/latest/topics/extensions.html
# EXTENSIONS = {
#    'scrapy.extensions.telnet.TelnetConsole': None,
# }

# Configure item pipelines
# See https://docs.scrapy.org/en/latest/topics/item-pipeline.html
ITEM_PIPELINES = {
   'pipelines.observability_wrapper_pipeline.ObservabilityWrapperPipeline': 50,  # Track scraping runs (FIRST)
   'pipelines.validation_pipeline.ValidationPipeline': 100,  # Validate items using Pydantic models
   'pipelines.enrichment_pipeline.EnrichmentPipeline': 200,  # Remix parsing, genre normalization
   'pipelines.api_enrichment_pipeline.APIEnrichmentPipeline': 250,  # General API enrichment (Spotify, MusicBrainz, Last.fm) for ALL tracks
   'nlp_fallback_pipeline.NLPFallbackPipeline': 260,  # NLP fallback for tracklist extraction
   'pipelines.persistence_pipeline.PersistencePipeline': 300,  # Modern persistence pipeline (asyncpg)
   'pipelines.discogs_enrichment_pipeline.DiscogsEnrichmentPipeline': 400,  # Framework Section 2.2: MixesDB→Discogs bridge
   'pipelines.reddit_validation_pipeline.RedditValidationPipeline': 450,  # Framework Section 2.4: Reddit→Spotify validation
}

# Enable and configure the AutoThrottle extension with conservative settings
AUTOTHROTTLE_ENABLED = True
# Start with longer delays to avoid anti-bot detection
AUTOTHROTTLE_START_DELAY = 90  # Match DOWNLOAD_DELAY
# Allow even longer delays if needed
AUTOTHROTTLE_MAX_DELAY = 300  # Up to 5 minutes between requests if needed
# Keep concurrency very low
AUTOTHROTTLE_TARGET_CONCURRENCY = 0.2  # Lower concurrency for gentler scraping
# Enable debugging to monitor throttling
AUTOTHROTTLE_DEBUG = True

# Enable and configure HTTP caching (disabled by default)
# See https://docs.scrapy.org/en/latest/topics/downloader-middleware.html#httpcache-middleware-settings
# HTTPCACHE_ENABLED = True
# HTTPCACHE_EXPIRATION_SECS = 0
# HTTPCACHE_DIR = 'httpcache'
# HTTPCACHE_IGNORE_HTTP_CODES =
# HTTPCACHE_STORAGE = 'scrapy.extensions.httpcache.FilesystemCacheStorage'

# Playwright settings for JavaScript rendering
# Set TRACKLISTS_1001_HEADLESS=False in docker-compose.yml for manual CAPTCHA solving
import os
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

# Logging settings [1, 2]
LOG_LEVEL = 'INFO' # DEBUG for more verbose output

# Retry settings - be more persistent with rate limiting
RETRY_TIMES = 5 # Number of times to retry failed requests
RETRY_HTTP_CODES = [500, 502, 503, 504, 522, 524, 408, 429, 403] # HTTP codes to retry (added 403 for rate limiting)

# Ollama Integration (Conceptual)
OLLAMA_HOST = 'http://ollama:11434' # Assuming 'ollama' is resolvable on 'skynet' network
OLLAMA_MODEL = 'nomad-embed-text:latest'

# NLP Fallback Configuration
ENABLE_NLP_FALLBACK = True  # Enable NLP fallback for all spiders
NLP_PROCESSOR_URL = 'http://nlp-processor:8021'  # NLP processor service URL
NLP_FALLBACK_TIMEOUT = 60  # Timeout for NLP processor requests (seconds)
NLP_MIN_TRACK_THRESHOLD = 3  # Minimum tracks before triggering NLP enrichment