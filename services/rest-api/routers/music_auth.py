"""
Music Service Authentication Router
Handles authentication testing for Tidal, Spotify, and Apple Music
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
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/music-auth", tags=["Music Authentication"])

# ===========================================
# OAUTH STATE STORAGE (In-memory for demo)
# Production should use Redis or database
# ===========================================
oauth_state_store: Dict[str, Dict[str, Any]] = {}

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
    """Request to initiate Tidal OAuth flow"""
    client_id: str = Field(..., min_length=1)
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

class AppleMusicAuthRequest(BaseModel):
    """Apple Music JWT authentication"""
    key_id: str = Field(..., min_length=1)
    team_id: str = Field(..., min_length=1)
    private_key: str = Field(..., min_length=1)

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
# APPLE MUSIC AUTHENTICATION
# ===========================================

@router.post("/test/apple-music", response_model=AuthTestResponse)
async def test_apple_music_auth(auth: AppleMusicAuthRequest):
    """
    Test Apple Music authentication by generating and validating a developer token
    """
    try:
        # Validate private key format
        if not auth.private_key.startswith('-----BEGIN PRIVATE KEY-----'):
            return AuthTestResponse(
                valid=False,
                message="Invalid private key format",
                service="apple_music",
                tested_at=datetime.utcnow(),
                error="Private key must be in PEM format"
            )

        # Generate JWT token
        time_now = int(time.time())
        time_expired = time_now + 15777000  # 6 months

        headers = {
            'alg': 'ES256',
            'kid': auth.key_id
        }

        payload = {
            'iss': auth.team_id,
            'iat': time_now,
            'exp': time_expired
        }

        try:
            # Generate developer token
            token = jwt.encode(
                payload,
                auth.private_key,
                algorithm='ES256',
                headers=headers
            )

            # Test the token with Apple Music API
            test_url = "https://api.music.apple.com/v1/catalog/us/songs/203709340"
            headers = {
                'Authorization': f'Bearer {token}',
                'Music-User-Token': ''  # Not required for catalog access
            }

            async with aiohttp.ClientSession() as session:
                async with session.get(
                    test_url,
                    headers=headers,
                    timeout=aiohttp.ClientTimeout(total=10)
                ) as response:
                    if response.status == 200:
                        return AuthTestResponse(
                            valid=True,
                            message="Apple Music credentials are valid and working",
                            service="apple_music",
                            tested_at=datetime.utcnow(),
                            details={
                                'token_generated': True,
                                'api_access': 'confirmed',
                                'expires_at': datetime.fromtimestamp(time_expired).isoformat(),
                                'team_id': auth.team_id,
                                'key_id': auth.key_id
                            }
                        )
                    elif response.status == 401:
                        return AuthTestResponse(
                            valid=False,
                            message="Apple Music token rejected by API",
                            service="apple_music",
                            tested_at=datetime.utcnow(),
                            error="Invalid credentials or expired key"
                        )
                    else:
                        return AuthTestResponse(
                            valid=False,
                            message=f"Apple Music API returned status {response.status}",
                            service="apple_music",
                            tested_at=datetime.utcnow(),
                            error=await response.text()
                        )

        except jwt.exceptions.InvalidKeyError:
            return AuthTestResponse(
                valid=False,
                message="Invalid Apple Music private key",
                service="apple_music",
                tested_at=datetime.utcnow(),
                error="Private key format is invalid or corrupted"
            )
        except Exception as jwt_error:
            return AuthTestResponse(
                valid=False,
                message=f"Failed to generate Apple Music token: {str(jwt_error)}",
                service="apple_music",
                tested_at=datetime.utcnow(),
                error=str(jwt_error)
            )

    except Exception as e:
        logger.error(f"Apple Music authentication test failed: {str(e)}")
        return AuthTestResponse(
            valid=False,
            message=f"Apple Music test failed: {str(e)}",
            service="apple_music",
            tested_at=datetime.utcnow(),
            error=str(e)
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

    Note: For local development, Tidal's Device Code flow may work better
    as it doesn't require a publicly accessible redirect URI
    """
    try:
        # Generate PKCE pair and state
        code_verifier, code_challenge = generate_pkce_pair()
        state = generate_state()

        # Store PKCE verifier and client info for callback
        oauth_state_store[state] = {
            'code_verifier': code_verifier,
            'client_id': request.client_id,
            'redirect_uri': request.redirect_uri,
            'created_at': time.time()
        }

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
            'client_id': request.client_id,
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
        logger.info(f"Generated OAuth URL for client {request.client_id[:8]}... with scopes: {', '.join(scopes)}")
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
    state: str = Query(..., description="State parameter for CSRF protection"),
    client_secret: str = Query(..., description="Client secret for token exchange")
):
    """
    OAuth callback endpoint - exchanges authorization code for access token
    """
    try:
        # Validate state and retrieve stored data
        if state not in oauth_state_store:
            raise HTTPException(status_code=400, detail="Invalid or expired state parameter")

        oauth_data = oauth_state_store[state]

        # Check if state is not too old (10 minutes max)
        if time.time() - oauth_data['created_at'] > 600:
            del oauth_state_store[state]
            raise HTTPException(status_code=400, detail="OAuth state expired")

        # Exchange authorization code for access token
        token_url = "https://auth.tidal.com/v1/oauth2/token"
        token_data = {
            'grant_type': 'authorization_code',
            'code': code,
            'redirect_uri': oauth_data['redirect_uri'],
            'client_id': oauth_data['client_id'],
            'client_secret': client_secret,
            'code_verifier': oauth_data['code_verifier']
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

                    # Clean up state
                    del oauth_state_store[state]

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