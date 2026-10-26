import ast
import importlib
import logging
import os
import pkgutil
from fastapi.routing import APIRoute
from fastapi import APIRouter
import sys

logger = logging.getLogger(__name__)

def _defines_register(package_dirs, module_name):
    """True if the module's source has a top-level register() function.

    Read from source so that routers without register(app) (legacy modules main.py does not
    mount, such as data_quality) are never imported at startup. Returns None when there is no
    source file to read, and the caller falls back to importing the module.
    """
    for d in package_dirs:
        path = os.path.join(d, f"{module_name}.py")
        if os.path.isfile(path):
            with open(path, encoding="utf-8") as f:
                tree = ast.parse(f.read(), filename=path)
            return any(isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef)) and n.name == "register"
                       for n in tree.body)
    return None


def register_all(app):
    """
    Import every module in routers that defines register(app) and is not already
    included explicitly by main.py. Call each once, in module-name order.
    """
    import routers

    modules = []
    for _, module_name, is_pkg in pkgutil.iter_modules(routers.__path__):
        if not is_pkg:
            modules.append(module_name)

    modules.sort()

    # We collect all current path+methods so we know what routes already exist in the app
    app_routes = set()
    for r in app.routes:
        if isinstance(r, APIRoute):
            for m in r.methods:
                app_routes.add(f"{m}:{r.path}")

    for module_name in modules:
        try:
            mod_name = f"routers.{module_name}"
            # If the module was already fully loaded in sys.modules, we can just use it.
            # If it's partially loaded (e.g. circular import from main.py calling explicit includes),
            # it will be in sys.modules, and we can inspect it safely without triggering ImportError.
            # Wait, if main.py explicitly imports `routers.catalog_writes`, it's partially loaded while main.py executes.
            # But `register_all` is called AT THE END of main.py, so they are fully loaded.

            # The test `python -c ...` above failed because `main.py` is being imported inside the circular import,
            # while the test itself is the entrypoint. That's a test environment artifact.
            # But just in case, we can use import_module.

            if _defines_register(list(routers.__path__), module_name) is False:
                logger.debug(f"Skipping {module_name}: no top-level register(app)")
                continue

            mod = importlib.import_module(mod_name)

            if hasattr(mod, "register") and callable(mod.register):
                is_included = False

                # Check if the module has a router and if its routes are already in app_routes
                if hasattr(mod, "router") and isinstance(mod.router, APIRouter):
                    for r_route in mod.router.routes:
                        if isinstance(r_route, APIRoute):
                            for m in r_route.methods:
                                if f"{m}:{r_route.path}" in app_routes:
                                    is_included = True
                                    break
                        if is_included:
                            break

                # Fallback: Check if the router object itself is in the app.
                if not is_included:
                    for route in app.routes:
                        if hasattr(route, 'original_router') and hasattr(mod, "router"):
                            if id(route.original_router) == id(mod.router):
                                is_included = True
                                break

                if not is_included:
                    mod.register(app)
                    logger.info(f"Registered router from {module_name}")
        except Exception as e:
            logger.error(f"Failed to load router module {module_name}: {str(e)}")
            raise
