-- Safe backfill: create function + trigger and populate playlist_ids and transitions
BEGIN;

-- 1) Create or replace function to update enrichment_metadata.playlist_ids
CREATE OR REPLACE FUNCTION update_track_playlist_metadata(track_id_param UUID)
RETURNS VOID AS $$
DECLARE
    playlist_ids UUID[];
BEGIN
    SELECT array_agg(DISTINCT playlist_id) INTO playlist_ids
    FROM silver_playlist_tracks
    WHERE track_id = track_id_param;

    UPDATE silver_enriched_tracks t
    SET enrichment_metadata = jsonb_set(
        COALESCE(t.enrichment_metadata, '{}'::jsonb),
        '{playlist_ids}',
        COALESCE((SELECT to_jsonb(playlist_ids)), '[]'::jsonb),
        true
    ),
    updated_at = NOW()
    WHERE t.id = track_id_param;
END;
$$ LANGUAGE plpgsql;

-- 2) Create trigger wrapper
CREATE OR REPLACE FUNCTION trigger_update_track_playlist_metadata()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP IN ('INSERT', 'UPDATE') THEN
        PERFORM update_track_playlist_metadata(NEW.track_id);
    END IF;
    IF TG_OP IN ('DELETE', 'UPDATE') AND (TG_OP = 'DELETE' OR OLD.track_id IS DISTINCT FROM NEW.track_id) THEN
        PERFORM update_track_playlist_metadata(OLD.track_id);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3) Install trigger (drop/create to be idempotent)
DROP TRIGGER IF EXISTS update_track_playlist_metadata ON silver_playlist_tracks;
CREATE TRIGGER update_track_playlist_metadata
    AFTER INSERT OR UPDATE OR DELETE ON silver_playlist_tracks
    FOR EACH ROW
    EXECUTE FUNCTION trigger_update_track_playlist_metadata();

-- 4) Backfill playlist_ids for all tracks (batched by default grouping)
WITH p AS (
  SELECT track_id, array_agg(DISTINCT playlist_id) AS playlist_ids
  FROM silver_playlist_tracks
  GROUP BY track_id
)
UPDATE silver_enriched_tracks t
SET enrichment_metadata = jsonb_set(
    COALESCE(t.enrichment_metadata, '{}'::jsonb),
    '{playlist_ids}',
    to_jsonb(p.playlist_ids),
    true
),
updated_at = NOW()
FROM p
WHERE t.id = p.track_id;

-- 5) Populate transitions (aggregate then upsert), skip self-loops
INSERT INTO silver_track_transitions (
  from_track_id, to_track_id, occurrence_count, playlist_occurrences, first_seen, last_seen, created_at, updated_at
)
SELECT
  pt1.track_id::uuid AS from_track_id,
  pt2.track_id::uuid AS to_track_id,
  COUNT(*)::integer AS occurrence_count,
  jsonb_agg(jsonb_build_object('playlist_id', pt1.playlist_id, 'position', pt1.position, 'date', now())) AS playlist_occurrences,
  MIN(now()) AS first_seen,
  MAX(now()) AS last_seen,
  MIN(now()) AS created_at,
  MAX(now()) AS updated_at
FROM silver_playlist_tracks pt1
JOIN silver_playlist_tracks pt2
  ON pt1.playlist_id = pt2.playlist_id
  AND pt2.position = pt1.position + 1
WHERE pt1.track_id IS NOT NULL
  AND pt2.track_id IS NOT NULL
  AND pt1.track_id <> pt2.track_id
GROUP BY pt1.track_id, pt2.track_id
ON CONFLICT (from_track_id, to_track_id) DO UPDATE SET
  occurrence_count = silver_track_transitions.occurrence_count + EXCLUDED.occurrence_count,
  playlist_occurrences = COALESCE(silver_track_transitions.playlist_occurrences, '[]'::jsonb) || EXCLUDED.playlist_occurrences,
  last_seen = GREATEST(COALESCE(silver_track_transitions.last_seen, EXCLUDED.last_seen), EXCLUDED.last_seen),
  updated_at = NOW();

COMMIT;

-- Final notice
SELECT 'BACKFILL_COMPLETE' AS status;