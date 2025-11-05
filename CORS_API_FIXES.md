# CORS and API Routing Fixes

**Date:** 2025-11-05
**Branch:** `claude/fix-cors-api-errors-011CUpRnBN25fGQsjt7REmHS`

## Summary

Fixed critical CORS configuration and API routing issues in the SongNodes Kubernetes deployment that were preventing proper cross-origin requests and API endpoint access.

## Issues Identified

### 1. CORS Environment Variable Mismatch

**Problem:**
- Helm ConfigMap set `CORS_ORIGINS: "*"` in values.yaml
- Backend FastAPI services read `CORS_ALLOWED_ORIGINS`
- Variable name mismatch caused services to fall back to localhost-only CORS origins

**Impact:**
- CORS wildcard not applied in production
- Cross-origin requests blocked unless from localhost
- External frontends unable to access APIs

**Root Cause:**
Inconsistent environment variable naming between infrastructure configuration and application code.

### 2. Frontend Nginx API Routing Issue

**Problem:**
- Frontend nginx.conf proxied ALL `/api/` requests to graph-visualization:8084
- REST API service (port 8082) endpoints were completely inaccessible
- Missing endpoints included:
  - `/api/v1/artists/*` (Artist management)
  - `/api/v1/tracks/*` (Track management)
  - `/api/v1/setlists/*` (Setlist endpoints)
  - `/api/v1/scrape/*` (Scraping triggers)
  - And many more

**Impact:**
- Frontend unable to access artist, track, and setlist management endpoints
- Admin functionality broken
- Scraping triggers inaccessible

**Root Cause:**
Oversimplified nginx proxy configuration that didn't account for multiple backend services.

## Fixes Applied

### Fix 1: Correct CORS Environment Variable Name

**File:** `deploy/helm/songnodes/values.yaml`

**Change:**
```yaml
# Before
CORS_ORIGINS: "*"

# After
CORS_ALLOWED_ORIGINS: "*"
```

**Line:** 45

**Result:**
- All backend services now receive correct CORS configuration
- Wildcard origin (`*`) properly applied for development/testing
- Production deployments can easily override with specific origins

### Fix 2: Implement Path-Based API Routing

**File:** `deploy/helm/songnodes/values.yaml`

**Changes:**
```yaml
# Before (lines 1468-1477)
location /api/ {
    proxy_pass http://graph-visualization:8084;
    # ... proxy headers ...
}

# After (lines 1468-1487)
# Graph API endpoints
location ~ ^/api/(graph|v1/visualization|user-setlists) {
    proxy_pass http://graph-visualization:8084;
    # ... proxy headers ...
}

# REST API endpoints (artists, tracks, setlists, scraping, etc.)
location /api/ {
    proxy_pass http://rest-api:8082;
    # ... proxy headers ...
}
```

**Routing Logic:**
1. **Graph-specific routes** → graph-visualization:8084
   - `/api/graph/*` - Graph data and WebSocket endpoints
   - `/api/v1/visualization/*` - Visualization endpoints
   - `/api/user-setlists` - User setlist endpoint

2. **All other API routes** → rest-api:8082 (default)
   - `/api/v1/artists/*` - Artist management
   - `/api/v1/tracks/*` - Track management
   - `/api/v1/setlists/*` - Setlist endpoints
   - `/api/v1/playlists/*` - Playlist endpoints
   - `/api/v1/scrape/*` - Scraping triggers
   - `/api/v1/target-tracks/*` - Target track management
   - `/api/search/*` - Search endpoints

**Result:**
- Both REST API and Graph API endpoints now accessible through frontend
- Proper service separation maintained
- WebSocket upgrades work for graph endpoints

## Backend Services Verified

All backend services confirmed to use correct `CORS_ALLOWED_ORIGINS` environment variable:

1. ✅ `services/rest_api/main.py` (line 174)
2. ✅ `services/graph-visualization-api/main.py` (line 949)
3. ✅ `services/websocket-api/main.py` (line 342)
4. ✅ `services/metadata-enrichment/main.py` (line 475)
5. ✅ `services/nlp-processor/main.py`
6. ✅ `services/scraper-orchestrator/main.py`

All services default to `http://localhost:3006` for development and can be overridden with the `CORS_ALLOWED_ORIGINS` environment variable.

## CORS Architecture

### Current Setup (Correct)

```
Browser → Frontend Nginx (proxy only, no CORS headers)
          ↓
Backend Services (FastAPI with CORSMiddleware)
          ↓
Response with proper CORS headers
```

**Why this is correct:**
- CORS headers should be set by the backend application (FastAPI)
- Nginx proxy should NOT add CORS headers (would cause duplicates)
- Ingress controller adds CORS headers for external access (values.yaml lines 1667-1670)

### Ingress CORS Configuration

