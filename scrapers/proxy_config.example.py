"""
Example Proxy Configuration for Scrapers
Copy this file to proxy_config.py and add your actual proxy credentials.

IMPORTANT: Never commit proxy_config.py to version control!
Add it to .gitignore.
"""

# Example proxy list configuration
PROXY_LIST = [
    # Free proxies (not recommended for production)
    # {
    #     'url': '123.45.67.89:8080',
    #     'protocol': 'http'
    # },

    # Authenticated proxies (recommended)
    # {
    #     'url': 'proxy-server.com:8080',
    #     'protocol': 'http',
    #     'username': 'your_username',
    #     'password': 'your_password'
    # },

    # SOCKS5 proxies
    # {
    #     'url': 'socks-proxy.com:1080',
    #     'protocol': 'socks5',
    #     'username': 'your_username',
    #     'password': 'your_password'
    # },

    # Rotating residential proxies (recommended for music platforms)
    # {
    #     'url': 'rotating.residentialproxy.com:8080',
    #     'protocol': 'http',
    #     'username': 'session-12345',  # Session-based rotation
    #     'password': 'your_api_key'
    # },
]

# Proxy service recommendations for music scraping:
#
# 1. Bright Data (formerly Luminati) - Premium residential proxies
#    - Excellent for Spotify, SoundCloud, YouTube
#    - Rotating residential IPs
#    - https://brightdata.com/
#
# 2. Smartproxy - Affordable residential proxies
#    - Good for general web scraping
#    - https://smartproxy.com/
#
# 3. Oxylabs - Enterprise-grade proxies
#    - High success rates
#    - https://oxylabs.io/
#
# 4. Proxy-Cheap - Budget-friendly option
#    - Datacenter and residential
#    - https://www.proxy-cheap.com/
#
# 5. SOCKS5 proxies for API scraping
#    - Better for structured API requests
#    - Lower detection risk

# Scrapy settings for proxy middleware
PROXY_SETTINGS = {
    # Enable proxy middleware
    'ENABLE_PROXIES': True,

    # Proxy selection strategy
    # Options: 'random', 'round_robin', 'performance', 'least_used'
    'PROXY_STRATEGY': 'performance',

    # Health check settings
    'PROXY_HEALTH_CHECK_INTERVAL': 300,  # 5 minutes
    'PROXY_ENABLE_HEALTH_CHECKS': True,

    # Failure handling
    'PROXY_MAX_FAILURES': 3,  # Max consecutive failures before marking failed
    'PROXY_COOLDOWN_PERIOD': 600,  # 10 minutes cooldown for failed proxies

    # Retry settings
    'MAX_PROXY_RETRIES': 3,  # Max retries with different proxies
    'RETRY_WITH_NEW_PROXY': True,  # Auto-retry with new proxy on failure

    # User agent rotation
    'USER_AGENT_STRATEGY': 'random',  # or 'round_robin'

    # Scrapy middleware configuration
    'DOWNLOADER_MIDDLEWARES': {
        'scrapy.downloadermiddlewares.useragent.UserAgentMiddleware': None,
        'scrapy.downloadermiddlewares.retry.RetryMiddleware': None,
        'middlewares.proxy_middleware.ProxyRotationMiddleware': 543,
    }
}

# Environment-specific configurations
PROXY_CONFIG_BY_ENV = {
    'development': {
        'ENABLE_PROXIES': False,  # No proxies in development
        'USER_AGENT_STRATEGY': 'random'
    },
    'staging': {
        'ENABLE_PROXIES': True,
        'PROXY_STRATEGY': 'random',  # Less aggressive in staging
        'PROXY_HEALTH_CHECK_INTERVAL': 600
    },
    'production': {
        'ENABLE_PROXIES': True,
        'PROXY_STRATEGY': 'performance',  # Best proxies for production
        'PROXY_HEALTH_CHECK_INTERVAL': 300,
        'MAX_PROXY_RETRIES': 5  # More retries in production
    }
}

# Platform-specific proxy strategies
PLATFORM_PROXY_STRATEGIES = {
    # Use best proxies for rate-limited platforms
    'spotify': {
        'PROXY_STRATEGY': 'performance',
        'DOWNLOAD_DELAY': 2.0,
        'MAX_PROXY_RETRIES': 5
    },
    'soundcloud': {
        'PROXY_STRATEGY': 'performance',
        'DOWNLOAD_DELAY': 1.5,
        'MAX_PROXY_RETRIES': 3
    },
    'youtube': {
        'PROXY_STRATEGY': 'least_used',  # Distribute load
        'DOWNLOAD_DELAY': 1.0,
        'MAX_PROXY_RETRIES': 3
    },
    # Less aggressive for open platforms
    '1001tracklists': {
        'PROXY_STRATEGY': 'random',
        'DOWNLOAD_DELAY': 2.5,
        'MAX_PROXY_RETRIES': 2
    },
    'mixesdb': {
        'PROXY_STRATEGY': 'round_robin',
        'DOWNLOAD_DELAY': 2.0,
        'MAX_PROXY_RETRIES': 2
    }
}