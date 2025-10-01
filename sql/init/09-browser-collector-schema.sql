-- Browser Automation Data Collector Schema
-- Stores raw collected data and tracks browser automation sessions

-- Raw collected data storage table
CREATE TABLE IF NOT EXISTS raw_collected_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    collection_session_id UUID NOT NULL,
    source_url TEXT NOT NULL,
    collected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Raw content storage
    raw_html TEXT,  -- Complete HTML if available
    raw_text TEXT,  -- Extracted text content
    raw_json JSONB, -- Structured data if extracted

    -- Metadata
    page_title TEXT,
    content_type VARCHAR(100),
    http_status_code INTEGER,
    collection_method VARCHAR(50), -- 'browser_automation', 'api', 'scraping'

    -- Browser interaction metadata
    interactions_performed JSONB, -- Log of clicks, typing, scrolls
    screenshots JSONB, -- Array of screenshot paths/URLs

    -- Processing status
    processing_status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
    extraction_status VARCHAR(50) DEFAULT 'pending',
    extracted_at TIMESTAMP WITH TIME ZONE,

    -- LLM extraction results
    llm_extracted_data JSONB,
    llm_model_used VARCHAR(100),
    llm_extraction_prompt TEXT,
    llm_confidence_score FLOAT,

    -- Performance metrics
    collection_duration_ms INTEGER,
    page_load_time_ms INTEGER,
    total_interactions INTEGER DEFAULT 0,

    -- Error tracking
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,

    CONSTRAINT fk_collection_session FOREIGN KEY (collection_session_id)
        REFERENCES collection_sessions(id) ON DELETE CASCADE
);

-- Collection sessions table - tracks browser automation sessions
CREATE TABLE IF NOT EXISTS collection_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_name VARCHAR(255) NOT NULL,
    collector_type VARCHAR(100) NOT NULL, -- 'music_discovery', 'tracklist_finder', 'artist_info', etc.

    -- Session metadata
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(50) DEFAULT 'active', -- 'active', 'completed', 'failed', 'cancelled'

    -- Browser configuration
    browser_type VARCHAR(50) DEFAULT 'chromium', -- 'chromium', 'firefox', 'webkit'
    headless BOOLEAN DEFAULT false, -- false = visible browser for human-like behavior
    user_agent TEXT,
    viewport_width INTEGER DEFAULT 1920,
    viewport_height INTEGER DEFAULT 1080,

    -- Search/collection parameters
    search_queries JSONB, -- Array of queries to search
    target_websites JSONB, -- Array of target URLs/domains
    collection_strategy JSONB, -- Instructions for what to collect

    -- Results
    total_pages_visited INTEGER DEFAULT 0,
    total_items_collected INTEGER DEFAULT 0,
    successful_extractions INTEGER DEFAULT 0,
    failed_extractions INTEGER DEFAULT 0,

    -- Performance
    total_duration_ms INTEGER,
    average_page_load_ms INTEGER,

    -- Error tracking
    errors JSONB,
    last_error TEXT,

    created_by VARCHAR(100),
    correlation_id VARCHAR(100)
);

-- Ollama extraction jobs - tracks LLM extraction tasks
CREATE TABLE IF NOT EXISTS ollama_extraction_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    raw_data_id UUID NOT NULL,

    -- Job metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'running', 'completed', 'failed'

    -- Ollama configuration
    model_name VARCHAR(100) NOT NULL, -- 'llama3.2:3b', 'mistral', 'phi3', etc.
    extraction_type VARCHAR(100) NOT NULL, -- 'tracklist', 'artist_info', 'event_details', etc.
    prompt_template TEXT NOT NULL,

    -- Input data
    input_text TEXT,
    input_context JSONB, -- Additional context for extraction

    -- Results
    extracted_data JSONB,
    confidence_score FLOAT,
    tokens_processed INTEGER,

    -- Performance
    processing_time_ms INTEGER,
    retry_count INTEGER DEFAULT 0,

    -- Error tracking
    error_message TEXT,

    CONSTRAINT fk_raw_data FOREIGN KEY (raw_data_id)
        REFERENCES raw_collected_data(id) ON DELETE CASCADE
);

