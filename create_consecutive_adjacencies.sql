-- Create consecutive adjacencies directly in the database
-- This fixes the isolated tracks issue by ensuring ALL consecutive tracks have edges

-- First, let's see the current state
SELECT 'BEFORE IMPORT:' as status;
SELECT
    COUNT(*) as total_songs,
    (SELECT COUNT(*) FROM song_adjacency) as total_adjacencies,
    (SELECT COUNT(DISTINCT song_id_1) + COUNT(DISTINCT song_id_2) FROM song_adjacency) as connected_songs
FROM songs;

-- Create songs table entries for our setlist tracks if they don't exist
-- FISHER - Tomorrowland 2025 setlist
INSERT INTO songs (id, title, artist, created_at, updated_at) VALUES
(gen_random_uuid(), 'ID', 'FISHER', NOW(), NOW()),
(gen_random_uuid(), 'Pump The Brakes', 'Dom Dolla', NOW(), NOW()),
(gen_random_uuid(), 'Miracle Maker', 'Dom Dolla', NOW(), NOW()),
(gen_random_uuid(), 'San Francisco', 'Dom Dolla', NOW(), NOW()),
(gen_random_uuid(), 'Stay', 'FISHER', NOW(), NOW()),
(gen_random_uuid(), 'Get Hype', 'Chris Lake', NOW(), NOW()),
(gen_random_uuid(), 'Freak', 'FISHER', NOW(), NOW()),
(gen_random_uuid(), 'Atmosphere', 'FISHER', NOW(), NOW()),
(gen_random_uuid(), 'Tidal Wave', 'Chris Lake', NOW(), NOW()),
(gen_random_uuid(), 'A Drug From God', 'Chris Lake & NPC', NOW(), NOW()),
(gen_random_uuid(), 'Goosebumps', 'HVDES', NOW(), NOW()),
(gen_random_uuid(), 'Jungle', 'X Ambassadors & Jamie N Commons', NOW(), NOW()),
(gen_random_uuid(), 'Push To Start', 'Noizu', NOW(), NOW()),
(gen_random_uuid(), 'Somebody (2024)', 'Gotye, Kimbra, FISHER, Chris Lake, Sante Sansone', NOW(), NOW()),
(gen_random_uuid(), 'Baby Baby', 'Mau P', NOW(), NOW()),
(gen_random_uuid(), 'Drugs From Amsterdam', 'Mau P', NOW(), NOW()),
(gen_random_uuid(), 'Gimme! Gimme! Gimme!', 'Mau P', NOW(), NOW()),
(gen_random_uuid(), 'Metro', 'Mau P', NOW(), NOW()),
(gen_random_uuid(), 'Shake The Bottle', 'Mau P', NOW(), NOW()),
(gen_random_uuid(), 'Take It Off', 'FISHER', NOW(), NOW()),
(gen_random_uuid(), 'Crazy', 'Patrick Topping', NOW(), NOW()),
(gen_random_uuid(), 'World, Hold On', 'Bob Sinclar', NOW(), NOW()),
(gen_random_uuid(), 'Losing It', 'FISHER', NOW(), NOW())
ON CONFLICT (title, artist) DO NOTHING;

-- Fred again.. - EDC Las Vegas 2024 setlist
INSERT INTO songs (id, title, artist, created_at, updated_at) VALUES
(gen_random_uuid(), 'Marea (We''ve Lost Dancing)', 'Fred again..', NOW(), NOW()),
(gen_random_uuid(), 'Kyle (I Found You)', 'Fred again..', NOW(), NOW()),
(gen_random_uuid(), 'Danielle (smile on my face)', 'Fred again..', NOW(), NOW()),
(gen_random_uuid(), 'Angie (I''ve Been Lost)', 'Fred again..', NOW(), NOW()),
(gen_random_uuid(), 'Turn On The Lights again..', 'Fred again.., Swedish House Mafia', NOW(), NOW()),
(gen_random_uuid(), 'Rumble', 'Skrillex, Fred again.., Flowdan', NOW(), NOW()),
(gen_random_uuid(), 'Baby again..', 'Fred again.., Skrillex', NOW(), NOW()),
(gen_random_uuid(), 'Clara (the night is dark)', 'Fred again..', NOW(), NOW()),
(gen_random_uuid(), 'adore u', 'Fred again.., Obongjayar', NOW(), NOW()),
(gen_random_uuid(), 'places to be', 'Fred again.., Anderson .Paak, CHIKA', NOW(), NOW()),
(gen_random_uuid(), 'Lights Out', 'Fred again..', NOW(), NOW()),
(gen_random_uuid(), 'leavemealone', 'Fred again.., Baby Keem', NOW(), NOW()),
(gen_random_uuid(), 'Bleu (better with time)', 'Fred again..', NOW(), NOW()),
(gen_random_uuid(), 'fear less', 'Fred again.., Sampha', NOW(), NOW()),
(gen_random_uuid(), 'Strong', 'Romy, Fred again..', NOW(), NOW()),
(gen_random_uuid(), 'Billie (loving arms)', 'Fred again..', NOW(), NOW()),
(gen_random_uuid(), 'ten', 'Fred again.., Jozzy', NOW(), NOW()),
(gen_random_uuid(), 'Delilah (pull me out of this)', 'Fred again..', NOW(), NOW())
ON CONFLICT (title, artist) DO NOTHING;

