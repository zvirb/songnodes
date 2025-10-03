# Redis Password Authentication Fix - 2025-10-03

## 🔒 Problem

Redis now requires password authentication (`REDIS_PASSWORD`), but several files had hardcoded connection URLs without passwords, causing authentication failures.

## 🔍 Files Fixed

### 1. **services/health-monitor/health-check.js**
**Issue**: Hardcoded fallback URL without password
```javascript
// Before
url: process.env.REDIS_URL || 'redis://redis:6379'

// After
const redisPassword = process.env.REDIS_PASSWORD || 'redis_secure_pass_2024';
const redisUrl = process.env.REDIS_URL || `redis://:${redisPassword}@redis:6379`;
```

### 2. **monitoring/grafana/datasources/datasource.yml**
**Issue**: No password authentication for Redis datasource
```yaml
# Added
secureJsonData:
  password: ${REDIS_PASSWORD:-redis_secure_pass_2024}
```

### 3. **k8s/deployment.yaml** (4 instances)
**Issue**: Hardcoded URLs without passwords
```yaml
# Before
- name: REDIS_URL
  value: "redis://redis:6379"

# After
- name: REDIS_URL
  value: "redis://:$(REDIS_PASSWORD)@redis:6379"
- name: REDIS_PASSWORD
  valueFrom:
    secretKeyRef:
      name: redis-secret
      key: password
```

### 4. **shared/templates/base_fastapi_service.py**
**Issue**: Template missing password
```python
# Before
redis_url: str = "redis://localhost:6379"

# After
redis_url: str = "redis://:redis_secure_pass_2024@localhost:6379"
```

### 5. **services/api-gateway/.env.example**
**Issue**: Example configuration missing password
```bash
# Before
REDIS_PASSWORD=
REDIS_URL=redis://redis:6379

# After
REDIS_PASSWORD=redis_secure_pass_2024
REDIS_URL=redis://:${REDIS_PASSWORD}@redis:6379
```

## ✅ Already Correct

These files properly handle Redis passwords:
- ✅ `services/api-gateway/config/redis.js` - Has `password: process.env.REDIS_PASSWORD` (line 35)
- ✅ `services/api-gateway/server.js` - Has `password: redisPassword` (line 171)
- ✅ `docker-compose.yml` - Has `REDIS_PASSWORD: ${REDIS_PASSWORD:-redis_secure_pass_2024}` (line 1486)

## 🔐 Redis URL Format

Correct Redis URL format with password authentication:

```
redis://:<password>@<host>:<port>
redis://:redis_secure_pass_2024@redis:6379
```

**Note**: The colon `:` before the password is required for the Redis protocol.

## 🧪 Testing

To verify Redis connections work:

```bash
# Test from health-monitor
docker exec health-monitor node -e "
  const redis = require('redis');
  const client = redis.createClient({
    url: 'redis://:redis_secure_pass_2024@redis:6379'
  });
  client.connect().then(() => {
    console.log('✓ Connected');
    client.ping().then(() => {
      console.log('✓ Ping successful');
      client.quit();
    });
  });
"

# Test from api-gateway
docker logs api-gateway | grep -i "redis\|connected"

# Test Grafana datasource
docker logs grafana | grep -i redis
```

## 📊 Impact

**Services Fixed**: 5 files, 8 instances
**Environments**: Development, Kubernetes/Production
**Security**: All connections now properly authenticated

## 🚀 Deployment

Changes are backward-compatible. Services will:
1. Try environment variable `REDIS_PASSWORD` first
2. Fall back to default `redis_secure_pass_2024`
3. Match the password set in `docker-compose.yml`

## 📝 Related Documentation

- `.env.example` - Redis configuration
- `docker-compose.yml:79` - Redis password setup
- `CLAUDE.md` - Secrets management section
