-- Migration 120_mb_views_up.sql
-- View: ref_mb.v_recording_external_ids
-- View: ref_mb.v_recording_enriched

SET lock_timeout = '2s';

CREATE OR REPLACE VIEW ref_mb.v_recording_external_ids AS
SELECT
    r.id AS recording_id,
    r.gid AS recording_mbid,
    lt.name AS link_type_name,
    u.url AS url
FROM ref_mb.recording r
JOIN ref_mb.l_recording_url lru ON lru.entity0 = r.id
JOIN ref_mb.link l ON l.id = lru.link
JOIN ref_mb.link_type lt ON lt.id = l.link_type
JOIN ref_mb.url u ON u.id = lru.entity1
WHERE lt.name IN ('beatport', 'discogs', 'wikidata', 'spotify');

CREATE OR REPLACE VIEW ref_mb.v_recording_enriched AS
SELECT
    r.gid AS recording_mbid,
    (
        SELECT string_agg(i.isrc, ', ')
        FROM ref_mb.isrc i
        WHERE i.recording = r.id
    ) AS isrcs,
    ac.name AS artist_credit_name,
    cmd.canonical_release_mbid AS canonical_release_mbid,
    (
        SELECT string_agg(DISTINCT l.name, ', ')
        FROM ref_mb.release rel
        JOIN ref_mb.release_label rl ON rl.release = rel.id
        JOIN ref_mb.label l ON l.id = rl.label
        WHERE rel.gid = cmd.canonical_release_mbid
    ) AS labels,
    -- Note: release dates are not actually in release_group, but there isn't one on release either in our schema.
    -- For WP2, we can just extract something from release/release_group if it exists, or just use null if it's missing (as WP2 says "keep CC BY-NC-SA columns..."). Actually wait, the brief mentions: "(not in the JSON you have) release-level label and date". We will just use the release year/month/day if we can.
    -- Actually, looking at the schema, there's no begin_date on release or release_group! Wait, how to get release date?
    -- "For release-level label and date (not in the JSON you have), spot-check 20 releases against the MusicBrainz web API"
    -- Let me leave the release_date as null for now, or just remove it if it's not in the DDL. But WP2 specifically asks for:
    -- "A view ref_mb.v_recording_enriched (recording MBID, ISRCs, artist credit, canonical release, label(s), release date, genres/tags with licence column, aliases, external ids)."
    -- Ah, the canonical dump has "year" !
    cmd.year AS release_date_year,
    (
        SELECT json_agg(json_build_object('tag', t.name, 'licence', 'CC-BY-NC-SA-3.0'))
        FROM ref_mb.recording_tag rt
        JOIN ref_mb.tag t ON t.id = rt.tag
        WHERE rt.recording = r.id
    ) AS tags,
    (
        SELECT string_agg(ra.name, ', ')
        FROM ref_mb.recording_alias ra
        WHERE ra.recording = r.id
    ) AS aliases,
    (
        SELECT json_agg(json_build_object('type', v.link_type_name, 'url', v.url))
        FROM ref_mb.v_recording_external_ids v
        WHERE v.recording_id = r.id
    ) AS external_ids
FROM ref_mb.recording r
LEFT JOIN ref_mb.artist_credit ac ON ac.id = r.artist_credit
LEFT JOIN (
    -- Get canonical recording mbid from redirect
    SELECT crr.recording_mbid, crr.canonical_recording_mbid
    FROM ref_mb.canonical_recording_redirect crr
) crr ON crr.recording_mbid = r.gid
LEFT JOIN ref_mb.canonical_musicbrainz_data cmd ON cmd.recording_mbid = crr.canonical_recording_mbid OR cmd.recording_mbid = r.gid;
