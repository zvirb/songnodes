# OAuth Redis Storage - Quick Reference

**Last Updated**: 2025-10-10
**Status**: Production-Ready

---

## Redis Key Patterns

| OAuth Flow | Redis Key | TTL | Service |
|:-----------|:----------|:----|:--------|
| Spotify Authorization | `oauth:spotify:{state}` | 600s | Spotify |
| Tidal Authorization | `oauth:tidal:{state}` | 600s | Tidal |
| Tidal Device Code | `oauth:tidal:device:{device_code}` | 600s | Tidal |

---

## Common Commands

### Check Active OAuth Sessions

```bash
# List all active OAuth states
docker compose exec redis redis-cli -a "${REDIS_PASSWORD}" --scan --pattern "oauth:*"

# Count active sessions
docker compose exec redis redis-cli -a "${REDIS_PASSWORD}" --scan --pattern "oauth:*" | wc -l
```

### Inspect OAuth State

```bash
# Get state data
docker compose exec redis redis-cli -a "${REDIS_PASSWORD}" GET "oauth:spotify:{state}"

# Check remaining TTL (seconds)
docker compose exec redis redis-cli -a "${REDIS_PASSWORD}" TTL "oauth:spotify:{state}"
```

### Clear Expired Sessions

```bash
# Redis automatically deletes expired keys (TTL=600s)
# Manual cleanup (if needed):
docker compose exec redis redis-cli -a "${REDIS_PASSWORD}" --scan --pattern "oauth:*" | \
    xargs -I {} docker compose exec redis redis-cli -a "${REDIS_PASSWORD}" DEL {}
```

---

## Debugging

### Check OAuth Flow Logs

```bash
# REST API logs
docker compose logs -f rest-api | grep "🎵"

# Search for specific OAuth operations
docker compose logs rest-api | grep "Stored OAuth state"
docker compose logs rest-api | grep "Retrieved OAuth state"
docker compose logs rest-api | grep "Deleted OAuth state"
```

### Common Issues

#### 1. "Invalid or expired state parameter"

**Cause**: State expired (>10 minutes) or already used
**Solution**: User must restart OAuth flow

```bash
# Check if state exists in Redis
docker compose exec redis redis-cli -a "${REDIS_PASSWORD}" GET "oauth:spotify:{state}"
```

#### 2. Redis Connection Failed

**Cause**: Redis service not running or password incorrect
**Solution**: Restart Redis

```bash
# Check Redis health
docker compose ps redis

# Restart Redis
docker compose restart redis

# Test connection
docker compose exec redis redis-cli -a "${REDIS_PASSWORD}" ping
# Expected: PONG
```

#### 3. State Not Found After Authorization

**Cause**: State was deleted (one-time use) or expired
**Solution**: This is expected behavior after successful token exchange

```bash
# Check logs for successful authorization
docker compose logs rest-api | grep "Deleted OAuth state"
```

---

## Performance Monitoring

### Redis Memory Usage

```bash
# Overall memory stats
docker compose exec redis redis-cli -a "${REDIS_PASSWORD}" INFO memory

# Key count in oauth namespace
docker compose exec redis redis-cli -a "${REDIS_PASSWORD}" DBSIZE
```

### OAuth Flow Latency

```bash
# Test OAuth initiation latency
time curl -X GET "http://localhost:8082/api/v1/music-auth/spotify/authorize?redirect_uri=http://127.0.0.1:8082/callback" -L

# Expected: < 50ms (including Spotify redirect)
```

---

## Security Checklist

- [x] ✅ State stored in Redis (not in-memory)
- [x] ✅ 10-minute TTL prevents replay attacks
- [x] ✅ One-time use (state deleted after token exchange)
- [x] ✅ Client secrets stored server-side only
- [x] ✅ Service-specific namespaces prevent collisions
- [x] ✅ CSRF protection via state parameter
- [x] ✅ Logging masks sensitive data (first 8 chars only)

