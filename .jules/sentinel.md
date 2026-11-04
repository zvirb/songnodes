# Sentinel Security Journal

## 2026-10-25 - OAuth Client Secrets in URL Query Parameters
**Vulnerability:** Tidal OAuth token refresh (`/tidal/oauth/refresh`) and device code init (`/tidal/device/init`) endpoints required `client_secret` and `client_id` as URL query parameters.
**Learning:** Request parameters defined as `Query(...)` in FastAPI expose secrets in server access logs, reverse proxies, browser history, and referrers.
**Prevention:** Use server-side environment variables or request headers/body payloads for sensitive credentials instead of URL query strings.

## 2026-11-04 - Upstream Error Body Exposure and Mandatory API Key Query Parameter
**Vulnerability:** YouTube search endpoint leaked raw upstream HTTP error response text (which may contain internal error traces and sensitive tokens) and required client-provided API keys in query parameters.
**Learning:** Returning unparsed raw error strings in HTTPException details risks leaking upstream internal state or sensitive data, while requiring API keys in client query strings risks exposure in logs.
**Prevention:** Log upstream error details securely server-side and return sanitized generic messages to clients, allowing server-side fallback to stored API credentials.
