import os
import hmac
import time
import logging
from collections import defaultdict
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

logger = logging.getLogger(__name__)

# Simple in-memory limit for 401s
# Maps IP to (count, last_reset_time)
_401_limits = defaultdict(lambda: [0, time.time()])
MAX_401_ATTEMPTS = 5
BLOCK_DURATION_SEC = 60

SENSITIVE_GET_PREFIXES = [
    "/api-keys",
    "/api/v1/jobs",
    "/api/v1/metadata/review",
    "/api/v1/merges",
    "/api/v1/outbox/status",
    "/api/v1/attributions",
    "/api/v1/resolution/review"
]

def register_security(app: FastAPI):
    api_token = os.getenv("SONGNODES_API_TOKEN")

    if not api_token:
        logger.warning("SONGNODES_API_TOKEN is not set. Write and admin REST routes are open.")
        return

    @app.middleware("http")
    async def require_auth_middleware(request: Request, call_next):
        method = request.method
        path = request.url.path

        # Always allow health and docs (docs, redoc, openapi.json)
        if path.startswith("/health") or path.startswith("/docs") or path.startswith("/redoc") or path.startswith("/openapi.json"):
            return await call_next(request)

        # Check if the request is a write method or matches sensitive GET prefixes
        is_sensitive = False
        if method not in ["GET", "HEAD", "OPTIONS"]:
            is_sensitive = True
        elif method == "GET":
            if any(path.startswith(prefix) for prefix in SENSITIVE_GET_PREFIXES) or "/canonical" in path:
                # /api/v1/tracks/{track_id}/canonical is a datalayer admin review route
                is_sensitive = True

        if is_sensitive:
            client_ip = request.client.host if request.client else "unknown"

            # Check rate limits
            current_time = time.time()
            count, last_time = _401_limits[client_ip]
            if current_time - last_time > BLOCK_DURATION_SEC:
                _401_limits[client_ip] = [0, current_time]
                count = 0

            if count >= MAX_401_ATTEMPTS:
                return JSONResponse(status_code=401, content={"detail": "Unauthorized"})

            auth_header = request.headers.get("Authorization")
            x_api_token = request.headers.get("X-API-Token")

            token = None
            if auth_header and auth_header.startswith("Bearer "):
                token = auth_header[len("Bearer "):]
            elif x_api_token:
                token = x_api_token

            if not token or not hmac.compare_digest(token.encode("utf-8"), api_token.encode("utf-8")):
                _401_limits[client_ip][0] += 1
                return JSONResponse(status_code=401, content={"detail": "Unauthorized"})

        return await call_next(request)
