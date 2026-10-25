-- Migration 220 Down
BEGIN;

DELETE FROM outbox_consumers WHERE consumer = 'graph_projection';

COMMIT;
