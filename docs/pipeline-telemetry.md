# Pipeline Telemetry

The Pipeline Telemetry page (`/pipeline`) provides a live, non-simulated view of the system's asynchronous operations, tracking exactly what the backend API returns via `GET /api/v1/jobs` and `GET /api/v1/outbox/status`.

## Data Source Mapping

No figures on the `/pipeline` page are simulated or randomly generated. The frontend uses mappers to derive stats directly from API data:

- **Total Jobs Executed (Processed):** The count of jobs with `status = 'succeeded'`.
- **Pending Jobs Left (Remaining):** The count of jobs with `status = 'queued'` or `'running'`.
- **Validation Errors (Dead Letters):** The count of jobs with `status = 'dead'`.
- **Throughput Speed:** Calculated as the number of succeeded jobs that finished in the last 15 minutes, divided by 15 (giving items per minute). Null (rendered as an em dash `—`) if fewer than two data points exist.
- **Active Worker Pool:** Calculated from jobs with `status = 'running'`. Instead of raw processes, this groups by distinct job `kind` and `payload.source`.

## Medallion Stages

The 4-stage pipeline progress is built primarily off outbox metrics:

- **Stage 1: Bronze Ingestion:** Always reflects job ingestion status. Backlog count relies on jobs.
- **Stage 2: Silver Normalization:** Tracks the `silver_normalization` outbox consumer backlog.
- **Stage 3: Gold Graphing:** Tracks the `gold_graphing` outbox consumer backlog.
- **Stage 4: Serving Index:** Tracks the `serving_index` outbox consumer backlog or `projection.pending`.

If a backlog is 0, the stage status shows as `waiting` (unless Bronze, which is typically marked `done`), and totals/counts will display an em dash `—`.

## Unavailable Metrics

Since the frontend relies solely on available endpoints, the following metrics are **not available** and will be hidden or rendered with an em dash `—`:
- Raw CPU/memory utilization.
- Per-worker individual process IDs (we only know which *job kind* is running).
- Granular error traces beyond `last_error` in a dead job.

## Empty States & Error Handling

- **No Jobs:** If the job queue is entirely empty, a call to action provides a button to trigger a test scrape via `POST /api/v1/scrape/trigger?source=1001tracklists`.
- **Connection Failure:** The UI enters an explicit disconnected mode with a user-facing retry button and backs off polling gracefully under the hood.
