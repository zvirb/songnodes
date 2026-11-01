-- Migration 260_scrape_window_up.sql (DS24B)
-- One row: the Melbourne calendar days (inclusive) on which the hourly target scrape may queue jobs.
-- Both dates null, or no row, means no window: scheduled scrapes run every day. One date alone is open-ended.
-- Manual scrapes (POST /api/v1/scrape/trigger) never read this. Idempotent.

CREATE TABLE IF NOT EXISTS scrape_window (
    id BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (id),
    starts_on DATE NULL,
    ends_on DATE NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT scrape_window_order CHECK (starts_on IS NULL OR ends_on IS NULL OR starts_on <= ends_on)
);
