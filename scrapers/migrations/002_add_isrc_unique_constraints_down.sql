-- Rollback Migration: 002_add_isrc_unique_constraints_down
-- Description: Rollback unique constraints on ISRC and Spotify ID
-- Author: Schema Database Expert Agent
-- Date: 2025-10-02
-- Version: 1.0.0
-- WARNING: This rollback does NOT restore deleted duplicate records!
--          Check deleted_duplicate_tracks table to manually restore if needed.

-- ===========================================
-- SAFETY CHECKS
-- ===========================================

SET client_min_messages TO NOTICE;
SET search_path TO musicdb, public;

RAISE NOTICE '===========================================';
RAISE NOTICE 'ROLLBACK: 002_add_isrc_unique_constraints';
RAISE NOTICE '===========================================';

-- Verify migration was applied
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM schema_migrations WHERE migration_name = '002_add_isrc_unique_constraints') THEN
        RAISE NOTICE 'Migration 002_add_isrc_unique_constraints was not applied. Nothing to rollback.';
        RETURN;
    END IF;
END $$;

-- ===========================================
-- STEP 1: DROP UNIQUE CONSTRAINTS
-- ===========================================

RAISE NOTICE '===========================================';
RAISE NOTICE 'STEP 1: Dropping unique constraints';
RAISE NOTICE '===========================================';

-- Drop unique ISRC index
DROP INDEX IF EXISTS idx_tracks_isrc_unique;
RAISE NOTICE 'Dropped unique index: idx_tracks_isrc_unique';

-- Drop unique Spotify ID index
DROP INDEX IF EXISTS idx_tracks_spotify_id_unique;
RAISE NOTICE 'Dropped unique index: idx_tracks_spotify_id_unique';

-- ===========================================
-- STEP 2: DROP PERFORMANCE INDEXES
-- ===========================================

RAISE NOTICE '===========================================';
RAISE NOTICE 'STEP 2: Dropping performance indexes';
RAISE NOTICE '===========================================';

DROP INDEX IF EXISTS idx_tracks_isrc_lookup;
RAISE NOTICE 'Dropped index: idx_tracks_isrc_lookup';

DROP INDEX IF EXISTS idx_tracks_spotify_id_lookup;
RAISE NOTICE 'Dropped index: idx_tracks_spotify_id_lookup';

DROP INDEX IF EXISTS idx_tracks_title_normalized_composite;
RAISE NOTICE 'Dropped index: idx_tracks_title_normalized_composite';

-- ===========================================
-- STEP 3: RESTORE ORIGINAL INDEXES
-- ===========================================

RAISE NOTICE '===========================================';
RAISE NOTICE 'STEP 3: Restoring original non-unique indexes';
RAISE NOTICE '===========================================';

-- Restore original ISRC index (non-unique, from 01-schema.sql line 65)
CREATE INDEX IF NOT EXISTS idx_tracks_isrc ON tracks(isrc) WHERE isrc IS NOT NULL;
RAISE NOTICE 'Restored original index: idx_tracks_isrc';

-- Restore original Spotify ID index (non-unique, from 01-schema.sql line 68)
CREATE INDEX IF NOT EXISTS idx_tracks_spotify_id ON tracks(spotify_id) WHERE spotify_id IS NOT NULL;
RAISE NOTICE 'Restored original index: idx_tracks_spotify_id';

-- ===========================================
-- STEP 4: UPDATE MIGRATION RECORD
-- ===========================================

RAISE NOTICE '===========================================';
RAISE NOTICE 'STEP 4: Updating migration record';
RAISE NOTICE '===========================================';

-- Remove migration record
DELETE FROM schema_migrations WHERE migration_name = '002_add_isrc_unique_constraints';
RAISE NOTICE 'Removed migration record from schema_migrations';

-- ===========================================
-- STEP 5: AUDIT REPORT
-- ===========================================

RAISE NOTICE '===========================================';
RAISE NOTICE 'STEP 5: Audit report';
RAISE NOTICE '===========================================';

DO $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Check if deleted tracks table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'deleted_duplicate_tracks') THEN
        SELECT COUNT(*) INTO deleted_count FROM deleted_duplicate_tracks;
        RAISE NOTICE 'WARNING: % track records were deleted during migration', deleted_count;
        RAISE NOTICE 'To restore deleted records, query deleted_duplicate_tracks table';
        RAISE NOTICE 'Example restore query:';
        RAISE NOTICE '  INSERT INTO tracks SELECT (original_data)::jsonb::record FROM deleted_duplicate_tracks;';
    END IF;
END $$;

RAISE NOTICE '===========================================';
RAISE NOTICE 'Rollback complete!';
RAISE NOTICE '===========================================';
RAISE NOTICE 'IMPORTANT NOTES:';
RAISE NOTICE '1. Unique constraints have been removed';
RAISE NOTICE '2. Original non-unique indexes restored';
RAISE NOTICE '3. Deleted duplicate records NOT restored automatically';
RAISE NOTICE '4. Check deleted_duplicate_tracks table to manually restore';
RAISE NOTICE '===========================================';
