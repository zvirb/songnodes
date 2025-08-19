"""
Unit tests for 1001tracklists spider.
"""

import pytest
from scrapy.http import HtmlResponse, Request
from scrapy.utils.test import get_crawler
from musicdb_scrapy.project_musicdb.spiders.spider_1001tracklists import OneThousandOneTracklistsSpider
from musicdb_scrapy.project_musicdb.items import SetlistItem, TrackItem, TrackArtistItem, SetlistTrackItem


class Test1001TracklistsSpider:
    """Test cases for 1001tracklists spider."""
    
    @pytest.fixture
    def spider(self, mock_scrapy_settings):
        """Create spider instance for testing."""
        crawler = get_crawler(OneThousandOneTracklistsSpider, mock_scrapy_settings)
        return OneThousandOneTracklistsSpider.from_crawler(crawler)
    
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
                <span class="trackValue">Artist 2 feat. Artist 3 - Track 2 (Remix)</span>
                <span class="tracklist-time">03:15</span>
            </div>
            <div class="tlpItem">
                <span class="trackValue">Artist 4 vs Artist 5 - Mashup Track</span>
                <span class="tracklist-time">06:30</span>
            </div>
        </body>
        </html>
        """
    
    @pytest.fixture
    def mock_response(self, sample_tracklist_html):
        """Create mock response for testing."""
        request = Request(url='https://example.com/tracklist')
        return HtmlResponse(
            url='https://example.com/tracklist',
            body=sample_tracklist_html,
            encoding='utf-8',
            request=request
        )
    
    def test_spider_initialization(self, spider):
        """Test spider initialization."""
        assert spider.name == '1001tracklists'
        assert '1001tracklists.com' in spider.allowed_domains
        assert len(spider.start_urls) > 0
    
    def test_parse_setlist_metadata(self, spider, mock_response):
        """Test parsing of setlist metadata."""
        results = list(spider.parse(mock_response))
        
        # Find SetlistItem
        setlist_items = [item for item in results if isinstance(item, SetlistItem)]
        assert len(setlist_items) == 1
        
        setlist = setlist_items[0]
        assert setlist['setlist_name'] == 'Claptone & Purple Disco Machine - The Masquerade'
        assert setlist['dj_artist_name'] == 'Claptone, Purple Disco Machine'
        assert setlist['event_name'] == 'The Masquerade'
        assert setlist['venue_name'] == 'Pacha Ibiza'
        assert setlist['set_date'] == '2023-08-12'
    
    def test_parse_tracks(self, spider, mock_response):
        """Test parsing of track items."""
        results = list(spider.parse(mock_response))
        
        # Find TrackItems
        track_items = [item for item in results if isinstance(item, TrackItem)]
        assert len(track_items) == 3
        
        # Test first track
        track1 = track_items[0]
        assert track1['track_name'] == 'Track 1'
        assert track1['start_time'] == '00:00'
        assert track1['is_remix'] is False
        assert track1['is_mashup'] is False
        
        # Test remix track
        track2 = track_items[1]
        assert track2['track_name'] == 'Track 2'
        assert track2['start_time'] == '03:15'
        assert track2['is_remix'] is True
        
        # Test mashup track
        track3 = track_items[2]
        assert track3['track_name'] == 'Mashup Track'
        assert track3['start_time'] == '06:30'
        assert track3['is_mashup'] is True
    
    def test_parse_track_artists(self, spider, mock_response):
        """Test parsing of track artist relationships."""
        results = list(spider.parse(mock_response))
        
        # Find TrackArtistItems
        artist_items = [item for item in results if isinstance(item, TrackArtistItem)]
        
        # Should have primary, featured, and remixer artists
        primary_artists = [item for item in artist_items if item['artist_role'] == 'primary']
        featured_artists = [item for item in artist_items if item['artist_role'] == 'featured']
        
        assert len(primary_artists) > 0
        assert len(featured_artists) > 0
    
    def test_parse_setlist_tracks(self, spider, mock_response):
        """Test parsing of setlist-track relationships."""
        results = list(spider.parse(mock_response))
        
        # Find SetlistTrackItems
        setlist_track_items = [item for item in results if isinstance(item, SetlistTrackItem)]
        assert len(setlist_track_items) == 3
        
        # Check track order
        orders = [item['track_order'] for item in setlist_track_items]
        assert orders == [1, 2, 3]
    
    def test_parse_empty_response(self, spider):
        """Test parsing of empty response."""
        empty_html = "<html><body></body></html>"
        request = Request(url='https://example.com/empty')
        response = HtmlResponse(
            url='https://example.com/empty',
            body=empty_html,
            encoding='utf-8',
            request=request
        )
        
        results = list(spider.parse(response))
        
        # Should still yield a SetlistItem with None values
        setlist_items = [item for item in results if isinstance(item, SetlistItem)]
        assert len(setlist_items) == 1
        
        setlist = setlist_items[0]
        assert setlist['setlist_name'] is None
        assert setlist['dj_artist_name'] is None
    
    def test_parse_malformed_html(self, spider):
        """Test parsing of malformed HTML."""
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
        request = Request(url='https://example.com/malformed')
        response = HtmlResponse(
            url='https://example.com/malformed',
            body=malformed_html,
            encoding='utf-8',
            request=request
        )
        
        # Should not raise exceptions
        results = list(spider.parse(response))
        
        # Should have at least setlist item
        setlist_items = [item for item in results if isinstance(item, SetlistItem)]
        assert len(setlist_items) == 1
    
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
    
    def test_spider_settings(self, spider):
        """Test spider-specific settings."""
        # Test that spider has required attributes
        assert hasattr(spider, 'name')
        assert hasattr(spider, 'allowed_domains')
        assert hasattr(spider, 'start_urls')
        assert hasattr(spider, 'parse')
    
    def test_css_selectors_fallback(self, spider):
        """Test fallback CSS selectors work correctly."""
        # Test with alternative HTML structure
        alt_html = """
        <html>
        <body>
            <h1 class="tracklist-header-title">
                <a href="/artist/test">Test Artist</a> - Alternative Title
            </h1>
            <li class="tracklist-item">
                <div class="track-name">Alternative Track</div>
            </li>
        </body>
        </html>
        """
        request = Request(url='https://example.com/alt')
        response = HtmlResponse(
            url='https://example.com/alt',
            body=alt_html,
            encoding='utf-8',
            request=request
        )
        
        results = list(spider.parse(response))
        
        # Should still parse content using fallback selectors
        setlist_items = [item for item in results if isinstance(item, SetlistItem)]
        assert len(setlist_items) == 1
        
        track_items = [item for item in results if isinstance(item, TrackItem)]
        assert len(track_items) >= 1