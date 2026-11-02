VAL1: MixesDB remixes keep a remix type and pass validation

Base: main at 338fa9b0. Follow "Working rules for agents" in AGENTS.md and CLAUDE.md. Branch `val1-mixesdb-remix-type`.

## Job
Stop ValidationPipeline dropping real remixes ("remix_type must be specified when is_remix=True").

## Context (2 Nov 2026 local test, `docs/integration/LOCAL-TEST-2026-11-02.md`, PR #518)
One MixesDB scrape for "Deadmau5 Strobe" dropped 20 track items, among them the target Strobe – Deadmau5,
Hurricane – Alex Niggemann, Shivers – Armin van Buuren and The Veldt – Deadmau5. The spider set `is_remix` from
"(Name Remix)" but always sent `remix_type = None`, and ValidationPipeline (100) runs before EnrichmentPipeline (200),
which fills the type. The same run found only 7 new transitions from 5 playlists of 118 bronze tracks, and every
recent 1001Tracklists run timed out (900 s, HTTP 504) or found nothing: both are investigated and reported, and fixed
here only where the fix is small and inside `scrapers/`.

## Owned paths
- scrapers/spiders/utils.py (parse_track_string remix type only)
- scrapers/spiders/mixesdb_spider.py (remix type only)
- scrapers/pydantic_models.py (remix consistency validator only)
- scrapers/spiders/1001tracklists_spider.py (search start request only)
- scrapers/unified_scraper_api.py (1001tracklists parameters only)
- scrapers/tests/test_remix_type_validation.py (new)
- scrapers/tests/test_1001tracklists_search.py (new)
- tests/unit/scrapers/test_1001tracklists_spider.py (search start request assertion only)
- plan/agents/VAL1_mixesdb_remix_type.md (this brief)
- STATUS.md (VAL1 slot)

## Not owned
`scrapers/pipelines/persistence_pipeline.py` (BRZ3), anything under `services/` or `frontend/`, `compose.dev.yaml`.

## Checks
`python -m pytest scrapers/tests -q`; `python -m pytest tests/unit/scrapers -q`; the scope guard; if the shared stack
is free, rebuild only the unified-scraper image and run one MixesDB scrape for "Deadmau5 Strobe".
