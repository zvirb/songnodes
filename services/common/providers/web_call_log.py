import asyncio
import time
from typing import Any, Callable, Dict, Optional
import httpx

"""
Web Call Log wrapper to record outbound HTTP requests.

MusicBrainz web fallback rule: 1 request per second and a descriptive User-Agent.
"""

# In a real system, we'd inject a database connection to insert records.
# For tests and abstract usage, we'll allow providing an async callback to process log entries.
class WebCallLogger:
    def __init__(self, provider_name: str, run_id: Optional[str] = None, log_callback: Optional[Callable[[Dict[str, Any]], Any]] = None):
        self.provider_name = provider_name
        self.run_id = run_id
        self.log_callback = log_callback

    async def log_request(self, request: httpx.Request, response: Optional[httpx.Response], duration_ms: int):
        status = response.status_code if response else None

        entry = {
            "provider": self.provider_name,
            "endpoint": str(request.url),
            "field": None,  # Can be augmented by callers if needed
            "run_id": self.run_id,
            "status": status,
            "duration_ms": duration_ms
        }

        if self.log_callback:
            if asyncio.iscoroutinefunction(self.log_callback):
                await self.log_callback(entry)
            else:
                self.log_callback(entry)

def attach_web_call_wrapper(client: httpx.AsyncClient, logger: WebCallLogger) -> httpx.AsyncClient:
    """
    Attaches event hooks to an httpx.AsyncClient to log every outbound request.
    Does not modify existing provider code, just wraps the client it uses.
    """

    async def log_response_hook(response: httpx.Response):
        request = response.request
        start_time = getattr(request, "start_time", time.time())
        duration_ms = int((time.time() - start_time) * 1000)
        await logger.log_request(request, response, duration_ms)

    async def add_start_time_hook(request: httpx.Request):
        request.start_time = time.time()

    # Append to existing hooks
    client.event_hooks["request"].append(add_start_time_hook)
    client.event_hooks["response"].append(log_response_hook)

    return client
