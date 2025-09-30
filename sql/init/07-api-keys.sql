-- API Keys Management Schema
-- Secure storage for scraper and enrichment service API keys
-- Uses PostgreSQL pgcrypto for encryption at rest

-- Enable pgcrypto extension for encryption
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ===========================================
-- API KEYS TABLE
-- ===========================================

-- API keys table with encryption support
CREATE TABLE IF NOT EXISTS api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    service_name VARCHAR(100) NOT NULL,
    key_name VARCHAR(100) NOT NULL,
    key_value TEXT NOT NULL,  -- Encrypted value
    is_encrypted BOOLEAN DEFAULT TRUE,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by_user_id UUID,
    last_tested_at TIMESTAMP WITH TIME ZONE,
    is_valid BOOLEAN,
    test_error TEXT,
    metadata JSONB DEFAULT '{}'::JSONB,

    -- Unique constraint: one key per service/key_name combination
    CONSTRAINT unique_service_key UNIQUE (service_name, key_name)
);

-- Indexes for efficient queries
CREATE INDEX idx_api_keys_service_name ON api_keys(service_name);
CREATE INDEX idx_api_keys_updated_at ON api_keys(updated_at);
CREATE INDEX idx_api_keys_is_valid ON api_keys(is_valid) WHERE is_valid IS NOT NULL;
CREATE INDEX idx_api_keys_metadata ON api_keys USING gin(metadata);

-- ===========================================
-- HELPER FUNCTIONS
-- ===========================================

