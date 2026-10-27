-- Migration 184_library_views_v_crates_etc_up.sql

CREATE OR REPLACE VIEW library.v_crates AS
SELECT t.id AS track_id, r.rotation
FROM library.tracks t
JOIN library.rotation_history r ON t.id = r.track_id
WHERE r.changed_at = (
    SELECT MAX(changed_at) FROM library.rotation_history WHERE track_id = t.id
);

CREATE OR REPLACE VIEW library.v_source_yield AS
SELECT source, count(*) as track_count
FROM library.appearances
GROUP BY source;

CREATE OR REPLACE VIEW library.v_review_queue AS
SELECT track_id, reason
FROM library.pending;

CREATE OR REPLACE VIEW library.v_buy_list AS
SELECT track_id
FROM library.tracks t
WHERE NOT EXISTS (SELECT 1 FROM library.rejected WHERE track_id = t.id)
  AND NOT EXISTS (SELECT 1 FROM library.pending WHERE track_id = t.id);
