"""Scheduled-scrape date window (DS24B).

GET /api/v1/scrape/window returns {starts_on, ends_on, updated_at}; both null means no window (scheduled target
scrapes run every day). PUT takes the same dates as date-only ISO strings or null (Melbourne calendar days, both
ends inclusive; one null end is open-ended) and returns 422 with a sentence for a bad date or a reversed span.
The hourly scrape_targets job reads the window (services/common/datalayer/target_scrape.py); manual scrapes from
POST /api/v1/scrape/trigger never do. Writes are protected by the token middleware like every other write route.
"""
from datetime import date, datetime
from typing import Any, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, field_validator, model_validator

from common.datalayer.target_scrape import WINDOW_SQL, is_missing_table

router = APIRouter(prefix='/api/v1/scrape', tags=['scrape-window'])

MISSING = 'The scrape_window table is missing; apply sql/migrations/260_scrape_window_up.sql.'

UPSERT_SQL = """
    INSERT INTO scrape_window (id, starts_on, ends_on, updated_at) VALUES (TRUE, $1, $2, NOW())
    ON CONFLICT (id) DO UPDATE SET starts_on = EXCLUDED.starts_on, ends_on = EXCLUDED.ends_on, updated_at = NOW()
    RETURNING starts_on, ends_on, updated_at
"""


def get_pool():
    # The application owns pool lifecycle; resolve it after startup.
    from main import db_pool
    if db_pool is None:
        raise HTTPException(status_code=503, detail='Database pool not initialized')
    return db_pool


class ScrapeWindow(BaseModel):
    starts_on: Optional[date] = None
    ends_on: Optional[date] = None
    updated_at: Optional[datetime] = None


class ScrapeWindowUpdate(BaseModel):
    starts_on: Optional[str] = None
    ends_on: Optional[str] = None

    @field_validator('starts_on', 'ends_on')
    @classmethod
    def real_date(cls, value: Optional[str], info) -> Optional[str]:
        if value is None:
            return None
        try:
            # fromisoformat also takes "20261201"; only the dashed date-only form is accepted.
            if len(value) == 10:
                date.fromisoformat(value)
                return value
        except ValueError:
            pass
        raise ValueError(f'{info.field_name} must be a real date written as YYYY-MM-DD, for example 2026-12-01.')

    @model_validator(mode='after')
    def in_order(self):
        if self.starts_on and self.ends_on and self.starts_on > self.ends_on:
            raise ValueError('starts_on must be on or before ends_on.')
        return self


def as_window(row: Optional[Any]) -> ScrapeWindow:
    return ScrapeWindow(**dict(row)) if row else ScrapeWindow()


@router.get('/window', response_model=ScrapeWindow)
async def get_scrape_window():
    async with get_pool().acquire() as conn:
        try:
            return as_window(await conn.fetchrow(WINDOW_SQL))
        except Exception as error:
            if is_missing_table(error):
                return ScrapeWindow()  # no table means no window, as the scheduler reads it
            raise


@router.put('/window', response_model=ScrapeWindow)
async def put_scrape_window(payload: ScrapeWindowUpdate):
    starts_on = date.fromisoformat(payload.starts_on) if payload.starts_on else None
    ends_on = date.fromisoformat(payload.ends_on) if payload.ends_on else None
    async with get_pool().acquire() as conn:
        try:
            return as_window(await conn.fetchrow(UPSERT_SQL, starts_on, ends_on))
        except Exception as error:
            if is_missing_table(error):
                raise HTTPException(status_code=503, detail=MISSING)
            raise


def register(app):
    app.include_router(router)
