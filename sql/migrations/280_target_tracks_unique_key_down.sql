-- Migration 280_target_tracks_unique_key_down.sql (TGT2)
-- Drops the one-live-target-per-artist-and-title key. Rows are untouched.

DROP INDEX IF EXISTS target_tracks_artist_title_key;
