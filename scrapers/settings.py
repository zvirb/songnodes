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

# Crawl responsibly by identifying yourself (and your website) on the user-agent
# Be a good internet citizen. Identify your bot and provide a contact.
USER_AGENT = 'SongNodes MixesDB Scraper/1.0 (+https://github.com/your-project/songnodes; contact@songnodes.com)'

# Obey robots.txt rules
ROBOTSTXT_OBEY = True # [1, 2]

# Configure maximum concurrent requests performed by Scrapy (default: 16)
CONCURRENT_REQUESTS = 1 # Single request at a time for MixesDB politeness

# Configure a delay for requests for the same website (default: 0)
# See https://docs.scrapy.org/en/latest/topics/settings.html#download-delay
# See also autothrottle settings and docs
DOWNLOAD_DELAY = 1.5 # 1.5 seconds between requests for 1001tracklists
RANDOMIZE_DOWNLOAD_DELAY = 0.5 # Randomize delay by 0.5 * to 1.5 * delay

# The download delay setting will honor only one of:
# CONCURRENT_REQUESTS_PER_DOMAIN = 1
# CONCURRENT_REQUESTS_PER_IP = 1

# Disable cookies (enabled by default)
# COOKIES_ENABLED = False

# Disable Telnet Console (enabled by default)
# TELNETCONSOLE_ENABLED = False

# Override the default request headers:
# DEFAULT_REQUEST_HEADERS = {
#   'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
#   'Accept-Language': 'en',
# }

# Enable or disable spider middlewares
# See https://docs.scrapy.org/en/latest/topics/spider-middleware.html
# SPIDER_MIDDLEWARES = {
#    'project_musicdb.middlewares.MusicScraperSpiderMiddleware': 543, # If you add middlewares
# }

# Enable or disable downloader middlewares
# See https://docs.scrapy.org/en/latest/topics/downloader-middleware.html
DOWNLOADER_MIDDLEWARES = {
    'middlewares.PoliteDownloaderMiddleware': 100,
    'middlewares.RobotsTxtComplianceMiddleware': 200,
    'middlewares.EnhancedRetryMiddleware': 550,
    'scrapy.downloadermiddlewares.retry.RetryMiddleware': None,  # Disable default retry
}

# Enable or disable extensions
# See https://docs.scrapy.org/en/latest/topics/extensions.html
# EXTENSIONS = {
#    'scrapy.extensions.telnet.TelnetConsole': None,
# }

# Configure item pipelines
# See https://docs.scrapy.org/en/latest/topics/item-pipeline.html
ITEM_PIPELINES = {
   'pipelines.MusicDataPipeline': 300,
}

# Enable and configure the AutoThrottle extension (disabled by default)
# See https://docs.scrapy.org/en/latest/topics/autothrottle.html
AUTOTHROTTLE_ENABLED = True
# The initial download delay
AUTOTHROTTLE_START_DELAY = 5
# The maximum download delay to be set in case of high latencies or low available bandwidth.
AUTOTHROTTLE_MAX_DELAY = 60
# The average number of requests Scrapy should be sending in parallel to
# each remote server
AUTOTHROTTLE_TARGET_CONCURRENCY = 1.0
# Enable showing throttling stats for every response received:
AUTOTHROTTLE_DEBUG = False

# Enable and configure HTTP caching (disabled by default)
# See https://docs.scrapy.org/en/latest/topics/downloader-middleware.html#httpcache-middleware-settings
# HTTPCACHE_ENABLED = True
# HTTPCACHE_EXPIRATION_SECS = 0
# HTTPCACHE_DIR = 'httpcache'
# HTTPCACHE_IGNORE_HTTP_CODES =
# HTTPCACHE_STORAGE = 'scrapy.extensions.httpcache.FilesystemCacheStorage'

# Logging settings [1, 2]
LOG_LEVEL = 'INFO' # DEBUG for more verbose output

# Retry settings [1, 2]
RETRY_TIMES = 3 # Number of times to retry failed requests
RETRY_HTTP_CODES = [500, 502, 503, 504, 522, 524, 408, 429] # HTTP codes to retry

# Ollama Integration (Conceptual)
OLLAMA_HOST = 'http://ollama:11434' # Assuming 'ollama' is resolvable on 'skynet' network
OLLAMA_MODEL = 'nomad-embed-text:latest'