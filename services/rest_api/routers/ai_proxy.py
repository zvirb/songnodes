import asyncio
import logging
from typing import Optional
import aiohttp
from fastapi import APIRouter, HTTPException, Depends, Request, status
from pydantic import BaseModel, Field

from utils.api_key_helper import get_api_key

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/ai", tags=["AI Proxy"])

MAX_BODY_SIZE = 100 * 1024  # 100KB
AI_CONCURRENCY_LIMIT = 50
ai_semaphore = asyncio.Semaphore(AI_CONCURRENCY_LIMIT)

class AICompletionRequest(BaseModel):
    provider: str = Field(..., description="Provider name: claude, openai, or gemini")
    model: str = Field(..., description="Model name")
    system: Optional[str] = Field(None, description="System prompt")
    prompt: str = Field(..., description="User prompt")
    max_tokens: Optional[int] = Field(2000, description="Max tokens in response")
    web_search: Optional[bool] = Field(False, description="Whether to use web search (if supported)")

class AICompletionResponse(BaseModel):
    text: str
    provider: str
    model: str
    usage: Optional[dict] = None

# Get database pool from app state (injected by main.py)
async def get_db_pool():
    from main import db_pool
    if not db_pool:
        raise HTTPException(
            status_code=500,
            detail="Database connection pool not available"
        )
    return db_pool

async def get_provider_key(provider: str, pool) -> str:
    key = None
    if provider == "claude":
        key = await get_api_key(pool, "anthropic", "api_key")
    elif provider == "openai":
        key = await get_api_key(pool, "openai", "api_key")
    elif provider == "gemini":
        key = await get_api_key(pool, "google", "api_key")

    if not key:
        raise HTTPException(status_code=401, detail=f"API key not configured for provider {provider}")
    return key


@router.post("/complete", response_model=AICompletionResponse)
async def ai_complete(
    request: Request,
    body: AICompletionRequest,
    pool = Depends(get_db_pool)
):
    if request.headers.get("content-length") and int(request.headers.get("content-length", 0)) > MAX_BODY_SIZE:
        raise HTTPException(status_code=413, detail="Request body too large")

    provider = body.provider.lower()
    if provider not in ["claude", "openai", "gemini"]:
        raise HTTPException(status_code=400, detail="Unsupported provider")

    # Cap max tokens
    max_tokens = min(body.max_tokens or 2000, 8000)

    api_key = await get_provider_key(provider, pool)

    async with ai_semaphore:
        try:
            return await _call_provider(provider, body, max_tokens, api_key)
        except asyncio.TimeoutError:
            raise HTTPException(status_code=504, detail="Upstream timeout")
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"AI proxy error for {provider}: {str(e)}")
            raise HTTPException(status_code=500, detail="Internal server error")

async def _call_provider(provider: str, body: AICompletionRequest, max_tokens: int, api_key: str):
    timeout = aiohttp.ClientTimeout(total=60)
    async with aiohttp.ClientSession(timeout=timeout) as session:
        if provider == "claude":
            url = "https://api.anthropic.com/v1/messages"
            headers = {
                "x-api-key": api_key,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json"
            }
            payload = {
                "model": body.model,
                "max_tokens": max_tokens,
                "messages": [{"role": "user", "content": body.prompt}]
            }
            if body.system:
                payload["system"] = body.system

            async with session.post(url, headers=headers, json=payload) as resp:
                await _handle_response_errors(resp)
                data = await resp.json()
                text = ""
                for content in data.get("content", []):
                    if content.get("type") == "text":
                        text = content.get("text", "")
                        break
                return AICompletionResponse(
                    text=text,
                    provider=provider,
                    model=body.model,
                    usage=data.get("usage")
                )

        elif provider == "openai":
            url = "https://api.openai.com/v1/chat/completions"
            headers = {
                "Authorization": f"Bearer {api_key}",
                "content-type": "application/json"
            }
            messages = []
            if body.system:
                messages.append({"role": "system", "content": body.system})
            messages.append({"role": "user", "content": body.prompt})

            payload = {
                "model": body.model,
                "messages": messages,
                "max_tokens": max_tokens
            }
            async with session.post(url, headers=headers, json=payload) as resp:
                await _handle_response_errors(resp)
                data = await resp.json()
                text = ""
                choices = data.get("choices", [])
                if choices:
                    text = choices[0].get("message", {}).get("content", "")
                return AICompletionResponse(
                    text=text,
                    provider=provider,
                    model=body.model,
                    usage=data.get("usage")
                )

        elif provider == "gemini":
            # Gemini accepts API key in the URL, but the requirement says: "Keys... go in headers only"
            # Google AI Studio Gemini API accepts key via x-goog-api-key header
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{body.model}:generateContent"
            headers = {
                "x-goog-api-key": api_key,
                "content-type": "application/json"
            }

            contents = []
            if body.system:
                # Gemini doesn't use standard system/user messages in the same way for simple content,
                # but we can pass system instruction in the payload (v1beta supports systemInstruction)
                contents.append({"role": "user", "parts": [{"text": body.prompt}]})
                payload = {
                    "contents": contents,
                    "systemInstruction": {"parts": [{"text": body.system}]},
                    "generationConfig": {"maxOutputTokens": max_tokens}
                }
            else:
                payload = {
                    "contents": [{"parts": [{"text": body.prompt}]}],
                    "generationConfig": {"maxOutputTokens": max_tokens}
                }

            if body.web_search:
                # Grounding with Google Search; only Gemini supports this through the proxy.
                payload["tools"] = [{"google_search": {}}]

            async with session.post(url, headers=headers, json=payload) as resp:
                await _handle_response_errors(resp)
                data = await resp.json()
                text = ""
                candidates = data.get("candidates", [])
                if candidates:
                    parts = candidates[0].get("content", {}).get("parts", [])
                    if parts:
                        text = parts[0].get("text", "")
                return AICompletionResponse(
                    text=text,
                    provider=provider,
                    model=body.model,
                    usage=data.get("usageMetadata")
                )

async def _handle_response_errors(resp: aiohttp.ClientResponse):
    if resp.status >= 400:
        # Try to read error body safely (bounded)
        try:
            error_text = await resp.text()
            # Do not include the error text directly if it might contain the key or sensitive info,
            # but usually it's safe if it's a provider error message. We'll stick to generic mapping.
        except Exception:
            pass

        if resp.status in (401, 403):
            raise HTTPException(status_code=401, detail="Upstream authentication failed")
        elif resp.status == 429:
            raise HTTPException(status_code=429, detail="Upstream rate limit exceeded")
        else:
            raise HTTPException(status_code=502, detail="Upstream provider error")

def register(app):
    app.include_router(router)
