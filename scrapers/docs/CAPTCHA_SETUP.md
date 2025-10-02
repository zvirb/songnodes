# CAPTCHA Solving Setup Guide

## Overview

The SongNodes scraper system includes production-ready CAPTCHA solving capabilities to bypass anti-bot protections on target websites. This guide covers setup, configuration, and best practices for using CAPTCHA solving services.

## Supported CAPTCHA Types

- **reCAPTCHA v2** - Google's image challenge (~$0.002/solve)
- **reCAPTCHA v3** - Invisible score-based CAPTCHA (~$0.003/solve)
- **hCaptcha** - Privacy-focused alternative to reCAPTCHA (~$0.002/solve)
- **Cloudflare Turnstile** - Cloudflare's CAPTCHA solution (~$0.003/solve)
- **FunCaptcha** - Arkose Labs interactive puzzles (~$0.002/solve)
- **Generic CAPTCHA** - Standard image-based CAPTCHAs (~$0.001/solve)

## Supported Providers

### 1. 2Captcha (Primary Recommended)

**Website:** https://2captcha.com/

**Advantages:**
- Wide CAPTCHA type support
- Reliable 24/7 service
- Good solving speed (10-30 seconds average)
- API-friendly with JSON responses
- Automatic fallback on failure

**Pricing:**
- reCAPTCHA v2: $0.002 per solve
- reCAPTCHA v3: $0.003 per solve
- hCaptcha: $0.002 per solve
- Cloudflare: $0.003 per solve
- Normal CAPTCHA: $0.001 per solve

**Setup:**
1. Create account at https://2captcha.com/
2. Add funds to account (minimum $3)
3. Get API key from dashboard
4. Add to `.env`: `CAPTCHA_2CAPTCHA_API_KEY=your_key_here`

### 2. Anti-Captcha (Fallback Provider)

**Website:** https://anti-captcha.com/

**Advantages:**
- High success rate
- Multiple solving methods
- Good for enterprise use
- Similar pricing to 2Captcha

**Pricing:**
- Similar to 2Captcha (~$0.002 per solve)

**Setup:**
1. Create account at https://anti-captcha.com/
2. Add funds to account
3. Get API key from dashboard
4. Add to `.env`: `CAPTCHA_ANTICAPTCHA_API_KEY=your_key_here`

## Configuration

### Environment Variables

Edit `.env` file in project root:

```bash
# Enable CAPTCHA solving
CAPTCHA_ENABLED=true

# Primary provider (2captcha or anticaptcha)
CAPTCHA_BACKEND=2captcha

# 2Captcha API key
CAPTCHA_2CAPTCHA_API_KEY=your_2captcha_api_key_here

# Anti-Captcha API key (fallback)
CAPTCHA_ANTICAPTCHA_API_KEY=your_anticaptcha_api_key_here

# Fallback configuration
CAPTCHA_FALLBACK_PROVIDER=anticaptcha  # or 'none' to disable

# Budget control (USD)
CAPTCHA_BUDGET_LIMIT=100.00
CAPTCHA_MAX_DAILY_BUDGET=100.00

# Retry and timeout settings
CAPTCHA_MAX_RETRIES=3
CAPTCHA_TIMEOUT=120  # seconds

# Mock backend (DEVELOPMENT ONLY - DO NOT USE IN PRODUCTION)
CAPTCHA_ALLOW_MOCK=false
```

### Settings Override

You can override CAPTCHA settings per-spider in `custom_settings`:

```python
class MySpider(scrapy.Spider):
    name = 'myspider'

    custom_settings = {
        'CAPTCHA_ENABLED': True,
        'CAPTCHA_BUDGET_LIMIT': 50.0,  # Lower budget for this spider
        'CAPTCHA_MAX_RETRIES': 2,
        'CAPTCHA_TIMEOUT': 60,
    }
```

## Usage

### Automatic Detection

The middleware automatically detects CAPTCHA challenges in responses:

```python
# No code changes needed - middleware handles automatically
def parse(self, response):
    # If CAPTCHA detected, middleware will:
    # 1. Detect CAPTCHA type
    # 2. Solve using configured provider
    # 3. Retry request with solution
    # 4. Return solved response to your parser

    return self.parse_data(response)
```

### Manual Control

Skip CAPTCHA solving for specific requests:

```python
yield scrapy.Request(
    url='https://example.com',
    meta={'skip_captcha_solving': True}  # Disable CAPTCHA solving
)
```

### Solution Injection

The middleware injects CAPTCHA solutions into retry requests:

