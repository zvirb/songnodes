TX1: Send a set to TIDAL as a new dated playlist

Base: main at BASE_SHA. Repo: zvirb/songnodes. Follow "Working rules for agents" in AGENTS.md (one job, owned paths only, about 400 changed lines at most, verify then commit, two attempts then stop, rebase before the PR) and CLAUDE.md; the design system rules apply to any UI change. No access to the user's laptop, local data or secrets; work from the repo and fixtures. Open one PR against main titled "TX1: Send a set to TIDAL as a new dated playlist" on a branch starting with "tx1-"; do not merge it. Edit only the lines inside your own STATUS.md slot (SLOT:TX1 BEGIN/END). Depends on: TV1. If a dependency is not merged on main yet, stop and say so instead of working around it. Never merge or rebuild your branch from an older base: before opening or updating the PR, run `git fetch origin main && git diff --diff-filter=D --name-only origin/main...HEAD`; it must list only your owned paths, otherwise stop and say so (the scope guard fails the PR anyway). New pages register through frontend/src/routes (G2) and new REST routers expose register(app) (G3); never edit App.tsx or services/rest_api/main.py unless your brief owns them.

## Job
Replace the set builder's "Send to TIDAL on the weekly run" switch with a Send to TIDAL action that creates a new playlist in the user's TIDAL account, now, with the set's tracks in play order.

## Context (verified on main 2026-10-28)
Owner's decision (28 Oct 2026): each send creates a NEW playlist; its name is the date then the set name, for example "28 Oct 2026 . Warmup" where the separator is a middle dot (U+00B7, written `\u00B7` in source; the old switch text used the same 'SET \u00B7 name' convention); the user's optional note becomes the playlist description (blank if none); tracks TIDAL cannot match are listed afterwards. The date comes from `SN.format.date` (design-system/source/bundle.src.js line 110, "24 Oct 2026", Australia/Melbourne).
- UI today: frontend/src/features/musicLibrary/SetBuilderPage.tsx: state tidalSaved (line 65), setTidal (lines 235-242), header pill "Queued for the weekly run" (line 447), the Switch (lines 534-540), the set-card pill (line 632), the export note "sends the ones marked for TIDAL" (line 650) and the delete fact (line 666). The tick only flips SavedSet.tidal in local storage; nothing sends it. The page's one primary button is "Build set" (line 452).
- Backend (TV1, official API): services/rest_api/utils/tidal_user_api.py TidalUserApi(access_token).create_playlist(name, description) (line 209) and add_tracks_in_order(playlist_id, ids) (line 231, chunks of 50, keeps order), search_track(artist, title, isrc) (line 81). services/rest_api/routers/tidal_playlists.py (prefix /api/v1/tidal, included by main.py line 208) takes the token as `Authorization: Bearer`.
- Stored token: the OAuth callback (frontend/src/components/OAuthCallback.tsx line 209) posts it to /api/v1/music-auth/store-token, which upserts user_oauth_tokens (sql/migrations/006_user_oauth_tokens_up.sql: service 'tidal', access_token, expires_at). The frontend also holds it as useStore musicCredentials.tidal.accessToken (see TidalPlaylistManager.tsx line 82).
- A set's tracks carry `tidal` (a TIDAL URL such as https://tidal.com/browse/track/123, or null; setBuilder.ts line 470, library_search.py line 105), plus artist `a` and title `t`.

## Owned paths
- services/rest_api/routers/tidal_playlists.py (add POST /api/v1/tidal/sets/send only)
- tests/rest_api/test_tidal_playlists.py (add tests only)
- frontend/src/features/setBuilder/sendToTidal.ts (new) and sendToTidal.test.ts (new)
- frontend/src/features/setBuilder/SendToTidalDialog.tsx (new)
- frontend/src/features/musicLibrary/SetBuilderPage.tsx (the TIDAL switch, pills and texts listed above only)

(Complete list. Anything else is read-only for you. You may also add a dated note under docs/integration/TX1/ if you need to record a decision.)

## Do
1. Backend: POST /api/v1/tidal/sets/send {name, description, tracks:[{artist, title, tidal, isrc?}]} in order. Token: the Authorization header if sent, else the newest user_oauth_tokens row for service 'tidal' that has not expired; none gives 401 "Connect TIDAL in Settings first". For each track use the numeric id from `tidal` when present, else search_track; create the playlist, add_tracks_in_order with all matched ids (duplicates allowed, play order kept), return {playlist_id, url, added, unmatched:[{position, artist, title}]}. Never log the token.
2. sendToTidal.ts: `playlistName(date, setName)` -> `${SN.format.date(date)} \u00B7 ${setName}`, and `sendSetToTidal(set, note)` posting through the existing frontend api client with the musicCredentials token when present.
3. SendToTidalDialog.tsx (design-system Dialog and TextField from frontend/src/components/ds): shows the playlist name it will create, an optional "Note" field (becomes the description), one primary "Send to TIDAL" button, Cancel; busy state while sending. After success show a Toast "Playlist created in TIDAL" with a link to it, and if any tracks were unmatched list them in the dialog (position, artist - title) instead of closing.
4. SetBuilderPage.tsx: remove the Switch, setTidal and tidalSaved; add a secondary "Send to TIDAL" button in the header actions or the OverflowMenu (not primary; "Build set" stays the one primary). Remove the "Queued for the weekly run" pills and reword the export note and delete fact so they no longer promise a weekly send. Leave the SavedSet `tidal` field in data.ts/setBuilder.ts alone (a later job removes it). No alert/confirm, no hex or px, en-AU sentence case.
5. Tests: backend with httpx.MockTransport like the existing file: tracks with a TIDAL URL skip search, unmatched are reported with positions, order kept, stored-token fallback, 401 without a token. Frontend: playlistName formats "28 Oct 2026 \u00B7 Warmup" for a Melbourne date; blank note sends an empty description.
6. Your PR must change code, not only STATUS.md; check `git diff --stat origin/main...HEAD` before opening it.

## Done when (the reviewer's under-10-minute check; put it in the PR)
With TIDAL connected in Settings, open /sets, build and save a set, choose Send to TIDAL, add a note, send: a new playlist named "<today> . <set name>" (middle dot) appears in the TIDAL app with the note as its description and the tracks in set order; unmatched tracks are listed in the dialog. Sending again makes a second playlist.

## Checks
`python -m pytest tests/rest_api/test_tidal_playlists.py -q`; `cd frontend && npx tsc --noEmit -p . && npx oxlint src && npx vitest run src/features/setBuilder src/features/musicLibrary && npx vite build`; `PYTHONUTF8=1 bash scripts/sync-design-system.sh --check`. Report failures in files you do not own; do not fix them.

## Hand-back
The one job done, files added/changed/deleted, checks run and not run, the reviewer check, follow-ups (removing SavedSet.tidal and the weekly-run TIDAL step in the musicLibrary pipeline, if any).
