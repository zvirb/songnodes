"""
Generate high-fidelity, design-system compliant SVG diagrams for SongNodes.
Outputs to: documentation/data-flow-analysis/
- system-architecture-data-flow.svg
- user-journey-operational-flow.svg
- production-execution-closed-loop.svg
- enhanced-architecture-connections-and-gaps.svg
"""
import os

SVG_DIR = "documentation/data-flow-analysis"
os.makedirs(SVG_DIR, exist_ok=True)

# Common SVG Defs & Styles using SongNodes Design System Tokens
SVG_COMMON_DEFS = """
  <defs>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&amp;family=JetBrains+Mono:wght@400;500;600&amp;family=Sora:wght@400;600;700&amp;display=swap');
      
      .bg { fill: #222222; }
      .text-title { font-family: 'Sora', 'Inter', sans-serif; font-weight: 700; fill: #f9f9f9; }
      .text-lead { font-family: 'Sora', 'Inter', sans-serif; font-weight: 400; fill: #a3a3a3; }
      .text-body { font-family: 'Inter', system-ui, sans-serif; font-weight: 400; fill: #f9f9f9; font-size: 13px; }
      .text-body-strong { font-family: 'Inter', system-ui, sans-serif; font-weight: 600; fill: #f9f9f9; font-size: 13px; }
      .text-body-muted { font-family: 'Inter', system-ui, sans-serif; font-weight: 400; fill: #bbbbbb; font-size: 12px; }
      .text-caption { font-family: 'Inter', system-ui, sans-serif; font-weight: 400; fill: #a3a3a3; font-size: 11px; }
      .text-label { font-family: 'Inter', system-ui, sans-serif; font-weight: 600; fill: #bbbbbb; font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; }
      .text-data { font-family: 'JetBrains Mono', Consolas, monospace; font-weight: 500; fill: #e2f0fe; font-size: 11px; }
      .text-data-strong { font-family: 'JetBrains Mono', Consolas, monospace; font-weight: 600; fill: #5fd08f; font-size: 11px; }
      
      .card-neutral { fill: #2d2d2d; stroke: #3c3c3c; stroke-width: 1.5px; rx: 14px; }
      .card-sunk { fill: #1b1b1b; stroke: #3c3c3c; stroke-width: 1px; rx: 8px; }
      
      .card-graph { fill: #22313e; stroke: #3d5872; stroke-width: 1.5px; rx: 12px; }
      .card-library { fill: #362e1b; stroke: #63532f; stroke-width: 1.5px; rx: 12px; }
      .card-sets { fill: #3f291e; stroke: #744935; stroke-width: 1.5px; rx: 12px; }
      .card-paths { fill: #3e2732; stroke: #71455c; stroke-width: 1.5px; rx: 12px; }
      .card-sources { fill: #27331e; stroke: #465d35; stroke-width: 1.5px; rx: 12px; }
      .card-pipeline { fill: #283135; stroke: #475861; stroke-width: 1.5px; rx: 12px; }
      .card-services { fill: #312f26; stroke: #585644; stroke-width: 1.5px; rx: 12px; }
      
      .card-gap { fill: #41211e; stroke: #ff7469; stroke-width: 2px; stroke-dasharray: 6 4; rx: 12px; }
      .card-module { fill: #143321; stroke: #5fd08f; stroke-width: 2px; rx: 12px; }

      .badge-ok { fill: #143321; stroke: #5fd08f; rx: 999px; }
      .badge-warn { fill: #38280c; stroke: #efb54a; rx: 999px; }
      .badge-bad { fill: #41211e; stroke: #ff7469; rx: 999px; }
      
      .edge { stroke: #858585; stroke-width: 2px; fill: none; }
      .edge-active { stroke: #9b85cb; stroke-width: 2.5px; fill: none; }
      .edge-data { stroke: #5fd08f; stroke-width: 2px; fill: none; }
      .edge-gap { stroke: #ff7469; stroke-width: 2px; stroke-dasharray: 5 4; fill: none; }
    </style>
    
    <filter id="shadow-1" x="-5%" y="-5%" width="110%" height="110%">
      <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#000000" flood-opacity="0.4"/>
    </filter>
    <filter id="shadow-2" x="-5%" y="-5%" width="110%" height="110%">
      <feDropShadow dx="0" dy="6" stdDeviation="8" flood-color="#000000" flood-opacity="0.5"/>
    </filter>
    
    <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#858585"/>
    </marker>
    <marker id="arrow-brand" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#9b85cb"/>
    </marker>
    <marker id="arrow-ok" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#5fd08f"/>
    </marker>
    <marker id="arrow-gap" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#ff7469"/>
    </marker>
  </defs>
"""

