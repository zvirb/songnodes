-- Durable job records for slow ingestion work. Workers claim rows with FOR UPDATE SKIP LOCKED;
-- (kind, idempotency_key) makes retried submissions return the existing job. Safe to reapply.
BEGIN;
CREATE TABLE IF NOT EXISTS ingestion_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kind TEXT NOT NULL CHECK (length(trim(kind)) > 0),
    idempotency_key TEXT NOT NULL CHECK (length(trim(idempotency_key)) > 0),
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'succeeded', 'dead')),
    attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
    max_attempts INTEGER NOT NULL DEFAULT 3 CHECK (max_attempts >= 1),
    run_after TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    finished_at TIMESTAMPTZ,
    last_error TEXT,
    result JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (kind, idempotency_key)
);
CREATE INDEX IF NOT EXISTS idx_ingestion_jobs_claim ON ingestion_jobs (status, run_after);
CREATE INDEX IF NOT EXISTS idx_ingestion_jobs_created ON ingestion_jobs (created_at DESC);
COMMIT;
