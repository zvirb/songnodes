-- ============================================================================
-- Migration: 006 - Track Adjacency Edges (Graph Edges for DJ Mixing)
-- Description: Create directed edge table for track-to-track transitions
--              with occurrence tracking and transition quality metrics
-- ============================================================================

-- ============================================================================
-- Silver Track Transitions (Directed Edges)
-- Records every sequential track transition with context and quality metrics
-- ============================================================================
CREATE TABLE IF NOT EXISTS silver_track_transitions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Occurrence tracking
    occurrence_count INTEGER NOT NULL DEFAULT 1,
    first_seen TIMESTAMP NOT NULL DEFAULT NOW(),
    last_seen TIMESTAMP NOT NULL DEFAULT NOW(),

    -- Context tracking (which playlists contain this transition)
    playlist_occurrences JSONB NOT NULL DEFAULT '[]'::jsonb,
    -- Example: [{"playlist_id": "uuid", "position": 15, "date": "2025-01-01"}]

    -- Transition quality metrics
    avg_bpm_difference FLOAT,           -- Average BPM delta between tracks
    avg_key_compatibility FLOAT,        -- 0-1 score based on Camelot wheel
    avg_energy_difference FLOAT,        -- Energy level delta

    -- Transition timing (if available from mixes)
    avg_transition_duration_ms INTEGER, -- Average crossfade/transition time
    avg_gap_duration_ms INTEGER,        -- Average gap between tracks (if any)

    -- Computed quality score
    transition_quality_score FLOAT,     -- Composite score: 0-1
    -- Calculation: (1 - |bpm_diff|/20) * key_compat * (1 - |energy_diff|)

    -- Metadata
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT silver_transitions_self_loop CHECK (from_track_id != to_track_id),
        (transition_quality_score >= 0 AND transition_quality_score <= 1)
    ),
    CONSTRAINT silver_transitions_key_compat_range CHECK (
        avg_key_compatibility IS NULL OR
        (avg_key_compatibility >= 0 AND avg_key_compatibility <= 1)
    ),

    -- Unique constraint: Only one edge per from→to pair
    UNIQUE(from_track_id, to_track_id)
);

-- Indexes for graph traversal
CREATE INDEX idx_silver_transitions_from_track ON silver_track_transitions(from_track_id, occurrence_count DESC);
CREATE INDEX idx_silver_transitions_to_track ON silver_track_transitions(to_track_id);
CREATE INDEX idx_silver_transitions_quality ON silver_track_transitions(transition_quality_score DESC NULLS LAST);
CREATE INDEX idx_silver_transitions_occurrence ON silver_track_transitions(occurrence_count DESC);
CREATE INDEX idx_silver_transitions_last_seen ON silver_track_transitions(last_seen DESC);

-- GIN index for playlist occurrences
CREATE INDEX idx_silver_transitions_playlists ON silver_track_transitions USING gin(playlist_occurrences);

-- Comments
COMMENT ON COLUMN silver_track_transitions.occurrence_count IS 'Number of times this exact transition appears across all playlists';
COMMENT ON COLUMN silver_track_transitions.playlist_occurrences IS 'JSON array of {playlist_id, position, date} for each occurrence';
COMMENT ON COLUMN silver_track_transitions.transition_quality_score IS 'Composite metric: BPM compatibility × key compatibility × energy flow';
COMMENT ON COLUMN silver_track_transitions.avg_key_compatibility IS 'Camelot wheel compatibility: 1.0 = perfect match, 0.8 = compatible, 0.5 = possible, 0.0 = clash';

-- ============================================================================
-- Gold Track Graph (Materialized View for Fast Graph Queries)
-- Pre-computed adjacency list for each track with quality-filtered edges
-- ============================================================================
CREATE MATERIALIZED VIEW IF NOT EXISTS gold_track_graph AS
SELECT
    from_track_id as track_id,

    -- Outgoing edges (what tracks follow this one)
    jsonb_agg(
        jsonb_build_object(
            'to_track_id', to_track_id,
            'occurrence_count', occurrence_count,
            'quality_score', transition_quality_score,
            'bpm_diff', avg_bpm_difference,
            'key_compat', avg_key_compatibility,
            'last_seen', last_seen
        )
        ORDER BY occurrence_count DESC
    ) FILTER (WHERE transition_quality_score >= 0.5 OR transition_quality_score IS NULL)
    as outgoing_edges,

    -- Summary statistics
    COUNT(*) as total_outgoing_edges,
    AVG(transition_quality_score) as avg_outgoing_quality,
    MAX(occurrence_count) as max_occurrence_count

FROM silver_track_transitions
GROUP BY from_track_id;

-- Index for fast lookups
CREATE INDEX idx_gold_track_graph_track_id ON gold_track_graph(track_id);

COMMENT ON MATERIALIZED VIEW gold_track_graph IS 'Gold layer: Pre-computed adjacency list for each track. Refresh after bulk imports.';

-- ============================================================================
-- Helper Function: Update Transition Metrics
-- Recalculates quality scores based on track metadata
-- ============================================================================
CREATE OR REPLACE FUNCTION update_transition_metrics(transition_id UUID)
RETURNS VOID AS $$
DECLARE
    from_bpm DECIMAL(6,2);
    to_bpm DECIMAL(6,2);
    from_key INTEGER;
    to_key INTEGER;
    from_energy DECIMAL(3,2);
    to_energy DECIMAL(3,2);
    bpm_diff FLOAT;
    key_compat FLOAT;
    energy_diff FLOAT;
    quality FLOAT;
