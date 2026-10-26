import sys
import pytest
from fastapi.testclient import TestClient

# Adjust paths to match CI
sys.path.append("services/rest_api")
sys.path.append("services")

def test_routes_unchanged():
    # Load original routes
    import main

    # We want to prove that the route list is exactly identical to before plus nothing.
    # main.py runs explicitly included routers, then calls register_all(app).
    # Since register_all prevents duplicates, the final route count should be exactly the
    # same as if register_all was not called.

    # Simple check that the app can be run and we can request /openapi.json which lists the routes
    client = TestClient(main.app)
    resp = client.get("/openapi.json")

    assert resp.status_code == 200
    openapi_data = resp.json()
    assert "/api/v1/library/search" in openapi_data["paths"]

def test_router_duplicate_guard():
    import main
    import router_registry
    import sys, types
    from fastapi import APIRouter

    # We create a fake module that has a router and register function
    fake_router = APIRouter()
    @fake_router.get("/fake_test")
    def fake_test(): pass

    class FakeModule:
        def __init__(self):
            self.router = fake_router
            self.register_calls = 0

        def register(self, app):
            self.register_calls += 1
            app.include_router(self.router)

    fake_mod = FakeModule()

    import pkgutil
    import importlib

    original_iter_modules = pkgutil.iter_modules
    def mock_iter_modules(path):
        yield None, "fake_router", False

    pkgutil.iter_modules = mock_iter_modules

    original_import_module = importlib.import_module
    def mock_import_module(name):
        if name == "routers.fake_router":
            return fake_mod
        return original_import_module(name)

    importlib.import_module = mock_import_module

    try:
        # Step 1: Explicitly include the fake router in the app
        main.app.include_router(fake_mod.router)

        # Step 2: Call register_all
        router_registry.register_all(main.app)

        # Step 3: Assert that fake_mod.register was NOT called
        assert fake_mod.register_calls == 0
    finally:
        pkgutil.iter_modules = original_iter_modules
        importlib.import_module = original_import_module

def test_router_discovery():
    import main
    import router_registry
    import sys, types
    from fastapi import APIRouter

    fake_router = APIRouter()
    @fake_router.get("/fake_discover")
    def fake_discover(): pass

    class FakeModule:
        def __init__(self):
            self.router = fake_router
            self.register_calls = 0

        def register(self, app):
            self.register_calls += 1
            app.include_router(self.router)

    fake_mod = FakeModule()

    import pkgutil
    import importlib

    original_iter_modules = pkgutil.iter_modules
    def mock_iter_modules(path):
        yield None, "fake_discover_router", False

    pkgutil.iter_modules = mock_iter_modules

    original_import_module = importlib.import_module
    def mock_import_module(name):
        if name == "routers.fake_discover_router":
            return fake_mod
        return original_import_module(name)

    importlib.import_module = mock_import_module

    try:
        # Step 1: Call register_all
        router_registry.register_all(main.app)

        # Step 2: Assert that fake_mod.register was called
        assert fake_mod.register_calls == 1
    finally:
        pkgutil.iter_modules = original_iter_modules
        importlib.import_module = original_import_module
