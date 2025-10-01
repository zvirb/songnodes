"""
Settings package for SongNodes Scrapy project.

Environment-aware settings with proper isolation:
- base.py: Core, environment-agnostic settings
- development.py: Local development overrides
- production.py: Production deployment configuration

Usage:
    export SCRAPY_SETTINGS_MODULE=settings.development
    export SCRAPY_SETTINGS_MODULE=settings.production
"""
