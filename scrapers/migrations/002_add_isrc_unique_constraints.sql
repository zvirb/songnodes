-- Migration: 002_add_isrc_unique_constraints
-- Description: Add unique constraints and indexes on ISRC and Spotify ID for tracks
-- Author: Schema Database Expert Agent
-- Date: 2025-10-02
-- Version: 1.0.0
-- Breaking Change: YES - requires deduplication before constraint addition
-- Idempotent: YES - can be run multiple times safely

-- ===========================================
-- SAFETY CHECKS
-- ===========================================

-- Set safe execution mode
SET client_min_messages TO NOTICE;
SET search_path TO musicdb, public;

-- Create migration tracking table if not exists
CREATE TABLE IF NOT EXISTS schema_migrations (
    id SERIAL PRIMARY KEY,
    migration_name VARCHAR(255) NOT NULL UNIQUE,
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    rollback_available BOOLEAN DEFAULT TRUE,
    description TEXT
);

-- Check if migration already applied
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM schema_migrations WHERE migration_name = '002_add_isrc_unique_constraints') THEN
        RAISE NOTICE 'Migration 002_add_isrc_unique_constraints already applied. Skipping.';
        -- Exit early if already applied (idempotent)
        RETURN;
    END IF;
END $$;

-- ===========================================
-- STEP 1: ANALYZE EXISTING DUPLICATES
-- ===========================================

RAISE NOTICE '===========================================';
RAISE NOTICE 'STEP 1: Analyzing existing duplicates';
RAISE NOTICE '===========================================';

-- Create temporary table for duplicate analysis
CREATE TEMPORARY TABLE duplicate_analysis (
    duplicate_type VARCHAR(20),
    identifier VARCHAR(100),
    duplicate_count INTEGER,
    track_ids UUID[]
);

-- Find duplicate ISRCs
INSERT INTO duplicate_analysis (duplicate_type, identifier, duplicate_count, track_ids)
SELECT
    'ISRC' AS duplicate_type,
    isrc AS identifier,
    COUNT(*) AS duplicate_count,
    ARRAY_AGG(id ORDER BY
        -- Prioritize records with more data (rank by completeness)
        (CASE WHEN spotify_id IS NOT NULL THEN 1 ELSE 0 END +
         CASE WHEN duration_ms IS NOT NULL THEN 1 ELSE 0 END +
         CASE WHEN bpm IS NOT NULL THEN 1 ELSE 0 END +
         CASE WHEN key IS NOT NULL THEN 1 ELSE 0 END +
         CASE WHEN release_date IS NOT NULL THEN 1 ELSE 0 END +
         CASE WHEN genre IS NOT NULL THEN 1 ELSE 0 END) DESC,
        created_at ASC  -- Older records preferred if equally complete
    ) AS track_ids
FROM tracks
WHERE isrc IS NOT NULL
GROUP BY isrc
HAVING COUNT(*) > 1;

-- Find duplicate Spotify IDs
INSERT INTO duplicate_analysis (duplicate_type, identifier, duplicate_count, track_ids)
SELECT
    'SPOTIFY_ID' AS duplicate_type,
    spotify_id AS identifier,
    COUNT(*) AS duplicate_count,
    ARRAY_AGG(id ORDER BY
        (CASE WHEN isrc IS NOT NULL THEN 1 ELSE 0 END +
         CASE WHEN duration_ms IS NOT NULL THEN 1 ELSE 0 END +
         CASE WHEN bpm IS NOT NULL THEN 1 ELSE 0 END +
         CASE WHEN key IS NOT NULL THEN 1 ELSE 0 END +
         CASE WHEN release_date IS NOT NULL THEN 1 ELSE 0 END +
         CASE WHEN genre IS NOT NULL THEN 1 ELSE 0 END) DESC,
        created_at ASC
    ) AS track_ids
FROM tracks
WHERE spotify_id IS NOT NULL
GROUP BY spotify_id
HAVING COUNT(*) > 1;

-- Report duplicate statistics
DO $$
DECLARE
    isrc_duplicates INTEGER;
    spotify_duplicates INTEGER;
    total_affected_tracks INTEGER;
