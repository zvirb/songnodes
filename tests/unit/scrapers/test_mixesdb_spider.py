import os
import pytest
from scrapy.http import HtmlResponse, Request
from scrapers.spiders.mixesdb_spider import MixesdbSpider
from scrapers.items import EnhancedSetlistTrackItem, PlaylistItem, EnhancedTrackItem
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
