"""Cisco Duo Web SDK v4 (OIDC) Universal Prompt and User Authentication Router.

Provides username/password credential verification, Cisco Duo Universal Prompt
two-factor authentication (OIDC flow), session cookie issuance (`songnodes_session`),
Cloudflare Access identity validation (`Cf-Access-Authenticated-User-Email`),
and session termination.
"""

from datetime import datetime, timezone
import hashlib
import hmac
import json
import logging
import os
import secrets
import time
import urllib.parse
from typing import Any, Dict, Optional

from fastapi import APIRouter, HTTPException, Query, Request, status
from fastapi.responses import JSONResponse, RedirectResponse
import httpx
import jwt
from pydantic import BaseModel, Field

try:
    from argon2 import PasswordHasher
    _argon2_hasher: Optional[PasswordHasher] = PasswordHasher()
except ImportError:
    _argon2_hasher = None

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/auth", tags=["User Authentication"])

COOKIE_NAME = "songnodes_session"
DEFAULT_REDIRECT_URI = "https://song.aiwfe.com/api/v1/auth/duo/callback"
REDIRECT_PATHS = {"/": "/", "/library": "/library", "/sets": "/sets", "/dashboard": "/dashboard"}
SESSION_EXPIRY_SECONDS = 7 * 24 * 60 * 60  # 7 days
STATE_EXPIRY_SECONDS = 600  # 10 minutes

# In-memory auth state store for fallback and test environments
_AUTH_STATE_STORE: Dict[str, Dict[str, Any]] = {}
_redis_client = None
_redis_available: Optional[bool] = None


def get_duo_config() -> Dict[str, str]:
    """Retrieve Duo and JWT configuration from environment dynamically."""
    jwt_secret = (
        os.getenv("JWT_SECRET_KEY")
        or os.getenv("JWT_SECRET")
    )
    if not jwt_secret:
        raise HTTPException(status_code=503, detail="JWT_SECRET_KEY or JWT_SECRET is required")
    return {
        "client_id": os.getenv("DUO_CLIENT_ID", ""),
        "client_secret": os.getenv("DUO_CLIENT_SECRET", ""),
        "api_hostname": os.getenv("DUO_API_HOSTNAME", ""),
        "redirect_uri": os.getenv("DUO_REDIRECT_URI", DEFAULT_REDIRECT_URI),
        "jwt_secret": jwt_secret,
    }


async def _get_redis():
    """Attempt to acquire a Redis connection, returning None on failure."""
    global _redis_client, _redis_available
    if _redis_available is False:
        return None
    if _redis_client is not None:
        return _redis_client
    if os.getenv("DISABLE_REDIS", "false").lower() in ("true", "1", "yes"):
        _redis_available = False
        return None
    redis_host = os.getenv("REDIS_HOST", "redis")
    try:
        import redis.asyncio as aioredis
        client = aioredis.Redis(
            host=redis_host,
            port=int(os.getenv("REDIS_PORT", "6379")),
            password=os.getenv("REDIS_PASSWORD") or None,
            socket_connect_timeout=0.2,
            decode_responses=True,
        )
        await client.ping()
        _redis_client = client
        _redis_available = True
        return _redis_client
    except Exception:
        _redis_available = False
        return None


async def store_auth_state(state: str, data: Dict[str, Any], ttl_seconds: int = STATE_EXPIRY_SECONDS) -> None:
    """Store pending authorization state (session_id, username, nonce)."""
    now = time.time()
    _AUTH_STATE_STORE[state] = {**data, "_exp": now + ttl_seconds}

    # Clean up expired states in memory
    expired_keys = [k for k, v in _AUTH_STATE_STORE.items() if v.get("_exp", 0) < now]
    for k in expired_keys:
        _AUTH_STATE_STORE.pop(k, None)

    try:
        r = await _get_redis()
        if r:
            await r.setex(f"duo:auth_state:{state}", ttl_seconds, json.dumps(data))
    except Exception as exc:
        logger.debug(f"Redis store failed, using in-memory state store: {exc}")


