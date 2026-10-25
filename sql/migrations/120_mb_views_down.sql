-- Migration 120_mb_views_down.sql

SET lock_timeout = '2s';

DROP VIEW IF EXISTS ref_mb.v_recording_enriched;
DROP VIEW IF EXISTS ref_mb.v_recording_external_ids;
