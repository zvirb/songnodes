-- Migration Rollback: Remove source_url column from raw_scrape_data table
-- Date: 2025-11-17
-- Description: Removes the source_url column added in migration 003

-- Drop source_url column if it exists
ALTER TABLE raw_scrape_data
DROP COLUMN IF EXISTS source_url;
