"""
Configuration Loader for Metadata Enrichment Waterfall

Loads provider priorities and confidence thresholds from the database,
enabling dynamic reconfiguration without service restarts.
"""

import time
from typing import Dict, List, Optional, Tuple

import structlog
from sqlalchemy import text
from sqlalchemy.ext.asyncio import async_sessionmaker

logger = structlog.get_logger(__name__)


class EnrichmentConfigLoader:
    """
    Loads enrichment configuration from database

    Configuration specifies:
    - Which providers to use for each metadata field
    - Priority order (provider sequence in waterfall)
    - Confidence thresholds for each provider
    - Enabled/disabled fields

    Configuration is automatically reloaded every 5 minutes (configurable)
    to enable hot-reloading without service restarts.
    """

    def __init__(self, db_session_factory: async_sessionmaker):
        """
        Initialize configuration loader

        Args:
            db_session_factory: SQLAlchemy async session factory
        """
        self.db_session_factory = db_session_factory
        self.config: Dict[str, Dict] = {}
        self.last_reload: Optional[float] = None
        self._reload_interval = 300  # 5 minutes default

    async def load_configuration(self) -> None:
        """Load configuration from metadata_enrichment_config table"""
        try:
            async with self.db_session_factory() as session:
                result = await session.execute(
                    text("""
                        SELECT
                            metadata_field,
                            priority_1_provider, priority_1_confidence,
                            priority_2_provider, priority_2_confidence,
                            priority_3_provider, priority_3_confidence,
                            priority_4_provider, priority_4_confidence,
                            enabled,
                            last_updated
                        FROM metadata_enrichment_config
                        WHERE enabled = true
                        ORDER BY metadata_field
                    """)
                )

                rows = result.fetchall()
                new_config = {}

                for row in rows:
                    # Build priorities list (filter out NULL providers)
                    priorities = []

                    if row.priority_1_provider:
                        priorities.append((row.priority_1_provider, row.priority_1_confidence))

                    if row.priority_2_provider:
                        priorities.append((row.priority_2_provider, row.priority_2_confidence))

                    if row.priority_3_provider:
                        priorities.append((row.priority_3_provider, row.priority_3_confidence))

                    if row.priority_4_provider:
                        priorities.append((row.priority_4_provider, row.priority_4_confidence))

                    new_config[row.metadata_field] = {
                        'priorities': priorities,
                        'enabled': row.enabled,
                        'last_updated': row.last_updated
                    }

                self.config = new_config
                self.last_reload = time.time()

                logger.info(
                    "Configuration loaded successfully",
                    fields_configured=len(new_config),
                    total_providers=sum(len(cfg['priorities']) for cfg in new_config.values())
                )

        except Exception as e:
            logger.error(
                "Failed to load enrichment configuration from database",
                error=str(e),
                exc_info=True
            )
            raise

    async def reload_if_stale(self, max_age_seconds: Optional[int] = None) -> bool:
        """
        Reload configuration if older than max_age_seconds

        Args:
            max_age_seconds: Maximum age in seconds (default: 300 = 5 minutes)

        Returns:
            True if configuration was reloaded, False otherwise
        """
        max_age = max_age_seconds or self._reload_interval

        if not self.last_reload or (time.time() - self.last_reload) > max_age:
            logger.debug("Configuration is stale, reloading...")
            await self.load_configuration()
            return True

        return False

    def get_providers_for_field(self, field_name: str) -> List[Tuple[str, float]]:
        """
        Get ordered list of (provider, confidence) for a metadata field

        Args:
            field_name: Metadata field name (e.g., 'spotify_id', 'isrc', 'bpm')

        Returns:
            List of (provider_name, confidence_score) tuples in priority order
            Empty list if field not configured or disabled
        """
        config = self.config.get(field_name, {})
        priorities = config.get('priorities', [])

        # Filter out None providers (already done in load_configuration, but defensive)
        return [(p, c) for p, c in priorities if p is not None and c is not None]

    def get_all_configured_fields(self) -> List[str]:
        """
        Get list of all configured metadata fields

        Returns:
            List of field names that have active configurations
        """
        return list(self.config.keys())

    def is_field_enabled(self, field_name: str) -> bool:
        """
        Check if a metadata field is enabled for enrichment

        Args:
            field_name: Metadata field name

        Returns:
            True if field is enabled, False otherwise
        """
        config = self.config.get(field_name, {})
        return config.get('enabled', False)

    def set_reload_interval(self, seconds: int) -> None:
        """
        Set configuration reload interval

        Args:
            seconds: Reload interval in seconds
        """
        if seconds < 60:
            logger.warning(
                "Reload interval too low, setting to minimum of 60 seconds",
                requested=seconds
            )
            seconds = 60

        self._reload_interval = seconds
        logger.info("Configuration reload interval updated", interval_seconds=seconds)

    async def force_reload(self) -> None:
        """Force immediate configuration reload"""
        logger.info("Forcing configuration reload")
        await self.load_configuration()

    def get_config_summary(self) -> Dict:
        """
        Get summary of current configuration

        Returns:
            Dictionary with configuration statistics
        """
        return {
            'total_fields': len(self.config),
            'last_reload': self.last_reload,
            'reload_interval_seconds': self._reload_interval,
            'fields': {
                field: {
                    'enabled': cfg['enabled'],
                    'provider_count': len(cfg['priorities']),
                    'providers': [p for p, _ in cfg['priorities']],
                    'last_updated': cfg['last_updated'].isoformat() if cfg.get('last_updated') else None
                }
                for field, cfg in self.config.items()
            }
        }
