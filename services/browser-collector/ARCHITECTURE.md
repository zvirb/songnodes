# Browser Collector Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Browser Collector Service                        │
│                              (Port 8030)                                 │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    │               │               │
                    ▼               ▼               ▼
    ┌───────────────────┐  ┌─────────────┐  ┌──────────────┐
    │ FastAPI           │  │ PostgreSQL  │  │ Ollama LLM   │
    │ REST API          │  │ Database    │  │ Service      │
    │                   │  │             │  │              │
    │ • /collect        │  │ • Sessions  │  │ • llama3.2   │
    │ • /extract        │  │ • Raw data  │  │ • mistral    │
    │ • /health         │  │ • Extracts  │  │ • phi3       │
    │ • /metrics        │  │ • Logs      │  │              │
    └─────┬─────────────┘  └──────┬──────┘  └──────┬───────┘
          │                       │                │
          │                       │                │
          ▼                       ▼                ▼
```

## Component Architecture

### 1. HTTP Layer (FastAPI)

```
┌──────────────────────────────────────────────────────────┐
│                    FastAPI Application                    │
├──────────────────────────────────────────────────────────┤
│                                                           │
│  POST /collect                                            │
│  ┌─────────────────────────────────────────────────────┐ │
│  │ 1. Validate request                                  │ │
│  │ 2. Create database session                           │ │
│  │ 3. Initialize browser navigator                      │ │
│  │ 4. Execute collection                                │ │
│  │ 5. Store raw data                                    │ │
│  │ 6. Trigger extraction (if auto_extract=true)         │ │
│  │ 7. Return results                                    │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                           │
│  POST /extract/{raw_data_id}                              │
│  ┌─────────────────────────────────────────────────────┐ │
│  │ 1. Fetch raw data from database                      │ │
│  │ 2. Call Ollama extractor                             │ │
│  │ 3. Save extraction results                           │ │
│  │ 4. Return extracted data                             │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                           │
└──────────────────────────────────────────────────────────┘
```

### 2. Browser Automation Layer

```
┌──────────────────────────────────────────────────────────┐
│              HumanBrowserNavigator                        │
├──────────────────────────────────────────────────────────┤
│                                                           │
│  ┌───────────────┐         ┌──────────────┐             │
│  │  Playwright   │────────>│  Chrome/     │             │
│  │  Controller   │         │  Firefox/    │             │
│  │               │<────────│  WebKit      │             │
│  └───────────────┘         └──────────────┘             │
│         │                                                │
│         │ Controls                                       │
│         ▼                                                │
│  ┌─────────────────────────────────────────────────────┐│
│  │         Navigation & Interaction Engine             ││
│  ├─────────────────────────────────────────────────────┤│
│  │ • navigate(url)                                      ││
│  │ • click(selector) + human delays                     ││
│  │ • type(selector, text) + char-by-char               ││
│  │ • scroll(direction, amount) + smooth delays          ││
│  │ • wait_for_selector(selector, timeout)               ││
│  │ • take_screenshot(name)                              ││
│  │                                                      ││
│  │ Human-like Timing:                                   ││
│  │ • Typing: 100-300ms per character                    ││
│  │ • Clicks: 100-400ms before/after                     ││
│  │ • Scrolls: 500-1500ms delays                         ││
│  │ • Page loads: 1000-3000ms waits                      ││
│  └─────────────────────────────────────────────────────┘│
│                                                           │
│  Output:                                                  │
│  ┌─────────────────────────────────────────────────────┐│
│  │ CollectionResult {                                   ││
│  │   raw_html: "...",                                   ││
│  │   raw_text: "...",                                   ││
│  │   screenshots: ["path1.png", "path2.png"],           ││
│  │   interactions: [InteractionLog, ...],               ││
│  │   metrics: {...}                                     ││
│  │ }                                                    ││
│  └─────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────┘
```

### 3. LLM Extraction Layer

```
┌──────────────────────────────────────────────────────────┐
│                 OllamaExtractor                           │
├──────────────────────────────────────────────────────────┤
│                                                           │
│  ┌─────────────────────────────────────────────────────┐ │
│  │           Prompt Template Selection                  │ │
│  ├─────────────────────────────────────────────────────┤ │
│  │ • Tracklist Extraction                               │ │
│  │ • Artist Info Extraction                             │ │
│  │ • Event Info Extraction                              │ │
│  │ • Music Metadata Extraction                          │ │
│  │ • Custom Prompts                                     │ │
│  └──────────────┬──────────────────────────────────────┘ │
│                 │                                         │
│                 ▼                                         │
│  ┌─────────────────────────────────────────────────────┐ │
│  │        Prompt Formatting & Truncation                │ │
│  │  • Truncate to 8000 chars max                        │ │
│  │  • Add context if provided                           │ │
│  │  • Format JSON output instructions                   │ │
│  └──────────────┬──────────────────────────────────────┘ │
│                 │                                         │
│                 ▼                                         │
│  ┌─────────────────────────────────────────────────────┐ │
│  │         Ollama API Call (with retry)                 │ │
│  │  ┌──────────────────────────────────────────────┐   │ │
│  │  │ Request:                                      │   │ │
│  │  │ {                                             │   │ │
│  │  │   "model": "llama3.2:3b",                     │   │ │
│  │  │   "prompt": "...",                            │   │ │
│  │  │   "format": "json",                           │   │ │
│  │  │   "options": {                                │   │ │
│  │  │     "temperature": 0.1,                       │   │ │
│  │  │     "top_p": 0.9                              │   │ │
│  │  │   }                                           │   │ │
│  │  │ }                                             │   │ │
│  │  └──────────────────────────────────────────────┘   │ │
│  │                                                      │ │
│  │  Retry Logic:                                        │ │
│  │  • Max 3 attempts                                    │ │
│  │  • Exponential backoff (2^n seconds)                 │ │
│  └──────────────┬──────────────────────────────────────┘ │
│                 │                                         │
│                 ▼                                         │
│  ┌─────────────────────────────────────────────────────┐ │
│  │         JSON Parsing & Validation                    │ │
│  │  • Remove markdown code blocks                       │ │
│  │  • Parse JSON                                        │ │
│  │  • Fallback regex extraction                         │ │
│  └──────────────┬──────────────────────────────────────┘ │
│                 │                                         │
│                 ▼                                         │
│  ┌─────────────────────────────────────────────────────┐ │
│  │      Confidence Score Calculation                    │ │
│  │  • Count total fields                                │ │
│  │  • Count filled fields                               │ │
│  │  • Score = filled / total                            │ │
│  └──────────────┬──────────────────────────────────────┘ │
│                 │                                         │
│                 ▼                                         │
│  ┌─────────────────────────────────────────────────────┐ │
│  │ ExtractionResult {                                   │ │
│  │   success: true,                                     │ │
│  │   extracted_data: {...},                             │ │
│  │   confidence_score: 0.85,                            │ │
│  │   tokens_processed: 1234,                            │ │
│  │   processing_time_ms: 2500                           │ │
│  │ }                                                    │ │
│  └─────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

