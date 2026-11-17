# Documentation index

This index groups every document under `docs/` into six categories. New documents go in the folder named for their category; existing documents stay where they are, were not moved or renamed, and are classified only in this index. Each docs row in the work queue names exactly one category.

| Category | Folder for new documents | Holds |
|---|---|---|
| Decisions | `docs/decisions/` | What Markus decided, when, and how to reverse it. |
| Specifications and plans | `docs/specs/` | Requirements, SDLC packs, designs and roadmaps. |
| Runbooks | `docs/runbook/` | Step-by-step procedures a run or Markus follows. |
| Research | `docs/research/` | Findings with sources. |
| Reports | `docs/reports/` | Dated outputs and run summaries. |
| Reference | `docs/reference/` | Rules, registers, glossaries and design-system reference. |

## Decisions

What Markus decided, when, and how to reverse it. New documents: `docs/decisions/`.

| Document | Purpose |
|---|---|
| [decisions/2026-10-24-design-system-source-of-truth.md](decisions/2026-10-24-design-system-source-of-truth.md) | Decision (24 Oct 2026) that the SongNodes design system is the single source of truth. |
| [integration/C1/note.md](integration/C1/note.md) | Resolver merging decision: which resolver copy was kept and why. |
| [integration/CR1/footer-scroll-check.txt](integration/CR1/footer-scroll-check.txt) | Decision to skip the footer on the /graph route to keep a full-height canvas. |
| [integration/DS24/decision.md](integration/DS24/decision.md) | DS24: first real use of DateRange, decision waiting for Markus to pick A or B (30 Oct 2026). |
| [integration/FE9/README.md](integration/FE9/README.md) | FE9 note (26 Oct 2026): star icon chosen for target tracks. |
| [integration/NV1/decision.txt](integration/NV1/decision.txt) | NV1 decision: no separate NavDrawer row for AI setlists. |
| [integration/NV1/decisions.md](integration/NV1/decisions.md) | NV1 decisions log (28 Oct 2026). |
| [integration/P2/decision.md](integration/P2/decision.md) | P2 decision: keep features/camelot/CamelotPage.tsx as the base. |
| [integration/WP0/decisions/2026-10-25-WP0-contracts.md](integration/WP0/decisions/2026-10-25-WP0-contracts.md) | WP0 decision doc: contracts, DDL and fixtures (25 Oct 2026). |
| [integration/WP3/decisions/2026-10-25-WP3-resolver.md](integration/WP3/decisions/2026-10-25-WP3-resolver.md) | WP3 decision: resolver strategy (ISRC, combined lookup, pg_trgm fuzzy). |
| [integration/WP5/2026-10-25-WP5-library-model.md](integration/WP5/2026-10-25-WP5-library-model.md) | WP5 decision record: library overlay model (25 Oct 2026). |
| [integration/WP8/decisions/2026-10-25-WP8-graph.md](integration/WP8/decisions/2026-10-25-WP8-graph.md) | WP8 decision: graph projection outbox consumer (25 Oct 2026). |
| [integration/WP9/decisions.md](integration/WP9/decisions.md) | WP9 decisions: search indexes, Library and Sets wiring, provenance. |
| [integration/ref_mb/DECISION.md](integration/ref_mb/DECISION.md) | Decision to deploy ref_mb as a separate database instead of a songnodes schema. |
| [integration/ref_mb/open_questions.md](integration/ref_mb/open_questions.md) | Open questions and decisions needed, each with a recommendation. |

## Specifications and plans

Requirements, SDLC packs, designs and roadmaps. New documents: `docs/specs/`.

