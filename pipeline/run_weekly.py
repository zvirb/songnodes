"""Weekly run pipeline processing module."""

import sys
from typing import Any, Dict, Optional


def choose_version(tv: Optional[Dict[str, Any]], dz: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    """Select TIDAL version first, falling back to Deezer version if TIDAL is not available."""
    if tv:
        return dict(tv)
    if dz:
        return dict(dz)
    return None


def cmd_resolve(tracks: Any, deezer: Any = None, *args: Any, **kwargs: Any) -> Any:
    """
    Resolve tracks using Deezer details and capture artwork URL.
    """
    if not tracks:
        return tracks

    track_list = tracks if isinstance(tracks, list) else [tracks]

    if deezer is not None:
        for t in track_list:
            if isinstance(t, dict):
                track_id = t.get("deezer_id") or t.get("id")
                if track_id:
                    det = deezer.detail(track_id)
                    if det is not None:
                        if hasattr(det, "get"):
                            t["artwork_url"] = det.get("artwork_url") or None
                        elif hasattr(det, "artwork_url"):
                            t["artwork_url"] = getattr(det, "artwork_url", None) or None

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

    return v


if __name__ == "__main__":
    print("run_weekly: pipeline module loaded.")
    sys.exit(0)
