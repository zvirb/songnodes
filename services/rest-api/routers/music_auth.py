"""
Music Service Authentication Router
Handles authentication testing for Tidal and Spotify
Includes OAuth 2.1 Authorization Code flow with PKCE for Tidal
"""

from fastapi import APIRouter, HTTPException, status, Query, Request
from fastapi.responses import RedirectResponse, JSONResponse
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
import aiohttp
import asyncio
import logging
import base64
import time
import jwt
import hashlib
import secrets
import urllib.parse
import json
import os
import redis.asyncio as redis
from datetime import datetime, timedelta
import asyncpg

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/music-auth", tags=["Music Authentication"])

# Get database pool from app state
async def get_db_pool():
    """Dependency to get database pool"""
    from main import db_pool
    if not db_pool:
        raise HTTPException(
            status_code=500,
            detail="Database connection pool not available"
        )
    return db_pool

# ===========================================
# MUSIC SERVICE CREDENTIALS FROM ENVIRONMENT
# ===========================================
TIDAL_CLIENT_ID = os.getenv("TIDAL_CLIENT_ID", "")
TIDAL_CLIENT_SECRET = os.getenv("TIDAL_CLIENT_SECRET", "")

SPOTIFY_CLIENT_ID = os.getenv("SPOTIFY_CLIENT_ID", "")
SPOTIFY_CLIENT_SECRET = os.getenv("SPOTIFY_CLIENT_SECRET", "")

# ===========================================
# OAUTH STATE STORAGE (Redis-based for production)
# ===========================================
# Redis-based storage for OAuth state/PKCE parameters
# Supports multi-instance deployments (horizontal scaling)
# Note: oauth_state_store dictionary REMOVED - all flows use Redis

# ===========================================
# REDIS CONNECTION FOR OAUTH STATE STORAGE
# ===========================================
redis_client: Optional[redis.Redis] = None

async def get_redis() -> redis.Redis:
    """Get or create Redis connection for OAuth state storage"""
    global redis_client
    if redis_client is None:
        redis_password = os.getenv("REDIS_PASSWORD", "")
        if redis_password:
            # Password authentication - use password parameter directly (not URL-encoded in URL)
            redis_client = redis.Redis(
                host="redis",
                port=6379,
                password=redis_password,
                encoding="utf-8",
                decode_responses=True
            )
        else:
            # No password - connect directly
            redis_client = await redis.from_url(
                "redis://redis:6379",
                encoding="utf-8",
                decode_responses=True
            )
    return redis_client

# ===========================================
# OAUTH HELPER FUNCTIONS
# ===========================================

def generate_pkce_pair() -> tuple[str, str]:
    """Generate PKCE code verifier and challenge"""
    # Generate random code verifier (43-128 characters)
    code_verifier = base64.urlsafe_b64encode(secrets.token_bytes(32)).decode('utf-8').rstrip('=')

    # Generate code challenge (SHA256 hash of verifier)
    code_challenge = base64.urlsafe_b64encode(
        hashlib.sha256(code_verifier.encode('utf-8')).digest()
    ).decode('utf-8').rstrip('=')

    return code_verifier, code_challenge

def generate_state() -> str:
    """Generate random state for OAuth flow"""
    return secrets.token_urlsafe(32)

# ===========================================
# REQUEST/RESPONSE MODELS
# ===========================================

class TidalOAuthInitRequest(BaseModel):
    """Request to initiate Tidal OAuth flow - credentials come from backend env vars"""
    redirect_uri: str = Field(..., min_length=1)

class TidalOAuthInitResponse(BaseModel):
    """Response containing OAuth authorization URL"""
    authorization_url: str
    state: str

class TidalDeviceCodeResponse(BaseModel):
    """Response from device code flow initialization"""
    device_code: str
    user_code: str
    verification_uri: str
    verification_uri_complete: str
    expires_in: int
    interval: int

class TidalAuthRequest(BaseModel):
    """Tidal OAuth credentials request"""
    client_id: str = Field(..., min_length=1)
    client_secret: str = Field(..., min_length=1)

class SpotifyAuthRequest(BaseModel):
    """Spotify OAuth credentials"""
    client_id: str = Field(..., min_length=1)
    client_secret: str = Field(..., min_length=1)

class AuthTestResponse(BaseModel):
    """Authentication test response"""
    valid: bool
    message: str
    service: str
    tested_at: datetime
    details: Optional[Dict[str, Any]] = None
    error: Optional[str] = None

# ===========================================
# TIDAL AUTHENTICATION
# ===========================================

@router.post("/test/tidal", response_model=AuthTestResponse)
async def test_tidal_auth(auth: TidalAuthRequest):
    """
    Test Tidal OAuth credentials using client credentials flow
    Validates against Tidal's OAuth token endpoint
    """
    try:
        # Tidal OAuth token endpoint
        token_url = "https://auth.tidal.com/v1/oauth2/token"

        # Prepare OAuth client credentials flow request
        token_data = {
            "client_id": auth.client_id,
            "client_secret": auth.client_secret,
            "grant_type": "client_credentials"
        }

        async with aiohttp.ClientSession() as session:
            # Attempt to get access token
            async with session.post(
                token_url,
                data=token_data,
                headers={'Content-Type': 'application/x-www-form-urlencoded'},
                timeout=aiohttp.ClientTimeout(total=10)
            ) as response:
                response_text = await response.text()

                if response.status == 200:
                    try:
                        token_result = await response.json() if response.content_type == 'application/json' else None

                        # Validate we got an access token
                        if token_result and 'access_token' in token_result:
                            # Test the token with a simple API call to catalog
                            test_url = "https://openapi.tidal.com/search"
                            test_headers = {
                                'Authorization': f"Bearer {token_result['access_token']}",
                                'Accept': 'application/json'
                            }
                            test_params = {
                                'query': 'test',
                                'limit': '1',
                                'type': 'TRACKS'
                            }

                            async with session.get(
                                test_url,
                                headers=test_headers,
                                params=test_params,
                                timeout=aiohttp.ClientTimeout(total=10)
                            ) as test_response:
                                if test_response.status == 200:
                                    return AuthTestResponse(
                                        valid=True,
                                        message="Tidal credentials are valid and working",
                                        service="tidal",
                                        tested_at=datetime.utcnow(),
                                        details={
                                            'token_type': token_result.get('token_type'),
                                            'expires_in': token_result.get('expires_in'),
                                            'scope': token_result.get('scope', 'default'),
                                            'api_access': 'confirmed'
                                        }
                                    )
                                else:
                                    return AuthTestResponse(
                                        valid=False,
                                        message="Tidal token obtained but API access failed",
                                        service="tidal",
                                        tested_at=datetime.utcnow(),
                                        error=f"API test failed: {test_response.status}"
                                    )
                        else:
                            return AuthTestResponse(
                                valid=False,
                                message="Tidal authentication succeeded but no access token received",
                                service="tidal",
                                tested_at=datetime.utcnow(),
                                error="Missing access_token in response"
                            )
                    except Exception as parse_error:
                        return AuthTestResponse(
                            valid=False,
                            message="Failed to parse Tidal response",
                            service="tidal",
                            tested_at=datetime.utcnow(),
                            error=str(parse_error)
                        )

                elif response.status == 401 or response.status == 400:
                    return AuthTestResponse(
                        valid=False,
                        message="Invalid Tidal credentials",
                        service="tidal",
                        tested_at=datetime.utcnow(),
                        error=f"Authentication failed: {response_text[:200]}"
                    )
                else:
                    return AuthTestResponse(
                        valid=False,
                        message=f"Tidal authentication failed: {response.status}",
                        service="tidal",
                        tested_at=datetime.utcnow(),
                        error=response_text[:200]
                    )

    except Exception as e:
        logger.error(f"Tidal authentication test failed: {str(e)}")
        return AuthTestResponse(
            valid=False,
            message=f"Tidal test failed: {str(e)}",
            service="tidal",
            tested_at=datetime.utcnow(),
            error=str(e)
        )

