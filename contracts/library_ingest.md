# Library Ingest Contracts

## Idempotent API Ingest
The weekly pipeline pushes data through the **existing job framework** using an idempotent REST API endpoint.

- **Endpoint:** `POST /api/v1/library/ingest`
- **Headers:** `Idempotency-Key` must be provided.
- **Body:** JSON payload containing run metadata and arrays of entity objects:
  - `tracks`, `appearances`, `chart_positions`, `rotation_history`, `pending`, `rejected`, `beatport_check`, `sources`, `runs`, `sets`.
- **Run Shapes:**
  The `runs` array accepts either the canonical shape `{"run_date", "status", "metrics"}` or the flattened musicLibrary export shape `{"date", "added", "demoted", ...}`. When given the flattened shape, `"date"` is interpreted as midnight in the `Australia/Melbourne` time zone, `"status"` defaults to `"completed"`, and all unrecognized keys are packed into the `"metrics"` JSON block.

- **Behavior:**
  - Enqueues a job of kind `library_ingest` using `jobs.enqueue(kind, idempotency_key, payload)`.
  - Returns per-row processing results indicating one of: `inserted`, `updated`, `unchanged`, `rejected` (with reason).
  - Calling with the same `Idempotency-Key` and the same body returns exactly the same state.
  - Calling with the same `Idempotency-Key` but a different body yields HTTP 409 Conflict.

## Library Endpoints
- `GET /api/v1/library/search`: Search library tracks.
- `GET /api/v1/library/tracks/{id}`: Fetch single track details.
- Saved Sets:
  - `GET /api/v1/library/sets`
  - `PUT|DELETE /api/v1/library/sets/{id}`
  - `GET /api/v1/library/sets/export`: Exports the artifact's saved-set document.
