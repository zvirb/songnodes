"""
Advanced LLM-Powered Scraping Engine
Uses AI to dynamically analyze HTML and generate extraction logic
"""

import re
import json
import logging
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass
from bs4 import BeautifulSoup
import os
import time

# Optional LLM imports with graceful fallback
try:
    import openai
    OPENAI_AVAILABLE = True
except ImportError:
    OPENAI_AVAILABLE = False
    openai = None

try:
    from anthropic import Anthropic
    ANTHROPIC_AVAILABLE = True
except ImportError:
    ANTHROPIC_AVAILABLE = False
    Anthropic = None

try:
    import requests
    REQUESTS_AVAILABLE = True
except ImportError:
    REQUESTS_AVAILABLE = False

logger = logging.getLogger(__name__)


@dataclass
class ExtractionResult:
    """Result of an extraction attempt"""
    success: bool
    data: List[Dict[str, Any]]
    confidence: float
    extraction_method: str
    error_message: Optional[str] = None
    iterations: int = 0


class LLMScraperEngine:
    """
    Intelligent scraping engine that uses LLM to:
    1. Analyze HTML structure
    2. Generate extraction logic (CSS selectors, regex, XPath)
    3. Validate extracted data
    4. Iterate until successful extraction
    """

    def __init__(self, provider: str = "ollama", api_key: Optional[str] = None, ollama_url: str = None):
        """Initialize the LLM scraper engine"""
        self.provider = provider
        self.client = None
        self.api_key = None
        # Auto-detect Ollama URL based on environment
        if ollama_url:
            self.ollama_url = ollama_url
        else:
            # Try Docker network first, then localhost
            self.ollama_url = "http://ollama:11434" if os.path.exists("/.dockerenv") else "http://localhost:11434"
        self.ollama_model = "llama3.2:3b"  # Default model

        if provider == "ollama" and REQUESTS_AVAILABLE:
            # Test Ollama connection
            try:
                response = requests.get(f"{self.ollama_url}/api/tags", timeout=5)
                if response.status_code == 200:
                    self.client = "ollama"  # Mark as available
                    logger.info(f"Connected to Ollama at {self.ollama_url}")
                else:
                    logger.warning(f"Ollama not available at {self.ollama_url}")
            except Exception as e:
                logger.warning(f"Could not connect to Ollama: {e}")
        elif provider == "openai" and OPENAI_AVAILABLE:
            self.api_key = api_key or os.getenv("OPENAI_API_KEY")
            if self.api_key:
                openai.api_key = self.api_key
                self.client = openai
        elif provider == "anthropic" and ANTHROPIC_AVAILABLE:
            self.api_key = api_key or os.getenv("ANTHROPIC_API_KEY")
            if self.api_key:
                self.client = Anthropic(api_key=self.api_key)

        if not self.client:
            # Fallback to pattern matching
            logger.info("No LLM client available, using pattern-based extraction")

        self.max_iterations = 5
        self.confidence_threshold = 0.8

    def analyze_html_structure(self, html: str, target_data: str) -> Dict[str, Any]:
        """
        Analyze HTML to understand its structure for the target data
        """
        soup = BeautifulSoup(html, 'html.parser')

        analysis = {
            "total_elements": len(soup.find_all()),
            "structure_patterns": [],
            "likely_containers": [],
            "data_patterns": []
        }

        # Find patterns based on target data type
        if "tracklist" in target_data.lower():
            # Look for tracklist patterns
            patterns = [
                r'class=["\'].*track.*["\']',
                r'class=["\'].*song.*["\']',
                r'class=["\'].*playlist.*["\']',
                r'data-track',
                r'itemprop=["\']track["\']'
            ]

            for pattern in patterns:
                matches = re.findall(pattern, html, re.IGNORECASE)
                if matches:
                    analysis["structure_patterns"].append({
                        "pattern": pattern,
                        "count": len(matches),
                        "sample": matches[:3]
                    })

        elif "artist" in target_data.lower():
            # Look for artist patterns
            patterns = [
                r'class=["\'].*artist.*["\']',
                r'class=["\'].*performer.*["\']',
                r'itemprop=["\'].*artist["\']'
            ]

            for pattern in patterns:
                matches = re.findall(pattern, html, re.IGNORECASE)
                if matches:
                    analysis["structure_patterns"].append({
                        "pattern": pattern,
                        "count": len(matches)
                    })

        # Find likely data containers
        for element in soup.find_all(['div', 'ul', 'table', 'article', 'section']):
            if element.get('class'):
                classes = ' '.join(element.get('class'))
                if any(keyword in classes.lower() for keyword in ['track', 'song', 'playlist', 'setlist', 'mix']):
                    analysis["likely_containers"].append({
                        "tag": element.name,
                        "classes": classes,
                        "children_count": len(element.find_all())
                    })

        return analysis

    def generate_extraction_logic(self, html: str, target_data: str, previous_attempts: List[Dict] = None) -> Dict[str, Any]:
        """
        Generate extraction logic using LLM or pattern matching
        """
        if self.client and self.provider == "ollama":
            return self._generate_with_ollama(html, target_data, previous_attempts)
        elif self.client and self.provider == "openai":
            return self._generate_with_openai(html, target_data, previous_attempts)
        elif self.client and self.provider == "anthropic":
            return self._generate_with_anthropic(html, target_data, previous_attempts)
        else:
            return self._generate_with_patterns(html, target_data)

    def _generate_with_ollama(self, html: str, target_data: str, previous_attempts: List[Dict] = None) -> Dict[str, Any]:
        """Generate extraction logic using Ollama"""
        try:
            # Truncate HTML if too long
            html_snippet = html[:4000] if len(html) > 4000 else html

            prompt = f"""You are an expert web scraper. Analyze this HTML and generate extraction logic for {target_data}.

HTML snippet:
{html_snippet}

Previous attempts that failed:
{json.dumps(previous_attempts or [], indent=2)}

Respond with valid JSON only:
{{
    "css_selectors": ["selector1", "selector2", "selector3"],
    "regex_patterns": ["pattern1", "pattern2"],
    "extraction_strategy": "step-by-step plan",
    "confidence": 0.85
}}

Focus on finding the most specific selectors that target {target_data}."""

            # Make request to Ollama
            response = requests.post(
                f"{self.ollama_url}/api/generate",
                json={
                    "model": self.ollama_model,
                    "prompt": prompt,
                    "stream": False,
                    "options": {
                        "temperature": 0.1,
                        "top_p": 0.9
                    }
                },
                timeout=30
            )

            if response.status_code == 200:
                result = response.json()
                response_text = result.get("response", "")

                # Try to extract JSON from response
                try:
                    # Look for JSON in the response
                    import re
                    # More robust JSON extraction
                    json_matches = re.findall(r'\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}', response_text, re.DOTALL)

                    for json_text in json_matches:
                        try:
                            extraction_logic = json.loads(json_text)
                            # Validate it has expected keys
                            if 'css_selectors' in extraction_logic or 'regex_patterns' in extraction_logic:
                                logger.info("Ollama generated extraction logic successfully")
                                return extraction_logic
                        except json.JSONDecodeError:
                            continue

                    logger.warning("No valid JSON found in Ollama response")
                    logger.debug(f"Ollama response: {response_text}")
                    return self._generate_with_patterns(html, target_data)
                except Exception as e:
                    logger.warning(f"Failed to parse Ollama response: {e}")
                    return self._generate_with_patterns(html, target_data)
            else:
                logger.error(f"Ollama request failed with status {response.status_code}")
                return self._generate_with_patterns(html, target_data)

        except Exception as e:
            logger.error(f"Ollama generation failed: {e}")
            return self._generate_with_patterns(html, target_data)

    def _generate_with_openai(self, html: str, target_data: str, previous_attempts: List[Dict] = None) -> Dict[str, Any]:
        """Generate extraction logic using OpenAI"""
        try:
            # Truncate HTML if too long
            html_snippet = html[:8000] if len(html) > 8000 else html

            prompt = f"""
            Analyze this HTML and generate extraction logic for {target_data}.

            HTML snippet:
            {html_snippet}

            Previous attempts that failed:
            {json.dumps(previous_attempts or [], indent=2)}

            Generate a JSON response with:
            1. css_selectors: List of CSS selectors to try
            2. regex_patterns: List of regex patterns for text extraction
            3. extraction_strategy: Step-by-step extraction plan
            4. confidence: Your confidence level (0-1)

            Focus on extracting: track names, artist names, timestamps, and any metadata.
            """

            response = self.client.ChatCompletion.create(
                model="gpt-3.5-turbo",
                messages=[
                    {"role": "system", "content": "You are an expert at web scraping and HTML parsing."},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=1000,
                temperature=0.3
            )

            return json.loads(response.choices[0].message.content)

        except Exception as e:
            logger.error(f"OpenAI generation failed: {e}")
            return self._generate_with_patterns(html, target_data)

    def _generate_with_anthropic(self, html: str, target_data: str, previous_attempts: List[Dict] = None) -> Dict[str, Any]:
        """Generate extraction logic using Anthropic Claude"""
        try:
            # Truncate HTML if too long
            html_snippet = html[:8000] if len(html) > 8000 else html

            prompt = f"""
            Analyze this HTML and generate extraction logic for {target_data}.

            HTML snippet:
            {html_snippet}

            Previous attempts that failed:
            {json.dumps(previous_attempts or [], indent=2)}

            Generate a JSON response with:
            1. css_selectors: List of CSS selectors to try
            2. regex_patterns: List of regex patterns for text extraction
            3. extraction_strategy: Step-by-step extraction plan
            4. confidence: Your confidence level (0-1)

            Focus on extracting: track names, artist names, timestamps, and any metadata.
            """

            message = self.client.messages.create(
                model="claude-3-haiku-20240307",
                max_tokens=1000,
                temperature=0.3,
                messages=[
                    {"role": "user", "content": prompt}
                ]
            )

            return json.loads(message.content[0].text)

        except Exception as e:
            logger.error(f"Anthropic generation failed: {e}")
            return self._generate_with_patterns(html, target_data)

    def _generate_with_patterns(self, html: str, target_data: str) -> Dict[str, Any]:
        """Fallback pattern-based generation"""

        # Common patterns for music data
        if "tracklist" in target_data.lower() or "1001" in target_data.lower():
            return {
                "css_selectors": [
                    "div.tlLink a",
                    "a[href*='/tracklist/']",
                    "div[class*='track'] a",
                    "table.tracklist a",
                    ".playlist-item a",
                    "div.search-results a",
                    "a.track-link",
                    "[data-track-id]",
                    ".track-row",
                    ".tl-track-row",
                    "div[data-tid]"
                ],
                "regex_patterns": [
                    r'href=["\']([^"\']*\/tracklist\/[^"\']*)["\']',
                    r'<a[^>]*class=["\'][^"\']*track[^"\']*["\'][^>]*>(.*?)<\/a>',
                    r'data-track-name=["\']([^"\']+)["\']',
                    r'<span[^>]*class=["\']track-name["\'][^>]*>(.*?)<\/span>'
                ],
                "extraction_strategy": "Try CSS selectors first, then regex patterns",
                "confidence": 0.6
            }

        elif "mixesdb" in target_data.lower():
            return {
                "css_selectors": [
                    "a[href*='Category:']",
                    ".mw-category-group a",
                    "#mw-content-text a",
                    "div.mw-category a",
                    "table.wikitable a"
                ],
                "regex_patterns": [
                    r'href=["\']([^"\']*Category:[^"\']*)["\']',
                    r'title=["\']([^"\']+)["\']'
                ],
                "extraction_strategy": "Extract category and mix links",
                "confidence": 0.6
            }

        elif "setlist" in target_data.lower():
            return {
                "css_selectors": [
                    ".setlist-song",
                    ".song-name",
                    "div[class*='setlist'] span",
                    ".track-list li"
                ],
                "regex_patterns": [
                    r'"name"\s*:\s*"([^"]+)"',
                    r'<li[^>]*class=["\']song["\'][^>]*>(.*?)<\/li>'
                ],
                "extraction_strategy": "Extract setlist songs and metadata",
                "confidence": 0.5
            }

        return {
            "css_selectors": ["a", "div", "span"],
            "regex_patterns": [r'<a[^>]*>(.*?)<\/a>'],
            "extraction_strategy": "Generic extraction",
            "confidence": 0.3
        }

    def extract_with_css(self, html: str, selectors: List[str]) -> List[Dict[str, Any]]:
        """Extract data using CSS selectors"""
        soup = BeautifulSoup(html, 'html.parser')
        results = []

        for selector in selectors:
            try:
                elements = soup.select(selector)
                for elem in elements:
                    data = {
                        "text": elem.get_text(strip=True),
                        "href": elem.get('href') if elem.name == 'a' else elem.find('a').get('href') if elem.find('a') else None,
                        "classes": ' '.join(elem.get('class', [])),
                        "data_attributes": {k: v for k, v in elem.attrs.items() if k.startswith('data-')}
                    }

                    # Filter out empty results
                    if data["text"] or data["href"]:
                        results.append(data)

                if results:
                    logger.info(f"CSS selector '{selector}' found {len(results)} items")
                    break  # Use first successful selector

            except Exception as e:
                logger.debug(f"CSS selector '{selector}' failed: {e}")
                continue

        return results

    def extract_with_regex(self, html: str, patterns: List[str]) -> List[Dict[str, Any]]:
        """Extract data using regex patterns"""
        results = []

        for pattern in patterns:
            try:
                matches = re.findall(pattern, html, re.IGNORECASE | re.DOTALL)
                for match in matches:
                    if isinstance(match, tuple):
                        data = {"text": match[0] if match else "", "raw_match": match}
                    else:
                        data = {"text": match}
                    results.append(data)

                if results:
                    logger.info(f"Regex pattern found {len(results)} matches")
                    break

            except Exception as e:
                logger.debug(f"Regex pattern '{pattern}' failed: {e}")
                continue

        return results

    def validate_extraction(self, data: List[Dict[str, Any]], target_data: str) -> Tuple[bool, float]:
        """
        Validate if extracted data matches expected format
        Returns (is_valid, confidence_score)
        """
        if not data:
            return False, 0.0

        # Check for expected data patterns
        confidence = 0.0

        if "tracklist" in target_data.lower():
            # Check for tracklist URLs
            has_urls = any((item.get('href') or '').count('/tracklist/') > 0 for item in data)
            has_text = any(len(item.get('text', '')) > 3 for item in data)

            if has_urls:
                confidence += 0.5
            if has_text:
                confidence += 0.3
            if len(data) > 5:  # Multiple items suggest a list
                confidence += 0.2

        elif "artist" in target_data.lower():
            # Check for artist names
            has_names = any(len(item.get('text', '')) > 2 for item in data)
            if has_names:
                confidence += 0.7
            if len(data) > 0:
                confidence += 0.3

        elif "setlist" in target_data.lower():
            # Check for song names
            has_songs = any(len(item.get('text', '')) > 2 for item in data)
            if has_songs:
                confidence += 0.6
            if len(data) > 3:  # Setlists usually have multiple songs
                confidence += 0.4

        is_valid = confidence >= self.confidence_threshold
        return is_valid, min(confidence, 1.0)

    def iterative_extraction(self, html: str, target_data: str) -> ExtractionResult:
        """
        Main extraction method that iterates until successful
        """
        attempts = []
        best_result = None
        best_confidence = 0.0

        for iteration in range(self.max_iterations):
            logger.info(f"Extraction iteration {iteration + 1}/{self.max_iterations} for {target_data}")

            # Generate extraction logic
            logic = self.generate_extraction_logic(html, target_data, attempts)

            # Try CSS selectors first
            if logic.get("css_selectors"):
                css_data = self.extract_with_css(html, logic["css_selectors"])
                is_valid, confidence = self.validate_extraction(css_data, target_data)

                if is_valid:
                    return ExtractionResult(
                        success=True,
                        data=css_data,
                        confidence=confidence,
                        extraction_method="css_selectors",
                        iterations=iteration + 1
                    )

                if confidence > best_confidence:
                    best_confidence = confidence
                    best_result = css_data

                attempts.append({
                    "method": "css_selectors",
                    "selectors": logic["css_selectors"][:3],  # Log first 3 tried
                    "result_count": len(css_data),
                    "confidence": confidence
                })

            # Try regex patterns
            if logic.get("regex_patterns"):
                regex_data = self.extract_with_regex(html, logic["regex_patterns"])
                is_valid, confidence = self.validate_extraction(regex_data, target_data)

                if is_valid:
                    return ExtractionResult(
                        success=True,
                        data=regex_data,
                        confidence=confidence,
                        extraction_method="regex_patterns",
                        iterations=iteration + 1
                    )

                if confidence > best_confidence:
                    best_confidence = confidence
                    best_result = regex_data

                attempts.append({
                    "method": "regex_patterns",
                    "patterns": logic["regex_patterns"][:2],  # Log first 2 tried
                    "result_count": len(regex_data),
                    "confidence": confidence
                })

            # Add delay between iterations
            if iteration < self.max_iterations - 1:
                time.sleep(0.5)

        # Return best attempt even if not meeting threshold
        return ExtractionResult(
            success=best_confidence > 0.3,  # Lower threshold for partial success
            data=best_result or [],
            confidence=best_confidence,
            extraction_method="best_attempt",
            iterations=self.max_iterations,
            error_message=f"Could not achieve confidence threshold. Best: {best_confidence:.2f}"
        )

    def extract_structured_data(self, html: str, schema: Dict[str, str]) -> Dict[str, Any]:
        """
        Extract data according to a specific schema

        Args:
            html: HTML content
            schema: Dictionary mapping field names to descriptions

        Returns:
            Dictionary with extracted fields
        """
        result = {}

        for field_name, field_description in schema.items():
            extraction = self.iterative_extraction(html, field_description)

            if extraction.success:
                result[field_name] = extraction.data
                logger.info(f"Successfully extracted {field_name}: {len(extraction.data)} items")
            else:
                result[field_name] = []
                logger.warning(f"Failed to extract {field_name}: {extraction.error_message}")

        return result


# Integration helper for Scrapy spiders
class ScrapyLLMExtractor:
    """Helper class to integrate LLM extraction with Scrapy spiders"""

    def __init__(self, spider_name: str):
        self.spider_name = spider_name
        self.engine = LLMScraperEngine(provider="ollama")  # Use local Ollama

    def extract_tracklists(self, response) -> List[str]:
        """Extract tracklist URLs from a response"""
        html = response.text
        result = self.engine.iterative_extraction(html, f"tracklist URLs for {self.spider_name}")

        if result.success:
            # Return just the URLs
            return [item.get('href') for item in result.data if item.get('href')]
        else:
            logger.warning(f"LLM extraction failed for {self.spider_name}: {result.error_message}")
            return []

    def extract_tracks(self, response) -> List[Dict[str, Any]]:
        """Extract track information from a response"""
        html = response.text

        schema = {
            "track_names": "track or song names",
            "artist_names": "artist or performer names",
            "timestamps": "timestamps or track positions",
            "labels": "record labels or releases"
        }

        structured_data = self.engine.extract_structured_data(html, schema)

        # Combine into track items
        tracks = []
        track_names = structured_data.get("track_names", [])
        artist_names = structured_data.get("artist_names", [])

        for i, track_data in enumerate(track_names):
            track = {
                "name": track_data.get("text", ""),
                "artist": artist_names[i].get("text", "") if i < len(artist_names) else "",
                "position": i + 1
            }
            tracks.append(track)

        return tracks