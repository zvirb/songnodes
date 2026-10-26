BEGIN;

CREATE TABLE IF NOT EXISTS web_call_log (
    id BIGSERIAL PRIMARY KEY,
    provider TEXT NOT NULL,
    endpoint TEXT NOT NULL,
    field TEXT,
    run_id TEXT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    status INTEGER,
    duration_ms INTEGER
);

CREATE INDEX IF NOT EXISTS idx_web_call_log_provider ON web_call_log(provider);
CREATE INDEX IF NOT EXISTS idx_web_call_log_run_id ON web_call_log(run_id);

COMMIT;
