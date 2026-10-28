CR1: Data-source credits in the app footer

Base: main at BASE_SHA. Repo: zvirb/songnodes. Follow "Working rules for agents" in AGENTS.md (one job, owned paths only, about 400 changed lines at most, verify then commit, two attempts then stop, rebase before the PR) and CLAUDE.md; the design system rules apply to any UI change. No access to the user's laptop, local data or secrets; work from the repo and fixtures. Open one PR against main titled "CR1: Data-source credits in the app footer" on a branch starting with "cr1-"; do not merge it. Edit only the lines inside your own STATUS.md slot (SLOT:CR1 BEGIN/END). Depends on: nothing. If a dependency is not merged on main yet, stop and say so instead of working around it. Never merge or rebuild your branch from an older base: before opening or updating the PR, run `git fetch origin main && git diff --diff-filter=D --name-only origin/main...HEAD`; it must list only your owned paths, otherwise stop and say so (the scope guard fails the PR anyway). New pages register through frontend/src/routes (G2) and new REST routers expose register(app) (G3); never edit App.tsx or services/rest_api/main.py unless your brief owns them.

## Job
Add one app-wide credits footer, mounted in the shell, that credits the metadata sources SongNodes uses: MusicBrainz, GetSongBPM (with the backlink its terms require), Deezer, Last.fm and Discogs.

## Context (verified on main 2026-10-28)
The only credit today is a MusicBrainz line inside the Library page (frontend/src/features/musicLibrary/LibraryPage.tsx:310, "Data from MusicBrainz (musicbrainz.org); tags CC BY-NC-SA 3.0"); L8 owns LibraryPage.tsx, so leave that line alone (a follow-up can remove it once the footer is in). frontend/src/components/Attributions.tsx renders the server's required backlinks from GET /api/v1/attributions (services/rest_api/routers/datalayer.py:135-140, GetSongBPM only, when enabled) through frontend/src/utils/attributions.ts (parseAttributions keeps https links only), but nothing mounts it. docs/requirements/TRACK_METADATA_RETRIEVAL.md:53: GetSongBPM requires a visible backlink to getsongbpm.com or the key is suspended. Providers in use: services/common/providers/{musicbrainz,getsongbpm,deezer,lastfm,discogs}.py. The shell is frontend/src/shell/AppShell.tsx (Outlet at line 179 inside `.sn-shell`). The design system has no footer component: design-system/06-interaction-accessibility.md:38 allows a `footer` landmark "only where there is one", and 05-layout.md:68 forbids sticky footers on phones; follow the quiet style of the print traceability footer (15-print-export.md:35, `body-s`, `fg-3`). NV1 owns HomePage.tsx and ModulePages.tsx; do not touch them. Design system: read design-system/README.md and the cards in design-system/api/components/ for every component you use; UI copy is en-AU, sentence case, no emoji, missing values an en dash (`sn-none`), numbers, durations and dates through `SN.format`, keys through `SN.camelot`/`keyName`; tokens (`var(--…)`) and `sn-*` classes only, no hex, rgb(), named colours, px font sizes or raw z-index; never `alert`/`confirm`, one primary button per view.

## Owned paths
- frontend/src/shell/CreditsFooter.tsx (new)
- frontend/src/shell/CreditsFooter.test.tsx (new)
- frontend/src/shell/AppShell.tsx (mount the footer after <Outlet /> only)
- frontend/src/components/Attributions.tsx (delete; replaced by CreditsFooter)

(Complete list. Anything else is read-only for you. You may also add a dated note under docs/integration/CR1/ if you need to record a decision.)

## Do
1. CreditsFooter: a `<footer aria-label="Data credits">` in `body-s` with `var(--fg-3)` text, padding and gap from space tokens, wrapping on phones, not sticky or fixed. Text: "Track data from" then links: MusicBrainz (https://musicbrainz.org, plus "tags CC BY-NC-SA 3.0"), GetSongBPM (https://getsongbpm.com), Deezer (https://www.deezer.com), Last.fm (https://www.last.fm), Discogs (https://www.discogs.com). Links follow design-system/components/TextLink/README.md:11-14: `sn-link sn-link--ext`, `target="_blank" rel="noopener"` and the hidden `<span class="sn-sr">, opens in a new tab</span>`; no `nofollow` on the GetSongBPM backlink.
2. Also call fetchAttributions() once; an attribution whose provider is already listed replaces that provider's text and URL; any other provider is appended. A failed fetch keeps the static list.
3. Mount it in AppShell after <Outlet /> so every page under the shell shows it. Check /graph (full-height workspace): if the footer adds a page scrollbar there, render it only outside /graph and record why in docs/integration/CR1/.
4. Delete frontend/src/components/Attributions.tsx (no importers on main: `git grep -n "components/Attributions"`).
5. Tests: the five links render with the right hrefs; the GetSongBPM link has no `nofollow`; a server attribution for getsongbpm replaces the static text; a rejected fetch still renders five links.
6. docs/integration/CR1/: note that the design system has no footer component yet and propose one upstream (design-system/17-governance.md).

## Done when (the reviewer's under-10-minute check; put it in the PR)
Open http://127.0.0.1:3006/, /library and /settings: each ends with "Track data from MusicBrainz … GetSongBPM, Deezer, Last.fm, Discogs" in quiet small text; the GetSongBPM link goes to getsongbpm.com. At 375 px wide it wraps without sideways scrolling and does not stay pinned to the screen.

## Checks
`cd frontend && npx tsc --noEmit -p . && npx oxlint src && npx vitest run src && npx vite build` and `PYTHONUTF8=1 bash scripts/sync-design-system.sh --check`. Report failures in files you do not own; do not fix them.

## Hand-back
The one job done, files added/changed/deleted, checks run and not run, the reviewer check, follow-ups.