BEGIN
    SELECT COUNT(*) INTO isrc_duplicates FROM duplicate_analysis WHERE duplicate_type = 'ISRC';
    SELECT COUNT(*) INTO spotify_duplicates FROM duplicate_analysis WHERE duplicate_type = 'SPOTIFY_ID';
    SELECT SUM(duplicate_count) INTO total_affected_tracks FROM duplicate_analysis;

    RAISE NOTICE 'Found % duplicate ISRC groups', isrc_duplicates;
    RAISE NOTICE 'Found % duplicate Spotify ID groups', spotify_duplicates;
    RAISE NOTICE 'Total affected tracks: %', COALESCE(total_affected_tracks, 0);

    IF isrc_duplicates > 0 OR spotify_duplicates > 0 THEN
        RAISE NOTICE 'Duplicate details saved to duplicate_analysis table for review';
    END IF;
END $$;

-- ===========================================
-- STEP 2: MERGE DUPLICATE RELATIONSHIPS
-- ===========================================

RAISE NOTICE '===========================================';
RAISE NOTICE 'STEP 2: Merging relationships from duplicates';
RAISE NOTICE '===========================================';

-- Create backup tables for safety
CREATE TEMPORARY TABLE track_artists_backup AS SELECT * FROM track_artists;
CREATE TEMPORARY TABLE setlist_tracks_backup AS SELECT * FROM setlist_tracks;
CREATE TEMPORARY TABLE playlist_tracks_backup AS SELECT * FROM playlist_tracks;
CREATE TEMPORARY TABLE album_tracks_backup AS SELECT * FROM album_tracks;

-- Merge track_artists relationships
DO $$
DECLARE
    dup_record RECORD;
    keeper_id UUID;
    duplicate_id UUID;
    merged_count INTEGER := 0;
BEGIN
    FOR dup_record IN SELECT * FROM duplicate_analysis LOOP
        -- First track ID in array is the keeper (most complete)
        keeper_id := dup_record.track_ids[1];

        -- Merge all other track IDs into the keeper
        FOR i IN 2..array_length(dup_record.track_ids, 1) LOOP
            duplicate_id := dup_record.track_ids[i];

            -- Migrate track_artists relationships
            INSERT INTO track_artists (track_id, artist_id, role, position, created_at)
            SELECT keeper_id, artist_id, role, position, created_at
            FROM track_artists
            WHERE track_id = duplicate_id
            ON CONFLICT (track_id, artist_id, role) DO NOTHING;

            -- Migrate setlist_tracks relationships
            UPDATE setlist_tracks
            SET track_id = keeper_id
            WHERE track_id = duplicate_id
            ON CONFLICT (setlist_id, position) DO NOTHING;

            -- Migrate playlist_tracks relationships
            UPDATE playlist_tracks
            SET track_id = keeper_id
            WHERE track_id = duplicate_id
            ON CONFLICT (playlist_id, track_id) DO NOTHING;

            -- Migrate album_tracks relationships (if exists)
            IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'album_tracks') THEN
                UPDATE album_tracks
                SET track_id = keeper_id
                WHERE track_id = duplicate_id
                ON CONFLICT (album_id, track_id) DO NOTHING;
            END IF;

            merged_count := merged_count + 1;
        END LOOP;
    END LOOP;

    RAISE NOTICE 'Merged relationships for % duplicate tracks', merged_count;
END $$;

-- ===========================================
-- STEP 3: MERGE METADATA FROM DUPLICATES
-- ===========================================

RAISE NOTICE '===========================================';
RAISE NOTICE 'STEP 3: Merging metadata into keeper records';
RAISE NOTICE '===========================================';

DO $$
DECLARE
    dup_record RECORD;
    keeper_id UUID;
    duplicate_id UUID;
    merged_metadata_count INTEGER := 0;
