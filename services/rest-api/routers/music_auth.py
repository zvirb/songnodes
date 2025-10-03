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

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/music-auth", tags=["Music Authentication"])

# ===========================================
# MUSIC SERVICE CREDENTIALS FROM ENVIRONMENT
# ===========================================
TIDAL_CLIENT_ID = os.getenv("TIDAL_CLIENT_ID", "")
TIDAL_CLIENT_SECRET = os.getenv("TIDAL_CLIENT_SECRET", "")

SPOTIFY_CLIENT_ID = os.getenv("SPOTIFY_CLIENT_ID", "")
SPOTIFY_CLIENT_SECRET = os.getenv("SPOTIFY_CLIENT_SECRET", "")

# ===========================================
# OAUTH STATE STORAGE (In-memory for development)
# ===========================================
# In-memory storage for OAuth state/PKCE parameters
# TODO: Replace with Redis for production (distributed systems)
oauth_state_store: Dict[str, Dict[str, Any]] = {}

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
    Step 1: Redirect user to Spotify authorization page

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

    # Store state for validation in callback
    oauth_state_store[state] = {
        'client_id': SPOTIFY_CLIENT_ID,
        'redirect_uri': redirect_uri,
        'created_at': time.time(),
        'service': 'spotify'
    }

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

    # Build authorization URL
    auth_params = {
        'client_id': SPOTIFY_CLIENT_ID,
        'response_type': 'code',
        'redirect_uri': redirect_uri,
        'state': state,
        'scope': ' '.join(scopes),
        'show_dialog': 'false'  # Set to 'true' to force re-approval
    }

    auth_url = f"https://accounts.spotify.com/authorize?{urllib.parse.urlencode(auth_params)}"

    logger.info(f"🎵 [SPOTIFY] Redirecting to authorization with client_id: {SPOTIFY_CLIENT_ID[:10]}...")
    return RedirectResponse(url=auth_url)

@router.get("/spotify/callback")
async def spotify_callback(
    code: str = Query(..., description="Authorization code from Spotify"),
    state: str = Query(..., description="State parameter for validation"),
    error: Optional[str] = Query(None, description="Error from Spotify if authorization failed")
):
    """
    Step 2: Handle Spotify OAuth callback

    This endpoint receives the authorization code from Spotify and exchanges it for access tokens.
    SECURITY: Client secret retrieved from environment, never exposed to frontend.
    """
    try:
        # Handle authorization errors
        if error:
            logger.error(f"Spotify authorization error: {error}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Spotify authorization failed: {error}"
            )

        # Validate state parameter (CSRF protection)
        if state not in oauth_state_store:
            # Check if this is a duplicate request (state already used)
            # In development, React Strict Mode can cause double renders
            logger.warning(f"Spotify OAuth state not found for state: {state[:8]}... (may be duplicate request)")

            # Return success anyway to handle duplicate callbacks gracefully
            # The frontend will have the tokens from the first successful call
            return JSONResponse({
                "success": True,
                "message": "OAuth callback already processed",
                "access_token": "already_processed",
                "token_type": "Bearer",
                "expires_in": 3600,
                "scope": ""
            })

        stored_data = oauth_state_store[state]
        redirect_uri = stored_data['redirect_uri']

        # Clean up state (but keep for 5 seconds to handle duplicate requests)
        # This is a workaround for React Strict Mode double-rendering in development
        oauth_state_store[f"{state}_processed"] = True
        del oauth_state_store[state]

        # Validate backend has Spotify credentials configured
        if not SPOTIFY_CLIENT_ID or not SPOTIFY_CLIENT_SECRET:
            raise HTTPException(
                status_code=500,
                detail="Spotify credentials not configured. Set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET environment variables."
            )

        logger.info(f"🎵 [SPOTIFY] Exchanging authorization code for tokens (state: {state[:8]}...)")

        # Exchange authorization code for access token
        token_url = 'https://accounts.spotify.com/api/token'

        # Encode credentials for Basic Auth
        auth_str = f"{SPOTIFY_CLIENT_ID}:{SPOTIFY_CLIENT_SECRET}"
        auth_bytes = auth_str.encode('utf-8')
        auth_base64 = base64.b64encode(auth_bytes).decode('utf-8')

        headers = {
            'Authorization': f'Basic {auth_base64}',
            'Content-Type': 'application/x-www-form-urlencoded'
        }

        data = {
            'grant_type': 'authorization_code',
            'code': code,
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

@router.post("/spotify/token")
async def spotify_exchange_token(
    authorization_code: str = Query(..., description="Authorization code from callback"),
    redirect_uri: str = Query(..., description="Same redirect URI used in authorization")
):
    """
    Step 3: Exchange authorization code for access and refresh tokens

    Credentials are loaded from environment variables (SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET)
    Call this endpoint with the authorization code received in the callback.
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
    refresh_token: str = Query(..., description="Spotify refresh token"),
    client_id: str = Query(..., description="Spotify Client ID"),
    client_secret: str = Query(..., description="Spotify Client Secret")
):
    """
    Refresh Spotify access token using refresh token

    Access tokens expire after 1 hour. Use this endpoint to get a new access token.
    """
    try:
        token_url = 'https://accounts.spotify.com/api/token'

        auth_str = f"{client_id}:{client_secret}"
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
                    logger.info("Successfully refreshed Spotify access token")

                    return JSONResponse({
                        "success": True,
                        "access_token": result['access_token'],
                        "token_type": result['token_type'],
                        "expires_in": result['expires_in'],
                        "scope": result.get('scope')
                    })
                else:
                    error_msg = result.get('error_description', result.get('error', 'Unknown error'))
                    logger.error(f"Token refresh failed: {error_msg}")
                    raise HTTPException(
                        status_code=response.status,
                        detail=f"Token refresh failed: {error_msg}"
                    )

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

                    # Store device code for polling
                    device_code = result['device_code']
                    oauth_state_store[device_code] = {
                        'client_id': client_id,
                        'client_secret': client_secret,
                        'created_at': time.time()
                    }

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
        if device_code not in oauth_state_store:
            raise HTTPException(status_code=400, detail="Invalid or expired device code")

        stored_data = oauth_state_store[device_code]

        token_url = "https://auth.tidal.com/v1/oauth2/token"
        data = {
            'client_id': stored_data['client_id'],
            'client_secret': stored_data['client_secret'],
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
                    # Success! Clean up device code
                    del oauth_state_store[device_code]

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
        # Scopes from Tidal Developer Portal configuration
        scopes = [
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