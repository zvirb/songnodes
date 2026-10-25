-- Migration 100_ref_mb_schema_up.sql

-- Licence: CC0 (for core MB tables: artist, artist_alias, artist_credit, recording, isrc, track, release, release_label, label, release_group, url, canonical data)
-- Licence: CC-BY-NC-SA-3.0 (for tag/genre/derived data)

CREATE SCHEMA IF NOT EXISTS ref_mb;

-- Core Tables (CC0)
CREATE TABLE ref_mb.artist (
    id integer,
    gid uuid,
    name text,
    sort_name text,
    begin_date_year integer,
    begin_date_month integer,
    begin_date_day integer,
    end_date_year integer,
    end_date_month integer,
    end_date_day integer,
    type integer,
    area integer,
    gender integer,
    comment text,
    edits_pending integer,
    last_updated timestamp with time zone,
    ended boolean,
    begin_area integer,
    end_area integer
);

CREATE TABLE ref_mb.artist_alias (
    id integer,
    artist integer,
    name text,
    locale text,
    edits_pending integer,
    last_updated timestamp with time zone,
    type integer,
    sort_name text,
    begin_date_year integer,
    begin_date_month integer,
    begin_date_day integer,
    end_date_year integer,
    end_date_month integer,
    end_date_day integer,
    primary_for_locale boolean,
    ended boolean
);

CREATE TABLE ref_mb.artist_credit (
    id integer,
    name text,
    artist_count integer,
    ref_count integer,
    created timestamp with time zone
);

CREATE TABLE ref_mb.artist_credit_name (
    artist_credit integer,
    position integer,
    artist integer,
    name text,
    join_phrase text
);

CREATE TABLE ref_mb.recording (
    id integer,
    gid uuid,
    name text,
    artist_credit integer,
    length integer,
    comment text,
    edits_pending integer,
    last_updated timestamp with time zone,
    video boolean
);

CREATE TABLE ref_mb.recording_alias (
    id integer,
    recording integer,
    name text,
    locale text,
    edits_pending integer,
    last_updated timestamp with time zone,
    type integer,
    sort_name text,
    begin_date_year integer,
    begin_date_month integer,
    begin_date_day integer,
    end_date_year integer,
    end_date_month integer,
    end_date_day integer,
    primary_for_locale boolean,
    ended boolean
);

CREATE TABLE ref_mb.isrc (
    id integer,
    recording integer,
    isrc char(12),
    source integer,
    edits_pending integer,
    created timestamp with time zone
);

CREATE TABLE ref_mb.track (
    id integer,
    gid uuid,
    recording integer,
    medium integer,
    position integer,
    number text,
    name text,
    artist_credit integer,
    length integer,
    edits_pending integer,
    last_updated timestamp with time zone,
    is_data_track boolean
);

CREATE TABLE ref_mb.medium (
    id integer,
    release integer,
    position integer,
    format integer,
    name text,
    edits_pending integer,
    last_updated timestamp with time zone,
    track_count integer
);

CREATE TABLE ref_mb.release (
    id integer,
    gid uuid,
    name text,
    artist_credit integer,
    release_group integer,
    status integer,
    packaging integer,
    language integer,
    script integer,
    barcode text,
    comment text,
    edits_pending integer,
    quality integer,
    last_updated timestamp with time zone
);

CREATE TABLE ref_mb.release_label (
    id integer,
    release integer,
    label integer,
    catalog_number text,
    last_updated timestamp with time zone
);

CREATE TABLE ref_mb.label (
    id integer,
    gid uuid,
    name text,
    begin_date_year integer,
    begin_date_month integer,
    begin_date_day integer,
    end_date_year integer,
    end_date_month integer,
    end_date_day integer,
    label_code integer,
    type integer,
    area integer,
    comment text,
    edits_pending integer,
    last_updated timestamp with time zone,
    ended boolean
);

CREATE TABLE ref_mb.release_group (
    id integer,
    gid uuid,
    name text,
    artist_credit integer,
    type integer,
    comment text,
    edits_pending integer,
    last_updated timestamp with time zone
);

CREATE TABLE ref_mb.url (
    id integer,
    gid uuid,
    url text,
    edits_pending integer,
    last_updated timestamp with time zone
);

CREATE TABLE ref_mb.link (
    id integer,
    link_type integer,
    begin_date_year integer,
    begin_date_month integer,
    begin_date_day integer,
    end_date_year integer,
    end_date_month integer,
    end_date_day integer,
    attribute_count integer,
    created timestamp with time zone,
    ended boolean
);

CREATE TABLE ref_mb.link_type (
    id integer,
    parent integer,
    child_order integer,
    gid uuid,
    entity_type0 text,
    entity_type1 text,
    name text,
    description text,
    link_phrase text,
    reverse_link_phrase text,
    long_link_phrase text,
    priority integer,
    last_updated timestamp with time zone,
    is_deprecated boolean,
    has_dates boolean,
    entity0_cardinality integer,
    entity1_cardinality integer
);

CREATE TABLE ref_mb.l_artist_url (
    id integer,
    link integer,
    entity0 integer,
    entity1 integer,
    edits_pending integer,
    last_updated timestamp with time zone,
    link_order integer,
    entity0_credit text,
    entity1_credit text
);

CREATE TABLE ref_mb.l_label_url (
    id integer,
    link integer,
    entity0 integer,
    entity1 integer,
    edits_pending integer,
    last_updated timestamp with time zone,
    link_order integer,
    entity0_credit text,
    entity1_credit text
);

