"""Utility helpers for retrieving secrets in scraper components."""

from __future__ import annotations

import os
import sys
from pathlib import Path
from typing import Optional


PROJECT_ROOT = Path(__file__).resolve().parents[1]
LOCAL_SECRETS_DIR = PROJECT_ROOT / "secrets"
DOCKER_SECRETS_DIR = Path("/run/secrets")


def _load_secret_manager():
    potential_paths = [
        Path("/app/common"),
        PROJECT_ROOT / "services" / "common",
    ]
    for path in potential_paths:
        if path.exists() and path.is_dir():
            if str(path) not in sys.path:
                sys.path.insert(0, str(path))
            try:
                from secrets_manager import get_secret as secret_fn  # type: ignore

                return secret_fn
            except ImportError:
                continue
    return None


_SECRET_MANAGER = _load_secret_manager()


def resolve_secret(key: str, default: Optional[str] = None) -> Optional[str]:
    """Resolve secret values using the unified SongNodes approach."""

    if _SECRET_MANAGER:
        try:
            value = _SECRET_MANAGER(key, default=default)
            if value is not None:
                return value
        except Exception:
            pass

    value = os.getenv(key)
    if value:
        return value

    file_path = os.getenv(f"{key}_FILE")
    if file_path and os.path.exists(file_path):
        try:
            with open(file_path, "r", encoding="utf-8") as handle:
                file_value = handle.read().strip()
                if file_value:
                    return file_value
        except OSError:
            pass

    docker_secret_path = DOCKER_SECRETS_DIR / key.lower()
    if docker_secret_path.exists():
        try:
            with open(docker_secret_path, "r", encoding="utf-8") as handle:
                file_value = handle.read().strip()
                if file_value:
                    return file_value
        except OSError:
            pass

    local_secret_path = LOCAL_SECRETS_DIR / key.lower()
    if local_secret_path.exists():
        try:
            with open(local_secret_path, "r", encoding="utf-8") as handle:
                file_value = handle.read().strip()
                if file_value:
                    return file_value
        except OSError:
            pass

    return default
