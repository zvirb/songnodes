"""
Unit tests for 1001tracklists spider.

No network: Postgres credentials, the Redis state store, robots.txt and the LLM
extractor are stubbed, and the NLP processor is replaced per test.
"""

import sys
import types
from importlib import import_module

import pytest
from scrapy.http import HtmlResponse, Request
from scrapy.utils.test import get_crawler

from items import (
    EnhancedArtistItem,
    EnhancedSetlistItem,
    EnhancedSetlistTrackItem,
    EnhancedTrackAdjacencyItem,
    EnhancedTrackArtistItem,
    EnhancedTrackItem,
    PlaylistItem,
)

# The module name starts with a digit, so it cannot be imported with an import statement.
OneThousandOneTracklistsSpider = import_module("spiders.1001tracklists_spider").OneThousandOneTracklistsSpider

TRACKLIST_URL = 'https://www.1001tracklists.com/tracklist/test.html'


def make_response(html, url=TRACKLIST_URL):
    return HtmlResponse(url=url, body=html, encoding='utf-8', request=Request(url=url))


class FakeLLMExtractor:
    """Stands in for llm_scraper_engine.ScrapyLLMExtractor (which calls Ollama)."""
    tracks = []

    def __init__(self, spider_name):
        pass

    def extract_tracks(self, response):
        return self.tracks

    def extract_tracklists(self, response):
        return []


