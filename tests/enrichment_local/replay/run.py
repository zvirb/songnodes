import argparse
import asyncio
import json
import uuid
import gzip
import csv
import httpx
from pathlib import Path
from collections import defaultdict
from unittest.mock import MagicMock, AsyncMock

from common.metadata.matching import Track
from common.providers.musicbrainz_local import MusicBrainzLocalProvider
from common.providers.registry import build_providers
from common.providers.web_call_log import WebCallLogger, attach_web_call_wrapper
from common.datalayer.enrichment import enrich_track, EVIDENCE_FIELDS
from common.refmb.settings import RefMBSettings

class AsyncContextManagerMock:
    def __init__(self, obj):
        self.obj = obj
    async def __aenter__(self):
        return self.obj
    async def __aexit__(self, exc_type, exc, tb):
        pass

def mock_pool():
    pool = MagicMock()
    conn = AsyncMock()

    pool.acquire.return_value = AsyncContextManagerMock(conn)

    # Load mock data from tsv
    isrcs_data = []
    with gzip.open("contracts/fixtures/staging/isrc.tsv.gz", "rt", encoding="utf-8") as f:
        for line in f:
            parts = line.strip().split("\t")
            if len(parts) >= 3:
                isrcs_data.append({"recording_id": parts[1], "isrc": parts[2]})

    recordings_data = []
    with gzip.open("contracts/fixtures/staging/recording.tsv.gz", "rt", encoding="utf-8") as f:
        for line in f:
            parts = line.strip().split("\t")
            if len(parts) >= 5:
                recordings_data.append({"id": parts[1], "title": parts[2], "length": parts[4]})

    async def mock_fetch(query, *args):
        if "isrc i" in query:
            isrc = args[0]
            # find recording with isrc
            rec_ids = [row["recording_id"] for row in isrcs_data if row["isrc"] == isrc]
            if not rec_ids:
                return []

            res = []
            for r_id in rec_ids:
                recs = [r for r in recordings_data if r["id"] == str(r_id) or (isinstance(r_id, int) and str(r["id"]) == str(r_id))]
                for rec in recs:
                    res.append({
                        'mbid': r_id,
                        'title': rec["title"],
                        'artist': 'Artist',
                        'duration': int(rec["length"]) if rec["length"] != '\\N' else None
                    })
            return res
        return []

    async def mock_fetchrow(query, *args):
        if "SELECT isrc" in query:
            rec_id = str(args[0])
            for r in isrcs_data:
                if r["recording_id"] == rec_id:
                    return {"isrc": r["isrc"]}
            return None
        if "SELECT length" in query:
            rec_id = str(args[0])
            for r in recordings_data:
                if r["id"] == rec_id:
                    return {"length": int(r["length"]) if r["length"] != '\\N' else None}
        return None

    conn.fetch = mock_fetch
    conn.fetchval = AsyncMock(return_value=None)
    conn.fetchrow = mock_fetchrow
    return pool

class FakeConnection:
    def __init__(self, track_data):
        self.track_data = track_data

    def transaction(self):
        class Tx:
            async def __aenter__(self_tx): pass
            async def __aexit__(self_tx, exc_type, exc, tb): pass
        return Tx()

    async def fetchrow(self, query, *args):
        if "SELECT id, artist_name" in query:
            return self.track_data
        return None

    async def fetchval(self, query, *args):
        return False

    async def execute(self, query, *args):
        pass

class FakeRecord:
    def __init__(self):
        self.inserts = []

    async def __call__(self, conn, track_id, field, value, source, **kwargs):
        if value is not None:
            self.inserts.append({
                "track_id": track_id,
                "field": field,
                "value": value,
                "source": source
            })
        return True

