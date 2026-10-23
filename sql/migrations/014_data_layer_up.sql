-- Data layer: metadata columns, source evidence, review state, Camelot correction log, transactional outbox,
-- rebuildable track projection, merge/redirect history, entity-resolution shadow decisions, backfill checkpoints.
-- Idempotent (safe to reapply). Reversible with 014_data_layer_down.sql. Keeps every existing value.
BEGIN;

-- 1. Silver track metadata (platform ids, label, mix name, Camelot key, review state, canonical energy).
ALTER TABLE silver_enriched_tracks
    ADD COLUMN IF NOT EXISTS camelot_key TEXT,
    ADD COLUMN IF NOT EXISTS record_label TEXT,
    ADD COLUMN IF NOT EXISTS mix_name TEXT,
    ADD COLUMN IF NOT EXISTS tidal_id TEXT,
    ADD COLUMN IF NOT EXISTS deezer_id TEXT,
    ADD COLUMN IF NOT EXISTS apple_music_id TEXT,
    ADD COLUMN IF NOT EXISTS beatport_id TEXT,
    ADD COLUMN IF NOT EXISTS musicbrainz_id TEXT,
    ADD COLUMN IF NOT EXISTS metadata_review BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS metadata_review_reasons TEXT[] NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS energy_canonical NUMERIC(3,1),
    ADD COLUMN IF NOT EXISTS energy_source TEXT,
    ADD COLUMN IF NOT EXISTS energy_calibrated BOOLEAN,
    ADD COLUMN IF NOT EXISTS energy_contract_version TEXT;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'silver_tracks_energy_canonical_range') THEN
        ALTER TABLE silver_enriched_tracks ADD CONSTRAINT silver_tracks_energy_canonical_range
            CHECK (energy_canonical IS NULL OR (energy_canonical >= 1 AND energy_canonical <= 10));
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_silver_tracks_review ON silver_enriched_tracks (id) WHERE metadata_review;
CREATE INDEX IF NOT EXISTS idx_silver_tracks_tidal ON silver_enriched_tracks (tidal_id) WHERE tidal_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_silver_tracks_deezer ON silver_enriched_tracks (deezer_id) WHERE deezer_id IS NOT NULL;

-- Copy values already present in legacy JSONB into the new columns without removing the JSONB originals.
-- Camelot is intentionally NOT copied here: the retired converters shifted every minor key, so a stored
-- code is only trusted after the camelot_repair job recomputes it from the original key.
UPDATE silver_enriched_tracks SET
    tidal_id = COALESCE(tidal_id, NULLIF(enrichment_metadata->>'tidal_id', '')),
    deezer_id = COALESCE(deezer_id, NULLIF(enrichment_metadata->>'deezer_id', '')),
    apple_music_id = COALESCE(apple_music_id, NULLIF(enrichment_metadata->>'apple_music_id', '')),
    beatport_id = COALESCE(beatport_id, NULLIF(enrichment_metadata->>'beatport_id', '')),
    musicbrainz_id = COALESCE(musicbrainz_id, NULLIF(enrichment_metadata->>'musicbrainz_id', '')),
    record_label = COALESCE(record_label, NULLIF(COALESCE(enrichment_metadata->>'record_label', enrichment_metadata->>'label'), '')),
    mix_name = COALESCE(mix_name, NULLIF(COALESCE(enrichment_metadata->>'mix_name', enrichment_metadata->>'version'), ''))
WHERE enrichment_metadata IS NOT NULL;

-- 1b. Bronze playlist membership with positions. The scraper persistence pipeline writes these two columns but no
-- earlier migration creates them, so a fresh database would reject every scraped track.
ALTER TABLE bronze_scraped_tracks
    ADD COLUMN IF NOT EXISTS playlist_id UUID REFERENCES bronze_scraped_playlists(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS position INTEGER;
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bronze_tracks_position_positive') THEN
        ALTER TABLE bronze_scraped_tracks ADD CONSTRAINT bronze_tracks_position_positive
            CHECK (position IS NULL OR position >= 1);
    END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_bronze_tracks_playlist ON bronze_scraped_tracks (playlist_id, position) WHERE playlist_id IS NOT NULL;
-- One occurrence per position per playlist; skipped (with a notice) if legacy rows already violate it.
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM bronze_scraped_tracks WHERE playlist_id IS NOT NULL GROUP BY playlist_id, position HAVING count(*) > 1) THEN
        RAISE NOTICE 'bronze_scraped_tracks has duplicate (playlist_id, position); uq_bronze_tracks_playlist_position not created';
    ELSE
        CREATE UNIQUE INDEX IF NOT EXISTS uq_bronze_tracks_playlist_position ON bronze_scraped_tracks (playlist_id, position)
            WHERE playlist_id IS NOT NULL AND position IS NOT NULL;
    END IF;
    IF EXISTS (SELECT 1 FROM silver_enriched_playlists WHERE bronze_id IS NOT NULL GROUP BY bronze_id HAVING count(*) > 1) THEN
        RAISE NOTICE 'silver_enriched_playlists has duplicate bronze_id; uq_silver_playlists_bronze not created';
    ELSE
        CREATE UNIQUE INDEX IF NOT EXISTS uq_silver_playlists_bronze ON silver_enriched_playlists (bronze_id) WHERE bronze_id IS NOT NULL;
    END IF;
