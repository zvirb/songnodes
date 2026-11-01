"""JOBSTG: the unified scraper keeps a live progress record per worker job while POST /scrape is open."""
import asyncio
import sys

import pytest
from fastapi import HTTPException

from scrapers import unified_scraper_api as api

CRAWLED = "2026-11-01 10:00:10 [scrapy.extensions.logstats] INFO: Crawled {} pages (at 4 pages/min), scraped {} items (at 2 items/min)"


def test_feed_counts_pages_and_bronze_rows_and_moves_updated_at_only_on_change():
    record = api.ScrapeProgress('job-1')
    record.updated_at = 'before'
    record.feed('INFO: Spider opened')
    assert record.updated_at == 'before'
    record.feed(CRAWLED.format(3, 0))
    assert (record.pages, record.updated_at != 'before') == (3, True)
    record.updated_at = 'still'
    record.feed(CRAWLED.format(3, 0))  # LogStats repeats an unchanged count: not progress
    assert record.updated_at == 'still'
    record.feed('INFO: ✓ Inserted 2 playlists to bronze layer (total)')
    record.feed('INFO: ✓ Inserted 6 tracks to bronze layer (skipped=0, errors=0)')
    record.feed('INFO: ✓ Inserted 4 tracks to bronze layer (skipped=0, errors=0)')
    record.feed(CRAWLED.format(5, 3))
    assert (record.pages, record.items, record.playlists, record.tracks) == (5, 3, 2, 10)
    assert record.as_dict()['running'] is True


@pytest.mark.asyncio
async def test_progress_is_readable_while_the_scrape_runs_and_marked_finished_after(monkeypatch):
    seen = {}

    async def fake_run_spider(cmd, timeout=900):
        assert f'LOGSTATS_INTERVAL={api.LOGSTATS_SECONDS}' in cmd
        record = api._current_progress.get()
        record.feed(CRAWLED.format(1, 0))
        record.feed('INFO: ✓ Inserted 1 playlists to bronze layer (total)')
        seen['mid'] = await api.scrape_progress('job-live')
        return {'status': 'success', 'returncode': 0, 'stdout': '', 'stderr': ''}

    monkeypatch.setattr(api, '_run_spider', fake_run_spider)
    await api.scrape(api.ScrapeRequest(source='mixesdb', search_query='Deadmau5 Strobe', job_id='job-live'))
    assert seen['mid']['running'] is True and seen['mid']['pages'] == 1 and seen['mid']['playlists'] == 1
    after = await api.scrape_progress('job-live')
    assert after['running'] is False and after['finished_at'] is not None
    assert api._current_progress.get() is None


@pytest.mark.asyncio
async def test_no_job_id_keeps_no_record_and_unknown_job_is_404(monkeypatch):
    async def fake_run_spider(cmd, timeout=900):
        assert api._current_progress.get() is None
        return {'status': 'success', 'returncode': 0, 'stdout': '', 'stderr': ''}

    monkeypatch.setattr(api, '_run_spider', fake_run_spider)
    before = len(api.PROGRESS)
    await api.scrape(api.ScrapeRequest(source='mixesdb', search_query='Deadmau5 Strobe'))
    assert len(api.PROGRESS) == before
    with pytest.raises(HTTPException) as error:
        await api.scrape_progress('never-seen')
    assert error.value.status_code == 404 and error.value.detail == 'No progress recorded for this job'


def test_records_are_bounded_and_a_retry_starts_from_zero():
    first = api.start_progress('job-retry')
    first.pages = 9
    assert api.start_progress('job-retry').pages == 0
    for n in range(api.PROGRESS_KEEP + 5):
        api.start_progress(f'bulk-{n}')
    assert len(api.PROGRESS) == api.PROGRESS_KEEP


@pytest.mark.asyncio
async def test_run_spider_feeds_lines_before_the_process_exits(monkeypatch):
    """A real child process: the count is visible while it is still running, and the output is still returned whole."""
    real_exec = asyncio.create_subprocess_exec

    async def exec_here(*cmd, cwd=None, **kwargs):
        return await real_exec(*cmd, **kwargs)

    monkeypatch.setattr(api.asyncio, 'create_subprocess_exec', exec_here)
    script = ("import sys, time; print(%r, file=sys.stderr, flush=True); time.sleep(1.5); "
              "print('done', flush=True)") % CRAWLED.format(4, 1)
    record = api.ScrapeProgress('job-proc')
    token = api._current_progress.set(record)
    try:
        task = asyncio.ensure_future(api._run_spider([sys.executable, '-c', script], timeout=30))
        for _ in range(100):
            if record.pages:
                break
            await asyncio.sleep(0.05)
        assert record.pages == 4 and not task.done()
        result = await task
    finally:
        api._current_progress.reset(token)
    assert result['status'] == 'success' and 'done' in result['stdout'] and 'Crawled 4 pages' in result['stderr']
