-- Migration 260_scrape_window_down.sql (DS24B)
-- Removes the window; the hourly target scrape then runs every day again.

DROP TABLE IF EXISTS scrape_window;
