"""
Ollama LLM Extraction Service
Extracts structured data from raw HTML/text using local Ollama models
"""
import asyncio
import json
import logging
import os
import time
from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import UUID

import httpx
import structlog
from pydantic import BaseModel, Field

logger = structlog.get_logger(__name__)


def _default_ollama_url() -> str:
    env_url = os.getenv("OLLAMA_URL")
    if env_url:
        return env_url
    if os.getenv("KUBERNETES_SERVICE_HOST"):
        return "http://ollama-maxwell.phoenix.svc.cluster.local:11434"
    if os.path.exists("/.dockerenv"):
        return "http://ollama:11434"
    return "http://localhost:11434"


class ExtractionResult(BaseModel):
    """Result of an Ollama extraction"""
    success: bool
    extracted_data: Optional[Dict[str, Any]] = None
    confidence_score: float = 0.0
    tokens_processed: int = 0
    processing_time_ms: int = 0
    error_message: Optional[str] = None
    model_used: str


class OllamaConfig(BaseModel):
    """Configuration for Ollama connection"""
    base_url: str = Field(default_factory=_default_ollama_url)
    default_model: str = "llama3.2:3b"  # Fast, capable 3B parameter model
    timeout: int = 120
    max_retries: int = 3
    temperature: float = 0.1  # Low temperature for consistent extraction
    top_p: float = 0.9


