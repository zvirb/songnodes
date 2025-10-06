"""
🔍 Abbreviation Expander - Centralized Abbreviation Detection and Expansion

This module provides abbreviation expansion services for the entire enrichment system.
Abbreviations are common in music industry (Kft., Ltd., GmbH, Inc., etc.) and can
prevent successful matching when searching external APIs and databases.

Problem: "Gold Music Kft." might not match "Gold Record Music" in search results
Solution: Detect abbreviations and search with both abbreviated and expanded forms

Used by:
- Label Hunter (Priority 1, 2, 3)
- API Clients (Spotify, MusicBrainz, Discogs, etc.)
- Scraper Clients (1001Tracklists, MixesDB)
- Fuzzy Matcher

Example:
    expander = AbbreviationExpander()
    search_terms = await expander.get_search_variants("Gold Music Kft.")
    # Returns: ["Gold Music Kft.", "Gold Record Music", "Gold Music"]
"""

import re
import structlog
from typing import List, Optional, Set
from urllib.parse import quote_plus
import httpx
from bs4 import BeautifulSoup

logger = structlog.get_logger(__name__)


class AbbreviationExpander:
    """
    Centralized abbreviation expansion service

    Detects and expands abbreviations in artist names, label names, and track titles.
    """

    def __init__(
        self,
        cache_ttl: int = 7 * 24 * 3600,  # 7 days
        timeout: float = 10.0
    ):
        self.cache_ttl = cache_ttl
        self.timeout = timeout
        self._cache: dict = {}  # Simple in-memory cache

        # User agents for web search
        self.user_agents = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36'
        ]

    def is_abbreviation(self, text: str) -> bool:
        """
        Detect if text contains likely abbreviations

        Examples:
            "Kft." -> True (period indicator)
            "Ltd." -> True
            "GmbH" -> True (known company suffix)
            "Armada" -> False
            "Gold Music Kft." -> True (contains abbreviation)
            "ft. Someone" -> True (but handled differently in context)
        """
        # Check for periods (strong signal for abbreviations)
        if '.' in text:
            words = text.split()
            for word in words:
                if '.' in word and len(word.replace('.', '')) <= 6:
                    return True

        # Check for common company suffixes (especially non-English)
        company_suffixes = [
            'gmbh', 'kft', 'llc', 'ltd', 'inc', 'corp', 'plc',
            's.a.', 's.r.l.', 'ag', 'bv', 'nv', 'oy', 'ab', 'aps'
        ]
        text_lower = text.lower()

        # Use word boundaries to avoid false positives
        for suffix in company_suffixes:
            # Match suffix at word boundary or end of string
            pattern = rf'\b{re.escape(suffix)}\b|\b{re.escape(suffix)}$'
            if re.search(pattern, text_lower):
                return True

        return False

    def extract_abbreviation_part(self, text: str) -> Optional[str]:
        """
        Extract just the abbreviated part from text

        Examples:
            "Gold Music Kft." -> "Kft."
            "XYZ Records Ltd." -> "Ltd."
            "Normal Label" -> None
        """
        words = text.split()

        # Find word with period
        for word in words:
            if '.' in word and len(word.replace('.', '')) <= 6:
                return word

        # Find known company suffix
        company_suffixes = ['kft', 'gmbh', 'llc', 'ltd', 'inc', 'corp', 'plc']
        for word in words:
            if word.lower() in company_suffixes:
                return word

        return None

    async def expand_abbreviation(
        self,
        text: str,
        context: str = "EDM music industry"
    ) -> List[str]:
        """
        Use web search to find expansions for abbreviations

        Args:
            text: Text containing abbreviation (e.g., "Gold Music Kft.")
            context: Context to help search (e.g., "EDM record label", "artist name")

        Returns:
            List of possible expansions (max 3)
        """
        # Check cache first
        cache_key = f"abbrev:{text.lower()}:{context}"
        if cache_key in self._cache:
            logger.debug("Abbreviation expansion cache hit", text=text)
            return self._cache[cache_key]

        try:
            # Extract the abbreviated part
            abbrev_word = self.extract_abbreviation_part(text)
            if not abbrev_word:
                logger.debug("No abbreviation found in text", text=text)
                return []

            # Build search query
            search_query = f"{text} {context} full name meaning"

            logger.info(
                "🔍 Searching for abbreviation expansion",
                text=text,
                abbreviation=abbrev_word,
                search_query=search_query
            )

            # Use DuckDuckGo HTML search (no API key required)
            search_url = f"https://html.duckduckgo.com/html/?q={quote_plus(search_query)}"

            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(
                    search_url,
                    headers={
                        'User-Agent': self.user_agents[0],
                        'Accept': 'text/html',
                    }
                )

                if response.status_code != 200:
                    logger.debug("Web search failed", status=response.status_code)
                    return []

                soup = BeautifulSoup(response.text, 'html.parser')

                # Extract text from search results
                expansions = set()  # Use set to avoid duplicates

                # Look for result snippets
                snippets = soup.select('.result__snippet')[:5]

                for snippet in snippets:
                    snippet_text = snippet.get_text()

                    # Pattern 1: "Kft. is/stands for/means/represents X"
                    pattern1 = re.search(
                        rf"{re.escape(abbrev_word)}\s+(?:is|stands for|means|represents)\s+([A-Z][a-zA-Z\s]+)",
                        snippet_text,
                        re.IGNORECASE
                    )
                    if pattern1:
                        expansion = pattern1.group(1).strip()
                        # Clean up expansion
                        expansion = re.sub(r'\s+', ' ', expansion)
                        if len(expansion) > 3 and len(expansion) < 50:
                            expansions.add(expansion)

                    # Pattern 2: Text in parentheses after abbreviation
                    # Example: "Kft. (Korlátolt Felelősségű Társaság)"
                    pattern2 = re.search(
                        rf"{re.escape(abbrev_word)}\s*\(([A-Z][^\)]+)\)",
                        snippet_text
                    )
                    if pattern2:
                        expansion = pattern2.group(1).strip()
                        expansion = re.sub(r'\s+', ' ', expansion)
                        if len(expansion) > 3 and len(expansion) < 50:
                            expansions.add(expansion)

                    # Pattern 3: Capitalized words before abbreviation
                    # Example: "Gold Record Music Kft."
                    pattern3 = re.search(
                        rf"([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+{re.escape(abbrev_word)}",
                        snippet_text
                    )
                    if pattern3:
                        expansion = pattern3.group(1).strip()
                        if len(expansion) > 3 and len(expansion) < 50:
                            expansions.add(expansion)

                # Convert to list and limit to top 3
                expansion_list = list(expansions)[:3]

                # Cache results
                self._cache[cache_key] = expansion_list

                if expansion_list:
                    logger.info(
                        "✅ Found abbreviation expansions",
                        text=text,
                        abbreviation=abbrev_word,
                        expansions=expansion_list
                    )
                else:
                    logger.debug(
                        "No abbreviation expansions found",
                        text=text,
                        abbreviation=abbrev_word
                    )

                return expansion_list

        except Exception as e:
            logger.warning(
                "Abbreviation expansion search failed",
                error=str(e),
                text=text
            )
            return []

    async def get_search_variants(
        self,
        text: str,
        context: str = "music industry",
        include_stripped: bool = True
    ) -> List[str]:
        """
        Get all search variants for a text that may contain abbreviations

        This is the PRIMARY method to use for searching.

        Args:
            text: Original text (e.g., "Gold Music Kft.")
            context: Search context to help expansion
            include_stripped: Also include version with abbreviation removed

        Returns:
            List of search variants to try:
            - Original text (always first)
            - Expanded forms (if abbreviation detected)
            - Stripped version without abbreviation (optional)

        Example:
            variants = await expander.get_search_variants("Gold Music Kft.")
            # Returns: ["Gold Music Kft.", "Gold Record Music", "Gold Music"]
        """
        variants = [text]  # Always include original

        if not self.is_abbreviation(text):
            return variants

        # Get expansions
        expansions = await self.expand_abbreviation(text, context)
        variants.extend(expansions)

        # Add stripped version (remove abbreviation)
        if include_stripped:
            abbrev_part = self.extract_abbreviation_part(text)
            if abbrev_part:
                # Remove abbreviation and clean up
                stripped = text.replace(abbrev_part, '').strip()
                # Clean up extra whitespace and trailing punctuation
                stripped = re.sub(r'\s+', ' ', stripped)
                stripped = stripped.rstrip('.,;:-')
                if stripped and stripped not in variants:
                    variants.append(stripped)

        # Remove duplicates while preserving order
        seen = set()
        unique_variants = []
        for variant in variants:
            variant_lower = variant.lower()
            if variant_lower not in seen:
                seen.add(variant_lower)
                unique_variants.append(variant)

        logger.debug(
            "Generated search variants",
            original=text,
            variants=unique_variants,
            count=len(unique_variants)
        )

        return unique_variants

    def clear_cache(self):
        """Clear the expansion cache"""
        self._cache.clear()
        logger.info("Abbreviation expansion cache cleared")


# ============================================================================
# GLOBAL SINGLETON INSTANCE
# ============================================================================

_global_expander: Optional[AbbreviationExpander] = None


def get_abbreviation_expander() -> AbbreviationExpander:
    """
    Get the global AbbreviationExpander singleton instance

    Usage:
        from abbreviation_expander import get_abbreviation_expander

        expander = get_abbreviation_expander()
        variants = await expander.get_search_variants("Gold Music Kft.")
    """
    global _global_expander
    if _global_expander is None:
        _global_expander = AbbreviationExpander()
        logger.info("✅ Global AbbreviationExpander initialized")
    return _global_expander
