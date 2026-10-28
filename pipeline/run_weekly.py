"""Weekly run pipeline processing module."""

import os
import sys
import json
import logging
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

# Add repo root to sys.path if missing
repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if repo_root not in sys.path:
    sys.path.insert(0, repo_root)

# Import dsp_analyzer and ref_mb_resolver defensively
try:
    from pipeline.djlib.dsp_analyzer import analyze_preview
except ImportError:
    try:
        from djlib.dsp_analyzer import analyze_preview
    except ImportError:
        analyze_preview = None

try:
    from pipeline.djlib.ref_mb_resolver import resolve_isrc_local
except ImportError:
    try:
        from djlib.ref_mb_resolver import resolve_isrc_local
    except ImportError:
        resolve_isrc_local = None


def choose_version(tv: Optional[Dict[str, Any]], dz: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    """Select TIDAL version first, falling back to Deezer version if TIDAL is not available."""
    if tv:
        return dict(tv)
    if dz:
        return dict(dz)
    return None


def build_record(tv: Optional[Dict[str, Any]], dz: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    """
    Build a track record using choose_version.

    If the selected version's BPM is null or 0, fallback to inheriting a valid non-zero
    BPM from the Deezer version if available.
    """
    v = choose_version(tv, dz)
    if v is None:
        return None

    current_bpm = v.get("bpm")
    has_valid_bpm = current_bpm is not None and current_bpm != 0

    if not has_valid_bpm:
        dz_bpm = dz.get("bpm") if dz else None
        if dz_bpm is not None and dz_bpm != 0:
            if isinstance(dz_bpm, float) and dz_bpm.is_integer():
                v["bpm"] = int(dz_bpm)
            elif isinstance(dz_bpm, (int, float)):
                v["bpm"] = dz_bpm
            else:
                try:
                    val = float(dz_bpm)
                    v["bpm"] = int(val) if val.is_integer() else val
                except (ValueError, TypeError):
                    v["bpm"] = None
        else:
            v["bpm"] = None

    # Also extract Deezer preview URL if available
    if dz and dz.get("preview"):
        v["preview"] = dz.get("preview")

    return v


def cmd_resolve(to_resolve: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Processes a list of tracks in `to_resolve`:
    1. Extracts the Deezer `preview` URL.
    2. If `bpm` or `key`/`camelot_key` is missing, calls `dsp_analyzer.analyze_preview`.
    3. Queries `ref_mb_resolver.resolve_isrc_local` to attach canonical `mbid`.
    """
    resolved_tracks = []
    for track_item in to_resolve:
        track = dict(track_item)

        # 1. Extract preview URL
        preview_url = (
            track.get("preview")
            or track.get("preview_url")
            or track.get("deezer_preview")
            or (track.get("dz") or {}).get("preview")
        )

        # 2. DSP Analysis for missing BPM or key
        bpm = track.get("bpm")
        camelot_key = track.get("camelot_key") or track.get("key")
        missing_bpm = bpm is None or bpm == 0
        missing_key = not camelot_key

        if (missing_bpm or missing_key) and preview_url and callable(analyze_preview):
            try:
                dsp_result = analyze_preview(preview_url)
                if dsp_result:
                    if missing_bpm and dsp_result.get("bpm"):
                        track["bpm"] = dsp_result["bpm"]
                    if missing_key and dsp_result.get("camelot_key"):
                        track["camelot_key"] = dsp_result["camelot_key"]
                        if not track.get("key"):
                            track["key"] = dsp_result.get("musical_key") or dsp_result["camelot_key"]
            except Exception as e:
                logger.warning(f"DSP analysis failed for track {track.get('title')}: {e}")

        # 3. Local MusicBrainz ISRC resolution
        isrc = track.get("isrc")
        if isrc and callable(resolve_isrc_local) and not track.get("mbid"):
            try:
                mb_result = resolve_isrc_local(isrc)
                if mb_result and mb_result.get("mbid"):
                    track["mbid"] = mb_result["mbid"]
            except Exception as e:
                logger.warning(f"ISRC resolution failed for ISRC {isrc}: {e}")

        resolved_tracks.append(track)

    return resolved_tracks


def export_library_json(tracks: List[Dict[str, Any]], output_path: str = "outputs/artifact/library.json") -> str:
    """
    Export resolved tracks to outputs/artifact/library.json format with `bpm` and `k` fields.
    """
    dirname = os.path.dirname(output_path)
    if dirname:
        os.makedirs(dirname, exist_ok=True)

    formatted_tracks = []
    for t in tracks:
        item = dict(t)
        item["bpm"] = t.get("bpm")
        item["k"] = t.get("camelot_key") or t.get("key")
        if "camelot_key" not in item and item["k"]:
            item["camelot_key"] = item["k"]
        formatted_tracks.append(item)

    payload = {
        "count": len(formatted_tracks),
        "tracks": formatted_tracks
    }

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2)

    return output_path


def run_pipeline(tracks: Optional[List[Dict[str, Any]]] = None, db_path: str = "dj_library.sqlite") -> List[Dict[str, Any]]:
    """Runs resolution, builds database, and exports library JSON artifact."""
    try:
        from pipeline.build_db import build_database
    except ImportError:
        from build_db import build_database

    if tracks is None:
        # Provide sample default tracks for weekly run if none supplied
        tracks = [
            {
                "id": "1",
                "title": "Plan 9",
                "artist": "808 State",
                "isrc": "DEAZ30809510",
                "preview": "https://cdnt-preview.dzcdn.net/api/1/1/2/3/0/0/230e8063fdb7d9cc93908dcab672c36c.mp3",
                "bpm": 124.0,
                "camelot_key": "10A"
            },
            {
                "id": "2",
                "title": "Pacific State",
                "artist": "808 State",
                "isrc": "GBARL8900001",
                "preview": None,
                "bpm": 128.0,
                "camelot_key": "4A"
            }
        ]

    resolved = cmd_resolve(tracks)
    build_database(resolved, db_path=db_path)
    export_library_json(resolved)
    return resolved


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    if len(sys.argv) > 1 and sys.argv[1] == "db":
        run_pipeline()
        print("Weekly run pipeline completed successfully.")
    else:
        print("run_weekly: pipeline module loaded.")
    sys.exit(0)
