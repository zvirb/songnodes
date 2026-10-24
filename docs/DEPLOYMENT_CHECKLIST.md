# Redeploy and first-scrape checklist

Everything below is code-complete and tested against the minimal Compose stack with synthetic data. Nothing has run
against your cluster, real credentials, the unified scraper, or real playlists.

## 1. Before you deploy

- [ ] **Rotate the exposed credential.** A database password (`7D82_xqNs55tGyk`) was committed in two scraper files. It is
      removed from the tree, but it remains in git history: if it was ever a real password, change it.
- [ ] Decide the **energy bands** (`docs/DATA_LAYER.md`): ratify or change Warm/Building/Peak.
- [ ] Set real secrets in the cluster (names the chart and code share):
      `POSTGRES_PASSWORD`, `DATABASE_URL`, `RABBITMQ_PASS`, `TIDAL_CLIENT_ID`, `TIDAL_CLIENT_SECRET`,
      `LASTFM_API_KEY`, `DISCOGS_API_TOKEN`. Anything still `CHANGE_ME…` is treated as "not configured".
- [ ] Also needed by services that previously used committed defaults and now fail without them: `API_KEY_ENCRYPTION_SECRET`
      and any `MINIO_*` keys (only if you use those services).
- [ ] Run the **live provider checks** (command in `docs/DATA_LAYER.md`) with your TIDAL and Last.fm credentials and
      paste the `LIVE-REPORT` lines back. Remove any provider that does not supply what we need.
- [ ] Leave `GETSONGBPM_ENABLED=false` unless you have read its terms and are happy to show the backlink.
- [ ] Optional but recommended: `git rm -r --cached data/rabbitmq` (a committed RabbitMQ runtime directory).

## 2. Build and deploy (GitOps)

```
cd frontend && npm ci && npm run build && cd ..          # fresh dist/ is required
bash deploy/build-and-push-images.sh                      # builds rest-api and worker (corrected, repo-root context)
# Build graph-visualization-api and the frontend image as you normally do: that script's other entries still use old paths.
git push                                                  # Flux reconciles chart 0.1.15
flux reconcile source git songnodes && flux reconcile helmrelease songnodes -n flux-system
kubectl rollout restart deployment/rest-api deployment/graph-visualization deployment/worker -n songnodes   # :latest images: fresh pull
```

The chart runs `data-layer-migrate` (Helm hook, post-install / pre-upgrade) which applies migrations 012–014 idempotently.
It also creates the **new bronze columns** (`bronze_scraped_tracks.playlist_id`, `position`) that the scraper pipeline
already writes but no earlier migration created: until they exist, every scraped track insert fails.

## 2b. Local Kubernetes on Docker Desktop (instead of the k3s/Flux path)

Production is k3s deployed by Flux from `main`. For a local cluster use Docker Desktop's own Kubernetes; the repo has an
overlay and a guarded script for it (microk8s is not used).

1. Docker Desktop: **Settings > Kubernetes > Enable Kubernetes**, mode **Kubeadm** (single node). `kind` mode does not share
   Docker's image cache, so locally built images would not be found; the script refuses it.
2. If `~/.kube/config` is corrupt (it was on this machine: mixed-width line endings from an old microk8s export), move it
   aside first so Docker Desktop can write a fresh one: `mv ~/.kube/config ~/.kube/config.corrupt.bak`.
3. `kubectl config use-context docker-desktop`, then export any provider credentials you have and run
   `bash scripts/k8s-docker-desktop.sh` (add `--skip-scraper` for the data layer only, `--render-only` to just validate).

The script only runs against Docker Desktop's context, builds the images into Docker's cache, creates the Secret once
(infrastructure passwords are kept on re-runs; add provider credentials later with `--secrets-only`), installs the chart with
`values-docker-desktop.yaml` (no ingress or network policies, default `hostpath` storage, `IfNotPresent` pulls, legacy gold
cron jobs and the Ollama-dependent NLP service off) and waits. The migration hook Job now also creates the base
bronze/silver schema on an empty database. Reach services with `kubectl port-forward` (printed at the end).

## 3. Verify before scraping

```
kubectl -n songnodes logs job/data-layer-migrate                       # "data layer schema is complete"
kubectl -n songnodes exec deploy/worker -- python migrate.py --check   # exit 0
kubectl -n songnodes get pods                                          # worker, rest-api, graph, rabbitmq, postgres Running
curl -s http://<rest-api>/api/v1/outbox/status                         # consumers listed, dead_letters 0
curl -s "http://<rest-api>/api/v1/jobs?limit=5"                        # recurring ticks should be succeeding
```

If `migrate.py --check` reports missing objects, apply `sql/migrations/012`, `013`, `014` (`*_up.sql`) with `psql`; they
are safe to repeat. Roll back the data layer with `014_data_layer_down.sql` (drops what 014 added) if ever needed.

## 4. First scrape (one target, then look)

```
curl -X POST "http://<rest-api>/api/v1/scrape/trigger?source=mixesdb&search_query=Deadmau5%20Strobe" \
     -H "Idempotency-Key: first-scrape-1"
```

Use a combined **artist + title** query (CLAUDE.md). The response gives a `job_id`; follow it with
`GET /api/v1/jobs/{job_id}`. Expected sequence: `scrape` → `ingest_pending` → `projection_consume` → `enrichment_backfill`.

Then check, in order:

1. `GET /api/v1/jobs?status=dead` is empty; a `scrape` job that keeps retrying with `unified scraper unreachable` means the
   scraper service name or port differs from `UNIFIED_SCRAPER_URL` (default `http://unified-scraper:8012`).
2. Bronze got a **complete** playlist: positions `1..N`, no gaps. A playlist with gaps is recorded as `failed` in
   `silver_enriched_playlists.enrichment_metadata` (look for `position_gap` or `declared_count_exceeds_loaded`) and creates
   nothing else — that is intended.
3. `silver_track_transitions` has rows and every endpoint has a real artist (no `Unknown Artist`).
4. `GET /api/v1/metadata/review` shows what needs a human (`match_review_*`, key/BPM disagreements).
5. The frontend graph shows the nodes (`GET /api/graph/data`).

Two unknowns to watch on this first run: (a) whether the unified scraper's `/scrape` returns immediately or after finishing
(the scheduled 60-second `ingest_pending` covers the immediate case); (b) the scraper pipeline also writes silver directly —
ingestion adopts those rows, but compare transition counts against one known playlist.

## 5. Only after the first scrape looks right

- Raise `limit` and scrape more targets (`load_283_tracks.sql` / `target_tracks_master.json` hold your 283-track target list).
- Run `er_shadow`, review pairs, and keep automatic merging off until labelled pairs meet the precision gate.
- Capture the populated before/after coverage baseline with `scripts/metadata_coverage.py` (see `docs/METADATA_BASELINE.md`).

## What can go wrong

| Symptom | Likely cause |
| --- | --- |
| Scraper inserts fail on `playlist_id`/`position` | Migration 014 did not run (`migrate.py --check`) |
| Services crash at start with an auth error | A secret that used to have a committed default is not set |
| `scrape` jobs retry forever | Scraper unreachable or `search_query` missing |
| Enrichment finds nothing | Provider credentials unset/placeholder, or `ENRICHMENT_PROVIDERS` excludes them |
| Everything is `match_review_*` | Tracks lack ISRC and duration and several candidates look alike (by design: review, not guess) |