BEGIN
    FOR dup_record IN SELECT * FROM duplicate_analysis LOOP
        keeper_id := dup_record.track_ids[1];

        -- Merge metadata from all duplicates using COALESCE (prefer non-null values)
        FOR i IN 2..array_length(dup_record.track_ids, 1) LOOP
            duplicate_id := dup_record.track_ids[i];

            UPDATE tracks keeper
            SET
                -- Prefer non-null values from duplicates
                title = COALESCE(keeper.title, dup.title),
                normalized_title = COALESCE(keeper.normalized_title, dup.normalized_title),
                duration_ms = COALESCE(keeper.duration_ms, dup.duration_ms),
                bpm = COALESCE(keeper.bpm, dup.bpm),
                key = COALESCE(keeper.key, dup.key),
                energy = COALESCE(keeper.energy, dup.energy),
                danceability = COALESCE(keeper.danceability, dup.danceability),
                valence = COALESCE(keeper.valence, dup.valence),
                release_date = COALESCE(keeper.release_date, dup.release_date),
                genre = COALESCE(keeper.genre, dup.genre),
                subgenre = COALESCE(keeper.subgenre, dup.subgenre),
                apple_music_id = COALESCE(keeper.apple_music_id, dup.apple_music_id),
                tidal_id = COALESCE(keeper.tidal_id, dup.tidal_id),
                is_remix = COALESCE(keeper.is_remix, dup.is_remix),
                is_mashup = COALESCE(keeper.is_mashup, dup.is_mashup),
                is_live = COALESCE(keeper.is_live, dup.is_live),
                is_cover = COALESCE(keeper.is_cover, dup.is_cover),
                -- Merge JSONB metadata fields
                metadata = COALESCE(keeper.metadata, '{}'::jsonb) || COALESCE(dup.metadata, '{}'::jsonb),
                mashup_components = COALESCE(keeper.mashup_components, dup.mashup_components),
                updated_at = CURRENT_TIMESTAMP
            FROM tracks dup
            WHERE keeper.id = keeper_id
            AND dup.id = duplicate_id;

            merged_metadata_count := merged_metadata_count + 1;
        END LOOP;
    END LOOP;

    RAISE NOTICE 'Merged metadata for % duplicate tracks', merged_metadata_count;
END $$;

-- ===========================================
-- STEP 4: DELETE DUPLICATE RECORDS
-- ===========================================

RAISE NOTICE '===========================================';
RAISE NOTICE 'STEP 4: Deleting duplicate records';
RAISE NOTICE '===========================================';

-- Create audit log of deleted tracks
CREATE TABLE IF NOT EXISTS deleted_duplicate_tracks (
    original_id UUID NOT NULL,
    merged_into_id UUID NOT NULL,
    duplicate_type VARCHAR(20),
    identifier VARCHAR(100),
    deleted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    original_data JSONB
);

-- Log and delete duplicates
DO $$
DECLARE
    dup_record RECORD;
    keeper_id UUID;
    duplicate_id UUID;
    deleted_count INTEGER := 0;
BEGIN
    FOR dup_record IN SELECT * FROM duplicate_analysis LOOP
        keeper_id := dup_record.track_ids[1];

        -- Delete all duplicates (keep only the first/best record)
        FOR i IN 2..array_length(dup_record.track_ids, 1) LOOP
            duplicate_id := dup_record.track_ids[i];

            -- Log the deletion
            INSERT INTO deleted_duplicate_tracks (original_id, merged_into_id, duplicate_type, identifier, original_data)
            SELECT
                id,
                keeper_id,
                dup_record.duplicate_type,
                dup_record.identifier,
                to_jsonb(tracks.*) - 'search_vector'  -- Exclude tsvector type
            FROM tracks
            WHERE id = duplicate_id;

            -- Delete the duplicate track (CASCADE will handle relationships)
            DELETE FROM tracks WHERE id = duplicate_id;

            deleted_count := deleted_count + 1;
        END LOOP;
    END LOOP;

    RAISE NOTICE 'Deleted % duplicate track records', deleted_count;
    RAISE NOTICE 'Audit log saved to deleted_duplicate_tracks table';
END $$;

-- ===========================================
-- STEP 5: ADD UNIQUE CONSTRAINTS
-- ===========================================

RAISE NOTICE '===========================================';
RAISE NOTICE 'STEP 5: Adding unique constraints';
RAISE NOTICE '===========================================';

-- Add unique constraint on ISRC (partial index - only non-null values)
DO $$
BEGIN
    -- Drop existing index if it exists (in case it was created without unique)
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_tracks_isrc') THEN
        DROP INDEX IF EXISTS idx_tracks_isrc;
        RAISE NOTICE 'Dropped existing non-unique idx_tracks_isrc index';
    END IF;

    -- Create unique index on ISRC
    CREATE UNIQUE INDEX idx_tracks_isrc_unique ON tracks(isrc) WHERE isrc IS NOT NULL;
    RAISE NOTICE 'Created unique index on tracks.isrc';

EXCEPTION
    WHEN unique_violation THEN
        RAISE EXCEPTION 'Unique constraint violation detected! Please review duplicate_analysis table and re-run deduplication.';
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Error creating ISRC unique index: %', SQLERRM;
END $$;

-- Add unique constraint on Spotify ID (partial index - only non-null values)
DO $$
BEGIN
    -- Drop existing index if it exists
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_tracks_spotify_id') THEN
        DROP INDEX IF EXISTS idx_tracks_spotify_id;
        RAISE NOTICE 'Dropped existing non-unique idx_tracks_spotify_id index';
    END IF;

    -- Create unique index on Spotify ID
    CREATE UNIQUE INDEX idx_tracks_spotify_id_unique ON tracks(spotify_id) WHERE spotify_id IS NOT NULL;
    RAISE NOTICE 'Created unique index on tracks.spotify_id';

