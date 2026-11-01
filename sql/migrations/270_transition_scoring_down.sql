-- Migration 270_transition_scoring_down.sql (HS4)
-- Removes the stored harmonic scoring; transitions and their occurrence counts are untouched.

ALTER TABLE silver_track_transitions
    DROP COLUMN IF EXISTS key_relation,
    DROP COLUMN IF EXISTS key_level,
    DROP COLUMN IF EXISTS key_score,
    DROP COLUMN IF EXISTS bpm_relation,
    DROP COLUMN IF EXISTS bpm_gap,
    DROP COLUMN IF EXISTS bpm_level,
    DROP COLUMN IF EXISTS bpm_score,
    DROP COLUMN IF EXISTS compat_score,
    DROP COLUMN IF EXISTS compat_coverage,
    DROP COLUMN IF EXISTS energy_from,
    DROP COLUMN IF EXISTS energy_to,
    DROP COLUMN IF EXISTS energy_delta,
    DROP COLUMN IF EXISTS energy_move,
    DROP COLUMN IF EXISTS energy_contract,
    DROP COLUMN IF EXISTS move_version,
    DROP COLUMN IF EXISTS energy_from_source,
    DROP COLUMN IF EXISTS energy_to_source,
    DROP COLUMN IF EXISTS energy_from_calibrated,
    DROP COLUMN IF EXISTS energy_to_calibrated,
    DROP COLUMN IF EXISTS scoring_version,
    DROP COLUMN IF EXISTS scored_at;
