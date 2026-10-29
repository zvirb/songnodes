from pathlib import Path
import sqlite3
import re

def test_migration_185_up_references_musicbrainz_id():
    up_path = Path("sql/migrations/185_reconcile_view_musicbrainz_id_up.sql")
    content = up_path.read_text()

    assert "musicbrainz_id" in content, "Up migration should reference 'musicbrainz_id'"
    assert "'mbid'" not in content, "Up migration should not reference 'mbid' field filter"

def test_migration_185_down_matches_181_up():
    down_path = Path("sql/migrations/185_reconcile_view_musicbrainz_id_down.sql")
    up_181_path = Path("sql/migrations/181_insert_reconciliation_reports_up.sql")

    down_content = down_path.read_text()
    up_181_content = up_181_path.read_text()

    def get_view_body(content):
        lines = content.split('\n')
        for i, line in enumerate(lines):
            if "CREATE OR REPLACE VIEW" in line:
                return '\n'.join(lines[i:]).strip()
        return ""

    down_body = get_view_body(down_content)
    up_181_body = get_view_body(up_181_content)

    assert down_body == up_181_body, "Down migration 185 should match 181 up body exactly"

def test_reconciliation_view_query_sqlite():
    up_path = Path("sql/migrations/185_reconcile_view_musicbrainz_id_up.sql")
    sql_content = up_path.read_text()

    # Adapt PostgreSQL schema-qualified syntax for SQLite test
    sqlite_sql = re.sub(r'library\.v_reconciliation_report', 'v_reconciliation_report', sql_content)
    sqlite_sql = re.sub(r'library\.tracks', 'tracks', sqlite_sql)
    sqlite_sql = re.sub(r'CREATE OR REPLACE VIEW', 'CREATE VIEW', sqlite_sql)

    conn = sqlite3.connect(":memory:")
    conn.execute("CREATE TABLE tracks (id TEXT PRIMARY KEY);")
    conn.execute("CREATE TABLE silver_enriched_tracks (id TEXT PRIMARY KEY, artist_name TEXT, track_title TEXT, enrichment_metadata TEXT);")
    conn.execute("CREATE TABLE silver_track_metadata_evidence (track_id TEXT, field TEXT, value TEXT);")

    conn.execute(sqlite_sql)

    # Insert test data with field='musicbrainz_id'
    conn.execute("INSERT INTO tracks VALUES ('t1'), ('t2');")
    conn.execute("INSERT INTO silver_enriched_tracks VALUES ('t1', 'Artist A', 'Title A', '{}'), ('t2', 'Artist A', 'Title A', '{}');")
    conn.execute("INSERT INTO silver_track_metadata_evidence VALUES ('t1', 'isrc', 'ISRC123'), ('t2', 'isrc', 'ISRC123');")
    conn.execute("INSERT INTO silver_track_metadata_evidence VALUES ('t1', 'musicbrainz_id', 'mbid-uuid-1');")

    rows = conn.execute("SELECT track_id, isrc, artist_name, track_title, mbid FROM v_reconciliation_report ORDER BY track_id;").fetchall()

    assert len(rows) == 2
    assert rows[0] == ('t1', 'ISRC123', 'Artist A', 'Title A', 'mbid-uuid-1')
    assert rows[1] == ('t2', 'ISRC123', 'Artist A', 'Title A', None)
