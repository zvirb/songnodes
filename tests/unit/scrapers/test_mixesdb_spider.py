import os
import pytest
from scrapy.http import HtmlResponse, Request
from scrapers.spiders.mixesdb_spider import MixesdbSpider
from scrapers.items import EnhancedSetlistTrackItem, PlaylistItem, EnhancedTrackItem
from scrapy import Request as ScrapyRequest
from scrapers.pipelines.persistence_pipeline import PersistencePipeline

FIXTURES_DIR = os.path.join(os.path.dirname(__file__), 'fixtures')
TEST_URL = 'https://www.mixesdb.com/w/Test_DJ_-_Awesome_Mix'

def make_response(html_content, url=TEST_URL):
    return HtmlResponse(url=url, body=html_content.encode('utf-8'))

@pytest.fixture
def spider():
    return MixesdbSpider()

class TestMixesdbSpider:
    def items_of(self, results, cls):
        return [item for item in results if isinstance(item, cls)]

    def test_extract_enhanced_tracks_multiple_lists_and_id(self, spider):
        """Test that multiple lists are concatenated and 'ID - ID' is kept in position."""
        fixture_path = os.path.join(FIXTURES_DIR, 'mixesdb_two_lists.html')
        with open(fixture_path, 'r', encoding='utf-8') as f:
            html = f.read()

        response = make_response(html)
        results = list(spider.parse_mix_page(response))

        # Check the yielded tracks
        tracks = self.items_of(results, EnhancedSetlistTrackItem)
        assert len(tracks) == 5

        # Verify track positions are 1..5 continuously
        positions = [track['track_order'] for track in tracks]
        assert positions == [1, 2, 3, 4, 5]

        # Verify track titles and handling of ID
        titles = [track['track_name'] for track in tracks]
        assert titles == ['Track Alpha', 'Track Beta', 'ID - ID', 'Track Gamma', 'Track Delta']

        # Verify source URL propagation
        for track in tracks:
            assert track['source_url'] == TEST_URL

    @pytest.mark.asyncio
    async def test_pipeline_position_synthetic_id(self):
        """Test that the persistence pipeline adds #<position> to the synthetic source track id."""
        pipeline = PersistencePipeline(database_config={})

        # We need to test the logic of _process_playlist_track_item
        # Because we only modified the string construction, we can unit-test just the logic
        item = {
            'setlist_name': 'Test DJ - Awesome Mix',
            'track_name': 'Track Beta',
            'artist_name': 'Artist Two',
            'track_order': 2,
            'source_url': TEST_URL
        }

        # Mocking required bits for the pipeline
        pipeline._playlist_id_map['Test DJ - Awesome Mix'] = 123

        # Catch what gets queued to process_track_item
        processed_tracks = []
        async def mock_process_track(track_item):
            processed_tracks.append(track_item)

        pipeline._process_track_item = mock_process_track

        await pipeline._process_playlist_track_item(item)

        assert len(processed_tracks) == 1
        assert processed_tracks[0]['source_track_id'] == 'Artist Two::Track Beta#2'


SEARCH_URL = 'https://www.mixesdb.com/w/index.php?search=Test+DJ'

SEARCH_HTML = """<html><body>
<ul class="mw-search-results">
  <li><a href="https://discord.gg/abc123">Join our Discord</a></li>
  <li><a href="https://www.mixcloud.com/someone/a-mix/">Mixcloud</a></li>
  <li><a href="/w/Category:Test_DJ">Category: Test DJ</a></li>
  <li><a href="/w/MixesDB:About">About MixesDB</a></li>
  <li><a href="/w/User_talk:Someone">User talk</a></li>
  <li><a href="/w/Test_DJ_-_Awesome_Mix">Test DJ - Awesome Mix</a></li>
</ul>
</body></html>"""

EMPTY_MIX_HTML = """<html><body>
<h1 id="firstHeading"><span class="mw-page-title-main">Test DJ - Empty Mix</span></h1>
<div class="mw-parser-output">
  <h2><span class="mw-headline" id="Tracklist">Tracklist</span></h2>
  <p>Tracklist not yet known.</p>
</div>
</body></html>"""


class TestMixesdbMixPagesOnly:
    def test_outside_and_namespace_links_are_not_followed(self, spider):
        response = make_response(SEARCH_HTML, url=SEARCH_URL)
        requests = [r for r in spider.parse_search_results(response) if isinstance(r, ScrapyRequest)]
        assert [r.url for r in requests] == ['https://www.mixesdb.com/w/Test_DJ_-_Awesome_Mix']

    @pytest.mark.parametrize('url', [
        'https://discord.gg/abc123',
        'https://www.mixcloud.com/w/Test_DJ_-_Awesome_Mix',
        'https://mixesdb.com.evil.example/w/Test_DJ_-_Awesome_Mix',
        'mailto:someone@mixesdb.com',
        'https://www.mixesdb.com/w/Special:RecentChanges',
        'https://www.mixesdb.com/w/Category:Test_DJ',
        'https://www.mixesdb.com/w/MixesDB:About',
        'https://www.mixesdb.com/w/Category_talk:Test_DJ',
        'https://www.mixesdb.com/w/Main_Page',
        'https://www.mixesdb.com/w/index.php?title=Test&action=edit',
        'https://www.mixesdb.com/about',
    ])
    def test_is_mix_url_rejects_non_mix_pages(self, spider, url):
        assert spider.is_mix_url(url) is False

    def test_is_mix_url_accepts_on_site_mix_page(self, spider):
        assert spider.is_mix_url('https://www.mixesdb.com/w/2015-03-28_-_Martin_Garrix_@_Ultra') is True
        assert spider.is_mix_url(TEST_URL) is True

    def test_parse_does_not_treat_outside_page_as_mix(self, spider):
        with open(os.path.join(FIXTURES_DIR, 'mixesdb_two_lists.html'), encoding='utf-8') as f:
            html = f.read()
        response = make_response(html, url='https://discord.gg/w/Test_DJ_-_Awesome_Mix')
        assert list(spider.parse(response)) == []
        assert list(spider.parse_mix_page(response)) == []

    def test_zero_track_page_yields_nothing(self, spider):
        response = make_response(EMPTY_MIX_HTML, url='https://www.mixesdb.com/w/Test_DJ_-_Empty_Mix')
        assert list(spider.parse(response)) == []
        assert list(spider.parse_mix_page(response)) == []

    def test_real_mix_page_yields_playlist_then_tracks_in_order(self, spider):
        with open(os.path.join(FIXTURES_DIR, 'mixesdb_two_lists.html'), encoding='utf-8') as f:
            html = f.read()
        results = list(spider.parse(make_response(html)))

        playlists = [r for r in results if isinstance(r, PlaylistItem)]
        assert len(playlists) == 1
        assert playlists[0]['tracklist_count'] == 5
        assert playlists[0]['source_url'] == TEST_URL

        setlist_tracks = [r for r in results if isinstance(r, EnhancedSetlistTrackItem)]
        assert [t['track_order'] for t in setlist_tracks] == [1, 2, 3, 4, 5]
        assert [t['track_name'] for t in setlist_tracks] == [
            'Track Alpha', 'Track Beta', 'ID - ID', 'Track Gamma', 'Track Delta'
        ]
        # The playlist is yielded before any of its tracks.
        assert results.index(playlists[0]) < results.index(setlist_tracks[0])
