import inspect
import logging
import os
import time
from typing import Any, Callable, Dict, Optional
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

import httpx

"""
Web Call Log wrapper to record outbound HTTP requests.

MusicBrainz web fallback rule: 1 request per second and a descriptive User-Agent.

Only the provider, the URL (credentials redacted), status and duration are recorded; request headers and bodies
never are. Recording is best effort: a failing sink is logged and never fails the provider call.
"""

log = logging.getLogger(__name__)

REDACTED = 'REDACTED'
# Query parameter names (case-insensitive substrings) whose values are credentials, e.g. Last.fm `api_key`.
SECRET_PARAM_PARTS = ('key', 'token', 'secret', 'password', 'passwd', 'signature', 'sig', 'auth', 'credential')
INSERT_SQL = ('INSERT INTO web_call_log (provider, endpoint, field, run_id, status, duration_ms) '
              'VALUES ($1, $2, $3, $4, $5, $6)')


def is_secret_param(name: str) -> bool:
    lowered = name.lower()
    return any(part in lowered for part in SECRET_PARAM_PARTS)


def redact_url(url: Any) -> str:
    """Drop user:password from the authority, mask credential-like query values and drop the fragment."""
    parts = urlsplit(str(url))
    netloc = parts.netloc.rsplit('@', 1)[-1]
    query = urlencode([(k, REDACTED if is_secret_param(k) else v)
                       for k, v in parse_qsl(parts.query, keep_blank_values=True)])
    return urlunsplit((parts.scheme, netloc, parts.path, query, ''))


class WebCallLogger:
    def __init__(self, provider_name: str, run_id: Optional[str] = None, log_callback: Optional[Callable[[Dict[str, Any]], Any]] = None):
        self.provider_name = provider_name
        self.run_id = run_id
        self.log_callback = log_callback

    async def log_request(self, request: httpx.Request, response: Optional[httpx.Response], duration_ms: int):
        status = response.status_code if response else None

        entry = {
            "provider": self.provider_name,
            "endpoint": redact_url(request.url),
            "field": None,  # Can be augmented by callers if needed
            "run_id": self.run_id,
            "status": status,
            "duration_ms": duration_ms
        }

        if self.log_callback:
            result = self.log_callback(entry)  # plain function, coroutine function or async callable object
            if inspect.isawaitable(result):
                await result


class PostgresSink:
    """Writes one web_call_log row per call. Short timeouts so an unreachable database adds little delay."""

    def __init__(self, dsn: str, connect: Optional[Callable[..., Any]] = None, timeout: float = 2.0):
        self.dsn, self.timeout = dsn, timeout
        self._connect = connect

    async def __call__(self, entry: Dict[str, Any]) -> None:
        connect = self._connect
        if connect is None:
            import asyncpg
            connect = asyncpg.connect
        connection = await connect(self.dsn, timeout=self.timeout)
        try:
            await connection.execute(INSERT_SQL, entry['provider'], entry['endpoint'], entry['field'],
                                     entry['run_id'], entry['status'], entry['duration_ms'], timeout=self.timeout)
        finally:
            await connection.close()


def default_sink(env: Optional[Dict[str, str]] = None) -> Optional[PostgresSink]:
    """The database sink when DATABASE_URL is set (worker, rest-api), otherwise None (nothing recorded)."""
    from .saved_keys import normalise_dsn
    url = (os.environ if env is None else env).get('DATABASE_URL')
    return PostgresSink(normalise_dsn(url)) if url else None


def attach_web_call_wrapper(client: httpx.AsyncClient, logger: WebCallLogger) -> httpx.AsyncClient:
    """
    Attaches event hooks to an httpx.AsyncClient to log every outbound request.
    Does not modify existing provider code, just wraps the client it uses.
    """

    async def log_response_hook(response: httpx.Response):
        try:
            request = response.request
            start_time = getattr(request, "start_time", time.time())
            duration_ms = int((time.time() - start_time) * 1000)
            await logger.log_request(request, response, duration_ms)
        except Exception as error:  # recording must never break the provider call
            # Class name only: a driver error message can echo the DSN.
            log.warning('web call for %s not recorded: %s', logger.provider_name, error.__class__.__name__)

    async def add_start_time_hook(request: httpx.Request):
        request.start_time = time.time()

    # Append to existing hooks
    client.event_hooks["request"].append(add_start_time_hook)
    client.event_hooks["response"].append(log_response_hook)

    return client
