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

    return v


if __name__ == "__main__":
    print("run_weekly: pipeline module loaded.")
    sys.exit(0)
