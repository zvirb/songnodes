"""
VAL1: remixes scraped from MixesDB pass track validation.

In the 2 Nov local test (docs/integration/LOCAL-TEST-2026-11-02.md, PR #518) one
MixesDB scrape for "Deadmau5 Strobe" dropped 20 tracks in ValidationPipeline with
"remix_type must be specified when is_remix=True", the target track among them.
The spider set is_remix from "(Name Remix)" but always left remix_type None, and
ValidationPipeline (100) runs before EnrichmentPipeline (200), which fills it.
The track names and artists below are the ones dropped in that run.
"""
import pytest
from scrapy.http import HtmlResponse

from scrapers.items import EnhancedTrackItem
from scrapers.pipelines.validation_pipeline import ValidationPipeline
from scrapers.pydantic_models import DataSource, RemixType, TrackCreate
from scrapers.spiders.mixesdb_spider import MixesdbSpider
from scrapers.spiders.utils import parse_track_string

MIX_URL = 'https://www.mixesdb.com/w/2008-03-01_-_Test_DJ_-_Remix_Mix'

# (tracklist line, track name, artist, expected remix_type)
DROPPED_IN_LOCAL_TEST = [
    ('Deadmau5 - Strobe (Michael Cassette Remix)', 'Strobe', 'Deadmau5', 'remix'),
    ('Scared Of Heights - Don\'t Look Down (Kidnap Edit)', "Don't Look Down", 'Scared Of Heights', 'edit'),
    ('Alex Niggemann - Hurricane (Solomun Remix)', 'Hurricane', 'Alex Niggemann', 'remix'),
    ('Skober - Phoenix Rose (Dosem Rework)', 'Phoenix Rose', 'Skober', 'rework'),
    ('Sasha - Channel Deq (Joris Voorn Flip)', 'Channel Deq', 'Sasha', 'rework'),
    ('Lifelike - Discopolis 2.0 (Kris Menace Bootleg)', 'Discopolis 2.0', 'Lifelike', 'bootleg'),
    ('Pete Heller - Big Love (Kevin McKay Mashup)', 'Big Love', 'Pete Heller', 'mashup'),
    ('Armin van Buuren - Shivers (Rank 1 Remix)', 'Shivers', 'Armin van Buuren', 'remix'),
    ('Deadmau5 – The Veldt (Tommy Trash Remix)', 'The Veldt', 'Deadmau5', 'remix'),
]


@pytest.mark.parametrize('line,name,artist,remix_type', DROPPED_IN_LOCAL_TEST)
def test_parse_track_string_gives_every_remix_a_type(line, name, artist, remix_type):
    parsed = parse_track_string(line)
    assert parsed['track_name'] == name
    assert parsed['primary_artists'][0] == artist
    assert parsed['is_remix'] is True
    assert parsed['remix_type'] == remix_type


def test_original_track_has_no_remix_type():
    parsed = parse_track_string('Deadmau5 - Strobe (Original Mix)')
    assert parsed['is_remix'] is False
    assert parsed['remix_type'] is None


def test_model_records_unknown_type_instead_of_dropping_a_remix():
    """Other spiders (setlist.fm, 1001Tracklists loader) still send is_remix without a type."""
    track = TrackCreate(track_name='Strobe', is_remix=True, data_source=DataSource.MIXESDB)
    assert track.remix_type == RemixType.UNKNOWN
    with pytest.raises(ValueError):
        TrackCreate(track_name='Strobe', is_remix=False, remix_type='remix', data_source=DataSource.MIXESDB)


def test_real_spider_remixes_pass_validation_pipeline():
    rows = ''.join(f'<li>{line}</li>' for line, *_ in DROPPED_IN_LOCAL_TEST)
    html = (
        '<html><head><title>Test DJ - Remix Mix | MixesDB</title></head><body>'
        '<h1 id="firstHeading"><span class="mw-page-title-main">2008-03-01 - Test DJ - Remix Mix</span></h1>'
        '<div class="mw-parser-output"><h2><span class="mw-headline" id="Tracklist">Tracklist</span></h2>'
        f'<ol>{rows}<li>Eric Prydz - Opus</li></ol></div></body></html>'
    )
    response = HtmlResponse(url=MIX_URL, body=html.encode('utf-8'), encoding='utf-8')
    spider = MixesdbSpider()
    tracks = [i for i in spider.parse_mix_page(response) if isinstance(i, EnhancedTrackItem)]
    assert len(tracks) == len(DROPPED_IN_LOCAL_TEST) + 1

    pipeline = ValidationPipeline()
    for track in tracks:
        assert pipeline.process_item(track, spider) is track  # DropItem would raise

    assert pipeline.stats['invalid_items'] == 0
    by_name = {(t['track_name'], t['artist_name']): t for t in tracks}
    for _line, name, artist, remix_type in DROPPED_IN_LOCAL_TEST:
        assert by_name[(name, artist)]['remix_type'] == remix_type
    assert tracks[-1]['is_remix'] is False and tracks[-1]['remix_type'] is None
