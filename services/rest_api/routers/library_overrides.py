import csv
import logging
import os
import re
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Query, Response
from pydantic import BaseModel

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/library", tags=["library-overrides"])


def get_pool():
    try:
        from main import db_pool
        return db_pool
    except Exception:
        return None


def find_music_library_dir() -> Path:
    env_dir = os.environ.get("MUSIC_LIBRARY_DIR")
    if env_dir and os.path.isdir(env_dir):
        return Path(env_dir)
    candidates = [
        Path("e:/musicLibrary"),
        Path("../musicLibrary"),
        Path("../../musicLibrary"),
        Path(os.path.expanduser("~/musicLibrary")),
    ]
    for c in candidates:
        if c.is_dir():
            return c
    return Path("e:/musicLibrary")


def find_latest_review_queue(music_lib_dir: Path) -> Optional[Path]:
    outputs_dir = music_lib_dir / "outputs"
    if not outputs_dir.exists():
        return None
    date_dirs = sorted(
        [d for d in outputs_dir.iterdir() if d.is_dir() and re.match(r"^\d{4}-\d{2}-\d{2}$", d.name)],
        reverse=True,
    )
    for d in date_dirs:
        rq = d / "review_queue.csv"
        if rq.exists():
            return rq
    return None


def get_overrides_path(music_lib_dir: Path) -> Path:
    return music_lib_dir / "overrides" / "energy_overrides.csv"


