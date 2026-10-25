import logging
import psycopg2

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def run(db_url: str):
    logger.info("Building indexes...")

    conn = psycopg2.connect(db_url)
    conn.autocommit = True

    indexes = [
        # gid indexes
        "CREATE INDEX IF NOT EXISTS idx_artist_gid ON ref_mb.artist(gid);",
        "CREATE INDEX IF NOT EXISTS idx_recording_gid ON ref_mb.recording(gid);",
        "CREATE INDEX IF NOT EXISTS idx_release_gid ON ref_mb.release(gid);",
        "CREATE INDEX IF NOT EXISTS idx_release_group_gid ON ref_mb.release_group(gid);",
        "CREATE INDEX IF NOT EXISTS idx_label_gid ON ref_mb.label(gid);",

        # recording(artist_credit), track(recording), isrc(isrc)
        "CREATE INDEX IF NOT EXISTS idx_recording_artist_credit ON ref_mb.recording(artist_credit);",
        "CREATE INDEX IF NOT EXISTS idx_track_recording ON ref_mb.track(recording);",
        "CREATE INDEX IF NOT EXISTS idx_isrc_isrc ON ref_mb.isrc(isrc);",
        "CREATE INDEX IF NOT EXISTS idx_isrc_recording ON ref_mb.isrc(recording);",

        # link/url columns
        "CREATE INDEX IF NOT EXISTS idx_url_url ON ref_mb.url(url);",
        "CREATE INDEX IF NOT EXISTS idx_link_link_type ON ref_mb.link(link_type);",

        "CREATE INDEX IF NOT EXISTS idx_l_recording_url_entity0 ON ref_mb.l_recording_url(entity0);",
        "CREATE INDEX IF NOT EXISTS idx_l_recording_url_link ON ref_mb.l_recording_url(link);",

        "CREATE INDEX IF NOT EXISTS idx_l_artist_url_entity0 ON ref_mb.l_artist_url(entity0);",
        "CREATE INDEX IF NOT EXISTS idx_l_artist_url_link ON ref_mb.l_artist_url(link);",

        # tags
        "CREATE INDEX IF NOT EXISTS idx_recording_tag_recording ON ref_mb.recording_tag(recording);",
        "CREATE INDEX IF NOT EXISTS idx_recording_tag_tag ON ref_mb.recording_tag(tag);",

        # canonical tables
        "CREATE INDEX IF NOT EXISTS idx_cmd_recording_mbid ON ref_mb.canonical_musicbrainz_data(recording_mbid);",
        "CREATE INDEX IF NOT EXISTS idx_crr_recording_mbid ON ref_mb.canonical_recording_redirect(recording_mbid);",
        "CREATE INDEX IF NOT EXISTS idx_crr_canonical_recording_mbid ON ref_mb.canonical_recording_redirect(canonical_recording_mbid);",
    ]

    try:
        with conn.cursor() as cursor:
            for query in indexes:
                logger.info(f"Executing: {query}")
                cursor.execute(query)

            logger.info("Indexes built successfully.")
    except Exception as e:
        logger.error(f"Failed to build indexes: {e}")
        raise
    finally:
        conn.close()
