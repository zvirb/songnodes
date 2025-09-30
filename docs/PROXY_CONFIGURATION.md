# Proxy and User-Agent Management

## Overview

The SongNodes scraping infrastructure includes sophisticated proxy rotation and user-agent management to ensure reliable data collection while avoiding rate limits and blocks.

## Features

### ✅ Proxy Management
- **Automatic Rotation**: Intelligent proxy selection across multiple strategies
- **Health Monitoring**: Continuous health checks with automatic failover
- **Performance Tracking**: Success rate and response time metrics
- **Smart Retry**: Automatic retry with different proxy on failure
- **Cooldown Periods**: Failed proxies are temporarily disabled

### ✅ User-Agent Rotation
- **Realistic User Agents**: Modern browser strings (Chrome, Firefox, Safari, Edge)
- **Multiple Strategies**: Random or round-robin selection
- **Usage Statistics**: Track distribution across user agents

## Architecture

```
Request Flow:
┌──────────────┐
│   Spider     │
└──────┬───────┘
       │
       ▼
┌──────────────────────────────────┐
│  ProxyRotationMiddleware         │
│  - Select proxy (strategy-based) │
│  - Rotate user agent             │
│  - Track request start time      │
└──────┬───────────────────────────┘
       │
       ▼
┌──────────────────────────────────┐
│  Request Execution               │
│  - HTTP/HTTPS/SOCKS5             │
│  - With proxy authentication     │
└──────┬───────────────────────────┘
       │
       ▼
┌──────────────────────────────────┐
│  Response Processing             │
│  - Record success/failure        │
│  - Update proxy metrics          │
│  - Retry on failure (optional)   │
└──────────────────────────────────┘
```

## Configuration

### Basic Setup

1. **Copy example configuration**:
```bash
cd scrapers
cp proxy_config.example.py proxy_config.py
```

2. **Add proxies to `proxy_config.py`**:
```python
PROXY_LIST = [
    {
        'url': 'proxy1.example.com:8080',
        'protocol': 'http',
        'username': 'user',
        'password': 'pass'
    },
    {
        'url': 'proxy2.example.com:8080',
        'protocol': 'http',
        'username': 'user',
        'password': 'pass'
    }
]
```

3. **Add to `.gitignore`**:
```bash
echo "scrapers/proxy_config.py" >> .gitignore
```

### Scrapy Integration

Update `settings.py` in your scraper:

```python
from proxy_config import PROXY_LIST, PROXY_SETTINGS

# Enable proxy middleware
ENABLE_PROXIES = True
PROXY_LIST = PROXY_LIST

# Proxy selection strategy
PROXY_STRATEGY = 'performance'  # 'random', 'round_robin', 'performance', 'least_used'

# Health checking
PROXY_HEALTH_CHECK_INTERVAL = 300  # 5 minutes
PROXY_ENABLE_HEALTH_CHECKS = True
PROXY_MAX_FAILURES = 3
PROXY_COOLDOWN_PERIOD = 600  # 10 minutes

# Retry configuration
MAX_PROXY_RETRIES = 3
RETRY_WITH_NEW_PROXY = True

# User agent rotation
USER_AGENT_STRATEGY = 'random'  # or 'round_robin'

# Middleware configuration
DOWNLOADER_MIDDLEWARES = {
    'scrapy.downloadermiddlewares.useragent.UserAgentMiddleware': None,
    'middlewares.proxy_middleware.ProxyRotationMiddleware': 543,
}
```

## Proxy Selection Strategies

### 1. Performance-Based (Recommended)
```python
PROXY_STRATEGY = 'performance'
```
- Selects proxy with best success rate and response time
- Weighted scoring: 70% success rate, 30% response time
- **Best for**: Production scraping, rate-limited platforms

### 2. Random Selection
```python
PROXY_STRATEGY = 'random'
```
- Randomly selects from healthy proxies
- Uniform distribution over time
- **Best for**: Development, load distribution

### 3. Round-Robin
```python
PROXY_STRATEGY = 'round_robin'
```
- Sequential rotation through proxy list
- Ensures even usage
- **Best for**: Testing, quota management

### 4. Least-Used
```python
PROXY_STRATEGY = 'least_used'
```
- Selects proxy with lowest usage count
- Balances load across pool
- **Best for**: Distributed scraping, quota limits

## Per-Request Configuration

Override proxy settings for specific requests:

