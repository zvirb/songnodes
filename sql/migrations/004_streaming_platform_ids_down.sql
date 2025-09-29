-- Migration Rollback: Remove streaming platform IDs from tracks table
-- Version: 004
-- Description: Rollback streaming platform ID columns

-- Drop the materialized view and function
DROP MATERIALIZED VIEW IF EXISTS streaming_platform_coverage;
DROP FUNCTION IF EXISTS refresh_streaming_platform_coverage();

-- Remove streaming platform ID columns from tracks table
ALTER TABLE tracks DROP COLUMN IF EXISTS beatport_id;
ALTER TABLE tracks DROP COLUMN IF EXISTS soundcloud_id;
ALTER TABLE tracks DROP COLUMN IF EXISTS deezer_id;
ALTER TABLE tracks DROP COLUMN IF EXISTS youtube_music_id;
ALTER TABLE tracks DROP COLUMN IF EXISTS musicbrainz_id;

-- Restore tidal_id as VARCHAR and migrate data back if backup exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'tracks' AND column_name = 'tidal_id_backup'
    ) THEN
        -- Drop the INTEGER column
        ALTER TABLE tracks DROP COLUMN IF EXISTS tidal_id;

        -- Recreate as VARCHAR
        ALTER TABLE tracks ADD COLUMN tidal_id VARCHAR(100);

        -- Restore data from backup
        UPDATE tracks SET tidal_id = tidal_id_backup WHERE tidal_id_backup IS NOT NULL;

        -- Drop the backup column
        ALTER TABLE tracks DROP COLUMN tidal_id_backup;
    ELSE
        -- Just change back to VARCHAR if no backup exists
        ALTER TABLE tracks ALTER COLUMN tidal_id TYPE VARCHAR(100);
    END IF;
END $$;

-- Remove streaming platform ID columns from artists table
ALTER TABLE artists DROP COLUMN IF EXISTS beatport_id;
ALTER TABLE artists DROP COLUMN IF EXISTS deezer_id;
ALTER TABLE artists DROP COLUMN IF EXISTS youtube_music_id;
ALTER TABLE artists DROP COLUMN IF EXISTS musicbrainz_id;
ALTER TABLE artists DROP COLUMN IF EXISTS tidal_id;

-- The indexes will be automatically dropped when columns are dropped

-- Reset table comment
COMMENT ON TABLE tracks IS 'Music track metadata with basic streaming platform support';

-- Log the rollback completion
DO $$
BEGIN
    RAISE NOTICE 'Migration 004 Rollback: Streaming platform IDs removed successfully';
    RAISE NOTICE 'Removed columns: beatport_id, soundcloud_id, deezer_id, youtube_music_id, musicbrainz_id';
    RAISE NOTICE 'Restored tidal_id to VARCHAR(100) type';
END $$;