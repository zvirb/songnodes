"""
Integration tests for SongNodes enrichment architecture.

Tests verify:
- Medallion architecture (Bronze -> Silver -> Gold)
- Dead-Letter Queue (DLQ) failure handling
- API Integration Gateway (rate limiting, caching, circuit breaker)
- Configuration-driven waterfall enrichment
- Metrics and observability
"""