### 4. Database Layer

```
┌──────────────────────────────────────────────────────────┐
│                  PostgreSQL Database                      │
├──────────────────────────────────────────────────────────┤
│                                                           │
│  collection_sessions                                      │
│  ┌─────────────────────────────────────────────────────┐ │
│  │ • id (UUID)                                          │ │
│  │ • session_name                                       │ │
│  │ • collector_type                                     │ │
│  │ • browser_config                                     │ │
│  │ • status (active/completed/failed)                   │ │
│  │ • metrics (duration, pages visited, etc.)            │ │
│  └──────────────┬──────────────────────────────────────┘ │
│                 │                                         │
│                 │ 1:N                                     │
│                 ▼                                         │
│  raw_collected_data                                       │
│  ┌─────────────────────────────────────────────────────┐ │
│  │ • id (UUID)                                          │ │
│  │ • collection_session_id (FK)                         │ │
│  │ • source_url                                         │ │
│  │ • raw_html (TEXT)                                    │ │
│  │ • raw_text (TEXT)                                    │ │
│  │ • screenshots (JSONB)                                │ │
│  │ • interactions_performed (JSONB)                     │ │
│  │ • processing_status                                  │ │
│  │ • llm_extracted_data (JSONB)                         │ │
│  │ • llm_confidence_score                               │ │
│  └──────────────┬──────────────────────────────────────┘ │
│                 │                                         │
│                 │ 1:N                                     │
│                 ▼                                         │
│  ollama_extraction_jobs                                   │
│  ┌─────────────────────────────────────────────────────┐ │
│  │ • id (UUID)                                          │ │
│  │ • raw_data_id (FK)                                   │ │
│  │ • model_name                                         │ │
│  │ • extraction_type                                    │ │
│  │ • prompt_template (TEXT)                             │ │
│  │ • extracted_data (JSONB)                             │ │
│  │ • confidence_score                                   │ │
│  │ • tokens_processed                                   │ │
│  │ • processing_time_ms                                 │ │
│  │ • status                                             │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                           │
│  browser_interaction_logs                                 │
│  ┌─────────────────────────────────────────────────────┐ │
│  │ • id (UUID)                                          │ │
│  │ • collection_session_id (FK)                         │ │
│  │ • interaction_type (click/type/scroll/etc)           │ │
│  │ • element_selector                                   │ │
│  │ • interaction_data (JSONB)                           │ │
│  │ • duration_ms                                        │ │
│  │ • success                                            │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                           │
│  collector_templates                                      │
│  ┌─────────────────────────────────────────────────────┐ │
│  │ • id (UUID)                                          │ │
│  │ • template_name                                      │ │
│  │ • target_websites (JSONB)                            │ │
│  │ • navigation_steps (JSONB)                           │ │
│  │ • data_selectors (JSONB)                             │ │
│  │ • ollama_extraction_config (JSONB)                   │ │
│  │ • usage_stats                                        │ │
│  └─────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

## Data Flow

### Collection Flow

```
1. API Request
   │
   ├─> POST /collect
   │   {
   │     "target_url": "https://example.com",
   │     "navigation_steps": [...],
   │     "extraction_type": "tracklist"
   │   }
   │
   ▼
