"""
API Key Management Router
Handles secure storage, retrieval, and testing of API keys for scraper services
"""

from fastapi import APIRouter, HTTPException, Depends, status
from pydantic import BaseModel, Field, validator
from typing import List, Optional, Dict, Any
from datetime import datetime
import asyncpg
import os
import logging
import aiohttp
import time
import json
import base64

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/api-keys", tags=["API Keys"])

# Get database pool from app state (injected by main.py)
async def get_db_pool():
    """Dependency to get database pool"""
    from main import db_pool
    if not db_pool:
        raise HTTPException(
            status_code=500,
            detail="Database connection pool not available"
        )
    return db_pool

# Rate limiting for API key testing (5 tests per minute per service)
_test_rate_limits = {}  # service_name -> list of timestamps

def check_rate_limit(service_name: str) -> bool:
    """Check if rate limit allows testing"""
    now = time.time()
    if service_name not in _test_rate_limits:
        _test_rate_limits[service_name] = []

    # Remove timestamps older than 60 seconds
    _test_rate_limits[service_name] = [
        ts for ts in _test_rate_limits[service_name]
        if now - ts < 60
    ]

    # Check if limit exceeded
    if len(_test_rate_limits[service_name]) >= 5:
        return False

    # Add current timestamp
    _test_rate_limits[service_name].append(now)
    return True

# ===========================================
# REQUEST/RESPONSE MODELS
# ===========================================

class APIKeyCreate(BaseModel):
    """Request model for creating/updating an API key"""
    service_name: str = Field(..., min_length=1, max_length=100)
    key_name: str = Field(..., min_length=1, max_length=100)
    key_value: str = Field(..., min_length=1)
    description: Optional[str] = None

    @validator('service_name')
    def validate_service_name(cls, v):
        allowed_services = [
            'spotify', 'discogs', 'lastfm', 'beatport',
            'musicbrainz', 'youtube', 'setlistfm', 'reddit',
            '1001tracklists'
        ]
        if v.lower() not in allowed_services:
            raise ValueError(f'Service must be one of: {", ".join(allowed_services)}')
        return v.lower()

    @validator('key_name')
    def validate_key_name(cls, v):
        # Remove whitespace
        return v.strip()

class APIKeyResponse(BaseModel):
    """Response model for API key (with masked value)"""
    id: str
    service_name: str
    key_name: str
    masked_value: str
    description: Optional[str]
    is_valid: Optional[bool]
    last_tested_at: Optional[datetime]
    test_error: Optional[str]
    created_at: datetime
    updated_at: datetime

class APIKeyTestRequest(BaseModel):
    """Request model for testing an API key"""
    service_name: str
    key_name: str

class APIKeyTestResponse(BaseModel):
    """Response model for API key test result"""
    valid: bool
    message: str
    tested_at: datetime
    service_name: str
    key_name: str
    details: Optional[Dict[str, Any]] = None

class APIKeyRequirement(BaseModel):
    """Service API key requirement information"""
    service_name: str
    key_name: str
    display_name: str
    description: str
    required: bool
    documentation_url: str
    display_order: int

# ===========================================
# ENDPOINTS
# ===========================================