END $$;

-- 2. Source evidence: every provider/method measurement is kept, never overwritten.
CREATE TABLE IF NOT EXISTS silver_track_metadata_evidence (
    id BIGSERIAL PRIMARY KEY,
    track_id UUID NOT NULL REFERENCES silver_enriched_tracks(id) ON DELETE CASCADE,
    field TEXT NOT NULL CHECK (field IN ('bpm', 'key', 'energy', 'isrc', 'duration_ms', 'mix_name', 'genre',
                                         'record_label', 'tidal_id', 'deezer_id', 'musicbrainz_id')),
    value JSONB NOT NULL,
    raw JSONB,
    source TEXT NOT NULL CHECK (length(trim(source)) > 0),
    method TEXT NOT NULL DEFAULT 'provider',
    method_version TEXT NOT NULL DEFAULT '',
    independent_group TEXT NOT NULL,
    confidence NUMERIC(4,3) CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
    contract_version TEXT,
    measured_at TIMESTAMPTZ,
    retrieved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (track_id, field, source, method, method_version, value)
);
CREATE INDEX IF NOT EXISTS idx_metadata_evidence_track ON silver_track_metadata_evidence (track_id, field);

-- Lists only fields the resolver flagged (reason prefixed with the field name), not every field whose raw
-- readings differ: BPMs of 64 and 128 agree once folded for a house track.
CREATE OR REPLACE VIEW v_metadata_conflicts AS
SELECT t.id AS track_id, t.artist_name, t.track_title, t.metadata_review_reasons, e.field,
       jsonb_agg(jsonb_build_object('source', e.source, 'independent_group', e.independent_group,
                                    'method', e.method, 'value', e.value) ORDER BY e.source, e.method) AS evidence
FROM silver_enriched_tracks t
JOIN silver_track_metadata_evidence e ON e.track_id = t.id
WHERE t.metadata_review
  AND EXISTS (SELECT 1 FROM unnest(t.metadata_review_reasons) reason WHERE starts_with(reason, e.field || '_'))
GROUP BY t.id, t.artist_name, t.track_title, t.metadata_review_reasons, e.field
HAVING count(DISTINCT e.value) > 1;

-- 3. Camelot correction log (reversible: originals are retained).
CREATE TABLE IF NOT EXISTS silver_camelot_corrections (
    track_id UUID PRIMARY KEY REFERENCES silver_enriched_tracks(id) ON DELETE CASCADE,
    original_camelot TEXT,
    original_key TEXT,
    recomputed_camelot TEXT,
    status TEXT NOT NULL CHECK (status IN ('unchanged', 'derived', 'corrected', 'unrecoverable')),
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reverted_at TIMESTAMPTZ
);

