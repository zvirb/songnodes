# Container Architecture Design

## Overview
Following the orchestration workflow principles, each service runs in an isolated container with non-standard ports to avoid conflicts.

## Container Services & Port Mapping

### 1. Database Layer

#### PostgreSQL Primary (musicdb-postgres)
- **Port:** 5433 (instead of standard 5432)
- **Purpose:** Primary database for music data
- **Features:**
  - Persistent volume for data
  - Automated backups
  - Read replicas support

#### Redis Cache (musicdb-redis)
- **Port:** 6380 (instead of standard 6379)
- **Purpose:** Caching layer and job queue
- **Features:**
  - Session storage
  - Scraping job queue
  - Rate limiting data

### 2. Scraping Services

#### Scraper Orchestrator (scraper-orchestrator)
- **Port:** 8001
- **Purpose:** Coordinate scraping tasks
- **Features:**
  - Job scheduling
  - Worker management
  - Rate limit enforcement

#### 1001Tracklists Scraper (scraper-1001tracklists)
- **Port:** 8011
- **Purpose:** Dedicated 1001tracklists.com scraping
- **Features:**
  - Dynamic content handling
  - Mashup parsing
  - Artist extraction

#### MixesDB Scraper (scraper-mixesdb)
- **Port:** 8012
- **Purpose:** MixesDB.com data extraction
- **Features:**
  - Mix metadata extraction
  - Tracklist parsing
  - Update detection

#### Setlist.fm Scraper (scraper-setlistfm)
- **Port:** 8013
- **Purpose:** Concert setlist extraction
- **Features:**
  - Concert metadata
  - Cover song detection
  - Venue information

#### Reddit Scraper (scraper-reddit)
- **Port:** 8014
- **Purpose:** Reddit music content extraction
- **Features:**
  - NLP processing
  - Sentiment analysis
  - Thread monitoring

#### Apple Music Scraper (scraper-applemusic)
- **Port:** 8015
- **Purpose:** Apple Music playlist extraction
- **Features:**
  - Playlist metadata
  - Track information
  - Curator data

#### WatchTheDJ Scraper (scraper-watchthedj)
- **Port:** 8016
- **Purpose:** DJ performance video data
- **Features:**
  - Video metadata
  - Performance analytics
  - DJ information

### 3. Data Processing Services

#### Transform Service (data-transformer)
- **Port:** 8020
- **Purpose:** Data normalization and transformation
- **Features:**
  - Artist name normalization
  - Track deduplication
  - Mashup component extraction
  - Genre classification

#### NLP Service (nlp-processor)
- **Port:** 8021
- **Purpose:** Natural language processing
- **Features:**
  - Entity extraction
  - Sentiment analysis
  - Text classification
  - Language detection

#### Validation Service (data-validator)
- **Port:** 8022
- **Purpose:** Data quality assurance
- **Features:**
  - Schema validation
  - Duplicate detection
  - Consistency checks
  - Error reporting

### 4. API Layer

#### API Gateway (api-gateway)
- **Port:** 8080
- **Purpose:** Central API entry point
- **Features:**
  - Request routing
  - Authentication
  - Rate limiting
  - Load balancing

#### GraphQL Service (graphql-api)
- **Port:** 8081
- **Purpose:** GraphQL API endpoint
- **Features:**
  - Flexible queries
  - Real-time subscriptions
  - Schema introspection

#### REST API Service (rest-api)
- **Port:** 8082
- **Purpose:** RESTful API endpoint
- **Features:**
  - CRUD operations
  - Pagination
  - Filtering
  - Sorting

#### WebSocket Service (websocket-api)
- **Port:** 8083
- **Purpose:** Real-time updates
- **Features:**
  - Live scraping status
  - Data stream updates
  - Push notifications

### 5. Monitoring & Operations

#### Prometheus (metrics-prometheus)
- **Port:** 9091 (instead of standard 9090)
- **Purpose:** Metrics collection
- **Features:**
  - Service metrics
  - Custom metrics
  - Alert rules

#### Grafana (monitoring-grafana)
- **Port:** 3001 (instead of standard 3000)
- **Purpose:** Visualization dashboard
- **Features:**
  - Real-time dashboards
  - Alert management
  - Custom panels

#### Elasticsearch (logging-elasticsearch)
- **Port:** 9201 (instead of standard 9200)
- **Purpose:** Log aggregation
- **Features:**
  - Centralized logging
  - Full-text search
  - Log retention

#### Kibana (logging-kibana)
- **Port:** 5602 (instead of standard 5601)
- **Purpose:** Log visualization
- **Features:**
  - Log analysis
  - Search interface
  - Dashboard creation

### 6. Support Services

#### Nginx Reverse Proxy (nginx-proxy)
- **Port:** 8443 (HTTPS), 8080 (HTTP)
- **Purpose:** Request routing and SSL termination
- **Features:**
  - SSL/TLS termination
  - Load balancing
  - Static file serving
  - Compression

#### RabbitMQ (message-broker)
- **Port:** 5673 (instead of standard 5672)
- **Management Port:** 15673 (instead of 15672)
- **Purpose:** Message queuing
- **Features:**
  - Task distribution
  - Event streaming
  - Dead letter queues

#### MinIO (object-storage)
- **Port:** 9001 (Console), 9000 (API)
- **Purpose:** Object storage for scraped content
- **Features:**
  - Binary data storage
  - Backup storage
  - Static asset serving

## Network Configuration

### Networks

#### musicdb-backend
- **Type:** Bridge network
- **Subnet:** 172.28.0.0/16
- **Purpose:** Backend service communication

#### musicdb-frontend
- **Type:** Bridge network
- **Subnet:** 172.29.0.0/16
- **Purpose:** Frontend service communication

#### musicdb-monitoring
- **Type:** Bridge network
- **Subnet:** 172.30.0.0/16
- **Purpose:** Monitoring service communication

## Volume Mounts

### Persistent Volumes

```yaml
volumes:
  postgres-data:
    driver: local
    driver_opts:
      type: none
      device: /data/musicdb/postgres
      o: bind
  
  redis-data:
    driver: local
    driver_opts:
      type: none
      device: /data/musicdb/redis
      o: bind
  
  elasticsearch-data:
    driver: local
    driver_opts:
      type: none
      device: /data/musicdb/elasticsearch
      o: bind
  
  minio-data:
    driver: local
    driver_opts:
      type: none
      device: /data/musicdb/minio
      o: bind
```

## Health Checks

All containers implement health checks:

```yaml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:PORT/health"]
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 40s
```

## Resource Limits

### CPU and Memory Limits

```yaml
deploy:
  resources:
    limits:
      cpus: '2.0'
      memory: 2G
    reservations:
      cpus: '0.5'
      memory: 512M
```

## Security Considerations

1. **Non-root users:** All containers run as non-root users
2. **Read-only filesystems:** Where possible, containers use read-only root filesystems
3. **Network isolation:** Services only expose necessary ports
4. **Secret management:** Using Docker secrets for sensitive data
5. **TLS/SSL:** All external communication encrypted

## Scaling Strategy

### Horizontal Scaling
- Scraper services: Scale based on queue depth
- API services: Scale based on request rate
- Transform services: Scale based on processing backlog

### Vertical Scaling
- Database: Scale up for better performance
- Elasticsearch: Scale up for faster indexing
- Redis: Scale up for larger cache

## Deployment Environments

### Development
- All services on single host
- Reduced resource limits
- Debug logging enabled

### Staging
- Multi-host deployment
- Production-like configuration
- Performance testing enabled

### Production
- Multi-region deployment
- High availability configuration
- Full monitoring and alerting