# ===========================================
# SPOTIFY AUTHENTICATION
# ===========================================

@router.post("/test/spotify", response_model=AuthTestResponse)
async def test_spotify_auth(auth: SpotifyAuthRequest):
    """
    Test Spotify OAuth credentials using client credentials flow
    """
    try:
        # Encode credentials for Basic Auth
        auth_str = f"{auth.client_id}:{auth.client_secret}"
        auth_bytes = auth_str.encode('utf-8')
        auth_base64 = base64.b64encode(auth_bytes).decode('utf-8')

        headers = {
            'Authorization': f'Basic {auth_base64}',
            'Content-Type': 'application/x-www-form-urlencoded'
        }
        data = {'grant_type': 'client_credentials'}

        async with aiohttp.ClientSession() as session:
            async with session.post(
                'https://accounts.spotify.com/api/token',
                headers=headers,
                data=data,
                timeout=aiohttp.ClientTimeout(total=10)
            ) as response:
                if response.status == 200:
                    token_data = await response.json()

                    # Test the token by making a simple API call
                    test_headers = {
                        'Authorization': f"Bearer {token_data['access_token']}"
                    }
                    async with session.get(
                        'https://api.spotify.com/v1/browse/categories?limit=1',
                        headers=test_headers,
                        timeout=aiohttp.ClientTimeout(total=10)
                    ) as test_response:
                        if test_response.status == 200:
                            return AuthTestResponse(
                                valid=True,
                                message="Spotify credentials are valid and working",
                                service="spotify",
                                tested_at=datetime.utcnow(),
                                details={
                                    'token_type': token_data.get('token_type'),
                                    'expires_in': token_data.get('expires_in'),
                                    'scope': token_data.get('scope', 'default'),
                                    'api_access': 'confirmed'
                                }
                            )
                        else:
                            return AuthTestResponse(
                                valid=False,
                                message="Spotify token obtained but API access failed",
                                service="spotify",
                                tested_at=datetime.utcnow(),
                                error=f"API test failed: {test_response.status}"
                            )

                elif response.status == 401:
                    return AuthTestResponse(
                        valid=False,
                        message="Invalid Spotify credentials",
                        service="spotify",
                        tested_at=datetime.utcnow(),
                        error="Authentication failed - check client ID and secret"
                    )
                else:
                    error_text = await response.text()
                    return AuthTestResponse(
                        valid=False,
                        message=f"Spotify authentication failed: {response.status}",
                        service="spotify",
                        tested_at=datetime.utcnow(),
                        error=error_text
                    )

    except Exception as e:
        logger.error(f"Spotify authentication test failed: {str(e)}")
        return AuthTestResponse(
            valid=False,
            message=f"Spotify test failed: {str(e)}",
            service="spotify",
            tested_at=datetime.utcnow(),
            error=str(e)
        )

# ===========================================
# SPOTIFY OAUTH AUTHORIZATION CODE FLOW
# ===========================================

@router.get("/spotify/authorize")
async def spotify_authorize(
    redirect_uri: str = Query(..., description="Redirect URI configured in Spotify Dashboard"),
    state: Optional[str] = Query(None, description="Optional state parameter for CSRF protection")
):
    """
    Step 1: Redirect user to Spotify authorization page with PKCE

    SECURITY: Uses PKCE (Proof Key for Code Exchange) to prevent authorization code interception attacks.
    This is required by Spotify for SPAs and mobile apps as of OAuth 2.1 best practices.

    Credentials are loaded from environment variables (SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET)

    Redirect URI options for local development (Spotify requirement as of April 2025):
    - http://127.0.0.1:8082/api/v1/music-auth/spotify/callback (NOT localhost!)
    - http://127.0.0.1:3006/callback/spotify (if handling in frontend)

    IMPORTANT: Spotify no longer allows 'localhost' as redirect URI.
    Use loopback IP literals: 127.0.0.1 (IPv4) or [::1] (IPv6)

    Scopes requested:
    - user-read-email: Read user email
    - user-read-private: Read user profile
    - playlist-read-private: Read private playlists
    - playlist-read-collaborative: Read collaborative playlists
    - user-library-read: Read saved tracks
    - user-top-read: Read top artists and tracks
    """
    # Validate credentials are configured
    if not SPOTIFY_CLIENT_ID or not SPOTIFY_CLIENT_SECRET:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Spotify credentials not configured. Set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET environment variables."
        )

    # Generate state if not provided (CSRF protection)
    if not state:
        state = secrets.token_urlsafe(32)

    # Generate PKCE pair for authorization code flow security (OAuth 2.1 Best Practice)
    code_verifier, code_challenge = generate_pkce_pair()

    # Store state and PKCE verifier in Redis with service-specific namespace (2025 Best Practice)
    # This prevents state collisions between Spotify and Tidal OAuth flows
    r = await get_redis()
    oauth_data = {
        'code_verifier': code_verifier,  # PKCE verifier for token exchange
        'client_id': SPOTIFY_CLIENT_ID,
        'client_secret': SPOTIFY_CLIENT_SECRET,  # Store securely server-side
        'redirect_uri': redirect_uri,
        'created_at': time.time(),
        'service': 'spotify'
    }
    await r.setex(
        f"oauth:spotify:{state}",  # Service-specific namespace
        600,  # 10 minutes TTL (IETF Best Practice)
        json.dumps(oauth_data)
    )

    logger.info(f"🎵 [SPOTIFY] Stored OAuth state with PKCE in Redis: oauth:spotify:{state[:8]}...")

    # Spotify authorization scopes
    scopes = [
        # User Profile & Library (Read-only)
        'user-read-email',
        'user-read-private',
        'user-library-read',
        'user-top-read',

        # Playlists (Read)
        'playlist-read-private',
        'playlist-read-collaborative',

        # Playlists (Write - for exporting DJ sets)
        'playlist-modify-public',
        'playlist-modify-private',

        # Playback Control (for DJ interface preview)
        'user-modify-playback-state',
        'user-read-playback-state',
        'user-read-currently-playing',

        # Recently Played (for recommendations)
        'user-read-recently-played'
    ]

    # Build authorization URL with PKCE parameters
    auth_params = {
        'client_id': SPOTIFY_CLIENT_ID,
        'response_type': 'code',
        'redirect_uri': redirect_uri,
        'state': state,
        'scope': ' '.join(scopes),
        'code_challenge': code_challenge,       # PKCE challenge (SHA256 of verifier)
        'code_challenge_method': 'S256',       # PKCE method (SHA256)
        'show_dialog': 'false'  # Set to 'true' to force re-approval
    }

    auth_url = f"https://accounts.spotify.com/authorize?{urllib.parse.urlencode(auth_params)}"

    logger.info(f"🎵 [SPOTIFY] Redirecting to authorization with PKCE (client_id: {SPOTIFY_CLIENT_ID[:10]}...)")
    return RedirectResponse(url=auth_url)

