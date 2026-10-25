# Dependency Updates Security Report

This document records the output of security audits performed on the dependencies for the SongNodes project.

## Frontend (`npm audit --omit=dev`)
No vulnerabilities found in production dependencies.

## Python Backend Services (`pip-audit`)
The following advisories were detected by `pip-audit` on the python dependencies (such as in `services/serato-integration/requirements.txt`):
* `python-dotenv`: PYSEC-2026-2270 (Requires upgrade from 1.1.1 to 1.2.2)
* `starlette`: PYSEC-2026-1941, PYSEC-2026-1942, PYSEC-2026-161, PYSEC-2026-2281, PYSEC-2026-2280, PYSEC-2026-249, PYSEC-2026-248 (Requires upgrade to 1.3.1 which may introduce breaking changes; current version is 0.46.2/0.49.1)

> **Note:** The `pip-audit` scan encountered dependency resolution conflicts when trying to update to the secure versions. These updates are deferred as follow-ups because forcing major version upgrades to silence these advisories will likely cause breaking changes across the FastAPI applications (`starlette` is a core FastAPI dependency).