# 1. System Architecture & End-to-End Data Flow
def generate_system_architecture():
    svg = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1800 1100" width="100%" height="100%">
  <title>SongNodes: System Architecture, Storage Hubs &amp; Data Flow</title>
  <rect width="1800" height="1100" class="bg"/>
  {SVG_COMMON_DEFS}
  
  <!-- Header Banner -->
  <g transform="translate(48, 48)">
    <text class="text-title" font-size="28"><tspan class="text-lead">System Architecture:</tspan> End-to-End Data Flow, Storage Hubs &amp; Service Contracts</text>
    <text class="text-body-muted" y="28">Authoritative topology map covering Scrapers, PostgreSQL Medallion Core, Memgraph Graph, Redis Broker, and Sister Project (musicLibrary)</text>
  </g>
  
  <!-- TIER 1: External Sources & Ingestion Orchestrator (Top Left) -->
  <g transform="translate(48, 110)" filter="url(#shadow-1)">
    <rect width="360" height="380" class="card-neutral"/>
    <text class="text-label" x="20" y="32">External Web &amp; Broadcast Sources</text>
    
    <g transform="translate(20, 50)">
      <rect width="320" height="52" class="card-sunk"/>
      <text class="text-body-strong" x="14" y="22">1001Tracklists &amp; MixesDB Spiders</text>
      <text class="text-caption" x="14" y="40">Playwright Chromium &amp; MediaWiki API · Complete sets</text>
    </g>
    
    <g transform="translate(20, 112)">
      <rect width="320" height="52" class="card-sunk"/>
      <text class="text-body-strong" x="14" y="22">Community Radio (PBS, 3RRR, TripleJ)</text>
      <text class="text-caption" x="14" y="40">Airnet REST &amp; HTML scraping · Weekly Sunday harvest</text>
    </g>
    
    <g transform="translate(20, 174)">
      <rect width="320" height="52" class="card-sunk"/>
      <text class="text-body-strong" x="14" y="22">Metadata Waterfall Providers</text>
      <text class="text-caption" x="14" y="40">TIDAL v2, Deezer, MusicBrainz ref_mb, Discogs, Last.fm</text>
    </g>
    
    <g transform="translate(20, 240)">
      <rect width="320" height="115" class="card-sources"/>
      <text class="text-body-strong" x="14" y="24" fill="#e7f3de">Unified Scraper Service (:8012)</text>
      <text class="text-caption" x="14" y="42" fill="#b5cda5">POST /scrape · Scrapy + Playwright headless engine</text>
      <rect x="14" y="56" width="292" height="45" rx="6" fill="#1b1b1b" stroke="#465d35"/>
      <text class="text-data" x="22" y="74">Contract: RawScrapePayload</text>
      <text class="text-data" x="22" y="90">Guards: No gaps in track sequence 1..N</text>
    </g>
  </g>
  
  <!-- TIER 2: PostgreSQL Medallion Core (Center Column) -->
  <g transform="translate(448, 110)" filter="url(#shadow-2)">
    <rect width="440" height="930" class="card-neutral"/>
    <text class="text-label" x="24" y="32">Storage Hub: PostgreSQL 16 Medallion Store (pgdata)</text>
    
    <!-- Bronze Layer -->
    <g transform="translate(24, 50)">
      <rect width="392" height="150" class="card-sunk"/>
      <rect x="0" y="0" width="8" height="150" fill="#c9a85c" rx="4"/>
      <text class="text-body-strong" x="20" y="28">Bronze Layer (Raw Immutable Storage)</text>
      <text class="text-caption" x="20" y="46">Unprocessed external tracklist captures preserving source positions</text>
      
      <rect x="20" y="58" width="352" height="78" rx="6" fill="#222222" stroke="#3c3c3c"/>
      <text class="text-data" x="30" y="80">TABLE: bronze_scraped_playlists</text>
      <text class="text-data" x="30" y="98">TABLE: bronze_scraped_tracks (1..N)</text>
      <text class="text-caption" x="30" y="122" fill="#5fd08f">Rule: Incomplete playlists marked failed immediately</text>
    </g>
    
    <!-- Celery Ingestion Worker Engine -->
    <g transform="translate(24, 220)">
      <rect width="392" height="130" class="card-pipeline"/>
      <text class="text-body-strong" x="16" y="26" fill="#e7f0f5">Celery Ingestion &amp; Enrichment Worker</text>
      <text class="text-caption" x="16" y="44" fill="#b6c7d1">Drains ingestion_jobs · Idempotent by key · Distributed lease</text>
      
      <rect x="16" y="54" width="360" height="62" rx="6" fill="#1b1b1b" stroke="#475861"/>
      <text class="text-data" x="26" y="74">Jobs: ingest_pending (60s) · er_shadow</text>
      <text class="text-data" x="26" y="92">Jobs: enrichment_backfill · camelot_repair</text>
    </g>
    
    <!-- Silver Layer -->
    <g transform="translate(24, 370)">
      <rect width="392" height="230" class="card-sunk"/>
      <rect x="0" y="0" width="8" height="230" fill="#9b85cb" rx="4"/>
      <text class="text-body-strong" x="20" y="28">Silver Layer (Cleaned &amp; Enriched Truth)</text>
      <text class="text-caption" x="20" y="46">Canonical entities, multi-provider evidence &amp; observed transitions</text>
      
      <rect x="20" y="58" width="352" height="156" rx="6" fill="#222222" stroke="#3c3c3c"/>
      <text class="text-data" x="30" y="80">TABLE: silver_enriched_tracks</text>
      <text class="text-data" x="30" y="98">TABLE: silver_enriched_artists</text>
      <text class="text-data" x="30" y="116">TABLE: silver_track_transitions (pos N -&gt; N+1)</text>
      <text class="text-data" x="30" y="134">TABLE: silver_track_metadata_evidence</text>
      <text class="text-data" x="30" y="152">TABLE: silver_sets &amp; entity_redirects</text>
      <text class="text-caption" x="30" y="186" fill="#5fd08f">Guards: Valid artist on both ends; no placeholder IDs</text>
    </g>
    
    <!-- Gold Projection Layer -->
    <g transform="translate(24, 620)">
      <rect width="392" height="130" class="card-sunk"/>
      <rect x="0" y="0" width="8" height="130" fill="#5fd08f" rx="4"/>
      <text class="text-body-strong" x="20" y="28">Gold Projection Layer (Denormalized Cache)</text>
      <text class="text-caption" x="20" y="46">Fast query views refreshed by projection_consume worker</text>
      
      <rect x="20" y="58" width="352" height="60" rx="6" fill="#222222" stroke="#3c3c3c"/>
      <text class="text-data" x="30" y="80">TABLE: projection_tracks (rebuildable)</text>
      <text class="text-data" x="30" y="98">VIEW: v_ready_transitions</text>
    </g>
    
    <!-- Library Overlay Schema -->
    <g transform="translate(24, 770)">
      <rect width="392" height="135" class="card-library"/>
      <text class="text-body-strong" x="16" y="26" fill="#f6eedc">Library Overlay Schema (library.*)</text>
      <text class="text-caption" x="16" y="44" fill="#d3c29f">User crate curation, rotation status, saved setlists &amp; tags</text>
      
      <rect x="16" y="56" width="360" height="66" rx="6" fill="#1b1b1b" stroke="#63532f"/>
      <text class="text-data" x="26" y="78">TABLES: library.crates, library.saved_sets</text>
      <text class="text-data" x="26" y="96">TABLES: library.appearances, library.track_tags</text>
    </g>
  </g>
  
  <!-- TIER 3: Fast Graph & In-Memory Hubs (Bottom Left) -->
  <g transform="translate(48, 520)" filter="url(#shadow-1)">
    <rect width="360" height="520" class="card-neutral"/>
    <text class="text-label" x="20" y="32">Operational Memory &amp; Graph Topology</text>
    
    <!-- Memgraph DB -->
    <g transform="translate(20, 50)">
      <rect width="320" height="200" class="card-graph"/>
      <text class="text-body-strong" x="14" y="26" fill="#e2f0fe">Memgraph Graph Database (:7687 Bolt)</text>
      <text class="text-caption" x="14" y="44" fill="#acc8e3">In-memory Cypher engine for transition traversals</text>
      
      <rect x="14" y="56" width="292" height="130" rx="6" fill="#1b1b1b" stroke="#3d5872"/>
      <text class="text-data" x="24" y="78">Node: (:Track {id, bpm, camelot, energy})</text>
      <text class="text-data" x="24" y="96">Edge: [:TRANSITIONS_TO {occurrences, w}]</text>
      <text class="text-data" x="24" y="120">Query: shortestPath((a)-[*]-(b))</text>
      <text class="text-data" x="24" y="138">Sub-50ms wave-shaped harmonic routing</text>
      <text class="text-data-strong" x="24" y="162">Sync: Batched from Silver Transitions</text>
    </g>
    
    <!-- Redis Cache & Broker -->
    <g transform="translate(20, 270)">
      <rect width="320" height="225" class="card-sunk"/>
      <text class="text-body-strong" x="14" y="26">Redis 7.2 Broker &amp; Cache (:6379)</text>
      <text class="text-caption" x="14" y="44">Task queuing, rate limits, lock leases &amp; telemetry</text>
      
      <rect x="14" y="56" width="292" height="152" rx="6" fill="#222222" stroke="#3c3c3c"/>
      <text class="text-data" x="24" y="78">Celery Broker Queue: celery</text>
      <text class="text-data" x="24" y="96">Worker Leases: job_leases:* (TTL)</text>
      <text class="text-data" x="24" y="114">Scraper Window Telemetry: scraper_window:*</text>
      <text class="text-data" x="24" y="132">Rate Limits: rate_limit:tidal:*</text>
      <text class="text-data" x="24" y="150">FastAPI Cached Queries: cache:library:*</text>
      <text class="text-caption" x="24" y="186" fill="#bbbbbb">Guards: Atomic lock acquisition; auto-expiry</text>
    </g>
  </g>
  
  <!-- TIER 4: FastAPI REST API & Application Layer (Right Center) -->
  <g transform="translate(928, 110)" filter="url(#shadow-2)">
    <rect width="400" height="930" class="card-neutral"/>
    <text class="text-label" x="24" y="32">Application Services: FastAPI REST API (:8082)</text>
    
    <!-- REST Core Routers -->
    <g transform="translate(20, 50)">
      <rect width="360" height="420" class="card-sunk"/>
      <text class="text-body-strong" x="16" y="26">Modular Router Registry (G3 Pattern)</text>
      <text class="text-caption" x="16" y="44">Discovered by router_registry · Self-registering endpoints</text>
      
      <g transform="translate(16, 56)">
        <rect width="328" height="50" class="card-library"/>
        <text class="text-body-strong" x="12" y="20" fill="#f6eedc">library_search &amp; catalog_reads</text>
        <text class="text-data" x="12" y="38">GET /api/v1/library/search | /tracks</text>
      </g>
      
      <g transform="translate(16, 114)">
        <rect width="328" height="50" class="card-sets"/>
        <text class="text-body-strong" x="12" y="20" fill="#feeae0">tidal_playlists &amp; spotify_playlists</text>
        <text class="text-data" x="12" y="38">POST /api/v1/tidal/sets/send</text>
      </g>
      
      <g transform="translate(16, 172)">
        <rect width="328" height="50" class="card-paths"/>
        <text class="text-body-strong" x="12" y="20" fill="#fee7f2">pathfinder &amp; datalayer</text>
        <text class="text-data" x="12" y="38">POST /api/v1/pathfinder/find-path</text>
      </g>
      
      <g transform="translate(16, 230)">
        <rect width="328" height="50" class="card-sources"/>
        <text class="text-body-strong" x="12" y="20" fill="#e7f3de">target_tracks &amp; catalog_writes</text>
        <text class="text-data" x="12" y="38">POST /api/v1/tracks/import-tracklist</text>
      </g>
      
      <g transform="translate(16, 288)">
        <rect width="328" height="50" class="card-pipeline"/>
        <text class="text-body-strong" x="12" y="20" fill="#e7f0f5">jobs &amp; scrape_window</text>
        <text class="text-data" x="12" y="38">GET /api/v1/jobs | /scrape/window</text>
      </g>
      
      <g transform="translate(16, 346)">
        <rect width="328" height="50" class="card-services"/>
        <text class="text-body-strong" x="12" y="20" fill="#f0efe5">music_auth &amp; api_keys (SEC6)</text>
        <text class="text-data" x="12" y="38">OAuth token exchange · Encrypted keys</text>
      </g>
    </g>
    
    <!-- Companion Microservices -->
    <g transform="translate(20, 490)">
      <rect width="360" height="420" class="card-sunk"/>
      <text class="text-body-strong" x="16" y="26">Internal Engine &amp; Worker Services</text>
      <text class="text-caption" x="16" y="44">Specialised backend capabilities running in container network</text>
      
      <g transform="translate(16, 60)">
        <rect width="328" height="100" class="card-neutral"/>
        <text class="text-body-strong" x="12" y="22">Metadata Enrichment Service (:8081)</text>
        <text class="text-caption" x="12" y="40">Waterfall logic with strict consensus scoring</text>
        <text class="text-data" x="12" y="62">Evidence: snapshotted per provider</text>
        <text class="text-data" x="12" y="80">Rule: Unknown stays unknown (no BPM 0)</text>
      </g>
      
      <g transform="translate(16, 175)">
        <rect width="328" height="100" class="card-neutral"/>
        <text class="text-body-strong" x="12" y="22">Graph Projection Service</text>
        <text class="text-caption" x="12" y="40">Silver-to-Gold and Silver-to-Memgraph projection</text>
        <text class="text-data" x="12" y="62">Polls outbox events every 15 seconds</text>
        <text class="text-data" x="12" y="80">Computes transition weights &amp; cuts</text>
      </g>
      
      <g transform="translate(16, 290)">
        <rect width="328" height="110" class="card-neutral"/>
        <text class="text-body-strong" x="12" y="22">Reference Data &amp; Entity Resolver</text>
        <text class="text-caption" x="12" y="40">Consolidated under services/reference_data/</text>
        <text class="text-data" x="12" y="62">ref_mb: SQLite mirror of MusicBrainz</text>
        <text class="text-data" x="12" y="80">ISRC matching · Reversible merges</text>
        <text class="text-data" x="12" y="98">Legacy ID redirection preservation</text>
      </g>
    </g>
  </g>
  
  <!-- TIER 5: Frontend Web Application & Sister Project (Far Right) -->
  <g transform="translate(1368, 110)" filter="url(#shadow-1)">
    <rect width="384" height="930" class="card-neutral"/>
    <text class="text-label" x="20" y="32">Client Interfaces &amp; musicLibrary</text>
    
    <!-- React Frontend Pages -->
    <g transform="translate(20, 50)">
      <rect width="344" height="470" class="card-sunk"/>
      <text class="text-body-strong" x="16" y="26">SongNodes React App (Vite + TS)</text>
      <text class="text-caption" x="16" y="44">Single Design System source of truth · AppShell</text>
      
      <g transform="translate(14, 56)">
        <rect width="316" height="42" class="card-library"/>
        <text class="text-body-strong" x="10" y="20" fill="#f6eedc">/library · LibraryPage.tsx</text>
        <text class="text-caption" x="10" y="35" fill="#d3c29f">Crate filter · Audio preview · Set Target</text>
      </g>
      
      <g transform="translate(14, 106)">
        <rect width="316" height="42" class="card-sets"/>
        <text class="text-body-strong" x="10" y="20" fill="#feeae0">/sets · SetBuilderPage.tsx</text>
        <text class="text-caption" x="10" y="35" fill="#e6b9a4">Wave curve · Camelot compat · Send to TIDAL</text>
      </g>
      
      <g transform="translate(14, 156)">
        <rect width="316" height="42" class="card-paths"/>
        <text class="text-body-strong" x="10" y="20" fill="#fee7f2">/paths · PathfinderPage.tsx</text>
        <text class="text-caption" x="10" y="35" fill="#e3b5cb">Harmonic stepping stones · Graph query</text>
      </g>
      
      <g transform="translate(14, 206)">
        <rect width="316" height="42" class="card-sources"/>
        <text class="text-body-strong" x="10" y="20" fill="#e7f3de">/sources/targets &amp; /sources/import</text>
        <text class="text-caption" x="10" y="35" fill="#b5cda5">Target tracks queue · AI OCR parser</text>
      </g>
      
      <g transform="translate(14, 256)">
        <rect width="316" height="42" class="card-pipeline"/>
        <text class="text-body-strong" x="10" y="20" fill="#e7f0f5">/pipeline · ScraperProgressPage.tsx</text>
        <text class="text-caption" x="10" y="35" fill="#b6c7d1">Scraper telemetry · Dead-letter retry</text>
      </g>
      
      <g transform="translate(14, 306)">
        <rect width="316" height="42" class="card-services"/>
        <text class="text-body-strong" x="10" y="20" fill="#f0efe5">/settings · SettingsPage.tsx</text>
        <text class="text-caption" x="10" y="35" fill="#c7c5b2">OAuth callbacks · Encrypted API tokens</text>
      </g>
      
      <!-- Client Storage -->
      <g transform="translate(14, 360)">
        <rect width="316" height="95" rx="8" fill="#1b1b1b" stroke="#3c3c3c"/>
        <text class="text-body-strong" x="12" y="20">Browser Storage &amp; Exports</text>
        <text class="text-data" x="12" y="40">localStorage: songnodes_saved_sets</text>
        <text class="text-data" x="12" y="58">localStorage: songnodes_theme</text>
        <text class="text-data" x="12" y="78">Exports: CSV (OWASP guard) | M3U | Print</text>
      </g>
    </g>
    
    <!-- Sister Project: musicLibrary (Bottom Right) -->
    <g transform="translate(20, 540)">
      <rect width="344" height="370" class="card-library"/>
      <text class="text-body-strong" x="16" y="26" fill="#f6eedc">Sister Project: musicLibrary</text>
      <text class="text-caption" x="16" y="44" fill="#d3c29f">e:\\musicLibrary · Melbourne Club DJ Pipeline</text>
      
      <rect x="16" y="56" width="312" height="65" rx="6" fill="#1b1b1b" stroke="#63532f"/>
      <text class="text-body-strong" x="12" y="20" fill="#f6eedc">pipeline/run_weekly.py</text>
      <text class="text-caption" x="12" y="36" fill="#bbbbbb">Sunday 7:37am scheduled pipeline run</text>
      <text class="text-data" x="12" y="54">scrape -&gt; resolve -&gt; process -&gt; db</text>
      
      <rect x="16" y="130" width="312" height="65" rx="6" fill="#1b1b1b" stroke="#63532f"/>
      <text class="text-body-strong" x="12" y="20" fill="#f6eedc">db/dj_library.sqlite</text>
      <text class="text-caption" x="12" y="36" fill="#bbbbbb">Tracks, appearances, crates, rotation</text>
      <text class="text-data" x="12" y="54">Outputs: library.json, crates/*.csv</text>
      
      <rect x="16" y="205" width="312" height="65" rx="6" fill="#1b1b1b" stroke="#63532f"/>
      <text class="text-body-strong" x="12" y="20" fill="#f6eedc">Rekordbox XML &amp; TIDAL Sync</text>
      <text class="text-caption" x="12" y="36" fill="#bbbbbb">outputs/rekordbox_musicLibrary.xml</text>
      <text class="text-data" x="12" y="54">TIDAL Playlists: 01_HighRot_*, SET · *</text>
      
      <rect x="16" y="280" width="312" height="75" rx="6" fill="#1b1b1b" stroke="#63532f"/>
      <text class="text-body-strong" x="12" y="20" fill="#f6eedc">Naarm Set Builder (Artifact)</text>
      <text class="text-caption" x="12" y="36" fill="#bbbbbb">artifact/index.html · Standalone selector</text>
      <text class="text-data" x="12" y="54">Bridge: sync-music-library.sh</text>
      <text class="text-caption" x="12" y="68" fill="#5fd08f">Design System aligned v1.4.0</text>
    </g>
  </g>
  
  <!-- DATA FLOW EDGES & LABELS -->
  <!-- Edge: Scrapers -> Bronze -->
  <path d="M 408 400 L 472 200" class="edge-active" marker-end="url(#arrow-brand)"/>
  <rect x="400" y="280" width="130" height="24" rx="4" fill="#1b1b1b" stroke="#3c3c3c"/>
  <text class="text-data" x="406" y="296">SQL Ingestion</text>

  <!-- Edge: Bronze -> Celery Worker -->
  <path d="M 640 200 L 640 220" class="edge-active" marker-end="url(#arrow-brand)"/>

  <!-- Edge: Celery Worker -> Silver -->
  <path d="M 640 350 L 640 370" class="edge-active" marker-end="url(#arrow-brand)"/>

  <!-- Edge: Silver -> Enrichment -->
  <path d="M 840 450 L 948 550" class="edge" marker-end="url(#arrow)"/>
  <rect x="850" y="480" width="120" height="24" rx="4" fill="#1b1b1b" stroke="#3c3c3c"/>
  <text class="text-data" x="856" y="496">Enrichment Task</text>

  <!-- Edge: Silver -> Gold Projection -->
  <path d="M 640 600 L 640 620" class="edge-data" marker-end="url(#arrow-ok)"/>

  <!-- Edge: Silver -> Memgraph -->
  <path d="M 472 520 L 380 570" class="edge-active" marker-end="url(#arrow-brand)"/>
  <rect x="360" y="530" width="130" height="24" rx="4" fill="#1b1b1b" stroke="#3c3c3c"/>
  <text class="text-data" x="366" y="546">Bolt Cypher Sync</text>

  <!-- Edge: Gold / Silver -> REST API -->
  <path d="M 840 680 L 928 250" class="edge-active" marker-end="url(#arrow-brand)"/>
  <rect x="850" y="320" width="120" height="24" rx="4" fill="#1b1b1b" stroke="#3c3c3c"/>
  <text class="text-data" x="856" y="336">asyncpg pool</text>

  <!-- Edge: REST API -> React Frontend -->
  <path d="M 1328 200 L 1368 200" class="edge-data" marker-end="url(#arrow-ok)"/>
  <rect x="1310" y="170" width="80" height="22" rx="4" fill="#1b1b1b" stroke="#3c3c3c"/>
  <text class="text-data" x="1316" y="185">HTTP JSON</text>

  <!-- Edge: musicLibrary -> Rekordbox / SongNodes -->
  <path d="M 1540 540 L 1540 520" class="edge-data" marker-end="url(#arrow-ok)"/>
  
  <!-- Formal Legend Footer -->
  <g transform="translate(48, 1045)">
    <rect width="1704" height="42" class="card-sunk"/>
    <text class="text-label" x="20" y="26">Legend &amp; Architectural Conventions:</text>
    
    <circle cx="340" cy="21" r="6" fill="#9b85cb"/>
    <text class="text-caption" x="354" y="25">Silver Truth Layer</text>
    
    <circle cx="500" cy="21" r="6" fill="#5fd08f"/>
    <text class="text-caption" x="514" y="25">Verified Transition Edge</text>
    
    <circle cx="680" cy="21" r="6" fill="#c9a85c"/>
    <text class="text-caption" x="694" y="25">Curated Library &amp; Crates</text>
    
    <circle cx="860" cy="21" r="6" fill="#6fa8dc"/>
    <text class="text-caption" x="874" y="25">Memgraph Graph Topology</text>
    
    <circle cx="1060" cy="21" r="6" fill="#e08a5f"/>
    <text class="text-caption" x="1074" y="25">Setlist Waveform</text>
    
    <line x1="1220" y1="21" x2="1260" y2="21" stroke="#9b85cb" stroke-width="2.5"/>
    <text class="text-caption" x="1270" y="25">Internal Service Contract</text>
    
    <line x1="1440" y1="21" x2="1480" y2="21" stroke="#5fd08f" stroke-width="2"/>
    <text class="text-caption" x="1490" y="25">Client / Synchronised Feed</text>
  </g>
</svg>
"""
    with open(f"{SVG_DIR}/system-architecture-data-flow.svg", "w", encoding="utf-8") as f:
        f.write(svg)
    print("Wrote system-architecture-data-flow.svg")


# 2. User Journey & Operational Flow (Swimlanes per Persona)
def generate_user_journey():
    svg = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1800 1100" width="100%" height="100%">
  <title>SongNodes: Persona Operational Journeys &amp; Data Handoffs</title>
  <rect width="1800" height="1100" class="bg"/>
  {SVG_COMMON_DEFS}
  
  <!-- Header Banner -->
  <g transform="translate(48, 48)">
    <text class="text-title" font-size="28"><tspan class="text-lead">Operational Journeys:</tspan> Persona Swimlanes, Step Cards &amp; Data Handoffs</text>
    <text class="text-body-muted" y="28">Step-by-step progressions across DJ Selector, Track Librarian, Scraper Pipeline Engineer, Entity Resolution Specialist, and Platform Admin</text>
  </g>

  <!-- SWIMLANE 1: Performing DJ / Selector -->
  <g transform="translate(48, 110)">
    <rect width="1704" height="170" class="card-neutral"/>
    <rect x="0" y="0" width="12" height="170" fill="#e08a5f" rx="6"/>
    
    <g transform="translate(24, 28)">
      <text class="text-body-strong" font-size="16" fill="#feeae0">Persona 1: Performing DJ / Selector</text>
      <text class="text-caption">Objective: Construct wave-shaped harmonic sets with proven transitions, export to Rekordbox &amp; TIDAL</text>
    </g>
    
    <!-- Steps -->
    <g transform="translate(300, 20)">
      <rect width="240" height="130" class="card-sunk"/>
      <text class="text-label" x="12" y="22">Step 1 · /library</text>
      <text class="text-body-strong" x="12" y="44">Crate Exploration</text>
      <text class="text-caption" x="12" y="62">Filter by High Rotation &amp; Energy 5-7</text>
      <text class="text-data" x="12" y="86">Data: Audition 30s preview</text>
      <text class="text-caption" x="12" y="106" fill="#5fd08f">Trigger: Click 'Add to Set'</text>
    </g>
    
    <path d="M 545 85 L 575 85" class="edge-active" marker-end="url(#arrow-brand)"/>
    
    <g transform="translate(580, 20)">
      <rect width="240" height="130" class="card-sets"/>
      <text class="text-label" x="12" y="22" fill="#feeae0">Step 2 · /sets</text>
      <text class="text-body-strong" x="12" y="44" fill="#feeae0">Harmonic Wave Sequencing</text>
      <text class="text-caption" x="12" y="62" fill="#e6b9a4">Drag track into Slot N; inspect Camelot</text>
      <text class="text-data" x="12" y="86">Data: SN.compat (+1 key, +2 BPM)</text>
      <text class="text-caption" x="12" y="106" fill="#5fd08f">Trigger: Detect harmonic gap</text>
    </g>
    
    <path d="M 825 85 L 855 85" class="edge-active" marker-end="url(#arrow-brand)"/>
    
    <g transform="translate(860, 20)">
      <rect width="240" height="130" class="card-paths"/>
      <text class="text-label" x="12" y="22" fill="#fee7f2">Step 3 · /paths</text>
      <text class="text-body-strong" x="12" y="44" fill="#fee7f2">Transition Route Finder</text>
      <text class="text-caption" x="12" y="62" fill="#e3b5cb">Query Memgraph for 2-hop harmonic bridge</text>
      <text class="text-data" x="12" y="86">Data: POST /api/v1/pathfinder</text>
      <text class="text-caption" x="12" y="106" fill="#5fd08f">Trigger: Accept path -&gt; Sets</text>
    </g>
    
    <path d="M 1105 85 L 1135 85" class="edge-active" marker-end="url(#arrow-brand)"/>
    
    <g transform="translate(1140, 20)">
      <rect width="240" height="130" class="card-sunk"/>
      <text class="text-label" x="12" y="22">Step 4 · /sets (Export)</text>
      <text class="text-body-strong" x="12" y="44">Export &amp; Gig Delivery</text>
      <text class="text-caption" x="12" y="62">Export Rekordbox XML &amp; push TIDAL</text>
      <text class="text-data" x="12" y="86">Handoff: POST /api/v1/tidal/sets/send</text>
      <text class="text-caption" x="12" y="106" fill="#5fd08f">Trigger: 'Send to TIDAL' toggle</text>
    </g>
    
    <path d="M 1385 85 L 1415 85" class="edge-data" marker-end="url(#arrow-ok)"/>
    
    <g transform="translate(1420, 20)">
      <rect width="260" height="130" class="card-library"/>
      <text class="text-label" x="12" y="22" fill="#f6eedc">Step 5 · Floor Performance</text>
      <text class="text-body-strong" x="12" y="44" fill="#f6eedc">Booth Playback on CDJs</text>
      <text class="text-caption" x="12" y="62" fill="#d3c29f">Load setlist from USB; execute transitions</text>
      <text class="text-data" x="12" y="86">Output: Pioneer HISTORY.m3u8</text>
      <text class="text-caption" x="12" y="106" fill="#efb54a">Failure: Manual set drift at gig</text>
    </g>
  </g>

  <!-- SWIMLANE 2: Music Curator / Track Librarian -->
  <g transform="translate(48, 295)">
    <rect width="1704" height="170" class="card-neutral"/>
    <rect x="0" y="0" width="12" height="170" fill="#c9a85c" rx="6"/>
    
    <g transform="translate(24, 28)">
      <text class="text-body-strong" font-size="16" fill="#f6eedc">Persona 2: Music Curator</text>
      <text class="text-caption">Objective: Maintain metadata integrity, calibrate energy priors, and resolve review queues</text>
    </g>
    
    <!-- Steps -->
    <g transform="translate(300, 20)">
      <rect width="240" height="130" class="card-sunk"/>
      <text class="text-label" x="12" y="22">Step 1 · /library</text>
      <text class="text-body-strong" x="12" y="44">Audit Uncalibrated Tracks</text>
      <text class="text-caption" x="12" y="62">Filter by 'Needs Review' or BPM gap</text>
      <text class="text-data" x="12" y="86">Data: Competing provider evidence</text>
      <text class="text-caption" x="12" y="106" fill="#5fd08f">Trigger: Inspect track detail</text>
    </g>
    
    <path d="M 545 85 L 575 85" class="edge-active" marker-end="url(#arrow-brand)"/>
    
    <g transform="translate(580, 20)">
      <rect width="240" height="130" class="card-harmony"/>
      <text class="text-label" x="12" y="22" fill="#dff4f1">Step 2 · /harmony</text>
      <text class="text-body-strong" x="12" y="44" fill="#dff4f1">Camelot Key Audit</text>
      <text class="text-caption" x="12" y="62" fill="#a5cec9">Cross-reference pitch with Camelot wheel</text>
      <text class="text-data" x="12" y="86">Data: SN.camelot(rawKey)</text>
      <text class="text-caption" x="12" y="106" fill="#5fd08f">Trigger: Validate harmonic code</text>
    </g>
    
    <path d="M 825 85 L 855 85" class="edge-active" marker-end="url(#arrow-brand)"/>
    
    <g transform="translate(860, 20)">
      <rect width="240" height="130" class="card-sunk"/>
      <text class="text-label" x="12" y="22">Step 3 · Ledger Override</text>
      <text class="text-body-strong" x="12" y="44">Commit Energy Override</text>
      <text class="text-caption" x="12" y="62">Write verified rating to overrides.csv</text>
      <text class="text-data" x="12" y="86">File: energy_overrides.csv</text>
      <text class="text-caption" x="12" y="106" fill="#5fd08f">Trigger: Save override</text>
    </g>
    
    <path d="M 1105 85 L 1135 85" class="edge-active" marker-end="url(#arrow-brand)"/>
    
    <g transform="translate(1140, 20)">
      <rect width="240" height="130" class="card-sources"/>
      <text class="text-label" x="12" y="22" fill="#e7f3de">Step 4 · /sources/targets</text>
      <text class="text-body-strong" x="12" y="44" fill="#e7f3de">Promote Scraper Targets</text>
      <text class="text-caption" x="12" y="62" fill="#b5cda5">Elevate artist to high-priority spider queue</text>
      <text class="text-data" x="12" y="86">Data: POST /api/v1/target-tracks</text>
      <text class="text-caption" x="12" y="106" fill="#5fd08f">Trigger: 'Set Target' button</text>
    </g>
    
    <path d="M 1385 85 L 1415 85" class="edge-data" marker-end="url(#arrow-ok)"/>
    
    <g transform="translate(1420, 20)">
      <rect width="260" height="130" class="card-sunk"/>
      <text class="text-label" x="12" y="22">Step 5 · Rotation Reconcile</text>
      <text class="text-body-strong" x="12" y="44">High/Standard/Archive Run</text>
      <text class="text-caption" x="12" y="62">Run weekly calibrate.py &amp; db rebuild</text>
      <text class="text-data" x="12" y="86">Output: dj_library.sqlite updated</text>
      <text class="text-caption" x="12" y="106" fill="#5fd08f">Outcome: Crates updated for weekend</text>
    </g>
  </g>

  <!-- SWIMLANE 3: Data Pipeline & Scraper Engineer -->
  <g transform="translate(48, 480)">
    <rect width="1704" height="170" class="card-neutral"/>
    <rect x="0" y="0" width="12" height="170" fill="#7fa1b3" rx="6"/>
    
    <g transform="translate(24, 28)">
      <text class="text-body-strong" font-size="16" fill="#e7f0f5">Persona 3: Scraper &amp; Pipeline Engineer</text>
      <text class="text-caption">Objective: Maintain scraper fleet uptime, monitor Celery queues, revive DLQ, enforce 1..N order</text>
    </g>
    
    <!-- Steps -->
    <g transform="translate(300, 20)">
      <rect width="240" height="130" class="card-pipeline"/>
      <text class="text-label" x="12" y="22" fill="#e7f0f5">Step 1 · /pipeline</text>
      <text class="text-body-strong" x="12" y="44" fill="#e7f0f5">Telemetry Inspection</text>
      <text class="text-caption" x="12" y="62" fill="#b6c7d1">Review ScrapeWindow status &amp; active jobs</text>
      <text class="text-data" x="12" y="86">Data: GET /api/v1/jobs</text>
      <text class="text-caption" x="12" y="106" fill="#efb54a">Trigger: DLQ count alert (&gt;0)</text>
    </g>
    
    <path d="M 545 85 L 575 85" class="edge-active" marker-end="url(#arrow-brand)"/>
    
    <g transform="translate(580, 20)">
      <rect width="240" height="130" class="card-sunk"/>
      <text class="text-label" x="12" y="22">Step 2 · /pipeline (DLQ)</text>
      <text class="text-body-strong" x="12" y="44">Dead-Letter Diagnostics</text>
      <text class="text-caption" x="12" y="62">Inspect trace (Cloudflare challenge / gap)</text>
      <text class="text-data" x="12" y="86">Data: GET /api/v1/jobs/{{id}}/stages</text>
      <text class="text-caption" x="12" y="106" fill="#5fd08f">Trigger: Click 'Revive / Retry'</text>
    </g>
    
    <path d="M 825 85 L 855 85" class="edge-active" marker-end="url(#arrow-brand)"/>
    
    <g transform="translate(860, 20)">
      <rect width="240" height="130" class="card-sources"/>
      <text class="text-label" x="12" y="22" fill="#e7f3de">Step 3 · /sources/import</text>
      <text class="text-body-strong" x="12" y="44" fill="#e7f3de">Manual Fallback Ingest</text>
      <text class="text-caption" x="12" y="62" fill="#b5cda5">Paste raw tracklist; enforce 1..N order</text>
      <text class="text-data" x="12" y="86">Data: POST /tracks/import-tracklist</text>
      <text class="text-caption" x="12" y="106" fill="#5fd08f">Trigger: Commit import</text>
    </g>
    
    <path d="M 1105 85 L 1135 85" class="edge-active" marker-end="url(#arrow-brand)"/>
    
    <g transform="translate(1140, 20)">
      <rect width="240" height="130" class="card-sunk"/>
      <text class="text-label" x="12" y="22">Step 4 · Bronze to Silver</text>
      <text class="text-body-strong" x="12" y="44">Ingestion Execution</text>
      <text class="text-caption" x="12" y="62">Celery worker commits silver transitions</text>
      <text class="text-data" x="12" y="86">Contract: Completeness guard check</text>
      <text class="text-caption" x="12" y="106" fill="#5fd08f">Trigger: Auto enqueue projection</text>
    </g>
    
    <path d="M 1385 85 L 1415 85" class="edge-data" marker-end="url(#arrow-ok)"/>
    
    <g transform="translate(1420, 20)">
      <rect width="260" height="130" class="card-sunk"/>
      <text class="text-label" x="12" y="22">Step 5 · Outbox Verification</text>
      <text class="text-body-strong" x="12" y="44">Lag &amp; Reconcile Check</text>
      <text class="text-caption" x="12" y="62">Verify consumer lag = 0s on /outbox</text>
      <text class="text-data" x="12" y="86">Data: GET /api/v1/outbox/status</text>
      <text class="text-caption" x="12" y="106" fill="#5fd08f">Outcome: Projection healthy</text>
    </g>
  </g>

  <!-- SWIMLANE 4: Entity Resolution Specialist -->
  <g transform="translate(48, 665)">
    <rect width="1704" height="170" class="card-neutral"/>
    <rect x="0" y="0" width="12" height="170" fill="#9b85cb" rx="6"/>
    
    <g transform="translate(24, 28)">
      <text class="text-body-strong" font-size="16" fill="#b4a2dc">Persona 4: Entity Resolution Specialist</text>
      <text class="text-caption">Objective: Reconcile duplicate artists and tracks across providers without breaking historical links</text>
    </g>
    
    <!-- Steps -->
    <g transform="translate(300, 20)">
      <rect width="240" height="130" class="card-services"/>
      <text class="text-label" x="12" y="22" fill="#f0efe5">Step 1 · /settings</text>
      <text class="text-body-strong" x="12" y="44" fill="#f0efe5">API Credentials Audit</text>
      <text class="text-caption" x="12" y="62" fill="#c7c5b2">Verify MusicBrainz, Discogs, TIDAL keys</text>
      <text class="text-data" x="12" y="86">Data: GET /api/v1/api-keys</text>
      <text class="text-caption" x="12" y="106" fill="#5fd08f">Trigger: Credentials nominal</text>
    </g>
    
    <path d="M 545 85 L 575 85" class="edge-active" marker-end="url(#arrow-brand)"/>
    
    <g transform="translate(580, 20)">
      <rect width="240" height="130" class="card-sunk"/>
      <text class="text-label" x="12" y="22">Step 2 · /metadata/review</text>
      <text class="text-body-strong" x="12" y="44">Review Queue Audit</text>
      <text class="text-caption" x="12" y="62">Inspect conflicting provider snapshots</text>
      <text class="text-data" x="12" y="86">Data: bpm_conflict, key_near</text>
      <text class="text-caption" x="12" y="106" fill="#5fd08f">Trigger: Evaluate shadow pairs</text>
    </g>
    
    <path d="M 825 85 L 855 85" class="edge-active" marker-end="url(#arrow-brand)"/>
    
    <g transform="translate(860, 20)">
      <rect width="240" height="130" class="card-sunk"/>
      <text class="text-label" x="12" y="22">Step 3 · Reversible Merge</text>
      <text class="text-body-strong" x="12" y="44">Execute Entity Merge</text>
      <text class="text-caption" x="12" y="62">Consolidate aliases into canonical ID</text>
      <text class="text-data" x="12" y="86">Data: POST /tracks/{{id}}/merge</text>
      <text class="text-caption" x="12" y="106" fill="#5fd08f">Trigger: Write entity_redirects</text>
    </g>
    
    <path d="M 1105 85 L 1135 85" class="edge-active" marker-end="url(#arrow-brand)"/>
    
    <g transform="translate(1140, 20)">
      <rect width="240" height="130" class="card-sunk"/>
      <text class="text-label" x="12" y="22">Step 4 · Verification</text>
      <text class="text-body-strong" x="12" y="44">Redirect Persistence</text>
      <text class="text-caption" x="12" y="62">Verify old ID resolves to canonical</text>
      <text class="text-data" x="12" y="86">Data: GET /tracks/{{oldId}}/canonical</text>
      <text class="text-caption" x="12" y="106" fill="#5fd08f">Trigger: Confirm clean redirect</text>
    </g>
    
    <path d="M 1385 85 L 1415 85" class="edge-data" marker-end="url(#arrow-ok)"/>
    
    <g transform="translate(1420, 20)">
      <rect width="260" height="130" class="card-sunk"/>
      <text class="text-label" x="12" y="22">Step 5 · Projection Push</text>
      <text class="text-body-strong" x="12" y="44">Rebuild Gold Cache</text>
      <text class="text-caption" x="12" y="62">Propagate canonical ID to Memgraph</text>
      <text class="text-data" x="12" y="86">Task: projection_rebuild</text>
      <text class="text-caption" x="12" y="106" fill="#5fd08f">Outcome: Graph entities synced</text>
    </g>
  </g>

  <!-- SWIMLANE 5: Platform & Infrastructure Admin -->
  <g transform="translate(48, 850)">
    <rect width="1704" height="170" class="card-neutral"/>
    <rect x="0" y="0" width="12" height="170" fill="#a5a07b" rx="6"/>
    
    <g transform="translate(24, 28)">
      <text class="text-body-strong" font-size="16" fill="#f0efe5">Persona 5: Platform Administrator</text>
      <text class="text-caption">Objective: Maintain container stack uptime, verify schema migrations, manage volume backups</text>
    </g>
    
    <!-- Steps -->
    <g transform="translate(300, 20)">
      <rect width="240" height="130" class="card-services"/>
      <text class="text-label" x="12" y="22" fill="#f0efe5">Step 1 · /settings</text>
      <text class="text-body-strong" x="12" y="44" fill="#f0efe5">Health Matrix Check</text>
      <text class="text-caption" x="12" y="62" fill="#c7c5b2">Verify DB, Redis, Celery &amp; Scraper</text>
      <text class="text-data" x="12" y="86">Data: GET /health</text>
      <text class="text-caption" x="12" y="106" fill="#5fd08f">Trigger: Morning platform patrol</text>
    </g>
    
    <path d="M 545 85 L 575 85" class="edge-active" marker-end="url(#arrow-brand)"/>
    
    <g transform="translate(580, 20)">
      <rect width="240" height="130" class="card-pipeline"/>
      <text class="text-label" x="12" y="22" fill="#e7f0f5">Step 2 · /pipeline</text>
      <text class="text-body-strong" x="12" y="44" fill="#e7f0f5">Queue Latency Inspection</text>
      <text class="text-caption" x="12" y="62" fill="#b6c7d1">Check Redis broker depths &amp; active leases</text>
      <text class="text-data" x="12" y="86">Data: Redis keys celery</text>
      <text class="text-caption" x="12" y="106" fill="#5fd08f">Trigger: Concurrency within budget</text>
    </g>
    
    <path d="M 825 85 L 855 85" class="edge-active" marker-end="url(#arrow-brand)"/>
    
    <g transform="translate(860, 20)">
      <rect width="240" height="130" class="card-sunk"/>
      <text class="text-label" x="12" y="22">Step 3 · Docker CLI</text>
      <text class="text-body-strong" x="12" y="44">Volume &amp; Resource Audit</text>
      <text class="text-caption" x="12" y="62">Inspect disk allocation on E:\\DockerData</text>
      <text class="text-data" x="12" y="86">Command: docker compose ps</text>
      <text class="text-caption" x="12" y="106" fill="#5fd08f">Trigger: Storage verified</text>
    </g>
    
    <path d="M 1105 85 L 1135 85" class="edge-active" marker-end="url(#arrow-brand)"/>
    
    <g transform="translate(1140, 20)">
      <rect width="240" height="130" class="card-sunk"/>
      <text class="text-label" x="12" y="22">Step 4 · Schema Migrations</text>
      <text class="text-body-strong" x="12" y="44">PostgreSQL DDL Audit</text>
      <text class="text-caption" x="12" y="62">Verify all 280+ migrations applied</text>
      <text class="text-data" x="12" y="86">Command: python migrate.py --check</text>
      <text class="text-caption" x="12" y="106" fill="#5fd08f">Trigger: All tables consistent</text>
    </g>
    
    <path d="M 1385 85 L 1415 85" class="edge-data" marker-end="url(#arrow-ok)"/>
    
    <g transform="translate(1420, 20)">
      <rect width="260" height="130" class="card-sunk"/>
      <text class="text-label" x="12" y="22">Step 5 · Backup &amp; Recovery</text>
      <text class="text-body-strong" x="12" y="44">Automated Volume Snapshot</text>
      <text class="text-caption" x="12" y="62">Execute backup_volumes.sh to cold disk</text>
      <text class="text-data" x="12" y="86">File: backup_volumes.sh</text>
      <text class="text-caption" x="12" y="106" fill="#5fd08f">Outcome: Safe recovery baseline</text>
    </g>
  </g>

  <!-- Traceability Footer -->
  <g transform="translate(48, 1045)">
    <rect width="1704" height="42" class="card-sunk"/>
    <text class="text-caption" x="20" y="26">SongNodes Operational Flow · 5 Personas · 25 Structured Step Cards · Verified against repo routes and scripts · Australia/Melbourne</text>
  </g>
</svg>
"""
    with open(f"{SVG_DIR}/user-journey-operational-flow.svg", "w", encoding="utf-8") as f:
        f.write(svg)
    print("Wrote user-journey-operational-flow.svg")


# 3. Production Execution Closed-Loop Architecture
def generate_closed_loop():
    svg = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1800 1100" width="100%" height="100%">
  <title>SongNodes: Production Execution Closed-Loop Architecture</title>
  <rect width="1800" height="1100" class="bg"/>
  {SVG_COMMON_DEFS}
  
  <!-- Header Banner -->
  <g transform="translate(48, 48)">
    <text class="text-title" font-size="28"><tspan class="text-lead">Closed-Loop Architecture:</tspan> Demand Ingestion to Floor Execution &amp; Feedback</text>
    <text class="text-body-muted" y="28">Complete industrial DJ curation cycle: Demand Ingestion -&gt; Scheduling -&gt; Normalisation -&gt; Graph Projection -&gt; Floor Execution -&gt; Reconciliation</text>
  </g>
  
  <!-- Center Core Wheel Structure -->
  <!-- Stage 1: Demand Ingestion & Target Discovery (Top Left) -->
  <g transform="translate(100, 120)" filter="url(#shadow-1)">
    <rect width="480" height="250" class="card-sources"/>
    <rect x="0" y="0" width="10" height="250" fill="#8fbf6b" rx="5"/>
    <text class="text-label" x="24" y="32" fill="#e7f3de">STAGE 1: Demand Ingestion &amp; Target Queue</text>
    <text class="text-body-strong" x="24" y="60" font-size="16" fill="#e7f3de">Curator Search Priorities &amp; Radio Target Ingestion</text>
    <text class="text-caption" x="24" y="80" fill="#b5cda5">Interface: /sources/targets, /library ('Set Target'), /sources/import (OCR)</text>
    
    <rect x="24" y="96" width="432" height="130" class="card-sunk"/>
    <text class="text-data" x="38" y="122">Table: PostgreSQL target_tracks (migration 280)</text>
    <text class="text-data" x="38" y="142">API: POST /api/v1/target-tracks {artist, title, priority}</text>
    <text class="text-data" x="38" y="162">Radio Sources: PBS 106.7FM, 3RRR 102.7FM, TripleJ Doof</text>
    <text class="text-data-strong" x="38" y="186">Guard: Unique artist/title constraint; prevents duplicate queueing</text>
    <text class="text-caption" x="38" y="208" fill="#5fd08f">Handoff: Enqueued targets ready for unified scraper dispatch</text>
  </g>

  <!-- Arrow 1 -> 2 -->
  <path d="M 580 245 L 680 245" class="edge-active" stroke-width="3" marker-end="url(#arrow-brand)"/>
  <rect x="600" y="225" width="60" height="22" rx="4" fill="#1b1b1b" stroke="#3c3c3c"/>
  <text class="text-data" x="608" y="240">Trigger</text>

  <!-- Stage 2: Automated Scraper Scheduling (Top Right) -->
  <g transform="translate(700, 120)" filter="url(#shadow-1)">
    <rect width="480" height="250" class="card-pipeline"/>
    <rect x="0" y="0" width="10" height="250" fill="#7fa1b3" rx="5"/>
    <text class="text-label" x="24" y="32" fill="#e7f0f5">STAGE 2: Scraper Fleet &amp; Bronze Capture</text>
    <text class="text-body-strong" x="24" y="60" font-size="16" fill="#e7f0f5">Sequential Tracklist Harvesting (1..N)</text>
    <text class="text-caption" x="24" y="80" fill="#b6c7d1">Orchestrator: Scrapy + Playwright Chromium · Spiders: 1001TL, MixesDB, NTS</text>
    
    <rect x="24" y="96" width="432" height="130" class="card-sunk"/>
    <text class="text-data" x="38" y="122">Engine: unified-scraper (:8012) POST /scrape</text>
    <text class="text-data" x="38" y="142">Raw Table: PostgreSQL bronze_scraped_playlists</text>
    <text class="text-data" x="38" y="162">Positions: Immutable bronze_scraped_tracks (1..N)</text>
    <text class="text-data-strong" x="38" y="186">Guard: Completeness rule - zero gap tolerance</text>
    <text class="text-caption" x="38" y="208" fill="#5fd08f">Handoff: Complete playlists trigger ingest_pending task</text>
  </g>

  <!-- Arrow 2 -> 3 -->
  <path d="M 1180 245 L 1260 245 L 1260 440" class="edge-active" stroke-width="3" marker-end="url(#arrow-brand)"/>

  <!-- Stage 3: Silver Normalisation & Enrichment Waterfall (Center Right) -->
  <g transform="translate(1220, 440)" filter="url(#shadow-2)">
    <rect width="480" height="250" class="card-neutral"/>
    <rect x="0" y="0" width="10" height="250" fill="#9b85cb" rx="5"/>
    <text class="text-label" x="24" y="32">STAGE 3: Silver Normalisation &amp; Waterfall</text>
    <text class="text-body-strong" x="24" y="60" font-size="16">Multi-Provider Consensus &amp; Transition Synthesis</text>
    <text class="text-caption" x="24" y="80">Celery Worker + Metadata Enrichment Service (:8081)</text>
    
    <rect x="24" y="96" width="432" height="130" class="card-sunk"/>
    <text class="text-data" x="38" y="122">Waterfall: ref_mb -&gt; TIDAL v2 -&gt; Deezer -&gt; Discogs -&gt; Last.fm</text>
    <text class="text-data" x="38" y="142">Silver Tables: silver_enriched_tracks, silver_track_transitions</text>
    <text class="text-data" x="38" y="162">Transitions: pos N -&gt; pos N+1 with occurrence counts</text>
    <text class="text-data-strong" x="38" y="186">Rule: Unknown stays unknown (no fabricated BPM or key)</text>
    <text class="text-caption" x="38" y="208" fill="#5fd08f">Handoff: Outbox event emission triggers graph projection</text>
  </g>

  <!-- Arrow 3 -> 4 -->
  <path d="M 1460 690 L 1460 760 L 1180 760" class="edge-active" stroke-width="3" marker-end="url(#arrow-brand)"/>

  <!-- Stage 4: Graph Projection & Memgraph Wave Routing (Bottom Right) -->
  <g transform="translate(700, 680)" filter="url(#shadow-1)">
    <rect width="480" height="250" class="card-graph"/>
    <rect x="0" y="0" width="10" height="250" fill="#6fa8dc" rx="5"/>
    <text class="text-label" x="24" y="32" fill="#e2f0fe">STAGE 4: In-Memory Graph &amp; Wave Routing</text>
    <text class="text-body-strong" x="24" y="60" font-size="16" fill="#e2f0fe">Memgraph Bolt Topology &amp; Pathfinder Queries</text>
    <text class="text-caption" x="24" y="80" fill="#acc8e3">Memgraph (:7687) + projection_consume worker (15s poll)</text>
    
    <rect x="24" y="96" width="432" height="130" class="card-sunk"/>
    <text class="text-data" x="38" y="122">Nodes: (:Track {id, bpm, camelot, energy_1_10})</text>
    <text class="text-data" x="38" y="142">Edges: [:TRANSITIONS_TO {occurrences, weight}]</text>
    <text class="text-data" x="38" y="162">Algorithm: Shortest harmonic paths with energy curve</text>
    <text class="text-data-strong" x="38" y="186">Energy Scale: Canonical 1-10 (Warm 1-4, Build 5-7, Peak 8-10)</text>
    <text class="text-caption" x="38" y="208" fill="#5fd08f">Handoff: Sub-50ms transition stepping stones to Set Builder</text>
  </g>

  <!-- Arrow 4 -> 5 -->
  <path d="M 700 805 L 580 805" class="edge-active" stroke-width="3" marker-end="url(#arrow-brand)"/>

  <!-- Stage 5: Floor Execution & Set Delivery (Bottom Left) -->
  <g transform="translate(100, 680)" filter="url(#shadow-1)">
    <rect width="480" height="250" class="card-sets"/>
    <rect x="0" y="0" width="10" height="250" fill="#e08a5f" rx="5"/>
    <text class="text-label" x="24" y="32" fill="#feeae0">STAGE 5: Floor Execution &amp; DJ Set Delivery</text>
    <text class="text-body-strong" x="24" y="60" font-size="16" fill="#feeae0">Harmonic Wave Sequencing &amp; Multi-Format Export</text>
    <text class="text-caption" x="24" y="80" fill="#e6b9a4">Interface: /sets · SetBuilderPage.tsx + Naarm Set Builder Artifact</text>
    
    <rect x="24" y="96" width="432" height="130" class="card-sunk"/>
    <text class="text-data" x="38" y="122">Exports: Rekordbox XML, Extended M3U, CSV (OWASP guard)</text>
    <text class="text-data" x="38" y="142">TIDAL API: Automatic sync to SET · &lt;name&gt; playlists</text>
    <text class="text-data" x="38" y="162">Persistence: LocalStorage outbox + PostgreSQL library.saved_sets</text>
    <text class="text-data-strong" x="38" y="186">Live Gig: DJ plays set on CDJ-3000 / Rekordbox USB</text>
    <text class="text-caption" x="38" y="208" fill="#5fd08f">Handoff: Rekordbox USB generates HISTORY.m3u8</text>
  </g>

  <!-- Arrow 5 -> 6 (The Crucial Feedback Loop) -->
  <path d="M 340 680 L 340 540 L 440 540" class="edge-data" stroke-width="3" marker-end="url(#arrow-ok)"/>

  <!-- Stage 6: Floor Feedback & Rotation Reconciliation (Center Left) -->
  <g transform="translate(440, 440)" filter="url(#shadow-2)">
    <rect width="480" height="200" class="card-library"/>
    <rect x="0" y="0" width="10" height="200" fill="#c9a85c" rx="5"/>
    <text class="text-label" x="24" y="32" fill="#f6eedc">STAGE 6: Shift Audit, OEE &amp; Rotation Feedback</text>
    <text class="text-body-strong" x="24" y="60" font-size="16" fill="#f6eedc">Gig History Reconciliation &amp; Crate Lifecycle</text>
    <text class="text-caption" x="24" y="80" fill="#d3c29f">Closes the Loop: Booth performance updates track rotation &amp; transitions</text>
    
    <rect x="24" y="96" width="432" height="85" class="card-sunk"/>
    <text class="text-data" x="38" y="120">Harvest: Pioneer HISTORY.m3u8 booth play logs</text>
    <text class="text-data" x="38" y="138">Update: Increment silver_track_transitions occurrence_count</text>
    <text class="text-data-strong" x="38" y="158">Reconcile: High -&gt; Standard -&gt; Archive rotation decay</text>
  </g>

  <!-- Arrow 6 -> 1 (Complete Loop) -->
  <path d="M 440 470 L 340 470 L 340 370" class="edge-data" stroke-width="3" marker-end="url(#arrow-ok)"/>
  <rect x="300" y="410" width="80" height="22" rx="4" fill="#1b1b1b" stroke="#3c3c3c"/>
  <text class="text-data" x="308" y="425">Re-seed</text>

  <!-- Central Watermark / Closed Loop Hub -->
  <g transform="translate(950, 470)">
    <circle cx="120" cy="80" r="70" fill="#1b1b1b" stroke="#9b85cb" stroke-width="3"/>
    <text class="text-body-strong" x="120" y="75" text-anchor="middle" fill="#b4a2dc" font-size="14">CLOSED</text>
    <text class="text-body-strong" x="120" y="95" text-anchor="middle" fill="#b4a2dc" font-size="14">LOOP</text>
  </g>

  <!-- Traceability Footer -->
  <g transform="translate(48, 1045)">
    <rect width="1704" height="42" class="card-sunk"/>
    <text class="text-caption" x="20" y="26">SongNodes Industrial DJ Closed Loop · Demand -&gt; Scheduling -&gt; Normalisation -&gt; Graph -&gt; Execution -&gt; Audit · Single Source of Truth</text>
  </g>
</svg>
"""
    with open(f"{SVG_DIR}/production-execution-closed-loop.svg", "w", encoding="utf-8") as f:
        f.write(svg)
    print("Wrote production-execution-closed-loop.svg")


# 4. Enhanced Architecture: Connections, Critical Gaps & Proposed Modules
def generate_enhanced_architecture():
    svg = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1800 1100" width="100%" height="100%">
  <title>SongNodes: Architecture Enhancements, Critical Gaps &amp; Proposed Modules</title>
  <rect width="1800" height="1100" class="bg"/>
  {SVG_COMMON_DEFS}
  
  <!-- Header Banner -->
  <g transform="translate(48, 48)">
    <text class="text-title" font-size="28"><tspan class="text-lead">Enhanced Architecture:</tspan> Critical Data Gaps &amp; Proposed Single-Purpose Modules</text>
    <text class="text-body-muted" y="28">Identification of 5 critical architectural vulnerabilities alongside 4 proposed lightweight modules (&lt;500 LOC) and unified storage backbone</text>
  </g>
  
  <!-- LEFT COLUMN: The 5 Critical Data Gaps (Red Highlights) -->
  <g transform="translate(48, 110)" filter="url(#shadow-1)">
    <rect width="820" height="930" class="card-neutral"/>
    <text class="text-label" x="24" y="32" fill="#ff7469">Identified Architectural Gaps (Missing Feedback Loops &amp; Latencies)</text>
    
    <!-- Gap 1 -->
    <g transform="translate(24, 50)">
      <rect width="772" height="155" class="card-gap"/>
      <rect x="0" y="0" width="8" height="155" fill="#ff7469" rx="4"/>
      <text class="text-body-strong" x="20" y="26" fill="#ff7469">GAP-01 (High): Disconnected Rekordbox Booth Performance Feedback Loop</text>
      <text class="text-caption" x="20" y="46" fill="#f9f9f9">Sets export to Rekordbox XML, but live CDJ playback logs (HISTORY.m3u8) never feed back into SongNodes.</text>
      
      <rect x="20" y="58" width="732" height="82" rx="6" fill="#1b1b1b" stroke="#ff7469"/>
      <text class="text-data" x="32" y="80">Current: USB performance logs are abandoned on flash drive after gigs.</text>
      <text class="text-data" x="32" y="98">Impact: Live proven transitions do not increment occurrence_count; rotation decay is uncalibrated.</text>
      <text class="text-data-strong" x="32" y="122">Fix: Deploy MOD-01 Booth History Ingester (services/library/booth_history.py)</text>
    </g>
    
    <!-- Gap 2 -->
    <g transform="translate(24, 220)">
      <rect width="772" height="155" class="card-gap"/>
      <rect x="0" y="0" width="8" height="155" fill="#ff7469" rx="4"/>
      <text class="text-body-strong" x="20" y="26" fill="#ff7469">GAP-02 (High): Dual Storage Disconnect (PostgreSQL library.* vs SQLite dj_library.sqlite)</text>
      <text class="text-caption" x="20" y="46" fill="#f9f9f9">Weekly script writes to SQLite; SongNodes web app writes to PostgreSQL. Only a static JSON is copied.</text>
      
      <rect x="20" y="58" width="732" height="82" rx="6" fill="#1b1b1b" stroke="#ff7469"/>
      <text class="text-data" x="32" y="80">Current: Curator tag edits or crate changes in web UI do not propagate back to weekly SQLite ledger.</text>
      <text class="text-data" x="32" y="98">Impact: Split-brain library state; risk of overwriting user tags during Sunday weekly pipeline runs.</text>
      <text class="text-data-strong" x="32" y="122">Fix: Deploy MOD-03 Bi-Directional Library Bridge (services/library/bridge.py)</text>
    </g>
    
    <!-- Gap 3 -->
    <g transform="translate(24, 390)">
      <rect width="772" height="155" class="card-gap"/>
      <rect x="0" y="0" width="8" height="155" fill="#ff7469" rx="4"/>
      <text class="text-body-strong" x="20" y="26" fill="#ff7469">GAP-03 (Medium): Missing Audio Fingerprint &amp; AcoustID Transition Segmenter</text>
      <text class="text-caption" x="20" y="46" fill="#f9f9f9">Transitions rely strictly on text tracklists. Recorded live audio mixes cannot be automatically segmented.</text>
      
      <rect x="20" y="58" width="732" height="82" rx="6" fill="#1b1b1b" stroke="#ff7469"/>
      <text class="text-data" x="32" y="80">Current: Un-tracklisted DJ sets and radio broadcasts cannot be mined for transitions.</text>
      <text class="text-data" x="32" y="98">Impact: Track versions (Dub vs VIP) cannot be validated against audio acoustic waveforms.</text>
      <text class="text-data-strong" x="32" y="122">Fix: Deploy Essentia / Chromaprint Segmenter worker for automated transition discovery.</text>
    </g>
    
    <!-- Gap 4 -->
    <g transform="translate(24, 560)">
      <rect width="772" height="155" class="card-gap"/>
      <rect x="0" y="0" width="8" height="155" fill="#ff7469" rx="4"/>
      <text class="text-body-strong" x="20" y="26" fill="#ff7469">GAP-04 (Medium): Unwired Scraper Target Queue Scheduling</text>
      <text class="text-caption" x="20" y="46" fill="#f9f9f9">Curators add target artists in /library or /sources/targets, but musicLibrary pipeline ignores the queue.</text>
      
      <rect x="20" y="58" width="732" height="82" rx="6" fill="#1b1b1b" stroke="#ff7469"/>
      <text class="text-data" x="32" y="80">Current: musicLibrary pipeline reads static config/sources.json and does not poll target_tracks.</text>
      <text class="text-data" x="32" y="98">Impact: High-priority targets added by user sit idle until manually dispatched in SongNodes.</text>
      <text class="text-data-strong" x="32" y="122">Fix: Wire ML-TASK-03 cron script synchronising PostgreSQL target_tracks to weekly runner.</text>
    </g>
    
    <!-- Gap 5 -->
    <g transform="translate(24, 730)">
      <rect width="772" height="155" class="card-gap"/>
      <rect x="0" y="0" width="8" height="155" fill="#ff7469" rx="4"/>
      <text class="text-body-strong" x="20" y="26" fill="#ff7469">GAP-05 (Low): Outbox Projection Lag Invisibility in Web Client</text>
      <text class="text-caption" x="20" y="46" fill="#f9f9f9">Graph projection polls every 15 seconds; bulk scraping induces temporary projection lag without UI indicator.</text>
      
      <rect x="20" y="58" width="732" height="82" rx="6" fill="#1b1b1b" stroke="#ff7469"/>
      <text class="text-data" x="32" y="80">Current: /paths and /library show stale data during ingestion bursts with no freshness warning.</text>
      <text class="text-data" x="32" y="98">Impact: Selectors may query paths that omit transitions currently pending in the projection queue.</text>
      <text class="text-data-strong" x="32" y="122">Fix: Deploy MOD-02 Realtime Graph Outbox Daemon with SSE lag push to UI.</text>
    </g>
  </g>
  
  <!-- RIGHT COLUMN: Proposed Single-Purpose Modules (<500 LOC) & Directory Backbone -->
  <g transform="translate(896, 110)" filter="url(#shadow-2)">
    <rect width="856" height="930" class="card-neutral"/>
    <text class="text-label" x="24" y="32" fill="#5fd08f">Proposed Solutions: 4 Single-Purpose Modules (&lt;500 LOC) &amp; Storage Backbone</text>
    
    <!-- Module 1 -->
    <g transform="translate(24, 50)">
      <rect width="808" height="170" class="card-module"/>
      <text class="text-body-strong" x="20" y="26" fill="#5fd08f">MOD-01: Booth History Ingester (services/library/booth_history.py)</text>
      <text class="text-caption" x="20" y="46" fill="#bbbbbb">Target Users: Performing DJ, Music Curator · 1 Verb: Harvest · ~340 LOC · Conforms to Design System</text>
      
      <rect x="20" y="58" width="768" height="98" rx="6" fill="#1b1b1b" stroke="#5fd08f"/>
      <text class="text-data" x="32" y="80">Inputs: Pioneer DJ HISTORY.m3u8, USB play logs, gig venue/date metadata</text>
      <text class="text-data" x="32" y="98">Core Operation: Parses chronological playback timestamps, matches track IDs against silver tracks,</text>
      <text class="text-data" x="32" y="116">increments silver_track_transitions occurrence count, and advances rotation decay timers.</text>
      <text class="text-data-strong" x="32" y="138">Contract: BoothHistoryIngestContract {venue, date, transitions: [{from_id, to_id, played_at}]}</text>
    </g>
    
    <!-- Module 2 -->
    <g transform="translate(24, 235)">
      <rect width="808" height="170" class="card-module"/>
      <text class="text-body-strong" x="20" y="26" fill="#5fd08f">MOD-02: Realtime Graph Outbox Daemon (services/graph-projection/sync_daemon.py)</text>
      <text class="text-caption" x="20" y="46" fill="#bbbbbb">Target Users: Platform Admin, Graph Specialist · 1 Verb: Stream · ~280 LOC</text>
      
      <rect x="20" y="58" width="768" height="98" rx="6" fill="#1b1b1b" stroke="#5fd08f"/>
      <text class="text-data" x="32" y="80">Inputs: PostgreSQL LISTEN/NOTIFY events on silver_track_transitions outbox</text>
      <text class="text-data" x="32" y="98">Core Operation: Replaces 15-second polling loop with sub-second reactive Bolt connection,</text>
      <text class="text-data" x="32" y="116">streaming verified transition pairs directly into Memgraph graph topology.</text>
      <text class="text-data-strong" x="32" y="138">Contract: OutboxStreamEvent {transition_id, source_id, target_id, occurrences, weight}</text>
    </g>
    
    <!-- Module 3 -->
    <g transform="translate(24, 420)">
      <rect width="808" height="170" class="card-module"/>
      <text class="text-body-strong" x="20" y="26" fill="#5fd08f">MOD-03: Bi-Directional Library Bridge (services/library/bridge.py)</text>
      <text class="text-caption" x="20" y="46" fill="#bbbbbb">Target Users: Music Curator, Data Engineer · 1 Verb: Reconcile · ~410 LOC</text>
      
      <rect x="20" y="58" width="768" height="98" rx="6" fill="#1b1b1b" stroke="#5fd08f"/>
      <text class="text-data" x="32" y="80">Inputs: PostgreSQL library.* schema, SQLite dj_library.sqlite, music-library.json</text>
      <text class="text-data" x="32" y="98">Core Operation: Enforces atomic single-writer distributed lease, computes table SHA-256 checksums,</text>
      <text class="text-data" x="32" y="116">and replicates curator tag adjustments two-way with zero data loss.</text>
      <text class="text-data-strong" x="32" y="138">Contract: LibrarySyncContract {version, checksum_sha256, reconciled_at, mutations: [...]}</text>
    </g>
    
    <!-- Module 4 & Unified Storage Backbone -->
    <g transform="translate(24, 605)">
      <rect width="808" height="150" class="card-module"/>
      <text class="text-body-strong" x="20" y="26" fill="#5fd08f">MOD-04: Audio Preview Caching Proxy (services/rest_api/routers/audio_cache.py)</text>
      <text class="text-caption" x="20" y="46" fill="#bbbbbb">Target Users: Performing DJ, Live Selector · 1 Verb: Cache · ~290 LOC</text>
      
      <rect x="20" y="58" width="768" height="80" rx="6" fill="#1b1b1b" stroke="#5fd08f"/>
      <text class="text-data" x="32" y="80">Inputs: Deezer / TIDAL 30s audio preview URLs</text>
      <text class="text-data" x="32" y="98">Core Operation: Caches audio snippets locally on disk; serves immediate audio streams for offline booth.</text>
      <text class="text-data-strong" x="32" y="120">Contract: AudioCacheResponse {track_id, cached: bool, stream_url: '/audio/cache/{id}.mp3'}</text>
    </g>
    
    <!-- Unified Storage Directory Backbone -->
    <g transform="translate(24, 770)">
      <rect width="808" height="135" class="card-sunk"/>
      <text class="text-body-strong" x="20" y="26">Proposed Unified Storage Backbone Directory Architecture</text>
      <text class="text-caption" x="20" y="44">Replaces fragmented directories across E:\\musicLibrary and SongNodes with structured volume hierarchy</text>
      
      <g transform="translate(20, 56)">
        <rect width="140" height="64" rx="6" fill="#222222" stroke="#8fbf6b"/>
        <text class="text-body-strong" x="12" y="24" fill="#8fbf6b">/var/songnodes/</text>
        <text class="text-data" x="12" y="46">bronze/ (JSONL)</text>
      </g>
      <g transform="translate(170, 56)">
        <rect width="140" height="64" rx="6" fill="#222222" stroke="#9b85cb"/>
        <text class="text-body-strong" x="12" y="24" fill="#9b85cb">/var/songnodes/</text>
        <text class="text-data" x="12" y="46">silver/ (Ledger)</text>
      </g>
      <g transform="translate(320, 56)">
        <rect width="140" height="64" rx="6" fill="#222222" stroke="#c9a85c"/>
        <text class="text-body-strong" x="12" y="24" fill="#c9a85c">/var/songnodes/</text>
        <text class="text-data" x="12" y="46">library/ (SQLite)</text>
      </g>
      <g transform="translate(470, 56)">
        <rect width="140" height="64" rx="6" fill="#222222" stroke="#5fb8b0"/>
        <text class="text-body-strong" x="12" y="24" fill="#5fb8b0">/var/songnodes/</text>
        <text class="text-data" x="12" y="46">audio/ (30s MP3)</text>
      </g>
      <g transform="translate(620, 56)">
        <rect width="168" height="64" rx="6" fill="#222222" stroke="#e08a5f"/>
        <text class="text-body-strong" x="12" y="24" fill="#feeae0">/var/songnodes/</text>
        <text class="text-data" x="12" y="46">exports/ (XML/CSV)</text>
      </g>
    </g>
  </g>
  
  <!-- Connecting Edges from Gaps to Modules -->
  <path d="M 820 180 L 896 135" class="edge-gap" stroke-width="2.5" marker-end="url(#arrow-gap)"/>
  <path d="M 820 350 L 896 505" class="edge-gap" stroke-width="2.5" marker-end="url(#arrow-gap)"/>
  <path d="M 820 860 L 896 320" class="edge-gap" stroke-width="2.5" marker-end="url(#arrow-gap)"/>

  <!-- Traceability Footer -->
  <g transform="translate(48, 1045)">
    <rect width="1704" height="42" class="card-sunk"/>
    <text class="text-caption" x="20" y="26">SongNodes Enhanced Architecture · 5 Critical Gaps · 4 Targeted Modules (&lt;500 LOC) · Unified Storage Directory Backbone · Melbourne Australia</text>
  </g>
</svg>
"""
    with open(f"{SVG_DIR}/enhanced-architecture-connections-and-gaps.svg", "w", encoding="utf-8") as f:
        f.write(svg)
    print("Wrote enhanced-architecture-connections-and-gaps.svg")

if __name__ == "__main__":
    generate_system_architecture()
    generate_user_journey()
    generate_closed_loop()
    generate_enhanced_architecture()
    print("All 4 SVGs generated successfully.")
