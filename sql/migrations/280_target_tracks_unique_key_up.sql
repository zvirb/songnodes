-- Migration 280_target_tracks_unique_key_up.sql (TGT2)
-- One live target per artist and title, case and outer spaces ignored: the key load-library-targets.sql and
-- POST /api/v1/target-tracks already check. Archived rows are left out, so archiving a duplicate makes room.
-- Existing rows are never deleted or changed here. While live duplicates remain, the index is not created and a
-- NOTICE says how many; archive the extra copies (see the TGT2 PR) and apply this file again. Idempotent.

DO $$
DECLARE
    duplicated integer;
BEGIN
    IF to_regclass('target_tracks_artist_title_key') IS NOT NULL THEN
        RETURN;
    END IF;
    SELECT count(*) INTO duplicated FROM (
        SELECT 1 FROM target_tracks WHERE NOT archived
        GROUP BY lower(btrim(artist)), lower(btrim(title)) HAVING count(*) > 1) d;
    IF duplicated > 0 THEN
        RAISE NOTICE 'target_tracks: % artist/title pairs have more than one live row; unique key not created. Archive the extra copies, then apply 280_target_tracks_unique_key_up.sql again.', duplicated;
    ELSE
        CREATE UNIQUE INDEX target_tracks_artist_title_key
            ON target_tracks (lower(btrim(artist)), lower(btrim(title))) WHERE NOT archived;
    END IF;
END $$;
