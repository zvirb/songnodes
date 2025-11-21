-- Migration: Create target_track_searches table
-- Description: Stores target tracks to search for when scraping playlists/setlists
-- The scraper orchestrator queries this table to find tracks to scrape

CREATE TABLE IF NOT EXISTS target_track_searches (
    search_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    search_query TEXT NOT NULL,
    target_artist TEXT NOT NULL,
    target_title TEXT NOT NULL,
    scraper_name TEXT DEFAULT 'mixesdb',
    search_timestamp TIMESTAMP DEFAULT NOW(),
    results_found INTEGER DEFAULT 0,
    playlists_containing INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create index for efficient ordering by timestamp
CREATE INDEX IF NOT EXISTS idx_target_track_searches_timestamp
ON target_track_searches(search_timestamp ASC);

-- Seed data with popular electronic tracks
INSERT INTO target_track_searches (search_query, target_artist, target_title, scraper_name) VALUES
    ('Deadmau5 Strobe', 'Deadmau5', 'Strobe', 'mixesdb'),
    ('Tiesto Adagio for Strings', 'Tiesto', 'Adagio for Strings', 'mixesdb'),
    ('Avicii Levels', 'Avicii', 'Levels', 'mixesdb'),
    ('Swedish House Mafia Dont You Worry Child', 'Swedish House Mafia', 'Dont You Worry Child', 'mixesdb'),
    ('Eric Prydz Opus', 'Eric Prydz', 'Opus', 'mixesdb'),
    ('Daft Punk One More Time', 'Daft Punk', 'One More Time', 'mixesdb'),
    ('Above Beyond Sun Moon', 'Above & Beyond', 'Sun & Moon', 'mixesdb'),
    ('Armin van Buuren This Is What It Feels Like', 'Armin van Buuren', 'This Is What It Feels Like', 'mixesdb'),
    ('Fatboy Slim Right Here Right Now', 'Fatboy Slim', 'Right Here Right Now', 'mixesdb'),
    ('Paul Oakenfold Southern Sun', 'Paul Oakenfold', 'Southern Sun', 'mixesdb')
ON CONFLICT DO NOTHING;
