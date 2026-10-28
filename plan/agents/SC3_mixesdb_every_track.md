SC3: MixesDB: keep every track of a mix

Base: main at BASE_SHA. Repo: zvirb/songnodes. Follow "Working rules for agents" in AGENTS.md (one job, owned paths only, about 400 changed lines at most, verify then commit, two attempts then stop, rebase before the PR) and CLAUDE.md; the design system rules apply to any UI change. No access to the user's laptop, local data or secrets; work from the repo and fixtures. Open one PR against main titled "SC3: MixesDB: keep every track of a mix" on a branch starting with "sc3-"; do not merge it. Edit only the lines inside your own STATUS.md slot (SLOT:SC3 BEGIN/END). Depends on: none. If a dependency is not merged on main yet, stop and say so instead of working around it. Never merge or rebuild your branch from an older base: before opening or updating the PR, run `git fetch origin main && git diff --diff-filter=D --name-only origin/main...HEAD`; it must list only your owned paths, otherwise stop and say so (the scope guard fails the PR anyway). New pages register through frontend/src/routes (G2) and new REST routers expose register(app) (G3); never edit App.tsx or services/rest_api/main.py unless your brief owns them.

## Job
Make a MixesDB mix land in bronze with every track at positions 1..N, so silver accepts it instead of rejecting it for a position gap.

## Context (verified on main 2026-10-28)
A live run on the owner's laptop lost track 10 of 'Testpilot / deadmau5 - Essential Mix' and tracks 17-28 (the second hour). Two causes:
1. Track rows collide across mixes. scrapers/spiders/mixesdb_spider.py parse_mix_page (about line 562) yields EnhancedSetlistTrackItem without a source_url; scrapers/items.py EnhancedSetlistTrackItem (line 215) has no source_url field. scrapers/pipelines/persistence_pipeline.py _process_playlist_track_item (about lines 650-700) builds source_track_id 'artist::title' and source_url item.get('source_url', 'unknown'); the bronze insert (about line 1019) is ON CONFLICT (source, source_url, source_track_id) (unique in sql/migrations/medallion/001_bronze_layer_up.sql line 36). So the same track in another mix (or twice in one mix) updates the existing row's playlist_id/position, and this mix ends up with a hole. services/common/datalayer/ingest.py completeness_errors (line 145) then rejects it as 'position_gap'.
2. Only the first list is read. extract_enhanced_tracks (line 758) uses `//h2[contains(., "Tracklist")]/following-sibling::ol[1]/li` (line 778); MixesDB splits long mixes into several <ol> (one per hour/CD), so everything after the first <ol> is dropped.
Note also: lines with an 'ID'/'?'/unknown title or no artist are skipped (about line 846) and positions use len(tracks_data) + 1, so later tracks renumber silently. Complete playlists only: a mix with an unidentified track must still keep its slot (keep the track row with its raw text) or be reported incomplete, never renumbered. Never Beatport.

## Owned paths
- scrapers/spiders/mixesdb_spider.py (parse_mix_page track yield, extract_enhanced_tracks only)
- scrapers/items.py (add source_url to EnhancedSetlistTrackItem only)
- scrapers/pipelines/persistence_pipeline.py (_process_playlist_track_item only: per-occurrence source_track_id)
- tests/unit/scrapers/test_mixesdb_spider.py (new)
- tests/unit/scrapers/fixtures/mixesdb_two_lists.html (new, small synthetic page)

(Complete list. Anything else is read-only for you. You may also add a dated note under docs/integration/SC3/ if you need to record a decision.)

## Do
1. items.py: add `source_url = scrapy.Field()` to EnhancedSetlistTrackItem.
2. Spider: set source_url=response.url on every EnhancedSetlistTrackItem.
3. Spider: read every <ol> after the Tracklist <h2> up to the next <h2> (for example `//h2[contains(., "Tracklist")]/following-sibling::*[preceding-sibling::h2[1][contains(., "Tracklist")]]/descendant-or-self::ol/li`), in document order, with positions continuous across lists (1..N). Keep the existing patterns 2-4 as fallbacks (the file's comment asks for that).
4. Spider: an unidentified line ('ID - ID', '?') keeps its position. Either yield it with its raw text so the slot exists, or mark the playlist incomplete; do not renumber the tracks after it. Say which you chose and why in the PR.
5. Pipeline: in _process_playlist_track_item, when the item has a position, make source_track_id per occurrence (for example 'artist::title#<position>') so two mixes, or one mix playing a track twice, never share a bronze row. Nothing on main parses this value (checked: data-transformer/bronze_to_silver_etl.py and services/common/datalayer only read it).
6. Fixture: write a small synthetic HTML page (made-up artists and titles, no copied MixesDB content) with a Tracklist <h2>, two <ol> lists (3 + 2 items, one 'ID - ID'), and a later <h2> with another <ol> that must be ignored.
7. Tests (follow tests/unit/scrapers/test_1001tracklists_spider.py for building the spider offline with HtmlResponse): all 5 positions 1..5 in order, every track item carries the mix URL as source_url, the list after the next <h2> is not read, and the pipeline gives two different mixes containing the same track different (source_url, source_track_id) keys.
8. New test files: .gitignore has a test_*.py rule, so add new test files with `git add -f`.
9. Your PR must change code, not only STATUS.md; check `git diff --stat origin/main...HEAD` before opening it.

## Done when (the reviewer's under-10-minute check; put it in the PR)
`python -m pytest tests/unit/scrapers/test_mixesdb_spider.py -q` passes, and on a running stack `curl -X POST http://127.0.0.1:8012/scrape -H "Content-Type: application/json" -d '{"spider_name":"mixesdb","search_params":{"search_query":"deadmau5 Strobe","limit":1}}'` produces a bronze playlist whose positions run 1..N with no gaps (`SELECT max(position), count(*) FROM bronze_scraped_tracks WHERE playlist_id = ...` equal).

## Checks
`python -m pytest tests/unit/scrapers -q`, `cd scrapers && python -m pytest tests -q`. Report failures in files you do not own; do not fix them.

## Hand-back
The one job done, files added/changed/deleted, checks run and not run, the reviewer check, follow-ups (for example existing bronze rows with source_url 'unknown' that need a re-scrape).
