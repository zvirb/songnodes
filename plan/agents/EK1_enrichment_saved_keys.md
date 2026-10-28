EK1: Enrichment uses keys saved in Settings

Base: main at BASE_SHA. Repo: zvirb/songnodes. Follow "Working rules for agents" in AGENTS.md (one job, owned paths only, about 400 changed lines at most, verify then commit, two attempts then stop, rebase before the PR) and CLAUDE.md; the design system rules apply to any UI change. No access to the user's laptop, local data or secrets; work from the repo and fixtures. Open one PR against main titled "EK1: Enrichment uses keys saved in Settings" on a branch starting with "ek1-"; do not merge it. Edit only the lines inside your own STATUS.md slot (SLOT:EK1 BEGIN/END). Depends on: nothing. If a dependency is not merged on main yet, stop and say so instead of working around it. Never merge or rebuild your branch from an older base: before opening or updating the PR, run `git fetch origin main && git diff --diff-filter=D --name-only origin/main...HEAD`; it must list only your owned paths, otherwise stop and say so (the scope guard fails the PR anyway). New pages register through frontend/src/routes (G2) and new REST routers expose register(app) (G3); never edit App.tsx or services/rest_api/main.py unless your brief owns them.

## Job
The enrichment providers use the keys saved in Settings (the api_keys table) first and fall back to the environment, so a key entered in the app turns its provider on without editing .env.

## Context (verified on main 2026-10-28)
services/common/providers/registry.py:38 build_providers(env=None) reads only os.environ: DISCOGS_TOKEN or DISCOGS_API_TOKEN (:56), LASTFM_API_KEY (:59), GETSONGBPM_API_KEY plus GETSONGBPM_ENABLED (:61), TIDAL_CLIENT_ID/SECRET (:46). configured() (:22) already treats CHANGE_ME... as unset. Saved keys are encrypted in api_keys; read them with `SELECT get_api_key($1, $2, $3)` (sql/init/07-api-keys.sql:84; NULL secret falls back to the same default key the REST API uses), as services/rest_api/utils/api_key_helper.py:36 does with API_KEY_ENCRYPTION_SECRET. Seeded names (07-api-keys.sql:186-246): ('discogs','token'), ('lastfm','api_key'), ('getsongbpm','api_key'), ('spotify','client_id'/'client_secret'). There is no Spotify provider in services/common/providers (Spotify audio-features is closed, docs/requirements/TRACK_METADATA_RETRIEVAL.md:15), so Spotify keys are not wired. The only callers are services/worker/celery_app.py:75 `build_providers()` inside drain_async (an asyncpg connection is open there) and tests/enrichment_local/replay/run.py:201 (explicit env). Both celery_app.py and services/common/datalayer/handlers.py belong to AA2 and are read-only for you, so the default call must pick up saved keys without changing its caller. ENRICHMENT_PROVIDERS still decides which providers run (compose.dev.yaml defaults it to 'none').

## Owned paths
- services/common/providers/registry.py
- services/common/providers/saved_keys.py (new)
- services/common/tests/test_provider_saved_keys.py (new)

(Complete list. Anything else is read-only for you. You may also add a dated note under docs/integration/EK1/ if you need to record a decision.)

## Do
1. saved_keys.py: `async def load(conn, secret)` returns an env-shaped dict {DISCOGS_TOKEN, LASTFM_API_KEY, GETSONGBPM_API_KEY, TIDAL_CLIENT_ID, TIDAL_CLIENT_SECRET} from get_api_key for ('discogs','token'), ('lastfm','api_key'), ('getsongbpm','api_key'), ('tidal','client_id'/'client_secret'), skipping NULL and CHANGE_ME values. `def load_sync(dsn, secret)` runs load on a fresh asyncpg connection in a worker thread (concurrent.futures, own event loop, 5 s timeout) so it is safe to call from inside a running loop; any error returns {} and logs one warning naming the service only.
2. registry.build_providers(env=None, saved=None, **kw): when env is None, saved defaults to load_sync(DATABASE_URL, API_KEY_ENCRYPTION_SECRET) (skip when DATABASE_URL is unset or SAVED_KEYS_DISABLED is true). Merge per key: saved value when configured(), else env. When env is passed explicitly and saved is None, do not touch the database (tests and the replay stay offline).
3. GETSONGBPM_ENABLED stays an env switch; a saved GetSongBPM key alone does not enable it. Say so in the module docstring.
4. Log one info line per build: provider names and where each credential came from ('saved' or 'env'). Never log a value, a prefix or a length.
5. Tests (fake conn returning rows, no network): saved key wins over env; CHANGE_ME saved value falls back to env; DB error falls back to env with no exception; explicit env does not query; the log line has no secret text; load_sync works when called inside a running event loop.

## Done when (the reviewer's under-10-minute check; put it in the PR)
With ENRICHMENT_PROVIDERS=discogs,lastfm and no DISCOGS_TOKEN in .env, save a Discogs token in Settings, rebuild the worker, then `docker compose -f compose.dev.yaml logs worker | grep providers` shows discogs from 'saved', and no token text appears in the logs.

## Checks
`cd services && python -m pytest common/tests/test_provider_saved_keys.py common/tests/test_providers.py -q`. Report failures in files you do not own; do not fix them.

## Hand-back
The one job done, files added/changed/deleted, checks run and not run, the reviewer check, follow-ups (pass API_KEY_ENCRYPTION_SECRET to rest-api and worker in compose.dev.yaml; a 'tidal' service in the api_keys allow-list; calling saved_keys.load directly from celery_app.drain_async once AA2 has merged).
