"""
Memory Service Configuration
Environment-based configuration management
"""

import os
from functools import lru_cache
from typing import Optional

from pydantic import BaseSettings, Field


class Settings(BaseSettings):
    """Configuration settings for Memory Service"""
    
    # Service Configuration
    SERVICE_NAME: str = Field(default="memory-service", env="SERVICE_NAME")
    PORT: int = Field(default=8001, env="PORT")
    DEBUG: bool = Field(default=False, env="DEBUG")
    
    # Database Configuration (PostgreSQL)
    POSTGRES_HOST: str = Field(env="POSTGRES_HOST", default="postgres")
    POSTGRES_PORT: int = Field(env="POSTGRES_PORT", default=5432)
    POSTGRES_USER: str = Field(env="POSTGRES_USER", default="app_user")
    POSTGRES_DB: str = Field(env="POSTGRES_DB", default="ai_workflow_db")
    POSTGRES_PASSWORD_FILE: str = Field(env="POSTGRES_PASSWORD_FILE", default="/run/secrets/POSTGRES_PASSWORD")
    
    # Vector Database Configuration (Qdrant)
    QDRANT_URL: str = Field(env="QDRANT_URL", default="http://qdrant:6333")
    QDRANT_API_KEY_FILE: str = Field(env="QDRANT_API_KEY_FILE", default="/run/secrets/QDRANT_API_KEY")
    QDRANT_COLLECTION_NAME: str = Field(default="memory_collection")
    
    # LLM Configuration (Ollama)
    OLLAMA_URL: str = Field(env="OLLAMA_URL", default="http://ollama:11434")
    OLLAMA_MODEL_EXTRACTION: str = Field(default="llama-3-8b-instruct")
    OLLAMA_MODEL_CURATION: str = Field(default="llama-3-8b-instruct")
    OLLAMA_MODEL_EMBEDDINGS: str = Field(default="nomic-embed-text")
    
    # Redis Configuration (for short-term memory)
    REDIS_URL: str = Field(env="REDIS_URL", default="redis://redis:6379")
    REDIS_PASSWORD_FILE: str = Field(env="REDIS_PASSWORD_FILE", default="/run/secrets/REDIS_PASSWORD")
    
    # JWT Configuration
    JWT_SECRET_KEY_FILE: str = Field(env="JWT_SECRET_KEY_FILE", default="/run/secrets/JWT_SECRET_KEY")
    JWT_ALGORITHM: str = Field(default="HS256")
    JWT_EXPIRE_MINUTES: int = Field(default=1440)  # 24 hours
    
    # langextract Configuration
    LANGEXTRACT_MODEL: str = Field(default="llama-3-8b-instruct")
    LANGEXTRACT_MAX_TOKENS: int = Field(default=4000)
    
    # Memory Configuration
    MAX_SEMANTIC_CHUNKS: int = Field(default=1000)
    MEMORY_CLEANUP_INTERVAL_HOURS: int = Field(default=24)
    DUPLICATE_THRESHOLD: float = Field(default=0.95)
    
    # mTLS Configuration
    MTLS_ENABLED: bool = Field(env="MTLS_ENABLED", default=False)
    MTLS_CA_CERT_FILE: str = Field(env="MTLS_CA_CERT_FILE", default="/run/secrets/mtls_ca_cert")
    MTLS_CERT_FILE: str = Field(env="MTLS_CERT_FILE", default="/run/secrets/memory_service_cert_bundle") 
    MTLS_KEY_FILE: str = Field(env="MTLS_KEY_FILE", default="/run/secrets/memory_service_private_key")
    
    class Config:
        env_file = ".env"
        case_sensitive = True
    
    def get_postgres_password(self) -> str:
        """Read PostgreSQL password from file"""
        try:
            with open(self.POSTGRES_PASSWORD_FILE, 'r') as f:
                return f.read().strip()
        except FileNotFoundError:
            return os.getenv("POSTGRES_PASSWORD", "defaultpassword")
    
    def get_qdrant_api_key(self) -> Optional[str]:
        """Read Qdrant API key from file"""
        try:
            with open(self.QDRANT_API_KEY_FILE, 'r') as f:
                return f.read().strip()
        except FileNotFoundError:
            return os.getenv("QDRANT_API_KEY")
    
    def get_redis_password(self) -> Optional[str]:
        """Read Redis password from file"""
        try:
            with open(self.REDIS_PASSWORD_FILE, 'r') as f:
                return f.read().strip()
        except FileNotFoundError:
            return os.getenv("REDIS_PASSWORD")
    
    def get_jwt_secret_key(self) -> str:
        """Read JWT secret key from file"""
        try:
            with open(self.JWT_SECRET_KEY_FILE, 'r') as f:
                return f.read().strip()
        except FileNotFoundError:
            return os.getenv("JWT_SECRET_KEY", "fallback_secret_key")
    
    @property
    def database_url(self) -> str:
        """Construct database URL"""
        password = self.get_postgres_password()
        return f"postgresql+asyncpg://{self.POSTGRES_USER}:{password}@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
    
    @property
    def redis_url_with_auth(self) -> str:
        """Construct Redis URL with authentication"""
        password = self.get_redis_password()
        if password:
            redis_base = self.REDIS_URL.replace("redis://", "")
            return f"redis://:{password}@{redis_base}"
        return self.REDIS_URL


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance"""
    return Settings()