@router.get("/requirements", response_model=List[APIKeyRequirement])
async def get_api_key_requirements(pool = Depends(get_db_pool)):
    """
    Get list of API key requirements for all services
    """
    try:
        async with pool.acquire() as conn:
            query = """
            SELECT service_name, key_name, display_name, description,
                   required, documentation_url, display_order
            FROM api_key_requirements
            ORDER BY display_order
            """
            rows = await conn.fetch(query)

            requirements = []
            for row in rows:
                requirements.append(APIKeyRequirement(**dict(row)))

            return requirements

    except Exception as e:
        logger.error(f"Failed to fetch API key requirements: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("", response_model=List[APIKeyResponse])
async def get_api_keys(
    service_name: Optional[str] = None,
    pool = Depends(get_db_pool)
):
    """
    Get all API keys (with masked values) or filter by service
    """
    try:
        async with pool.acquire() as conn:
            if service_name:
                query = """
                SELECT id, service_name, key_name,
                       get_masked_api_key(service_name, key_name) as masked_value,
                       description, is_valid, last_tested_at, test_error,
                       created_at, updated_at
                FROM api_keys
                WHERE service_name = $1
                ORDER BY service_name, key_name
                """
                rows = await conn.fetch(query, service_name.lower())
            else:
                query = """
                SELECT id, service_name, key_name,
                       get_masked_api_key(service_name, key_name) as masked_value,
                       description, is_valid, last_tested_at, test_error,
                       created_at, updated_at
                FROM api_keys
                ORDER BY service_name, key_name
                """
                rows = await conn.fetch(query)

            api_keys = []
            for row in rows:
                api_keys.append(APIKeyResponse(
                    id=str(row['id']),
                    service_name=row['service_name'],
                    key_name=row['key_name'],
                    masked_value=row['masked_value'] or '****',
                    description=row['description'],
                    is_valid=row['is_valid'],
                    last_tested_at=row['last_tested_at'],
                    test_error=row['test_error'],
                    created_at=row['created_at'],
                    updated_at=row['updated_at']
                ))

            return api_keys

    except Exception as e:
        logger.error(f"Failed to fetch API keys: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("", response_model=APIKeyResponse, status_code=status.HTTP_201_CREATED)
async def create_or_update_api_key(
    api_key: APIKeyCreate,
    pool = Depends(get_db_pool)
):
    """
    Create or update an API key (encrypted at rest)
    """
    try:
        async with pool.acquire() as conn:
            # Get encryption secret from environment
            encryption_secret = os.getenv('API_KEY_ENCRYPTION_SECRET')

            # Store encrypted API key
            query = """
            SELECT store_api_key($1, $2, $3, $4, $5) as key_id
            """
            result = await conn.fetchrow(
                query,
                api_key.service_name,
                api_key.key_name,
                api_key.key_value,
                api_key.description,
                encryption_secret
            )

            # Fetch the created/updated key
            fetch_query = """
            SELECT id, service_name, key_name,
                   get_masked_api_key(service_name, key_name) as masked_value,
                   description, is_valid, last_tested_at, test_error,
                   created_at, updated_at
            FROM api_keys
            WHERE id = $1
            """
            row = await conn.fetchrow(fetch_query, result['key_id'])

            return APIKeyResponse(
                id=str(row['id']),
                service_name=row['service_name'],
                key_name=row['key_name'],
                masked_value=row['masked_value'] or '****',
                description=row['description'],
                is_valid=row['is_valid'],
                last_tested_at=row['last_tested_at'],
                test_error=row['test_error'],
                created_at=row['created_at'],
                updated_at=row['updated_at']
            )

    except Exception as e:
        logger.error(f"Failed to create/update API key: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{service_name}/{key_name}")
async def delete_api_key(
    service_name: str,
    key_name: str,
    pool = Depends(get_db_pool)
):
    """
    Delete an API key
    """
    try:
        async with pool.acquire() as conn:
            query = """
            DELETE FROM api_keys
            WHERE service_name = $1 AND key_name = $2
            RETURNING id
            """
            result = await conn.fetchrow(query, service_name.lower(), key_name)

            if not result:
                raise HTTPException(
                    status_code=404,
                    detail=f"API key not found: {service_name}/{key_name}"
                )

            return {"status": "deleted", "service_name": service_name, "key_name": key_name}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delete API key: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/test", response_model=APIKeyTestResponse)
async def test_api_key(
    test_request: APIKeyTestRequest,
    pool = Depends(get_db_pool)
):
    """
    Test an API key to verify it's valid
    Rate limited to 5 tests per minute per service
    """
    service_name = test_request.service_name.lower()
    key_name = test_request.key_name

    # Check rate limit
    if not check_rate_limit(service_name):
        raise HTTPException(
            status_code=429,
            detail="Rate limit exceeded. Maximum 5 tests per minute per service."
        )

    try:
        async with pool.acquire() as conn:
            # Get the decrypted API key
            encryption_secret = os.getenv('API_KEY_ENCRYPTION_SECRET')
            query = "SELECT get_api_key($1, $2, $3) as key_value"
            result = await conn.fetchrow(query, service_name, key_name, encryption_secret)

            if not result or not result['key_value']:
                raise HTTPException(
                    status_code=404,
                    detail=f"API key not found: {service_name}/{key_name}"
                )

            api_key_value = result['key_value']

            # Test the API key based on service
            test_result = await _test_api_key_by_service(
                service_name, key_name, api_key_value, conn
            )

            # Update test result in database
            update_query = """
            SELECT update_api_key_test_result($1, $2, $3, $4)
            """
            await conn.execute(
                update_query,
                service_name,
                key_name,
                test_result['valid'],
                test_result.get('error')
            )

            return APIKeyTestResponse(
                valid=test_result['valid'],
                message=test_result['message'],
                tested_at=datetime.utcnow(),
                service_name=service_name,
                key_name=key_name,
                details=test_result.get('details')
            )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to test API key: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# ===========================================
# API KEY TESTING FUNCTIONS
# ===========================================

async def _test_api_key_by_service(
    service_name: str,
    key_name: str,
    key_value: str,
    conn: asyncpg.Connection
) -> Dict[str, Any]:
    """
    Test an API key based on service type
    """
    if service_name == 'spotify':
        return await _test_spotify_key(key_value, key_name, conn)
    elif service_name == 'youtube':
        return await _test_youtube_key(key_value)
    elif service_name == 'discogs':
        return await _test_discogs_key(key_value)
    elif service_name == 'lastfm':
        return await _test_lastfm_key(key_value, key_name)
    elif service_name == 'musicbrainz':
        return await _test_musicbrainz_user_agent(key_value)
    elif service_name == 'beatport':
        return {
            'valid': True,
            'message': 'Beatport API key saved (testing not available)',
            'details': {'note': 'Beatport does not have a public API for testing'}
        }
    elif service_name == 'setlistfm':
        return await _test_setlistfm_key(key_value)
    elif service_name == 'reddit':
        return await _test_reddit_key(key_value, key_name, conn)
    elif service_name == '1001tracklists':
        return await _test_1001tracklists_key(key_value, key_name, conn)
    else:
        return {
            'valid': False,
            'message': f'Unknown service: {service_name}',
            'error': 'Service not supported'
        }

async def _test_spotify_key(client_id: str, key_name: str, conn: asyncpg.Connection) -> Dict[str, Any]:
    """Test Spotify OAuth credentials"""
    try:
        # Need both client_id and client_secret
        if key_name == 'client_id':
            # Get the client_secret
            encryption_secret = os.getenv('API_KEY_ENCRYPTION_SECRET')
            query = "SELECT get_api_key('spotify', 'client_secret', $1) as secret"
            result = await conn.fetchrow(query, encryption_secret)

            if not result or not result['secret']:
                return {
                    'valid': False,
                    'message': 'Spotify client_secret not configured',
                    'error': 'Missing client_secret'
                }

            client_secret = result['secret']
        else:
            # key_name is client_secret, get client_id
            encryption_secret = os.getenv('API_KEY_ENCRYPTION_SECRET')
            query = "SELECT get_api_key('spotify', 'client_id', $1) as client_id"
            result = await conn.fetchrow(query, encryption_secret)

            if not result or not result['client_id']:
                return {
                    'valid': False,
                    'message': 'Spotify client_id not configured',
                    'error': 'Missing client_id'
                }

            client_secret = client_id
            client_id = result['client_id']

        # Test OAuth token endpoint
        auth_str = f"{client_id}:{client_secret}"
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
                    return {
                        'valid': True,
                        'message': 'Spotify credentials valid',
                        'details': {
                            'token_type': token_data.get('token_type'),
                            'expires_in': token_data.get('expires_in')
                        }
                    }
                elif response.status == 401:
                    return {
                        'valid': False,
                        'message': 'Invalid Spotify credentials',
                        'error': 'Authentication failed'
                    }
                else:
                    error_text = await response.text()
                    return {
                        'valid': False,
                        'message': f'Spotify API error: {response.status}',
                        'error': error_text
                    }

    except Exception as e:
        return {
            'valid': False,
            'message': f'Spotify test failed: {str(e)}',
            'error': str(e)
        }

async def _test_youtube_key(api_key: str) -> Dict[str, Any]:
    """Test YouTube Data API key"""
    try:
        url = f"https://www.googleapis.com/youtube/v3/videos?part=id&id=dQw4w9WgXcQ&key={api_key}"

        async with aiohttp.ClientSession() as session:
            async with session.get(url, timeout=aiohttp.ClientTimeout(total=10)) as response:
                if response.status == 200:
                    return {
                        'valid': True,
                        'message': 'YouTube API key is valid'
                    }
                elif response.status == 400:
                    error_data = await response.json()
                    error_reason = error_data.get('error', {}).get('errors', [{}])[0].get('reason', 'unknown')

                    if error_reason == 'keyInvalid':
                        return {
                            'valid': False,
                            'message': 'Invalid YouTube API key',
                            'error': 'API key is invalid or revoked'
                        }
                    else:
                        return {
                            'valid': False,
                            'message': f'YouTube API error: {error_reason}',
                            'error': error_reason
                        }
                else:
                    return {
                        'valid': False,
                        'message': f'YouTube API returned status {response.status}',
                        'error': await response.text()
                    }

    except Exception as e:
        return {
            'valid': False,
            'message': f'YouTube test failed: {str(e)}',
            'error': str(e)
        }

async def _test_discogs_key(token: str) -> Dict[str, Any]:
    """Test Discogs personal access token"""
    try:
        headers = {
            'Authorization': f'Discogs token={token}',
            'User-Agent': 'SongNodes/1.0'
        }

        async with aiohttp.ClientSession() as session:
            async with session.get(
                'https://api.discogs.com/oauth/identity',
                headers=headers,
                timeout=aiohttp.ClientTimeout(total=10)
            ) as response:
                if response.status == 200:
                    data = await response.json()
                    return {
                        'valid': True,
                        'message': 'Discogs token is valid',
                        'details': {
                            'username': data.get('username'),
                            'resource_url': data.get('resource_url')
                        }
                    }
                elif response.status == 401:
                    return {
                        'valid': False,
                        'message': 'Invalid Discogs token',
                        'error': 'Authentication failed'
                    }
                else:
                    return {
                        'valid': False,
                        'message': f'Discogs API error: {response.status}',
                        'error': await response.text()
                    }

    except Exception as e:
        return {
            'valid': False,
            'message': f'Discogs test failed: {str(e)}',
            'error': str(e)
        }

async def _test_lastfm_key(key_value: str, key_name: str) -> Dict[str, Any]:
    """Test Last.fm API key or validate shared secret"""
    try:
        # If testing shared_secret, just validate format (32 hex characters)
        if key_name == 'shared_secret':
            # Shared secret is a 32-character hexadecimal string
            if not key_value or len(key_value) != 32:
                return {
                    'valid': False,
                    'message': 'Invalid shared secret format (should be 32 characters)',
                    'error': 'Incorrect length'
                }

            # Check if it's hexadecimal
            try:
                int(key_value, 16)
            except ValueError:
                return {
                    'valid': False,
                    'message': 'Invalid shared secret format (should be hexadecimal)',
                    'error': 'Not a valid hex string'
                }

            return {
                'valid': True,
                'message': 'Last.fm shared secret format is valid',
                'details': {'note': 'Shared secret is used for signing authenticated requests'}
            }

        # Test API key with actual API call
        params = {
            'method': 'chart.getTopTracks',
            'api_key': key_value,
            'format': 'json',
            'limit': 1
        }

        async with aiohttp.ClientSession() as session:
            async with session.get(
                'http://ws.audioscrobbler.com/2.0/',
                params=params,
                timeout=aiohttp.ClientTimeout(total=10)
            ) as response:
                if response.status == 200:
                    data = await response.json()
                    if 'error' in data:
                        return {
                            'valid': False,
                            'message': f"Last.fm API error: {data.get('message', 'Unknown error')}",
                            'error': data.get('message')
                        }
                    return {
                        'valid': True,
                        'message': 'Last.fm API key is valid'
                    }
                else:
                    return {
                        'valid': False,
                        'message': f'Last.fm API error: {response.status}',
                        'error': await response.text()
                    }

    except Exception as e:
        return {
            'valid': False,
            'message': f'Last.fm test failed: {str(e)}',
            'error': str(e)
        }

async def _test_musicbrainz_user_agent(user_agent: str) -> Dict[str, Any]:
    """
    Validate MusicBrainz User-Agent format

    MusicBrainz requires meaningful User-Agent strings with contact info:
    - Format: AppName/Version (contact-info)
    - Examples:
      - SongNodes/1.0 (contact@example.com)
      - SongNodes/1.0 +http://example.com (contact@example.com)
    - See: https://musicbrainz.org/doc/MusicBrainz_API/Rate_Limiting
    """

    if not user_agent or len(user_agent) < 10:
        return {
            'valid': False,
            'message': 'User-Agent too short (minimum 10 characters)',
            'error': 'User-Agent must include app name, version, and contact info'
        }

    if '/' not in user_agent:
        return {
            'valid': False,
            'message': 'Invalid User-Agent format. Expected: AppName/Version (contact)',
            'error': 'Missing version separator (/)'
        }

    # Check for contact information (email or URL in parentheses)
    if '(' not in user_agent or ')' not in user_agent:
        return {
            'valid': False,
            'message': 'User-Agent must include contact info in parentheses',
            'error': 'Missing contact information. Format: AppName/Version (email or URL)'
        }

    # Extract contact info
    contact_start = user_agent.find('(')
    contact_end = user_agent.find(')')
    if contact_start >= contact_end:
        return {
            'valid': False,
            'message': 'Invalid contact info format',
            'error': 'Parentheses not properly closed'
        }

    contact_info = user_agent[contact_start+1:contact_end].strip()

    # Validate contact info contains email or URL
    has_email = '@' in contact_info and '.' in contact_info
    has_url = 'http://' in contact_info or 'https://' in contact_info or contact_info.startswith('+http')

    if not (has_email or has_url):
        return {
            'valid': False,
            'message': 'Contact info must include email or URL',
            'error': 'No valid email or URL found in contact info'
        }

    # Test with actual MusicBrainz API
    try:
        headers = {
            'User-Agent': user_agent,
            'Accept': 'application/json'
        }

        async with aiohttp.ClientSession() as session:
            async with session.get(
                'https://musicbrainz.org/ws/2/recording/5b11f4ce-a62d-471e-81fc-a69a8278c7da',
                headers=headers,
                timeout=aiohttp.ClientTimeout(total=10)
            ) as response:
                if response.status == 200:
                    return {
                        'valid': True,
                        'message': 'MusicBrainz User-Agent is valid'
                    }
                elif response.status == 400:
                    return {
                        'valid': False,
                        'message': 'Invalid User-Agent format',
                        'error': 'MusicBrainz rejected the User-Agent'
                    }
                else:
                    # Even if we get other errors, the User-Agent format is likely valid
                    return {
                        'valid': True,
                        'message': 'MusicBrainz User-Agent format appears valid',
                        'details': {'note': f'API returned {response.status} but format is acceptable'}
                    }

    except Exception as e:
        # If we can't connect, assume format is valid if it has the right structure
        return {
            'valid': True,
            'message': 'MusicBrainz User-Agent format appears valid',
            'details': {'note': 'Could not test with API, format validation only'}
        }

async def _test_setlistfm_key(api_key: str) -> Dict[str, Any]:
    """Test Setlist.fm API key"""
    try:
        headers = {
            'x-api-key': api_key,
            'Accept': 'application/json'
        }

        async with aiohttp.ClientSession() as session:
            # Test with a simple artist search
            async with session.get(
                'https://api.setlist.fm/rest/1.0/search/artists?artistName=Coldplay&p=1&sort=relevance',
                headers=headers,
                timeout=aiohttp.ClientTimeout(total=10)
            ) as response:
                if response.status == 200:
                    return {
                        'valid': True,
                        'message': 'Setlist.fm API key is valid'
                    }
                elif response.status == 401:
                    return {
                        'valid': False,
                        'message': 'Invalid Setlist.fm API key',
                        'error': 'Authentication failed'
                    }
                elif response.status == 403:
                    return {
                        'valid': False,
                        'message': 'Setlist.fm API key forbidden',
                        'error': 'API key lacks required permissions'
                    }
                else:
                    return {
                        'valid': False,
                        'message': f'Setlist.fm API error: {response.status}',
                        'error': await response.text()
                    }

    except Exception as e:
        return {
            'valid': False,
            'message': f'Setlist.fm test failed: {str(e)}',
            'error': str(e)
        }

async def _test_reddit_key(client_id: str, key_name: str, conn: asyncpg.Connection) -> Dict[str, Any]:
    """Test Reddit OAuth credentials"""
    try:
        # Need both client_id and client_secret
        if key_name == 'client_id':
            # Get the client_secret
            encryption_secret = os.getenv('API_KEY_ENCRYPTION_SECRET')
            query = "SELECT get_api_key('reddit', 'client_secret', $1) as secret"
            result = await conn.fetchrow(query, encryption_secret)

            if not result or not result['secret']:
                return {
                    'valid': False,
                    'message': 'Reddit client_secret not configured',
                    'error': 'Missing client_secret'
                }

            client_secret = result['secret']
        else:
            # key_name is client_secret, get client_id
            encryption_secret = os.getenv('API_KEY_ENCRYPTION_SECRET')
            query = "SELECT get_api_key('reddit', 'client_id', $1) as client_id"
            result = await conn.fetchrow(query, encryption_secret)

            if not result or not result['client_id']:
                return {
                    'valid': False,
                    'message': 'Reddit client_id not configured',
                    'error': 'Missing client_id'
                }

            client_secret = client_id
            client_id = result['client_id']

        # Test OAuth token endpoint
        auth = aiohttp.BasicAuth(client_id, client_secret)
        data = {
            'grant_type': 'client_credentials',
            'device_id': 'songnodes-test'
        }
        headers = {'User-Agent': 'SongNodes/1.0'}

        async with aiohttp.ClientSession() as session:
            async with session.post(
                'https://www.reddit.com/api/v1/access_token',
                auth=auth,
                data=data,
                headers=headers,
                timeout=aiohttp.ClientTimeout(total=10)
            ) as response:
                if response.status == 200:
                    token_data = await response.json()
                    return {
                        'valid': True,
                        'message': 'Reddit credentials valid',
                        'details': {
                            'token_type': token_data.get('token_type'),
                            'expires_in': token_data.get('expires_in')
                        }
                    }
                elif response.status == 401:
                    return {
                        'valid': False,
                        'message': 'Invalid Reddit credentials',
                        'error': 'Authentication failed'
                    }
                else:
                    error_text = await response.text()
                    return {
                        'valid': False,
                        'message': f'Reddit API error: {response.status}',
                        'error': error_text
                    }

    except Exception as e:
        return {
            'valid': False,
            'message': f'Reddit test failed: {str(e)}',
            'error': str(e)
        }

async def _test_1001tracklists_key(username: str, key_name: str, conn: asyncpg.Connection) -> Dict[str, Any]:
    """Test 1001tracklists login credentials"""
    try:
        # Need both username and password
        if key_name == 'username':
            # Get the password
            encryption_secret = os.getenv('API_KEY_ENCRYPTION_SECRET')
            query = "SELECT get_api_key('1001tracklists', 'password', $1) as password"
            result = await conn.fetchrow(query, encryption_secret)

            if not result or not result['password']:
                return {
                    'valid': False,
                    'message': '1001tracklists password not configured',
                    'error': 'Missing password'
                }

            password = result['password']
        else:
            # key_name is password, get username
            encryption_secret = os.getenv('API_KEY_ENCRYPTION_SECRET')
            query = "SELECT get_api_key('1001tracklists', 'username', $1) as username"
            result = await conn.fetchrow(query, encryption_secret)

            if not result or not result['username']:
                return {
                    'valid': False,
                    'message': '1001tracklists username not configured',
                    'error': 'Missing username'
                }

            password = username
            username = result['username']

        # Test login endpoint
        login_data = {
            'username': username,
            'password': password
        }

        async with aiohttp.ClientSession() as session:
            # First, get the login page to get any CSRF tokens if needed
            async with session.get(
                'https://www.1001tracklists.com/login.php',
                timeout=aiohttp.ClientTimeout(total=15)
            ) as response:
                if response.status != 200:
                    return {
                        'valid': False,
                        'message': f'1001tracklists login page error: {response.status}',
                        'error': 'Could not access login page'
                    }

            # Attempt login
            headers = {
                'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
                'Referer': 'https://www.1001tracklists.com/login.php'
            }

            async with session.post(
                'https://www.1001tracklists.com/login.php',
                data=login_data,
                headers=headers,
                allow_redirects=False,
                timeout=aiohttp.ClientTimeout(total=15)
            ) as response:
                # Successful login typically redirects (302/303) or returns 200
                # Failed login usually returns 200 with error message or stays on same page

                # Check if we got redirected (successful login)
                if response.status in [302, 303, 301]:
                    location = response.headers.get('Location', '')
                    if 'login' not in location.lower():
                        return {
                            'valid': True,
                            'message': '1001tracklists credentials valid',
                            'details': {'username': username}
                        }

                # Check response content for error messages
                text = await response.text()

                # Common error indicators
                error_indicators = [
                    'invalid username',
                    'invalid password',
                    'incorrect password',
                    'login failed',
                    'authentication failed'
                ]

                if any(indicator in text.lower() for indicator in error_indicators):
                    return {
                        'valid': False,
                        'message': 'Invalid 1001tracklists credentials',
                        'error': 'Username or password incorrect'
                    }

                # If we're still on the login page, credentials are likely invalid
                if 'login' in text.lower() and 'password' in text.lower():
                    return {
                        'valid': False,
                        'message': 'Invalid 1001tracklists credentials',
                        'error': 'Login failed - remained on login page'
                    }

                # If we got here and status is 200, assume success
                if response.status == 200:
                    return {
                        'valid': True,
                        'message': '1001tracklists credentials appear valid',
                        'details': {
                            'username': username,
                            'note': 'Login succeeded but validation inconclusive'
                        }
                    }

                return {
                    'valid': False,
                    'message': f'1001tracklists test returned status {response.status}',
                    'error': 'Unexpected response'
                }

    except aiohttp.ClientError as e:
        return {
            'valid': False,
            'message': f'Network error testing 1001tracklists: {str(e)}',
            'error': str(e)
        }
    except Exception as e:
        return {
            'valid': False,
            'message': f'1001tracklists test failed: {str(e)}',
            'error': str(e)
        }