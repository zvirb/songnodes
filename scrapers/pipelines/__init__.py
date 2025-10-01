"""
SongNodes Scrapy Pipelines Package

Clean separation of concerns following Scrapy Specification Section VI:

1. ValidationPipeline (Priority 100) - Validate items using Pydantic models
2. EnrichmentPipeline (Priority 200) - Enrich items with NLP fallback and fuzzy matching
3. PersistencePipeline (Priority 300) - Persist items to database with connection pooling

Usage in settings.py:
    ITEM_PIPELINES = {
        'pipelines.validation_pipeline.ValidationPipeline': 100,
        'pipelines.enrichment_pipeline.EnrichmentPipeline': 200,
        'pipelines.persistence_pipeline.PersistencePipeline': 300,
    }
"""

from .validation_pipeline import ValidationPipeline
from .enrichment_pipeline import EnrichmentPipeline
from .persistence_pipeline import PersistencePipeline

__all__ = [
    'ValidationPipeline',
    'EnrichmentPipeline',
    'PersistencePipeline',
]

__version__ = '1.0.0'
