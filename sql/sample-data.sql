-- Sample Data for SongNodes Database Testing
-- Creates realistic test data for graph visualization and scraper validation

-- Set search path
SET search_path TO musicdb, public;

-- ===========================================
-- SAMPLE ARTISTS
-- ===========================================

INSERT INTO artists (name, normalized_name, spotify_id, apple_music_id, metadata) VALUES
('Calvin Harris', 'calvin harris', 'spotify:artist:7CajNmpbOovFoOoasH2HaY', 'apple:259675842', '{"genre": "electronic", "followers": 25000000}'),
('David Guetta', 'david guetta', 'spotify:artist:1Cs0zKBU1kc0i8ypK3B9ai', 'apple:3996865', '{"genre": "electronic", "followers": 20000000}'),
('Tiësto', 'tiesto', 'spotify:artist:2o5jDhtHVPhrJdv3cEQ99Z', 'apple:73705833', '{"genre": "trance", "followers": 15000000}'),
('Armin van Buuren', 'armin van buuren', 'spotify:artist:0SfsnGyD8FpIN4U4WCkBZ5', 'apple:4488715', '{"genre": "trance", "followers": 12000000}'),
('Deadmau5', 'deadmau5', 'spotify:artist:2CIMQHirSU0MQqyYHq0eOx', 'apple:112798527', '{"genre": "progressive house", "followers": 8000000}'),
('Swedish House Mafia', 'swedish house mafia', 'spotify:artist:738wLrAtLtCtFOLvQBXOXp', 'apple:425968608', '{"genre": "progressive house", "followers": 7000000}'),
('Skrillex', 'skrillex', 'spotify:artist:5he5w2lnU9x7JFhnwcekXX', 'apple:259675842', '{"genre": "dubstep", "followers": 9000000}'),
('Martin Garrix', 'martin garrix', 'spotify:artist:60d24wfXkVzDSfLS6hyCjZ', 'apple:816350991', '{"genre": "big room house", "followers": 18000000}'),
('Diplo', 'diplo', 'spotify:artist:5fMUXHkw8R8eOP2RNVYEZX', 'apple:73705833', '{"genre": "trap", "followers": 6000000}'),
('Above & Beyond', 'above & beyond', 'spotify:artist:0pKJdOCsaLWWdbXhLHArVh', 'apple:4488715', '{"genre": "trance", "followers": 4000000}'),
('Avicii', 'avicii', 'spotify:artist:1vCWHaC5f2uS3yhpwWbIA6', 'apple:298496035', '{"genre": "progressive house", "followers": 22000000}'),
('The Chainsmokers', 'the chainsmokers', 'spotify:artist:69GGBxA162lTqCwzJG5jLp', 'apple:1065981054', '{"genre": "edm", "followers": 16000000}')
ON CONFLICT (normalized_name) DO NOTHING;

-- ===========================================
-- SAMPLE TRACKS
-- ===========================================

