"""Router endpoints for enrichment review queue (`/api/v1/library/review-queue`)."""

import csv
import logging
from typing import Optional

from fastapi import APIRouter

from .library_overrides import (
    find_latest_review_queue,
    find_music_library_dir,
    get_overrides_path,
    get_pool,
    load_overrides,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/library/review-queue", tags=["review-queue"])


@router.get("/count")
async def get_review_queue_count(status: str = "pending"):
    """Return the count of items pending in the review queue."""
    music_dir = find_music_library_dir()
    overrides_file = get_overrides_path(music_dir)
    overrides = load_overrides(overrides_file)

    rq_path = find_latest_review_queue(music_dir)
    if rq_path and rq_path.exists():
        count = 0
        with open(rq_path, mode="r", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            for row in reader:
                tid = (row.get("track_id") or "").strip()
                if tid and (tid not in overrides or not overrides[tid].get("energy_score")):
                    count += 1
        return {"count": count}

    pool = get_pool()
    if pool is not None:
        for query, args in (
            ("SELECT count(*)::int FROM enrichment_reviews WHERE status = $1", (status,)),
            ("SELECT count(*)::int FROM library.pending", ()),
        ):
            try:
                async with pool.acquire() as conn:
                    total = await conn.fetchval(query, *args)
                    if total is not None:
                        return {"count": int(total)}
            except Exception:
                continue

    return {"count": 0}


def register(app):
    app.include_router(router)

