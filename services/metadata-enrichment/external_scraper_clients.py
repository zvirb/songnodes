"""
Async HTTP clients for existing scrapers

These clients provide a simple async interface to query the existing
scraper APIs (1001Tracklists, MixesDB) for artist information.

IMPORTANT: These are READ-ONLY clients that query cached data.
They do NOT trigger new scraping jobs or modify scraper state.
"""

import httpx
import structlog
from typing import List, Dict, Any, Optional
from urllib.parse import quote_plus

logger = structlog.get_logger(__name__)


class TracksLists1001Client:
    """
    Async client for 1001Tracklists scraper API
    
    Queries the existing scraper's cached data for track/artist information.
    Does NOT trigger new scraping - uses already-collected data.
    """
    
    def __init__(self, base_url: str = "http://scraper-1001:8080"):
        self.base_url = base_url
        self.timeout = 10.0  # Fast timeout - we're querying local API
    
    async def search_track(self, query: str, limit: int = 20) -> List[Dict[str, Any]]:
        """
        Search cached 1001Tracklists data for track information
        
        Args:
            query: Search query (track title, artist name, or combination)
            limit: Max results to return
            
        Returns:
            List of track dictionaries with artist attribution
            Format: [{'artist': 'Name', 'title': 'Track', 'url': '...', ...}, ...]
        """
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                # Query the scraper's search endpoint
                # This searches CACHED data, doesn't trigger new scrape
                response = await client.get(
                    f"{self.base_url}/search",
                    params={
                        'q': query,
                        'limit': limit
                    }
                )
                
                if response.status_code == 404:
                    logger.debug(
                        "1001Tracklists API endpoint not found - may need custom implementation",
                        base_url=self.base_url
                    )
                    return []
                
                response.raise_for_status()
                data = response.json()
                
                # Handle different response formats
                if isinstance(data, dict):
                    results = data.get('results', []) or data.get('tracks', [])
                elif isinstance(data, list):
                    results = data
                else:
                    results = []
                
                logger.debug(
                    "1001Tracklists search completed",
                    query=query,
                    results_count=len(results)
                )
                
                return results[:limit]
                
        except httpx.ConnectError:
            logger.warning(
                "1001Tracklists scraper not available",
                base_url=self.base_url,
                query=query
            )
            return []
        except httpx.TimeoutException:
            logger.warning(
                "1001Tracklists search timeout",
                query=query,
                timeout=self.timeout
            )
            return []
        except Exception as e:
            logger.error(
                "1001Tracklists search error",
                error=str(e),
                query=query
            )
            return []
    
    async def health_check(self) -> bool:
        """Check if 1001Tracklists scraper is available"""
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(f"{self.base_url}/health")
                return response.status_code == 200
        except:
            return False


class MixesDBClient:
    """
    Async client for MixesDB scraper API
    
    Queries the existing scraper's cached data for track/artist information.
    Does NOT trigger new scraping - uses already-collected data.
    """
    
    def __init__(self, base_url: str = "http://scraper-mixesdb:8081"):
        self.base_url = base_url
        self.timeout = 10.0
    
    async def search_track(self, query: str, limit: int = 20) -> List[Dict[str, Any]]:
        """
        Search cached MixesDB data for track information
        
        Args:
            query: Search query (track title, artist name, or combination)
            limit: Max results to return
            
        Returns:
            List of track dictionaries with artist information
            Format: [{'artist': 'Name', 'title': 'Track', ...}, ...]
        """
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                # Query the scraper's search endpoint
                # This searches CACHED data, doesn't trigger new scrape
                response = await client.get(
                    f"{self.base_url}/search",
                    params={
                        'q': query,
                        'limit': limit
                    }
                )
                
                if response.status_code == 404:
                    logger.debug(
                        "MixesDB API endpoint not found - may need custom implementation",
                        base_url=self.base_url
                    )
                    return []
                
                response.raise_for_status()
                data = response.json()
                
                # Handle different response formats
                if isinstance(data, dict):
                    results = data.get('results', []) or data.get('tracks', [])
                elif isinstance(data, list):
                    results = data
                else:
                    results = []
                
                logger.debug(
                    "MixesDB search completed",
                    query=query,
                    results_count=len(results)
                )
                
                return results[:limit]
                
        except httpx.ConnectError:
            logger.warning(
                "MixesDB scraper not available",
                base_url=self.base_url,
                query=query
            )
            return []
        except httpx.TimeoutException:
            logger.warning(
                "MixesDB search timeout",
                query=query,
                timeout=self.timeout
            )
            return []
        except Exception as e:
            logger.error(
                "MixesDB search error",
                error=str(e),
                query=query
            )
            return []
    
    async def health_check(self) -> bool:
        """Check if MixesDB scraper is available"""
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(f"{self.base_url}/health")
                return response.status_code == 200
        except:
            return False


# ============================================================================
# FALLBACK: Query database directly if scraper APIs not available
# ============================================================================

