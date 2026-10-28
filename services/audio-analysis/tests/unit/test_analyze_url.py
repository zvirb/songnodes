"""POST /analyze-url (AA2): download a short clip, analyse it with key_bpm, keep nothing on disk."""
import io
import os
import sys

import httpx
import numpy as np
import pytest
import soundfile as sf
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../../../..')))

import main  # noqa: E402
from tests.synthetic_audio import generate_synthetic_audio  # noqa: E402

PREVIEW = 'https://cdnt-preview.dzcdn.net/api/1/1/a/b/c/0/abc.mp3?hdnea=exp=1'


def serve(monkeypatch, handler):
    monkeypatch.setattr(main, 'analyze_url_client',
                        lambda: httpx.AsyncClient(transport=httpx.MockTransport(handler)))


def fake_analyser(monkeypatch, seen):
    def analyse_file(path):
        seen.append((path, os.path.exists(path), os.path.getsize(path)))
        return {'bpm': 124.0, 'raw_bpm': 124.0, 'bpm_confidence': 0.9, 'key_camelot': '8A', 'key_name': 'A minor',
                'key_confidence': 0.8, 'method': 'essentia_edma_rhythm2013', 'method_version': '1.0'}
    monkeypatch.setattr(main.key_bpm, 'analyse_file', analyse_file)


@pytest.fixture
def client():
    return TestClient(main.app)  # no `with`: the lifespan (database, RabbitMQ) is not started


def test_returns_aa1_result_and_deletes_the_clip(monkeypatch, client):
    seen = []
    fake_analyser(monkeypatch, seen)
    serve(monkeypatch, lambda request: httpx.Response(200, headers={'content-type': 'audio/mpeg'}, content=b'ID3' + b'\0' * 1000))
    response = client.post('/analyze-url', json={'url': PREVIEW})
    assert response.status_code == 200
    assert response.json()['key_camelot'] == '8A' and response.json()['bpm'] == 124.0
    path, existed, size = seen[0]
    assert existed and size == 1003 and path.endswith('.mp3')
    assert not os.path.exists(path)


def test_rejects_non_audio_content_type(monkeypatch, client):
    seen = []
    fake_analyser(monkeypatch, seen)
    serve(monkeypatch, lambda request: httpx.Response(200, headers={'content-type': 'text/html'}, content=b'<html>'))
    assert client.post('/analyze-url', json={'url': PREVIEW}).status_code == 415
    assert seen == []


def test_rejects_clip_over_5_mb_and_leaves_nothing(monkeypatch, client):
    seen = []
    fake_analyser(monkeypatch, seen)
    before = set(os.listdir(main.tempfile.gettempdir()))
    big = b'\0' * (5 * 1024 * 1024 + 1)
    serve(monkeypatch, lambda request: httpx.Response(200, headers={'content-type': 'audio/mpeg'}, content=big))
    assert client.post('/analyze-url', json={'url': PREVIEW}).status_code == 413
    assert seen == []
    assert {f for f in os.listdir(main.tempfile.gettempdir()) if f.startswith('clip-')} - before == set()


def test_upstream_error_is_502(monkeypatch, client):
    serve(monkeypatch, lambda request: httpx.Response(403, text='expired'))
    assert client.post('/analyze-url', json={'url': PREVIEW}).status_code == 502


def test_only_allowed_hosts_and_schemes(client):
    assert client.post('/analyze-url', json={'url': 'http://169.254.169.254/latest'}).status_code == 422
    assert client.post('/analyze-url', json={'url': 'file:///etc/passwd'}).status_code == 422


@pytest.mark.skipif(not main.key_bpm.HAS_ESSENTIA, reason='Essentia not installed')
def test_real_analysis_of_a_synthetic_clip(monkeypatch, client):
    samples = generate_synthetic_audio(124, 'A minor', duration=30.0)
    buffer = io.BytesIO()
    sf.write(buffer, np.asarray(samples, dtype=np.float32), 44100, format='WAV')
    serve(monkeypatch, lambda request: httpx.Response(200, headers={'content-type': 'audio/wav'}, content=buffer.getvalue()))
    result = client.post('/analyze-url', json={'url': PREVIEW}).json()
    assert result['bpm'] == pytest.approx(124, abs=2)
    assert result['key_name'] == 'A minor'