class PromptTemplates:
    """Extraction prompt templates for different data types"""

    TRACKLIST_EXTRACTION = """You are a music data extraction specialist. Extract tracklist information from the following text.

TEXT TO ANALYZE:
{raw_text}

INSTRUCTIONS:
1. Identify all tracks/songs mentioned
2. Extract: track number, artist name, track title, time/timestamp if available
3. Preserve exact spelling and formatting
4. If information is unclear, mark confidence as "low"

OUTPUT FORMAT (JSON):
{{
    "tracks": [
        {{
            "position": 1,
            "artist": "Artist Name",
            "title": "Track Title",
            "time": "12:34",
            "confidence": "high|medium|low"
        }}
    ],
    "metadata": {{
        "dj_name": "DJ Name if mentioned",
        "event_name": "Event Name if mentioned",
        "date": "Date if mentioned",
        "venue": "Venue if mentioned"
    }}
}}

Extract and return ONLY valid JSON. No explanations, no markdown formatting."""

    ARTIST_INFO_EXTRACTION = """You are a music metadata extraction specialist. Extract artist information from the following text.

TEXT TO ANALYZE:
{raw_text}

INSTRUCTIONS:
1. Extract artist name, genres, biography details
2. Identify social media links, websites
3. Extract discography information if present
4. Note record labels, collaborations

OUTPUT FORMAT (JSON):
{{
    "artist_name": "Artist Name",
    "genres": ["Genre1", "Genre2"],
    "biography": "Short biography",
    "links": {{
        "website": "URL",
        "soundcloud": "URL",
        "facebook": "URL",
        "instagram": "URL"
    }},
    "record_labels": ["Label1", "Label2"],
    "notable_tracks": ["Track1", "Track2"]
}}

Extract and return ONLY valid JSON. No explanations."""

    EVENT_INFO_EXTRACTION = """You are an event data extraction specialist. Extract event/show information from the following text.

TEXT TO ANALYZE:
{raw_text}

INSTRUCTIONS:
1. Extract event name, date, time, venue
2. Identify lineup/performers
3. Extract ticket information if present
4. Note genres, event type

OUTPUT FORMAT (JSON):
{{
    "event_name": "Event Name",
    "date": "YYYY-MM-DD",
    "time": "HH:MM",
    "venue": "Venue Name",
    "location": "City, Country",
    "lineup": ["Artist1", "Artist2"],
    "genres": ["Genre1", "Genre2"],
    "ticket_link": "URL if available",
    "description": "Event description"
}}

Extract and return ONLY valid JSON. No explanations."""

    MUSIC_METADATA_EXTRACTION = """You are a music metadata extraction specialist. Extract detailed track metadata from the following text.

TEXT TO ANALYZE:
{raw_text}

INSTRUCTIONS:
1. Extract track title, artist, album, release year
2. Identify BPM, key, genre if mentioned
3. Extract label, catalog number if present
4. Note any remix information

OUTPUT FORMAT (JSON):
{{
    "title": "Track Title",
    "artist": "Artist Name",
    "album": "Album Name",
    "year": 2024,
    "bpm": 128,
    "key": "Am",
    "genre": "Techno",
    "label": "Record Label",
    "catalog_number": "CAT123",
    "remixer": "Remixer Name if remix",
    "duration": "6:30"
}}

Extract and return ONLY valid JSON. No explanations."""

    TRACKLIST_URL_EXTRACTION = """You are a URL extraction specialist. Extract REAL tracklist/setlist/mix URLs FROM SEARCH RESULTS ONLY.

HTML CONTENT TO ANALYZE:
{raw_text}

CRITICAL INSTRUCTIONS - READ CAREFULLY:

1. FIRST: Check if the search returned NO RESULTS
   - Look for phrases like "did not match", "no results", "no setlists found", "0 results"
   - If you find these phrases, IMMEDIATELY return an empty array {{}} - DO NOT extract any URLs

2. IGNORE sidebar content, popular items, recommended content, recent activity
   - Only extract URLs that are ACTUAL SEARCH RESULTS for the query
   - DO NOT extract URLs from "Popular Setlists", "Trending", "You might like", etc.

3. VERIFY each URL matches the search query artist/track
   - If the search was for "Calvin Harris", only return URLs containing "Calvin Harris"
   - DO NOT return URLs for Paul McCartney, Zach Bryan, or other unrelated artists

4. It is BETTER to return NO URLs than to return URLs for wrong artists/tracks

5. DO NOT invent, generate, or return example URLs

6. DO NOT return placeholder URLs like "abc123", "12345", or "example"

VALID URL PATTERNS (only from main search results, not sidebars):
- href="/tracklist/[ID]/[name].html"
- href="/setlist/[artist]/[details]"
- href="/db/mix/[number]"
- href="https://www.1001tracklists.com/tracklist/..."
- href="https://www.mixesdb.com/db/..."
- href="https://www.setlist.fm/setlist/..."

INVALID (NEVER INCLUDE):
- URLs from "Popular Setlists" or sidebar recommendations
- URLs for artists different from the search query
- Search URLs containing "?query=" or "/search"
- Homepage links (/, /index, /home)
- Navigation links (/about, /artists, /contact)
- Social media links (facebook, twitter, instagram)
- Placeholder/example URLs

VERIFICATION CHECKLIST:
[ ] Did the search return "no results"? → Return empty array
[ ] Is this URL from the main search results (not sidebar)? → Yes = proceed, No = skip
[ ] Does the URL contain the artist/track from the search query? → Yes = proceed, No = skip
[ ] Does the URL actually appear in the HTML? → Yes = include, No = skip

OUTPUT FORMAT (JSON):
{{
    "tracklist_urls": [],
    "total_found": 0,
    "platform": "1001tracklists|mixesdb|setlistfm|unknown"
}}

REMEMBER: If search shows "no results", return empty array. If URLs are for different artists, return empty array. No data is better than false data. Extract and return ONLY valid JSON."""