def load_overrides(csv_path: Path) -> Dict[str, Dict[str, str]]:
    overrides: Dict[str, Dict[str, str]] = {}
    if not csv_path.exists():
        return overrides
    with open(csv_path, mode="r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            tid = (row.get("track_id") or "").strip()
            if tid:
                overrides[tid] = row
    return overrides


def save_override_row(csv_path: Path, data: Dict[str, Any]):
    csv_path.parent.mkdir(parents=True, exist_ok=True)
    fieldnames = [
        "track_id",
        "artist",
        "title",
        "energy_score",
        "genre_pillar",
        "rotation_status",
        "tags",
        "local_path",
        "note",
    ]
    overrides = load_overrides(csv_path)
    tid = str(data["track_id"])
    existing = overrides.get(tid, {})

    tags = data.get("tags")
    if isinstance(tags, list):
        tags_str = ";".join(str(t).strip() for t in tags if str(t).strip())
    else:
        tags_str = str(tags or existing.get("tags") or "")

    overrides[tid] = {
        "track_id": tid,
        "artist": str(data.get("artist") or existing.get("artist") or ""),
        "title": str(data.get("title") or existing.get("title") or ""),
        "energy_score": str(data["energy_score"]) if data.get("energy_score") is not None else existing.get("energy_score", ""),
        "genre_pillar": str(data.get("genre_pillar") or existing.get("genre_pillar") or ""),
        "rotation_status": str(data.get("rotation_status") or existing.get("rotation_status") or ""),
        "tags": tags_str,
        "local_path": str(data.get("local_path") or existing.get("local_path") or ""),
        "note": str(data.get("note") or existing.get("note") or ""),
    }

    with open(csv_path, mode="w", newline="", encoding="utf-8-sig") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for row in overrides.values():
            writer.writerow(row)


class ReviewQueueItem(BaseModel):
    track_id: str
    artist: str
    title: str
    mix_version: Optional[str] = None
    bpm: Optional[float] = None
    key: Optional[str] = None
    energy_score: Optional[float] = None
    genre: Optional[str] = None
    genre_pillar: Optional[str] = None
    rotation_status: Optional[str] = None
    local_path: Optional[str] = None
    reason: str
    bpm_method: Optional[str] = None
    source_method: Optional[str] = None
    crate: Optional[str] = None


class OverrideRequest(BaseModel):
    track_id: str
    artist: Optional[str] = None
    title: Optional[str] = None
    energy_score: Optional[float] = None
    genre_pillar: Optional[str] = None
    rotation_status: Optional[str] = None
    local_path: Optional[str] = None
    tags: Optional[List[str]] = None
    note: Optional[str] = None


class OverrideResponse(BaseModel):
    track_id: str
    saved: bool


@router.get("/review-queue", response_model=List[ReviewQueueItem])
async def get_review_queue(
    response: Response,
    reason: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
):
    """List tracks currently pending curator review."""
    music_dir = find_music_library_dir()
    overrides_file = get_overrides_path(music_dir)
    overrides = load_overrides(overrides_file)

    items: List[ReviewQueueItem] = []

    # 1. Read from review_queue.csv if present
    rq_path = find_latest_review_queue(music_dir)
    if rq_path and rq_path.exists():
        with open(rq_path, mode="r", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            for row in reader:
                tid = (row.get("track_id") or "").strip()
                if not tid:
                    continue

                # If track already has an energy override applied, it is resolved
                if tid in overrides and overrides[tid].get("energy_score"):
                    continue

                bpm_val = float(row["bpm"]) if (row.get("bpm") or "").strip() else None
                energy_val = float(row["energy_score"]) if (row.get("energy_score") or "").strip() else None

                # Determine specific review trigger reason
                if bpm_val is None:
                    row_reason = "missing_bpm"
                elif energy_val is None:
                    row_reason = "energy_estimate"
                else:
                    row_reason = "needs_review"

                if reason and reason != "all" and row_reason != reason:
                    continue

                # Crate name can extract genre pillar / rotation
                crate = row.get("crate") or ""
                pillar = row.get("genre") or ""
                if not pillar:
                    for p in ["House", "Techno", "UKG", "Electro", "Alternative", "Dance"]:
                        if p.lower() in crate.lower():
                            pillar = p
                            break

                items.append(
                    ReviewQueueItem(
                        track_id=tid,
                        artist=row.get("artist") or "",
                        title=row.get("title") or "",
                        mix_version=row.get("mix_version") or None,
                        bpm=bpm_val,
                        key=None,
                        energy_score=energy_val,
                        genre=row.get("genre") or None,
                        genre_pillar=pillar or None,
                        rotation_status="Standard" if "StdRot" in crate else "High Rotation" if "HighRot" in crate else None,
                        local_path=None,
                        reason=row_reason,
                        bpm_method=row.get("bpm_method") or None,
                        source_method=row.get("source_method") or None,
                        crate=crate or None,
                    )
                )

    total_count = len(items)
    response.headers["X-Total-Count"] = str(total_count)
    return items[offset : offset + limit]


@router.get("/review-queue/count")
async def get_review_queue_count():
    """Get the current count of items in the review queue."""
    music_dir = find_music_library_dir()
    overrides_file = get_overrides_path(music_dir)
    overrides = load_overrides(overrides_file)

    rq_path = find_latest_review_queue(music_dir)
    count = 0
    if rq_path and rq_path.exists():
        with open(rq_path, mode="r", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            for row in reader:
                tid = (row.get("track_id") or "").strip()
                if tid and (tid not in overrides or not overrides[tid].get("energy_score")):
                    count += 1

    return {"count": count}


@router.get("/overrides")
async def list_overrides():
    """List all saved library overrides."""
    music_dir = find_music_library_dir()
    overrides_file = get_overrides_path(music_dir)
    overrides = load_overrides(overrides_file)
    return list(overrides.values())


@router.post("/overrides", response_model=OverrideResponse)
@router.put("/overrides/{track_id}", response_model=OverrideResponse)
async def set_override(request: OverrideRequest, track_id: Optional[str] = None):
    """Save or update an override for a track."""
    target_id = track_id or request.track_id
    if not target_id:
        raise HTTPException(status_code=400, detail="track_id is required")

    music_dir = find_music_library_dir()
    overrides_file = get_overrides_path(music_dir)

    payload = request.model_dump()
    payload["track_id"] = target_id
    save_override_row(overrides_file, payload)

    # If DB pool is connected, sync to Postgres
    pool = get_pool()
    if pool is not None:
        try:
            async with pool.acquire() as conn:
                if request.energy_score is not None:
                    # Update library.energy_model
                    await conn.execute(
                        """
                        INSERT INTO library.energy_model (track_id, energy_score, computed_at)
                        VALUES ($1::uuid, $2, NOW())
                        ON CONFLICT (track_id) DO UPDATE SET energy_score = $2, computed_at = NOW()
                        """,
                        target_id,
                        request.energy_score,
                    )
                if request.rotation_status:
                    await conn.execute(
                        """
                        INSERT INTO library.rotation_history (track_id, rotation, changed_at)
                        VALUES ($1::uuid, $2, NOW())
                        """,
                        target_id,
                        request.rotation_status,
                    )
                # Remove from library.pending
                await conn.execute(
                    "DELETE FROM library.pending WHERE track_id = $1::uuid",
                    target_id,
                )
        except Exception as e:
            logger.warning(f"Failed to sync override to Postgres: {e}")

    return OverrideResponse(track_id=target_id, saved=True)


def register(app):
    app.include_router(router)
