-- Migration Rollback: Remove user_oauth_tokens table
-- Version: 006
-- Description: Rollback OAuth token storage functionality
-- Date: 2025-10-06

-- Drop view
DROP VIEW IF EXISTS user_oauth_tokens_status CASCADE;

-- Drop functions
DROP FUNCTION IF EXISTS has_valid_oauth_token(VARCHAR, VARCHAR);
DROP FUNCTION IF EXISTS get_oauth_token_expiry(VARCHAR, VARCHAR);
DROP FUNCTION IF EXISTS cleanup_expired_oauth_tokens();
DROP FUNCTION IF EXISTS update_user_oauth_tokens_updated_at();

-- Drop table
DROP TABLE IF EXISTS user_oauth_tokens CASCADE;

-- Success message
DO $$
BEGIN
    RAISE NOTICE '✅ Migration 006 rollback: user_oauth_tokens removed successfully';
END $$;
