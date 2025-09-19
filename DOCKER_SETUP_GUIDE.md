# SongNodes Docker Setup & Troubleshooting Guide

## Quick Start

### Prerequisites
- Docker Engine 24.0+
- Docker Compose V2
- At least 16GB RAM
- 20GB free disk space

### Environment Setup
1. Copy environment file:
   ```bash
   cp .env.example .env  # If exists, or use the provided .env
   ```

2. Create data directories:
   ```bash
   mkdir -p data/{postgres,redis,rabbitmq,elasticsearch,prometheus,grafana,minio,nlp_models} logs/nginx
   ```

3. Start the stack:
   ```bash
   docker compose up -d
   ```

4. Check service health:
   ```bash
   docker compose ps
   docker compose logs --tail=50
   ```

## Service Overview

### Core Services
| Service | Port | Description | Health Check |
|---------|------|-------------|--------------|
| postgres | 5433 | PostgreSQL database | `docker compose exec postgres pg_isready` |
| redis | 6380 | Redis cache | `docker compose exec redis redis-cli ping` |
| api-gateway | 8080 | Main API entry | `curl http://localhost:8080/health` |
| frontend | 3006 | React development | `curl http://localhost:3006` |
| nginx | 8088/8443 | Reverse proxy | `curl http://localhost:8088/health` |

### Monitoring Stack
| Service | Port | Description | Access |
|---------|------|-------------|--------|
| grafana | 3001 | Dashboards | http://localhost:3001 (admin/admin) |
| prometheus | 9091 | Metrics | http://localhost:9091 |
| elasticsearch | 9201 | Log storage | http://localhost:9201 |
| kibana | 5602 | Log viewer | http://localhost:5602 |

### Scraping Services
| Service | Port | Description |
|---------|------|-------------|
| scraper-orchestrator | 8001 | Scraper coordination |
| scraper-mixesdb | 8012 | MixesDB scraper |
| scraper-setlistfm | 8013 | Setlist.fm scraper |
| scraper-reddit | 8014 | Reddit scraper |

## Common Issues & Solutions

### 1. Port Conflicts
**Symptom**: Services fail to start with "port already in use"

**Solution**:
```bash
# Check what's using the port
sudo netstat -tlnp | grep :8080
# or
sudo lsof -i :8080

# Kill conflicting process or change port in docker-compose.yml
```

**Alternative**: Use different ports in `.env`:
```bash
# Add to .env file
POSTGRES_PORT=5434
REDIS_PORT=6381
API_GATEWAY_PORT=8081
```

### 2. Memory Issues
**Symptom**: Services getting killed or containers restarting

**Solution**:
```bash
# Check Docker memory limits
docker system df
docker system prune -f

# Reduce service replicas in docker-compose.override.yml
# Increase Docker memory allocation to 8GB+
```

### 3. Database Connection Failures
**Symptom**: APIs can't connect to PostgreSQL

**Debugging**:
```bash
# Check database status
docker compose logs postgres
docker compose exec postgres pg_isready -U musicdb_user

# Check connection pool
docker compose logs db-connection-pool
curl http://localhost:8025/health

# Test direct connection
docker compose exec postgres psql -U musicdb_user -d musicdb -c "SELECT 1;"
```

**Solution**:
```bash
# Reset database volume if corrupted
docker compose down
sudo rm -rf data/postgres/*
docker compose up -d postgres
```

### 4. Frontend Build Issues
**Symptom**: Frontend container fails to build or start

**Solution**:
```bash
# Build frontend manually
cd frontend
npm install
npm run build

# Use development override
docker compose -f docker-compose.yml -f docker-compose.override.yml up frontend
```

### 5. Health Check Failures
**Symptom**: Services marked as unhealthy

**Debugging**:
```bash
# Check specific service logs
docker compose logs <service-name>

# Test health check manually
docker compose exec <service-name> curl -f http://localhost:<port>/health

# Disable health checks temporarily
# Comment out healthcheck section in docker-compose.yml
```

### 6. Networking Issues
**Symptom**: Services can't communicate with each other

