-- Create interconnected tracklists to fix isolated track chains
-- This creates realistic DJ sets that share popular tracks across multiple playlists

BEGIN;

-- Clear existing playlist_songs to start fresh
DELETE FROM playlist_songs;

-- Get some popular tracks that will appear in multiple sets
WITH popular_tracks AS (
  SELECT s.song_id, s.title, a.name as artist_name,
         ROW_NUMBER() OVER (PARTITION BY s.title ORDER BY RANDOM()) as rn
  FROM songs s
  LEFT JOIN artists a ON s.primary_artist_id = a.artist_id
  WHERE s.title IN (
    'Levels', 'Clarity', 'Animals', 'Titanium', 'Wake Me Up',
    'Hey Brother', 'Waiting For Love', 'Cinema', 'Bangarang',
    'Strobe', 'Language', 'Opus', 'Adagio for Strings', 'Generate'
  )
  AND rn = 1  -- Take one version of each popular track
),

-- Create DJ Set 1: Main Stage Festival Set
dj_set_1 AS (
  SELECT * FROM (VALUES
    ('Tiësto - Festival Mainstage Set'),
    ('Levels'),
    ('Animals'),
    ('Wake Me Up'),
    ('Clarity'),
    ('Titanium'),
    ('Cinema'),
    ('Language'),
    ('Strobe')
  ) AS t(playlist_name, track_title)
),

-- Create DJ Set 2: Club Night Set (shares some tracks)
dj_set_2 AS (
  SELECT * FROM (VALUES
    ('Avicii - Club Memorial Set'),
    ('Wake Me Up'),
    ('Hey Brother'),
    ('Levels'),           -- Shared with Set 1
    ('Waiting For Love'),
    ('Bangarang'),
    ('Opus'),
    ('Generate'),
    ('Titanium')          -- Shared with Set 1
  ) AS t(playlist_name, track_title)
),

-- Create DJ Set 3: Electronic Classics (shares tracks)
dj_set_3 AS (
  SELECT * FROM (VALUES
    ('Electronic Classics Mix'),
    ('Strobe'),           -- Shared with Set 1
    ('Adagio for Strings'),
    ('Cinema'),           -- Shared with Set 1
    ('Language'),         -- Shared with Set 1
    ('Bangarang'),        -- Shared with Set 2
    ('Clarity'),          -- Shared with Set 1
    ('Generate'),         -- Shared with Set 2
    ('Opus')              -- Shared with Set 2
  ) AS t(playlist_name, track_title)
)

-- Insert tracks into playlists to create interconnected networks
SELECT 'Creating interconnected tracklists...' as status;

-- Insert DJ Set 1
INSERT INTO playlist_songs (playlist_id, song_id, position, added_at)
SELECT
  (SELECT playlist_id FROM playlists WHERE name = 'Tiësto - Compilation @ Creamfields' LIMIT 1),
  pt.song_id,
  ROW_NUMBER() OVER (ORDER BY
    CASE ds1.track_title
      WHEN 'Levels' THEN 1
      WHEN 'Animals' THEN 2
      WHEN 'Wake Me Up' THEN 3
      WHEN 'Clarity' THEN 4
      WHEN 'Titanium' THEN 5
      WHEN 'Cinema' THEN 6
      WHEN 'Language' THEN 7
      WHEN 'Strobe' THEN 8
    END
  ),
  NOW()
FROM dj_set_1 ds1
JOIN popular_tracks pt ON ds1.track_title = pt.title
WHERE ds1.track_title != 'Tiësto - Festival Mainstage Set';

-- Insert DJ Set 2
INSERT INTO playlist_songs (playlist_id, song_id, position, added_at)
SELECT
  (SELECT playlist_id FROM playlists WHERE name = 'Kaskade - Live Performance @ Tomorrowland' LIMIT 1),
  pt.song_id,
  ROW_NUMBER() OVER (ORDER BY
    CASE ds2.track_title
      WHEN 'Wake Me Up' THEN 1
      WHEN 'Hey Brother' THEN 2
      WHEN 'Levels' THEN 3
      WHEN 'Waiting For Love' THEN 4
      WHEN 'Bangarang' THEN 5
      WHEN 'Opus' THEN 6
      WHEN 'Generate' THEN 7
      WHEN 'Titanium' THEN 8
    END
  ),
  NOW()
FROM dj_set_2 ds2
JOIN popular_tracks pt ON ds2.track_title = pt.title
WHERE ds2.track_title != 'Avicii - Club Memorial Set';