```python
def parse(self, response):
    # Use specific strategy for this request
    yield scrapy.Request(
        url=some_url,
        callback=self.parse_detail,
        meta={
            'proxy_strategy': 'performance',
            'use_proxy': True,
            'retry_with_new_proxy': True,
            'max_proxy_retries': 5
        }
    )

    # Disable proxy for this request
    yield scrapy.Request(
        url=another_url,
        callback=self.parse_other,
        meta={'use_proxy': False}
    )
```

## Monitoring

### Proxy Statistics

Access real-time statistics:

```python
# In your spider
proxy_stats = self.crawler.stats.get_value('proxy_statistics')

# Returns:
{
    'total_proxies': 10,
    'healthy': 8,
    'degraded': 1,
    'failed': 1,
    'untested': 0,
    'total_requests': 1500,
    'overall_success_rate': 0.94,
    'proxies': [
        {
            'url': 'proxy1.example.com:8080',
            'status': 'healthy',
            'success_rate': 0.96,
            'avg_response_time': 1.2,
            'requests': 350
        },
        ...
    ]
}
```

### Logging

The middleware logs proxy usage at different levels:

```
INFO: Using proxy proxy1.example.com:8080 for https://example.com
DEBUG: Proxy proxy1.example.com:8080 success (1.23s)
WARNING: Proxy proxy2.example.com:8080 failure: HTTP 403
ERROR: Proxy proxy3.example.com:8080 marked as FAILED after 3 consecutive failures
```

## Health Checking

### Automatic Health Checks

Health checks run in the background:

1. Tests each proxy every 5 minutes (configurable)
2. Makes request to `https://httpbin.org/ip`
3. Records response time and success/failure
4. Updates proxy status automatically

### Manual Health Check

Trigger health check programmatically:

```python
from proxy_manager import ProxyManager

proxy_manager = ProxyManager(proxies=PROXY_LIST)

# Check specific proxy
is_healthy = await proxy_manager.check_proxy_health(proxy)

# Check all proxies
for proxy in proxy_manager.proxies:
    await proxy_manager.check_proxy_health(proxy)
```

## Proxy Status States

| Status | Description | Behavior |
|--------|-------------|----------|
| `HEALTHY` | Success rate > 70%, no recent failures | Used for requests |
| `DEGRADED` | Success rate 50-70% | Used with lower priority |
| `FAILED` | 3+ consecutive failures | Excluded for cooldown period |
| `UNTESTED` | Not yet tested | Included in rotation |

## Best Practices

### 1. Use Residential Proxies for Music Platforms
```python
# Recommended for Spotify, SoundCloud, YouTube
PROXY_LIST = [
    {
        'url': 'rotating.residentialproxy.com:8080',
        'protocol': 'http',
        'username': 'session-12345',
        'password': 'api_key'
    }
]
```

### 2. Distribute Requests Across Proxies
```python
# Avoid overwhelming single proxy
PROXY_STRATEGY = 'least_used'
CONCURRENT_REQUESTS = 16  # But not too high
```

### 3. Combine with Rate Limiting
```python
# Work within platform limits
DOWNLOAD_DELAY = 2.0  # Seconds between requests
RANDOMIZE_DOWNLOAD_DELAY = True  # Add random variance
AUTOTHROTTLE_ENABLED = True  # Adaptive rate limiting
```

### 4. Monitor Proxy Performance
```python
# Log statistics periodically
@classmethod
def from_crawler(cls, crawler):
    spider = super().from_crawler(crawler)
    crawler.signals.connect(spider.log_proxy_stats, signal=signals.spider_idle)
    return spider

def log_proxy_stats(self):
    stats = self.proxy_manager.get_statistics()
    self.logger.info(f"Proxy success rate: {stats['overall_success_rate']:.2%}")
```

### 5. Handle Proxy Failures Gracefully
```python
# Set reasonable retry limits
MAX_PROXY_RETRIES = 3  # Don't retry forever
RETRY_TIMES = 2  # Scrapy-level retries
RETRY_HTTP_CODES = [500, 502, 503, 504, 408, 429]  # Retry these codes
```

## Troubleshooting

### Issue: All proxies marked as FAILED

**Causes**:
- Proxy credentials incorrect
- Proxies blocked by target site
- Network connectivity issues
- Health check URL unreachable

**Solutions**:
1. Verify proxy credentials
2. Test proxies manually: `curl -x http://user:pass@proxy:port https://httpbin.org/ip`
3. Disable health checks temporarily: `PROXY_ENABLE_HEALTH_CHECKS = False`
4. Check proxy provider status

### Issue: Low success rate

**Causes**:
- Poor quality proxies
- Target site has aggressive blocking
- Too many concurrent requests