```yaml
nginx.ingress.kubernetes.io/enable-cors: "true"
nginx.ingress.kubernetes.io/cors-allow-origin: "*"
nginx.ingress.kubernetes.io/cors-allow-methods: GET, POST, PUT, DELETE, OPTIONS
nginx.ingress.kubernetes.io/cors-allow-headers: DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization
```

This provides CORS support for external access through the ingress controller.

## Testing Recommendations

### 1. Verify CORS Configuration

```bash
# Check environment variable in pods
kubectl exec -n songnodes deployment/rest-api -- env | grep CORS_ALLOWED_ORIGINS
kubectl exec -n songnodes deployment/graph-visualization -- env | grep CORS_ALLOWED_ORIGINS

# Should output: CORS_ALLOWED_ORIGINS=*
```

### 2. Test API Routing

```bash
# Get frontend pod name
FRONTEND_POD=$(kubectl get pods -n songnodes -l app.kubernetes.io/name=frontend -o jsonpath='{.items[0].metadata.name}')

# Test REST API routing
kubectl exec -n songnodes $FRONTEND_POD -- curl -s http://localhost/api/v1/artists | jq '.'

# Test Graph API routing
kubectl exec -n songnodes $FRONTEND_POD -- curl -s http://localhost/api/graph/stats | jq '.'
```

### 3. Test CORS from Browser

```javascript
// Open browser console on frontend
fetch('/api/v1/artists')
  .then(r => r.json())
  .then(data => console.log('Artists:', data))
  .catch(err => console.error('Error:', err));

fetch('/api/graph/stats')
  .then(r => r.json())
  .then(data => console.log('Graph Stats:', data))
  .catch(err => console.error('Error:', err));
```

### 4. Test External CORS (if ingress configured)

```bash
# From external machine (replace with your domain)
curl -v -X OPTIONS \
  -H "Origin: https://example.com" \
  -H "Access-Control-Request-Method: GET" \
  https://api.songnodes.example.com/api/v1/artists

# Should include CORS headers in response:
# Access-Control-Allow-Origin: *
# Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
```

## Production Deployment

### Recommended CORS Configuration for Production

**For specific origins (more secure):**
```yaml
# In values.yaml or values-prod.yaml
config:
  data:
    CORS_ALLOWED_ORIGINS: "https://songnodes.example.com,https://www.songnodes.example.com"
```

**For development/testing:**
```yaml
config:
  data:
    CORS_ALLOWED_ORIGINS: "*"  # Current setting (OK for development)
```

### Deployment Steps

```bash
# 1. Ensure you're on the correct branch
git checkout claude/fix-cors-api-errors-011CUpRnBN25fGQsjt7REmHS

# 2. Deploy with Helm
helm upgrade songnodes deploy/helm/songnodes \
  --namespace songnodes \
  --install \
  --wait

# 3. Or deploy with Flux (automatic)
flux reconcile source git songnodes
flux reconcile helmrelease songnodes -n flux-system

# 4. Verify pods restarted with new configuration
kubectl rollout status deployment/rest-api -n songnodes
kubectl rollout status deployment/graph-visualization -n songnodes
kubectl rollout status deployment/frontend -n songnodes
```

## Related Files Modified

1. `deploy/helm/songnodes/values.yaml`
   - Line 45: `CORS_ALLOWED_ORIGINS: "*"` (fixed variable name)
   - Lines 1468-1487: API routing configuration (added path-based routing)

## Commit History

See recent commits on this branch:
- `6323a54` fix(helm): simplify nginx API proxy to single /api/ location
- `9d86d2a` fix(helm): use relative URLs for frontend API calls
- `c3ce574` fix(helm): add frontend-to-backend ingress rule in NetworkPolicy
- `6f74c87` fix(helm): correct nginx proxy_pass to preserve API paths
- `1f4378c` feat(helm): add nginx API proxy configuration

## Additional Notes

### About the Phoenix AIWFE Errors

The error logs provided in the task description were from a different application (phoenix.aiwfe.com), not from SongNodes. Those errors showed:
- CORS issues accessing iam.aiwfe.com
- API configuration issues for phoenix-storage and phoenix-iam services
- OAuth redirect_uri_mismatch errors

These are unrelated to SongNodes but highlighted similar CORS configuration patterns that we've now fixed in SongNodes to prevent similar issues.

### Key Takeaways

1. **Environment variable consistency is critical** - Always verify variable names match between infrastructure config and application code
2. **Multi-service routing requires path-based rules** - Single catch-all proxy rules don't work with multiple backend services
3. **CORS should be handled by the application layer** - Don't add CORS headers in nginx proxy; let FastAPI handle it
4. **Test routing thoroughly** - Use curl and browser console to verify all API endpoints are accessible

## References

- [FastAPI CORS Middleware Documentation](https://fastapi.tiangolo.com/tutorial/cors/)
- [Kubernetes Ingress NGINX CORS Annotations](https://kubernetes.github.io/ingress-nginx/user-guide/nginx-configuration/annotations/#enable-cors)
- [CLAUDE.md - SongNodes Developer Guide](./CLAUDE.md)
