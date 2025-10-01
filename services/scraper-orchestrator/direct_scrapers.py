"""
Direct HTML Scrapers - CSS Selector Based Extraction
Replaces unreliable AI extraction with traditional CSS/regex parsing
"""

import re
from typing import List, Optional
from bs4 import BeautifulSoup
import httpx
import structlog

logger = structlog.get_logger(__name__)


class DirectScrapers:
    """Direct HTTP + CSS selector based scraping (no AI, no browser automation)"""

    def __init__(self):
        self.client = httpx.AsyncClient(
            timeout=httpx.Timeout(30.0),
            follow_redirects=True,
            headers={
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        )

    async def scrape_1001tracklists_artist_page(self, artist_slug: str) -> List[str]:
        """
        Scrape 1001tracklists artist page for tracklist URLs using CSS selectors.

        Args:
            artist_slug: Artist slug (e.g., 'fisher', 'carl-cox')

        Returns:
            List of tracklist URLs
        """
        url = f"https://www.1001tracklists.com/dj/{artist_slug}/index.html"

        try:
            response = await self.client.get(url)
            response.raise_for_status()

            soup = BeautifulSoup(response.text, 'html.parser')

            # Method 1: Find tracklist links in recent tracklists section
            tracklist_urls = []

            # Look for links with /tracklist/ in href
            for link in soup.find_all('a', href=re.compile(r'/tracklist/')):
                href = link.get('href')
                if href and '/tracklist/' in href:
                    # Normalize URL
                    if href.startswith('http'):
                        tracklist_urls.append(href)
                    elif href.startswith('/'):
                        tracklist_urls.append(f"https://www.1001tracklists.com{href}")
                    else:
                        tracklist_urls.append(f"https://www.1001tracklists.com/{href}")

            # Remove duplicates while preserving order
            unique_urls = list(dict.fromkeys(tracklist_urls))

            logger.info(
                "1001tracklists direct scrape completed",
                artist_slug=artist_slug,
                urls_found=len(unique_urls)
            )

            return unique_urls[:50]  # Limit to 50 most recent

        except Exception as e:
            logger.error(
                "1001tracklists direct scrape failed",
                artist_slug=artist_slug,
                error=str(e)
            )
            return []

    async def scrape_mixesdb_search(self, artist: str, title: str) -> List[str]:
        """
        Scrape MixesDB search results for mix URLs using CSS selectors.

        Args:
            artist: Artist name
            title: Track title

        Returns:
            List of mix URLs
        """
        # Use insource: operator for precise matching
        query = f'insource:"{artist} - {title}"'
        encoded_query = httpx.QueryParams({'search': query})
        url = f"https://www.mixesdb.com/w/index.php?{encoded_query}"

        try:
            response = await self.client.get(url)
            response.raise_for_status()

            soup = BeautifulSoup(response.text, 'html.parser')

            mix_urls = []

            # Method 1: Find links in search results
            # MixesDB uses <div class="mw-search-result-heading">
            for result_heading in soup.find_all('div', class_='mw-search-result-heading'):
                link = result_heading.find('a')
                if link and link.get('href'):
                    href = link.get('href')
                    # Normalize URL
                    if href.startswith('http'):
                        mix_urls.append(href)
                    elif href.startswith('/'):
                        mix_urls.append(f"https://www.mixesdb.com{href}")
                    else:
                        mix_urls.append(f"https://www.mixesdb.com/{href}")

            # Method 2: Also check for /db/ links (direct tracklist pages)
            for link in soup.find_all('a', href=re.compile(r'/db/')):
                href = link.get('href')
                if href and '/db/' in href:
                    if href.startswith('http'):
                        mix_urls.append(href)
                    elif href.startswith('/'):
                        mix_urls.append(f"https://www.mixesdb.com{href}")
                    else:
                        mix_urls.append(f"https://www.mixesdb.com/{href}")

            # Remove duplicates
            unique_urls = list(dict.fromkeys(mix_urls))

            logger.info(
                "MixesDB direct scrape completed",
                artist=artist,
                title=title,
                urls_found=len(unique_urls)
            )

            return unique_urls[:30]  # Limit to 30

        except Exception as e:
            logger.error(
                "MixesDB direct scrape failed",
                artist=artist,
                title=title,
                error=str(e)
            )
            return []

    async def close(self):
        """Close HTTP client"""
        await self.client.aclose()