```python
def parse(self, response):
    # Check if CAPTCHA was solved
    if 'captcha_solution' in response.request.meta:
        solution = response.request.meta['captcha_solution']
        self.logger.info(f"CAPTCHA solved: {solution['type']}, cost: ${solution['cost']}")

    # Continue parsing...
```

## Budget Management

### Setting Limits

Budget limits prevent excessive spending:

```bash
# Daily budget limit
CAPTCHA_MAX_DAILY_BUDGET=100.00

# Per-run budget limit
CAPTCHA_BUDGET_LIMIT=50.00
```

### Budget Tracking

Monitor budget usage in spider stats:

```python
def spider_closed(self, spider):
    total_cost = self.stats.get_value('captcha_middleware/total_cost', 0)
    solved = self.stats.get_value('captcha_middleware/solved', 0)

    self.logger.info(f"CAPTCHA budget used: ${total_cost:.2f}")
    self.logger.info(f"CAPTCHAs solved: {solved}")
```

## Cost Estimation

### Pricing Calculator

| CAPTCHA Type | Cost per Solve | 100 Solves | 1000 Solves |
|--------------|----------------|------------|-------------|
| reCAPTCHA v2 | $0.002 | $0.20 | $2.00 |
| reCAPTCHA v3 | $0.003 | $0.30 | $3.00 |
| hCaptcha | $0.002 | $0.20 | $2.00 |
| Cloudflare | $0.003 | $0.30 | $3.00 |
| Normal CAPTCHA | $0.001 | $0.10 | $1.00 |

### Example Cost Scenarios

**Light Usage (10 CAPTCHAs/day):**
- Cost: ~$0.02/day = ~$0.60/month
- Recommended budget: $10/month

**Medium Usage (100 CAPTCHAs/day):**
- Cost: ~$0.20/day = ~$6/month
- Recommended budget: $20/month

**Heavy Usage (1000 CAPTCHAs/day):**
- Cost: ~$2.00/day = ~$60/month
- Recommended budget: $100/month

## Fallback Configuration

### Automatic Failover

If primary provider fails, middleware automatically switches to fallback:

```bash
CAPTCHA_BACKEND=2captcha
CAPTCHA_FALLBACK_PROVIDER=anticaptcha
```

Fallback triggers on:
- API key errors
- Insufficient balance
- Timeout errors
- Service unavailability

### Disable Fallback

To disable fallback and fail immediately:

```bash
CAPTCHA_FALLBACK_PROVIDER=none
```

## Monitoring & Debugging

### Stats Collected

The middleware tracks detailed statistics:

- `captcha_middleware/detected` - Total CAPTCHAs detected
- `captcha_middleware/solved` - Successfully solved
- `captcha_middleware/failed` - Failed to solve
- `captcha_middleware/total_cost` - Total cost (USD)
- `captcha_middleware/budget_exceeded` - Budget limit hits
- `captcha_middleware/type_{type}` - Per-type counts

### Logging

Enable debug logging for CAPTCHA middleware:

```python
# settings.py
LOG_LEVEL = 'DEBUG'
```

Example log output:

```
2025-10-02 10:15:32 [captcha_middleware] INFO: CAPTCHA detected (recaptcha) on https://example.com
2025-10-02 10:15:32 [captcha_middleware] INFO: Solving recaptcha CAPTCHA using 2Captcha API
2025-10-02 10:15:32 [captcha_middleware] INFO: CAPTCHA submitted to 2Captcha, ID: 12345678
2025-10-02 10:15:45 [captcha_middleware] INFO: 2Captcha solved in 13.2s
2025-10-02 10:15:45 [captcha_middleware] INFO: 2Captcha solved successfully (cost: $0.0020)
```

### Error Handling

Common errors and solutions:

**ERROR_ZERO_BALANCE:**
- Add funds to your account
- Check daily spending limits

**ERROR_WRONG_USER_KEY:**
- Verify API key in `.env`
- Ensure no extra spaces

**ERROR_CAPTCHA_UNSOLVABLE:**
- CAPTCHA may be invalid
- Try alternative provider

**Timeout errors:**
- Increase `CAPTCHA_TIMEOUT`
- Check provider status

## Testing

### Unit Tests

Run CAPTCHA integration tests:

```bash
# All tests (requires API keys)
pytest scrapers/tests/test_captcha_integration.py -v

# Mock tests only (no API keys needed)
pytest scrapers/tests/test_captcha_integration.py -v -k "not real_api"
```

