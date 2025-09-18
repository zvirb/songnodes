"""NLP Processor Service for SongNodes"""
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel
from typing import List, Dict, Any
import logging
import time
import psutil
import os

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Metrics tracking
start_time = time.time()
request_count = 0
error_count = 0

app = FastAPI(
    title="NLP Processor Service",
    description="Natural Language Processing for music data",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class TextAnalysisRequest(BaseModel):
    text: str
    language: str = "en"

class TextAnalysisResponse(BaseModel):
    entities: List[Dict[str, Any]]
    keywords: List[str]
    sentiment: float
    language: str

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "nlp-processor",
        "version": "1.0.0"
    }

@app.get("/metrics", response_class=PlainTextResponse)
async def metrics():
    """Prometheus-compatible metrics endpoint"""
    global request_count, error_count, start_time

    uptime = time.time() - start_time
    process = psutil.Process(os.getpid())
    memory_info = process.memory_info()

    metrics_text = f"""# HELP nlp_requests_total Total number of requests
# TYPE nlp_requests_total counter
nlp_requests_total {request_count}

# HELP nlp_errors_total Total number of errors
# TYPE nlp_errors_total counter
nlp_errors_total {error_count}

# HELP nlp_uptime_seconds Uptime in seconds
# TYPE nlp_uptime_seconds gauge
nlp_uptime_seconds {uptime}

# HELP nlp_memory_bytes Memory usage in bytes
# TYPE nlp_memory_bytes gauge
nlp_memory_bytes {memory_info.rss}

# HELP nlp_cpu_percent CPU usage percentage
# TYPE nlp_cpu_percent gauge
nlp_cpu_percent {process.cpu_percent()}
"""

    return metrics_text

@app.post("/analyze", response_model=TextAnalysisResponse)
async def analyze_text(request: TextAnalysisRequest):
    """Analyze text for music-related entities and sentiment"""
    global request_count, error_count
    request_count += 1

    try:
        # Placeholder implementation - would integrate with NLP library
        return TextAnalysisResponse(
            entities=[
                {"type": "artist", "value": "Example Artist", "confidence": 0.95}
            ],
            keywords=["music", "electronic", "house"],
            sentiment=0.75,
            language=request.language
        )
    except Exception as e:
        error_count += 1
        logger.error(f"Analysis failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/extract-artists")
async def extract_artists(request: TextAnalysisRequest):
    """Extract artist names from text"""
    global request_count, error_count
    request_count += 1

    try:
        # Placeholder for artist extraction logic
        return {
            "artists": ["Artist 1", "Artist 2"],
            "confidence_scores": [0.95, 0.88]
        }
    except Exception as e:
        error_count += 1
        logger.error(f"Artist extraction failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8021)