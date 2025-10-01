"""
Example usage of Browser Collector Service
"""
import asyncio
import httpx
import json


COLLECTOR_URL = "http://localhost:8030"


async def example_simple_collection():
    """
    Example 1: Simple URL collection with automatic extraction
    """
    print("\n=== Example 1: Simple Collection ===\n")

    async with httpx.AsyncClient(timeout=300.0) as client:
        response = await client.post(
            f"{COLLECTOR_URL}/collect",
            json={
                "session_name": "example_simple",
                "collector_type": "tracklist_finder",
                "target_url": "https://www.1001tracklists.com/tracklist/1m9x4hk1/carl-cox-at-drumcode-festival-malta-ta-qali-national-park-malta-2023-09-02.html",
                "extraction_type": "tracklist",
                "ollama_model": "llama3.2:3b",
                "auto_extract": True,
                "collect_screenshots": True
            }
        )

        result = response.json()
        print(f"Status: {result['status']}")
        print(f"Session ID: {result['session_id']}")

        if result.get('extraction_result'):
            extraction = result['extraction_result']
            print(f"\nExtraction Success: {extraction['success']}")
            print(f"Confidence: {extraction['confidence_score']}")
            print(f"Tokens: {extraction['tokens_processed']}")
            print(f"\nExtracted Data:")
            print(json.dumps(extraction['extracted_data'], indent=2))


async def example_search_and_navigate():
    """
    Example 2: Search on 1001tracklists and navigate to first result
    """
    print("\n=== Example 2: Search and Navigate ===\n")

    async with httpx.AsyncClient(timeout=300.0) as client:
        response = await client.post(
            f"{COLLECTOR_URL}/collect",
            json={
                "session_name": "search_navigation",
                "collector_type": "tracklist_finder",
                "target_url": "https://www.1001tracklists.com",
                "navigation_steps": [
                    # Click search box
                    {
                        "type": "click",
                        "selector": "input[name='q']"
                    },
                    # Type search query
                    {
                        "type": "type",
                        "selector": "input[name='q']",
                        "text": "Adam Beyer Drumcode",
                        "clear": False
                    },
                    # Wait a bit
                    {
                        "type": "wait",
                        "duration_ms": 1000
                    },
                    # Click search button
                    {
                        "type": "click",
                        "selector": "button[type='submit']"
                    },
                    # Wait for results
                    {
                        "type": "wait_for_selector",
                        "selector": ".tlLink",
                        "timeout_ms": 10000
                    },
                    # Take screenshot of results
                    {
                        "type": "wait",
                        "duration_ms": 500,
                        "screenshot": True
                    },
                    # Click first tracklist
                    {
                        "type": "click",
                        "selector": ".tlLink:first-of-type",
                        "screenshot": True
                    },
                    # Wait for tracklist page to load
                    {
                        "type": "wait",
                        "duration_ms": 2000
                    }
                ],
                "extraction_type": "tracklist",
                "auto_extract": True,
                "browser_config": {
                    "headless": False,  # Visible browser for demo
                    "viewport_width": 1920,
                    "viewport_height": 1080
                },
                "collect_screenshots": True
            }
        )

        result = response.json()
        print(f"Status: {result['status']}")
        print(f"Message: {result['message']}")

        if result.get('collection_result'):
            collection = result['collection_result']
            print(f"\nPage Title: {collection['page_title']}")
            print(f"Collection Duration: {collection['collection_duration_ms']}ms")
            print(f"Interactions: {len(collection['interactions'])}")
            print(f"Screenshots: {len(collection['screenshots'])}")


async def example_soundcloud_artist():
    """
    Example 3: Collect artist info from SoundCloud
    """
    print("\n=== Example 3: SoundCloud Artist Discovery ===\n")

    async with httpx.AsyncClient(timeout=300.0) as client:
        response = await client.post(
            f"{COLLECTOR_URL}/collect",
            json={
                "session_name": "soundcloud_artist",
                "collector_type": "artist_info",
                "target_url": "https://soundcloud.com/carlcox",
                "navigation_steps": [
                    # Wait for page to load
                    {
                        "type": "wait_for_selector",
                        "selector": ".profileHeaderInfo",
                        "timeout_ms": 10000
                    },
                    # Scroll to see more content
                    {
                        "type": "scroll",
                        "direction": "down",
                        "amount": 1000
                    },
                    {
                        "type": "wait",
                        "duration_ms": 1500
                    }
                ],
                "extraction_type": "artist",
                "ollama_model": "llama3.2:3b",
                "auto_extract": True,
                "collect_screenshots": True
            }
        )

        result = response.json()
        print(f"Status: {result['status']}")

        if result.get('extraction_result', {}).get('extracted_data'):
            artist_data = result['extraction_result']['extracted_data']
            print(f"\nArtist Name: {artist_data.get('artist_name')}")
            print(f"Genres: {', '.join(artist_data.get('genres', []))}")
            print(f"Biography: {artist_data.get('biography', '')[:200]}...")
            print(f"\nLinks:")
            for platform, url in artist_data.get('links', {}).items():
                print(f"  {platform}: {url}")