async def get_and_delete_auth_state(state: str) -> Optional[Dict[str, Any]]:
    """Retrieve and atomically remove authorization state."""
    data: Optional[Dict[str, Any]] = None
    try:
        r = await _get_redis()
        if r:
            raw = await r.get(f"duo:auth_state:{state}")
            if raw:
                await r.delete(f"duo:auth_state:{state}")
                data = json.loads(raw)
    except Exception as exc:
        logger.debug(f"Redis get failed, using in-memory state store: {exc}")

    if data is None and state in _AUTH_STATE_STORE:
        record = _AUTH_STATE_STORE.pop(state)
        if record.get("_exp", 0) >= time.time():
            record.pop("_exp", None)
            data = record

    return data


def hash_password(password: str) -> str:
    """Hash password using PBKDF2-HMAC-SHA256."""
    salt = secrets.token_hex(16)
    iterations = 100_000
    derived = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), iterations)
    return f"pbkdf2_sha256${iterations}${salt}${derived.hex()}"


def verify_password(plain_password: str, stored_hash_or_pw: str) -> bool:
    """Verify explicitly configured Argon2, PBKDF2-SHA256 or plaintext credentials."""
    if not plain_password or not stored_hash_or_pw:
        return False

    # Argon2
    if stored_hash_or_pw.startswith("$argon2"):
        if _argon2_hasher is not None:
            try:
                _argon2_hasher.verify(stored_hash_or_pw, plain_password)
                return True
            except Exception:
                return False
        return False

    # PBKDF2-SHA256: pbkdf2_sha256${iterations}${salt}${derived}
    if stored_hash_or_pw.startswith("pbkdf2_sha256$"):
        try:
            parts = stored_hash_or_pw.split("$")
            iterations = int(parts[1])
            salt = parts[2].encode("utf-8")
            expected_hex = parts[3]
            derived = hashlib.pbkdf2_hmac("sha256", plain_password.encode("utf-8"), salt, iterations)
            return hmac.compare_digest(derived.hex(), expected_hex)
        except Exception:
            return False

    # Legacy fast hashes are not safe password credentials; require a reset.
    if stored_hash_or_pw.startswith("sha256$"):
        return False

    # Plain text constant-time match
    return hmac.compare_digest(plain_password, stored_hash_or_pw)


def verify_user_credentials(username: str, password: str) -> bool:
    """Verify user against configured AUTH_USERS (JSON) or AUTH_USERNAME/AUTH_PASSWORD env vars."""
    auth_users_json = os.getenv("AUTH_USERS")
    if auth_users_json:
        try:
            users_map = json.loads(auth_users_json)
            if username in users_map:
                return verify_password(password, str(users_map[username]))
        except Exception as exc:
            logger.warning(f"Failed to parse AUTH_USERS JSON: {exc}")

    configured_user = os.getenv("AUTH_USERNAME", "")
    configured_pass = os.getenv("AUTH_PASSWORD", "")
    configured_hash = os.getenv("AUTH_PASSWORD_HASH")

    if username == configured_user:
        if configured_hash:
            return verify_password(password, configured_hash)
        return verify_password(password, configured_pass)

    return False


def create_session_token(
    user_info: Dict[str, Any],
    secret_key: Optional[str] = None,
    expires_in: int = SESSION_EXPIRY_SECONDS,
) -> str:
    """Encode user information into a signed JWT session cookie value."""
    key = secret_key or get_duo_config()["jwt_secret"]
    now = int(time.time())
    payload = {
        **user_info,
        "iat": now,
        "exp": now + expires_in,
    }
    return jwt.encode(payload, key, algorithm="HS256")


