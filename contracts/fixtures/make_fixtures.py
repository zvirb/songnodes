import os
import json
import gzip
import sqlite3
import csv
import uuid
import random
from datetime import datetime, timezone

def set_seed(seed=42):
    random.seed(seed)

def generate_deterministic_uuid():
    return str(uuid.UUID(int=random.getrandbits(128)))

def setup_directories():
    os.makedirs('contracts/fixtures/staging', exist_ok=True)
    os.makedirs('contracts/fixtures/canonical', exist_ok=True)
    os.makedirs('contracts/fixtures/library', exist_ok=True)
    os.makedirs('contracts/fixtures/events', exist_ok=True)

def generate_mb_tsv_gz(filename, data):
    filepath = os.path.join('contracts/fixtures/staging', f'{filename}.tsv.gz')
    with gzip.open(filepath, 'wt', encoding='utf-8') as f:
        for row in data:
            f.write('\t'.join(str(item) if item is not None else '\\N' for item in row) + '\n')

def generate_canonical_csv_gz(filename, headers, data):
    filepath = os.path.join('contracts/fixtures/canonical', f'{filename}.csv.gz')
    with gzip.open(filepath, 'wt', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow(headers)
        writer.writerows(data)

def generate_library_sqlite():
    filepath = os.path.join('contracts/fixtures/library', 'dj_library.sqlite')
    if os.path.exists(filepath):
        os.remove(filepath)

    conn = sqlite3.connect(filepath)
    cursor = conn.cursor()

    # Tables requested: tracks, appearances, rotation_history, chart_positions, pending, rejected, beatport_check, sources, sets, set_tracks, runs, track_tags, track_xref
    cursor.execute('CREATE TABLE tracks (id TEXT PRIMARY KEY, created_at TEXT, updated_at TEXT)')
    cursor.execute('CREATE TABLE appearances (id INTEGER PRIMARY KEY, track_id TEXT, source TEXT, date TEXT, chart_rank INTEGER, created_at TEXT)')
    cursor.execute('CREATE TABLE rotation_history (id INTEGER PRIMARY KEY, track_id TEXT, rotation TEXT, changed_at TEXT, created_at TEXT)')
    cursor.execute('CREATE TABLE chart_positions (id INTEGER PRIMARY KEY, track_id TEXT, chart_name TEXT, position INTEGER, date TEXT, created_at TEXT)')
    cursor.execute('CREATE TABLE pending (id INTEGER PRIMARY KEY, track_id TEXT, reason TEXT, created_at TEXT)')
    cursor.execute('CREATE TABLE rejected (id INTEGER PRIMARY KEY, track_id TEXT, reason TEXT, created_at TEXT)')
    cursor.execute('CREATE TABLE beatport_check (id INTEGER PRIMARY KEY, track_id TEXT, checked_at TEXT, result TEXT, created_at TEXT)')
    cursor.execute('CREATE TABLE sources (id INTEGER PRIMARY KEY, name TEXT, type TEXT, created_at TEXT)')
    cursor.execute('CREATE TABLE sets (id INTEGER PRIMARY KEY, name TEXT, description TEXT, created_at TEXT, updated_at TEXT)')
    cursor.execute('CREATE TABLE set_tracks (set_id INTEGER, track_id TEXT, position INTEGER, created_at TEXT, PRIMARY KEY (set_id, track_id))')
    cursor.execute('CREATE TABLE runs (id INTEGER PRIMARY KEY, run_date TEXT, status TEXT, metrics TEXT, created_at TEXT)')
    cursor.execute('CREATE TABLE track_tags (track_id TEXT, tag TEXT, created_at TEXT, PRIMARY KEY (track_id, tag))')
    cursor.execute('CREATE TABLE track_xref (source_system TEXT, source_id TEXT, canonical_id TEXT, confidence REAL, created_at TEXT, PRIMARY KEY (source_system, source_id))')

    now_iso = datetime.now(timezone.utc).isoformat()
    # Insert 319 tracks
    tracks = []
    for i in range(1, 320):
        track_id = f'h:{generate_deterministic_uuid().replace("-", "")[:12]}'
        tracks.append((track_id, now_iso, now_iso))

    cursor.executemany('INSERT INTO tracks VALUES (?, ?, ?)', tracks)

    conn.commit()
    conn.close()

def generate_events():
    event = {
        "aggregate_type": "library_track",
        "aggregate_id": generate_deterministic_uuid(),
        "event_type": "library.track.upserted.v1",
        "payload": {
            "source_system": "dj_library",
            "source_id": "h:abc123def456",
            "norm_key": "artisttitle",
            "attributes": {"isrc": "USRC00000001"}
        }
    }

    with open('contracts/fixtures/events/sample_upsert.json', 'w') as f:
        json.dump(event, f, indent=2)

def main():
    set_seed(42) # Ensure determinism
    setup_directories()

    now_iso = datetime.now(timezone.utc).isoformat()

    # Generate tiny MB staging (around 200 rows)
    # artists
    artists = [[i, generate_deterministic_uuid(), f"Artist {i}"] for i in range(1, 201)]
    generate_mb_tsv_gz('artist', artists)

    # artist aliases
    artist_aliases = [[i, i, f"Alias {i}", "en", 0, now_iso, 1, f"Alias {i}", 1990, 1, 1, 2000, 1, 1, True, True] for i in range(1, 201)]
    generate_mb_tsv_gz('artist_alias', artist_aliases)

    # recordings
    recordings = [[i, generate_deterministic_uuid(), f"Recording {i}", i, 300, None, 0, now_iso, False] for i in range(1, 201)]
    generate_mb_tsv_gz('recording', recordings)

    # isrcs
    isrcs = [[i, i, f"USRC{i:08d}", 1, 0, now_iso] for i in range(1, 201)]
    generate_mb_tsv_gz('isrc', isrcs)

    # labels
    labels = [[i, generate_deterministic_uuid(), f"Label {i}", 1990, 1, 1, 2020, 1, 1, 1234, 1, 1, "test", 0, now_iso, False] for i in range(1, 201)]
    generate_mb_tsv_gz('label', labels)

    # tags
    tags = [[i, f"Tag {i}", 10] for i in range(1, 201)]
    generate_mb_tsv_gz('tag', tags)

    # URL relations (e.g. url, l_artist_url)
    urls = [[i, generate_deterministic_uuid(), f"http://example.com/artist/{i}", 0, now_iso] for i in range(1, 201)]
    generate_mb_tsv_gz('url', urls)

    l_artist_urls = [[i, 1, i, i, 0, now_iso, 0, "", ""] for i in range(1, 201)]
    generate_mb_tsv_gz('l_artist_url', l_artist_urls)

    # redirects
    artist_redirects = [[generate_deterministic_uuid(), i, now_iso] for i in range(1, 201)]
    generate_mb_tsv_gz('artist_gid_redirect', artist_redirects)

    manifest = {
        "schema_sequence": 1,
        "timestamp": now_iso,
        "files": ["artist.tsv.gz", "artist_alias.tsv.gz", "recording.tsv.gz", "isrc.tsv.gz", "label.tsv.gz", "tag.tsv.gz", "url.tsv.gz", "l_artist_url.tsv.gz", "artist_gid_redirect.tsv.gz"]
    }
    with open('contracts/fixtures/staging/manifest.json', 'w') as f:
        json.dump(manifest, f, indent=2)

    # Generate canonical sample
    canonical_headers = ["id", "artist_credit_id", "artist_mbids", "artist_credit_name", "release_mbid", "release_name", "recording_mbid", "recording_name", "combined_lookup", "score", "year"]
    canonical_data = [[generate_deterministic_uuid(), i, generate_deterministic_uuid(), f"Artist {i}", generate_deterministic_uuid(), f"Release {i}", generate_deterministic_uuid(), f"Recording {i}", f"artist{i}recording{i}", 100, 2026] for i in range(1, 1001)]
    generate_canonical_csv_gz('canonical_musicbrainz_data', canonical_headers, canonical_data)

    generate_library_sqlite()
    generate_events()

if __name__ == '__main__':
    main()
