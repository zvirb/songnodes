"""JOBSTG: the scrape handler sends its job id to the unified scraper, which keys live progress by it."""
import unittest

import httpx

from common.datalayer.handlers import HANDLERS, Context


class TestScrapeHandlerJobId(unittest.IsolatedAsyncioTestCase):
    async def run_scrape(self, payload):
        sent = []

        def answer(request):
            sent.append(request)
            return httpx.Response(200, json={'bronze_playlists_persisted': 1, 'bronze_tracks_persisted': 5})

        async with httpx.AsyncClient(transport=httpx.MockTransport(answer)) as client:
            result = await HANDLERS['scrape'](None, Context(http=client, scraper_url='http://scraper'), payload)
        return sent[0], result

    async def test_job_id_is_in_the_scrape_body(self):
        request, result = await self.run_scrape({'source': 'mixesdb', 'search_query': 'Deadmau5 Strobe',
                                                 'job_id': '0b9f6a52-1c1d-4c55-9a51-3f9b8c6d2e10'})
        body = httpx.Response(200, content=request.content).json()
        self.assertEqual(request.url.path, '/scrape')
        self.assertEqual(body, {'source': 'mixesdb', 'search_query': 'Deadmau5 Strobe',
                                'job_id': '0b9f6a52-1c1d-4c55-9a51-3f9b8c6d2e10'})
        self.assertEqual(result['bronze_tracks'], 5)

    async def test_no_job_id_sends_none(self):
        request, _ = await self.run_scrape({'source': 'mixesdb', 'search_query': 'Deadmau5 Strobe'})
        self.assertNotIn('job_id', httpx.Response(200, content=request.content).json())


if __name__ == '__main__':
    unittest.main()
