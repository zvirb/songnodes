# Prompt: fix track-metadata retrieval in songnodes so the graph gets BPM, key, energy and platform IDs

*Written 24 Oct 2026 from a code survey of zvirb/songnodes (main, last push 28 Nov 2025). The API behaviour below was tested live against TIDAL, Deezer and MusicBrainz using Markus's TIDAL developer app.*

---

## Prompt (paste into a Claude Code session on the songnodes repo)

You're working in `zvirb/songnodes`. The graph (`graph_nodes` view → graph-visualization-api) draws nodes from `silver_enriched_tracks`. Most node attributes come out NULL: `bpm`, `key`/`musical_key`, `camelot_key`, `energy`, `danceability`, `valence`, and often `isrc`, `tidal_id` and `deezer_id`. The enrichment code depends on sources that no longer return data, or calls them wrongly. Fix retrieval so the graph is populated, and prove it with before/after coverage numbers.

Work on a branch and open a PR. Use parallel agents, one per work package below with disjoint files. Each agent should research current best practice and the provider's live docs for its job before coding. Every claim about an API must be checked with a real call, not memory.

### What was verified on 24 Oct 2026 (treat as ground truth unless a live test now says otherwise)

1. **Spotify audio-features is closed to new apps** (since 27 Nov 2024).
   - `enrichment_pipeline.py` steps 1–3 and the write at about lines 697–730 take `energy`, `danceability`, `valence` and the fallback `bpm`/`key` from it.
   - `music_auth.py` about :907 and :1001 also call it.
   - `audio-analysis/analysis_modules/audio_fetcher.py:41` prefers `spotify_preview_url`, which is mostly null for new apps.
   - The waterfall seed (`sql/migrations/medallion/004_waterfall_configuration_up.sql:152-156`) still lists Spotify for bpm, key and energy.
2. **The TIDAL enrichment client (`services/metadata-enrichment/api_clients.py` `TidalClient`, about :1186) returns nothing.**
   - Base URL is `https://openapi.tidal.com` with no `/v2`, and the headers say `application/vnd.tidal.v1+json`.
   - Live test: `GET https://openapi.tidal.com/tracks?filter[isrc]=QM6MZ2651268&countryCode=US` → **404**. `GET https://openapi.tidal.com/search?query=…` → **404**. The client logs these as "not found" and carries on silently.
   - `GET https://openapi.tidal.com/v2/tracks?filter[isrc]=QM6MZ2651268&countryCode=AU` with `Accept: application/vnd.api+json` → **200**.
   - The parser (about :1616–1638) reads top-level `title`/`isrc`/`duration` and does `duration * 1000`. v2 is JSON:API: fields are under `data[].attributes`, and `duration` is ISO-8601 (`PT5M4S`), so that multiplication repeats the string.
   - Text search reads `data['tracks']['items']`, the legacy shape.