| Document | Purpose |
|---|---|
| [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) | Architecture implementation plan and milestone reference, including wave routing. |
| [features/TRACK_ALBUM_ARTWORK.md](features/TRACK_ALBUM_ARTWORK.md) | Feature design for track album artwork in the silver-to-gold layer. |
| [integration/INTEGRATION_PLAN.md](integration/INTEGRATION_PLAN.md) | Integration plan for MetaBrainz reference data and musicLibrary into songnodes (25 Oct 2026). |
| [integration/WP0/lite_tiers_draft.md](integration/WP0/lite_tiers_draft.md) | Draft spec for the two portable lookup tiers (ISRC and exact combined_lookup). |
| [integration/WP3/lite_tiers.md](integration/WP3/lite_tiers.md) | Lite SQLite-compatible SQL tiers for the musicLibrary pipeline. |
| [integration/ref_mb/GENRE_LOAD_PLAN.md](integration/ref_mb/GENRE_LOAD_PLAN.md) | Plan to load CC0 genre tables into the ref_mb mirror. |
| [requirements/TRACK_METADATA_RETRIEVAL.md](requirements/TRACK_METADATA_RETRIEVAL.md) | Requirements prompt to fix track-metadata retrieval (BPM, key, energy, platform IDs). |
| [sdlc/SDLC.md](sdlc/SDLC.md) | How work moves from idea to release and the gate each phase must pass. |
| [specs/HARMONIC_SCORING.md](specs/HARMONIC_SCORING.md) | Accepted spec for harmonic scoring and energy moves (harmonic-1). |
| [upgrades/postgres-18.md](upgrades/postgres-18.md) | Plan to upgrade Postgres from 16 to 18 (dump and restore). |
| [upgrades/rabbitmq-4.md](upgrades/rabbitmq-4.md) | Plan to move the dev stack to RabbitMQ 4.3 with a new volume. |
| [upgrades/redis-8.md](upgrades/redis-8.md) | Plan to upgrade Redis from 7 to 8.10. |

## Runbooks

Step-by-step procedures a run or Markus follows. New documents: `docs/runbook/`.

| Document | Purpose |
|---|---|
| [DEPLOYMENT_CHECKLIST.md](DEPLOYMENT_CHECKLIST.md) | Run and first-scrape checklist for the Docker Compose stack. |
| [DEVELOPMENT.md](DEVELOPMENT.md) | Tested local database and API development workflow (compose.dev.yaml and start-dev.sh). |
| [design-system/AUDIT.md](design-system/AUDIT.md) | How to run the design-system audit from frontend/ with the npm scripts. |
| [integration/prereqs.md](integration/prereqs.md) | Prerequisites for integration (infrastructure to have running). |
| [rabbitmq-vhost-fix.md](rabbitmq-vhost-fix.md) | Permanent fix for the RabbitMQ musicdb vhost connection failure. |
| [security/cisco-duo-auth-guide.md](security/cisco-duo-auth-guide.md) | Step-by-step guide to Cisco Duo MFA with the Cloudflare Tunnel. |
| [security/cloudflared-tunnel.md](security/cloudflared-tunnel.md) | Cloudflare Tunnel setup, deployment and troubleshooting. |

## Research

Findings with sources. New documents: `docs/research/`.