BEGIN
    -- Fetch track metadata
    SELECT
        f.bpm, f.key, f.energy,
        t.bpm, t.key, t.energy
    INTO from_bpm, from_key, from_energy, to_bpm, to_key, to_energy
    FROM silver_track_transitions tr
    JOIN silver_enriched_tracks f ON f.id = tr.from_track_id
    JOIN silver_enriched_tracks t ON t.id = tr.to_track_id
    WHERE tr.id = transition_id;

    -- Calculate BPM compatibility (0-1 scale)
    IF from_bpm IS NOT NULL AND to_bpm IS NOT NULL THEN
        bpm_diff := ABS(from_bpm - to_bpm);
        -- Perfect: 0 BPM diff, Poor: >10 BPM diff
    END IF;

    -- Calculate key compatibility (Camelot wheel)
    IF from_key IS NOT NULL AND to_key IS NOT NULL THEN
        key_compat := CASE
            WHEN from_key = to_key THEN 1.0                    -- Perfect match (same key)
            WHEN ABS(from_key - to_key) = 1 THEN 0.9           -- Adjacent key (+/- 1)
            WHEN (from_key % 12 + 1) = to_key THEN 0.85        -- Energy boost (+1 on wheel)
            WHEN ABS(from_key - to_key) = 7 THEN 0.8           -- Relative major/minor
            WHEN ABS(from_key - to_key) <= 2 THEN 0.6          -- Within 2 steps
            ELSE 0.3                                            -- Dissonant
        END;
    END IF;

    -- Calculate energy flow
    IF from_energy IS NOT NULL AND to_energy IS NOT NULL THEN
        energy_diff := ABS(from_energy - to_energy);
    END IF;

    -- Composite quality score
    quality := COALESCE(
        (1.0 - LEAST(COALESCE(bpm_diff, 0) / 20.0, 1.0)) *  -- BPM component
        COALESCE(key_compat, 0.7) *                           -- Key component
        (1.0 - COALESCE(energy_diff, 0)),                     -- Energy component
        0.5  -- Default if no data
    );

    -- Update the transition record
    UPDATE silver_track_transitions
    SET
        avg_bpm_difference = bpm_diff,
        avg_key_compatibility = key_compat,
        avg_energy_difference = energy_diff,
        transition_quality_score = quality,
        updated_at = NOW()
    WHERE id = transition_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_transition_metrics IS 'Recalculates transition quality metrics for a specific edge based on current track metadata.';

-- ============================================================================
-- Trigger: Auto-update transition metrics when tracks change
-- ============================================================================
CREATE OR REPLACE FUNCTION trigger_update_transition_metrics()
RETURNS TRIGGER AS $$
BEGIN
    -- Update all transitions involving this track
    UPDATE silver_track_transitions
    SET updated_at = NOW()
    WHERE from_track_id = NEW.id OR to_track_id = NEW.id;

    -- Note: Actual metric recalculation should be done asynchronously
    -- via background job to avoid performance impact

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_track_transitions_on_track_update
    AFTER UPDATE OF bpm, key, energy ON silver_enriched_tracks
    FOR EACH ROW
    WHEN (OLD.bpm IS DISTINCT FROM NEW.bpm OR
          OLD.key IS DISTINCT FROM NEW.key OR
          OLD.energy IS DISTINCT FROM NEW.energy)
    EXECUTE FUNCTION trigger_update_transition_metrics();

-- ============================================================================
-- Migration Assistance: Populate from existing silver_playlist_tracks
-- ============================================================================
DO $$
DECLARE
    transition_record RECORD;
    from_track UUID;
    to_track UUID;
BEGIN
    -- Extract sequential transitions from playlist_tracks
    FOR transition_record IN
        SELECT
            pt1.track_id as from_track_id,
            pt2.track_id as to_track_id,
            pt1.playlist_id,
            pt1.position
        FROM silver_playlist_tracks pt1
        JOIN silver_playlist_tracks pt2
            ON pt1.playlist_id = pt2.playlist_id
            AND pt2.position = pt1.position + 1
        WHERE pt1.track_id IS NOT NULL
          AND pt2.track_id IS NOT NULL
        ORDER BY pt1.playlist_id, pt1.position
    LOOP
        -- Insert or update transition
        INSERT INTO silver_track_transitions (
            from_track_id,
            to_track_id,
            occurrence_count,
            playlist_occurrences
        ) VALUES (
            transition_record.from_track_id,
            transition_record.to_track_id,
            1,
            jsonb_build_array(
                jsonb_build_object(
                    'playlist_id', transition_record.playlist_id,
                    'position', transition_record.position,
                    'date', NOW()
                )
            )
        )
        ON CONFLICT (from_track_id, to_track_id) DO UPDATE SET
            occurrence_count = silver_track_transitions.occurrence_count + 1,
            playlist_occurrences = silver_track_transitions.playlist_occurrences || jsonb_build_array(
                jsonb_build_object(
                    'playlist_id', transition_record.playlist_id,
                    'position', transition_record.position,
                    'date', NOW()
                )
            ),
            last_seen = NOW(),
            updated_at = NOW();
    END LOOP;

    RAISE NOTICE 'Populated silver_track_transitions from silver_playlist_tracks';
END $$;

-- ============================================================================
-- Success message
-- ============================================================================
DO $$
BEGIN
    RAISE NOTICE '✅ Migration 006 complete: Track adjacency edges created';
    RAISE NOTICE '   - silver_track_transitions table (directed edges)';
    RAISE NOTICE '   - gold_track_graph materialized view (adjacency lists)';
    RAISE NOTICE '   - Automatic metric calculation functions';
    RAISE NOTICE '   - Populated from existing playlist data';
END $$;