---

## API Endpoints

### Spotify OAuth

```bash
# 1. Initiate OAuth
GET /api/v1/music-auth/spotify/authorize?redirect_uri={uri}

# 2. Callback (automatic)
GET /api/v1/music-auth/spotify/callback?code={code}&state={state}
```

### Tidal OAuth

```bash
# 1. Initiate OAuth
POST /api/v1/music-auth/tidal/oauth/init
Body: {"redirect_uri": "http://..."}

# 2. Callback (automatic)
GET /api/v1/music-auth/tidal/oauth/callback?code={code}&state={state}
```

### Tidal Device Code

```bash
# 1. Initialize device flow
POST /api/v1/music-auth/tidal/device/init?client_id={id}&client_secret={secret}

# 2. Poll for token (every 5 seconds)
POST /api/v1/music-auth/tidal/device/poll?device_code={code}
```

---

## Emergency Procedures

### Clear All OAuth Sessions

```bash
# WARNING: This will invalidate all active OAuth flows
docker compose exec redis redis-cli -a "${REDIS_PASSWORD}" --scan --pattern "oauth:*" | \
    xargs -I {} docker compose exec redis redis-cli -a "${REDIS_PASSWORD}" DEL {}
```

### Reset Redis (Nuclear Option)

```bash
# WARNING: This deletes ALL Redis data
docker compose exec redis redis-cli -a "${REDIS_PASSWORD}" FLUSHALL
```

---

## Testing

### Run Automated Tests

```bash
cd /mnt/my_external_drive/programming/songnodes
./tests/test_oauth_redis_migration.sh
```

### Manual OAuth Test (Spotify)

```bash
# 1. Start OAuth flow
curl -X GET "http://localhost:8082/api/v1/music-auth/spotify/authorize?redirect_uri=http://127.0.0.1:8082/api/v1/music-auth/spotify/callback" -L

# 2. Check state in Redis
docker compose exec redis redis-cli -a "${REDIS_PASSWORD}" --scan --pattern "oauth:spotify:*"

# 3. Complete authorization in browser

# 4. Verify state was deleted
docker compose exec redis redis-cli -a "${REDIS_PASSWORD}" --scan --pattern "oauth:spotify:*"
# Expected: (empty) - state deleted after token exchange
```

---

## Migration Checklist

If you're implementing OAuth in a new service:

1. **Import Redis client**:
   ```python
   import redis.asyncio as redis
   import json
   ```

2. **Get Redis connection**:
   ```python
   r = await get_redis()
   ```

3. **Store state** (10-minute TTL):
   ```python
   oauth_data = {
       'client_id': CLIENT_ID,
       'client_secret': CLIENT_SECRET,
       'redirect_uri': redirect_uri,
       'created_at': time.time(),
       'service': 'your_service'
   }
   await r.setex(
       f"oauth:your_service:{state}",
       600,
       json.dumps(oauth_data)
   )
   ```

4. **Retrieve state**:
   ```python
   oauth_data_json = await r.get(f"oauth:your_service:{state}")
   if not oauth_data_json:
       raise HTTPException(status_code=400, detail="Invalid or expired state")
   oauth_data = json.loads(oauth_data_json)
   ```

5. **Delete state** (one-time use):
   ```python
   await r.delete(f"oauth:your_service:{state}")
   ```

6. **Add logging**:
   ```python
   logger.info(f"🎵 [YOUR_SERVICE] Stored OAuth state in Redis with key: oauth:your_service:{state[:8]}...")
   ```

---

## Support

- **Documentation**: `/docs/OAUTH_STATE_REDIS_MIGRATION.md`
- **Summary**: `/OAUTH_REDIS_MIGRATION_SUMMARY.md`
- **Test Suite**: `/tests/test_oauth_redis_migration.sh`
- **Code**: `/services/rest-api/routers/music_auth.py`

**Questions?** Contact the Database/Schema Expert Agent