| Document | Purpose |
|---|---|
| [audio-analysis/deezer-previews.md](audio-analysis/deezer-previews.md) | Whether Deezer terms allow key and BPM analysis of previews (written 28 Oct 2026 for AA2). |
| [integration/ref_mb/recommendations.md](integration/ref_mb/recommendations.md) | Read-only review and recommendations for MusicBrainz in songnodes (25 Oct 2026). |
| [integration/research/integration_patterns.md](integration/research/integration_patterns.md) | Research brief: ingest, outbox, graph projection, migrations, parallel worktrees. |
| [integration/research/licensing.md](integration/research/licensing.md) | Research brief: MetaBrainz licensing (not legal advice). |
| [integration/research/matching.md](integration/research/matching.md) | Research brief: resolving noisy DJ track strings to MBIDs. |
| [integration/research/mb_import.md](integration/research/mb_import.md) | Research brief: partial MusicBrainz import. |
| [integration/survey.md](integration/survey.md) | Integration survey (WP0): verified code locations in the songnodes repository. |
| [research/architecture/data_pipeline_comprehensive_analysis_20251115.md](research/architecture/data_pipeline_comprehensive_analysis_20251115.md) | Data collection pipeline architecture analysis (15 Nov 2025). |
| [research/frontend/data_flow_visualization.md](research/frontend/data_flow_visualization.md) | Graph visualization data flow diagrams, API to canvas. |
| [research/frontend/graph_rendering_issue_summary.md](research/frontend/graph_rendering_issue_summary.md) | Executive summary of the graph rendering issue (API returns nodes, frontend shows 0). |
| [research/frontend/graph_visualization_data_flow_analysis_20251112.md](research/frontend/graph_visualization_data_flow_analysis_20251112.md) | Graph visualization data flow analysis (12 Nov 2025). |
| [research/scrapers/scraper_orchestration_analysis_20251115.md](research/scrapers/scraper_orchestration_analysis_20251115.md) | Scraper orchestration and configuration analysis (15 Nov 2025). |

## Reports

Dated outputs and run summaries. New documents: `docs/reports/`.