-- Function to encrypt and store an API key
CREATE OR REPLACE FUNCTION store_api_key(
    p_service_name VARCHAR(100),
    p_key_name VARCHAR(100),
    p_key_value TEXT,
    p_description TEXT DEFAULT NULL,
    p_encryption_secret TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_encrypted_value TEXT;
    v_key_id UUID;
    v_encryption_key TEXT;
BEGIN
    -- Use provided encryption secret or get from environment
    v_encryption_key := COALESCE(p_encryption_secret, current_setting('app.encryption_secret', true));

    -- If no encryption key available, use a default (NOT RECOMMENDED FOR PRODUCTION)
    IF v_encryption_key IS NULL OR v_encryption_key = '' THEN
        RAISE WARNING 'No encryption secret configured. Using default key (NOT SECURE FOR PRODUCTION)';
        v_encryption_key := 'songnodes_default_key_change_in_production';
    END IF;

    -- Encrypt the key value
    v_encrypted_value := encode(pgp_sym_encrypt(p_key_value, v_encryption_key), 'base64');

    -- Insert or update the API key
    INSERT INTO api_keys (service_name, key_name, key_value, description, is_encrypted)
    VALUES (p_service_name, p_key_name, v_encrypted_value, p_description, TRUE)
    ON CONFLICT (service_name, key_name)
    DO UPDATE SET
        key_value = EXCLUDED.key_value,
        description = COALESCE(EXCLUDED.description, api_keys.description),
        updated_at = CURRENT_TIMESTAMP,
        is_valid = NULL,  -- Reset validation status
        test_error = NULL
    RETURNING id INTO v_key_id;

    RETURN v_key_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to retrieve and decrypt an API key
CREATE OR REPLACE FUNCTION get_api_key(
    p_service_name VARCHAR(100),
    p_key_name VARCHAR(100),
    p_encryption_secret TEXT DEFAULT NULL
) RETURNS TEXT AS $$
DECLARE
    v_encrypted_value TEXT;
    v_decrypted_value TEXT;
    v_encryption_key TEXT;
BEGIN
    -- Get the encrypted value
    SELECT key_value INTO v_encrypted_value
    FROM api_keys
    WHERE service_name = p_service_name
      AND key_name = p_key_name
      AND is_encrypted = TRUE;

    IF v_encrypted_value IS NULL THEN
        RETURN NULL;
    END IF;

    -- Use provided encryption secret or get from environment
    v_encryption_key := COALESCE(p_encryption_secret, current_setting('app.encryption_secret', true));

    -- If no encryption key available, use default
    IF v_encryption_key IS NULL OR v_encryption_key = '' THEN
        v_encryption_key := 'songnodes_default_key_change_in_production';
    END IF;

    -- Decrypt the value
    v_decrypted_value := pgp_sym_decrypt(decode(v_encrypted_value, 'base64'), v_encryption_key);

    RETURN v_decrypted_value;
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'Failed to decrypt API key for %.%: %', p_service_name, p_key_name, SQLERRM;
        RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get masked API key (for display purposes)
CREATE OR REPLACE FUNCTION get_masked_api_key(
    p_service_name VARCHAR(100),
    p_key_name VARCHAR(100)
) RETURNS TEXT AS $$
DECLARE
    v_decrypted_value TEXT;
    v_masked_value TEXT;
BEGIN
    -- Get decrypted value
    v_decrypted_value := get_api_key(p_service_name, p_key_name);

    IF v_decrypted_value IS NULL THEN
        RETURN NULL;
    END IF;

    -- Mask all but last 4 characters
    IF length(v_decrypted_value) <= 4 THEN
        v_masked_value := repeat('*', length(v_decrypted_value));
    ELSE
        v_masked_value := repeat('*', length(v_decrypted_value) - 4) || right(v_decrypted_value, 4);
    END IF;

    RETURN v_masked_value;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update API key test result
CREATE OR REPLACE FUNCTION update_api_key_test_result(
    p_service_name VARCHAR(100),
    p_key_name VARCHAR(100),
    p_is_valid BOOLEAN,
    p_test_error TEXT DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
    UPDATE api_keys
    SET
        is_valid = p_is_valid,
        last_tested_at = CURRENT_TIMESTAMP,
        test_error = p_test_error,
        updated_at = CURRENT_TIMESTAMP
    WHERE service_name = p_service_name
      AND key_name = p_key_name;
END;
$$ LANGUAGE plpgsql;

-- ===========================================
-- PREDEFINED SERVICE CONFIGURATIONS
-- ===========================================

-- Create a view for service key requirements
CREATE OR REPLACE VIEW api_key_requirements AS
SELECT
    'spotify' AS service_name,
    'client_id' AS key_name,
    'Spotify Client ID' AS display_name,
    'OAuth client ID from Spotify Developer Dashboard' AS description,
    TRUE AS required,
    'https://developer.spotify.com/dashboard' AS documentation_url,
    1 AS display_order
UNION ALL
SELECT
    'spotify', 'client_secret', 'Spotify Client Secret',
    'OAuth client secret from Spotify Developer Dashboard',
    TRUE, 'https://developer.spotify.com/dashboard', 2
UNION ALL
SELECT
    'discogs', 'token', 'Discogs Personal Access Token',
    'Personal access token from Discogs settings',
    TRUE, 'https://www.discogs.com/settings/developers', 3
UNION ALL
SELECT
    'lastfm', 'api_key', 'Last.fm API Key',
    'API key from Last.fm API account',
    FALSE, 'https://www.last.fm/api/account/create', 4
UNION ALL
SELECT
    'beatport', 'api_key', 'Beatport API Key',
    'API key for Beatport access (if available)',
    FALSE, 'https://www.beatport.com/', 5
UNION ALL
SELECT
    'musicbrainz', 'user_agent', 'MusicBrainz User-Agent',
    'User-Agent string for MusicBrainz API (format: AppName/Version)',
    TRUE, 'https://musicbrainz.org/doc/MusicBrainz_API', 6
UNION ALL
SELECT
    'youtube', 'api_key', 'YouTube Data API Key',
    'API key from Google Cloud Console for YouTube Data API',
    TRUE, 'https://console.cloud.google.com/apis/credentials', 7;

-- ===========================================
-- AUDIT LOG
-- ===========================================

-- Track API key usage and access
CREATE TABLE IF NOT EXISTS api_key_audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    api_key_id UUID NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
    action VARCHAR(50) NOT NULL,  -- 'read', 'update', 'test', 'delete'
    success BOOLEAN,
    error_message TEXT,
    accessed_by_user_id UUID,
    accessed_from_ip INET,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB DEFAULT '{}'::JSONB
);

CREATE INDEX idx_api_key_audit_log_api_key_id ON api_key_audit_log(api_key_id);
CREATE INDEX idx_api_key_audit_log_created_at ON api_key_audit_log(created_at);
CREATE INDEX idx_api_key_audit_log_action ON api_key_audit_log(action);

-- ===========================================
-- AUTOMATIC UPDATE TRIGGER
-- ===========================================

-- Trigger to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_api_keys_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_api_keys_updated_at
BEFORE UPDATE ON api_keys
FOR EACH ROW
EXECUTE FUNCTION update_api_keys_updated_at();

-- ===========================================
-- COMMENTS
-- ===========================================

COMMENT ON TABLE api_keys IS 'Encrypted storage for API keys used by scraper and enrichment services';
COMMENT ON COLUMN api_keys.key_value IS 'Encrypted API key value using pgcrypto pgp_sym_encrypt';
COMMENT ON FUNCTION store_api_key IS 'Encrypts and stores an API key. Use app.encryption_secret setting or provide encryption key.';
COMMENT ON FUNCTION get_api_key IS 'Decrypts and returns an API key value. Never expose in API responses.';
COMMENT ON FUNCTION get_masked_api_key IS 'Returns API key with all but last 4 characters masked for display.';

-- ===========================================
-- SECURITY NOTES
-- ===========================================

-- IMPORTANT: Set encryption secret in postgresql.conf or via ALTER SYSTEM:
-- ALTER SYSTEM SET app.encryption_secret = 'your-secure-random-key-here';
-- SELECT pg_reload_conf();

-- For Docker, set in docker-compose.yml environment:
-- POSTGRES_ENCRYPTION_SECRET=your-secure-random-key-here

-- Grant appropriate permissions
GRANT SELECT, INSERT, UPDATE ON api_keys TO musicdb_user;
GRANT SELECT ON api_key_requirements TO musicdb_user;
GRANT INSERT ON api_key_audit_log TO musicdb_user;
GRANT EXECUTE ON FUNCTION store_api_key TO musicdb_user;
GRANT EXECUTE ON FUNCTION get_api_key TO musicdb_user;
GRANT EXECUTE ON FUNCTION get_masked_api_key TO musicdb_user;
GRANT EXECUTE ON FUNCTION update_api_key_test_result TO musicdb_user;