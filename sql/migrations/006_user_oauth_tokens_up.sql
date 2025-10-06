-- Migration: Add user_oauth_tokens table for OAuth token storage
-- Version: 006
-- Description: Enables enrichment service to use user OAuth tokens for enhanced API access
-- Date: 2025-10-06

-- ===========================================
-- USER OAUTH TOKENS TABLE
-- ===========================================

-- Store user OAuth tokens for enrichment service to use
-- Enables access to enhanced API features (e.g., Spotify audio features)
CREATE TABLE IF NOT EXISTS user_oauth_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    service VARCHAR(50) NOT NULL,  -- 'spotify', 'tidal', etc.
    user_id VARCHAR(100) NOT NULL,  -- User identifier (currently 'default_user' for single-user mode)
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    token_type VARCHAR(50) DEFAULT 'Bearer',
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    scope TEXT,  -- Space-separated list of granted scopes
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- One token set per user per service
    CONSTRAINT unique_user_service UNIQUE (service, user_id)
);

-- Indexes for efficient token lookup
CREATE INDEX IF NOT EXISTS idx_user_oauth_tokens_service ON user_oauth_tokens(service);
CREATE INDEX IF NOT EXISTS idx_user_oauth_tokens_user_id ON user_oauth_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_user_oauth_tokens_expires_at ON user_oauth_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_user_oauth_tokens_service_user ON user_oauth_tokens(service, user_id) WHERE expires_at > CURRENT_TIMESTAMP;

-- Trigger to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_user_oauth_tokens_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_user_oauth_tokens_updated_at ON user_oauth_tokens;
CREATE TRIGGER trigger_update_user_oauth_tokens_updated_at
BEFORE UPDATE ON user_oauth_tokens
FOR EACH ROW
EXECUTE FUNCTION update_user_oauth_tokens_updated_at();

-- View to show token status without exposing sensitive data
CREATE OR REPLACE VIEW user_oauth_tokens_status AS
SELECT
    id,
    service,
    user_id,
    LEFT(access_token, 10) || '...' || RIGHT(access_token, 4) AS access_token_masked,
    CASE WHEN refresh_token IS NOT NULL THEN 'Yes' ELSE 'No' END AS has_refresh_token,
    token_type,
    expires_at,
    CASE
        WHEN expires_at > CURRENT_TIMESTAMP THEN 'valid'
        ELSE 'expired'
    END AS status,
    EXTRACT(EPOCH FROM (expires_at - CURRENT_TIMESTAMP)) AS seconds_until_expiry,
    scope,
    created_at,
    updated_at
FROM user_oauth_tokens
ORDER BY service, user_id;

-- Function to check if a valid token exists
CREATE OR REPLACE FUNCTION has_valid_oauth_token(
    p_service VARCHAR(50),
    p_user_id VARCHAR(100) DEFAULT 'default_user'
) RETURNS BOOLEAN AS $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_count
    FROM user_oauth_tokens
    WHERE service = p_service
      AND user_id = p_user_id
      AND expires_at > CURRENT_TIMESTAMP;

    RETURN v_count > 0;
END;
$$ LANGUAGE plpgsql;

-- Function to get token expiry time
CREATE OR REPLACE FUNCTION get_oauth_token_expiry(
    p_service VARCHAR(50),
    p_user_id VARCHAR(100) DEFAULT 'default_user'
) RETURNS TIMESTAMP WITH TIME ZONE AS $$
DECLARE
    v_expires_at TIMESTAMP WITH TIME ZONE;
BEGIN
    SELECT expires_at INTO v_expires_at
    FROM user_oauth_tokens
    WHERE service = p_service
      AND user_id = p_user_id
    ORDER BY expires_at DESC
    LIMIT 1;

    RETURN v_expires_at;
END;
$$ LANGUAGE plpgsql;

-- Function to clean up expired tokens (run periodically)
CREATE OR REPLACE FUNCTION cleanup_expired_oauth_tokens()
RETURNS INTEGER AS $$
DECLARE
    v_deleted_count INTEGER;
BEGIN
    -- Delete tokens expired more than 30 days ago
    DELETE FROM user_oauth_tokens
    WHERE expires_at < CURRENT_TIMESTAMP - INTERVAL '30 days';

    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

    RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Comments for documentation
COMMENT ON TABLE user_oauth_tokens IS 'User OAuth tokens for enrichment service API access (Spotify audio features, etc.)';
COMMENT ON COLUMN user_oauth_tokens.access_token IS 'OAuth access token - stored in plain text (consider encryption for production)';
COMMENT ON COLUMN user_oauth_tokens.refresh_token IS 'OAuth refresh token for obtaining new access tokens';
COMMENT ON COLUMN user_oauth_tokens.scope IS 'Space-separated list of granted OAuth scopes';
COMMENT ON FUNCTION has_valid_oauth_token IS 'Check if a valid (non-expired) OAuth token exists for user and service';
COMMENT ON FUNCTION cleanup_expired_oauth_tokens IS 'Remove tokens expired more than 30 days ago (run via cron job)';

-- Grant permissions for OAuth tokens table
GRANT SELECT, INSERT, UPDATE, DELETE ON user_oauth_tokens TO musicdb_user;
GRANT SELECT ON user_oauth_tokens_status TO musicdb_user;
GRANT EXECUTE ON FUNCTION has_valid_oauth_token TO musicdb_user;
GRANT EXECUTE ON FUNCTION get_oauth_token_expiry TO musicdb_user;
GRANT EXECUTE ON FUNCTION cleanup_expired_oauth_tokens TO musicdb_user;

-- Success message
DO $$
BEGIN
    RAISE NOTICE '✅ Migration 006: user_oauth_tokens table created successfully';
END $$;