@router.get("/spotify/callback")
async def spotify_callback(
    code: str = Query(..., description="Authorization code from Spotify"),
    state: str = Query(..., description="State parameter for validation"),
    error: Optional[str] = Query(None, description="Error from Spotify if authorization failed")
):
    """
    Step 2: Handle Spotify OAuth callback with PKCE

    This endpoint receives the authorization code from Spotify and exchanges it for access tokens.

    SECURITY:
    - Client secret retrieved from Redis (stored server-side), never exposed to frontend
    - PKCE code_verifier retrieved from Redis for secure token exchange
    - State parameter validated to prevent CSRF attacks
    """
    try:
        # Handle authorization errors
        if error:
            logger.error(f"Spotify authorization error: {error}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Spotify authorization failed: {error}"
            )

        # Validate state parameter (CSRF protection) - retrieve from Redis
        r = await get_redis()
        oauth_data_json = await r.get(f"oauth:spotify:{state}")

        if not oauth_data_json:
            logger.error(f"🎵 [SPOTIFY] OAuth state not found or expired for state: {state[:8]}...")
            raise HTTPException(
                status_code=400,
                detail="Invalid or expired state parameter. Please try connecting again."
            )

        oauth_data = json.loads(oauth_data_json)
        redirect_uri = oauth_data['redirect_uri']

        # Validate service match (prevent cross-service attacks)
        if oauth_data.get('service') != 'spotify':
            logger.error(f"🎵 [SPOTIFY] Service mismatch! Expected 'spotify', got '{oauth_data.get('service')}'")
            raise HTTPException(
                status_code=400,
                detail="Service mismatch detected. Please restart the authentication flow."
            )

        logger.info(f"🎵 [SPOTIFY] Retrieved OAuth state from Redis for state: {state[:8]}...")

        # Clean up state from Redis (one-time use, IETF Best Practice)
        await r.delete(f"oauth:spotify:{state}")
        logger.info(f"🎵 [SPOTIFY] Deleted OAuth state from Redis (one-time use)")

        logger.info(f"🎵 [SPOTIFY] Exchanging authorization code for tokens (state: {state[:8]}...)")

        # Exchange authorization code for access token
        token_url = 'https://accounts.spotify.com/api/token'

        # Encode credentials for Basic Auth (retrieve from Redis, not env vars)
        auth_str = f"{oauth_data['client_id']}:{oauth_data['client_secret']}"
        auth_bytes = auth_str.encode('utf-8')
        auth_base64 = base64.b64encode(auth_bytes).decode('utf-8')

        headers = {
            'Authorization': f'Basic {auth_base64}',
            'Content-Type': 'application/x-www-form-urlencoded'
        }

        data = {
            'grant_type': 'authorization_code',
            'code': code,
            'redirect_uri': redirect_uri,
            'code_verifier': oauth_data['code_verifier']  # PKCE verifier from Redis
        }

        async with aiohttp.ClientSession() as session:
            async with session.post(
                token_url,
                headers=headers,
                data=data,
                timeout=aiohttp.ClientTimeout(total=10)
            ) as response:
                result = await response.json()

                if response.status == 200:
                    # Successfully obtained tokens
                    logger.info("🎵 [SPOTIFY] Successfully exchanged authorization code for tokens")

                    # Store tokens in database for enrichment service to use
                    try:
                        db_pool = await get_db_pool()
                        expires_at = datetime.now() + timedelta(seconds=result['expires_in'])

                        async with db_pool.acquire() as conn:
                            await conn.execute("""
                                INSERT INTO user_oauth_tokens (service, user_id, access_token, refresh_token, token_type, expires_at, scope)
                                VALUES ($1, $2, $3, $4, $5, $6, $7)
                                ON CONFLICT (service, user_id)
                                DO UPDATE SET
                                    access_token = EXCLUDED.access_token,
                                    refresh_token = EXCLUDED.refresh_token,
                                    token_type = EXCLUDED.token_type,
                                    expires_at = EXCLUDED.expires_at,
                                    scope = EXCLUDED.scope,
                                    updated_at = CURRENT_TIMESTAMP
                            """,
                                'spotify',
                                'default_user',  # Single-user mode for now
                                result['access_token'],
                                result.get('refresh_token'),
                                result['token_type'],
                                expires_at,
                                result.get('scope')
                            )
                        logger.info("🎵 [SPOTIFY] Stored user OAuth tokens in database for enrichment service")
                    except Exception as db_error:
                        logger.error(f"Failed to store Spotify tokens in database: {db_error}")
                        # Don't fail the request, tokens are still returned to frontend

                    return JSONResponse({
                        "success": True,
                        "access_token": result['access_token'],
                        "token_type": result['token_type'],
                        "expires_in": result['expires_in'],
                        "refresh_token": result.get('refresh_token'),
                        "scope": result.get('scope')
                    })
                else:
                    error_msg = result.get('error_description', result.get('error', 'Unknown error'))
                    logger.error(f"🎵 [SPOTIFY] Token exchange failed: {error_msg}")
                    raise HTTPException(
                        status_code=response.status,
                        detail=f"Token exchange failed: {error_msg}"
                    )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Spotify OAuth callback failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"OAuth callback failed: {str(e)}")

class StoreTokenRequest(BaseModel):
    """Request to store OAuth tokens in database"""
    service: str = Field(..., description="Service name (spotify, tidal)")
    access_token: str = Field(..., min_length=1)
    refresh_token: Optional[str] = None
    expires_in: int = Field(..., description="Token lifetime in seconds")
    token_type: str = Field(default="Bearer")
    scope: Optional[str] = None

