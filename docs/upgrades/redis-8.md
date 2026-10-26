# Upgrade Redis from 7 to 8.10

This document outlines the upgrade path for the development stack's Redis service from `redis:7-alpine` to `redis:8.10-alpine`.

## What Changed
- The image in `compose.dev.yaml` was updated from `redis:7-alpine` to `redis:8.10-alpine`.
- Redis 8.10 reads Redis 7 RDB/AOF files, meaning existing development data is naturally carried over.
- We added `volumes: - /data` explicitly to the redis service definition in `compose.dev.yaml`. The `redis:8.10-alpine` Dockerfile, unlike `redis:7-alpine`, no longer automatically exposes `/data` as a volume. Adding it ensures `docker compose` properly reconnects the anonymous volume containing your existing data to the new container.

## How to Verify
To ensure that your existing Redis volume was cleanly attached and your keys survived the switch, run the following commands on your laptop:

1. Validate the setup:
   ```bash
   docker compose -f compose.dev.yaml config
   ```
2. Check that the service comes up healthy and data is preserved. Start the stack:
   ```bash
   docker compose -f compose.dev.yaml up -d redis
   ```
3. Run a test connection using `redis-cli`:
   ```bash
   docker exec songnodes-dev-redis-1 redis-cli ping
   ```
4. Verify your previously stored data exists:
   ```bash
   # Retrieve a known key or check the database size
   docker exec songnodes-dev-redis-1 redis-cli dbsize
   ```
