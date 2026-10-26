-- Migration 182_update_views_and_model_up.sql

ALTER TABLE library.track_xref ADD COLUMN norm_key text;
