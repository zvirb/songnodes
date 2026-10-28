ST1: Settings: one card per service, coloured by kind

Base: main at BASE_SHA. Repo: zvirb/songnodes. Follow "Working rules for agents" in AGENTS.md (one job, owned paths only, about 400 changed lines at most, verify then commit, two attempts then stop, rebase before the PR) and CLAUDE.md; the design system rules apply to any UI change. No access to the user's laptop, local data or secrets; work from the repo and fixtures. Open one PR against main titled "ST1: Settings: one card per service, coloured by kind" on a branch starting with "st1-"; do not merge it. Edit only the lines inside your own STATUS.md slot (SLOT:ST1 BEGIN/END). Depends on: nothing. If a dependency is not merged on main yet, stop and say so instead of working around it. Never merge or rebuild your branch from an older base: before opening or updating the PR, run `git fetch origin main && git diff --diff-filter=D --name-only origin/main...HEAD`; it must list only your owned paths, otherwise stop and say so (the scope guard fails the PR anyway). New pages register through frontend/src/routes (G2) and new REST routers expose register(app) (G3); never edit App.tsx or services/rest_api/main.py unless your brief owns them.

## Job
On /settings, give each scraper service its own card and colour every card by kind (API keys, colour and size, logins and connections), drop Beatport from the UI, and stop the About card claiming an API status it does not show.

## Context (verified on main 2026-10-28)
frontend/src/pages/SettingsPage.tsx (949 lines): SETTINGS_LIST (45-137, exported, `SettingMeta` at 37-43) drives the overview, which renders `<Card variant="neutral" eyebrow title>` per item (886); the single-setting view also uses a neutral Card (788-792). The 'scraper-keys' item (117-122) mentions Beatport in its description and keywords, and its control (638-690) lists every row of GET /api/v1/api-keys/requirements (fetched at 189-215) as SecretFields in one card. The rows come from view api_key_requirements in sql/init/07-api-keys.sql:175 (services: spotify, discogs, lastfm, beatport, musicbrainz, youtube, setlistfm, reddit, 1001tracklists username/password, getsongbpm). SongNodes never uses Beatport. Card (frontend/src/components/ds/index.tsx:872-930, design-system/api/components/Card.md) supports `variant="tonal"` with `module`, which adds `sn-card--tonal sn-m-<module>`; tonal cards take module shades (secondary links use `--on-tonal`). The About card (717-730) shows design-system version, locale and API endpoint; its description (134) says "API status" but nothing checks it, and the REST /health route is not proxied by the frontend nginx (frontend/Dockerfile:93 proxies /api/ only). Leads such as "Music Services" and "AI Assistants" are Title Case. AK1 (running in parallel) may also drop Beatport from GET /requirements server-side; the UI filter below stays harmless either way. Do not edit frontend/src/services/apiKeyService.ts, services/rest_api/routers/api_keys.py or the SQL. Design system: read design-system/README.md and the cards in design-system/api/components/ for every component you use; UI copy is en-AU, sentence case, no emoji, missing values an en dash (`sn-none`), numbers, durations and dates through `SN.format`, keys through `SN.camelot`/`keyName`; tokens (`var(--…)`) and `sn-*` classes only, no hex, rgb(), named colours, px font sizes or raw z-index; never `alert`/`confirm`, one primary button per view.

## Owned paths
- frontend/src/pages/SettingsPage.tsx
- frontend/src/pages/SettingsPage.test.tsx

(Complete list. Anything else is read-only for you. You may also add a dated note under docs/integration/ST1/ if you need to record a decision.)

## Do
1. Add `kind: 'api' | 'display' | 'login' | 'about'` to SettingMeta and a map kind → module: api → "paths", display → "harmony", login → "library"; about stays neutral. api: preferred-ai-provider, the three AI keys, every service card except 1001Tracklists. display: theme, text-size, row-density, reduce-motion. login: tidal-connection, spotify-connection, the 1001Tracklists card, data-storage.
2. Overview and single-setting view render `<Card variant="tonal" module={…}>` for api/display/login and neutral for about. Order the overview by group: API keys, colour and size, logins and connections, About.
3. Replace the single 'scraper-keys' overview card with one card per `service_name` (grouped from the requirements, in display_order), titled with a label map (Spotify, Discogs, Last.fm, MusicBrainz, YouTube, Setlist.fm, Reddit, 1001Tracklists, GetSongBPM; fallback the raw name), holding that service's SecretFields. Each links to /settings/service-<service_name>, which renders that service alone; /settings/scraper-keys keeps working and lists all visible services. Search matches service names too.
4. Hide Beatport: one `HIDDEN_SERVICES = new Set(['beatport'])` filter applied to the requirements; remove Beatport from the scraper-keys description and keywords.
5. About: change its description to "Design system version, locale, time zone and API address." (remove the status claim).
6. Sentence-case the leads ("Music services", "AI assistants", "Pipeline services", "Storage and reset", "System information").
7. Tests (extend SettingsPage.test.tsx, mock fetch for requirements and keys): one card per service and none for Beatport; the 1001Tracklists card carries `sn-m-library`; Theme carries `sn-m-harmony`; an AI key card carries `sn-m-paths`; About is neutral; no rendered text contains "Beatport" or "API status".

## Done when (the reviewer's under-10-minute check; put it in the PR)
Open http://127.0.0.1:3006/settings: cards come in coloured groups (pink API keys incl. one card each for Spotify, Discogs, Last.fm …; teal theme, text size, row density, reduce motion; gold TIDAL, Spotify connection, 1001Tracklists, saved data); About is neutral and says nothing about API status; Beatport appears nowhere. Open the Discogs card's page: only the Discogs token field. /settings/scraper-keys still loads.

## Checks
`cd frontend && npx tsc --noEmit -p . && npx oxlint src && npx vitest run src && npx vite build` and `PYTHONUTF8=1 bash scripts/sync-design-system.sh --check`. Report failures in files you do not own; do not fix them.

## Hand-back
The one job done, files added/changed/deleted, checks run and not run, the reviewer check, follow-ups.