@router.post("/store-token")
async def store_oauth_token(request: StoreTokenRequest):
    """
    Store OAuth tokens in database for enrichment service to use

    This endpoint allows frontend to persist tokens from localStorage into the database,
    enabling the backend enrichment service to use user OAuth tokens for API calls.
    """
    try:
        db_pool = await get_db_pool()
        expires_at = datetime.now() + timedelta(seconds=request.expires_in)

        async with db_pool.acquire() as conn:
            await conn.execute("""
                INSERT INTO user_oauth_tokens (service, user_id, access_token, refresh_token, token_type, expires_at, scope)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                ON CONFLICT (service, user_id)
                DO UPDATE SET
                    access_token = EXCLUDED.access_token,
                    refresh_token = EXCLUDED.refresh_token,
                    token_type = EXCLUDED.token_type,
                    expires_at = EXCLUDED.expires_at,
                    scope = EXCLUDED.scope,
                    updated_at = CURRENT_TIMESTAMP
            """,
                request.service,
                'default_user',  # Single-user mode for now
                request.access_token,
                request.refresh_token,
                request.token_type,
                expires_at,
                request.scope
            )

        logger.info(f"✅ [{request.service.upper()}] Stored user OAuth tokens in database")

        return JSONResponse({
            "success": True,
            "message": f"{request.service} tokens stored successfully",
            "expires_at": expires_at.isoformat()
        })

    except Exception as e:
        logger.error(f"Failed to store {request.service} tokens: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to store tokens: {str(e)}"
        )

@router.post("/spotify/token")
async def spotify_exchange_token(
    authorization_code: str = Query(..., description="Authorization code from callback"),
    redirect_uri: str = Query(..., description="Same redirect URI used in authorization")
):
    """
    Step 3: Exchange authorization code for access and refresh tokens (DEPRECATED - Manual Flow)

    ⚠️ WARNING: This endpoint does NOT support PKCE and should only be used for testing.
    For production, use the main OAuth flow (/spotify/authorize -> /spotify/callback) which includes PKCE.

    Credentials are loaded from environment variables (SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET)
    Call this endpoint with the authorization code received in the callback.

    SECURITY LIMITATION: Without PKCE, this flow is vulnerable to authorization code interception.
    """
    # Validate credentials are configured
    if not SPOTIFY_CLIENT_ID or not SPOTIFY_CLIENT_SECRET:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Spotify credentials not configured. Set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET environment variables."
        )

    try:
        logger.info(f"🎵 [SPOTIFY] Exchanging authorization code for tokens...")

        # Prepare token exchange request
        token_url = 'https://accounts.spotify.com/api/token'

        auth_str = f"{SPOTIFY_CLIENT_ID}:{SPOTIFY_CLIENT_SECRET}"
        auth_bytes = auth_str.encode('utf-8')
        auth_base64 = base64.b64encode(auth_bytes).decode('utf-8')

        headers = {
            'Authorization': f'Basic {auth_base64}',
            'Content-Type': 'application/x-www-form-urlencoded'
        }

        data = {
            'grant_type': 'authorization_code',
            'code': authorization_code,
            'redirect_uri': redirect_uri
        }

        async with aiohttp.ClientSession() as session:
            async with session.post(
                token_url,
                headers=headers,
                data=data,
                timeout=aiohttp.ClientTimeout(total=10)
            ) as response:
                result = await response.json()

                if response.status == 200:
                    # Successfully obtained tokens
                    logger.info("🎵 [SPOTIFY] Successfully exchanged authorization code for tokens")

                    return JSONResponse({
                        "success": True,
                        "access_token": result['access_token'],
                        "token_type": result['token_type'],
                        "expires_in": result['expires_in'],
                        "refresh_token": result.get('refresh_token'),
                        "scope": result.get('scope'),
                        "message": "Tokens obtained successfully. Store refresh_token securely for long-term access."
                    })
                else:
                    error_msg = result.get('error_description', result.get('error', 'Unknown error'))
                    logger.error(f"🎵 [SPOTIFY] Token exchange failed: {error_msg}")
                    raise HTTPException(
                        status_code=response.status,
                        detail=f"Token exchange failed: {error_msg}"
                    )

    except aiohttp.ClientError as e:
        logger.error(f"Network error during token exchange: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Network error: {str(e)}"
        )
    except Exception as e:
        logger.error(f"Unexpected error during token exchange: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unexpected error: {str(e)}"
        )

@router.post("/spotify/refresh")
async def spotify_refresh_token(
    refresh_token: str = Query(..., description="Spotify refresh token")
):
    """
    Refresh Spotify access token using refresh token

    SECURITY: Credentials loaded from backend environment variables only.
    Client secret is NEVER exposed to frontend - retrieved from SPOTIFY_CLIENT_SECRET env var.

    Access tokens expire after 1 hour. Use this endpoint to get a new access token.
    The refresh token must be provided by the frontend (stored securely in their session).
    """
    # Validate backend has credentials configured
    if not SPOTIFY_CLIENT_ID or not SPOTIFY_CLIENT_SECRET:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Spotify credentials not configured. Set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET environment variables."
        )

    try:
        token_url = 'https://accounts.spotify.com/api/token'

        # Use backend credentials from environment variables (NEVER from frontend)
        auth_str = f"{SPOTIFY_CLIENT_ID}:{SPOTIFY_CLIENT_SECRET}"
        auth_bytes = auth_str.encode('utf-8')
        auth_base64 = base64.b64encode(auth_bytes).decode('utf-8')

        headers = {
            'Authorization': f'Basic {auth_base64}',
            'Content-Type': 'application/x-www-form-urlencoded'
        }

        data = {
            'grant_type': 'refresh_token',
            'refresh_token': refresh_token
        }

        async with aiohttp.ClientSession() as session:
            async with session.post(
                token_url,
                headers=headers,
                data=data,
                timeout=aiohttp.ClientTimeout(total=10)
            ) as response:
                result = await response.json()

                if response.status == 200:
                    logger.info("🎵 [SPOTIFY] Successfully refreshed access token")

                    # Store refreshed tokens in database for enrichment service
                    try:
                        db_pool = await get_db_pool()
                        expires_at = datetime.now() + timedelta(seconds=result['expires_in'])

                        async with db_pool.acquire() as conn:
                            await conn.execute("""
                                UPDATE user_oauth_tokens
                                SET access_token = $1,
                                    expires_at = $2,
                                    token_type = $3,
                                    scope = $4,
                                    updated_at = CURRENT_TIMESTAMP
                                WHERE service = 'spotify' AND user_id = 'default_user'
                            """,
                                result['access_token'],
                                expires_at,
                                result['token_type'],
                                result.get('scope')
                            )
                        logger.info("🎵 [SPOTIFY] Updated tokens in database")
                    except Exception as db_error:
                        logger.error(f"Failed to update Spotify tokens in database: {db_error}")
                        # Don't fail the request, tokens are still returned to frontend

                    return JSONResponse({
                        "success": True,
                        "access_token": result['access_token'],
                        "token_type": result['token_type'],
                        "expires_in": result['expires_in'],
                        "scope": result.get('scope')
                    })
                else:
                    error_msg = result.get('error_description', result.get('error', 'Unknown error'))
                    logger.error(f"🎵 [SPOTIFY] Token refresh failed: {error_msg}")
                    raise HTTPException(
                        status_code=response.status,
                        detail=f"Token refresh failed: {error_msg}"
                    )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error refreshing Spotify token: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error: {str(e)}"
        )