3. **Correct TIDAL v2 usage** (spec: https://tidal-music.github.io/tidal-api-reference/tidal-api-oas.json):
   - **Search:** `GET /v2/searchResults?filter[query]=<text>&countryCode=AU&include=tracks`, then take the track IDs from `data.relationships.tracks.data`. `GET /v2/searchResults/<raw query>/relationships/tracks` returns **400 INVALID_RESOURCE_ID**: the `{id}` in that path is an opaque search-result ID, not query text.
   - **Hydrate:** `GET /v2/tracks?filter[id]=<≤20 ids>&countryCode=AU&include=artists`.
   - **Track attributes:** `title`, `version` (e.g. "Extended Mix"), `duration` (ISO-8601), `isrc`, `popularity`, `bpm`, `key`, `keyScale`. **`bpm`, `key` and `keyScale` came back null for every track tested (24 of 24, with both app and user tokens).** Don't rely on TIDAL for tempo or key.
   - Some versions appear only in the title (e.g. "One More Time (Radio Edit)"), so parse both `title` and `version`.
   - **Auth:**
     - App token: client credentials with HTTP Basic at `https://auth.tidal.com/v1/oauth2/token`.
     - User token: PKCE at `https://login.tidal.com/authorize`, with `client_secret` included in the body for both `authorization_code` and `refresh_token` grants.
     - Working scopes: `user.read playlists.read playlists.write search.read collection.read`.
   - **Playlists:** `POST /v2/playlists`, then `POST|DELETE /v2/playlists/{id}/relationships/items` (≤50 per call; `meta.onDuplicates: "SKIP"`; deletes need each item's `meta.itemId`). Send an `Idempotency-Key` header on writes.
   - **countryCode** must be configurable (`TIDAL_COUNTRY_CODE`, default `AU`), not hard-coded `US`.
4. **songnodes has five TIDAL code paths.** Only the enrichment one above feeds the graph. The others:
   - `tidal-integration/tidal_connector.py` and `streaming-integrations/unified_streaming_client.py` use the unofficial `tidalapi` library. The unified client also stores seconds as `duration_ms`.
   - `rest_api/routers/tidal_playlists.py` uses the private `api.tidal.com/v1`/`v2` endpoints without `countryCode`.
   - `music_auth.py` sends the client secret as a URL query parameter in its device flow (about :1123).
5. **Deezer: songnodes has no working client.** `DeezerClient` in `unified_streaming_client.py` (about :583–617) is a stub. The real API is free and needs no key:
   - `GET https://api.deezer.com/track/isrc:<ISRC>` is an exact match on version. Tested: QM6MZ2651268 → "Free Your Mind (Extended Mix)", 304 s.
   - `GET /search?q=<artist> <title>`: use plain text, because the advanced `artist:"…" track:"…"` syntax returned nothing for most club tracks. A second query with " extended" appended surfaces long versions.
   - `GET /track/{id}` gives `bpm`, `gain`, `isrc`, `release_date`, `album.id`, `title_version` and `preview` (30-s MP3). **`bpm` is 0 for most tracks** (only 40 of 459 club tracks had it), so treat 0 as null.
   - `GET /album/{id}` gives `genres.data[].name` (coarse: "Electro", "Dance") and `label`.
   - The rate limit is about 50 requests per 5 s; error code 4 means quota exceeded, so back off.
6. **BPM/key sources currently in the code are weak or broken.**
   - **AcousticBrainz** (`api_clients.py` about :1023) has been frozen since 2022, so newer tracks have no data.
   - **GetSongBPM** (`api_clients.py` about :1108–1135):
     - Base URL: use `https://api.getsongbpm.com`.
     - The search needs `type=both` and `lookup=song:<title> artist:<artist>`.
     - The song object has `tempo`, `key_of` and `camelot`, not `song_key`, so the current parser never reads a key.
     - The API key is `GETSONGBPM_API_KEY`. Their terms require a visible backlink to getsongbpm.com, or the key is suspended.
   - **Local analysis** (`services/audio-analysis`) has librosa and essentia, detects BPM only (no key), and writes to `musicdb.tracks_audio_analysis`, never back to the track's `bpm`/`key`.
   - **The Beatport spider** (`scrapers/spiders/stores/beatport_spider.py` about :575–614) scrapes `bpm`, `musical_key` and `camelot`. Beatport blocks automated fetching and offers no personal API, so don't extend scraping or get around blocks. Use existing scraped values only as one source among several.
7. **Data-correctness bugs to fix:**
   - **Camelot minor keys are all wrong** (`enrichment_pipeline.py` about :936–950, repeated about :983–995). The code maps A minor to 1A. The correct minor mapping is: Am=8A, Em=9A, Bm=10A, F#m/Gbm=11A, C#m/Dbm=12A, G#m/Abm=1A, D#m/Ebm=2A, A#m/Bbm=3A, Fm=4A, Cm=5A, Gm=6A, Dm=7A. Major keys are correct (C=8B, G=9B, D=10B, A=11B, E=12B, B=1B, F#=2B, Db=3B, Ab=4B, Eb=5B, Bb=6B, F=7B).
     - Use one shared `to_camelot()` that accepts "A minor", "Am", "Eb Minor", Open Key ("1m" = 8A, "1d" = 8B) and existing Camelot strings.
     - Add a migration to recompute stored minor-key Camelot values.
   - **The MusicBrainz ISRC is never captured:** the parser returns `isrcs` (a list) but the pipeline checks `mb_search.get('isrc')` (about :440).
   - **Genre type mismatch:** a string is written into the `genre TEXT[]` column (about :750–755).
   - **Last.fm is called over http** (about :929). Use https.
   - **There's a hard-coded DB password default** in `unified_streaming_client.py` (about :684). Remove it.
   - **Secret names don't match:** k8s defines `TIDAL_API_TOKEN` and `DISCOGS_API_TOKEN`, but the code reads `TIDAL_CLIENT_ID`/`TIDAL_CLIENT_SECRET` and `DISCOGS_TOKEN`.
   - **Later sources overwrite earlier ones:** `metadata.update(...)` gives no per-field priority or provenance.
   - **The waterfall isn't wired in:** `ConfigDrivenEnricher` (`main.py` about :414) is instantiated but never called, so the `metadata_enrichment_config` waterfall is dead.
   - **Columns are missing:** there are no columns for `camelot_key`, `label` or the version/mix name; they live only in JSONB.

### Work packages

**WP1 – TIDAL v2 client (one client for the whole repo).**
- Rewrite `TidalClient` against `/v2` JSON:API as described above:
  1. Look up by ISRC first (`/v2/tracks?filter[isrc]=` takes up to 20 ISRCs per call).
  2. Then search via `/v2/searchResults?filter[query]=`.
  3. Then hydrate with `include=artists`.
- Parse attributes properly. Convert ISO-8601 to seconds and milliseconds. Map `version` (or a parenthesised title suffix) to a new `mix_name`. Keep `isrc` and `tidal_id`.
- Add a test that fails loudly on any 404 from a known-good ISRC. Never treat 404 as "not found" on a lookup that should exist.
- Move the playlist router and the `tidal-integration`/`streaming-integrations` services onto this client and the v2 playlist endpoints. Remove `tidalapi` and the private `api.tidal.com` calls unless a feature truly can't be done on v2; list any such case in the PR.
- Fix the device-flow secret-in-URL, and make `countryCode` configurable.

**WP2 – Deezer client (real).**
- Implement ISRC lookup first, then plain-text search, then `/track/{id}` detail (bpm with 0 treated as null, `gain`, `preview`) and `/album/{id}` (genres, label).
- Add rate limiting, Redis caching and backoff on code 4.
- Populate `deezer_id`, and fill `isrc` when it's missing.

**WP3 – BPM, key and energy from several independent methods.**
- **Method A, catalogue lookups:** GetSongBPM (fixed as above) and Deezer `bpm` when non-zero. Keep existing Beatport-scraped values and AcousticBrainz for older tracks.
- **Method B, audio analysis:** extend `services/audio-analysis`.
  - Add key detection with essentia `KeyExtractor` using the electronic-music profile (`profileType='edma'`), and BPM with `RhythmExtractor2013`.
  - Run it on MinIO audio, or on the Deezer `preview` 30-second clip. Check Deezer's terms for analysing previews first and record the conclusion in the PR.
  - Write results back to the track, not just to `tracks_audio_analysis`.
- **Consensus:**
  - Store every per-source value with provenance in JSONB (`bpm_sources`, `key_sources`).
  - Fold half- and double-time readings into a genre range (house 100–140, techno 115–160, UKG/bass 120–150, d&b 160–180).
  - BPM agrees when sources are within ±2. Key agrees when the Camelot code matches, or is a relative major/minor (8A↔8B) or ±1 neighbour; flag those as near-agreement.
  - Choose the value by agreement first, then by source trust order.
  - Set `metadata_review = true` on conflicts, with a view `v_metadata_conflicts`.
- **Energy (replaces Spotify):**
  - Compute it from the audio analysis (loudness/RMS, onset rate, spectral flux and danceability from essentia), mapped to the 1–10 scale DJs use.
  - Calibrate that mapping against Markus's own energy-tagged tracks (Mixed In Key or Rekordbox ratings from his library) as a best-fit rule, rather than choosing weights by hand. If no tagged data is available, leave `energy` null and say so; don't invent it.
  - Don't call Spotify audio-features anywhere. Remove it from the waterfall seed.

**WP4 – Pipeline merge and the waterfall.**
- Replace the blind `metadata.update` with per-field resolution driven by `metadata_enrichment_config`. Wire in `ConfigDrivenEnricher`, and update the seed so the order is:
  - `bpm`/`key`: consensus (WP3)
  - `isrc`: ISRC from TIDAL, then Deezer, then MusicBrainz
  - `duration`/`mix_name`: TIDAL, then Deezer
  - `genre`/`label`: Discogs, then Deezer album, then Last.fm tags
- Matching goes ISRC first, then fuzzy. Add TIDAL and Deezer candidates to `fuzzy_matcher.py`, with duration within ±10 s as a hard check so radio edits aren't matched to extended mixes.
- Add proper columns (`camelot_key`, `label`, `mix_name`) and backfill them from JSONB. Fix the `genre TEXT[]` write. Fix the MusicBrainz `isrcs` capture.

**WP5 – Graph and backfill.**
- Write a backfill job that re-enriches every row in `silver_enriched_tracks` where `bpm`, `key`, `isrc`, `tidal_id` or `deezer_id` is null. It must be rate-limited, resumable and idempotent.
- Make sure `graph_nodes` exposes `bpm`, `musical_key`, `camelot_key`, `energy`, `genre`, `label` and `mix_name`.

### Acceptance (put the numbers in the PR)
- **Before/after coverage table** on all tracks and on a fixed random sample of 50: % non-null for `bpm`, `key`, `camelot_key`, `energy`, `isrc`, `tidal_id`, `deezer_id`, `genre`, `label`, `mix_name`. Also report % of BPM/key values where two or more methods agree.
- **Live contract tests** (marked so they're skipped in CI without credentials):
  - TIDAL v2 ISRC `QM6MZ2651268` → title "Free Your Mind", version "Extended Mix", 304 s.
  - TIDAL search "Prospa Free Your Mind" returns both the 202 s and the 304 s versions.
  - Deezer `track/isrc:QM6MZ2651268` → 304 s.
  - The old `openapi.tidal.com/tracks` URL is no longer used anywhere (grep test).
- **Unit tests:** `to_camelot()` for all 24 keys plus Open Key and 3-letter forms; ISO-8601 duration parsing; consensus folding (64 ↔ 128, 87 ↔ 174); the radio-edit duration guard.
- No secrets in code, logs or the PR. `.env` is not committed.

### Don't
- Use Spotify audio-features, or any undocumented or private TIDAL API.
- Get around Beatport or 1001tracklists blocks (1001tracklists' robots.txt blocks AI agents).
- Change the production database destructively. Use migrations with down scripts.
- Mark a field "done" when its coverage didn't improve. Report what's still missing and why.

---

## Reference implementation
The same calls are working today in Markus's `musicLibrary` pipeline (`E:\musicLibrary\pipeline\djlib\` on his laptop; also saved in the Claude project "Music Library Development"):
- `tidal.py`: v2 search, hydrate, ISO durations, PKCE with secret in body, playlist reconcile.
- `deezer.py`: plain search plus " extended", detail and album genres.
- `camelot.py`: the correct key→Camelot mapping, including Open Key, plus the +2 and −5 moves.
- `run_weekly.py`: `fold_bpm` and `bpm_crosscheck`, which never compares a source with itself.

They can be copied across as the starting point for WP1, WP2 and the Camelot fix.