class DirectDatabaseScraperClient:
    """
    Fallback client that queries the database directly for scraped data
    
    Used when scraper APIs are not available but data exists in database.
    This is a fallback - prefer using the scraper APIs when available.
    """
    
    def __init__(self, db_session_factory):
        self.db_session_factory = db_session_factory
    
    async def search_track_1001(
        self,
        query: str,
        limit: int = 20
    ) -> List[Dict[str, Any]]:
        """
        Search 1001Tracklists data directly from database
        
        Queries the raw_data or scraped_tracks table for 1001TL data
        """
        try:
            from sqlalchemy import text
            
            async with self.db_session_factory() as session:
                # Query scraped data table
                # Assumes scrapers store data with source='1001tracklists'
                search_query = text("""
                    SELECT
                        data->>'artist' as artist,
                        data->>'title' as title,
                        data->>'url' as url,
                        data
                    FROM raw_data
                    WHERE source = '1001tracklists'
                      AND (
                        data->>'title' ILIKE :search
                        OR data->>'artist' ILIKE :search
                      )
                    ORDER BY created_at DESC
                    LIMIT :limit
                """)
                
                result = await session.execute(
                    search_query,
                    {
                        'search': f'%{query}%',
                        'limit': limit
                    }
                )
                
                rows = result.fetchall()
                
                results = []
                for row in rows:
                    results.append({
                        'artist': row.artist,
                        'title': row.title,
                        'url': row.url,
                        'data': row.data
                    })
                
                logger.debug(
                    "Direct DB search for 1001TL",
                    query=query,
                    results=len(results)
                )
                
                return results
                
        except Exception as e:
            logger.error(
                "Direct DB search failed",
                error=str(e),
                source='1001tracklists',
                query=query
            )
            return []
    
    async def search_track_mixesdb(
        self,
        query: str,
        limit: int = 20
    ) -> List[Dict[str, Any]]:
        """
        Search MixesDB data directly from database
        
        Queries the raw_data or scraped_tracks table for MixesDB data
        """
        try:
            from sqlalchemy import text
            
            async with self.db_session_factory() as session:
                # Query scraped data table
                search_query = text("""
                    SELECT
                        data->>'artist' as artist,
                        data->>'title' as title,
                        data
                    FROM raw_data
                    WHERE source = 'mixesdb'
                      AND (
                        data->>'title' ILIKE :search
                        OR data->>'artist' ILIKE :search
                      )
                    ORDER BY created_at DESC
                    LIMIT :limit
                """)
                
                result = await session.execute(
                    search_query,
                    {
                        'search': f'%{query}%',
                        'limit': limit
                    }
                )
                
                rows = result.fetchall()
                
                results = []
                for row in rows:
                    results.append({
                        'artist': row.artist,
                        'title': row.title,
                        'data': row.data
                    })
                
                logger.debug(
                    "Direct DB search for MixesDB",
                    query=query,
                    results=len(results)
                )
                
                return results
                
        except Exception as e:
            logger.error(
                "Direct DB search failed",
                error=str(e),
                source='mixesdb',
                query=query
            )
            return []


# ============================================================================
# CLIENT FACTORY
# ============================================================================

async def create_scraper_clients(
    db_session_factory=None,
    tracklists_1001_url: Optional[str] = None,
    mixesdb_url: Optional[str] = None,
    use_fallback: bool = True
) -> Dict[str, Any]:
    """
    Factory function to create scraper clients
    
    Tries to connect to scraper APIs first, falls back to direct DB access
    if APIs are not available.
    
    Args:
        db_session_factory: Database session factory for fallback
        tracklists_1001_url: Override default 1001TL scraper URL
        mixesdb_url: Override default MixesDB scraper URL
        use_fallback: Enable direct DB fallback if APIs unavailable
        
    Returns:
        Dict with initialized clients: {
            'tracklists_1001': client or None,
            'mixesdb': client or None,
            'fallback': fallback_client or None
        }
    """
    clients = {
        'tracklists_1001': None,
        'mixesdb': None,
        'fallback': None
    }
    
    # Try 1001Tracklists API
    tl_client = TracksLists1001Client(
        base_url=tracklists_1001_url or "http://scraper-1001:8080"
    )
    if await tl_client.health_check():
        clients['tracklists_1001'] = tl_client
        logger.info("✅ 1001Tracklists scraper API connected")
    else:
        logger.warning("⚠️  1001Tracklists scraper API not available - will use fallback")
    
    # Try MixesDB API
    mixesdb_client = MixesDBClient(
        base_url=mixesdb_url or "http://scraper-mixesdb:8081"
    )
    if await mixesdb_client.health_check():
        clients['mixesdb'] = mixesdb_client
        logger.info("✅ MixesDB scraper API connected")
    else:
        logger.warning("⚠️  MixesDB scraper API not available - will use fallback")
    
    # Create fallback client if needed
    if use_fallback and db_session_factory:
        clients['fallback'] = DirectDatabaseScraperClient(db_session_factory)
        logger.info("✅ Direct database fallback enabled")
    
    return clients