EXCEPTION
    WHEN unique_violation THEN
        RAISE EXCEPTION 'Unique constraint violation detected! Please review duplicate_analysis table and re-run deduplication.';
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Error creating Spotify ID unique index: %', SQLERRM;
END $$;

-- ===========================================
-- STEP 6: ADD PERFORMANCE INDEXES
-- ===========================================

RAISE NOTICE '===========================================';
RAISE NOTICE 'STEP 6: Adding performance indexes';
RAISE NOTICE '===========================================';

-- Add index for fast ISRC lookups (if not covered by unique index)
-- Note: The unique index above already provides this, but we can add covering index if needed
CREATE INDEX IF NOT EXISTS idx_tracks_isrc_lookup
ON tracks(isrc, id, title, normalized_title)
WHERE isrc IS NOT NULL;
RAISE NOTICE 'Created covering index for ISRC lookups';

-- Add index for fast Spotify ID lookups
CREATE INDEX IF NOT EXISTS idx_tracks_spotify_id_lookup
ON tracks(spotify_id, id, title, normalized_title)
WHERE spotify_id IS NOT NULL;
RAISE NOTICE 'Created covering index for Spotify ID lookups';

-- Add composite index for upsert fallback (title + normalized_title)
CREATE INDEX IF NOT EXISTS idx_tracks_title_normalized_composite
ON tracks(title, normalized_title);
RAISE NOTICE 'Created composite index for title-based lookups';

-- ===========================================
-- STEP 7: RECORD MIGRATION
-- ===========================================

RAISE NOTICE '===========================================';
RAISE NOTICE 'STEP 7: Recording migration';
RAISE NOTICE '===========================================';

-- Record migration in tracking table
INSERT INTO schema_migrations (migration_name, description, rollback_available)
VALUES (
    '002_add_isrc_unique_constraints',
    'Add unique constraints and indexes on ISRC and Spotify ID. Deduplicated existing records.',
    TRUE
)
ON CONFLICT (migration_name) DO NOTHING;

-- ===========================================
-- FINAL VERIFICATION
-- ===========================================

RAISE NOTICE '===========================================';
RAISE NOTICE 'FINAL VERIFICATION';
RAISE NOTICE '===========================================';

DO $$
DECLARE
    isrc_count INTEGER;
    spotify_id_count INTEGER;
    duplicate_isrc INTEGER;
    duplicate_spotify INTEGER;
BEGIN
    -- Count tracks with ISRC
    SELECT COUNT(*) INTO isrc_count FROM tracks WHERE isrc IS NOT NULL;

    -- Count tracks with Spotify ID
    SELECT COUNT(*) INTO spotify_id_count FROM tracks WHERE spotify_id IS NOT NULL;

    -- Verify no duplicates remain
    SELECT COUNT(*) INTO duplicate_isrc
    FROM (
        SELECT isrc FROM tracks WHERE isrc IS NOT NULL GROUP BY isrc HAVING COUNT(*) > 1
    ) dups;

    SELECT COUNT(*) INTO duplicate_spotify
    FROM (
        SELECT spotify_id FROM tracks WHERE spotify_id IS NOT NULL GROUP BY spotify_id HAVING COUNT(*) > 1
    ) dups;

    RAISE NOTICE 'Tracks with ISRC: %', isrc_count;
    RAISE NOTICE 'Tracks with Spotify ID: %', spotify_id_count;
    RAISE NOTICE 'Duplicate ISRCs remaining: % (should be 0)', duplicate_isrc;
    RAISE NOTICE 'Duplicate Spotify IDs remaining: % (should be 0)', duplicate_spotify;

    IF duplicate_isrc > 0 OR duplicate_spotify > 0 THEN
        RAISE EXCEPTION 'Migration verification failed! Duplicates still exist.';
    END IF;

    RAISE NOTICE '✓ Migration 002_add_isrc_unique_constraints completed successfully';
END $$;

-- Clean up temporary tables
DROP TABLE IF EXISTS duplicate_analysis;

RAISE NOTICE '===========================================';
RAISE NOTICE 'Migration complete!';
RAISE NOTICE 'Review deleted_duplicate_tracks table for audit trail';
RAISE NOTICE '===========================================';