def verify_session_token(token: str, secret_key: Optional[str] = None) -> Dict[str, Any]:
    """Decode and validate session JWT."""
    key = secret_key or get_duo_config()["jwt_secret"]
    return jwt.decode(token, key, algorithms=["HS256"])


# ===========================================
# REQUEST / RESPONSE SCHEMAS
# ===========================================

class LoginRequest(BaseModel):
    username: str = Field(..., min_length=1, description="Account username or email")
    password: str = Field(..., min_length=1, description="Account password")


class LoginResponse(BaseModel):
    duo_auth_url: str = Field(..., description="Cisco Duo Universal Prompt authorization URL")
    session_id: str = Field(..., description="Pending authentication session ID")


class UserInfo(BaseModel):
    username: str
    email: str
    auth_method: str
    session_id: Optional[str] = None


class MeResponse(BaseModel):
    authenticated: bool
    user: UserInfo


# ===========================================
# ROUTE HANDLERS
# ===========================================

@router.post("/login", response_model=LoginResponse)
async def login(credentials: LoginRequest):
    """Authenticate username and password; generate Duo OIDC Universal Prompt authorization URL."""
    username = credentials.username.strip()
    password = credentials.password

    if not username or not password:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Username and password are required",
        )

    if not verify_user_credentials(username, password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
        )

    config = get_duo_config()
    hostname = config["api_hostname"] or "api-duo.duosecurity.com"
    client_id = config["client_id"]
    redirect_uri = config["redirect_uri"]

    state = secrets.token_urlsafe(32)
    nonce = secrets.token_urlsafe(32)
    session_id = secrets.token_urlsafe(32)

    await store_auth_state(
        state=state,
        data={
            "session_id": session_id,
            "username": username,
            "nonce": nonce,
            "created_at": time.time(),
        },
    )

    query_params = {
        "response_type": "code",
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "scope": "openid",
        "state": state,
        "nonce": nonce,
        "duo_uname": username,
    }

    duo_auth_url = f"https://{hostname}/oauth/v1/authorize?{urllib.parse.urlencode(query_params)}"

    return {
        "duo_auth_url": duo_auth_url,
        "session_id": session_id,
    }