INSERT INTO tracks (title, normalized_title, isrc, spotify_id, duration_ms, bpm, key, energy, danceability, valence, release_date, genre, subgenre, is_remix, metadata) VALUES
('One More Time', 'one more time', 'USBC10501234', 'spotify:track:0DiWol3AO6WpXZgp0goxAV', 320000, 123.0, 'F#m', 0.85, 0.92, 0.78, '2000-11-13', 'house', 'french house', false, '{"year": 2000, "label": "Virgin Records"}'),
('Levels', 'levels', 'USPR11101857', 'spotify:track:1mCsF9Tw4AkIZOjvZbZZdT', 326000, 126.0, 'C#m', 0.88, 0.89, 0.85, '2011-10-28', 'progressive house', 'festival house', false, '{"year": 2011, "label": "Positiva Records"}'),
('Titanium', 'titanium', 'FRUM71200008', 'spotify:track:2dpaYNEQHiRxtZbfNsse99', 245000, 126.0, 'Eb', 0.78, 0.64, 0.22, '2011-12-09', 'electro house', 'pop house', false, '{"year": 2011, "label": "Virgin Records"}'),
('Animals', 'animals', 'USUM71403920', 'spotify:track:1Chuy3K3GVsKPWdyJTYkGd', 302000, 128.0, 'Gm', 0.89, 0.88, 0.65, '2013-06-16', 'big room house', 'festival house', false, '{"year": 2013, "label": "Spinnin'' Records"}'),
('Clarity', 'clarity', 'USIR21200009', 'spotify:track:2VuOOz7GXCaONTP70lxfWr', 271000, 128.0, 'G', 0.72, 0.71, 0.18, '2012-10-02', 'dubstep', 'melodic dubstep', false, '{"year": 2012, "label": "Interscope Records"}'),
('Don''t You Worry Child', 'dont you worry child', 'GBUM71204955', 'spotify:track:6XuWM9VrjnRR3CJEFnVzx0', 352000, 129.0, 'C', 0.82, 0.66, 0.68, '2012-09-14', 'progressive house', 'anthem house', false, '{"year": 2012, "label": "Virgin Records"}'),
('Wake Me Up', 'wake me up', 'SEUM71300001', 'spotify:track:4uLU6hMCjMI75M1A2tKUQC', 247000, 124.0, 'Bm', 0.69, 0.67, 0.75, '2013-06-17', 'progressive house', 'folk house', false, '{"year": 2013, "label": "PRMD Music"}'),
('Waiting for Love', 'waiting for love', 'SEUM71500564', 'spotify:track:5HCyWlXZPP0y6Gqq8TgA20', 223000, 128.0, 'F#m', 0.75, 0.68, 0.45, '2015-05-22', 'progressive house', 'melodic house', false, '{"year": 2015, "label": "PRMD Music"}'),
('Something Just Like This', 'something just like this', 'GBUM71700264', 'spotify:track:1lzr43nnXAijIGYnCHcu9l', 247000, 103.0, 'A', 0.71, 0.53, 0.58, '2017-02-22', 'edm', 'pop edm', false, '{"year": 2017, "label": "Disruptor Records"}'),
('Closer', 'closer', 'USRC11600338', 'spotify:track:7BKLCZ1jbUBVqRi2FVlTVw', 244000, 95.0, 'A', 0.75, 0.75, 0.33, '2016-07-29', 'edm', 'pop edm', false, '{"year": 2016, "label": "Disruptor Records"}'),
('Adagio for Strings', 'adagio for strings', 'GBUM70803467', 'spotify:track:7lQ8MOhq6IN2w8EYcFNSUk', 453000, 136.0, 'Bb', 0.91, 0.82, 0.42, '2005-02-14', 'trance', 'uplifting trance', false, '{"year": 2005, "label": "Armada Music"}'),
('Communication', 'communication', 'GBUM70803999', 'spotify:track:1b8VqAhXOGUuYhDJiHCyFr', 482000, 132.0, 'F#m', 0.88, 0.79, 0.58, '1999-06-04', 'trance', 'uplifting trance', false, '{"year": 1999, "label": "Hooj Choons"}'),
('Strobe', 'strobe', 'CANUM0902345', 'spotify:track:726NzEKUAztqTjINyYQCbV', 634000, 128.0, 'Db', 0.72, 0.64, 0.38, '2009-05-05', 'progressive house', 'minimal techno', false, '{"year": 2009, "label": "mau5trap"}'),
('Ghosts ''n'' Stuff', 'ghosts n stuff', 'CANUM0803456', 'spotify:track:7Bx4jx2pUaP5UEPSaAhSN1', 335000, 128.0, 'Gm', 0.85, 0.73, 0.42, '2008-10-27', 'electro house', 'complextro', false, '{"year": 2008, "label": "Play Records"}'),
('Call on Me', 'call on me', 'GBCOL0400021', 'spotify:track:0WjJmPutQ8SzoCsOaGXWjm', 174000, 125.0, 'F#m', 0.92, 0.89, 0.85, '2004-07-01', 'house', 'tech house', false, '{"year": 2004, "label": "Data Records"}')
ON CONFLICT (normalized_title) DO NOTHING;

