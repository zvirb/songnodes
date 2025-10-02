"""
Health Monitoring Module - 2025 Best Practices
Comprehensive resource monitoring with automatic 503 responses on threshold breaches
"""

import psutil
import logging
from typing import Dict, Any, Optional, Callable
from dataclasses import dataclass
from datetime import datetime
from fastapi import HTTPException
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)


@dataclass
class HealthThresholds:
    """Configurable health check thresholds"""
    memory_percent: float = 85.0  # Maximum memory usage percentage
    db_pool_usage: float = 0.8  # Maximum database pool usage (80%)
    redis_memory_mb: Optional[float] = None  # Optional Redis memory limit in MB
    connection_timeout: float = 5.0  # Connection health check timeout in seconds


class HealthCheckStatus(BaseModel):
    """Health check status response model"""
    status: str = Field(..., description="Overall health status: healthy, degraded, or unhealthy")
    checks: Dict[str, Dict[str, Any]] = Field(default_factory=dict, description="Individual check results")
    timestamp: str = Field(default_factory=lambda: datetime.utcnow().isoformat(), description="Check timestamp")
    service: str = Field(..., description="Service name")
    version: str = Field(default="1.0.0", description="Service version")


class ResourceMonitor:
    """
    Resource monitoring with automatic threshold enforcement
    Implements 2025 best practices from CLAUDE.md Section 5.3.4
    """

    def __init__(
        self,
        service_name: str,
        thresholds: Optional[HealthThresholds] = None,
        db_pool: Optional[Any] = None,
        redis_client: Optional[Any] = None
    ):
        """
        Initialize resource monitor

        Args:
            service_name: Name of the service for logging/identification
            thresholds: Optional custom thresholds (uses defaults if not provided)
            db_pool: Optional database connection pool object
            redis_client: Optional Redis client for memory monitoring
        """
        self.service_name = service_name
        self.thresholds = thresholds or HealthThresholds()
        self.db_pool = db_pool
        self.redis_client = redis_client

    def check_memory(self) -> Dict[str, Any]:
        """
        Check system memory usage

        Returns:
            Dict with memory status, usage percentage, and threshold

        Raises:
            HTTPException: 503 if memory usage exceeds threshold
        """
        try:
            memory = psutil.virtual_memory()
            memory_percent = memory.percent

            status = "ok" if memory_percent <= self.thresholds.memory_percent else "critical"

            result = {
                "status": status,
                "usage": memory_percent,
                "threshold": self.thresholds.memory_percent,
                "available_mb": memory.available / (1024 * 1024),
                "total_mb": memory.total / (1024 * 1024)
            }

            if status == "critical":
                error_msg = (
                    f"Memory usage critical: {memory_percent:.1f}% "
                    f"(threshold: {self.thresholds.memory_percent}%)"
                )
                logger.error(f"[{self.service_name}] {error_msg}")
                raise HTTPException(
                    status_code=503,
                    detail=error_msg
                )

            return result

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"[{self.service_name}] Memory check failed: {e}")
            return {
                "status": "error",
                "error": str(e),
                "usage": 0,
                "threshold": self.thresholds.memory_percent
            }

    def check_database_pool(self) -> Dict[str, Any]:
        """
        Check database connection pool usage

        Returns:
            Dict with pool status, usage, and threshold

        Raises:
            HTTPException: 503 if pool usage exceeds threshold
        """
        if not self.db_pool:
            return {
                "status": "not_configured",
                "message": "Database pool not configured for monitoring"
            }

        try:
            # Support different pool implementations
            pool_usage = self._calculate_pool_usage()

            status = "ok" if pool_usage <= self.thresholds.db_pool_usage else "critical"

            result = {
                "status": status,
                "usage": pool_usage,
                "threshold": self.thresholds.db_pool_usage
            }

            # Add pool-specific metrics if available
            if hasattr(self.db_pool, 'size'):
                result["size"] = self.db_pool.size()
            if hasattr(self.db_pool, 'get_size'):
                result["size"] = self.db_pool.get_size()
                result["idle_size"] = self.db_pool.get_idle_size() if hasattr(self.db_pool, 'get_idle_size') else None

            if status == "critical":
                error_msg = (
                    f"Database pool exhausted: {pool_usage:.1%} usage "
                    f"(threshold: {self.thresholds.db_pool_usage:.1%})"
                )
                logger.error(f"[{self.service_name}] {error_msg}")
                raise HTTPException(
                    status_code=503,
                    detail=error_msg
                )

            return result

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"[{self.service_name}] Database pool check failed: {e}")
            return {
                "status": "error",
                "error": str(e),
                "usage": 0,
                "threshold": self.thresholds.db_pool_usage
            }

    def _calculate_pool_usage(self) -> float:
        """
        Calculate pool usage as a ratio between 0 and 1
        Supports multiple pool implementations (asyncpg, SQLAlchemy, etc.)
        """
        # asyncpg pool
        if hasattr(self.db_pool, 'get_size') and hasattr(self.db_pool, 'get_max_size'):
            size = self.db_pool.get_size()
            max_size = self.db_pool.get_max_size()
            if max_size > 0:
                return size / max_size

        # SQLAlchemy engine pool
        if hasattr(self.db_pool, 'pool'):
            pool = self.db_pool.pool
            if hasattr(pool, 'size') and hasattr(pool, '_max_overflow'):
                # Calculate current vs maximum possible connections
                size = pool.size()
                max_size = pool.size() + pool._max_overflow
                if max_size > 0:
                    return size / max_size

        # Generic size/overflow pattern
        if hasattr(self.db_pool, 'size') and hasattr(self.db_pool, 'max_overflow'):
            size = self.db_pool.size
            max_size = size + self.db_pool.max_overflow
            if max_size > 0:
                return size / max_size

        # Fallback: unable to determine usage
        logger.warning(f"[{self.service_name}] Unable to calculate pool usage for pool type: {type(self.db_pool)}")
        return 0.0

    def check_redis(self) -> Dict[str, Any]:
        """
        Check Redis connectivity and optionally memory usage

        Returns:
            Dict with Redis status and optional memory metrics

        Raises:
            HTTPException: 503 if Redis memory exceeds threshold (if configured)
        """
        if not self.redis_client:
            return {
                "status": "not_configured",
                "message": "Redis not configured for monitoring"
            }

        try:
            # Check connectivity
            self.redis_client.ping()

            result = {
                "status": "ok",
                "connected": True
            }

            # Check memory if threshold configured
            if self.thresholds.redis_memory_mb is not None:
                try:
                    info = self.redis_client.info('memory')
                    used_memory_mb = info.get('used_memory', 0) / (1024 * 1024)

                    result["memory_mb"] = used_memory_mb
                    result["memory_threshold_mb"] = self.thresholds.redis_memory_mb

                    if used_memory_mb > self.thresholds.redis_memory_mb:
                        result["status"] = "critical"
                        error_msg = (
                            f"Redis memory critical: {used_memory_mb:.1f}MB "
                            f"(threshold: {self.thresholds.redis_memory_mb}MB)"
                        )
                        logger.error(f"[{self.service_name}] {error_msg}")
                        raise HTTPException(
                            status_code=503,
                            detail=error_msg
                        )
                except Exception as mem_error:
                    logger.warning(f"[{self.service_name}] Could not retrieve Redis memory info: {mem_error}")

            return result

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"[{self.service_name}] Redis check failed: {e}")
            return {
                "status": "error",
                "connected": False,
                "error": str(e)
            }

    def check_custom(
        self,
        check_name: str,
        check_function: Callable[[], Dict[str, Any]],
        critical_condition: Optional[Callable[[Dict[str, Any]], bool]] = None
    ) -> Dict[str, Any]:
        """
        Run a custom health check with optional critical condition

        Args:
            check_name: Name of the check for logging
            check_function: Function that returns check results
            critical_condition: Optional function that determines if result is critical

        Returns:
            Dict with check results

        Raises:
            HTTPException: 503 if critical_condition returns True
        """
        try:
            result = check_function()

            if critical_condition and critical_condition(result):
                result["status"] = "critical"
                error_msg = f"{check_name} check failed: {result.get('error', 'Critical condition met')}"
                logger.error(f"[{self.service_name}] {error_msg}")
                raise HTTPException(
                    status_code=503,
                    detail=error_msg
                )

            if "status" not in result:
                result["status"] = "ok"

            return result

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"[{self.service_name}] {check_name} check failed: {e}")
            return {
                "status": "error",
                "error": str(e)
            }

    async def comprehensive_health_check(
        self,
        custom_checks: Optional[Dict[str, Callable]] = None
    ) -> HealthCheckStatus:
        """
        Run comprehensive health check across all monitored resources

        Args:
            custom_checks: Optional dict of custom check functions

        Returns:
            HealthCheckStatus with all check results

        Raises:
            HTTPException: 503 if any critical check fails
        """
        checks = {}

        # Run standard checks
        try:
            checks["memory"] = self.check_memory()
        except HTTPException:
            raise

        try:
            checks["database_pool"] = self.check_database_pool()
        except HTTPException:
            raise

        try:
            checks["redis"] = self.check_redis()
        except HTTPException:
            raise

        # Run custom checks if provided
        if custom_checks:
            for check_name, check_func in custom_checks.items():
                try:
                    checks[check_name] = await check_func() if asyncio.iscoroutinefunction(check_func) else check_func()
                except HTTPException:
                    raise
                except Exception as e:
                    logger.error(f"[{self.service_name}] Custom check '{check_name}' failed: {e}")
                    checks[check_name] = {
                        "status": "error",
                        "error": str(e)
                    }

        # Determine overall status
        statuses = [check.get("status", "unknown") for check in checks.values()]

        if "critical" in statuses or "error" in statuses:
            overall_status = "unhealthy"
        elif "degraded" in statuses:
            overall_status = "degraded"
        else:
            overall_status = "healthy"

        return HealthCheckStatus(
            status=overall_status,
            checks=checks,
            service=self.service_name
        )


