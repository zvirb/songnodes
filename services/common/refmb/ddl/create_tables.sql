-- DDL for tests only, using text types (derived from schema_inventory.csv)
CREATE SCHEMA IF NOT EXISTS ref_mb;

CREATE TABLE ref_mb.area (
    id text,
    gid text,
    name text,
    type text,
    edits_pending text,
    last_updated text,
    begin_date_year text,
    begin_date_month text,
    begin_date_day text,
    end_date_year text,
    end_date_month text,
    end_date_day text,
    ended text,
    comment text
);

CREATE TABLE ref_mb.artist (
    id text,
    gid text,
    name text,
    sort_name text,
    begin_date_year text,
    begin_date_month text,
    begin_date_day text,
    end_date_year text,
    end_date_month text,
    end_date_day text,
    type text,
    area text,
    gender text,
    comment text,
    edits_pending text,
    last_updated text,
    ended text,
    begin_area text,
    end_area text
);

CREATE TABLE ref_mb.artist_alias (
    id text,
    artist text,
    name text,
    locale text,
    edits_pending text,
    last_updated text,
    type text,
    sort_name text,
    begin_date_year text,
    begin_date_month text,
    begin_date_day text,
    end_date_year text,
    end_date_month text,
    end_date_day text,
    primary_for_locale text,
    ended text
);

CREATE TABLE ref_mb.artist_credit (
    id text,
    name text,
    artist_count text,
    ref_count text,
    created text,
    edits_pending text,
    gid text
);

CREATE TABLE ref_mb.artist_credit_name (
    artist_credit text,
    position text,
    artist text,
    name text,
    join_phrase text
);

CREATE TABLE ref_mb.artist_gid_redirect (
    gid text,
    new_id text,
    created text
);

CREATE TABLE ref_mb.country_area (
    area text
);

CREATE TABLE ref_mb.iso_3166_1 (
    area text,
    code text
);

CREATE TABLE ref_mb.isrc (
    id text,
    recording text,
    isrc text,
    edits_pending text,
    created text
);

CREATE TABLE ref_mb.label (
    id text,
    gid text,
    name text,
    begin_date_year text,
    begin_date_month text,
    begin_date_day text,
    end_date_year text,
    end_date_month text,
    end_date_day text,
    label_code text,
    type text,
    area text,
    comment text,
    edits_pending text,
    last_updated text,
    ended text
);

CREATE TABLE ref_mb.label_gid_redirect (
    gid text,
    new_id text,
    created text
);

CREATE TABLE ref_mb.medium (
    id text,
    release text,
    position text,
    format text,
    name text,
    edits_pending text,
    last_updated text,
    track_count text,
    gid text
);

CREATE TABLE ref_mb.recording (
    id text,
    gid text,
    name text,
    artist_credit text,
    length text,
    comment text,
    edits_pending text,
    last_updated text,
    video text
);

CREATE TABLE ref_mb.recording_alias (
    id text,
    recording text,
    name text,
    locale text,
    edits_pending text,
    last_updated text,
    type text,
    sort_name text,
    begin_date_year text,
    begin_date_month text,
    begin_date_day text,
    end_date_year text,
    end_date_month text,
    end_date_day text,
    primary_for_locale text,
    ended text
);

CREATE TABLE ref_mb.recording_gid_redirect (
    gid text,
    new_id text,
    created text
);

CREATE TABLE ref_mb.release (
    id text,
    gid text,
    name text,
    artist_credit text,
    release_group text,
    status text,
    packaging text,
    language text,
    script text,
    barcode text,
    comment text,
    edits_pending text,
    quality text,
    last_updated text
);

CREATE TABLE ref_mb.release_country (
    release text,
    country text,
    date_year text,
    date_month text,
    date_day text
);

CREATE TABLE ref_mb.release_gid_redirect (
    gid text,
    new_id text,
    created text
);

CREATE TABLE ref_mb.release_group (
    id text,
    gid text,
    name text,
    artist_credit text,
    type text,
    comment text,
    edits_pending text,
    last_updated text
);

CREATE TABLE ref_mb.release_group_gid_redirect (
    gid text,
    new_id text,
    created text
);

CREATE TABLE ref_mb.release_label (
    id text,
    release text,
    label text,
    catalog_number text,
    last_updated text
);

CREATE TABLE ref_mb.release_unknown_country (
    release text,
    date_year text,
    date_month text,
    date_day text
);

CREATE TABLE ref_mb.track (
    id text,
    gid text,
    recording text,
    medium text,
    position text,
    number text,
    name text,
    artist_credit text,
    length text,
    edits_pending text,
    last_updated text,
    is_data_track text
);

CREATE TABLE ref_mb.canonical_musicbrainz_data (
    id text,
    artist_credit_id text,
    artist_mbids text,
    artist_credit_name text,
    release_mbid text,
    release_name text,
    recording_mbid text,
    recording_name text,
    combined_lookup text,
    score text
);

CREATE TABLE ref_mb.canonical_recording_redirect (
    recording_mbid text,
    canonical_recording_mbid text,
    canonical_release_mbid text
);

CREATE TABLE ref_mb.dump_meta (
    schema_sequence text,
    timestamp text,
    replication_sequence text,
    source_file text,
    loaded_at text
);