class Test1001TracklistsSpider:
    """Test cases for 1001tracklists spider."""

    @pytest.fixture(autouse=True)
    def offline(self, monkeypatch):
        """Keep spider construction and extraction off the network."""
        monkeypatch.setattr(OneThousandOneTracklistsSpider, '_load_credentials_from_db', lambda self: None)
        monkeypatch.setattr(OneThousandOneTracklistsSpider, 'initialize_state_store', lambda self: None)
        monkeypatch.setattr(OneThousandOneTracklistsSpider, 'apply_robots_policy', lambda self: None)
        fake_engine = types.ModuleType('llm_scraper_engine')
        fake_engine.ScrapyLLMExtractor = FakeLLMExtractor
        monkeypatch.setitem(sys.modules, 'llm_scraper_engine', fake_engine)
        monkeypatch.setattr(FakeLLMExtractor, 'tracks', [])

    @pytest.fixture
    def spider(self, mock_scrapy_settings):
        """Create spider instance for testing, with the NLP fallback off."""
        crawler = get_crawler(OneThousandOneTracklistsSpider, mock_scrapy_settings)
        spider = OneThousandOneTracklistsSpider.from_crawler(crawler, search_query='Deadmau5 Strobe')
        spider.enable_nlp_fallback = False
        return spider

    @pytest.fixture
    def sample_tracklist_html(self):
        """Sample HTML content for tracklist page."""
        return """
        <!DOCTYPE html>
        <html>
        <head><title>Test Tracklist</title></head>
        <body>
            <h1 class="spotlightTitle">Claptone & Purple Disco Machine - The Masquerade</h1>
            <div class="spotlight-artists">
                <a href="/artist/claptone">Claptone</a>
                <a href="/artist/purple-disco-machine">Purple Disco Machine</a>
            </div>
            <div class="spotlight-event">
                <a href="/event/the-masquerade">The Masquerade</a>
            </div>
            <div class="spotlight-venue">
                <a href="/venue/pacha-ibiza">Pacha Ibiza</a>
            </div>
            <div class="spotlight-date">2023-08-12</div>

            <div class="tlpItem">
                <span class="trackValue">Artist 1 - Track 1</span>
                <span class="tracklist-time">00:00</span>
            </div>
            <div class="tlpItem">
                <span class="trackValue">Artist 2 feat. Artist 3 - Track 2 (Artist 6 Remix)</span>
                <span class="tracklist-time">03:15</span>
            </div>
            <div class="tlpItem">
                <span class="trackValue">Artist 4 - Track A vs. Track B</span>
                <span class="tracklist-time">06:30</span>
            </div>
        </body>
        </html>
        """

    @pytest.fixture
    def mock_response(self, sample_tracklist_html):
        """Create mock response for testing."""
        return make_response(sample_tracklist_html)

    def items_of(self, results, cls):
        return [item for item in results if isinstance(item, cls)]

    def test_spider_initialization(self, spider):
        """Test spider initialization."""
        assert spider.name == '1001tracklists'
        assert '1001tracklists.com' in spider.allowed_domains
        assert len(spider.start_urls) > 0

    def test_parse_setlist_metadata(self, spider, mock_response):
        """Test parsing of setlist metadata."""
        results = list(spider.parse_tracklist(mock_response))

        setlist_items = self.items_of(results, EnhancedSetlistItem)
        assert len(setlist_items) == 1

        setlist = setlist_items[0]
        assert setlist['setlist_name'] == 'Claptone & Purple Disco Machine - The Masquerade'
        assert setlist['dj_artist_name'] == 'Claptone'
        assert setlist['supporting_artists'] == ['Purple Disco Machine']
        assert setlist['event_name'] == 'The Masquerade'
        assert setlist['venue_name'] == 'Pacha Ibiza'
        assert setlist['set_date'] == '2023-08-12'
        assert setlist['total_tracks'] == 3

        playlists = self.items_of(results, PlaylistItem)
        assert len(playlists) == 1
        assert len(playlists[0]['tracks']) == 3
        assert playlists[0]['tracks'][:2] == ['Track 1', 'Track 2']

        artists = [item['artist_name'] for item in self.items_of(results, EnhancedArtistItem)]
        assert artists == ['Claptone', 'Purple Disco Machine']

    def test_parse_tracks(self, spider, mock_response):
        """Test parsing of track items."""
        results = list(spider.parse_tracklist(mock_response))

        track_items = self.items_of(results, EnhancedTrackItem)
        assert len(track_items) == 3

        track1 = track_items[0]
        assert track1['track_name'] == 'Track 1'
        assert track1['start_time'] == 0
        assert track1['is_remix'] is False
        assert track1['is_mashup'] is False

        track2 = track_items[1]
        assert track2['track_name'] == 'Track 2'
        assert track2['start_time'] == 195
        assert track2['is_remix'] is True

        track3 = track_items[2]
        # parse_track_string keeps the artist in a mashup's title ("Artist 4 - Track A vs. Track B")
        assert track3['track_name'].endswith('Track A vs. Track B')
        assert track3['start_time'] == 390
        assert track3['is_mashup'] is True

    def test_parse_track_artists(self, spider, mock_response):
        """Test parsing of track artist relationships."""
        results = list(spider.parse_tracklist(mock_response))

        roles = {(item['track_name'], item['artist_name'], item['artist_role'])
                 for item in self.items_of(results, EnhancedTrackArtistItem)}

        assert ('Track 1', 'Artist 1', 'primary') in roles
        assert ('Track 2', 'Artist 2', 'primary') in roles
        assert ('Track 2', 'Artist 3', 'featured') in roles

    def test_parse_setlist_tracks(self, spider, mock_response):
        """Test parsing of setlist-track relationships and adjacencies."""
        results = list(spider.parse_tracklist(mock_response))

        setlist_track_items = self.items_of(results, EnhancedSetlistTrackItem)
        assert [item['track_order'] for item in setlist_track_items] == [1, 2, 3]

        adjacencies = {(a['track_1_position'], a['track_2_position'], a['transition_type'])
                       for a in self.items_of(results, EnhancedTrackAdjacencyItem)}
        assert adjacencies == {(1, 2, 'sequential'), (2, 3, 'sequential'), (1, 3, 'close_proximity')}

    def test_parse_empty_response(self, spider):
        """An empty page yields an empty setlist and no tracks or playlist."""
        results = list(spider.parse_tracklist(make_response("<html><body></body></html>")))

        setlist_items = self.items_of(results, EnhancedSetlistItem)
        assert len(setlist_items) == 1
        assert setlist_items[0].get('setlist_name') is None
        assert setlist_items[0].get('dj_artist_name') is None
        assert self.items_of(results, EnhancedTrackItem) == []

    def test_parse_malformed_html(self, spider):
        """Malformed HTML does not raise and still yields the setlist."""
        malformed_html = """
        <html>
        <body>
            <h1 class="spotlightTitle">Test Title</h1>
            <div class="tlpItem">
                <span class="trackValue">Invalid Track Format</span>
            </div>
        </body>
        </html>
        """
        results = list(spider.parse_tracklist(make_response(malformed_html)))

        setlist_items = self.items_of(results, EnhancedSetlistItem)
        assert len(setlist_items) == 1
        assert setlist_items[0]['setlist_name'] == 'Test Title'

    @pytest.mark.parametrize("url", [
        "https://www.1001tracklists.com/tracklist/test1.html",
        "https://1001tracklists.com/tracklist/test2.html"
    ])
    def test_allowed_domains(self, spider, url):
        """Test that spider only processes allowed domains."""
        from urllib.parse import urlparse
        domain = urlparse(url).netloc

        if domain.endswith('1001tracklists.com'):
            assert any(allowed in domain for allowed in spider.allowed_domains)
        else:
            assert not any(allowed in domain for allowed in spider.allowed_domains)

    def test_start_urls_validity(self, spider):
        """Test that all start URLs are valid."""
        for url in spider.start_urls:
            assert url.startswith('https://')
            assert '1001tracklists.com' in url

    def test_start_requests_search(self):
        """A search query generates a Playwright request with form submission coroutines."""
        import importlib
        spider_module = importlib.import_module('scrapers.spiders.1001tracklists_spider')
        OneThousandOneTracklistsSpider = spider_module.OneThousandOneTracklistsSpider
        spider = OneThousandOneTracklistsSpider(search_query='Deadmau5 Strobe')
        # Check that we haven't overridden start in an incompatible way
        import inspect
        assert not hasattr(OneThousandOneTracklistsSpider, 'start') or inspect.isasyncgenfunction(OneThousandOneTracklistsSpider.start)

        requests = list(spider.start_requests())
        assert len(requests) == 1
        req = requests[0]
        assert req.url == 'https://www.1001tracklists.com/'
        assert req.callback == spider.parse_search_results
        assert req.meta.get('playwright') is True
        assert req.meta.get('search_query') == 'Deadmau5 Strobe'
        assert len(req.meta.get('playwright_page_coroutines', [])) == 1
        assert inspect.iscoroutinefunction(req.meta['playwright_page_coroutines'][0])

    def test_start_requests_tracklist(self):
        """A tracklist URL generates a Playwright request for the page."""
        import importlib
        spider_module = importlib.import_module('scrapers.spiders.1001tracklists_spider')
        OneThousandOneTracklistsSpider = spider_module.OneThousandOneTracklistsSpider
        spider = OneThousandOneTracklistsSpider(start_urls='https://www.1001tracklists.com/tracklist/123/test.html')
        requests = list(spider.start_requests())
        assert len(requests) == 1
        req = requests[0]
        assert req.url == 'https://www.1001tracklists.com/tracklist/123/test.html'
        assert req.callback == spider.parse_tracklist
        assert req.meta.get('playwright') is True

    def test_spider_settings(self, spider):
        """Test spider-specific settings."""
        assert hasattr(spider, 'name')
        assert hasattr(spider, 'allowed_domains')
        assert hasattr(spider, 'start_urls')
        assert hasattr(spider, 'parse_tracklist')
        assert hasattr(spider, 'parse_search_results')

    def test_css_selectors_fallback(self, spider):
        """Alternative markup is parsed with the fallback selectors."""
        alt_html = """
        <html>
        <body>
            <h1 class="tracklist-header-title">
                <a href="/artist/test">Test Artist</a> - Alternative Title
            </h1>
            <li class="tracklist-item">
                <span class="trackValue">Test Artist - Alternative Track</span>
            </li>
        </body>
        </html>
        """
        results = list(spider.parse_tracklist(make_response(alt_html)))

        setlist_items = self.items_of(results, EnhancedSetlistItem)
        assert len(setlist_items) == 1
        assert setlist_items[0]['dj_artist_name'] == 'Test Artist'

        track_items = self.items_of(results, EnhancedTrackItem)
        assert [item['track_name'] for item in track_items] == ['Alternative Track']

    def test_search_results_yield_tracklist_requests(self, spider):
        """parse_search_results passes on its requests (it used to drop them)."""
        search_html = """
        <html><body>
            <div class="bItm"><a href="/tracklist/abc123/test-set.html">Test set</a></div>
        </body></html>
        """
        response = make_response(search_html, url=spider.start_urls[0])
        requests = [r for r in spider.parse_search_results(response) if isinstance(r, Request)]

        assert [r.url for r in requests] == ['https://www.1001tracklists.com/tracklist/abc123/test-set.html']
        assert requests[0].callback == spider.parse_tracklist

    def test_nlp_fallback_when_structured_extraction_finds_nothing(self, spider, monkeypatch):
        """With no parseable tracks, the NLP processor result is used."""
        spider.enable_nlp_fallback = True
        calls = []

        def fake_nlp(html_or_text, url, extract_timestamps=True):
            calls.append(url)
            return [{'artist': 'NLP Artist', 'title': 'NLP Track'}]

        monkeypatch.setattr(spider, 'extract_via_nlp_sync', fake_nlp)
        page = "<html><body><h1 class='spotlightTitle'>Plain text set</h1><p>NLP Artist - NLP Track</p></body></html>"
        results = list(spider.parse_tracklist(make_response(page)))

        assert calls == [TRACKLIST_URL]
        assert [item['track_name'] for item in self.items_of(results, EnhancedTrackItem)] == ['NLP Artist - NLP Track']

    def test_nlp_tracks_without_artist_are_dropped(self, spider, monkeypatch):
        """No "Unknown Artist" placeholders reach the pipeline."""
        spider.enable_nlp_fallback = True
        monkeypatch.setattr(spider, 'extract_via_nlp_sync', lambda *a, **k: [
            {'title': 'Untitled ID'},
            {'artist': 'NLP Artist', 'title': 'NLP Track'},
        ])
        page = "<html><body><h1 class='spotlightTitle'>Plain text set</h1></body></html>"
        results = list(spider.parse_tracklist(make_response(page)))

        assert [item['track_name'] for item in self.items_of(results, EnhancedTrackItem)] == ['NLP Artist - NLP Track']

    def test_nlp_not_called_when_structured_extraction_succeeds(self, spider, mock_response, monkeypatch):
        """The NLP processor is a fallback only."""
        spider.enable_nlp_fallback = True
        calls = []
        monkeypatch.setattr(spider, 'extract_via_nlp_sync', lambda *a, **k: calls.append(a) or [])

        results = list(spider.parse_tracklist(mock_response))

        assert calls == []
        assert len(self.items_of(results, EnhancedTrackItem)) == 3

    def test_llm_tracks_flag_remixes_and_mashups(self, spider, mock_response, monkeypatch):
        """LLM results go through is_remix_track/is_mashup_track (they used to be missing)."""
        monkeypatch.setattr(FakeLLMExtractor, 'tracks', [
            {'name': 'Strobe (Kaskade Remix)', 'artist': 'deadmau5', 'position': 1},
            {'name': 'Opus vs. Strobe', 'artist': 'Eric Prydz', 'position': 2},
        ])
        results = list(spider.parse_tracklist(mock_response))

        tracks = {item['track_name']: item for item in self.items_of(results, EnhancedTrackItem)}
        assert tracks['Strobe (Kaskade Remix)']['is_remix'] is True
        assert tracks['Strobe (Kaskade Remix)']['is_mashup'] is False
        assert tracks['Opus vs. Strobe']['is_mashup'] is True