**Solutions**:
1. Switch to better proxy provider
2. Reduce concurrent requests: `CONCURRENT_REQUESTS = 4`
3. Increase delays: `DOWNLOAD_DELAY = 3.0`
4. Use residential proxies instead of datacenter

### Issue: Slow scraping speed

**Causes**:
- Slow proxy response times
- Health checks consuming resources
- Too conservative rate limiting

**Solutions**:
1. Use `PROXY_STRATEGY = 'performance'` to favor fast proxies
2. Increase health check interval: `PROXY_HEALTH_CHECK_INTERVAL = 600`
3. Optimize concurrent requests: `CONCURRENT_REQUESTS = 16`
4. Consider faster proxy provider

## Recommended Proxy Providers

### For Production Use

1. **Bright Data** (formerly Luminati)
   - Excellent for music platforms
   - Rotating residential IPs
   - Premium pricing
   - https://brightdata.com/

2. **Smartproxy**
   - Good balance of price/performance
   - Residential and datacenter options
   - https://smartproxy.com/

3. **Oxylabs**
   - Enterprise-grade reliability
   - Excellent success rates
   - https://oxylabs.io/

### For Budget-Conscious Projects

4. **Proxy-Cheap**
   - Affordable datacenter proxies
   - Good for testing
   - https://www.proxy-cheap.com/

5. **Webshare**
   - Free tier available
   - Datacenter proxies
   - https://www.webshare.io/

## Security Considerations

### ⚠️ NEVER commit proxy credentials

```bash
# Add to .gitignore
scrapers/proxy_config.py
*.proxy_config.py
*proxy_credentials*
```

### ✅ Use environment variables for sensitive data

```python
# In proxy_config.py
import os

PROXY_LIST = [
    {
        'url': os.getenv('PROXY_HOST'),
        'protocol': 'http',
        'username': os.getenv('PROXY_USERNAME'),
        'password': os.getenv('PROXY_PASSWORD')
    }
]
```

### ✅ Rotate proxies regularly

```python
# Update proxy list from secure source
def load_proxies_from_api():
    # Fetch current proxy list from provider API
    response = requests.get(
        'https://provider.com/api/proxies',
        headers={'Authorization': f'Bearer {API_KEY}'}
    )
    return response.json()['proxies']
```

## Testing

### Unit Tests

```python
import pytest
from proxy_manager import ProxyManager, ProxyInfo

@pytest.mark.asyncio
async def test_proxy_selection():
    manager = ProxyManager(proxies=[
        {'url': 'proxy1.com:8080', 'protocol': 'http'},
        {'url': 'proxy2.com:8080', 'protocol': 'http'}
    ])

    proxy = manager.select_proxy(strategy='random')
    assert proxy is not None
    assert proxy.url in ['proxy1.com:8080', 'proxy2.com:8080']

@pytest.mark.asyncio
async def test_proxy_health_check():
    manager = ProxyManager(proxies=[
        {'url': 'httpbin.org:80', 'protocol': 'http'}
    ])

    proxy = manager.proxies[0]
    is_healthy = await manager.check_proxy_health(proxy)
    assert proxy.status != ProxyInfo.ProxyStatus.UNTESTED
```

### Integration Tests

```bash
# Test with real proxies (development only)
cd scrapers
scrapy crawl test_spider -s ENABLE_PROXIES=True -s LOG_LEVEL=DEBUG
```

## Performance Optimization

### Optimal Settings for Different Scales

#### Small Scale (<10K requests/day)
```python
CONCURRENT_REQUESTS = 8
DOWNLOAD_DELAY = 2.0
PROXY_HEALTH_CHECK_INTERVAL = 600
MIN_PROXY_COUNT = 3
```

#### Medium Scale (10K-100K requests/day)
```python
CONCURRENT_REQUESTS = 16
DOWNLOAD_DELAY = 1.0
PROXY_HEALTH_CHECK_INTERVAL = 300
MIN_PROXY_COUNT = 10
```

#### Large Scale (>100K requests/day)
```python
CONCURRENT_REQUESTS = 32
DOWNLOAD_DELAY = 0.5
PROXY_HEALTH_CHECK_INTERVAL = 180
MIN_PROXY_COUNT = 50
PROXY_STRATEGY = 'least_used'  # Distribute load
```

## Related Documentation

- [Scraper Configuration](SCRAPER_CONFIGURATION.md)
- [Rate Limiting Best Practices](RATE_LIMITING.md)
- [Deployment Guide](../DEPLOYMENT_GUIDE.md)

---

**Last Updated**: 2025-09-30
**Maintained by**: SongNodes Development Team