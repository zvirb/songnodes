-- ============================================================================
-- Rollback Migration: 004 - Waterfall Configuration
-- Description: Drop all waterfall configuration tables, views, and functions
-- ============================================================================

-- Drop function
DROP FUNCTION IF EXISTS get_provider_priority(TEXT, TEXT[]);

-- Drop view
DROP VIEW IF EXISTS enrichment_waterfall_summary CASCADE;

-- Drop tables in reverse order
DROP TABLE IF EXISTS provider_performance_history CASCADE;
DROP TABLE IF EXISTS metadata_enrichment_config CASCADE;
DROP TABLE IF EXISTS enrichment_providers CASCADE;