| Document | Purpose |
|---|---|
| [DEPLOYMENT_E2E_STATUS_2026_11_06.md](DEPLOYMENT_E2E_STATUS_2026_11_06.md) | Full stack deployment, E2E, worker and pathfinder diagnostic report (7 Nov 2026). |
| [design-system/audits/DS1.md](design-system/audits/DS1.md) | Design-system audit DS1: Design System Audit: DS1 |
| [design-system/audits/DS10.md](design-system/audits/DS10.md) | Design-system audit DS10: DS10: Design system audit: OAuth callback page |
| [design-system/audits/DS11.md](design-system/audits/DS11.md) | Design-system audit DS11: DS11: Design system audit and fix: Unrouted components, legacy UI |
| [design-system/audits/DS12.md](design-system/audits/DS12.md) | Design-system audit DS12: DS12 audit: DJ interface, setlist builder and pathfinder components |
| [design-system/audits/DS13.md](design-system/audits/DS13.md) | Design-system audit DS13: DS13: Design System Audit and Fix (aiSetlists, camelot, and leftovers) |
| [design-system/audits/DS14.md](design-system/audits/DS14.md) | Design-system audit DS14: DS14: Design system audit and fix (Utils, hooks, lib, services, types and examples) |
| [design-system/audits/DS15.md](design-system/audits/DS15.md) | Design-system audit DS15 (file is empty) |
| [design-system/audits/DS17.md](design-system/audits/DS17.md) | Design-system audit DS17 (summary of files reviewed and fixes) |
| [design-system/audits/DS2A.md](design-system/audits/DS2A.md) | Design-system audit DS2A: Design System Audit: DS2A |
| [design-system/audits/DS2B.md](design-system/audits/DS2B.md) | Design-system audit DS2B: Design System Audit DS2B |
| [design-system/audits/DS3.md](design-system/audits/DS3.md) | Design-system audit DS3: DS3: Design system audit and fix: Library page |
| [design-system/audits/DS4.md](design-system/audits/DS4.md) | Design-system audit DS4: DS4: Design system audit and fix: Set builder page |
| [design-system/audits/DS5.md](design-system/audits/DS5.md) | Design-system audit DS5: DS5: Design system audit and fix: Sources and not-found pages |
| [design-system/audits/DS6.md](design-system/audits/DS6.md) | Design-system audit DS6: DS6: Design system audit and fix: Harmony (Camelot) page |
| [design-system/audits/DS7.md](design-system/audits/DS7.md) | Design-system audit DS7: DS7: Design system audit and fix: Paths (route finder) page |
| [design-system/audits/DS8.md](design-system/audits/DS8.md) | Design-system audit DS8: DS8: Design system audit and fix: Pipeline page |
| [design-system/audits/DS9.md](design-system/audits/DS9.md) | Design-system audit DS9: DS9: Settings page design system audit |
| [design-system/audits/LY1.md](design-system/audits/LY1.md) | Design-system audit LY1: LY1 Layout Debt Audit |
| [design-system/audits/LY2.md](design-system/audits/LY2.md) | Design-system audit LY2: LY2 Audit: Layout debt in music library and set builder pages |
| [design-system/audits/LY3.md](design-system/audits/LY3.md) | Design-system audit LY3: LY3 Layout Debt Audit |
| [design-system/audits/LY4.md](design-system/audits/LY4.md) | Design-system audit LY4: LY4 Audit: Layout debt in pipeline page and export dialog |
| [design-system/audits/LY5.md](design-system/audits/LY5.md) | Design-system audit LY5: LY5 Audit: Layout debt: shared components and the DJ interface page container |
| [design-system/audits/MISSING_TOKENS.md](design-system/audits/MISSING_TOKENS.md) | Audit output listing missing design-system tokens and components with proposed tokens. |
| [integration/E1/note.md](integration/E1/note.md) | E1 implementation note: local MusicBrainz provider added to the enrichment waterfall. |
| [integration/E3/replay_live.md](integration/E3/replay_live.md) | E3 library replay report (recorded as not run). |
| [integration/LOCAL-TEST-2026-11-02.md](integration/LOCAL-TEST-2026-11-02.md) | Local production-like test of main, 2 Nov 2026. |
| [integration/REAL-DATA-TEST-2026-11-02.md](integration/REAL-DATA-TEST-2026-11-02.md) | Read-only real-data test of the running stack, 2 Nov 2026. |
| [integration/REAL-DATA-TEST-2026-11-02/02-graph-plan-desktop-no-selection.jpg](integration/REAL-DATA-TEST-2026-11-02/02-graph-plan-desktop-no-selection.jpg) | Screenshot for REAL-DATA-TEST-2026-11-02: graph plan desktop no selection. |
| [integration/REAL-DATA-TEST-2026-11-02/03-graph-plan-desktop-kabuki-selected.jpg](integration/REAL-DATA-TEST-2026-11-02/03-graph-plan-desktop-kabuki-selected.jpg) | Screenshot for REAL-DATA-TEST-2026-11-02: graph plan desktop kabuki selected. |
| [integration/REAL-DATA-TEST-2026-11-02/04-graph-plan-desktop-reload.jpg](integration/REAL-DATA-TEST-2026-11-02/04-graph-plan-desktop-reload.jpg) | Screenshot for REAL-DATA-TEST-2026-11-02: graph plan desktop reload. |
| [integration/REAL-DATA-TEST-2026-11-02/05-graph-phone-plan.jpg](integration/REAL-DATA-TEST-2026-11-02/05-graph-phone-plan.jpg) | Screenshot for REAL-DATA-TEST-2026-11-02: graph phone plan. |
| [integration/REAL-DATA-TEST-2026-11-02/06-graph-phone-search-kabuki.jpg](integration/REAL-DATA-TEST-2026-11-02/06-graph-phone-search-kabuki.jpg) | Screenshot for REAL-DATA-TEST-2026-11-02: graph phone search kabuki. |
| [integration/REAL-DATA-TEST-2026-11-02/07-graph-phone-kabuki-open.jpg](integration/REAL-DATA-TEST-2026-11-02/07-graph-phone-kabuki-open.jpg) | Screenshot for REAL-DATA-TEST-2026-11-02: graph phone kabuki open. |
| [integration/REAL-DATA-TEST-2026-11-02/08-recommendations-panel-play.jpg](integration/REAL-DATA-TEST-2026-11-02/08-recommendations-panel-play.jpg) | Screenshot for REAL-DATA-TEST-2026-11-02: recommendations panel play. |
| [integration/REAL-DATA-TEST-2026-11-02/20-phone-home-library-dark-light.jpg](integration/REAL-DATA-TEST-2026-11-02/20-phone-home-library-dark-light.jpg) | Screenshot for REAL-DATA-TEST-2026-11-02: phone home library dark light. |
| [integration/REAL-DATA-TEST-2026-11-02/21-phone-sets-graph-dark-light.jpg](integration/REAL-DATA-TEST-2026-11-02/21-phone-sets-graph-dark-light.jpg) | Screenshot for REAL-DATA-TEST-2026-11-02: phone sets graph dark light. |
| [integration/REAL-DATA-TEST-2026-11-02/22-phone-pipeline-targets-dark-light.jpg](integration/REAL-DATA-TEST-2026-11-02/22-phone-pipeline-targets-dark-light.jpg) | Screenshot for REAL-DATA-TEST-2026-11-02: phone pipeline targets dark light. |
| [integration/REAL-DATA-TEST-2026-11-02/23-phone-import-settings-dark-light.jpg](integration/REAL-DATA-TEST-2026-11-02/23-phone-import-settings-dark-light.jpg) | Screenshot for REAL-DATA-TEST-2026-11-02: phone import settings dark light. |
| [integration/REAL-DATA-TEST-2026-11-02/30-desktop-dark-home.jpg](integration/REAL-DATA-TEST-2026-11-02/30-desktop-dark-home.jpg) | Screenshot for REAL-DATA-TEST-2026-11-02: desktop dark home. |
| [integration/REAL-DATA-TEST-2026-11-02/31-desktop-dark-library.jpg](integration/REAL-DATA-TEST-2026-11-02/31-desktop-dark-library.jpg) | Screenshot for REAL-DATA-TEST-2026-11-02: desktop dark library. |
| [integration/REAL-DATA-TEST-2026-11-02/32-desktop-dark-sets.jpg](integration/REAL-DATA-TEST-2026-11-02/32-desktop-dark-sets.jpg) | Screenshot for REAL-DATA-TEST-2026-11-02: desktop dark sets. |
| [integration/REAL-DATA-TEST-2026-11-02/33-desktop-dark-graph.jpg](integration/REAL-DATA-TEST-2026-11-02/33-desktop-dark-graph.jpg) | Screenshot for REAL-DATA-TEST-2026-11-02: desktop dark graph. |
| [integration/REAL-DATA-TEST-2026-11-02/34-desktop-dark-pipeline.jpg](integration/REAL-DATA-TEST-2026-11-02/34-desktop-dark-pipeline.jpg) | Screenshot for REAL-DATA-TEST-2026-11-02: desktop dark pipeline. |
| [integration/REAL-DATA-TEST-2026-11-02/35-desktop-dark-targets.jpg](integration/REAL-DATA-TEST-2026-11-02/35-desktop-dark-targets.jpg) | Screenshot for REAL-DATA-TEST-2026-11-02: desktop dark targets. |
| [integration/REAL-DATA-TEST-2026-11-02/36-desktop-dark-import.jpg](integration/REAL-DATA-TEST-2026-11-02/36-desktop-dark-import.jpg) | Screenshot for REAL-DATA-TEST-2026-11-02: desktop dark import. |
| [integration/REAL-DATA-TEST-2026-11-02/37-desktop-dark-settings.jpg](integration/REAL-DATA-TEST-2026-11-02/37-desktop-dark-settings.jpg) | Screenshot for REAL-DATA-TEST-2026-11-02: desktop dark settings. |
| [integration/REAL-DATA-TEST-2026-11-02/40-desktop-light-home.jpg](integration/REAL-DATA-TEST-2026-11-02/40-desktop-light-home.jpg) | Screenshot for REAL-DATA-TEST-2026-11-02: desktop light home. |
| [integration/REAL-DATA-TEST-2026-11-02/41-desktop-light-library.jpg](integration/REAL-DATA-TEST-2026-11-02/41-desktop-light-library.jpg) | Screenshot for REAL-DATA-TEST-2026-11-02: desktop light library. |
| [integration/REAL-DATA-TEST-2026-11-02/42-desktop-light-sets.jpg](integration/REAL-DATA-TEST-2026-11-02/42-desktop-light-sets.jpg) | Screenshot for REAL-DATA-TEST-2026-11-02: desktop light sets. |
| [integration/REAL-DATA-TEST-2026-11-02/43-desktop-light-graph.jpg](integration/REAL-DATA-TEST-2026-11-02/43-desktop-light-graph.jpg) | Screenshot for REAL-DATA-TEST-2026-11-02: desktop light graph. |
| [integration/REAL-DATA-TEST-2026-11-02/44-desktop-light-pipeline.jpg](integration/REAL-DATA-TEST-2026-11-02/44-desktop-light-pipeline.jpg) | Screenshot for REAL-DATA-TEST-2026-11-02: desktop light pipeline. |
| [integration/REAL-DATA-TEST-2026-11-02/45-desktop-light-targets.jpg](integration/REAL-DATA-TEST-2026-11-02/45-desktop-light-targets.jpg) | Screenshot for REAL-DATA-TEST-2026-11-02: desktop light targets. |
| [integration/REAL-DATA-TEST-2026-11-02/46-desktop-light-import.jpg](integration/REAL-DATA-TEST-2026-11-02/46-desktop-light-import.jpg) | Screenshot for REAL-DATA-TEST-2026-11-02: desktop light import. |
| [integration/REAL-DATA-TEST-2026-11-02/47-desktop-light-settings.jpg](integration/REAL-DATA-TEST-2026-11-02/47-desktop-light-settings.jpg) | Screenshot for REAL-DATA-TEST-2026-11-02: desktop light settings. |
| [integration/S3/README.md](integration/S3/README.md) | S3 change note: music search UI shows the real API error. |
| [integration/U17/notes.md](integration/U17/notes.md) | U17 note (26 Oct 2026) on the strawberry-graphql upgrade and a FastAPI websocket error. |
| [integration/WP3/resolver_eval_2026-10-25.md](integration/WP3/resolver_eval_2026-10-25.md) | Resolver evaluation report with Gate P3 measurements (25 Oct 2026). |
| [integration/WP4/replay.md](integration/WP4/replay.md) | WP4 library replay: field coverage old versus new. |
| [integration/local-test-2026-11-02/05-scrape-card-running.jpg](integration/local-test-2026-11-02/05-scrape-card-running.jpg) | Screenshot for local-test-2026-11-02: scrape card running. |
| [integration/local-test-2026-11-02/06-window-cleared.jpg](integration/local-test-2026-11-02/06-window-cleared.jpg) | Screenshot for local-test-2026-11-02: window cleared. |
| [integration/local-test-2026-11-02/06-window-paused-and-scrape-card-0-00.jpg](integration/local-test-2026-11-02/06-window-paused-and-scrape-card-0-00.jpg) | Screenshot for local-test-2026-11-02: window paused and scrape card 0 00. |
| [integration/local-test-2026-11-02/07-graph-canvas-empty-in-pane.jpg](integration/local-test-2026-11-02/07-graph-canvas-empty-in-pane.jpg) | Screenshot for local-test-2026-11-02: graph canvas empty in pane. |
| [integration/local-test-2026-11-02/07-graph-phone-menu-clipped.jpg](integration/local-test-2026-11-02/07-graph-phone-menu-clipped.jpg) | Screenshot for local-test-2026-11-02: graph phone menu clipped. |
| [integration/local-test-2026-11-02/07-home-library-0-tracks.jpg](integration/local-test-2026-11-02/07-home-library-0-tracks.jpg) | Screenshot for local-test-2026-11-02: home library 0 tracks. |
| [integration/local-test-2026-11-02/07-library-empty.jpg](integration/local-test-2026-11-02/07-library-empty.jpg) | Screenshot for local-test-2026-11-02: library empty. |
| [integration/local-test-2026-11-02/07-library-phone-button-clipped.jpg](integration/local-test-2026-11-02/07-library-phone-button-clipped.jpg) | Screenshot for local-test-2026-11-02: library phone button clipped. |
| [integration/local-test-2026-11-02/07-pipeline-runs-87h-durations.jpg](integration/local-test-2026-11-02/07-pipeline-runs-87h-durations.jpg) | Screenshot for local-test-2026-11-02: pipeline runs 87h durations. |
| [security/dependency-updates.md](security/dependency-updates.md) | Output of dependency security audits (npm audit and others). |

