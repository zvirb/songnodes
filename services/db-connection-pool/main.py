"""
Database Connection Pool Manager
Provides monitoring and management for PgBouncer connection pooling
"""

import asyncio
import logging
import os
import time
from contextlib import asynccontextmanager
from typing import Dict, List, Optional

import asyncpg
import structlog
from fastapi import FastAPI, HTTPException, status
from fastapi.responses import JSONResponse
from prometheus_client import Counter, Gauge, Histogram, generate_latest
from pydantic import BaseModel

# Configure structured logging
structlog.configure(
    processors=[
        structlog.stdlib.filter_by_level,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.stdlib.PositionalArgumentsFormatter(),
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.processors.UnicodeDecoder(),
        structlog.processors.JSONRenderer()
    ],
    context_class=dict,
    logger_factory=structlog.stdlib.LoggerFactory(),
    wrapper_class=structlog.stdlib.BoundLogger,
    cache_logger_on_first_use=True,
)

logger = structlog.get_logger()

# Prometheus metrics
CONNECTION_POOL_ACTIVE = Gauge('pgbouncer_active_connections_total', 'Active connections in pool', ['database'])
CONNECTION_POOL_WAITING = Gauge('pgbouncer_waiting_connections_total', 'Waiting connections in pool', ['database'])
CONNECTION_POOL_USED = Gauge('pgbouncer_used_connections_total', 'Used connections in pool', ['database'])
QUERY_DURATION = Histogram('pgbouncer_query_duration_seconds', 'Query duration in seconds', ['database'])
CONNECTION_ERRORS = Counter('pgbouncer_connection_errors_total', 'Connection errors', ['database', 'error_type'])
HEALTH_CHECK_FAILURES = Counter('pgbouncer_health_check_failures_total', 'Health check failures')

class ConnectionPoolStats(BaseModel):
    database: str
    user: str
    cl_active: int
    cl_waiting: int
    sv_active: int
    sv_idle: int
    sv_used: int
    sv_tested: int
    sv_login: int
    maxwait: float
    maxwait_us: int
    pool_mode: str

class PoolManager:
    def __init__(self):
        self.pgbouncer_host = os.getenv('PGBOUNCER_HOST', 'localhost')
        self.pgbouncer_port = int(os.getenv('PGBOUNCER_PORT', '6432'))
        self.pgbouncer_admin_user = os.getenv('PGBOUNCER_ADMIN_USER', 'pgbouncer')
        self.pgbouncer_admin_password = os.getenv('PGBOUNCER_ADMIN_PASSWORD', 'pgbouncer')
        self.postgres_host = os.getenv('POSTGRES_HOST', 'postgres')
        self.postgres_port = int(os.getenv('POSTGRES_PORT', '5432'))
        self.postgres_user = os.getenv('POSTGRES_USER', 'musicdb_user')
        self.postgres_password = os.getenv('POSTGRES_PASSWORD', 'musicdb_secure_pass')
        self.postgres_db = os.getenv('POSTGRES_DB', 'musicdb')
        
        self._admin_pool: Optional[asyncpg.Pool] = None
        self._app_pool: Optional[asyncpg.Pool] = None

    async def initialize(self):
        """Initialize connection pools"""
        try:
            # Admin connection to PgBouncer (smaller pool to avoid conflicts)
            self._admin_pool = await asyncpg.create_pool(
                host=self.pgbouncer_host,
                port=self.pgbouncer_port,
                user=self.pgbouncer_admin_user,
                password=self.pgbouncer_admin_password,
                database='pgbouncer',
                min_size=1,
                max_size=2,
                command_timeout=10
            )
            
            # Small delay to prevent concurrent connection issues
            await asyncio.sleep(0.1)
            
            # Application connection through PgBouncer
            self._app_pool = await asyncpg.create_pool(
                host=self.pgbouncer_host,
                port=self.pgbouncer_port,
                user=self.postgres_user,
                password=self.postgres_password,
                database=self.postgres_db,
                min_size=2,
                max_size=10,
                command_timeout=30
            )
            
            logger.info("Connection pools initialized successfully")
            
        except Exception as e:
            logger.error("Failed to initialize connection pools", error=str(e))
            raise

    async def close(self):
        """Close all connection pools"""
        if self._admin_pool:
            await self._admin_pool.close()
        if self._app_pool:
            await self._app_pool.close()
        logger.info("Connection pools closed")

    async def get_pool_stats(self) -> List[ConnectionPoolStats]:
        """Get PgBouncer pool statistics"""
        if not self._admin_pool:
            raise HTTPException(status_code=503, detail="Admin pool not initialized")
        
        try:
            # Use a timeout to prevent hanging connections
            async with asyncio.timeout(5):
                async with self._admin_pool.acquire() as conn:
                    rows = await conn.fetch("SHOW POOLS")
                    stats = []
                    
                    for row in rows:
                        stat = ConnectionPoolStats(
                            database=row['database'],
                            user=row['user'],
                            cl_active=row['cl_active'],
                            cl_waiting=row['cl_waiting'],
                            sv_active=row['sv_active'],
                            sv_idle=row['sv_idle'],
                            sv_used=row['sv_used'],
                            sv_tested=row['sv_tested'],
                            sv_login=row['sv_login'],
                            maxwait=row['maxwait'],
                            maxwait_us=row['maxwait_us'],
                            pool_mode=row['pool_mode']
                        )
                        stats.append(stat)
                        
                        # Update Prometheus metrics
                        CONNECTION_POOL_ACTIVE.labels(database=stat.database).set(stat.cl_active)
                        CONNECTION_POOL_WAITING.labels(database=stat.database).set(stat.cl_waiting)
                        CONNECTION_POOL_USED.labels(database=stat.database).set(stat.sv_used)
                    
                    return stats
                
        except asyncio.TimeoutError:
            logger.error("Stats query timed out")
            CONNECTION_ERRORS.labels(database='admin', error_type='timeout').inc()
            raise HTTPException(status_code=503, detail="Stats query timed out")
        except Exception as e:
            logger.error("Failed to get pool stats", error=str(e))
            CONNECTION_ERRORS.labels(database='admin', error_type='stats_fetch').inc()
            raise HTTPException(status_code=503, detail=f"Failed to get pool stats: {str(e)}")

    async def health_check(self) -> Dict[str, str]:
        """Perform comprehensive health check"""
        health_status = {"status": "healthy", "timestamp": time.time()}
        
        try:
            # Check pools are available
            if not self._admin_pool:
                raise Exception("Admin pool not available")
            if not self._app_pool:
                raise Exception("Application pool not available")
            
            # Simple connectivity test for application pool only
            async with self._app_pool.acquire() as conn:
                result = await conn.fetchval("SELECT 1")
                if result != 1:
                    raise Exception("Database connectivity test failed")
            
            health_status["pgbouncer"] = "connected"
            health_status["database"] = "connected"
            health_status["pools"] = "available"
            
        except Exception as e:
            logger.error("Health check failed", error=str(e))
            HEALTH_CHECK_FAILURES.inc()
            health_status["status"] = "unhealthy"
            health_status["error"] = str(e)
            
        return health_status

    async def execute_query(self, query: str, params: list = None) -> List[Dict]:
        """Execute query through connection pool with timing"""
        if not self._app_pool:
            raise HTTPException(status_code=503, detail="Application pool not initialized")
        
        start_time = time.time()
        try:
            async with self._app_pool.acquire() as conn:
                if params:
                    rows = await conn.fetch(query, *params)
                else:
                    rows = await conn.fetch(query)
                
                duration = time.time() - start_time
                QUERY_DURATION.labels(database=self.postgres_db).observe(duration)
                
                return [dict(row) for row in rows]
                
        except Exception as e:
            duration = time.time() - start_time
            logger.error("Query execution failed", query=query, duration=duration, error=str(e))
            CONNECTION_ERRORS.labels(database=self.postgres_db, error_type='query_execution').inc()
            raise HTTPException(status_code=500, detail=f"Query execution failed: {str(e)}")

    async def reload_config(self) -> Dict[str, str]:
        """Reload PgBouncer configuration"""
        if not self._admin_pool:
            raise HTTPException(status_code=503, detail="Admin pool not initialized")
        
        try:
            async with self._admin_pool.acquire() as conn:
                await conn.execute("RELOAD")
            
            logger.info("PgBouncer configuration reloaded")
            return {"status": "success", "message": "Configuration reloaded"}
            
        except Exception as e:
            logger.error("Failed to reload configuration", error=str(e))
            raise HTTPException(status_code=500, detail=f"Failed to reload configuration: {str(e)}")

