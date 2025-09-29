-- Create tables for storing raw playlist data and track positions
-- This enables reprocessing and full traceability of adjacency relationships

-- Store complete raw playlist/setlist data for reprocessing
CREATE TABLE IF NOT EXISTS raw_scrape_data (
    scrape_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    source VARCHAR(100),           -- '1001tracklists', 'mixesdb', 'setlistfm'
    scrape_type VARCHAR(50),        -- 'playlist', 'setlist', 'dj_mix'
    source_url TEXT,                -- Original URL scraped
    raw_data JSONB,                 -- Complete scraped JSON data
    processed BOOLEAN DEFAULT FALSE,
    error_message TEXT,
    scraped_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP
);

-- Create index for unprocessed items
CREATE INDEX IF NOT EXISTS idx_raw_scrape_unprocessed
ON raw_scrape_data(processed, scraped_at)
WHERE processed = FALSE;

-- Store playlist track positions for adjacency traceability
CREATE TABLE IF NOT EXISTS playlist_tracks (
    playlist_id UUID REFERENCES playlists(playlist_id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    song_id UUID REFERENCES songs(song_id) ON DELETE CASCADE,
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (playlist_id, position)
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_playlist_tracks_playlist
ON playlist_tracks(playlist_id);

CREATE INDEX IF NOT EXISTS idx_playlist_tracks_song
ON playlist_tracks(song_id);

-- Add comment to track adjacency source
COMMENT ON TABLE playlist_tracks IS 'Stores exact track positions in playlists for adjacency calculation and traceability';