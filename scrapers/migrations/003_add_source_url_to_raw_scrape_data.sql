-- Migration: Add source_url column to raw_scrape_data table
-- Date: 2025-11-17
-- Description: Adds source_url TEXT column to support storing the original URL
--              where the scraped data was found, used by raw_data_storage_pipeline.py

-- Add source_url column if it doesn't exist
ALTER TABLE raw_scrape_data
ADD COLUMN IF NOT EXISTS source_url TEXT;

-- Add comment to document the column
COMMENT ON COLUMN raw_scrape_data.source_url IS 'Original URL where the data was scraped from';