# ===========================================
# SPOTIFY AUDIO FEATURES (DJ Mixing Features)
# ===========================================

def convert_to_camelot(key: int, mode: int) -> str:
    """
    Convert Spotify's pitch class (0-11) and mode (0=minor, 1=major) to Camelot notation

    Spotify format:
    - Key: 0 = C, 1 = C#, 2 = D, ..., 11 = B
    - Mode: 0 = Minor, 1 = Major

    Camelot Wheel:
    - Major keys: 1B-12B (outer wheel)
    - Minor keys: 1A-12A (inner wheel)
    """
    # Camelot wheel mapping (clockwise starting at 8B = C Major)
    camelot_map = {
        # Major keys (mode = 1)
        1: {0: '8B', 1: '3B', 2: '10B', 3: '5B', 4: '12B', 5: '7B',
            6: '2B', 7: '9B', 8: '4B', 9: '11B', 10: '6B', 11: '1B'},
        # Minor keys (mode = 0)
        0: {0: '5A', 1: '12A', 2: '7A', 3: '2A', 4: '9A', 5: '4A',
            6: '11A', 7: '6A', 8: '1A', 9: '8A', 10: '3A', 11: '10A'}
    }

    return camelot_map[mode][key]

def key_to_string(key: int, mode: int) -> str:
    """Convert Spotify key (0-11) and mode (0-1) to readable key name"""
    key_names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
    mode_name = 'major' if mode == 1 else 'minor'
    return f"{key_names[key]} {mode_name}"

@router.get("/spotify/track/{track_id}/audio-features")
async def get_spotify_audio_features(
    track_id: str,
    access_token: str = Query(..., description="Spotify access token")
):
    """
    Get audio features for DJ mixing (tempo, key, energy, etc.)

    This endpoint is critical for SongNodes DJ functionality:
    - BPM/Tempo: For beatmatching
    - Key: For harmonic mixing (converted to Camelot notation)
    - Energy: For energy flow matching
    - Danceability: For track selection
    - Valence: For mood matching

    No additional scopes required - works with any valid access token!
    """
    try:
        logger.info(f"🎵 [SPOTIFY AUDIO FEATURES] Fetching for track: {track_id}")

        async with aiohttp.ClientSession() as session:
            headers = {'Authorization': f'Bearer {access_token}'}

            # Fetch audio features
            async with session.get(
                f'https://api.spotify.com/v1/audio-features/{track_id}',
                headers=headers,
                timeout=aiohttp.ClientTimeout(total=10)
            ) as response:
                if response.status == 200:
                    features = await response.json()

                    # Convert Spotify key to Camelot notation for DJ mixing
                    camelot_key = convert_to_camelot(features['key'], features['mode'])
                    key_string = key_to_string(features['key'], features['mode'])

                    logger.info(f"🎵 [SPOTIFY] Audio features retrieved: BPM={features['tempo']:.1f}, Key={camelot_key}")

                    return JSONResponse({
                        "success": True,
                        "track_id": track_id,
                        "audio_features": {
                            # DJ Mixing Essentials
                            "bpm": round(features['tempo'], 2),
                            "key": features['key'],
                            "key_string": key_string,
                            "mode": 'major' if features['mode'] == 1 else 'minor',
                            "camelot_key": camelot_key,
                            "time_signature": features['time_signature'],

                            # Energy & Mood
                            "energy": round(features['energy'], 3),
                            "danceability": round(features['danceability'], 3),
                            "valence": round(features['valence'], 3),

                            # Additional Features
                            "acousticness": round(features['acousticness'], 3),
                            "instrumentalness": round(features['instrumentalness'], 3),
                            "liveness": round(features['liveness'], 3),
                            "loudness": round(features['loudness'], 2),
                            "speechiness": round(features['speechiness'], 3)
                        }
                    })
                elif response.status == 401:
                    raise HTTPException(
                        status_code=401,
                        detail="Invalid or expired Spotify access token. Please reconnect Spotify."
                    )
                elif response.status == 404:
                    raise HTTPException(
                        status_code=404,
                        detail=f"Audio features not found for track: {track_id}"
                    )
                else:
                    error_data = await response.json()
                    error_msg = error_data.get('error', {}).get('message', 'Unknown error')
                    logger.error(f"🎵 [SPOTIFY] Audio features failed: {error_msg}")
                    raise HTTPException(
                        status_code=response.status,
                        detail=f"Spotify API error: {error_msg}"
                    )

    except aiohttp.ClientError as e:
        logger.error(f"Network error fetching audio features: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Spotify API is currently unavailable. Please try again later."
        )
    except Exception as e:
        logger.error(f"Error fetching audio features: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error: {str(e)}"
        )

@router.post("/spotify/tracks/audio-features/batch")
async def get_batch_audio_features(
    track_ids: list[str] = Query(..., description="List of Spotify track IDs (max 100)"),
    access_token: str = Query(..., description="Spotify access token")
):
    """
    Batch fetch audio features for multiple tracks (up to 100 at once)
    More efficient than individual requests for large libraries
    """
    if len(track_ids) > 100:
        raise HTTPException(
            status_code=400,
            detail="Maximum 100 track IDs allowed per request"
        )

    try:
        logger.info(f"🎵 [SPOTIFY BATCH] Fetching audio features for {len(track_ids)} tracks")

        async with aiohttp.ClientSession() as session:
            headers = {'Authorization': f'Bearer {access_token}'}

            # Spotify batch endpoint
            ids_param = ','.join(track_ids)
            async with session.get(
                f'https://api.spotify.com/v1/audio-features?ids={ids_param}',
                headers=headers,
                timeout=aiohttp.ClientTimeout(total=30)
            ) as response:
                if response.status == 200:
                    data = await response.json()

                    # Process each track's features
                    processed_features = []
                    for features in data['audio_features']:
                        if features:  # Some tracks may not have features
                            camelot_key = convert_to_camelot(features['key'], features['mode'])
                            key_string = key_to_string(features['key'], features['mode'])

                            processed_features.append({
                                "track_id": features['id'],
                                "bpm": round(features['tempo'], 2),
                                "key": features['key'],
                                "key_string": key_string,
                                "mode": 'major' if features['mode'] == 1 else 'minor',
                                "camelot_key": camelot_key,
                                "time_signature": features['time_signature'],
                                "energy": round(features['energy'], 3),
                                "danceability": round(features['danceability'], 3),
                                "valence": round(features['valence'], 3),
                                "acousticness": round(features['acousticness'], 3),
                                "instrumentalness": round(features['instrumentalness'], 3),
                                "liveness": round(features['liveness'], 3),
                                "loudness": round(features['loudness'], 2),
                                "speechiness": round(features['speechiness'], 3)
                            })

                    logger.info(f"🎵 [SPOTIFY BATCH] Successfully processed {len(processed_features)}/{len(track_ids)} tracks")

                    return JSONResponse({
                        "success": True,
                        "total_requested": len(track_ids),
                        "total_processed": len(processed_features),
                        "audio_features": processed_features
                    })
                else:
                    error_data = await response.json()
                    raise HTTPException(
                        status_code=response.status,
                        detail=error_data.get('error', {}).get('message', 'Batch request failed')
                    )

    except Exception as e:
        logger.error(f"Error in batch audio features: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error: {str(e)}"
        )

