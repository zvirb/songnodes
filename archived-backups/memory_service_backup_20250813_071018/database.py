"""
Memory Service Database Connection and Management
Handles PostgreSQL database connections and session management
"""

import asyncio
import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.pool import NullPool

from .config import get_settings
from .models import Base

logger = logging.getLogger(__name__)
settings = get_settings()

# Global engine and session maker
engine = None
AsyncSessionLocal = None


async def init_database() -> None:
    """Initialize database engine and create tables"""
    global engine, AsyncSessionLocal
    
    try:
        # Create async engine
        engine = create_async_engine(
            settings.database_url,
            echo=settings.DEBUG,
            poolclass=NullPool if settings.DEBUG else None,
            pool_pre_ping=True,
            pool_recycle=3600,  # 1 hour
        )
        
        # Create session maker
        AsyncSessionLocal = async_sessionmaker(
            engine,
            class_=AsyncSession,
            expire_on_commit=False
        )
        
        # Create tables (if they don't exist)
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        
        logger.info("Database initialized successfully")
        
    except Exception as e:
        logger.error(f"Failed to initialize database: {e}")
        raise


async def close_database() -> None:
    """Close database connections"""
    global engine
    
    if engine:
        await engine.dispose()
        logger.info("Database connections closed")


@asynccontextmanager
async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    """Get database session with automatic cleanup"""
    if not AsyncSessionLocal:
        raise RuntimeError("Database not initialized. Call init_database() first.")
    
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def get_db_session_dependency() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency for getting database session"""
    async with get_db_session() as session:
        yield session


class DatabaseHealthChecker:
    """Health checker for database connectivity"""
    
    @staticmethod
    async def check_connection() -> bool:
        """Check if database connection is healthy"""
        try:
            async with get_db_session() as session:
                result = await session.execute("SELECT 1")
                return result.scalar() == 1
        except Exception as e:
            logger.error(f"Database health check failed: {e}")
            return False
    
    @staticmethod
    async def check_tables_exist() -> bool:
        """Check if required tables exist"""
        required_tables = [
            'graph_nodes',
            'graph_edges', 
            'memory_records',
            'processing_jobs'
        ]
        
        try:
            async with get_db_session() as session:
                for table in required_tables:
                    result = await session.execute(
                        f"SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = '{table}')"
                    )
                    if not result.scalar():
                        logger.error(f"Required table '{table}' not found")
                        return False
                return True
        except Exception as e:
            logger.error(f"Table existence check failed: {e}")
            return False