async def example_reextract():
    """
    Example 4: Re-extract from existing raw data with different prompt
    """
    print("\n=== Example 4: Re-extraction with Custom Prompt ===\n")

    # First, get a raw_data_id from a previous collection
    # For this example, we'll assume you have one

    raw_data_id = "REPLACE_WITH_ACTUAL_ID"

    async with httpx.AsyncClient(timeout=300.0) as client:
        response = await client.post(
            f"{COLLECTOR_URL}/extract/{raw_data_id}",
            json={
                "extraction_type": "custom",
                "ollama_model": "llama3.2:3b",
                "custom_prompt": """
You are a music event specialist. Extract ALL event information from this text.

REQUIRED INFORMATION:
- Event name
- Date and time
- Venue name and location
- ALL performers/DJs (complete lineup)
- Genres
- Ticket information if available

Return ONLY valid JSON. No markdown, no explanations.

JSON FORMAT:
{
  "event_name": "...",
  "date": "YYYY-MM-DD",
  "time": "HH:MM",
  "venue": "...",
  "location": "City, Country",
  "lineup": ["DJ1", "DJ2", ...],
  "genres": ["Genre1", ...],
  "ticket_url": "..."
}
"""
            }
        )

        result = response.json()
        print(f"Extraction Success: {result['success']}")
        print(f"\nExtracted Data:")
        print(json.dumps(result['extracted_data'], indent=2))


async def example_batch_collection():
    """
    Example 5: Batch collect multiple URLs
    """
    print("\n=== Example 5: Batch Collection ===\n")

    urls = [
        "https://www.1001tracklists.com/tracklist/1m9x4hk1/carl-cox-at-drumcode-festival-malta-ta-qali-national-park-malta-2023-09-02.html",
        "https://www.1001tracklists.com/tracklist/2k5x3j91/amelie-lens-at-awakenings-festival-2023.html",
        "https://www.1001tracklists.com/tracklist/3n8y2m71/adam-beyer-drumcode-radio-582.html",
    ]

    async with httpx.AsyncClient(timeout=300.0) as client:
        tasks = []

        for url in urls:
            task = client.post(
                f"{COLLECTOR_URL}/collect",
                json={
                    "session_name": f"batch_{url.split('/')[-1][:20]}",
                    "collector_type": "tracklist_finder",
                    "target_url": url,
                    "extraction_type": "tracklist",
                    "auto_extract": True,
                    "browser_config": {
                        "headless": True  # Headless for batch processing
                    },
                    "collect_screenshots": False  # Skip screenshots for speed
                }
            )
            tasks.append(task)

        # Collect all concurrently (note: this will spawn multiple browsers)
        responses = await asyncio.gather(*tasks, return_exceptions=True)

        for i, response in enumerate(responses):
            if isinstance(response, Exception):
                print(f"URL {i+1} failed: {response}")
            else:
                result = response.json()
                print(f"URL {i+1}: {result['status']} - {result.get('message', '')}")


async def example_check_health():
    """
    Example 6: Check service health
    """
    print("\n=== Example 6: Health Check ===\n")

    async with httpx.AsyncClient() as client:
        response = await client.get(f"{COLLECTOR_URL}/health")
        health = response.json()

        print(f"Service Status: {health['status']}")
        print(f"Service Name: {health['service']}")
        print(f"\nOllama Status: {health['ollama']['status']}")

        if health['ollama']['status'] == 'healthy':
            print(f"Available Models:")
            for model in health['ollama']['available_models']:
                print(f"  - {model}")


async def main():
    """Run all examples"""
    print("="*60)
    print("Browser Collector Service - Usage Examples")
    print("="*60)

    try:
        # Check health first
        await example_check_health()

        # Run examples
        # await example_simple_collection()
        # await example_search_and_navigate()
        # await example_soundcloud_artist()
        # await example_batch_collection()

        # Uncomment to test re-extraction (requires valid raw_data_id)
        # await example_reextract()

    except httpx.ConnectError:
        print("\n❌ Error: Could not connect to browser-collector service")
        print("Make sure the service is running: docker compose up -d browser-collector")
    except Exception as e:
        print(f"\n❌ Error: {e}")


if __name__ == "__main__":
    asyncio.run(main())