@router.get("/spotify/search")
async def search_spotify_tracks(
    query: str = Query(..., description="Search query (track name, artist, etc.)"),
    access_token: str = Query(..., description="Spotify access token"),
    limit: int = Query(20, ge=1, le=50, description="Number of results (1-50)")
):
    """
    Search Spotify catalog - useful for matching Tidal tracks to Spotify
    Can search by track name, artist, ISRC, or combination
    """
    try:
        logger.info(f"🎵 [SPOTIFY SEARCH] Query: {query}")

        async with aiohttp.ClientSession() as session:
            headers = {'Authorization': f'Bearer {access_token}'}

            params = {
                'q': query,
                'type': 'track',
                'limit': limit
            }

            async with session.get(
                'https://api.spotify.com/v1/search',
                headers=headers,
                params=params,
                timeout=aiohttp.ClientTimeout(total=10)
            ) as response:
                if response.status == 200:
                    data = await response.json()

                    tracks = []
                    for item in data['tracks']['items']:
                        tracks.append({
                            "id": item['id'],
                            "name": item['name'],
                            "artists": [artist['name'] for artist in item['artists']],
                            "album": item['album']['name'],
                            "isrc": item['external_ids'].get('isrc'),
                            "duration_ms": item['duration_ms'],
                            "popularity": item['popularity'],
                            "preview_url": item['preview_url']
                        })

                    return JSONResponse({
                        "success": True,
                        "total": data['tracks']['total'],
                        "tracks": tracks
                    })
                else:
                    error_data = await response.json()
                    raise HTTPException(
                        status_code=response.status,
                        detail=error_data.get('error', {}).get('message', 'Search failed')
                    )

    except Exception as e:
        logger.error(f"Error searching Spotify: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error: {str(e)}"
        )

# ===========================================
# TIDAL DEVICE CODE FLOW (Recommended for localhost)
# ===========================================

@router.post("/tidal/device/init", response_model=TidalDeviceCodeResponse)
async def init_tidal_device_flow(client_id: str = Query(...), client_secret: str = Query(...)):
    """
    Initiate Tidal Device Code flow - perfect for localhost development
    No redirect URI needed!

    Returns a user code and verification URL for the user to visit
    """
    try:
        device_url = "https://auth.tidal.com/v1/oauth2/device_authorization"

        scopes = [
            'collection.read',
            'collection.write',
            'playlists.read',
            'playlists.write',
            'recommendations.read',
            'search.read'
        ]

        data = {
            'client_id': client_id,
            'scope': ' '.join(scopes)
        }

        async with aiohttp.ClientSession() as session:
            async with session.post(
                device_url,
                data=data,
                headers={'Content-Type': 'application/x-www-form-urlencoded'},
                timeout=aiohttp.ClientTimeout(total=10)
            ) as response:
                if response.status == 200:
                    result = await response.json()

                    # Store device code for polling in Redis (10 minutes TTL)
                    # Device code flow uses longer TTL than auth code (user must manually authorize)
                    device_code = result['device_code']
                    r = await get_redis()
                    oauth_data = {
                        'client_id': client_id,
                        'client_secret': client_secret,
                        'created_at': time.time(),
                        'service': 'tidal',
                        'flow_type': 'device_code'
                    }
                    await r.setex(
                        f"oauth:tidal:device:{device_code}",  # Namespace for device code flow
                        600,  # 10 minutes TTL (IETF Best Practice)
                        json.dumps(oauth_data)
                    )

                    logger.info(f"🎵 [TIDAL DEVICE] Stored device code in Redis with key: oauth:tidal:device:{device_code[:8]}...")

                    return TidalDeviceCodeResponse(**result)
                else:
                    error_text = await response.text()
                    raise HTTPException(
                        status_code=response.status,
                        detail=f"Device authorization failed: {error_text}"
                    )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Device code flow init failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/tidal/device/poll")
async def poll_tidal_device_token(device_code: str = Query(...)):
    """
    Poll for device token - call this repeatedly until user authorizes
    Returns tokens when authorization is complete
    """
    try:
        # Retrieve device code data from Redis
        r = await get_redis()
        oauth_data_json = await r.get(f"oauth:tidal:device:{device_code}")

        if not oauth_data_json:
            logger.error(f"🎵 [TIDAL DEVICE] Device code not found or expired: {device_code[:8]}...")
            raise HTTPException(
                status_code=400,
                detail="Invalid or expired device code. Please restart the device authentication flow."
            )

        oauth_data = json.loads(oauth_data_json)
        logger.info(f"🎵 [TIDAL DEVICE] Retrieved device code from Redis: {device_code[:8]}...")

        token_url = "https://auth.tidal.com/v1/oauth2/token"
        data = {
            'client_id': oauth_data['client_id'],
            'client_secret': oauth_data['client_secret'],
            'device_code': device_code,
            'grant_type': 'urn:ietf:params:oauth:grant-type:device_code'
        }

        async with aiohttp.ClientSession() as session:
            async with session.post(
                token_url,
                data=data,
                headers={'Content-Type': 'application/x-www-form-urlencoded'},
                timeout=aiohttp.ClientTimeout(total=10)
            ) as response:
                result = await response.json()

                if response.status == 200:
                    # Success! Clean up device code from Redis (one-time use, IETF Best Practice)
                    await r.delete(f"oauth:tidal:device:{device_code}")
                    logger.info(f"🎵 [TIDAL DEVICE] Deleted device code from Redis (authorization successful)")

                    return JSONResponse(content={
                        'success': True,
                        'access_token': result.get('access_token'),
                        'refresh_token': result.get('refresh_token'),
                        'expires_in': result.get('expires_in'),
                        'token_type': result.get('token_type')
                    })
                elif response.status == 400 and result.get('error') == 'authorization_pending':
                    # User hasn't authorized yet - frontend should keep polling
                    return JSONResponse(
                        status_code=202,
                        content={'pending': True, 'message': 'User has not authorized yet'}
                    )
                elif response.status == 400 and result.get('error') == 'slow_down':
                    # Polling too fast
                    return JSONResponse(
                        status_code=429,
                        content={'error': 'slow_down', 'message': 'Polling too frequently'}
                    )
                else:
                    # Other error
                    raise HTTPException(
                        status_code=response.status,
                        detail=result.get('error_description', result.get('error', 'Unknown error'))
                    )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Device token polling failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# ===========================================