# Global pool manager instance
pool_manager = PoolManager()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await pool_manager.initialize()
    yield
    # Shutdown
    await pool_manager.close()

# FastAPI application
app = FastAPI(
    title="Database Connection Pool Manager",
    description="Monitoring and management for PgBouncer connection pooling",
    version="1.0.0",
    lifespan=lifespan
)

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return await pool_manager.health_check()

@app.get("/stats")
async def get_pool_stats():
    """Get connection pool statistics"""
    stats = await pool_manager.get_pool_stats()
    return {"pools": stats, "timestamp": time.time()}

@app.get("/metrics")
async def get_metrics():
    """Prometheus metrics endpoint"""
    return JSONResponse(
        content=generate_latest().decode('utf-8'),
        media_type="text/plain"
    )

@app.post("/reload")
async def reload_configuration():
    """Reload PgBouncer configuration"""
    return await pool_manager.reload_config()

@app.post("/query")
async def execute_query(query: str, params: List = None):
    """Execute query through connection pool"""
    return await pool_manager.execute_query(query, params)

@app.get("/pool-info")
async def get_detailed_pool_info():
    """Get detailed pool information"""
    try:
        stats = await pool_manager.get_pool_stats()
        
        # Calculate utilization metrics
        pool_info = []
        for stat in stats:
            total_connections = stat.sv_active + stat.sv_idle + stat.sv_used
            utilization = (stat.sv_used / max(total_connections, 1)) * 100
            
            pool_info.append({
                "database": stat.database,
                "user": stat.user,
                "utilization_percent": round(utilization, 2),
                "active_clients": stat.cl_active,
                "waiting_clients": stat.cl_waiting,
                "server_connections": {
                    "active": stat.sv_active,
                    "idle": stat.sv_idle,
                    "used": stat.sv_used,
                    "total": total_connections
                },
                "max_wait_time": stat.maxwait,
                "pool_mode": stat.pool_mode
            })
        
        return {"pools": pool_info, "timestamp": time.time()}
        
    except Exception as e:
        logger.error("Failed to get detailed pool info", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8025, log_level="info")