async def replay_enrichment(items_path: Path, live_db: bool, out_path: Path):
    if not items_path.exists():
        if live_db:
            out_path.parent.mkdir(parents=True, exist_ok=True)
            with open(out_path, "w") as f:
                f.write("# Library Replay\n(not run)")
            return

    tracks_json = []
    try:
        with open(items_path, "r", encoding="utf-8") as f:
            data = json.load(f)
            tracks_json = data if isinstance(data, list) else data.get("tracks", [])
    except FileNotFoundError:
        with open("tests/enrichment_local/replay/fixture_tracks.json", "r") as f:
            tracks_json = json.load(f)

    tracks = []
    for t in tracks_json:
        tracks.append({
            'id': uuid.uuid4(),
            'artist_name': t.get('a') or t.get('artist') or '',
            'track_title': t.get('t') or t.get('title') or '',
            'isrc': t.get('isrc') or t.get('isrcs', [None])[0],
            'duration_ms': (t.get('d') or t.get('duration_ms') or 0) * 1000 if (t.get('d') or t.get('duration_ms') or 0) < 100000 else (t.get('d') or t.get('duration_ms')),
            'genre': [t.get('g')] if t.get('g') else []
        })

    import common.datalayer.evidence as evidence
    original_record = evidence.record
    original_snapshot_legacy = evidence.snapshot_legacy
    original_set_reasons = evidence._set_reasons
    original_apply_all = evidence.apply_all

    def get_mock_response(url):
        if "oauth2/token" in url:
            return {"access_token": "fake_token"}
        if "://api.discogs.com" in url:
            return {"results": [{"id": 12345, "title": "Test Title", "year": "2026", "style": ["Electronic"]}]}
        if "://ws.audioscrobbler.com" in url:
            return {"track": {"name": "Test Title", "artist": {"name": "Test Artist"}}}
        if "://getsongbpm.com" in url:
            return {"search": [{"song_title": "Test Title", "artist": {"name": "Test Artist"}, "tempo": 120, "key_of_song": "C"}]}
        if "://api.deezer.com" in url:
            return {"data": [{"id": 12345, "title": "Test Title", "artist": {"name": "Test Artist"}, "duration": 300, "isrc": "USRC00000001"}]}
        if "://musicbrainz.org" in url:
            return {"recordings": [{"id": str(uuid.uuid4()), "title": "Test Title", "artist-credit": [{"name": "Test Artist"}], "length": 300000, "isrcs": ["USRC00000001"]}]}
        if "://api.tidal.com" in url or "://tidal.com" in url:
            return {"data": [{"id": 12345, "title": "Test Title", "artist": {"name": "Test Artist"}, "duration": 300, "isrc": "USRC00000001", "url": "https://tidal.com/1"}], "items": [{"item": {"id": 12345, "title": "Test Title", "artists": [{"name": "Test Artist"}], "duration": 300, "isrc": "USRC00000001"}}]}
        return {"data": []}

    def mock_handler(request: httpx.Request) -> httpx.Response:
        url = str(request.url)
        return httpx.Response(200, json=get_mock_response(url), request=request)

    env = {
        'TIDAL_CLIENT_ID': 'x', 'TIDAL_CLIENT_SECRET': 'x',
        'DISCOGS_TOKEN': 'x', 'LASTFM_API_KEY': 'x',
        'GETSONGBPM_API_KEY': 'x', 'GETSONGBPM_ENABLED': 'true',
        'ENRICHMENT_PROVIDERS': 'tidal,deezer,musicbrainz_local,musicbrainz,discogs,lastfm,getsongbpm'
    }

    async def run_pass(include_local):
        tracker = FakeRecord()
        evidence.record = tracker
        evidence.snapshot_legacy = AsyncMock(return_value=0)
        evidence._set_reasons = AsyncMock()
        evidence.apply_all = AsyncMock(return_value={})

        web_calls = defaultdict(int)

        if not include_local:
            env['MB_LOCAL_ENABLED'] = 'false'
        else:
            env['MB_LOCAL_ENABLED'] = 'true'

        providers = build_providers(env)

        for p in providers:
            transport = httpx.MockTransport(mock_handler)
            p.client = httpx.AsyncClient(transport=transport)

            def make_cb(name):
                return lambda entry: web_calls.__setitem__(name, web_calls[name] + 1)

            if hasattr(p, 'client') and isinstance(p.client, httpx.AsyncClient):
                logger = WebCallLogger(provider_name=p.name, run_id="test", log_callback=make_cb(p.name))
                p.client = attach_web_call_wrapper(p.client, logger)
            if p.name == 'musicbrainz_local' and not live_db:
                p.pool = mock_pool()

        for t in tracks:
            conn = FakeConnection(t)
            await enrich_track(conn, t['id'], providers)

        return tracker.inserts, web_calls

    print("Running pass 1: local provider OFF")
    inserts_off, calls_off = await run_pass(False)

    print("Running pass 2: local provider ON")
    inserts_on, calls_on = await run_pass(True)

    evidence.record = original_record
    evidence.snapshot_legacy = original_snapshot_legacy
    evidence._set_reasons = original_set_reasons
    evidence.apply_all = original_apply_all

    def calculate_coverage(inserts):
        coverage = {f: 0 for f in EVIDENCE_FIELDS}
        track_fields = defaultdict(set)
        for i in inserts:
            track_fields[i['track_id']].add(i['field'])

        for fields in track_fields.values():
            for f in fields:
                if f in coverage:
                    coverage[f] += 1
        return coverage

    cov_off = calculate_coverage(inserts_off)
    cov_on = calculate_coverage(inserts_on)

    out_path.parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, "w") as f:
        f.write("# Library Replay\n\n")

        f.write("## Field Coverage\n\n")
        f.write("| Field | Old (Coverage) | New (Coverage) |\n")
        f.write("| --- | --- | --- |\n")
        for field in EVIDENCE_FIELDS:
            lbl_off = f"fixture (n={len(tracks)}): {cov_off.get(field, 0)}"
            lbl_on = f"fixture (n={len(tracks)}): {cov_on.get(field, 0)}"
            f.write(f"| {field} | {lbl_off} | {lbl_on} |\n")

        f.write("\n## Web Calls\n\n")
        f.write("| Provider | Old | New |\n")
        f.write("| --- | --- | --- |\n")
        all_providers = set(calls_off.keys()) | set(calls_on.keys())
        for p in sorted(list(all_providers)):
            f.write(f"| {p} | {calls_off.get(p, 0)} | {calls_on.get(p, 0)} |\n")

    print(f"Report written to {out_path}")

def main():
    parser = argparse.ArgumentParser(description="Enrichment replay script")
    parser.add_argument("--items", required=True, type=Path)
    parser.add_argument("--live-db", action="store_true")
    parser.add_argument("--out", type=Path)

    args = parser.parse_args()
    asyncio.run(replay_enrichment(args.items, args.live_db, args.out))

if __name__ == "__main__":
    main()