-- ===========================================
-- TRACK-ARTIST RELATIONSHIPS
-- ===========================================

INSERT INTO track_artists (track_id, artist_id, role, position)
SELECT t.id, a.id, 'primary', 1
FROM tracks t, artists a
WHERE (t.normalized_title = 'levels' AND a.normalized_name = 'avicii')
   OR (t.normalized_title = 'titanium' AND a.normalized_name = 'david guetta')
   OR (t.normalized_title = 'animals' AND a.normalized_name = 'martin garrix')
   OR (t.normalized_title = 'clarity' AND a.normalized_name = 'skrillex')
   OR (t.normalized_title = 'dont you worry child' AND a.normalized_name = 'swedish house mafia')
   OR (t.normalized_title = 'wake me up' AND a.normalized_name = 'avicii')
   OR (t.normalized_title = 'waiting for love' AND a.normalized_name = 'avicii')
   OR (t.normalized_title = 'something just like this' AND a.normalized_name = 'the chainsmokers')
   OR (t.normalized_title = 'closer' AND a.normalized_name = 'the chainsmokers')
   OR (t.normalized_title = 'adagio for strings' AND a.normalized_name = 'tiesto')
   OR (t.normalized_title = 'communication' AND a.normalized_name = 'armin van buuren')
   OR (t.normalized_title = 'strobe' AND a.normalized_name = 'deadmau5')
   OR (t.normalized_title = 'ghosts n stuff' AND a.normalized_name = 'deadmau5')
   OR (t.normalized_title = 'call on me' AND a.normalized_name = 'calvin harris')
ON CONFLICT (track_id, artist_id, role) DO NOTHING;

-- ===========================================
-- SAMPLE VENUES
-- ===========================================