# TIDAL OAUTH AUTHORIZATION CODE FLOW
# ===========================================

@router.post("/tidal/oauth/init", response_model=TidalOAuthInitResponse)
async def init_tidal_oauth(request: TidalOAuthInitRequest):
    """
    Initiate Tidal OAuth Authorization Code flow with PKCE
    Returns the authorization URL for the user to visit

    SECURITY: Client credentials are read from backend environment variables,
    never exposed to frontend. This follows OAuth 2.1 best practices.
    """
    try:
        # Validate backend has Tidal credentials configured
        if not TIDAL_CLIENT_ID or not TIDAL_CLIENT_SECRET:
            raise HTTPException(
                status_code=500,
                detail="Tidal OAuth not configured. Please set TIDAL_CLIENT_ID and TIDAL_CLIENT_SECRET environment variables."
            )

        # Generate PKCE pair and state
        code_verifier, code_challenge = generate_pkce_pair()
        state = generate_state()

        # Store PKCE verifier, client secret, and redirect URI in Redis (expires in 10 minutes)
        # SECURITY: Client secret stored server-side in Redis, never sent to frontend
        r = await get_redis()
        oauth_data = {
            'code_verifier': code_verifier,
            'client_id': TIDAL_CLIENT_ID,
            'client_secret': TIDAL_CLIENT_SECRET,  # Stored securely server-side
            'redirect_uri': request.redirect_uri,
            'created_at': time.time()
        }
        await r.setex(
            f"oauth:tidal:{state}",
            600,  # 10 minutes TTL
            json.dumps(oauth_data)
        )

        # Build authorization URL
        # Scopes from Tidal Developer Portal configuration (2025 Update - Modern API)
        # NOTE: Tidal migrated from legacy scopes (r_usr/w_usr) to modern scopes (user.read/user.write)
        # 'playback' does NOT mean audio streaming - it's for playlist/queue metadata access
        scopes = [
            'user.read',             # REQUIRED: Read user profile (replaces legacy 'r_usr')
            'playback',              # REQUIRED: Access to playback-related APIs (metadata, not streaming)
            'collection.read',       # Read access to user's "My Collection"
            'collection.write',      # Write access to user's "My Collection"
            'playlists.read',        # Required to list playlists created by user
            'playlists.write',       # Write access to user's playlists
            'recommendations.read',  # Read access to user's personal recommendations
            'search.read'           # Required to read personalized search results
        ]

        auth_params = {
            'response_type': 'code',
            'client_id': TIDAL_CLIENT_ID,
            'redirect_uri': request.redirect_uri,
            'scope': ' '.join(scopes),
            'code_challenge': code_challenge,
            'code_challenge_method': 'S256',
            'state': state,
            'lang': 'en'  # Add language parameter
        }

        # Use the correct authorization endpoint for web apps
        authorization_url = f"https://login.tidal.com/authorize?{urllib.parse.urlencode(auth_params)}"

        # Debug logging to help diagnose Tidal OAuth issues
        logger.info(f"Generated OAuth URL for client {TIDAL_CLIENT_ID[:8]}... with scopes: {', '.join(scopes)}")
        logger.info(f"OAuth Parameters: response_type={auth_params['response_type']}, "
                   f"redirect_uri={auth_params['redirect_uri']}, "
                   f"code_challenge_method={auth_params['code_challenge_method']}, "
                   f"state={state[:8]}..., "
                   f"lang={auth_params.get('lang', 'N/A')}")

        return TidalOAuthInitResponse(
            authorization_url=authorization_url,
            state=state
        )

    except Exception as e:
        logger.error(f"Failed to initialize Tidal OAuth: {str(e)}")
        raise HTTPException(status_code=500, detail=f"OAuth initialization failed: {str(e)}")

@router.get("/tidal/oauth/callback")
async def tidal_oauth_callback(
    code: str = Query(..., description="Authorization code from Tidal"),
    state: str = Query(..., description="State parameter for CSRF protection")
):
    """
    OAuth callback endpoint - exchanges authorization code for access token

    SECURITY: Client secret retrieved from Redis (stored during init),
    never exposed to frontend or URL parameters.
    """
    try:
        # Validate state and retrieve stored data from Redis
        r = await get_redis()
        oauth_data_json = await r.get(f"oauth:tidal:{state}")

        if not oauth_data_json:
            logger.error(f"OAuth state not found or expired for state: {state[:8]}...")
            raise HTTPException(status_code=400, detail="Invalid or expired state parameter. Please try connecting again.")

        oauth_data = json.loads(oauth_data_json)

        # Exchange authorization code for access token
        # SECURITY: client_secret comes from Redis, not from URL parameters
        token_url = "https://auth.tidal.com/v1/oauth2/token"
        token_data = {
            'grant_type': 'authorization_code',
            'code': code,
            'redirect_uri': oauth_data['redirect_uri'],
            'client_id': oauth_data['client_id'],
            'client_secret': oauth_data['client_secret'],  # Retrieved from Redis
            'code_verifier': oauth_data['code_verifier']
        }

        logger.info(f"Exchanging authorization code for tokens (state: {state[:8]}...)")

        async with aiohttp.ClientSession() as session:
            async with session.post(
                token_url,
                data=token_data,
                headers={'Content-Type': 'application/x-www-form-urlencoded'},
                timeout=aiohttp.ClientTimeout(total=10)
            ) as response:
                if response.status == 200:
                    token_result = await response.json()

                    # Clean up state from Redis
                    await r.delete(f"oauth:tidal:{state}")

                    # Return tokens to frontend
                    return JSONResponse(content={
                        'success': True,
                        'access_token': token_result.get('access_token'),
                        'refresh_token': token_result.get('refresh_token'),
                        'expires_in': token_result.get('expires_in'),
                        'token_type': token_result.get('token_type'),
                        'scope': token_result.get('scope')
                    })
                else:
                    error_text = await response.text()
                    logger.error(f"Tidal token exchange failed: {error_text}")
                    raise HTTPException(
                        status_code=response.status,
                        detail=f"Token exchange failed: {error_text[:200]}"
                    )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Tidal OAuth callback failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"OAuth callback failed: {str(e)}")