# Convenience function for simple health check endpoint
def create_health_check_endpoint(
    service_name: str,
    db_pool: Optional[Any] = None,
    redis_client: Optional[Any] = None,
    thresholds: Optional[HealthThresholds] = None,
    custom_checks: Optional[Dict[str, Callable]] = None
):
    """
    Create a FastAPI health check endpoint with comprehensive monitoring

    Usage:
        from common.health_monitor import create_health_check_endpoint

        health_check = create_health_check_endpoint(
            service_name="rest-api",
            db_pool=db_pool,
            redis_client=redis_client
        )

        @app.get("/health")
        async def health():
            return await health_check()

    Args:
        service_name: Name of the service
        db_pool: Database connection pool
        redis_client: Redis client
        thresholds: Custom thresholds
        custom_checks: Custom check functions

    Returns:
        Async function suitable for FastAPI route handler
    """
    monitor = ResourceMonitor(
        service_name=service_name,
        thresholds=thresholds,
        db_pool=db_pool,
        redis_client=redis_client
    )

    async def health_check_handler():
        """Health check endpoint handler"""
        try:
            return await monitor.comprehensive_health_check(custom_checks=custom_checks)
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"[{service_name}] Health check failed: {e}")
            raise HTTPException(
                status_code=503,
                detail=f"Health check failed: {str(e)}"
            )

    return health_check_handler


# For async compatibility
import asyncio
