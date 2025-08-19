# MusicDB Deployment Guide

## Overview
This guide provides comprehensive instructions for deploying the MusicDB scraping pipeline using Docker containers with non-standard ports following the 12-step orchestration workflow.

## Prerequisites

### System Requirements
- Docker Engine 20.10+
- Docker Compose 2.0+
- 16GB RAM minimum (32GB recommended)
- 100GB available disk space
- Ubuntu 20.04+ or similar Linux distribution

### Required API Keys
```bash
# Create .env file with your API keys
POSTGRES_PASSWORD=your_secure_password
JWT_SECRET=your_jwt_secret
SETLISTFM_API_KEY=your_setlistfm_key
REDDIT_CLIENT_ID=your_reddit_client_id
REDDIT_CLIENT_SECRET=your_reddit_client_secret
GRAFANA_PASSWORD=your_grafana_password
MINIO_ROOT_PASSWORD=your_minio_password
```

## Deployment Steps

### 1. Initial Setup

```bash
# Clone the repository
git clone https://github.com/zvirb/musicdb_scrapy.git
cd musicdb_scrapy

# Create necessary directories
mkdir -p data/{postgres,redis,elasticsearch,minio,rabbitmq}
mkdir -p logs/{scrapers,api,monitoring}
mkdir -p backups

# Set permissions
chmod -R 755 data logs backups
```

### 2. Build Docker Images

```bash
# Build all services
docker-compose build --parallel

# Or build specific services
docker-compose build scraper-1001tracklists
docker-compose build data-transformer
docker-compose build api-gateway
```

### 3. Initialize Database

```bash
# Start only PostgreSQL first
docker-compose up -d postgres

# Wait for PostgreSQL to be ready
docker-compose exec postgres pg_isready -U musicdb_user

# The schema will be automatically created from sql/init/01-schema.sql
```

### 4. Start Core Services

```bash
# Start message broker and cache
docker-compose up -d redis rabbitmq

# Verify services are healthy
docker-compose ps
```

### 5. Deploy Scraping Services

```bash
# Start scraper orchestrator
docker-compose up -d scraper-orchestrator

# Start individual scrapers
docker-compose up -d scraper-1001tracklists scraper-mixesdb scraper-setlistfm

# Scale scrapers as needed
docker-compose up -d --scale scraper-1001tracklists=3
```

### 6. Deploy Data Processing Services

```bash
# Start transformation services
docker-compose up -d data-transformer nlp-processor data-validator

# Scale transformers for better performance
docker-compose up -d --scale data-transformer=3
```

### 7. Deploy API Layer

```bash
# Start API services
docker-compose up -d rest-api graphql-api websocket-api

# Start API gateway
docker-compose up -d api-gateway

# Start reverse proxy
docker-compose up -d nginx
```

### 8. Setup Monitoring

```bash
# Start monitoring stack
docker-compose up -d prometheus grafana elasticsearch kibana

# Import Grafana dashboards
curl -X POST http://admin:${GRAFANA_PASSWORD}@localhost:3001/api/dashboards/db \
  -H "Content-Type: application/json" \
  -d @monitoring/grafana/dashboards/scraping-metrics.json
```

### 9. Verify Deployment

```bash
# Check all services are running
docker-compose ps

# Test API endpoints
curl http://localhost:8082/api/v1/health
curl http://localhost:8081/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "{ __schema { types { name } } }"}'

# Check scraper status
curl http://localhost:8001/scrapers/status

# Access monitoring dashboards
# Grafana: http://localhost:3001 (admin/your_password)
# Kibana: http://localhost:5602
```

## Port Reference

| Service | Standard Port | Non-Standard Port | Purpose |
|---------|--------------|-------------------|---------|
| PostgreSQL | 5432 | 5433 | Primary database |
| Redis | 6379 | 6380 | Cache & queue |
| RabbitMQ | 5672 | 5673 | Message broker |
| RabbitMQ Management | 15672 | 15673 | Management UI |
| Prometheus | 9090 | 9091 | Metrics collection |
| Grafana | 3000 | 3001 | Monitoring dashboards |
| Elasticsearch | 9200 | 9201 | Log aggregation |
| Kibana | 5601 | 5602 | Log visualization |
| API Gateway | - | 8080 | Central API entry |
| GraphQL API | - | 8081 | GraphQL endpoint |
| REST API | - | 8082 | REST endpoint |
| WebSocket API | - | 8083 | Real-time updates |
| Nginx HTTPS | 443 | 8443 | HTTPS proxy |
| Nginx HTTP | 80 | 8088 | HTTP proxy |

## Production Deployment

### 1. Environment Configuration

```bash
# Production environment variables
export ENVIRONMENT=production
export LOG_LEVEL=info
export ENABLE_PLAYGROUND=false
export AUTO_MIGRATE=false
```

### 2. SSL/TLS Setup

```bash
# Generate SSL certificates
certbot certonly --standalone -d musicdb.yourdomain.com

# Copy certificates
cp /etc/letsencrypt/live/musicdb.yourdomain.com/fullchain.pem nginx/ssl/
cp /etc/letsencrypt/live/musicdb.yourdomain.com/privkey.pem nginx/ssl/
```

### 3. Database Backups