CREATE TABLE ref_mb.l_recording_url (
    id integer,
    link integer,
    entity0 integer,
    entity1 integer,
    edits_pending integer,
    last_updated timestamp with time zone,
    link_order integer,
    entity0_credit text,
    entity1_credit text
);

CREATE TABLE ref_mb.l_release_url (
    id integer,
    link integer,
    entity0 integer,
    entity1 integer,
    edits_pending integer,
    last_updated timestamp with time zone,
    link_order integer,
    entity0_credit text,
    entity1_credit text
);

CREATE TABLE ref_mb.l_release_group_url (
    id integer,
    link integer,
    entity0 integer,
    entity1 integer,
    edits_pending integer,
    last_updated timestamp with time zone,
    link_order integer,
    entity0_credit text,
    entity1_credit text
);

CREATE TABLE ref_mb.artist_gid_redirect (
    gid uuid,
    new_id integer,
    created timestamp with time zone
);

CREATE TABLE ref_mb.recording_gid_redirect (
    gid uuid,
    new_id integer,
    created timestamp with time zone
);

CREATE TABLE ref_mb.release_gid_redirect (
    gid uuid,
    new_id integer,
    created timestamp with time zone
);

CREATE TABLE ref_mb.release_group_gid_redirect (
    gid uuid,
    new_id integer,
    created timestamp with time zone
);

CREATE TABLE ref_mb.label_gid_redirect (
    gid uuid,
    new_id integer,
    created timestamp with time zone
);

-- Derived Tables (CC-BY-NC-SA-3.0)
CREATE TABLE ref_mb.tag (
    id integer,
    name text,
    ref_count integer
);

CREATE TABLE ref_mb.artist_tag (
    artist integer,
    tag integer,
    count integer,
    last_updated timestamp with time zone
);

CREATE TABLE ref_mb.recording_tag (
    recording integer,
    tag integer,
    count integer,
    last_updated timestamp with time zone
);

CREATE TABLE ref_mb.release_tag (
    release integer,
    tag integer,
    count integer,
    last_updated timestamp with time zone
);

CREATE TABLE ref_mb.release_group_tag (
    release_group integer,
    tag integer,
    count integer,
    last_updated timestamp with time zone
);

CREATE TABLE ref_mb.label_tag (
    label integer,
    tag integer,
    count integer,
    last_updated timestamp with time zone
);

CREATE TABLE ref_mb.genre (
    id integer,
    gid uuid,
    name text,
    comment text,
    edits_pending integer,
    last_updated timestamp with time zone
);

CREATE TABLE ref_mb.canonical_musicbrainz_data (
    id uuid,
    artist_credit_id integer,
    artist_mbids text,
    artist_credit_name text,
    release_mbid uuid,
    release_name text,
    recording_mbid uuid,
    recording_name text,
    combined_lookup text,
    score integer,
    year integer
);

CREATE TABLE ref_mb.canonical_recording_redirect (
    recording_mbid uuid,
    canonical_recording_mbid uuid,
    canonical_release_mbid uuid
);

CREATE TABLE ref_mb.canonical_release_redirect (
    release_mbid uuid,
    canonical_release_mbid uuid,
    release_group_mbid uuid
);

CREATE TABLE ref_mb.dump_meta (
    schema_sequence integer,
    timestamp timestamp with time zone,
    replication_sequence integer,
    source_file text,
    loaded_at timestamp with time zone
);

-- Adding explicit license comments per column as required
COMMENT ON COLUMN ref_mb.artist.id IS 'licence: CC0';
COMMENT ON COLUMN ref_mb.artist_alias.id IS 'licence: CC0';
COMMENT ON COLUMN ref_mb.artist_credit.id IS 'licence: CC0';
COMMENT ON COLUMN ref_mb.recording.id IS 'licence: CC0';
COMMENT ON COLUMN ref_mb.isrc.id IS 'licence: CC0';
COMMENT ON COLUMN ref_mb.track.id IS 'licence: CC0';
COMMENT ON COLUMN ref_mb.release.id IS 'licence: CC0';
COMMENT ON COLUMN ref_mb.release_label.id IS 'licence: CC0';
COMMENT ON COLUMN ref_mb.label.id IS 'licence: CC0';
COMMENT ON COLUMN ref_mb.release_group.id IS 'licence: CC0';
COMMENT ON COLUMN ref_mb.url.id IS 'licence: CC0';
COMMENT ON COLUMN ref_mb.canonical_musicbrainz_data.id IS 'licence: CC0';

COMMENT ON COLUMN ref_mb.tag.id IS 'licence: CC-BY-NC-SA-3.0';
COMMENT ON COLUMN ref_mb.artist_tag.artist IS 'licence: CC-BY-NC-SA-3.0';
COMMENT ON COLUMN ref_mb.recording_tag.recording IS 'licence: CC-BY-NC-SA-3.0';
COMMENT ON COLUMN ref_mb.release_tag.release IS 'licence: CC-BY-NC-SA-3.0';
COMMENT ON COLUMN ref_mb.release_group_tag.release_group IS 'licence: CC-BY-NC-SA-3.0';
COMMENT ON COLUMN ref_mb.label_tag.label IS 'licence: CC-BY-NC-SA-3.0';
COMMENT ON COLUMN ref_mb.genre.id IS 'licence: CC-BY-NC-SA-3.0';