-- 4. Transactional outbox. Consumers read in (txid, id) order and only transactions older than every
-- in-flight transaction, so a late-committing writer can never be skipped.
CREATE TABLE IF NOT EXISTS outbox_events (
    id BIGSERIAL PRIMARY KEY,
    txid BIGINT NOT NULL DEFAULT (pg_current_xact_id()::text::bigint),
    aggregate_type TEXT NOT NULL,
    aggregate_id UUID NOT NULL,
    event_type TEXT NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_outbox_order ON outbox_events (txid, id);
CREATE INDEX IF NOT EXISTS idx_outbox_aggregate ON outbox_events (aggregate_type, aggregate_id);

CREATE TABLE IF NOT EXISTS outbox_consumers (
    consumer TEXT PRIMARY KEY,
    last_txid BIGINT NOT NULL DEFAULT 0,
    last_id BIGINT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS outbox_dead_letters (
    id BIGSERIAL PRIMARY KEY,
    consumer TEXT NOT NULL,
    event_id BIGINT NOT NULL,
    event JSONB NOT NULL,
    error TEXT NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (consumer, event_id)
);

-- 5. Rebuildable read model of the catalog (the first projection consumer).
CREATE TABLE IF NOT EXISTS projection_tracks (
    track_id UUID PRIMARY KEY,
    artist_name TEXT NOT NULL,
    track_title TEXT NOT NULL,
    bpm NUMERIC(6,2),
    key TEXT,
    camelot_key TEXT,
    energy_canonical NUMERIC(3,1),
    energy_band TEXT,
    energy_calibrated BOOLEAN,
    energy_contract_version TEXT,
    genre TEXT[],
    record_label TEXT,
    mix_name TEXT,
    isrc TEXT,
    tidal_id TEXT,
    deezer_id TEXT,
    duration_ms INTEGER,
    metadata_review BOOLEAN NOT NULL DEFAULT FALSE,
    source_updated_at TIMESTAMP,
    projected_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_projection_tracks_band ON projection_tracks (energy_band) WHERE energy_band IS NOT NULL;

-- 6. Stable identities across merges: redirects plus a reversible history.
CREATE TABLE IF NOT EXISTS entity_merge_history (
    id BIGSERIAL PRIMARY KEY,
    entity_type TEXT NOT NULL CHECK (entity_type IN ('track', 'artist')),
    survivor_id UUID NOT NULL,
    duplicate_id UUID NOT NULL,
    snapshot JSONB NOT NULL,
    reason TEXT,
    merged_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reverted_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_merge_history_duplicate ON entity_merge_history (entity_type, duplicate_id);

CREATE TABLE IF NOT EXISTS entity_redirects (
    entity_type TEXT NOT NULL CHECK (entity_type IN ('track', 'artist')),
    old_id UUID NOT NULL,
    new_id UUID NOT NULL,
    history_id BIGINT NOT NULL REFERENCES entity_merge_history(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (entity_type, old_id),
    CHECK (old_id <> new_id)
);

-- 7. Entity-resolution decisions (shadow mode first) and resumable backfill checkpoints.
CREATE TABLE IF NOT EXISTS er_decisions (
    id BIGSERIAL PRIMARY KEY,
    entity_type TEXT NOT NULL CHECK (entity_type IN ('track', 'artist')),
    left_id UUID NOT NULL,
    right_id UUID NOT NULL,
    score DOUBLE PRECISION NOT NULL,
    decision TEXT NOT NULL CHECK (decision IN ('auto_match', 'review', 'reject')),
    method TEXT NOT NULL,
    model_version TEXT NOT NULL,
    mode TEXT NOT NULL DEFAULT 'shadow' CHECK (mode IN ('shadow', 'active')),
    features JSONB NOT NULL DEFAULT '{}'::jsonb,
    reviewed_outcome TEXT CHECK (reviewed_outcome IN ('same', 'different')),
    decided_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (left_id < right_id),
    UNIQUE (entity_type, left_id, right_id, method, model_version)
);

CREATE TABLE IF NOT EXISTS backfill_checkpoints (
    name TEXT PRIMARY KEY,
    cursor JSONB NOT NULL DEFAULT '{}'::jsonb,
    processed BIGINT NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'complete', 'failed')),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. Waterfall configuration: Spotify no longer supplies BPM, key, energy, danceability or valence.
DO $$ BEGIN
    IF to_regclass('metadata_enrichment_config') IS NOT NULL THEN
        DELETE FROM metadata_enrichment_config WHERE metadata_field = 'valence' AND priority_1_provider = 'spotify'
            AND priority_2_provider IS NULL;
        UPDATE metadata_enrichment_config SET
            priority_1_provider = 'beatport', priority_1_confidence = 0.98,
            priority_2_provider = 'acousticbrainz', priority_2_confidence = 0.75,
            priority_3_provider = 'mixesdb', priority_3_confidence = 0.60,
            priority_4_provider = NULL, priority_4_confidence = NULL
        WHERE metadata_field = 'bpm' AND 'spotify' IN (priority_1_provider, priority_2_provider, priority_3_provider, priority_4_provider);
        UPDATE metadata_enrichment_config SET
            priority_1_provider = 'beatport', priority_1_confidence = 0.95,
            priority_2_provider = 'acousticbrainz', priority_2_confidence = 0.70,
            priority_3_provider = 'mixesdb', priority_3_confidence = 0.60,
            priority_4_provider = NULL, priority_4_confidence = NULL
        WHERE metadata_field = 'key' AND 'spotify' IN (priority_1_provider, priority_2_provider, priority_3_provider, priority_4_provider);
        UPDATE metadata_enrichment_config SET
            priority_1_provider = 'acousticbrainz', priority_1_confidence = 0.75,
            priority_2_provider = NULL, priority_2_confidence = NULL,
            priority_3_provider = NULL, priority_3_confidence = NULL,
            priority_4_provider = NULL, priority_4_confidence = NULL
        WHERE metadata_field IN ('energy', 'danceability') AND priority_1_provider = 'spotify';
    END IF;
    IF to_regclass('enrichment_providers') IS NOT NULL THEN
        UPDATE enrichment_providers SET supported_fields = ARRAY['spotify_id', 'isrc', 'release_date', 'duration_ms', 'genre']
        WHERE provider_name = 'spotify';
    END IF;
END $$;

COMMIT;
