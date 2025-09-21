-- Update all songs with their proper artist associations

UPDATE songs SET primary_artist_id = (SELECT artist_id FROM artists WHERE name = 'Alesso') WHERE title = 'Heroes';
UPDATE songs SET primary_artist_id = (SELECT artist_id FROM artists WHERE name = 'Swedish House Mafia') WHERE title = 'Don''t You Worry Child';
UPDATE songs SET primary_artist_id = (SELECT artist_id FROM artists WHERE name = 'David Guetta') WHERE title = 'Titanium';
UPDATE songs SET primary_artist_id = (SELECT artist_id FROM artists WHERE name = 'David Guetta') WHERE title = 'Without You';
UPDATE songs SET primary_artist_id = (SELECT artist_id FROM artists WHERE name = 'Swedish House Mafia') WHERE title = 'One';
UPDATE songs SET primary_artist_id = (SELECT artist_id FROM artists WHERE name = 'Tiësto') WHERE title = 'Traffic';
UPDATE songs SET primary_artist_id = (SELECT artist_id FROM artists WHERE name = 'Deadmau5') WHERE title = 'Raise Your Weapon';
UPDATE songs SET primary_artist_id = (SELECT artist_id FROM artists WHERE name = 'Eric Prydz') WHERE title = 'Every Day';
UPDATE songs SET primary_artist_id = (SELECT artist_id FROM artists WHERE name = 'Deadmau5') WHERE title = 'Strobe';
UPDATE songs SET primary_artist_id = (SELECT artist_id FROM artists WHERE name = 'Skrillex') WHERE title = 'Cinema';
UPDATE songs SET primary_artist_id = (SELECT artist_id FROM artists WHERE name = 'Martin Garrix') WHERE title = 'In the Name of Love';
UPDATE songs SET primary_artist_id = (SELECT artist_id FROM artists WHERE name = 'Calvin Harris') WHERE title = 'Feel So Close';
UPDATE songs SET primary_artist_id = (SELECT artist_id FROM artists WHERE name = 'Martin Garrix') WHERE title = 'Tremor';
UPDATE songs SET primary_artist_id = (SELECT artist_id FROM artists WHERE name = 'Deadmau5') WHERE title = 'Some Chords';
UPDATE songs SET primary_artist_id = (SELECT artist_id FROM artists WHERE name = 'Eric Prydz') WHERE title = 'Pjanoo';
UPDATE songs SET primary_artist_id = (SELECT artist_id FROM artists WHERE name = 'Swedish House Mafia') WHERE title = 'Save The World';
UPDATE songs SET primary_artist_id = (SELECT artist_id FROM artists WHERE name = 'Martin Garrix') WHERE title = 'Animals';
UPDATE songs SET primary_artist_id = (SELECT artist_id FROM artists WHERE name = 'Alesso') WHERE title = 'Under Control';
UPDATE songs SET primary_artist_id = (SELECT artist_id FROM artists WHERE name = 'Eric Prydz') WHERE title = 'Call on Me';
UPDATE songs SET primary_artist_id = (SELECT artist_id FROM artists WHERE name = 'Calvin Harris') WHERE title = 'How Deep Is Your Love';
UPDATE songs SET primary_artist_id = (SELECT artist_id FROM artists WHERE name = 'Swedish House Mafia') WHERE title = 'Miami 2 Ibiza';
UPDATE songs SET primary_artist_id = (SELECT artist_id FROM artists WHERE name = 'Alesso vs OneRepublic') WHERE title = 'If I Lose Myself';
UPDATE songs SET primary_artist_id = (SELECT artist_id FROM artists WHERE name = 'Martin Garrix') WHERE title = 'Wizard';
UPDATE songs SET primary_artist_id = (SELECT artist_id FROM artists WHERE name = 'Eric Prydz') WHERE title = 'Liberate';
UPDATE songs SET primary_artist_id = (SELECT artist_id FROM artists WHERE name = 'Calvin Harris') WHERE title = 'I Need Your Love';
UPDATE songs SET primary_artist_id = (SELECT artist_id FROM artists WHERE name = 'Deadmau5') WHERE title = 'Ghosts ''n'' Stuff';
UPDATE songs SET primary_artist_id = (SELECT artist_id FROM artists WHERE name = 'Skrillex') WHERE title = 'Bangarang';
UPDATE songs SET primary_artist_id = (SELECT artist_id FROM artists WHERE name = 'Tiësto') WHERE title = 'Wasted';
UPDATE songs SET primary_artist_id = (SELECT artist_id FROM artists WHERE name = 'Martin Garrix') WHERE title = 'Forbidden Voices';
UPDATE songs SET primary_artist_id = (SELECT artist_id FROM artists WHERE name = 'Alesso') WHERE title = 'Years';
UPDATE songs SET primary_artist_id = (SELECT artist_id FROM artists WHERE name = 'David Guetta') WHERE title = 'Play Hard';
UPDATE songs SET primary_artist_id = (SELECT artist_id FROM artists WHERE name = 'Eric Prydz') WHERE title = 'Generate';
UPDATE songs SET primary_artist_id = (SELECT artist_id FROM artists WHERE name = 'Calvin Harris') WHERE title = 'Thinking About You';
UPDATE songs SET primary_artist_id = (SELECT artist_id FROM artists WHERE name = 'Deadmau5') WHERE title = 'The Veldt';
UPDATE songs SET primary_artist_id = (SELECT artist_id FROM artists WHERE name = 'Swedish House Mafia') WHERE title = 'Greyhound';
UPDATE songs SET primary_artist_id = (SELECT artist_id FROM artists WHERE name = 'Skrillex') WHERE title = 'Scary Monsters and Nice Sprites';
UPDATE songs SET primary_artist_id = (SELECT artist_id FROM artists WHERE name = 'Tiësto') WHERE title = 'Red Lights';
UPDATE songs SET primary_artist_id = (SELECT artist_id FROM artists WHERE name = 'Martin Garrix') WHERE title = 'Gold Skies';
UPDATE songs SET primary_artist_id = (SELECT artist_id FROM artists WHERE name = 'Alesso') WHERE title = 'City of Dreams';
UPDATE songs SET primary_artist_id = (SELECT artist_id FROM artists WHERE name = 'David Guetta') WHERE title = 'She Wolf';
UPDATE songs SET primary_artist_id = (SELECT artist_id FROM artists WHERE name = 'Eric Prydz') WHERE title = 'Opus';
UPDATE songs SET primary_artist_id = (SELECT artist_id FROM artists WHERE name = 'Calvin Harris') WHERE title = 'Sweet Nothing';
UPDATE songs SET primary_artist_id = (SELECT artist_id FROM artists WHERE name = 'Deadmau5') WHERE title = 'Aural Psynapse';
UPDATE songs SET primary_artist_id = (SELECT artist_id FROM artists WHERE name = 'Swedish House Mafia') WHERE title = 'Antidote';
UPDATE songs SET primary_artist_id = (SELECT artist_id FROM artists WHERE name = 'Skrillex') WHERE title = 'First of the Year';
UPDATE songs SET primary_artist_id = (SELECT artist_id FROM artists WHERE name = 'Tiësto') WHERE title = 'Adagio for Strings';

-- Check the results
SELECT COUNT(*) as total_songs_with_artists FROM songs WHERE primary_artist_id IS NOT NULL;
SELECT
    s.title,
    a.name as artist_name
FROM songs s
LEFT JOIN artists a ON s.primary_artist_id = a.artist_id
WHERE s.primary_artist_id IS NOT NULL
ORDER BY a.name, s.title
LIMIT 10;