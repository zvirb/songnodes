"""
VAL1: a 1001Tracklists scrape searches for the one track it was asked for.

Every automatic 1001Tracklists run on 2 Nov either timed out (900 s, HTTP 504) or
found nothing. The unified scraper API dropped the job's search_query for this
source, so the spider fell back to 'targeted' mode (a search for every target
track, about 90 s apart), and the search start request put the form submission
under 'playwright_page_coroutines', which scrapy-playwright 0.0.48 ignores.
"""
import pytest
from scrapy.http import HtmlResponse, Request

from scrapers import unified_scraper_api as api
from scrapers.tests.test_1001tracklists_spider import OneThousandOneTracklistsSpider, mock_spider_init  # noqa: F401


@pytest.mark.asyncio
async def test_api_passes_search_query_and_limit_to_1001tracklists(monkeypatch):
    seen = {}

    async def fake_run_spider(cmd, timeout=900):
        seen['cmd'] = cmd
        return {'status': 'completed', 'returncode': 0, 'stdout': '', 'stderr': ''}

    monkeypatch.setattr(api, '_run_spider', fake_run_spider)
    await api._scrape_internal(api.ScrapeRequest(source='1001tracklists', search_query='Deadmau5 Strobe', limit=3))
    cmd = seen['cmd']
    assert cmd[:3] == ['scrapy', 'crawl', '1001tracklists']
    assert 'search_query=Deadmau5 Strobe' in cmd
    assert 'limit=3' in cmd


def test_search_request_submits_the_form_through_a_page_method(mock_spider_init):  # noqa: F811
    spider = OneThousandOneTracklistsSpider(search_query='Deadmau5 Strobe')
    [request] = list(spider.start_requests())
    assert request.callback == spider.parse_search_results
    assert request.meta['search_query'] == 'Deadmau5 Strobe'
    assert 'playwright_page_coroutines' not in request.meta
    methods = request.meta['playwright_page_methods']
    # A callable page method is the form submission coroutine (scrapy-playwright calls it with the page).
    assert any(callable(getattr(m, 'method', None)) or (isinstance(m, tuple) and callable(m[0])) for m in methods)


def test_limit_caps_tracklists_followed_per_search(mock_spider_init):  # noqa: F811
    spider = OneThousandOneTracklistsSpider(search_query='Deadmau5 Strobe', limit='2')
    spider.is_source_processed = lambda url: False
    links = ''.join(f'<a href="/tracklist/{i}/set-{i}.html">Set {i}</a>' for i in range(6))
    response = HtmlResponse(url='https://www.1001tracklists.com/', body=f'<html><body>{links}</body></html>'.encode(),
                            encoding='utf-8', request=Request('https://www.1001tracklists.com/', meta={}))
    requests = [r for r in spider._parse_search_results_impl(response) if isinstance(r, Request)]
    assert len(requests) == 2
    assert all('/tracklist/' in r.url for r in requests)