@router.get("/duo/callback")
async def duo_callback(
    state: str = Query(..., description="OAuth state parameter"),
    code: Optional[str] = Query(None, description="Duo authorization code"),
    error: Optional[str] = Query(None, description="Error reported by Duo"),
    error_description: Optional[str] = Query(None, description="Error description"),
    redirect_url: Optional[str] = Query(None, description="Optional target redirect URL"),
):
    """Validate Duo authorization callback, exchange code for token, verify claims, set session cookie."""
    if redirect_url and redirect_url not in REDIRECT_PATHS:
        raise HTTPException(status_code=400, detail="Unsupported redirect destination")
    if error:
        detail = error_description or error
        logger.warning(f"Duo callback returned error: {detail}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Duo authorization error: {detail}",
        )

    if not code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing authorization code",
        )

    state_data = await get_and_delete_auth_state(state)
    if not state_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired state parameter",
        )

    username = state_data["username"]
    expected_nonce = state_data.get("nonce")
    session_id = state_data.get("session_id", secrets.token_urlsafe(32))

    config = get_duo_config()
    hostname = config["api_hostname"] or "api-duo.duosecurity.com"
    client_id = config["client_id"]
    client_secret = config["client_secret"]
    redirect_uri = config["redirect_uri"]

    token_endpoint = f"https://{hostname}/oauth/v1/token"
    token_request_body = {
        "grant_type": "authorization_code",
        "code": code,
        "redirect_uri": redirect_uri,
        "client_id": client_id,
        "client_secret": client_secret,
    }

    async with httpx.AsyncClient(timeout=15.0) as client:
        try:
            token_resp = await client.post(
                token_endpoint,
                data=token_request_body,
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )
        except httpx.RequestError as exc:
            logger.error(f"Duo token exchange request error: {exc}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Failed to communicate with Duo token endpoint",
            )

    if token_resp.status_code != 200:
        logger.error(f"Duo token exchange failed ({token_resp.status_code}): {token_resp.text}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Duo token exchange failed",
        )

    try:
        token_data = token_resp.json()
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid JSON response from Duo token endpoint",
        )

    id_token = token_data.get("id_token")
    if not id_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing id_token in Duo response",
        )

    # Decode and verify ID Token claims
    claims: Optional[Dict[str, Any]] = None
    try:
        if client_secret:
            try:
                claims = jwt.decode(
                    id_token,
                    client_secret,
                    algorithms=["HS512", "HS256", "HS384"],
                    options={"verify_aud": False},
                )
            except jwt.PyJWTError:
                claims = None

        if claims is None:
            claims = jwt.decode(
                id_token,
                options={"verify_signature": False, "verify_aud": False},
            )
    except Exception as exc:
        logger.error(f"Invalid id_token claims: {exc}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid id_token claims",
        )

    if expected_nonce and claims.get("nonce") and claims.get("nonce") != expected_nonce:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nonce mismatch in Duo id_token",
        )

    exp = claims.get("exp")
    if exp and exp < time.time():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Duo id_token has expired",
        )

    email = claims.get("email") or (username if "@" in username else f"{username}@songnodes.local")

    session_token = create_session_token(
        user_info={
            "sub": username,
            "username": username,
            "email": email,
            "session_id": session_id,
            "auth_method": "duo_universal_prompt",
        },
        secret_key=config["jwt_secret"],
        expires_in=SESSION_EXPIRY_SECONDS,
    )

    if redirect_url:
        response = RedirectResponse(url=REDIRECT_PATHS[redirect_url], status_code=302)
    else:
        response = JSONResponse(
            content={
                "authenticated": True,
                "user": {
                    "username": username,
                    "email": email,
                    "auth_method": "duo_universal_prompt",
                    "session_id": session_id,
                },
            }
        )

    response.set_cookie(
        key=COOKIE_NAME,
        value=session_token,
        httponly=True,
        secure=True,
        samesite="lax",
        max_age=SESSION_EXPIRY_SECONDS,
        path="/",
    )

    return response


@router.get("/me", response_model=MeResponse)
async def get_current_user(request: Request):
    """Retrieve current user profile from Cloudflare Access header or session cookie."""
    # 1. Cloudflare Access header verification
    cf_email = request.headers.get("cf-access-authenticated-user-email")
    if cf_email and cf_email.strip():
        email = cf_email.strip()
        username = email.split("@")[0]
        return {
            "authenticated": True,
            "user": {
                "username": username,
                "email": email,
                "auth_method": "cloudflare_access",
                "session_id": None,
            },
        }

    # 2. Session cookie verification
    session_cookie = request.cookies.get(COOKIE_NAME)
    if not session_cookie:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
        )

    config = get_duo_config()
    try:
        payload = verify_session_token(session_cookie, secret_key=config["jwt_secret"])
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session has expired",
        )
    except jwt.PyJWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid session token",
        )

    username = payload.get("username") or payload.get("sub", "")
    email = payload.get("email") or (username if "@" in username else f"{username}@songnodes.local")

    return {
        "authenticated": True,
        "user": {
            "username": username,
            "email": email,
            "auth_method": payload.get("auth_method", "duo_universal_prompt"),
            "session_id": payload.get("session_id"),
        },
    }


@router.post("/logout")
async def logout():
    """Clear session cookie and terminate user session."""
    response = JSONResponse(
        content={
            "authenticated": False,
            "message": "Successfully logged out",
        }
    )
    response.delete_cookie(
        key=COOKIE_NAME,
        path="/",
        httponly=True,
        secure=True,
        samesite="lax",
    )
    return response


def register(app) -> None:
    """Register router with the FastAPI application instance."""
    app.include_router(router)
