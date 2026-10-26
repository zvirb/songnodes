-- Migration 185_reconcile_view_mbid_down.sql

CREATE OR REPLACE VIEW library.v_reconciliation_report AS
SELECT
    t.id AS track_id,
    e.value AS isrc,
    t.artist_name,
    t.track_title,
    t.enrichment_metadata,
    e2.value AS mbid
FROM library.tracks lt
JOIN silver_enriched_tracks t ON t.id = lt.id
LEFT JOIN silver_track_metadata_evidence e ON e.track_id = t.id AND e.field = 'isrc'
LEFT JOIN silver_track_metadata_evidence e2 ON e2.track_id = t.id AND e2.field = 'mbid'
WHERE EXISTS (
    SELECT 1
    FROM silver_track_metadata_evidence ex
    WHERE ex.field = 'isrc' AND ex.value = e.value AND ex.track_id != t.id
);
