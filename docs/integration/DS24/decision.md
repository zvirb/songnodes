# DS24: first real use of DateRange (decision for Markus)

Status: waiting for Markus to pick A or B. Nothing is built until then.
Written 30 Oct 2026 on `main` e1ea438.

## Where things stand

- React has `DateRange` (`frontend/src/components/ds/DateRange.tsx`, DS19, exported from `ds/index.tsx`). No page uses it yet.
- React has no `DateField`. Only the bundle has it (`SongNodes.DateField`; its range variant takes `calendar` and `calendarProps` in `frontend/src/styles/design-system/index.d.ts`, around line 628).
- There is no scrape-history export. `grep -rn "exportCsv" frontend/src` finds only the set builder's `ExportDialog`.
- The DateRange card's "When to use" table (`design-system/components/DateRange/README.md`) says:
  - a span for a **filter or a form** uses **`DateField` range with its calendar button**, outcome "Use these dates";
  - **DateRange on its own**, behind a button, is for a span to **export or print** ("Download CSV", "Print").

## Option A: port DateField, then use it on /pipeline's job history filter

What it is: `frontend/src/components/ds/DateField.tsx`, a React port of `SongNodes.DateField`. It has three boxes (day, month, year), presets and the range variant. That variant has a calendar button which opens `DateRange` with focus on the grid. Then a "Started between" filter goes on the /pipeline "Scrape runs" table.

- **Pages touched:** /pipeline (`frontend/src/pages/ScraperProgressPage.tsx`; maybe also `frontend/src/features/pipeline/usePipelineTelemetry.ts`). The new component is `frontend/src/components/ds/DateField.tsx` plus its test, exported from `ds/index.tsx`.
- **Data filtered:** scrape jobs from `GET /api/v1/jobs?kind=scrape&limit=50` (`usePipelineTelemetry.ts`), using `created_at`. That field is an instant, so it is turned into a Melbourne date before it is compared with the date-only range.
- **Fits the card:** yes. A filter uses DateField with the calendar button.
- **Size:** about 200–250 lines for DateField with the calendar wiring, plus tests, plus about 40 lines on the page. That is close to the 400-line budget, so it is best split in two: A1 ports DateField with tests, then A2 adds the /pipeline filter.

## Option B: add a date-range filter to an existing list, using DateRange directly

What it is: a "Dates" button above a list opens `DateRange`. Its outcome "Use these dates" filters the list. There is no typed entry.

- **Pages touched:** one of these:
  - /pipeline "Scrape runs" (`frontend/src/pages/ScraperProgressPage.tsx`);
  - the library runs on /library (`frontend/src/features/musicLibrary/LibraryPage.tsx`).
- **Data filtered:** for /pipeline, the same scrape jobs by `created_at` as in A. For library runs there is nothing to filter: `loadLibrary()` always returns `runs: []` since DB1 (`frontend/src/features/musicLibrary/data.ts`, line 125). A filter over runs would only ever show the empty state, so only /pipeline is an honest target for B.
- **Fits the card:** no. A filter without DateField goes against the card's "When to use" table, and it drops the typed path ("Typing is always possible … the calendar is a second way in, never the only one"). B therefore needs a design-system change first (17-governance), or it has to be recast as an export ("Download CSV" of scrape runs).
- **Size:** about 60–100 lines plus tests, in one package.

## Data limits that affect both options on /pipeline

- `GET /api/v1/jobs` has no date parameters. It takes `status`, `kind`, `limit` (at most 200) and `offset` (`services/rest_api/routers/jobs.py`, lines 79–86; `services/common/datalayer/jobs.py`, `list_jobs`, lines 108–113). The page fetches the newest 50 scrape jobs and shows 20 of them.
- The worker deletes succeeded jobs after `JOB_RETENTION_DAYS` (default 14) days (`services/worker/celery_app.py`, line 98; `jobs.prune`). Dead and in-flight jobs are kept.
- So the "Last 30 days" and "This year" presets would quietly show only what is left. For an honest filter, either:
  - a backend package adds `created_from`/`created_to` to `GET /api/v1/jobs`, and the page says how long finished jobs are kept; or
  - the filter offers only spans inside the retention window and says so.

## Another place for A: /library "Last heard between"

The DateField card names "Last heard between" in the library's filter rail as its music-library use. The data is already there:

- each track's `last` is a Melbourne date string from `library.appearances` (`services/rest_api/routers/library_search.py`, line 101);
- the page loads every track up to 5,000 and filters on the client (`CrateFilters` and `matchesFilters` in `frontend/src/features/musicLibrary/setBuilder.ts`, `CrateFilterRail.tsx`).

There is no retention limit and no time-zone conversion. Pages touched: /library (`LibraryPage.tsx`, `components/CrateFilterRail.tsx`, `setBuilder.ts` for the filter and its URL parameters).

## Open questions (Q11–Q16 in design-system/17-governance.md) that affect this

| # | Question | A (DateField + calendar) | B (DateRange alone) |
|---|---|---|---|
| Q11 | Outcome button weight | Default: /pipeline already has its one primary, "Queue scrape" | Same |
| Q12 | When the popover closes | Directly affected: "closes on the second pick in DateField" applies only to A | Stays open (B has no DateField) |
| Q13 | Week presets in DateField's chip row | Directly affected: whether the field mirrors the popover's week presets | Not affected |
| Q14 | More than one mark on a day | Only if days with scrape runs get a data dot. One dot per day needs no answer | Same |
| Q15 | DateRange on phones | Affected: bottom sheet below 480px (default) or full-screen sheet | Same |
| Q16 | Limit future days in exports | Not affected (a filter, not an export). A `max` of today may still suit job history | Affected only if B is recast as an export |

Defaults apply until DSQ1 answers them. None of them blocks A or B, but Q12 and Q13 change A's behaviour, so answering them before A2 avoids rework.

## Recommendation

**A.** Port DateField first (A1), because the card sends every filter span through it, and both /pipeline and /library need it.

For the first page (A2), use **/library "Last heard between"** rather than /pipeline: its data is complete, already date-only and needs no backend change. Add the /pipeline "Started between" filter after a backend package gives `GET /api/v1/jobs` a date span.

**B** is smaller, but it either breaks the card's rule (a filter with no typed path) or has to become a scrape-runs CSV export, which is a different job.

Markus, please pick one:

1. A with A2 on /pipeline;
2. A with A2 on /library;
3. B on /pipeline (and say whether as a filter after a design-system change, or as an export).