**Solution**:
```bash
# Check networks
docker network ls
docker network inspect songnodes_musicdb-backend

# Test service connectivity
docker compose exec api-gateway ping postgres
docker compose exec api-gateway nslookup redis
```

## Performance Optimization

### Resource Allocation
```yaml
# In docker-compose.override.yml
services:
  postgres:
    deploy:
      resources:
        limits:
          cpus: '4.0'
          memory: 4G
        reservations:
          cpus: '2.0'
          memory: 2G
```

### Scaling Services
```bash
# Scale specific services
docker compose up -d --scale rest-api=3
docker compose up -d --scale scraper-1001tracklists=2
```

## Development Workflow

### Hot Reload Development
```bash
# Start with development overrides
docker compose -f docker-compose.yml -f docker-compose.override.yml up -d

# Watch logs for specific service
docker compose logs -f frontend
docker compose logs -f api-gateway
```

### Database Management
```bash
# Access database
docker compose exec postgres psql -U musicdb_user -d musicdb

# Backup database
docker compose exec postgres pg_dump -U musicdb_user musicdb > backup.sql

# Restore database
docker compose exec -T postgres psql -U musicdb_user musicdb < backup.sql
```

### Debugging Services
```bash
# Enter service container
docker compose exec api-gateway bash
docker compose exec postgres bash

# View service configuration
docker compose config

# Restart specific service
docker compose restart api-gateway
```

## Security Considerations

### Production Environment Variables
```bash
# Generate secure passwords
openssl rand -base64 32  # For database passwords
openssl rand -hex 32     # For JWT secrets
```

### SSL Certificate Setup
```bash
# Generate self-signed certificates for development
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout nginx/ssl/musicdb.key \
  -out nginx/ssl/musicdb.crt \
  -subj "/C=US/ST=State/L=City/O=Org/CN=localhost"
```

## Monitoring & Logging

### Health Monitoring
```bash
# Check all service health
for service in $(docker compose ps --services); do
  echo "=== $service ==="
  docker compose ps $service
done

# Monitor resource usage
docker stats
```

### Log Management
```bash
# View aggregated logs
docker compose logs --tail=100 --follow

# Service-specific logs
docker compose logs postgres
docker compose logs api-gateway

# Export logs
docker compose logs > full_logs.txt
```

## Backup & Recovery

### Data Backup
```bash
#!/bin/bash
# Create backup script
BACKUP_DIR="./backups/$(date +%Y%m%d_%H%M%S)"
mkdir -p $BACKUP_DIR

# Backup PostgreSQL
docker compose exec postgres pg_dump -U musicdb_user musicdb > $BACKUP_DIR/postgres.sql

# Backup Redis
docker compose exec redis redis-cli --rdb $BACKUP_DIR/redis.rdb

# Backup configuration
cp .env $BACKUP_DIR/
cp docker-compose.yml $BACKUP_DIR/
```

### Data Recovery
```bash
# Stop services
docker compose down

# Restore data directories
# (restore from backup)

# Restart services
docker compose up -d
```

## Advanced Configuration

### Custom Network Configuration
```yaml
# In docker-compose.override.yml
networks:
  musicdb-backend:
    driver: bridge
    ipam:
      config:
        - subnet: 172.30.0.0/16
```

### External Services Integration
```yaml
# Connect to external database
services:
  postgres:
    external: true
    external_name: external_postgres_container
```

## Troubleshooting Commands

```bash
# System information
docker system info
docker compose version

# Clean up resources
docker system prune -f
docker volume prune -f
docker network prune -f

# Reset everything (DESTRUCTIVE)
docker compose down -v --remove-orphans
docker system prune -af --volumes
```

## Getting Help

1. Check logs: `docker compose logs <service>`
2. Verify configuration: `docker compose config`
3. Test connectivity: `docker compose exec <service> ping <target>`
4. Check resources: `docker stats`
5. Review environment: `docker compose exec <service> env`

For additional support, check the project documentation or submit an issue with:
- Output of `docker compose logs`
- System specifications
- Steps to reproduce the issue