INSERT INTO venues (name, city, state, country, latitude, longitude, capacity, venue_type, metadata) VALUES
('Ultra Music Festival', 'Miami', 'Florida', 'USA', 25.7617, -80.1918, 165000, 'festival', '{"outdoor": true, "stages": 8}'),
('Tomorrowland', 'Boom', 'Antwerp', 'Belgium', 51.0955, 4.3724, 400000, 'festival', '{"outdoor": true, "stages": 15}'),
('Electric Daisy Carnival', 'Las Vegas', 'Nevada', 'USA', 36.2721, -115.0123, 400000, 'festival', '{"outdoor": true, "stages": 8}'),
('Coachella', 'Indio', 'California', 'USA', 33.6803, -116.2378, 250000, 'festival', '{"outdoor": true, "stages": 6}'),
('Burning Man', 'Black Rock City', 'Nevada', 'USA', 40.7864, -119.2065, 80000, 'festival', '{"outdoor": true, "duration_days": 8}'),
('Ministry of Sound', 'London', 'England', 'UK', 51.4994, -0.1030, 1500, 'club', '{"rooms": 4, "sound_system": "Funktion-One"}'),
('Berghain', 'Berlin', 'Berlin', 'Germany', 52.5108, 13.4417, 1500, 'club', '{"industrial": true, "techno": true}'),
('Privilege', 'Ibiza', 'Balearic Islands', 'Spain', 38.9953, 1.4095, 10000, 'club', '{"largest_club": true, "outdoor_terrace": true}'),
('Red Rocks Amphitheatre', 'Morrison', 'Colorado', 'USA', 39.6654, -105.2057, 9525, 'amphitheatre', '{"natural_acoustics": true, "elevation": 6450}'),
('Madison Square Garden', 'New York', 'New York', 'USA', 40.7505, -73.9934, 20789, 'arena', '{"iconic_venue": true, "air_conditioning": true})
ON CONFLICT (name, city, country) DO NOTHING;

-- ===========================================
-- SAMPLE EVENTS
-- ===========================================

INSERT INTO events (name, venue_id, event_date, event_type, source, source_url, metadata)
SELECT
    'Ultra Music Festival 2024', v.id, '2024-03-24', 'festival', 'setlist.fm',
    'https://setlist.fm/festival/ultra-2024', '{"headliners": ["Calvin Harris", "David Guetta", "Tiësto"]}'
FROM venues v WHERE v.name = 'Ultra Music Festival'
UNION ALL
SELECT
    'Tomorrowland 2024', v.id, '2024-07-19', 'festival', 'setlist.fm',
    'https://setlist.fm/festival/tomorrowland-2024', '{"weekend": 1, "stages": 15}'
FROM venues v WHERE v.name = 'Tomorrowland'
UNION ALL
SELECT
    'EDC Las Vegas 2024', v.id, '2024-05-17', 'festival', 'setlist.fm',
    'https://setlist.fm/festival/edc-2024', '{"under_electric_sky": true}'
FROM venues v WHERE v.name = 'Electric Daisy Carnival'
ON CONFLICT (name, venue_id, event_date) DO NOTHING;

-- ===========================================
-- SAMPLE PERFORMERS
-- ===========================================

INSERT INTO performers (name, normalized_name, artist_id, bio, country, metadata)
SELECT
    a.name, a.normalized_name, a.id,
    'World-renowned DJ and producer in the electronic music scene',
    CASE
        WHEN a.normalized_name = 'calvin harris' THEN 'Scotland'
        WHEN a.normalized_name = 'david guetta' THEN 'France'
        WHEN a.normalized_name = 'tiesto' THEN 'Netherlands'
        WHEN a.normalized_name = 'armin van buuren' THEN 'Netherlands'
        WHEN a.normalized_name = 'deadmau5' THEN 'Canada'
        WHEN a.normalized_name = 'martin garrix' THEN 'Netherlands'
        WHEN a.normalized_name = 'skrillex' THEN 'USA'
        WHEN a.normalized_name = 'avicii' THEN 'Sweden'
        ELSE 'Unknown'
    END,
    '{"performance_style": "live_dj_set"}'
FROM artists a
WHERE a.normalized_name IN ('calvin harris', 'david guetta', 'tiesto', 'armin van buuren', 'deadmau5', 'martin garrix', 'skrillex', 'avicii')
ON CONFLICT (normalized_name) DO NOTHING;

-- ===========================================
-- SAMPLE SETLISTS
-- ===========================================

INSERT INTO setlists (performer_id, event_id, set_date, set_length_minutes, source, source_url, source_id, is_complete, metadata)
SELECT
    p.id, e.id, e.event_date + INTERVAL '20:00:00', 90, 'setlist.fm',
    'https://setlist.fm/setlist/calvin-harris/2024/ultra-music-festival-miami-fl-usa.html',
    'calvin-harris-ultra-2024', true, '{"stage": "main", "time_slot": "headliner"}'
FROM performers p, events e
WHERE p.normalized_name = 'calvin harris' AND e.name = 'Ultra Music Festival 2024'
UNION ALL
SELECT
    p.id, e.id, e.event_date + INTERVAL '22:00:00', 120, 'setlist.fm',
    'https://setlist.fm/setlist/david-guetta/2024/ultra-music-festival-miami-fl-usa.html',
    'david-guetta-ultra-2024', true, '{"stage": "main", "time_slot": "closing"}'
FROM performers p, events e
WHERE p.normalized_name = 'david guetta' AND e.name = 'Ultra Music Festival 2024'
UNION ALL
SELECT
    p.id, e.id, e.event_date + INTERVAL '21:00:00', 75, 'setlist.fm',
    'https://setlist.fm/setlist/tiesto/2024/tomorrowland-boom-belgium.html',
    'tiesto-tomorrowland-2024', true, '{"stage": "mainstage", "weekend": 1}'
FROM performers p, events e
WHERE p.normalized_name = 'tiesto' AND e.name = 'Tomorrowland 2024'
ON CONFLICT (source, source_id) DO NOTHING;

-- ===========================================
-- SAMPLE SETLIST TRACKS
-- ===========================================

INSERT INTO setlist_tracks (setlist_id, track_id, position, track_key, bpm_live, transition_rating, notes)
SELECT
    s.id, t.id, 1, 'F#m', 126.0, 8, 'Opening track with crowd energy build-up'
FROM setlists s, tracks t
WHERE s.source_id = 'calvin-harris-ultra-2024' AND t.normalized_title = 'call on me'
UNION ALL
SELECT
    s.id, t.id, 2, 'Gm', 128.0, 9, 'Seamless key transition, crowd singing along'
FROM setlists s, tracks t
WHERE s.source_id = 'calvin-harris-ultra-2024' AND t.normalized_title = 'animals'
UNION ALL
SELECT
    s.id, t.id, 3, 'C#m', 126.0, 7, 'Classic progressive house moment'
FROM setlists s, tracks t
WHERE s.source_id = 'calvin-harris-ultra-2024' AND t.normalized_title = 'levels'
UNION ALL
SELECT
    s.id, t.id, 1, 'Eb', 126.0, 9, 'Opening with vocal anthem'
FROM setlists s, tracks t
WHERE s.source_id = 'david-guetta-ultra-2024' AND t.normalized_title = 'titanium'
UNION ALL
SELECT
    s.id, t.id, 2, 'Bm', 124.0, 8, 'Emotional peak of the set'
FROM setlists s, tracks t
WHERE s.source_id = 'david-guetta-ultra-2024' AND t.normalized_title = 'wake me up'
UNION ALL
SELECT
    s.id, t.id, 1, 'Bb', 136.0, 10, 'Epic trance opener'
FROM setlists s, tracks t
WHERE s.source_id = 'tiesto-tomorrowland-2024' AND t.normalized_title = 'adagio for strings'
ON CONFLICT (setlist_id, position) DO NOTHING;

-- ===========================================
-- SAMPLE SCRAPING JOBS
-- ===========================================

INSERT INTO scraping_jobs (source, job_type, status, started_at, completed_at, items_scraped, items_failed, metadata) VALUES
('1001tracklists', 'tracklist_scraping', 'completed', NOW() - INTERVAL '2 hours', NOW() - INTERVAL '1 hour', 150, 3, '{"target_dj": "calvin_harris", "date_range": "2024-01"}'),
('setlist.fm', 'setlist_scraping', 'completed', NOW() - INTERVAL '4 hours', NOW() - INTERVAL '3 hours', 85, 1, '{"event": "ultra_2024", "artists_count": 12}'),
('mixesdb', 'mix_metadata', 'running', NOW() - INTERVAL '30 minutes', NULL, 45, 0, '{"batch_size": 100, "current_page": 3}'),
('1001tracklists', 'artist_profile', 'pending', NULL, NULL, 0, 0, '{"artist": "david_guetta", "priority": "high"}'),
('setlist.fm', 'venue_scraping', 'failed', NOW() - INTERVAL '6 hours', NOW() - INTERVAL '5 hours', 12, 5, '{"error": "rate_limit_exceeded", "retry_count": 3}');

-- ===========================================
-- SAMPLE DATA QUALITY ISSUES
-- ===========================================

INSERT INTO data_quality_issues (entity_type, entity_id, issue_type, severity, description, suggested_fix, is_resolved)
SELECT
    'track', t.id, 'missing_metadata', 'medium',
    'Track missing Spotify ID for ' || t.title,
    'Perform Spotify API lookup using title and artist',
    false
FROM tracks t
WHERE t.spotify_id IS NULL
LIMIT 5;

INSERT INTO data_quality_issues (entity_type, entity_id, issue_type, severity, description, suggested_fix, is_resolved)
SELECT
    'artist', a.id, 'duplicate_candidate', 'low',
    'Potential duplicate artist: ' || a.name,
    'Review and merge duplicate artist entries',
    false
FROM artists a
WHERE LENGTH(a.name) < 3
LIMIT 3;

-- ===========================================
-- SAMPLE GRAPH DATA (NODES AND EDGES)
-- ===========================================

-- Insert nodes for tracks (simplified without PostGIS dependency)
INSERT INTO nodes (track_id, x_position, y_position, metadata)
SELECT
    t.id,
    (RANDOM() - 0.5) * 1000,  -- X position between -500 and 500
    (RANDOM() - 0.5) * 1000,  -- Y position between -500 and 500
    jsonb_build_object(
        'genre', COALESCE(t.genre, 'unknown'),
        'title', t.title,
        'energy', COALESCE(t.energy, 0.5),
        'danceability', COALESCE(t.danceability, 0.5),
        'sample_node', true
    )
FROM tracks t
ON CONFLICT (track_id) DO NOTHING;

-- Insert edges connecting similar tracks
INSERT INTO edges (source_id, target_id, weight, edge_type, metadata)
SELECT DISTINCT
    n1.id as source_id,
    n2.id as target_id,
    GREATEST(0.1, RANDOM()) as weight,
    CASE
        WHEN t1.genre = t2.genre THEN 'genre_similarity'
        WHEN ABS(COALESCE(t1.bpm, 120) - COALESCE(t2.bpm, 120)) < 5 THEN 'bpm_similarity'
        ELSE 'general_similarity'
    END as edge_type,
    jsonb_build_object(
        'connection_strength', ROUND(CAST(RANDOM() * 100 AS NUMERIC), 2),
        'created_by', 'sample_data_generator'
    )
FROM nodes n1
JOIN tracks t1 ON n1.track_id = t1.id
CROSS JOIN nodes n2
JOIN tracks t2 ON n2.track_id = t2.id
WHERE n1.id < n2.id  -- Avoid duplicates and self-loops
AND (
    t1.genre = t2.genre OR
    ABS(COALESCE(t1.bpm, 120) - COALESCE(t2.bpm, 120)) < 10 OR
    RANDOM() < 0.15  -- 15% chance of random connection
)
LIMIT 100
ON CONFLICT (source_id, target_id, edge_type) DO NOTHING;

-- ===========================================
-- UPDATE STATISTICS
-- ===========================================

-- Update table statistics for query optimizer
ANALYZE artists;
ANALYZE tracks;
ANALYZE track_artists;
ANALYZE venues;
ANALYZE events;
ANALYZE performers;
ANALYZE setlists;
ANALYZE setlist_tracks;
ANALYZE nodes;
ANALYZE edges;
ANALYZE scraping_jobs;
ANALYZE data_quality_issues;

-- ===========================================
-- VERIFICATION QUERIES
-- ===========================================

-- Display sample data counts
DO $$
DECLARE
    artist_count INTEGER;
    track_count INTEGER;
    node_count INTEGER;
    edge_count INTEGER;
    setlist_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO artist_count FROM artists;
    SELECT COUNT(*) INTO track_count FROM tracks;
    SELECT COUNT(*) INTO node_count FROM nodes;
    SELECT COUNT(*) INTO edge_count FROM edges;
    SELECT COUNT(*) INTO setlist_count FROM setlists;

    RAISE NOTICE 'Sample data loaded successfully:';
    RAISE NOTICE '- Artists: %', artist_count;
    RAISE NOTICE '- Tracks: %', track_count;
    RAISE NOTICE '- Graph Nodes: %', node_count;
    RAISE NOTICE '- Graph Edges: %', edge_count;
    RAISE NOTICE '- Setlists: %', setlist_count;
    RAISE NOTICE 'Database ready for testing and development!';
END $$;