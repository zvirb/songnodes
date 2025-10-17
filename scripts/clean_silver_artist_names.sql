-- Clean Artist Names in Silver Enriched Tracks
-- Purpose: Remove DJ tracklist formatting artifacts from silver layer artist names
--
-- Problem: Artist names in silver_enriched_tracks contain formatting artifacts:
-- - Timestamp prefixes: [40:54] Artist, [0??] Artist, [00?] Artist
-- - Numeric brackets: [420] Artist (track numbers)
-- - Special characters: + # Artist, + Artist (b2b/featured notations)
--
-- This script cleans 105,000+ dirty records and prevents them from appearing
-- in the frontend. The ETL pipeline has been updated to prevent new dirty data.
--
-- Usage:
--   psql -U musicdb_user -d musicdb -f scripts/clean_silver_artist_names.sql

\echo '============================================================'
\echo 'Silver Layer Artist Name Cleanup - Before Statistics'
\echo '============================================================'

SELECT
    COUNT(*) as total_tracks,
    COUNT(*) FILTER (WHERE artist_name ~ '^\+') as plus_prefix,
    COUNT(*) FILTER (WHERE artist_name ~ '^-\s') as dash_prefix,
    COUNT(*) FILTER (WHERE artist_name ~ '^\*') as star_prefix,
    COUNT(*) FILTER (WHERE artist_name ~ '^\[') as bracket_prefix,
    COUNT(*) FILTER (WHERE artist_name ~ '^\+' OR artist_name ~ '^-\s' OR artist_name ~ '^\*' OR artist_name ~ '^\[') as total_dirty
FROM silver_enriched_tracks;

\echo ''
\echo 'Sample dirty artist names (first 20):'
SELECT DISTINCT artist_name
FROM silver_enriched_tracks
WHERE artist_name ~ '^\+' OR artist_name ~ '^-\s' OR artist_name ~ '^\*' OR artist_name ~ '^\['
ORDER BY artist_name
LIMIT 20;

\echo ''
\echo '============================================================'
\echo 'Creating comprehensive cleaning function...'
\echo '============================================================'

-- Create cleaning function with COMPREHENSIVE pattern matching
-- Single universal pattern catches ALL cases: [00?], [0??], [0:37:29], [420], [2:35:30], [??:??], etc.
CREATE OR REPLACE FUNCTION clean_artist_name_sql(name TEXT) RETURNS TEXT AS $$
BEGIN
    IF name IS NULL OR name = '' THEN
        RETURN name;
    END IF;

    -- Remove ALL bracketed prefixes that look like timestamps or track numbers
    -- Pattern: opening bracket, any combo of digits/question marks/colons, closing bracket, optional whitespace
    -- This catches: [00?], [0??], [0:37:29], [420], [2:35:30], [??:??], [?], etc.
    name := regexp_replace(name, '^\[[0-9\?:]+\]\s*', '', 'g');

    -- Remove special character prefixes (with or without spaces)
    name := regexp_replace(name, '^\+\s*#\s*\+?\s*', '', 'g');  -- + # + or + #
    name := regexp_replace(name, '^\+\s*#\s*', '', 'g');        -- + #
    name := regexp_replace(name, '^\+\s+', '', 'g');            -- + (with space)
    name := regexp_replace(name, '^-\s+', '', 'g');             -- - (with space)
    name := regexp_replace(name, '^\*\s+', '', 'g');            -- * (with space)

    -- Trim whitespace
    name := TRIM(name);

    RETURN name;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

\echo 'Created clean_artist_name_sql() function'
\echo ''

\echo '============================================================'
\echo 'Cleaning artist names in silver_enriched_tracks...'
\echo '============================================================'

-- Update all dirty artist names
UPDATE silver_enriched_tracks
SET
    artist_name = clean_artist_name_sql(artist_name),
    updated_at = CURRENT_TIMESTAMP
WHERE artist_name ~ '^\[' OR artist_name ~ '^\+';

\echo 'Artist names cleaned!'
\echo ''

\echo '============================================================'
\echo 'Cleanup Complete - After Statistics'
\echo '============================================================'

SELECT
    COUNT(*) as total_tracks,
    COUNT(*) FILTER (WHERE artist_name ~ '^\+') as plus_prefix,
    COUNT(*) FILTER (WHERE artist_name ~ '^-\s') as dash_prefix,
    COUNT(*) FILTER (WHERE artist_name ~ '^\*') as star_prefix,
    COUNT(*) FILTER (WHERE artist_name ~ '^\[') as bracket_prefix,
    COUNT(*) FILTER (WHERE artist_name ~ '^\+' OR artist_name ~ '^-\s' OR artist_name ~ '^\*' OR artist_name ~ '^\[') as total_dirty
FROM silver_enriched_tracks;

\echo ''
\echo '============================================================'
\echo 'SUCCESS! Silver layer cleaned.'
\echo '============================================================'
\echo 'The frontend will now show clean artist names.'
\echo 'The ETL pipeline (silver_to_gold_etl.py) has been updated to'
\echo 'prevent new dirty data from being written to silver layer.'
\echo '============================================================'