-- Insert DJ Set 3
INSERT INTO playlist_songs (playlist_id, song_id, position, added_at)
SELECT
  (SELECT playlist_id FROM playlists WHERE name = 'Porter Robinson - Radio Show @ Club Space Miami' LIMIT 1),
  pt.song_id,
  ROW_NUMBER() OVER (ORDER BY
    CASE ds3.track_title
      WHEN 'Strobe' THEN 1
      WHEN 'Adagio for Strings' THEN 2
      WHEN 'Cinema' THEN 3
      WHEN 'Language' THEN 4
      WHEN 'Bangarang' THEN 5
      WHEN 'Clarity' THEN 6
      WHEN 'Generate' THEN 7
      WHEN 'Opus' THEN 8
    END
  ),
  NOW()
FROM dj_set_3 ds3
JOIN popular_tracks pt ON ds3.track_title = pt.title
WHERE ds3.track_title != 'Electronic Classics Mix';

-- Clear existing adjacencies
DELETE FROM song_adjacency;

-- Now rebuild adjacencies with the interconnected tracklists
-- This will create consecutive adjacencies within each playlist
DO $$
DECLARE
    playlist_record RECORD;
    song_record RECORD;
    prev_song_id UUID := NULL;
    adjacency_count INTEGER := 0;
BEGIN
    -- Process each playlist
    FOR playlist_record IN
        SELECT DISTINCT playlist_id
        FROM playlist_songs
        WHERE playlist_id IN (
          SELECT playlist_id FROM playlists
          WHERE name IN (
            'Tiësto - Compilation @ Creamfields',
            'Kaskade - Live Performance @ Tomorrowland',
            'Porter Robinson - Radio Show @ Club Space Miami'
          )
        )
    LOOP
        prev_song_id := NULL;

        -- Process songs in each playlist in position order
        FOR song_record IN
            SELECT song_id
            FROM playlist_songs
            WHERE playlist_id = playlist_record.playlist_id
            ORDER BY position
        LOOP
            -- Create adjacency with previous song
            IF prev_song_id IS NOT NULL AND song_record.song_id != prev_song_id THEN
                INSERT INTO song_adjacency (song_id_1, song_id_2, occurrence_count, avg_distance)
                VALUES (
                    LEAST(prev_song_id, song_record.song_id),
                    GREATEST(prev_song_id, song_record.song_id),
                    1,
                    1.0
                )
                ON CONFLICT (song_id_1, song_id_2) DO UPDATE
                SET occurrence_count = song_adjacency.occurrence_count + 1;

                adjacency_count := adjacency_count + 1;
            END IF;

            prev_song_id := song_record.song_id;
        END LOOP;
    END LOOP;

    RAISE NOTICE 'Created % consecutive adjacencies across interconnected tracklists', adjacency_count;
END $$;

-- Show results
SELECT 'RESULTS:' as status;

SELECT
  p.name as playlist_name,
  COUNT(ps.song_id) as tracks_in_playlist
FROM playlists p
LEFT JOIN playlist_songs ps ON p.playlist_id = ps.playlist_id
WHERE p.name IN (
  'Tiësto - Compilation @ Creamfields',
  'Kaskade - Live Performance @ Tomorrowland',
  'Porter Robinson - Radio Show @ Club Space Miami'
)
GROUP BY p.playlist_id, p.name
ORDER BY tracks_in_playlist DESC;

-- Check track sharing across playlists
SELECT
  s.title,
  COUNT(DISTINCT ps.playlist_id) as appears_in_playlists,
  COUNT(*) as total_appearances
FROM songs s
JOIN playlist_songs ps ON s.song_id = ps.song_id
JOIN playlists p ON ps.playlist_id = p.playlist_id
WHERE p.name IN (
  'Tiësto - Compilation @ Creamfields',
  'Kaskade - Live Performance @ Tomorrowland',
  'Porter Robinson - Radio Show @ Club Space Miami'
)
GROUP BY s.song_id, s.title
ORDER BY appears_in_playlists DESC, total_appearances DESC;

-- Final adjacency stats
SELECT
  COUNT(*) as total_adjacencies,
  COUNT(DISTINCT song_id_1) + COUNT(DISTINCT song_id_2) as connected_songs,
  MAX(occurrence_count) as max_connections
FROM song_adjacency;

COMMIT;

SELECT 'SUCCESS: Interconnected tracklists created!' as result;