2. Create Session
   │
   ├─> INSERT INTO collection_sessions (...)
   │
   ▼
3. Initialize Browser
   │
   ├─> HumanBrowserNavigator.initialize()
   │   • Launch Chrome/Firefox/WebKit
   │   • Set viewport, user-agent
   │   • Configure context
   │
   ▼
4. Navigate & Interact
   │
   ├─> navigator.navigate_and_collect(url, steps)
   │   │
   │   ├─> goto(url)
   │   │   • Wait for page load
   │   │   • Take screenshot
   │   │
   │   ├─> For each navigation step:
   │   │   ├─> click(selector)
   │   │   ├─> type(selector, text)
   │   │   ├─> scroll(direction, amount)
   │   │   ├─> wait(duration)
   │   │   └─> Log interaction
   │   │
   │   ├─> Extract page content
   │   │   • HTML source
   │   │   • Visible text
   │   │   • Page title
   │   │
   │   └─> Take final screenshot
   │
   ▼
5. Store Raw Data
   │
   ├─> INSERT INTO raw_collected_data (
   │       raw_html, raw_text, screenshots,
   │       interactions_performed, ...
   │   )
   │
   ▼
6. Extract with Ollama (if auto_extract=true)
   │
   ├─> extractor.extract_with_ollama(
   │       raw_text, extraction_type, model
   │   )
   │   │
   │   ├─> Select prompt template
   │   ├─> Format prompt + truncate
   │   ├─> Call Ollama API
   │   ├─> Parse JSON response
   │   └─> Calculate confidence
   │
   ▼
7. Store Extraction
   │
   ├─> INSERT INTO ollama_extraction_jobs (...)
   ├─> UPDATE raw_collected_data
   │       SET llm_extracted_data = ...,
   │           extraction_status = 'completed'
   │
   ▼
8. Return Results
   │
   └─> {
         "status": "completed",
         "session_id": "...",
         "collection_result": {...},
         "extraction_result": {...}
       }
```

### Re-Extraction Flow

```
1. API Request
   │
   ├─> POST /extract/{raw_data_id}
   │   {
   │     "extraction_type": "tracklist",
   │     "ollama_model": "llama3.2:3b",
   │     "custom_prompt": "..." (optional)
   │   }
   │
   ▼
2. Fetch Raw Data
   │
   ├─> SELECT raw_text, source_url
   │   FROM raw_collected_data
   │   WHERE id = raw_data_id
   │
   ▼
3. Extract with Ollama
   │
   ├─> extractor.extract_with_ollama(...)
   │
   ▼
4. Store New Extraction
   │
   ├─> INSERT INTO ollama_extraction_jobs (...)
   │
   ▼
5. Return Results
   │
   └─> {
         "success": true,
         "extracted_data": {...},
         "confidence_score": 0.87
       }