@router.post("/tidal/oauth/refresh")
async def refresh_tidal_token(
    refresh_token: str = Query(..., description="Refresh token"),
    client_id: str = Query(..., description="Client ID"),
    client_secret: str = Query(..., description="Client secret")
):
    """
    Refresh Tidal access token using refresh token
    """
    try:
        token_url = "https://auth.tidal.com/v1/oauth2/token"
        token_data = {
            'grant_type': 'refresh_token',
            'refresh_token': refresh_token,
            'client_id': client_id,
            'client_secret': client_secret
        }

        async with aiohttp.ClientSession() as session:
            async with session.post(
                token_url,
                data=token_data,
                headers={'Content-Type': 'application/x-www-form-urlencoded'},
                timeout=aiohttp.ClientTimeout(total=10)
            ) as response:
                if response.status == 200:
                    token_result = await response.json()
                    return JSONResponse(content={
                        'success': True,
                        'access_token': token_result.get('access_token'),
                        'refresh_token': token_result.get('refresh_token'),
                        'expires_in': token_result.get('expires_in'),
                        'token_type': token_result.get('token_type')
                    })
                else:
                    error_text = await response.text()
                    logger.error(f"Tidal token refresh failed: {error_text}")
                    raise HTTPException(
                        status_code=response.status,
                        detail=f"Token refresh failed: {error_text[:200]}"
                    )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Tidal token refresh failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Token refresh failed: {str(e)}")

# ===========================================
# HEALTH CHECK
# ===========================================

@router.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "music-auth"}

@router.get("/spotify/token/status")
async def get_spotify_token_status():
    """
    Check Spotify OAuth token status in database

    Returns token expiry information without exposing sensitive data
    """
    try:
        db_pool = await get_db_pool()

        async with db_pool.acquire() as conn:
            result = await conn.fetchrow("""
                SELECT
                    service,
                    CASE WHEN expires_at > CURRENT_TIMESTAMP THEN 'valid' ELSE 'expired' END as status,
                    expires_at,
                    EXTRACT(EPOCH FROM (expires_at - CURRENT_TIMESTAMP)) / 3600 as hours_until_expiry,
                    CASE WHEN refresh_token IS NOT NULL THEN true ELSE false END as has_refresh_token,
                    updated_at
                FROM user_oauth_tokens
                WHERE service = 'spotify' AND user_id = 'default_user'
                ORDER BY expires_at DESC
                LIMIT 1
            """)

            if not result:
                return JSONResponse(
                    status_code=404,
                    content={
                        "status": "not_found",
                        "message": "No Spotify OAuth token found in database. Please authenticate via /spotify/authorize endpoint."
                    }
                )

            return {
                "service": result['service'],
                "status": result['status'],
                "expires_at": result['expires_at'].isoformat(),
                "hours_until_expiry": round(result['hours_until_expiry'], 2) if result['hours_until_expiry'] > 0 else 0,
                "has_refresh_token": result['has_refresh_token'],
                "last_updated": result['updated_at'].isoformat(),
                "message": "Token is valid" if result['status'] == 'valid' else "Token is EXPIRED - use /spotify/token/refresh-manual to refresh"
            }

    except Exception as e:
        logger.error(f"Failed to get Spotify token status: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get token status: {str(e)}"
        )

@router.post("/spotify/token/refresh-manual")
async def manual_refresh_spotify_token():
    """
    Manually refresh Spotify OAuth token from database

    This endpoint retrieves the refresh token from database and
    exchanges it for a new access token. Useful for operators to
    manually fix expired tokens.
    """
    try:
        db_pool = await get_db_pool()

        # Get current refresh token
        async with db_pool.acquire() as conn:
            result = await conn.fetchrow("""
                SELECT refresh_token, expires_at
                FROM user_oauth_tokens
                WHERE service = 'spotify' AND user_id = 'default_user'
                ORDER BY expires_at DESC
                LIMIT 1
            """)

            if not result:
                raise HTTPException(
                    status_code=404,
                    detail="No Spotify OAuth token found. Please authenticate first."
                )

            if not result['refresh_token']:
                raise HTTPException(
                    status_code=400,
                    detail="No refresh token available. Please re-authenticate via /spotify/authorize"
                )

            refresh_token = result['refresh_token']

        # Validate backend has credentials configured
        if not SPOTIFY_CLIENT_ID or not SPOTIFY_CLIENT_SECRET:
            raise HTTPException(
                status_code=500,
                detail="Spotify credentials not configured on backend"
            )

        # Refresh the token
        token_url = 'https://accounts.spotify.com/api/token'

        auth_str = f"{SPOTIFY_CLIENT_ID}:{SPOTIFY_CLIENT_SECRET}"
        auth_bytes = auth_str.encode('utf-8')
        auth_base64 = base64.b64encode(auth_bytes).decode('utf-8')

        headers = {
            'Authorization': f'Basic {auth_base64}',
            'Content-Type': 'application/x-www-form-urlencoded'
        }

        data = {
            'grant_type': 'refresh_token',
            'refresh_token': refresh_token
        }

        async with aiohttp.ClientSession() as session:
            async with session.post(
                token_url,
                headers=headers,
                data=data,
                timeout=aiohttp.ClientTimeout(total=10)
            ) as response:
                result_data = await response.json()

                if response.status == 200:
                    logger.info("🎵 [SPOTIFY] Successfully refreshed access token (manual)")

                    # Store refreshed tokens in database
                    expires_at = datetime.now() + timedelta(seconds=result_data['expires_in'])

                    async with db_pool.acquire() as conn:
                        await conn.execute("""
                            UPDATE user_oauth_tokens
                            SET access_token = $1,
                                expires_at = $2,
                                token_type = $3,
                                scope = $4,
                                updated_at = CURRENT_TIMESTAMP
                            WHERE service = 'spotify' AND user_id = 'default_user'
                        """,
                            result_data['access_token'],
                            expires_at,
                            result_data['token_type'],
                            result_data.get('scope')
                        )

                    logger.info("🎵 [SPOTIFY] Updated tokens in database")

                    return JSONResponse({
                        "success": True,
                        "message": "Token refreshed successfully",
                        "expires_at": expires_at.isoformat(),
                        "expires_in_hours": round(result_data['expires_in'] / 3600, 2),
                        "token_type": result_data['token_type'],
                        "scope": result_data.get('scope')
                    })
                else:
                    error_msg = result_data.get('error_description', result_data.get('error', 'Unknown error'))
                    logger.error(f"🎵 [SPOTIFY] Manual token refresh failed: {error_msg}")
                    raise HTTPException(
                        status_code=response.status,
                        detail=f"Token refresh failed: {error_msg}"
                    )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Manual token refresh failed: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Manual refresh failed: {str(e)}"
        )