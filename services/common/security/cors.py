import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

def get_allowed_origins() -> list[str]:
    """
    Get allowed origins from CORS_ALLOWED_ORIGINS env var or use defaults
    Defaults to localhost and 127.0.0.1 on port 3006
    """
    origins_str = os.getenv('CORS_ALLOWED_ORIGINS', 'http://localhost:3006,http://127.0.0.1:3006')
    return [origin.strip() for origin in origins_str.split(',') if origin.strip()]

def setup_cors(app: FastAPI) -> None:
    """
    Setup CORS middleware on the given FastAPI app with an explicit allowlist.
    """
    app.add_middleware(
        CORSMiddleware,
        allow_origins=get_allowed_origins(),
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
        allow_headers=["Authorization", "Content-Type", "Accept", "Origin", "X-Requested-With"],
    )