```bash
# Create backup script
cat > backup.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/backups/postgres"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
docker-compose exec -T postgres pg_dump -U musicdb_user musicdb | gzip > $BACKUP_DIR/musicdb_$TIMESTAMP.sql.gz
find $BACKUP_DIR -name "*.sql.gz" -mtime +7 -delete
EOF

chmod +x backup.sh

# Add to crontab
crontab -e
# Add: 0 2 * * * /path/to/backup.sh
```

### 4. Monitoring Alerts

```yaml
# monitoring/prometheus/alerts.yml
groups:
  - name: musicdb_alerts
    rules:
      - alert: HighErrorRate
        expr: rate(api_errors_total[5m]) > 0.05
        for: 5m
        annotations:
          summary: "High API error rate"
          
      - alert: ScraperDown
        expr: up{job="scraper"} == 0
        for: 10m
        annotations:
          summary: "Scraper service is down"
          
      - alert: DatabaseConnectionPool
        expr: postgres_connections_active / postgres_connections_max > 0.8
        for: 5m
        annotations:
          summary: "Database connection pool nearly exhausted"
```

### 5. Scaling Configuration

```yaml
# docker-compose.prod.yml
services:
  scraper-1001tracklists:
    deploy:
      replicas: 5
      resources:
        limits:
          cpus: '2.0'
          memory: 2G
          
  data-transformer:
    deploy:
      replicas: 5
      resources:
        limits:
          cpus: '1.5'
          memory: 1.5G
          
  rest-api:
    deploy:
      replicas: 3
      resources:
        limits:
          cpus: '1.0'
          memory: 1G
```

## Orchestration Workflow Execution

### Starting the Orchestration

```bash
# Initialize orchestration workflow
docker-compose exec scraper-orchestrator python -m orchestration.start \
  --config /app/.claude/unified-orchestration-config.yaml \
  --step 0

# Monitor orchestration progress
docker-compose logs -f scraper-orchestrator | grep "ORCHESTRATION"
```

### Manual Step Execution

```bash
# Execute specific orchestration step
docker-compose exec scraper-orchestrator python -m orchestration.execute_step \
  --step 3 \
  --parallel

# Check orchestration status
curl http://localhost:8001/orchestration/status
```

## Troubleshooting

### Common Issues

#### 1. Scraper Rate Limiting
```bash
# Adjust rate limits
docker-compose exec scraper-orchestrator redis-cli \
  HSET scraper:rate_limit:1001tracklists requests_per_second 1
```

#### 2. Database Connection Issues
```bash
# Check PostgreSQL logs
docker-compose logs postgres

# Restart database
docker-compose restart postgres
```

#### 3. Memory Issues
```bash
# Check container memory usage
docker stats

# Increase memory limits in docker-compose.yml
```

### Health Checks

```bash
# Check all health endpoints
for port in 8001 8011 8012 8013 8020 8080 8082; do
  echo "Checking port $port:"
  curl -s http://localhost:$port/health | jq .
done
```

### Log Analysis

```bash
# View aggregated logs
docker-compose logs -f

# Search for errors
docker-compose logs | grep ERROR

# Export logs for analysis
docker-compose logs > deployment_logs_$(date +%Y%m%d).log
```

## Maintenance

### Regular Tasks

1. **Daily**
   - Check scraper success rates
   - Monitor API response times
   - Review error logs

2. **Weekly**
   - Update scraper configurations
   - Analyze data quality metrics
   - Review and resolve "ID" tracks

3. **Monthly**
   - Database vacuum and reindex
   - Update materialized views
   - Security patches

### Updating Services

```bash
# Pull latest changes
git pull origin main

# Rebuild changed services
docker-compose build --no-cache [service_name]

# Rolling update
docker-compose up -d --no-deps [service_name]
```

## Rollback Procedure

```bash
# Tag current deployment
docker tag musicdb_scrapy:latest musicdb_scrapy:backup-$(date +%Y%m%d)

# Rollback to previous version
docker-compose down
git checkout [previous_commit]
docker-compose build
docker-compose up -d

# Restore database if needed
gunzip < /backups/postgres/musicdb_[timestamp].sql.gz | \
  docker-compose exec -T postgres psql -U musicdb_user musicdb
```

## Performance Optimization

### Database Optimization
```sql
-- Update statistics
ANALYZE;

-- Refresh materialized views
REFRESH MATERIALIZED VIEW CONCURRENTLY popular_tracks;
REFRESH MATERIALIZED VIEW CONCURRENTLY artist_collaborations;

-- Vacuum tables
VACUUM ANALYZE tracks;
VACUUM ANALYZE artists;
```

### Redis Optimization
```bash
# Monitor Redis memory
docker-compose exec redis redis-cli INFO memory

# Clear expired keys
docker-compose exec redis redis-cli --scan --pattern "*" | \
  xargs -L 100 docker-compose exec redis redis-cli DEL
```

## Security Hardening

### Network Security
```bash
# Restrict exposed ports with firewall
ufw allow 8443/tcp  # HTTPS only
ufw allow 22/tcp    # SSH
ufw enable
```

### Container Security
```bash
# Run security scan
docker scan musicdb_scrapy:latest

# Update base images regularly
docker-compose pull
docker-compose build --pull
```

## Support

For issues or questions:
- Check logs: `docker-compose logs [service_name]`
- Review orchestration status: http://localhost:8001/orchestration/status
- Monitor dashboards: http://localhost:3001 (Grafana)
- API documentation: http://localhost:8080/docs