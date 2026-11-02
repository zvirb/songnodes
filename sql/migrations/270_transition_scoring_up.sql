-- Migration 270_transition_scoring_up.sql (HS4, spec harmonic-1 section 2.7)
-- Observed Silver transitions store their harmonic scoring, computed from the two tracks' key, BPM and energy by
-- common.metadata.transition_scoring.score_transition. Every column is nullable: NULL scored_at means not scored yet;
-- a scored edge with an unknown input keeps that part unknown (level 'unknown', score/gap/delta NULL), never a clash.
-- Cost is not stored (query time). Idempotent. Reversible with 270_transition_scoring_down.sql.

ALTER TABLE silver_track_transitions
    ADD COLUMN IF NOT EXISTS key_relation TEXT NULL,
    ADD COLUMN IF NOT EXISTS key_level TEXT NULL,
    ADD COLUMN IF NOT EXISTS key_score DOUBLE PRECISION NULL,
    ADD COLUMN IF NOT EXISTS bpm_relation TEXT NULL,
    ADD COLUMN IF NOT EXISTS bpm_gap INTEGER NULL,
    ADD COLUMN IF NOT EXISTS bpm_level TEXT NULL,
    ADD COLUMN IF NOT EXISTS bpm_score DOUBLE PRECISION NULL,
    ADD COLUMN IF NOT EXISTS compat_score DOUBLE PRECISION NULL,
    ADD COLUMN IF NOT EXISTS compat_coverage DOUBLE PRECISION NULL,
    ADD COLUMN IF NOT EXISTS energy_from NUMERIC(3,1) NULL,
    ADD COLUMN IF NOT EXISTS energy_to NUMERIC(3,1) NULL,
    ADD COLUMN IF NOT EXISTS energy_delta NUMERIC(3,1) NULL,
    ADD COLUMN IF NOT EXISTS energy_move TEXT NULL,
    ADD COLUMN IF NOT EXISTS energy_contract TEXT NULL,
    ADD COLUMN IF NOT EXISTS move_version TEXT NULL,
    ADD COLUMN IF NOT EXISTS energy_from_source TEXT NULL,
    ADD COLUMN IF NOT EXISTS energy_to_source TEXT NULL,
    ADD COLUMN IF NOT EXISTS energy_from_calibrated BOOLEAN NULL,
    ADD COLUMN IF NOT EXISTS energy_to_calibrated BOOLEAN NULL,
    ADD COLUMN IF NOT EXISTS scoring_version TEXT NULL,
    ADD COLUMN IF NOT EXISTS scored_at TIMESTAMPTZ NULL;
