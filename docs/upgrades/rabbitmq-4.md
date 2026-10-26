# Upgrading RabbitMQ to 4.x in the Development Stack

RabbitMQ 3.13 requires a multi-step rolling upgrade to reach 4.3 (3.13 -> 4.2 -> 4.3) and mandates that all stable feature flags are enabled prior to upgrading. Since `compose.dev.yaml` performs a direct version jump for local development, an in-place upgrade of the existing anonymous volume is not supported.

Instead, the `compose.dev.yaml` stack has been updated to use the `rabbitmq:4.3-alpine` image with a new named volume (`dev-rabbitmq-4`).

## What this means for local development

* **Queues start empty:** When you start the stack with `docker compose up`, RabbitMQ 4.3 will boot with a fresh data directory. Any non-durable messages from your previous 3.13 volume are gone.
* **Durable work is replayed:** The outbox in Postgres replays durable work automatically, so no persistent data is permanently lost.
* **The old volume remains:** Your old 3.13 anonymous volume is never deleted by this process. If you ever need it, it remains accessible via Docker volumes.

## Steps to adopt this upgrade

No manual data migration is required or supported. Simply pull the latest changes and start the stack:

```bash
# Optional: remove the old container to avoid conflict if you ran it manually
docker compose -f compose.dev.yaml rm -s -v rabbitmq

# Start the stack; docker compose will create the new `dev-rabbitmq-4` volume automatically
bash scripts/start-dev.sh
```

If you previously mapped a host directory for RabbitMQ data, simply leave it as is; the stack now relies on the `dev-rabbitmq-4` volume managed by Docker.
