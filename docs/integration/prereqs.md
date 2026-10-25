# Prerequisites for Integration

## Infrastructure
- **Postgres**: Run via Docker Compose. Needs superuser for `pg_trgm` extension if not already present.
- **Memgraph**: Run via Docker Compose for graph projections.
- **Redis**: Run via Docker Compose for job queue and caching.
- Re-use the existing songnodes Docker Compose stack (`docker compose -f compose.dev.yaml up -d`).

## Python Dependencies (Per Package)
- `rapidfuzz` (string matching)
- `unidecode` (text normalization)
- `jsonschema` (event validation)
- `zstandard` (handling `.zst` files)
- `pymemgraph` or relevant Memgraph client

## API Configuration
- The API URL and token for the pipeline are provided via environment variables (e.g., `SONGNODES_API_TOKEN`) or in `config/songnodes.json`. No secrets should be stored in files.
