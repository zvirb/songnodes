-- Migration 140_mb_indexes_up.sql

CREATE OR REPLACE FUNCTION ref_mb.normalize_lookup(text) RETURNS text AS $$
BEGIN
    RETURN lower(regexp_replace(unaccent($1), '[^\w]+', '', 'g'));
END;
$$ LANGUAGE plpgsql IMMUTABLE;
