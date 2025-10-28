# MixesDB Authentication Guide

## Bot Account Credentials

MixesDB supports bot authentication via MediaWiki's bot password system. This allows automated access without using the main account credentials.

### Account Details

- **Bot Username**: `Zvirb@songnodes`
- **Bot Password**: `p2m6vlld1eirm3lm2h346cdta5776qfb`
- **Main Account**: `Zvirb`
- **Bot Name**: `songnodes`

### Usage

Bot passwords allow access to a user account via the API without using the account's main login credentials. The user rights available when logged in with a bot password may be restricted.

### Authentication Methods

#### Method 1: HTTP Basic Auth (Recommended for Scrapy)

Use the bot credentials with HTTP Basic Authentication:

```python
# In Scrapy spider settings
custom_settings = {
    'DOWNLOADER_MIDDLEWARES': {
        'scrapy.downloadermiddlewares.httpauth.HttpAuthMiddleware': 543,
    },
    'HTTPAUTH_CREDENTIALS': [
        ('Zvirb@songnodes', 'p2m6vlld1eirm3lm2h346cdta5776qfb')
    ]
}
```

#### Method 2: MediaWiki API Login

For direct API access:

```python
import requests

api_url = "https://www.mixesdb.com/w/api.php"

# Step 1: Get login token
session = requests.Session()
token_response = session.get(api_url, params={
    'action': 'query',
    'meta': 'tokens',
    'type': 'login',
    'format': 'json'
})
login_token = token_response.json()['query']['tokens']['logintoken']

# Step 2: Login with bot credentials
login_response = session.post(api_url, data={
    'action': 'login',
    'lgname': 'Zvirb@songnodes',
    'lgpassword': 'p2m6vlld1eirm3lm2h346cdta5776qfb',
    'lgtoken': login_token,
    'format': 'json'
})

# Now make authenticated requests with this session
```

### Benefits of Bot Authentication

1. **Rate Limit Bypass**: Authenticated bots may have higher rate limits
2. **Access to Protected Pages**: Some setlists may be restricted to registered users
3. **Attribution**: Edits/views are properly attributed to the bot account
4. **Monitoring**: MixesDB administrators can monitor bot activity separately

### Implementation in MixesDB Spider

To enable authentication in the MixesDB spider:

1. Add credentials to environment variables or Kubernetes secrets:
   ```bash
   MIXESDB_BOT_USER=Zvirb@songnodes
   MIXESDB_BOT_PASS=p2m6vlld1eirm3lm2h346cdta5776qfb
   ```

2. Update `scrapers/spiders/mixesdb_spider.py` to use HTTP Auth middleware:
   ```python
   custom_settings = {
       'DOWNLOADER_MIDDLEWARES': {
           'scrapy.downloadermiddlewares.httpauth.HttpAuthMiddleware': 543,
       },
       'HTTPAUTH_CREDENTIALS': [
           (os.getenv('MIXESDB_BOT_USER'), os.getenv('MIXESDB_BOT_PASS'))
       ]
   }
   ```

3. For pages that require session-based authentication, implement a login sequence in `start_requests()`.

### Security Notes

- **NEVER commit credentials to Git**: Use environment variables or secret management
- **Rotate credentials periodically**: Generate new bot passwords if compromised
- **Limit bot permissions**: Only grant necessary user rights to the bot account
- **Monitor usage**: Check bot logs for unexpected activity

### Troubleshooting

**Authentication Failed:**
- Verify credentials are correct (no extra spaces/characters)
- Check if bot password is still active on MixesDB
- Ensure MediaWiki API is accessible

**Still Rate Limited:**
- Bot authentication may not affect Cloudflare-level rate limiting
- Implement exponential backoff and respect robots.txt
- Consider using CAPTCHA solving for heavily protected pages

### Related Documentation

- MixesDB Bot Password Page: https://www.mixesdb.com/w/Special:BotPasswords
- MediaWiki API Documentation: https://www.mediawiki.org/wiki/API:Login
- Scrapy HTTP Auth Middleware: https://docs.scrapy.org/en/latest/topics/downloader-middleware.html#module-scrapy.downloadermiddlewares.httpauth

### Created

- Date: 2025-10-26
- Source: User-provided credentials for SongNodes project
- Account Owner: Zvirb