-- Clear existing adjacencies and rebuild with consecutive-only logic
DELETE FROM song_adjacency;

-- Create consecutive adjacencies for FISHER setlist
WITH fisher_tracklist AS (
  SELECT s.id as song_id, s.title, s.artist,
         ROW_NUMBER() OVER (ORDER BY
           CASE s.title
             WHEN 'ID' THEN 1
             WHEN 'Pump The Brakes' THEN 2
             WHEN 'Miracle Maker' THEN 3
             WHEN 'San Francisco' THEN 4
             WHEN 'Stay' THEN 5
             WHEN 'Get Hype' THEN 6
             WHEN 'Freak' THEN 7
             WHEN 'Atmosphere' THEN 8
             WHEN 'Tidal Wave' THEN 9
             WHEN 'A Drug From God' THEN 10
             WHEN 'Goosebumps' THEN 11
             WHEN 'Jungle' THEN 12
             WHEN 'Push To Start' THEN 13
             WHEN 'Somebody (2024)' THEN 15
             WHEN 'Baby Baby' THEN 16
             WHEN 'Drugs From Amsterdam' THEN 17
             WHEN 'Gimme! Gimme! Gimme!' THEN 18
             WHEN 'Metro' THEN 19
             WHEN 'Shake The Bottle' THEN 20
             WHEN 'Take It Off' THEN 21
             WHEN 'Crazy' THEN 22
             WHEN 'World, Hold On' THEN 23
             WHEN 'Losing It' THEN 25
             ELSE 999
           END
         ) as position
  FROM songs s
  WHERE s.title IN (
    'ID', 'Pump The Brakes', 'Miracle Maker', 'San Francisco', 'Stay',
    'Get Hype', 'Freak', 'Atmosphere', 'Tidal Wave', 'A Drug From God',
    'Goosebumps', 'Jungle', 'Push To Start', 'Somebody (2024)', 'Baby Baby',
    'Drugs From Amsterdam', 'Gimme! Gimme! Gimme!', 'Metro', 'Shake The Bottle',
    'Take It Off', 'Crazy', 'World, Hold On', 'Losing It'
  )
  AND (
    (s.title = 'ID' AND s.artist = 'FISHER') OR
    (s.title = 'Pump The Brakes' AND s.artist = 'Dom Dolla') OR
    (s.title = 'Miracle Maker' AND s.artist = 'Dom Dolla') OR
    (s.title = 'San Francisco' AND s.artist = 'Dom Dolla') OR
    (s.title = 'Stay' AND s.artist = 'FISHER') OR
    (s.title = 'Get Hype' AND s.artist = 'Chris Lake') OR
    (s.title = 'Freak' AND s.artist = 'FISHER') OR
    (s.title = 'Atmosphere' AND s.artist = 'FISHER') OR
    (s.title = 'Tidal Wave' AND s.artist = 'Chris Lake') OR
    (s.title = 'A Drug From God' AND s.artist = 'Chris Lake & NPC') OR
    (s.title = 'Goosebumps' AND s.artist = 'HVDES') OR
    (s.title = 'Jungle' AND s.artist = 'X Ambassadors & Jamie N Commons') OR
    (s.title = 'Push To Start' AND s.artist = 'Noizu') OR
    (s.title = 'Somebody (2024)' AND s.artist = 'Gotye, Kimbra, FISHER, Chris Lake, Sante Sansone') OR
    (s.title = 'Baby Baby' AND s.artist = 'Mau P') OR
    (s.title = 'Drugs From Amsterdam' AND s.artist = 'Mau P') OR
    (s.title = 'Gimme! Gimme! Gimme!' AND s.artist = 'Mau P') OR
    (s.title = 'Metro' AND s.artist = 'Mau P') OR
    (s.title = 'Shake The Bottle' AND s.artist = 'Mau P') OR
    (s.title = 'Take It Off' AND s.artist = 'FISHER') OR
    (s.title = 'Crazy' AND s.artist = 'Patrick Topping') OR
    (s.title = 'World, Hold On' AND s.artist = 'Bob Sinclar') OR
    (s.title = 'Losing It' AND s.artist = 'FISHER')
  )
)
INSERT INTO song_adjacency (song_id_1, song_id_2, occurrence_count, avg_distance)
SELECT
  LEAST(t1.song_id, t2.song_id) as song_id_1,
  GREATEST(t1.song_id, t2.song_id) as song_id_2,
  1 as occurrence_count,
  1.0 as avg_distance
