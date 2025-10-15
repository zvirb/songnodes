"""Pytest fixtures for Scraper Orchestrator tests."""

import asyncio
import sys
import types
from typing import Generator
from unittest.mock import AsyncMock, MagicMock

import pytest

# ---------------------------------------------------------------------------
# Provide a lightweight structlog stub so imports succeed without the optional
# dependency being installed in the local developer environment.
# ---------------------------------------------------------------------------


def _event_passthrough(logger=None, method_name: str = "", event_dict: dict | None = None):
    return event_dict or {}


class _DummyLogger:
    def info(self, *args, **kwargs):
        return None

    def warning(self, *args, **kwargs):
        return None

    def error(self, *args, **kwargs):
        return None

    def debug(self, *args, **kwargs):
        return None

    def bind(self, **kwargs):  # mimic structlog logger API
        return self


def _get_logger(*args, **kwargs):
    return _DummyLogger()


structlog_stub = types.SimpleNamespace(
    configure=lambda **kwargs: None,
    get_logger=_get_logger,
    make_filtering_bound_logger=lambda level: _get_logger,
    WriteLoggerFactory=lambda: (lambda *args, **kwargs: _get_logger()),
    contextvars=types.SimpleNamespace(
        bind_contextvars=lambda **kwargs: None,
        merge_contextvars=lambda logger, method_name, event_dict: event_dict,
    ),
    processors=types.SimpleNamespace(
        add_log_level=lambda logger, method_name, event_dict: event_dict,
        StackInfoRenderer=lambda: (lambda logger, method_name, event_dict: event_dict),
        JSONRenderer=lambda **kwargs: (lambda logger, method_name, event_dict: event_dict),
        TimeStamper=lambda **kwargs: (lambda logger, method_name, event_dict: event_dict),
        format_exc_info=lambda logger, method_name, event_dict: event_dict,
    ),
    dev=types.SimpleNamespace(
        set_exc_info=lambda logger, method_name, event_dict: event_dict,
        ConsoleRenderer=lambda **kwargs: (lambda logger, method_name, event_dict: event_dict),
    ),
    stdlib=types.SimpleNamespace(
        add_logger_name=lambda logger, method_name, event_dict: event_dict,
        add_log_level=lambda logger, method_name, event_dict: event_dict,
        LoggerFactory=lambda: (lambda *args, **kwargs: _DummyLogger()),
    ),
)

sys.modules.setdefault("structlog", structlog_stub)

# ---------------------------------------------------------------------------
# Minimal apscheduler stubs used by orchestrator tests
# ---------------------------------------------------------------------------


class _AsyncIOScheduler:
    def __init__(self, *args, **kwargs):
        self._jobs = []

    def add_job(self, func, trigger=None, id=None, **kwargs):
        job = types.SimpleNamespace(id=id, func=func, trigger=trigger, next_run_time=None)
        self._jobs.append(job)
        return job

    def get_jobs(self):
        return list(self._jobs)

    def remove_job(self, job_id):
        self._jobs = [job for job in self._jobs if job.id != job_id]

    def start(self):
        return None

    def shutdown(self):
        return None

    def pause(self):
        return None

    def resume(self):
        return None


class _CronTrigger:
    def __init__(self, *args, **kwargs):
        self.args = args
        self.kwargs = kwargs
        self.next_run_time = None


apscheduler_module = types.ModuleType("apscheduler")
schedulers_module = types.ModuleType("apscheduler.schedulers")
asyncio_module = types.ModuleType("apscheduler.schedulers.asyncio")
triggers_module = types.ModuleType("apscheduler.triggers")
cron_module = types.ModuleType("apscheduler.triggers.cron")

asyncio_module.AsyncIOScheduler = _AsyncIOScheduler
cron_module.CronTrigger = _CronTrigger

apscheduler_module.schedulers = schedulers_module
apscheduler_module.triggers = triggers_module
schedulers_module.asyncio = asyncio_module
triggers_module.cron = cron_module

sys.modules.setdefault("apscheduler", apscheduler_module)
sys.modules.setdefault("apscheduler.schedulers", schedulers_module)
sys.modules.setdefault("apscheduler.schedulers.asyncio", asyncio_module)
sys.modules.setdefault("apscheduler.triggers", triggers_module)
sys.modules.setdefault("apscheduler.triggers.cron", cron_module)


@pytest.fixture(scope="session")
def event_loop() -> Generator:
    """Create a dedicated event loop for async tests."""

    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture
def mock_redis_client():
    """Return a simple Redis client mock."""

    redis_mock = MagicMock()
    redis_mock.get.return_value = None
    redis_mock.set.return_value = True
    redis_mock.lpush.return_value = 1
    redis_mock.rpop.return_value = None
    redis_mock.llen.return_value = 0
    return redis_mock


@pytest.fixture
def mock_db_engine():
    """Return a mock async database engine."""

    return AsyncMock()