```

## Monitoring & Observability

```
┌──────────────────────────────────────────────────────────┐
│                   Prometheus Metrics                      │
├──────────────────────────────────────────────────────────┤
│                                                           │
│  Collection Metrics:                                      │
│  • collection_tasks_total{status}                         │
│  • active_collections                                     │
│  • collection_duration_seconds (histogram)                │
│                                                           │
│  Extraction Metrics:                                      │
│  • extraction_tasks_total{status}                         │
│  • extraction_duration_seconds (histogram)                │
│                                                           │
│  System Metrics:                                          │
│  • process_resident_memory_bytes                          │
│  • process_cpu_seconds_total                              │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│                   Structured Logging                      │
├──────────────────────────────────────────────────────────┤
│                                                           │
│  JSON Format:                                             │
│  {                                                        │
│    "timestamp": "2024-10-01T...",                         │
│    "level": "info",                                       │
│    "event": "collection_completed",                       │
│    "session_id": "...",                                   │
│    "correlation_id": "...",                               │
│    "duration_ms": 5234,                                   │
│    "url": "...",                                          │
│    "extraction_type": "tracklist"                         │
│  }                                                        │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│                   Database Audit Trail                    │
├──────────────────────────────────────────────────────────┤
│                                                           │
│  • Complete collection history                            │
│  • All raw data preserved                                 │
│  • Screenshot references                                  │
│  • Interaction logs                                       │
│  • Multiple extraction versions                           │
│  • Confidence scores tracked                              │
└──────────────────────────────────────────────────────────┘
```

## Deployment Architecture

```
┌───────────────────────────────────────────────────────────────────┐
│                         Docker Host                                │
├───────────────────────────────────────────────────────────────────┤
│                                                                    │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │              musicdb-backend Network                         │ │
│  │                                                              │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │ │
│  │  │ PostgreSQL   │  │ Redis        │  │ Ollama       │     │ │
│  │  │ :5432        │  │ :6379        │  │ :11434       │     │ │
│  │  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘     │ │
│  │         │                 │                 │              │ │
│  │         │                 │                 │              │ │
│  │  ┌──────┴─────────────────┴─────────────────┴───────┐     │ │
│  │  │          Browser Collector Service               │     │ │
│  │  │                :8030                              │     │ │
│  │  │                                                   │     │ │
│  │  │  • FastAPI REST API                              │     │ │
│  │  │  • Playwright + Chrome                           │     │ │
│  │  │  • Ollama Client                                 │     │ │
│  │  └──────┬─────────────────────────────────────────┬─┘     │ │
│  │         │                                          │       │ │
│  └─────────┼──────────────────────────────────────────┼───────┘ │
│            │                                          │         │
│            │                                          │         │
│  ┌─────────▼──────────┐                    ┌─────────▼───────┐ │
│  │ Host Volumes       │                    │ Prometheus      │ │
│  │                    │                    │ :9091           │ │
│  │ • screenshots/     │                    │ (scrapes :8030) │ │
│  │ • postgres/        │                    └─────────────────┘ │
│  │ • ollama/          │                                        │
│  └────────────────────┘                                        │
└───────────────────────────────────────────────────────────────────┘
```

## Security Architecture

```
┌──────────────────────────────────────────────────────────┐
│                   Security Layers                         │
├──────────────────────────────────────────────────────────┤
│                                                           │
│  1. Container Isolation                                   │
│     • Browser runs in Docker container                    │
│     • Network isolation via Docker networks               │
│     • Resource limits enforced                            │
│                                                           │
│  2. Data Privacy                                          │
│     • No external API calls for extraction                │
│     • Ollama runs locally                                 │
│     • All data stays in your infrastructure               │
│                                                           │
│  3. Secrets Management                                    │
│     • Uses centralized secrets_manager                    │
│     • Docker secrets in production                        │
│     • Environment variables in dev                        │
│                                                           │
│  4. Audit Trail                                           │
│     • Complete database logging                           │
│     • Screenshot evidence                                 │
│     • Interaction logs                                    │
│     • Structured logging with correlation IDs             │
│                                                           │
│  5. Access Control                                        │
│     • API endpoints exposed only within network           │
│     • Health check on public port                         │
│     • Metrics protected by firewall                       │
└──────────────────────────────────────────────────────────┘
```

## Performance Characteristics

```
Resource Usage (per collection):
┌─────────────────────────────┬──────────────┬──────────────┐
│ Component                   │ CPU          │ Memory       │
├─────────────────────────────┼──────────────┼──────────────┤
│ Browser (Chromium)          │ 50-100%      │ 500-800MB    │
│ FastAPI Service             │ 10-20%       │ 100-200MB    │
│ Ollama (llama3.2:3b)        │ 100-200%     │ 2-3GB        │
│ Database Operations         │ 5-10%        │ 50-100MB     │
│ TOTAL                       │ 165-330%     │ 2.7-4.1GB    │
└─────────────────────────────┴──────────────┴──────────────┘

Timing (typical):
┌─────────────────────────────┬─────────────────────────────┐
│ Operation                   │ Duration                     │
├─────────────────────────────┼─────────────────────────────┤
│ Simple page collection      │ 5-10 seconds                 │
│ Multi-step navigation       │ 15-30 seconds                │
│ Ollama extraction (3b)      │ 2-5 seconds                  │
│ Ollama extraction (7b)      │ 5-10 seconds                 │
│ Database operations         │ <100ms each                  │
│ Screenshot capture          │ 200-500ms                    │
└─────────────────────────────┴─────────────────────────────┘
```

---

This architecture provides:
✅ **Scalability** - Can run multiple instances with load balancer
✅ **Reliability** - Comprehensive error handling and retry logic
✅ **Observability** - Full metrics, logging, and database audit trail
✅ **Maintainability** - Clear separation of concerns, modular design
✅ **Security** - Containerized, local processing, complete audit trail
