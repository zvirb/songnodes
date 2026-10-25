-- Migration 101_library_schema_up.sql

CREATE SCHEMA IF NOT EXISTS library;

-- Overlay tables keyed to silver_enriched_tracks(id)

CREATE TABLE library.tracks (
    id uuid PRIMARY KEY, -- references silver_enriched_tracks(id)
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE library.appearances (
    id bigserial PRIMARY KEY,
    track_id uuid NOT NULL,
    source text NOT NULL,
    date timestamp with time zone,
    chart_rank integer,
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE library.rotation_history (
    id bigserial PRIMARY KEY,
    track_id uuid NOT NULL,
    rotation text NOT NULL,
    changed_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE library.chart_positions (
    id bigserial PRIMARY KEY,
    track_id uuid NOT NULL,
    chart_name text NOT NULL,
    position integer NOT NULL,
    date timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE library.pending (
    id bigserial PRIMARY KEY,
    track_id uuid NOT NULL,
    reason text,
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE library.rejected (
    id bigserial PRIMARY KEY,
    track_id uuid NOT NULL,
    reason text,
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE library.beatport_check (
    id bigserial PRIMARY KEY,
    track_id uuid NOT NULL,
    checked_at timestamp with time zone NOT NULL,
    result jsonb,
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE library.sources (
    id bigserial PRIMARY KEY,
    name text NOT NULL,
    type text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE library.sets (
    id bigserial PRIMARY KEY,
    name text NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE library.set_tracks (
    set_id bigint NOT NULL,
    track_id uuid NOT NULL,
    position integer NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    PRIMARY KEY (set_id, track_id)
);

CREATE TABLE library.runs (
    id bigserial PRIMARY KEY,
    run_date timestamp with time zone NOT NULL,
    status text NOT NULL,
    metrics jsonb,
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE library.track_tags (
    track_id uuid NOT NULL,
    tag text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    PRIMARY KEY (track_id, tag)
);

CREATE TABLE library.track_xref (
    source_system text NOT NULL,
    source_id text NOT NULL,
    canonical_id uuid NOT NULL,
    confidence float NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    PRIMARY KEY (source_system, source_id)
);

-- Views

CREATE VIEW library.v_crates AS
SELECT t.id AS track_id, r.rotation
FROM library.tracks t
JOIN library.rotation_history r ON t.id = r.track_id
WHERE r.changed_at = (
    SELECT MAX(changed_at) FROM library.rotation_history WHERE track_id = t.id
);

CREATE VIEW library.v_source_yield AS
SELECT source, count(*) as track_count
FROM library.appearances
GROUP BY source;

CREATE VIEW library.v_review_queue AS
SELECT track_id, reason
FROM library.pending;

CREATE VIEW library.v_buy_list AS
SELECT track_id
FROM library.tracks t
WHERE NOT EXISTS (SELECT 1 FROM library.rejected WHERE track_id = t.id)
  AND NOT EXISTS (SELECT 1 FROM library.pending WHERE track_id = t.id);

-- Energy Model Plug Point
CREATE TABLE library.energy_model (
    track_id uuid PRIMARY KEY,
    energy_score float,
    computed_at timestamp with time zone DEFAULT now()
);