FROM fisher_tracklist t1
JOIN fisher_tracklist t2 ON t2.position = t1.position + 1
WHERE t1.song_id != t2.song_id;

-- Create consecutive adjacencies for Fred again.. setlist
WITH fred_tracklist AS (
  SELECT s.id as song_id, s.title, s.artist,
         ROW_NUMBER() OVER (ORDER BY
           CASE s.title
             WHEN 'Marea (We''ve Lost Dancing)' THEN 1
             WHEN 'Kyle (I Found You)' THEN 2
             WHEN 'Danielle (smile on my face)' THEN 3
             WHEN 'Angie (I''ve Been Lost)' THEN 4
             WHEN 'Turn On The Lights again..' THEN 5
             WHEN 'Rumble' THEN 6
             WHEN 'Baby again..' THEN 7
             WHEN 'Clara (the night is dark)' THEN 8
             WHEN 'adore u' THEN 9
             WHEN 'places to be' THEN 10
             WHEN 'Jungle' THEN 11
             WHEN 'Lights Out' THEN 12
             WHEN 'leavemealone' THEN 13
             WHEN 'Bleu (better with time)' THEN 14
             WHEN 'fear less' THEN 15
             WHEN 'Strong' THEN 16
             WHEN 'Billie (loving arms)' THEN 17
             WHEN 'ten' THEN 18
             WHEN 'Delilah (pull me out of this)' THEN 19
             ELSE 999
           END
         ) as position
  FROM songs s
  WHERE s.title IN (
    'Marea (We''ve Lost Dancing)', 'Kyle (I Found You)', 'Danielle (smile on my face)',
    'Angie (I''ve Been Lost)', 'Turn On The Lights again..', 'Rumble', 'Baby again..',
    'Clara (the night is dark)', 'adore u', 'places to be', 'Jungle', 'Lights Out',
    'leavemealone', 'Bleu (better with time)', 'fear less', 'Strong',
    'Billie (loving arms)', 'ten', 'Delilah (pull me out of this)'
  )
  AND s.artist LIKE '%Fred again%'
)
INSERT INTO song_adjacency (song_id_1, song_id_2, occurrence_count, avg_distance)
SELECT
  LEAST(t1.song_id, t2.song_id) as song_id_1,
  GREATEST(t1.song_id, t2.song_id) as song_id_2,
  1 as occurrence_count,
  1.0 as avg_distance
FROM fred_tracklist t1
JOIN fred_tracklist t2 ON t2.position = t1.position + 1
WHERE t1.song_id != t2.song_id
ON CONFLICT (song_id_1, song_id_2) DO UPDATE SET
  occurrence_count = song_adjacency.occurrence_count + 1;

-- Show final results
SELECT 'AFTER IMPORT:' as status;
SELECT
    COUNT(*) as total_songs,
    (SELECT COUNT(*) FROM song_adjacency) as total_adjacencies,
    (SELECT COUNT(DISTINCT song_id_1) + COUNT(DISTINCT song_id_2) FROM song_adjacency) as connected_songs
FROM songs;

SELECT
    CASE
      WHEN (SELECT COUNT(DISTINCT song_id_1) + COUNT(DISTINCT song_id_2) FROM song_adjacency) > 0
      THEN ROUND(((SELECT COUNT(DISTINCT song_id_1) + COUNT(DISTINCT song_id_2) FROM song_adjacency)::DECIMAL / COUNT(*)::DECIMAL) * 100, 1)
      ELSE 0
    END as connectivity_percentage
FROM songs;

SELECT 'SUCCESS: Consecutive adjacencies created!' as result;