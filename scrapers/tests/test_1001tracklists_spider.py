"""
Unit tests for OneThousandOneTracklistsSpider async startup (Scrapy 2.12+).
"""
import importlib
import inspect
import sys
from unittest.mock import MagicMock, patch
import pytest

# Ensure scrapy_playwright.page is mockable on environments without playwright installed
if "scrapy_playwright" not in sys.modules:
    playwright_mock = MagicMock()
    page_mock = MagicMock()
    page_mock.PageMethod = MagicMock(side_effect=lambda method, *args, **kwargs: (method, args, kwargs))
    sys.modules["scrapy_playwright"] = playwright_mock
    sys.modules["scrapy_playwright.page"] = page_mock

tl_mod = importlib.import_module("scrapers.spiders.1001tracklists_spider")
OneThousandOneTracklistsSpider = tl_mod.OneThousandOneTracklistsSpider


@pytest.fixture
def mock_spider_init():
    with patch.object(OneThousandOneTracklistsSpider, "_load_credentials_from_db"), \
         patch.object(OneThousandOneTracklistsSpider, "load_target_tracks"), \
         patch.object(OneThousandOneTracklistsSpider, "initialize_state_store"), \
         patch.object(OneThousandOneTracklistsSpider, "apply_robots_policy"):
        yield


@pytest.mark.unit
def test_1001tracklists_start_is_async_generator(mock_spider_init):
    """Verify start() complies with Scrapy 2.12+ async generator contract."""
    spider = OneThousandOneTracklistsSpider(start_urls=["https://www.1001tracklists.com/tracklist/123/test.html"])
    gen = spider.start()

    # Contract check: must have __aiter__ and be an async generator
    assert hasattr(gen, "__aiter__"), "Spider.start() must have __aiter__"
    assert inspect.isasyncgen(gen), "Spider.start() must be an async generator"


@pytest.mark.asyncio
async def test_1001tracklists_start_yields_requests(mock_spider_init):
    """Verify start() iterates and yields Requests with expected configuration."""
    test_url = "https://www.1001tracklists.com/tracklist/abc123/test.html"
    spider = OneThousandOneTracklistsSpider(start_urls=[test_url])

    requests = [r async for r in spider.start()]
    assert len(requests) == 1
    assert requests[0].url == test_url
    assert requests[0].callback == spider.parse_tracklist
    assert requests[0].meta.get("playwright") is True


@pytest.mark.unit
def test_1001tracklists_start_requests_sync_fallback(mock_spider_init):
    """Verify start_requests() works synchronously for backwards compatibility."""
    test_url = "https://www.1001tracklists.com/tracklist/xyz789/test.html"
    spider = OneThousandOneTracklistsSpider(start_urls=[test_url])

    reqs = list(spider.start_requests())
    assert len(reqs) == 1
    assert reqs[0].url == test_url
