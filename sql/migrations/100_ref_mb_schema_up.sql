-- Migration 100_ref_mb_schema_up.sql

-- NO-OP: The ref_mb schema and tables have been moved to a separate database.
-- The app database must NOT create ref_mb tables.
-- For details on this decision, the fallback database, and the reload procedure,
-- please see docs/integration/ref_mb/DECISION.md
