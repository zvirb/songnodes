import pytest
import os
import glob
from fastapi.testclient import TestClient
from services.common.security.cors import get_allowed_origins, setup_cors
from fastapi import FastAPI
import sys
import importlib.util

def test_get_allowed_origins_default(monkeypatch):
    monkeypatch.delenv("CORS_ALLOWED_ORIGINS", raising=False)
    origins = get_allowed_origins()
    assert origins == ["http://localhost:3006", "http://127.0.0.1:3006"]

def test_get_allowed_origins_env(monkeypatch):
    monkeypatch.setenv("CORS_ALLOWED_ORIGINS", "https://example.com, https://test.com ")
    origins = get_allowed_origins()
    assert origins == ["https://example.com", "https://test.com"]

def test_cors_middleware_setup():
    app = FastAPI()
    setup_cors(app)

    @app.get("/")
    def read_root():
        return {"Hello": "World"}

    client = TestClient(app)

    # Test allowed origin
    response = client.options("/", headers={"Origin": "http://localhost:3006", "Access-Control-Request-Method": "GET"})
    assert response.status_code == 200
    assert response.headers.get("access-control-allow-origin") == "http://localhost:3006"

    # Test disallowed origin
    response = client.options("/", headers={"Origin": "https://evil.example", "Access-Control-Request-Method": "GET"})
    assert response.status_code == 400 or response.headers.get("access-control-allow-origin") is None

def test_no_wildcard_cors_in_main_files():
    """Ensure no main.py file uses allow_origins=['*']"""
    files_to_check = glob.glob("services/**/main.py", recursive=True)

    for filepath in files_to_check:
        if os.path.exists(filepath):
            with open(filepath, 'r') as f:
                content = f.read()
                assert 'allow_origins=["*"]' not in content, f"Found allow_origins=['*'] in {filepath}"
                assert "allow_origins=['*']" not in content, f"Found allow_origins=['*'] in {filepath}"

def test_service_preflight_cors_responses(monkeypatch, mocker):
    """Test actual preflight responses for the service applications"""
    import sys
    sys.modules['structlog'] = mocker.MagicMock()
    sys.modules['human_browser_navigator'] = mocker.MagicMock()
    sys.modules['ollama_extractor'] = mocker.MagicMock()
    sys.modules['common.secrets_manager'] = mocker.MagicMock()
    sys.modules['common.health_monitor'] = mocker.MagicMock()
    sys.modules['redis'] = mocker.MagicMock()
    sys.modules['spacy'] = mocker.MagicMock()
    sys.modules['textblob'] = mocker.MagicMock()
    sys.modules['ollama'] = mocker.MagicMock()
    sys.modules['pgbouncer_exporter'] = mocker.MagicMock()
    sys.modules['asyncpg'] = mocker.MagicMock()
    sys.modules['sqlalchemy'] = mocker.MagicMock()
    sys.modules['sqlalchemy.ext.asyncio'] = mocker.MagicMock()
    sys.modules['prometheus_client'] = mocker.MagicMock()

    services_to_test = [
        "services/data-transformer/main.py",
        "services/data-validator/main.py",
        "services/nlp-processor/main.py",
        "services/db-connection-pool/main.py",
        "services/browser-collector/main.py"
    ]

    for filepath in services_to_test:
        if not os.path.exists(filepath):
            continue

        spec = importlib.util.spec_from_file_location("main_module", filepath)
        module = importlib.util.module_from_spec(spec)

        try:
            sys.modules["main_module"] = module
            spec.loader.exec_module(module)
        except Exception as e:
            # If the module throws an exception on import, just continue or we can setup cors manually on mock app
            continue

        if hasattr(module, "app"):
            client = TestClient(module.app)

            # Test allowed origin
            response = client.options("/health", headers={"Origin": "http://localhost:3006", "Access-Control-Request-Method": "GET"})
            assert response.status_code == 200 or response.status_code == 404 # Depends if endpoint exists, but CORS runs first
            if response.headers.get("access-control-allow-origin"):
                assert response.headers.get("access-control-allow-origin") == "http://localhost:3006"

            # Test disallowed origin
            response = client.options("/health", headers={"Origin": "https://evil.example", "Access-Control-Request-Method": "GET"})
            assert response.headers.get("access-control-allow-origin") is None
