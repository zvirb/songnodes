# Music Search

The REST API's `/api/v1/music-search/{service}` endpoint (where `service` is `spotify` or `tidal`) acts as a proxy for the upstream metadata enrichment service.

## Local Configuration

When running locally, you must provide real API credentials for TIDAL and Spotify. The credentials should **never** be committed to source control. To set credentials locally without committing them:

1. Create a file named `.env` in the repository root (next to `compose.dev.yaml`). Note: `.env` is ignored by Git.
2. Add your credentials to this file:
   ```env
   TIDAL_CLIENT_ID=your_client_id
   TIDAL_CLIENT_SECRET=your_client_secret
   # or for Spotify
   SPOTIFY_CLIENT_ID=your_client_id
   SPOTIFY_CLIENT_SECRET=your_client_secret
   ```
   Alternatively, you can export them directly in your local shell session before starting the dev stack:
   ```bash
   export TIDAL_CLIENT_ID=your_client_id
   export TIDAL_CLIENT_SECRET=your_client_secret
   ```

## Check Configuration

You can verify that your local service is functioning and correctly rejecting unconfigured credentials by using `curl`. When no credentials are provided, the endpoint will proxy the upstream `424 Failed Dependency` status with a descriptive detail message (instead of returning mock data).

To check:
```bash
curl http://localhost:8082/api/v1/music-search/tidal?q=test
```

Expected result with no credentials configured:
```json
{"detail": {"detail": "Tidal credentials not configured"}}
```
Note that it will return `424`, confirming that the REST API proxy passes real results and real errors directly through.