## Reference

Rules, registers, glossaries and design-system reference. New documents: `docs/reference/`.

| Document | Purpose |
|---|---|
| [DATA_LAYER.md](DATA_LAYER.md) | How a scrape becomes trustworthy, enriched, queryable catalog data (bronze to gold flow). |
| [METADATA_BASELINE.md](METADATA_BASELINE.md) | Metadata baseline and source inventory for the cloud development stack (checked 24 Oct 2026). |
| [RESILIENCE.md](RESILIENCE.md) | Resilience and recovery guide: system resilience features. |
| [audio-analysis/key-bpm.md](audio-analysis/key-bpm.md) | Key and BPM analysis module: method and use of Essentia. |
| [design-system/CODE_REFERENCE.md](design-system/CODE_REFERENCE.md) | Code-only reference for using the design system (import order, helpers). |
| [design-system/EXCEPTIONS.md](design-system/EXCEPTIONS.md) | Approved exceptions to the design system in the SongNodes app. |
| [design-system/README.md](design-system/README.md) | How the design system works in this repo and where to find things. |
| [design-system/build_standalone.py](design-system/build_standalone.py) | Script that builds reference.standalone.html with the design system inlined. |
| [design-system/gen_code_reference.py](design-system/gen_code_reference.py) | Script that regenerates the generated parts of CODE_REFERENCE.md. |
| [design-system/reference.html](design-system/reference.html) | Rendered design-system reference examples (SongNodes). |
| [design-system/reference.standalone.html](design-system/reference.standalone.html) | Standalone copy of the design-system reference with assets inlined. |
| [enrichment/providers.md](enrichment/providers.md) | Execution order and configuration of metadata enrichment providers. |
| [integration/WP0/versions.csv](integration/WP0/versions.csv) | WP0 version register (version, date, unit, status, decision link). |
| [integration/WP3/versions.csv](integration/WP3/versions.csv) | WP3 version register. |
| [integration/WP5/versions.csv](integration/WP5/versions.csv) | WP5 version register. |
| [integration/WP8/versions.csv](integration/WP8/versions.csv) | WP8 version register. |
| [integration/ref_mb/SETTINGS.md](integration/ref_mb/SETTINGS.md) | Environment variables that configure the ref_mb integration. |
| [integration/ref_mb/schema_inventory.csv](integration/ref_mb/schema_inventory.csv) | Inventory of MusicBrainz tables, columns and row counts. |
| [licensing/MUSICBRAINZ.md](licensing/MUSICBRAINZ.md) | MusicBrainz data licensing: CC0 and non-commercial categories. |
| [music-search.md](music-search.md) | Music search proxy endpoint and local credential configuration. |
| [pipeline-telemetry.md](pipeline-telemetry.md) | What the Pipeline Telemetry page shows and how figures map to API data. |
| [security/ai-proxy.md](security/ai-proxy.md) | AI proxy migration notes for the /api/v1/ai/complete endpoint (SEC6B). |
| [security/ci-scanning.md](security/ci-scanning.md) | Automated CI security scanning jobs and when they run. |
