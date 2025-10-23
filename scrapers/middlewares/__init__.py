"""
SongNodes Scrapy Middlewares - Anti-Detection Framework
Specification Section IV Implementation

Middleware Stack (Priority Order):
- EnhancedRetryMiddleware (550): Exponential backoff for rate limits
- CaptchaSolvingMiddleware (600): Automated CAPTCHA detection and solving
- IntelligentProxyMiddleware (650): Proxy rotation with health monitoring
- DynamicHeaderMiddleware (700): Realistic browser header generation

All middlewares integrate with crawler.stats for shared state management
and implement comprehensive logging for diagnostics.
"""

from .headers_middleware import DynamicHeaderMiddleware
from .captcha_middleware import CaptchaSolvingMiddleware
from .retry_middleware import EnhancedRetryMiddleware
from .proxy_integration import ProxyMiddlewareIntegration

__all__ = [
    'DynamicHeaderMiddleware',
    'CaptchaSolvingMiddleware',
    'EnhancedRetryMiddleware',
    'ProxyMiddlewareIntegration',
]

__version__ = '1.0.0'
