# Sentinel Security Journal

## 2026-10-25 - OAuth Client Secrets in URL Query Parameters
**Vulnerability:** Tidal OAuth token refresh (`/tidal/oauth/refresh`) and device code init (`/tidal/device/init`) endpoints required `client_secret` and `client_id` as URL query parameters.
**Learning:** Request parameters defined as `Query(...)` in FastAPI expose secrets in server access logs, reverse proxies, browser history, and referrers.
**Prevention:** Use server-side environment variables or request headers/body payloads for sensitive credentials instead of URL query strings.
