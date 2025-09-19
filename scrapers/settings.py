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

# Increase delays significantly to mimic human behavior
DOWNLOAD_DELAY = 10
RANDOMIZE_DOWNLOAD_DELAY = 0.8  # 0.5 * to 1.5 * DOWNLOAD_DELAY

# The download delay setting will honor only one of:
# CONCURRENT_REQUESTS_PER_DOMAIN = 1
# CONCURRENT_REQUESTS_PER_IP = 1

# Enable cookies to maintain session state
COOKIES_ENABLED = True

# Disable Telnet Console (enabled by default)
# TELNETCONSOLE_ENABLED = False

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
# DOWNLOADER_MIDDLEWARES = {
#    'music_scraper.middlewares.MusicScraperDownloaderMiddleware': 543,
# }

# Enable or disable extensions
# See https://docs.scrapy.org/en/latest/topics/extensions.html
# EXTENSIONS = {
#    'scrapy.extensions.telnet.TelnetConsole': None,
# }

# Configure item pipelines
# See https://docs.scrapy.org/en/latest/topics/item-pipeline.html
# ITEM_PIPELINES = {
#    'database_pipeline.EnhancedMusicDatabasePipeline': 300,
# }

# Enable and configure the AutoThrottle extension with conservative settings
AUTOTHROTTLE_ENABLED = True
# Start with longer delays
AUTOTHROTTLE_START_DELAY = 15
# Allow even longer delays if needed
AUTOTHROTTLE_MAX_DELAY = 120
# Keep concurrency very low
AUTOTHROTTLE_TARGET_CONCURRENCY = 0.5
# Enable debugging to monitor throttling
AUTOTHROTTLE_DEBUG = True

# Enable and configure HTTP caching (disabled by default)
# See https://docs.scrapy.org/en/latest/topics/downloader-middleware.html#httpcache-middleware-settings
# HTTPCACHE_ENABLED = True
# HTTPCACHE_EXPIRATION_SECS = 0
# HTTPCACHE_DIR = 'httpcache'
# HTTPCACHE_IGNORE_HTTP_CODES =
# HTTPCACHE_STORAGE = 'scrapy.extensions.httpcache.FilesystemCacheStorage'

# Logging settings [1, 2]
LOG_LEVEL = 'INFO' # DEBUG for more verbose output

# Retry settings - be more persistent with rate limiting
RETRY_TIMES = 5 # Number of times to retry failed requests
RETRY_HTTP_CODES = [500, 502, 503, 504, 522, 524, 408, 429, 403] # HTTP codes to retry (added 403 for rate limiting)

# Ollama Integration (Conceptual)
OLLAMA_HOST = 'http://ollama:11434' # Assuming 'ollama' is resolvable on 'skynet' network
OLLAMA_MODEL = 'nomad-embed-text:latest'