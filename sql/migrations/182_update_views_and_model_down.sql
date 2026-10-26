-- Migration 182_update_views_and_model_down.sql

ALTER TABLE library.track_xref DROP COLUMN IF EXISTS norm_key;
