"""JT1: the rest-api access log never records an OAuth code or other secret query value."""
import logging
import os
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '../..'))
for path in (os.path.join(ROOT, 'services/rest_api'), os.path.join(ROOT, 'services')):
    if path not in sys.path:
        sys.path.insert(0, path)

import main  # noqa: E402,F401  (register_all installs the filter)
from routers import access_log  # noqa: E402

CALLBACK = '/api/v1/music-auth/tidal/oauth/callback?code=eyJsecretcode&state=abc123'


def access_record(target):
    return logging.LogRecord('uvicorn.access', logging.INFO, __file__, 1, '%s - "%s %s HTTP/%s" %d',
                             ('172.18.0.5:41234', 'GET', target, '1.1', 307), None)


def test_the_oauth_code_and_state_are_redacted():
    assert access_log.redact(CALLBACK) == \
        '/api/v1/music-auth/tidal/oauth/callback?code=[redacted]&state=[redacted]'


def test_other_parameters_and_paths_are_logged_as_before():
    plain = '/api/v1/scrape/trigger?source=mixesdb&search_query=Deadmau5%20Strobe&country_code=AU'
    assert access_log.redact(plain) == plain
    assert access_log.redact('/api/v1/jobs?limit=5&API_KEY=k1') == '/api/v1/jobs?limit=5&API_KEY=[redacted]'
    assert access_log.redact('/health') == '/health'


def test_the_app_puts_the_filter_on_the_uvicorn_access_logger():
    logger = logging.getLogger('uvicorn.access')
    filters = [f for f in logger.filters if isinstance(f, access_log.RedactSecretsFilter)]
    assert len(filters) == 1
    access_log.install()
    assert len([f for f in logger.filters if isinstance(f, access_log.RedactSecretsFilter)]) == 1, 'installed once'
    record = access_record(CALLBACK)
    assert filters[0].filter(record) is True
    message = record.getMessage()
    assert 'eyJsecretcode' not in message and 'abc123' not in message
    assert message == ('172.18.0.5:41234 - "GET /api/v1/music-auth/tidal/oauth/callback?code=[redacted]'
                       '&state=[redacted] HTTP/1.1" 307')
