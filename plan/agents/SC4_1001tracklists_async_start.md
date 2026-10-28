SC4: 1001Tracklists spider starts on current Scrapy

Base: main at BASE_SHA. Repo: zvirb/songnodes. Follow "Working rules for agents" in AGENTS.md (one job, owned paths only, about 400 changed lines at most, verify then commit, two attempts then stop, rebase before the PR) and CLAUDE.md; the design system rules apply to any UI change. No access to the user's laptop, local data or secrets; work from the repo and fixtures. Open one PR against main titled "SC4: 1001Tracklists spider starts on current Scrapy" on a branch starting with "sc4-"; do not merge it. Edit only the lines inside your own STATUS.md slot (SLOT:SC4 BEGIN/END). Depends on: none. If a dependency is not merged on main yet, stop and say so instead of working around it. Never merge or rebuild your branch from an older base: before opening or updating the PR, run `git fetch origin main && git diff --diff-filter=D --name-only origin/main...HEAD`; it must list only your owned paths, otherwise stop and say so (the scope guard fails the PR anyway). New pages register through frontend/src/routes (G2) and new REST routers expose register(app) (G3); never edit App.tsx or services/rest_api/main.py unless your brief owns them.

## Job
Make the 1001Tracklists spider start under the pinned Scrapy, so a live crawl issues its first requests instead of failing.

## Context (verified on main 2026-10-28)
scrapers/requirements.txt pins scrapy==2.19.0. Since Scrapy 2.13 the engine calls `async def start(self)` and requires it to be an asynchronous generator; a spider that overrides `start` with a plain generator fails at startup with `TypeError: ...start() must be an asynchronous generator` (seen on the owner's laptop today). OneThousandOneTracklistsSpider (scrapers/spiders/1001tracklists_spider.py line 71) defines a synchronous `def start(self)` at line 636 that yields the login request (disabled `if False:` branch) and one Request per start_urls entry with scrapy-playwright meta (PageMethod route/wait_for_selector, playwright_page_coroutines for the search form). The same synchronous pattern exists in scrapers/spiders/base_spiders.py (lines 47 in a docstring, 342, 592), musicbrainz_spider.py:154, reddit_monitor_spider.py:244, stores/discogs_spider.py:221, stores/spotify_spider.py:252 and stores/beatport_spider.py:352; they are out of scope here (list them as follow-ups; base_spiders.py is inherited by other spiders, so it needs its own package). Unit tests for this spider live in tests/unit/scrapers/test_1001tracklists_spider.py (offline fixtures at lines 53-69 stub credentials, state store and robots).

## Owned paths
- scrapers/spiders/1001tracklists_spider.py (the start method only)
- tests/unit/scrapers/test_1001tracklists_spider.py (add tests only)

(Complete list. Anything else is read-only for you. You may also add a dated note under docs/integration/SC4/ if you need to record a decision.)

## Do
1. Change `def start(self)` to `async def start(self)` keeping the body and its `yield`s (an async generator), or move the body to `start_requests` and drop the override; pick the one that keeps the existing request meta unchanged and say which in the PR. Do not change parsing, headers or playwright meta.
2. If the body calls anything blocking (it should not: it only builds Requests), leave it as is; do not add awaits that touch the network.
3. Test: build the spider with the existing offline fixtures and `search_query='Deadmau5 Strobe'`, collect the start requests (`asyncio.run` over `async for r in spider.start()`, or `list(spider.start_requests())` if you chose that), and assert: `inspect.isasyncgenfunction(OneThousandOneTracklistsSpider.start)` or no `start` override; at least one Request; each has a callback, `meta['playwright']` is True, and a search start URL becomes a request to https://www.1001tracklists.com/ with a 'search_query' in meta.
4. Test: a direct /tracklist/ start URL becomes a request with callback parse_tracklist.
5. Your PR must change code, not only STATUS.md; check `git diff --stat origin/main...HEAD` before opening it.

## Done when (the reviewer's under-10-minute check; put it in the PR)
`python -m pytest tests/unit/scrapers/test_1001tracklists_spider.py -q` passes, and on a running stack `curl -X POST http://127.0.0.1:8012/scrape -H "Content-Type: application/json" -d '{"spider_name":"1001tracklists","search_params":{"search_query":"Deadmau5 Strobe","limit":1}}'` followed by `docker compose -f compose.dev.yaml logs --tail=100 unified-scraper` shows requests being crawled and no "must be an asynchronous generator" error.

## Checks
`python -m pytest tests/unit/scrapers -q`, `python -c "import ast,sys; ast.parse(open('scrapers/spiders/1001tracklists_spider.py').read())"`. Report failures in files you do not own; do not fix them.

## Hand-back
The one job done, files added/changed/deleted, checks run and not run, the reviewer check, follow-ups (the other spiders with a synchronous start listed above).