### Test with Real API

Set environment variables and run:

```bash
export CAPTCHA_2CAPTCHA_API_KEY=your_key_here
export CAPTCHA_ANTICAPTCHA_API_KEY=your_fallback_key_here
pytest scrapers/tests/test_captcha_integration.py::test_real_api_2captcha_balance_check -v
```

### Mock Backend (Development Only)

For testing without spending money:

```bash
CAPTCHA_BACKEND=mock
CAPTCHA_ALLOW_MOCK=true  # WARNING: Development only!
```

**⚠️ SECURITY WARNING:** Never use mock backend in production!

## Best Practices

### 1. Budget Control

- Set conservative daily limits
- Monitor costs regularly
- Use fallback providers
- Alert on budget threshold

### 2. Provider Selection

- Use 2Captcha as primary
- Configure Anti-Captcha fallback
- Test both providers periodically
- Keep API keys secure

### 3. Performance Optimization

- Only enable for spiders that need it
- Set appropriate timeouts
- Use exponential backoff
- Monitor solve times

### 4. Security

- Never commit API keys to git
- Use environment variables
- Rotate keys periodically
- Monitor for unauthorized usage

### 5. Error Handling

- Implement retry logic
- Log all errors
- Alert on repeated failures
- Have manual intervention plan

## Troubleshooting

### Issue: CAPTCHAs Not Being Solved

**Check:**
1. `CAPTCHA_ENABLED=true` in `.env`
2. Valid API key configured
3. Sufficient account balance
4. CAPTCHA type supported
5. Network connectivity

### Issue: High Costs

**Solutions:**
1. Lower `CAPTCHA_BUDGET_LIMIT`
2. Reduce scraping frequency
3. Improve proxy rotation
4. Use better anti-detection
5. Target less protected sites

### Issue: Slow Solving

**Solutions:**
1. Reduce `CAPTCHA_TIMEOUT`
2. Switch providers
3. Check provider status
4. Use multiple providers

### Issue: Failed Solves

**Solutions:**
1. Enable fallback provider
2. Increase timeout
3. Check CAPTCHA parameters
4. Verify site key extraction

## API Documentation

### 2Captcha API

**Submit CAPTCHA:**
```
POST https://2captcha.com/in.php
{
  "key": "your_api_key",
  "method": "userrecaptcha",
  "googlekey": "site_key",
  "pageurl": "target_url",
  "json": 1
}
```

**Get Result:**
```
GET https://2captcha.com/res.php?key=KEY&action=get&id=CAPTCHA_ID&json=1
```

### Anti-Captcha API

**Create Task:**
```
POST https://api.anti-captcha.com/createTask
{
  "clientKey": "your_api_key",
  "task": {
    "type": "NoCaptchaTaskProxyless",
    "websiteURL": "target_url",
    "websiteKey": "site_key"
  }
}
```

**Get Result:**
```
POST https://api.anti-captcha.com/getTaskResult
{
  "clientKey": "your_api_key",
  "taskId": 12345
}
```

## Production Checklist

Before deploying to production:

- [ ] Real API keys configured (no placeholders)
- [ ] Budget limits set appropriately
- [ ] Fallback provider configured
- [ ] Mock backend disabled (`CAPTCHA_ALLOW_MOCK=false`)
- [ ] Logging configured
- [ ] Monitoring/alerting setup
- [ ] Error handling tested
- [ ] Cost projections calculated
- [ ] API keys secured (not in git)
- [ ] Integration tests passing

## Support

### Provider Support

**2Captcha:**
- Support: https://2captcha.com/support
- API Docs: https://2captcha.com/2captcha-api
- Status: https://status.2captcha.com/

**Anti-Captcha:**
- Support: https://anti-captcha.com/panel/support
- API Docs: https://anti-captcha.com/apidoc
- Status: https://anti-captcha.com/status

### SongNodes Support

For issues with the middleware implementation:
1. Check logs for error messages
2. Run integration tests
3. Review this documentation
4. Check GitHub issues
5. Contact development team

## License & Legal

**Important Legal Considerations:**

1. **Terms of Service:** Ensure CAPTCHA solving complies with target site ToS
2. **Rate Limiting:** Respect rate limits and robots.txt
3. **Privacy:** Handle user data responsibly
4. **Provider ToS:** Follow CAPTCHA provider terms
5. **Local Laws:** Comply with data scraping regulations

**Disclaimer:** This tool is provided for legitimate data acquisition purposes only. Users are responsible for compliance with applicable laws and terms of service.
