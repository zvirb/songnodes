"""Keep OAuth codes and other secrets out of the access log (JT1).

Uvicorn's access log writes each request's path with its query string, so the TIDAL and Spotify OAuth callbacks
logged their single-use `code` (2 Nov 2026 local test). `register(app)` puts a filter on the `uvicorn.access` logger
that replaces the values of secret query parameters with `[redacted]`; every other parameter is logged as before.
"""
import logging
import re

ACCESS_LOGGER = 'uvicorn.access'
REDACTED = '[redacted]'
SECRET_PARAMS = ('code', 'state', 'code_verifier', 'token', 'access_token', 'refresh_token', 'id_token',
                 'client_secret', 'api_key', 'apikey', 'key', 'password', 'secret', 'session_state')
_SECRET = re.compile(r'([?&](?:' + '|'.join(SECRET_PARAMS) + r')=)[^&#\s]*', re.IGNORECASE)


def redact(target: str) -> str:
    """The request target with each secret query parameter's value replaced."""
    return _SECRET.sub(lambda m: m.group(1) + REDACTED, target) if '?' in target else target


class RedactSecretsFilter(logging.Filter):
    """Uvicorn logs access as ('%s - "%s %s HTTP/%s" %d', client, method, full_path, http_version, status)."""

    def filter(self, record: logging.LogRecord) -> bool:
        if isinstance(record.args, tuple):
            record.args = tuple(redact(a) if isinstance(a, str) else a for a in record.args)
        return True


def install(logger_name: str = ACCESS_LOGGER) -> None:
    logger = logging.getLogger(logger_name)
    if not any(isinstance(f, RedactSecretsFilter) for f in logger.filters):
        logger.addFilter(RedactSecretsFilter())


def register(app) -> None:
    install()
