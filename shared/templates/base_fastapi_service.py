"""
Base FastAPI Service Template for SongNodes Microservices
Provides common patterns for authentication, monitoring, and error handling.
"""

import os
import asyncio
from typing import Optional, Dict, Any
from contextlib import asynccontextmanager

import redis.asyncio as redis
from fastapi import FastAPI, HTTPException, Request, Depends
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from pydantic import BaseSettings
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.pool import QueuePool
import prometheus_client
from prometheus_client import Counter, Histogram, Gauge


class ServiceSettings(BaseSettings):
    """Base settings for SongNodes microservices"""
    
    # Service configuration
    service_name: str = "songnodes-service"
    service_version: str = "1.0.0"
    port: int = 8000
    
    # Database configuration
    database_url: str = "postgresql+asyncpg://user:pass@localhost/songnodes"
    database_pool_size: int = 10
    database_max_overflow: int = 20
    
    # Redis configuration
    redis_url: str = "redis://:redis_secure_pass_2024@localhost:6379"  # Include password
    redis_db: int = 0
    
    # Monitoring
    enable_metrics: bool = True
    log_level: str = "INFO"
    
    class Config:
        env_file = ".env"


# Global metrics
REQUEST_COUNT = Counter('requests_total', 'Total requests', ['method', 'endpoint', 'status'])
REQUEST_DURATION = Histogram('request_duration_seconds', 'Request duration')
ACTIVE_CONNECTIONS = Gauge('active_connections', 'Active connections')


class BaseSongNodesService:
    """Base class for SongNodes microservices"""
    
    def __init__(self, service_name: str, service_version: str = "1.0.0"):
        self.settings = ServiceSettings()
        self.settings.service_name = service_name
        self.settings.service_version = service_version
        
        # Database and Redis connections
        self.engine = None
        self.SessionLocal = None
        self.redis_client = None
        
        # Create FastAPI app
        self.app = self._create_app()
        
    def _create_app(self) -> FastAPI:
        """Create and configure FastAPI application"""
        
        @asynccontextmanager
        async def lifespan(app: FastAPI):
            # Startup
            await self._startup()
            yield
            # Shutdown
            await self._shutdown()
        
        app = FastAPI(
            title=self.settings.service_name,
            version=self.settings.service_version,
            description=f"SongNodes microservice: {self.settings.service_name}",
            lifespan=lifespan
        )
        
        # Add middleware
        self._add_middleware(app)
        
        # Add common routes
        self._add_common_routes(app)
        
        return app
    
    def _add_middleware(self, app: FastAPI):
        """Add common middleware"""
        
        # CORS
        app.add_middleware(
            CORSMiddleware,
            allow_origins=["*"],  # Configure appropriately for production
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        )
        
        # Compression
        app.add_middleware(GZipMiddleware, minimum_size=1000)
        
        # Metrics middleware
        if self.settings.enable_metrics:
            @app.middleware("http")
            async def metrics_middleware(request: Request, call_next):
                start_time = asyncio.get_event_loop().time()
                
                response = await call_next(request)
                
                # Record metrics
                duration = asyncio.get_event_loop().time() - start_time
                REQUEST_DURATION.observe(duration)
                REQUEST_COUNT.labels(
                    method=request.method,
                    endpoint=request.url.path,
                    status=response.status_code
                ).inc()
                
                return response
    
    def _add_common_routes(self, app: FastAPI):
        """Add common health and metrics endpoints"""
        
        @app.get("/health")
        async def health_check():
            """Health check endpoint"""
            return {
                "status": "healthy",
                "service": self.settings.service_name,
                "version": self.settings.service_version,
                "timestamp": asyncio.get_event_loop().time()
            }
        
        @app.get("/ready")
        async def readiness_check():
            """Readiness check endpoint"""
            checks = {}
            
            # Database check
            if self.engine:
                try:
                    async with self.engine.begin() as conn:
                        await conn.execute("SELECT 1")
                    checks["database"] = "healthy"
                except Exception as e:
                    checks["database"] = f"unhealthy: {str(e)}"
            
            # Redis check
            if self.redis_client:
                try:
                    await self.redis_client.ping()
                    checks["redis"] = "healthy"
                except Exception as e:
                    checks["redis"] = f"unhealthy: {str(e)}"
            
            all_healthy = all(status == "healthy" for status in checks.values())
            status_code = 200 if all_healthy else 503
            
            return JSONResponse(
                status_code=status_code,
                content={
                    "status": "ready" if all_healthy else "not ready",
                    "checks": checks
                }
            )
        
        if self.settings.enable_metrics:
            @app.get("/metrics")
            async def metrics():
                """Prometheus metrics endpoint"""
                return Response(
                    prometheus_client.generate_latest(prometheus_client.REGISTRY),
                    media_type="text/plain"
                )
    
    async def _startup(self):
        """Service startup logic"""
        # Initialize database
        if self.settings.database_url:
            self.engine = create_async_engine(
                self.settings.database_url,
                poolclass=QueuePool,
                pool_size=self.settings.database_pool_size,
                max_overflow=self.settings.database_max_overflow,
                pool_pre_ping=True,
                pool_recycle=3600,
                echo=False
            )
            self.SessionLocal = async_sessionmaker(
                bind=self.engine,
                class_=AsyncSession,
                expire_on_commit=False
            )
        
        # Initialize Redis
        if self.settings.redis_url:
            self.redis_client = redis.from_url(
                self.settings.redis_url,
                db=self.settings.redis_db,
                decode_responses=True
            )
    
    async def _shutdown(self):
        """Service shutdown logic"""
        if self.engine:
            await self.engine.dispose()
        
        if self.redis_client:
            await self.redis_client.close()
    
    async def get_db_session(self) -> AsyncSession:
        """Dependency for database sessions"""
        if not self.SessionLocal:
            raise HTTPException(status_code=500, detail="Database not configured")
        
        async with self.SessionLocal() as session:
            try:
                yield session
            finally:
                await session.close()
    
    async def get_redis(self) -> redis.Redis:
        """Dependency for Redis client"""
        if not self.redis_client:
            raise HTTPException(status_code=500, detail="Redis not configured")
        return self.redis_client


def create_songnodes_service(service_name: str, service_version: str = "1.0.0") -> FastAPI:
    """Factory function to create a SongNodes microservice"""
    service = BaseSongNodesService(service_name, service_version)
    return service.app