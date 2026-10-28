"""Weekly run pipeline processing module."""

import json
import logging
import os
import sys
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


def _preview_url(track: Dict[str, Any]) -> Optional[str]:
    dz = track.get("dz")
    return (
        track.get("preview")
        or track.get("preview_url")
        or track.get("deezer_preview")
        or (dz.get("preview") if isinstance(dz, dict) else None)
    )


def cmd_resolve(tracks: Any, deezer: Any = None, *args: Any, **kwargs: Any) -> Any:
    """
    Resolve tracks:
    1. With a Deezer client, capture each track's artwork URL.
    2. If `bpm` or `key`/`camelot_key` is missing and a Deezer preview URL is known,
       fill them from `dsp_analyzer.analyze_preview`.
    3. Attach the canonical MusicBrainz `mbid` from the local ISRC resolver.
    Tracks are updated in place and the same list is returned.
    """
    if not tracks:
        return tracks

    track_list = tracks if isinstance(tracks, list) else [tracks]

    for t in track_list:
        if not isinstance(t, dict):
            continue

        if deezer is not None:
            track_id = t.get("deezer_id") or t.get("id")
            if track_id:
                det = deezer.detail(track_id)
                if det is not None:
                    if hasattr(det, "get"):
                        t["artwork_url"] = det.get("artwork_url") or None
                    elif hasattr(det, "artwork_url"):
                        t["artwork_url"] = getattr(det, "artwork_url", None) or None

        preview_url = _preview_url(t)
        missing_bpm = t.get("bpm") in (None, 0)
        missing_key = not (t.get("camelot_key") or t.get("key"))
        if (missing_bpm or missing_key) and preview_url and callable(analyze_preview):
            try:
                dsp_result = analyze_preview(preview_url)
                if dsp_result:
                    if missing_bpm and dsp_result.get("bpm"):
                        t["bpm"] = dsp_result["bpm"]
                    if missing_key and dsp_result.get("camelot_key"):
                        t["camelot_key"] = dsp_result["camelot_key"]
                        if not t.get("key"):
                            t["key"] = dsp_result.get("musical_key") or dsp_result["camelot_key"]
            except Exception as e:
                logger.warning(f"DSP analysis failed for track {t.get('title')}: {e}")

        isrc = t.get("isrc")
        if isrc and callable(resolve_isrc_local) and not t.get("mbid"):
            try:
                mb_result = resolve_isrc_local(isrc)
                if mb_result and mb_result.get("mbid"):
                    t["mbid"] = mb_result["mbid"]
            except Exception as e:
                logger.warning(f"ISRC resolution failed for ISRC {isrc}: {e}")

    return tracks


def build_record(tv: Optional[Dict[str, Any]], dz: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    """
    Build a track record using choose_version.

    If the selected version's BPM is null or 0, fallback to inheriting a valid non-zero
    BPM from the Deezer version if available. Extract artwork_url from chosen version
    (or Deezer twin if TIDAL was chosen).
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

    artwork_url = v.get("artwork_url")
    if not artwork_url and dz:
        artwork_url = dz.get("artwork_url")

    v["artwork_url"] = artwork_url if artwork_url else None

    # Also extract Deezer preview URL if available
    if dz and dz.get("preview"):
        v["preview"] = dz.get("preview")

    return v


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


def run_pipeline(tracks: List[Dict[str, Any]], db_path: Optional[str] = None,
                 output_path: Optional[str] = None) -> List[Dict[str, Any]]:
    """Resolve the given tracks, store them in the SQLite library and export library.json."""
    try:
        from pipeline.build_db import DEFAULT_ARTIFACT_PATH, DEFAULT_DB_PATH, build_database, export_artifact_library, insert_track
    except ImportError:
        from build_db import DEFAULT_ARTIFACT_PATH, DEFAULT_DB_PATH, build_database, export_artifact_library, insert_track

    resolved = cmd_resolve(list(tracks))
    conn = build_database(db_path or DEFAULT_DB_PATH)
    try:
        for record in resolved:
            insert_track(conn, record)
        export_artifact_library(conn, output_path or DEFAULT_ARTIFACT_PATH)
    finally:
        conn.close()
    return resolved


if __name__ == "__main__":
    print("run_weekly: pipeline module loaded.")
    sys.exit(0)
