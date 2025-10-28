-- Create target_tracks table for managing tracks to search for
CREATE TABLE IF NOT EXISTS target_tracks (
    track_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(500) NOT NULL,
    artist VARCHAR(255) NOT NULL,

    -- Search metadata
    priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
    search_terms TEXT[], -- Additional search terms
    genres TEXT[], -- Genre tags for filtering

    -- Search statistics
    last_searched TIMESTAMP,
    times_searched INTEGER DEFAULT 0,
    playlists_found INTEGER DEFAULT 0,
    adjacencies_found INTEGER DEFAULT 0,

    -- Management fields
    is_active BOOLEAN DEFAULT TRUE,
    archived BOOLEAN DEFAULT FALSE,
    completion_percentage INTEGER DEFAULT 0 CHECK (completion_percentage >= 0 AND completion_percentage <= 100),
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Ensure no duplicate tracks
    UNIQUE(title, artist)
);

-- Index for efficient searching
CREATE INDEX idx_target_tracks_active ON target_tracks(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_target_tracks_priority ON target_tracks(priority, last_searched);
CREATE INDEX idx_target_tracks_search ON target_tracks(last_searched) WHERE is_active = TRUE;

-- Track which playlists were discovered via which target tracks
CREATE TABLE IF NOT EXISTS playlist_discovery (
    playlist_id UUID REFERENCES playlists(playlist_id) ON DELETE CASCADE,
    discovered_via_track UUID REFERENCES target_tracks(track_id) ON DELETE CASCADE,
    discovery_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    search_platform VARCHAR(50), -- Which platform found it
    PRIMARY KEY (playlist_id, discovered_via_track)
);

-- Update trigger for target_tracks
CREATE OR REPLACE FUNCTION update_target_tracks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_target_tracks_updated_at
    BEFORE UPDATE ON target_tracks
    FOR EACH ROW
    EXECUTE FUNCTION update_target_tracks_updated_at();

-- View for monitoring target track effectiveness
CREATE VIEW target_track_effectiveness AS
SELECT
    t.track_id,
    t.title,
    t.artist,
    t.priority,
    t.times_searched,
    t.playlists_found,
    t.adjacencies_found,
    t.last_searched,
    CASE
        WHEN t.times_searched > 0
        THEN ROUND((t.playlists_found::NUMERIC / t.times_searched), 2)
        ELSE 0
    END as playlists_per_search,
    COUNT(DISTINCT pd.playlist_id) as unique_playlists_discovered,
    t.is_active
FROM target_tracks t
LEFT JOIN playlist_discovery pd ON t.track_id = pd.discovered_via_track
GROUP BY t.track_id
ORDER BY t.priority, t.playlists_found DESC;