-- Browser interaction logs - detailed logging of all interactions
CREATE TABLE IF NOT EXISTS browser_interaction_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    collection_session_id UUID NOT NULL,
    raw_data_id UUID,

    -- Interaction details
    occurred_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    interaction_type VARCHAR(50) NOT NULL, -- 'click', 'type', 'scroll', 'navigate', 'wait', 'screenshot'

    -- Target element
    element_selector TEXT,
    element_text TEXT,
    element_attributes JSONB,

    -- Interaction data
    interaction_data JSONB, -- e.g., text typed, coordinates clicked, scroll position

    -- Timing
    duration_ms INTEGER,
    wait_before_ms INTEGER, -- Human-like delay before action
    wait_after_ms INTEGER,  -- Human-like delay after action

    -- Success tracking
    success BOOLEAN DEFAULT true,
    error_message TEXT,

    -- Screenshot reference
    screenshot_path TEXT,

    CONSTRAINT fk_session FOREIGN KEY (collection_session_id)
        REFERENCES collection_sessions(id) ON DELETE CASCADE,
    CONSTRAINT fk_raw_data_log FOREIGN KEY (raw_data_id)
        REFERENCES raw_collected_data(id) ON DELETE SET NULL
);

-- Collector templates - reusable collection strategies
CREATE TABLE IF NOT EXISTS collector_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,

    -- Target configuration
    target_websites JSONB NOT NULL, -- Array of domains/URLs this template works with
    collector_type VARCHAR(100) NOT NULL,

    -- Navigation strategy
    navigation_steps JSONB NOT NULL, -- Ordered array of steps to perform

    -- Extraction configuration
    data_selectors JSONB, -- CSS/XPath selectors for data extraction
    ollama_extraction_config JSONB, -- Model, prompt template, etc.

    -- Behavior configuration
    human_like_delays JSONB, -- Min/max delays for various actions
    scroll_behavior JSONB,
    interaction_patterns JSONB,

    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by VARCHAR(100),
    version INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT true,

    -- Usage stats
    total_uses INTEGER DEFAULT 0,
    success_rate FLOAT,
    average_duration_ms INTEGER
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_raw_collected_data_session ON raw_collected_data(collection_session_id);
CREATE INDEX IF NOT EXISTS idx_raw_collected_data_url ON raw_collected_data(source_url);
CREATE INDEX IF NOT EXISTS idx_raw_collected_data_status ON raw_collected_data(processing_status, extraction_status);
CREATE INDEX IF NOT EXISTS idx_raw_collected_data_collected_at ON raw_collected_data(collected_at DESC);

CREATE INDEX IF NOT EXISTS idx_collection_sessions_status ON collection_sessions(status);
CREATE INDEX IF NOT EXISTS idx_collection_sessions_started ON collection_sessions(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_collection_sessions_type ON collection_sessions(collector_type);

CREATE INDEX IF NOT EXISTS idx_ollama_jobs_status ON ollama_extraction_jobs(status);
CREATE INDEX IF NOT EXISTS idx_ollama_jobs_raw_data ON ollama_extraction_jobs(raw_data_id);
CREATE INDEX IF NOT EXISTS idx_ollama_jobs_created ON ollama_extraction_jobs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_interaction_logs_session ON browser_interaction_logs(collection_session_id);
CREATE INDEX IF NOT EXISTS idx_interaction_logs_occurred ON browser_interaction_logs(occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_collector_templates_active ON collector_templates(is_active, collector_type);

-- GIN index for JSONB queries
CREATE INDEX IF NOT EXISTS idx_raw_collected_data_json ON raw_collected_data USING gin(llm_extracted_data);
CREATE INDEX IF NOT EXISTS idx_ollama_jobs_data ON ollama_extraction_jobs USING gin(extracted_data);
CREATE INDEX IF NOT EXISTS idx_collection_sessions_queries ON collection_sessions USING gin(search_queries);

COMMENT ON TABLE raw_collected_data IS 'Stores raw data collected via browser automation before LLM extraction';
COMMENT ON TABLE collection_sessions IS 'Tracks browser automation collection sessions';
COMMENT ON TABLE ollama_extraction_jobs IS 'Manages Ollama LLM extraction jobs for raw data';
COMMENT ON TABLE browser_interaction_logs IS 'Detailed logs of all browser interactions for debugging and optimization';
COMMENT ON TABLE collector_templates IS 'Reusable collection strategies for different websites and data types';
