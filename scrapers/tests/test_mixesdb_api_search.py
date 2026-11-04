"""
TGT3: MixesDB target search queries the MediaWiki API directly for track matches.

MediaWiki Special:Search HTML renders client-side on modern MixesDB, causing static HTML
queries to yield 0 mix links. The MediaWiki action=query&list=search API returns direct
matches in JSON format for the specific artist and title.
"""
import json
import pytest
from scrapy.http import TextResponse, Request
from scrapers.spiders.mixesdb_spider import MixesdbSpider


def test_search_query_generates_api_search_url_first():
    spider = MixesdbSpider(search_query="Djrum - Watermark")
    assert len(spider.start_urls) >= 1
    first_url = spider.start_urls[0]
    assert "api.php" in first_url
    assert "action=query" in first_url
    assert "list=search" in first_url
    assert "srsearch=" in first_url


def test_parse_api_search_results_yields_mix_urls():
    spider = MixesdbSpider(search_query="Djrum - Watermark")
    sample_json = json.dumps({
        "query": {
            "search": [
                {"title": "2011-09-10 - Mary Anne Hobbs, Martyn, DJRUM @ XFM"},
                {"title": "Category:Djrum Sets"},
                {"title": "2022-12-09 - Orphic - Phonica Friends & Family Mix Series 12"}
            ]
        }
    })
    req = Request("https://www.mixesdb.com/w/api.php?action=query&list=search&srsearch=%22Djrum%22+%22Watermark%22&format=json&srlimit=10")
    resp = TextResponse(url=req.url, request=req, body=sample_json, encoding='utf-8')
    results = list(spider.parse_api_search_results(resp))

    # Category: is filtered out; only the 2 mix pages are yielded
    assert len(results) == 2
    assert all(isinstance(r, Request) for r in results)
    assert results[0].url == "https://www.mixesdb.com/w/2011-09-10_-_Mary_Anne_Hobbs%2C_Martyn%2C_DJRUM_%40_XFM"
    assert results[1].url == "https://www.mixesdb.com/w/2022-12-09_-_Orphic_-_Phonica_Friends_%26_Family_Mix_Series_12"
