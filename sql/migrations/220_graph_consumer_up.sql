-- Migration 220: Graph projection outbox consumer
BEGIN;

INSERT INTO outbox_consumers (consumer)
VALUES ('graph_projection')
ON CONFLICT (consumer) DO NOTHING;

COMMIT;