class OllamaExtractor:
    """
    Manages Ollama LLM extraction tasks with intelligent retry logic,
    error handling, and performance monitoring
    """

    def __init__(self, config: Optional[OllamaConfig] = None):
        self.config = config or OllamaConfig()
        self.client = httpx.AsyncClient(
            base_url=self.config.base_url,
            timeout=httpx.Timeout(self.config.timeout)
        )
        self.templates = PromptTemplates()

    async def extract_with_ollama(
        self,
        raw_text: str,
        extraction_type: str,
        model: Optional[str] = None,
        custom_prompt: Optional[str] = None,
        context: Optional[Dict[str, Any]] = None
    ) -> ExtractionResult:
        """
        Extract structured data using Ollama LLM

        Args:
            raw_text: Raw text/HTML content to extract from
            extraction_type: Type of extraction ('tracklist', 'artist', 'event', 'metadata')
            model: Ollama model to use (defaults to config default)
            custom_prompt: Custom prompt template (overrides built-in templates)
            context: Additional context for extraction

        Returns:
            ExtractionResult with extracted data
        """
        start_time = time.time()
        model = model or self.config.default_model

        try:
            # Select appropriate prompt template
            prompt_template = custom_prompt or self._get_prompt_template(extraction_type)

            # Format prompt with context
            prompt = self._format_prompt(prompt_template, raw_text, context)

            logger.info(
                "Starting Ollama extraction",
                extraction_type=extraction_type,
                model=model,
                text_length=len(raw_text)
            )

            # Call Ollama API
            extracted_data, tokens = await self._call_ollama(model, prompt)

            processing_time = int((time.time() - start_time) * 1000)

            # Calculate confidence score based on completeness
            confidence = self._calculate_confidence(extracted_data, extraction_type)

            logger.info(
                "Extraction completed",
                extraction_type=extraction_type,
                confidence=confidence,
                processing_time_ms=processing_time,
                tokens_processed=tokens
            )

            return ExtractionResult(
                success=True,
                extracted_data=extracted_data,
                confidence_score=confidence,
                tokens_processed=tokens,
                processing_time_ms=processing_time,
                model_used=model
            )

        except Exception as e:
            processing_time = int((time.time() - start_time) * 1000)
            logger.error(
                "Extraction failed",
                extraction_type=extraction_type,
                model=model,
                error=str(e),
                processing_time_ms=processing_time
            )

            return ExtractionResult(
                success=False,
                error_message=str(e),
                processing_time_ms=processing_time,
                model_used=model
            )

    async def _call_ollama(self, model: str, prompt: str) -> tuple[Dict[str, Any], int]:
        """
        Make API call to Ollama with retry logic

        Returns:
            Tuple of (extracted_data dict, tokens_processed)
        """
        for attempt in range(self.config.max_retries):
            try:
                response = await self.client.post(
                    "/api/generate",
                    json={
                        "model": model,
                        "prompt": prompt,
                        "stream": False,
                        "options": {
                            "temperature": self.config.temperature,
                            "top_p": self.config.top_p,
                            "num_predict": 2048,  # Max tokens to generate
                        },
                        "format": "json"  # Request JSON output
                    }
                )

                response.raise_for_status()
                result = response.json()

                # Extract response text
                response_text = result.get("response", "")
                tokens = result.get("eval_count", 0)

                # Parse JSON from response
                extracted_data = self._parse_json_response(response_text)

                return extracted_data, tokens

            except httpx.HTTPError as e:
                logger.warning(
                    "Ollama API call failed",
                    attempt=attempt + 1,
                    max_retries=self.config.max_retries,
                    error=str(e)
                )

                if attempt == self.config.max_retries - 1:
                    raise

                # Exponential backoff
                await asyncio.sleep(2 ** attempt)

            except json.JSONDecodeError as e:
                logger.error("Failed to parse Ollama JSON response", error=str(e))
                raise

        raise Exception("Max retries exceeded for Ollama API call")

    def _parse_json_response(self, response_text: str) -> Dict[str, Any]:
        """Parse JSON from Ollama response, handling markdown code blocks"""
        # Remove markdown code blocks if present
        text = response_text.strip()

        if text.startswith("```json"):
            text = text[7:]  # Remove ```json
        elif text.startswith("```"):
            text = text[3:]  # Remove ```

        if text.endswith("```"):
            text = text[:-3]  # Remove trailing ```

        text = text.strip()

        try:
            return json.loads(text)
        except json.JSONDecodeError:
            # Try to find JSON in the response
            import re
            json_match = re.search(r'\{.*\}', text, re.DOTALL)
            if json_match:
                return json.loads(json_match.group(0))
            raise

    def _get_prompt_template(self, extraction_type: str) -> str:
        """Get prompt template for extraction type"""
        templates = {
            "tracklist": self.templates.TRACKLIST_EXTRACTION,
            "artist": self.templates.ARTIST_INFO_EXTRACTION,
            "event": self.templates.EVENT_INFO_EXTRACTION,
            "metadata": self.templates.MUSIC_METADATA_EXTRACTION,
            "tracklist_urls": self.templates.TRACKLIST_URL_EXTRACTION,
            "mix_urls": self.templates.TRACKLIST_URL_EXTRACTION,
            "setlist_urls": self.templates.TRACKLIST_URL_EXTRACTION,
        }

        return templates.get(extraction_type, self.templates.TRACKLIST_EXTRACTION)

    def _format_prompt(
        self,
        template: str,
        raw_text: str,
        context: Optional[Dict[str, Any]]
    ) -> str:
        """Format prompt template with raw text and context"""
        # Truncate raw_text if too long (keep first 8000 chars)
        if len(raw_text) > 8000:
            raw_text = raw_text[:8000] + "\n\n[Content truncated...]"

        prompt = template.format(raw_text=raw_text)

        # Add context if provided
        if context:
            context_str = "\n\nADDITIONAL CONTEXT:\n"
            for key, value in context.items():
                context_str += f"{key}: {value}\n"
            prompt += context_str

        return prompt

    def _calculate_confidence(
        self,
        extracted_data: Dict[str, Any],
        extraction_type: str
    ) -> float:
        """
        Calculate confidence score based on completeness of extracted data

        Returns:
            Float between 0.0 and 1.0
        """
        if not extracted_data:
            return 0.0

        # Count non-empty fields
        total_fields = 0
        filled_fields = 0

        def count_fields(obj):
            nonlocal total_fields, filled_fields
            if isinstance(obj, dict):
                for value in obj.values():
                    total_fields += 1
                    if value and value != "" and value != []:
                        filled_fields += 1
                    count_fields(value)
            elif isinstance(obj, list):
                for item in obj:
                    count_fields(item)

        count_fields(extracted_data)

        if total_fields == 0:
            return 0.5  # Some data extracted, but structure unclear

        confidence = filled_fields / total_fields
        return round(confidence, 2)

    async def batch_extract(
        self,
        items: List[Dict[str, Any]],
        extraction_type: str,
        model: Optional[str] = None,
        concurrency: int = 3
    ) -> List[ExtractionResult]:
        """
        Process multiple extraction tasks concurrently

        Args:
            items: List of dicts with 'raw_text' and optional 'context'
            extraction_type: Type of extraction
            model: Ollama model to use
            concurrency: Max concurrent extractions

        Returns:
            List of ExtractionResult objects
        """
        semaphore = asyncio.Semaphore(concurrency)

        async def extract_one(item: Dict[str, Any]) -> ExtractionResult:
            async with semaphore:
                return await self.extract_with_ollama(
                    raw_text=item["raw_text"],
                    extraction_type=extraction_type,
                    model=model,
                    context=item.get("context")
                )

        results = await asyncio.gather(*[extract_one(item) for item in items])
        return results

    async def close(self):
        """Close HTTP client"""
        await self.client.aclose()

    async def health_check(self) -> Dict[str, Any]:
        """Check Ollama service health"""
        try:
            response = await self.client.get("/api/tags", timeout=5.0)
            response.raise_for_status()

            models = response.json().get("models", [])

            return {
                "status": "healthy",
                "available_models": [m.get("name") for m in models],
                "base_url": self.config.base_url
            }
        except Exception as e:
            return {
                "status": "unhealthy",
                "error": str(e),
                "base_url": self.config.base_url
            }
