# Disk Space Management Guide

## Current Storage Configuration

### Volume Locations

| Component | Location | Filesystem | Size | Notes |
|-----------|----------|------------|------|-------|
| **Ollama Models** | `/mnt/my_external_drive/programming/songnodes/data/ollama` | `/dev/nvme1n1p4` | ~1.9GB | ✅ On external drive (109G free) |
| **Docker Images** | `/var/lib/docker` | `/dev/mapper/ubuntu--vg-ubuntu--lv` | ~26GB | ⚠️ On root filesystem |
| **Docker Build Cache** | `/var/lib/docker/buildx` | `/dev/mapper/ubuntu--vg-ubuntu--lv` | Variable | ⚠️ Can grow very large |
| **Project Files** | `/mnt/my_external_drive/programming/songnodes` | `/dev/nvme1n1p4` | | ✅ On external drive |

### Filesystem Status (as of 2025-10-01)

```
Root filesystem:     466G total, 307G used, 136G free (70% usage)
External drive:      137G total, 22G used, 109G free (17% usage)
```

## Critical Maintenance Tasks

### 1. Docker Build Cache Cleanup (WEEKLY)

**Problem:** Docker stores intermediate layers from builds, which can consume 100GB+

**Solution:**
```bash
# Check current usage
docker system df

# Clean build cache
docker builder prune -af

# Clean buildx cache (if using buildx)
docker buildx prune -af

# Verify cleanup
docker system df
```

### 2. Remove Unused Docker Images (WEEKLY)

**Problem:** Old image versions accumulate from repeated rebuilds (each scraper ~2.34GB)

**Solution:**
```bash
# Stop and remove old containers first
docker container prune -f

# Remove unused images
docker image prune -a --force

# More aggressive: remove ALL unused Docker data
docker system prune -af --volumes  # WARNING: Removes stopped containers and unused volumes
```

### 3. Monitor Disk Space (DAILY)

```bash
# Quick check
df -h /

# Detailed Docker usage
docker system df -v

# Find large directories
du -sh /var/lib/docker/* 2>/dev/null | sort -rh | head -10
```

## Storage Optimization Strategies

### Option 1: Move Docker Root to External Drive (RECOMMENDED)

This moves ALL Docker data to the external drive:

```bash
# 1. Stop Docker
sudo systemctl stop docker

# 2. Create new Docker data directory on external drive
sudo mkdir -p /mnt/my_external_drive/docker

# 3. Move existing data
sudo rsync -aP /var/lib/docker/ /mnt/my_external_drive/docker/

# 4. Configure Docker to use new location
sudo nano /etc/docker/daemon.json
# Add:
{
  "data-root": "/mnt/my_external_drive/docker"
}

# 5. Restart Docker
sudo systemctl start docker

# 6. Verify new location
docker info | grep "Docker Root Dir"

# 7. After verification, remove old data
sudo rm -rf /var/lib/docker
```

### Option 2: Move Only Build Cache (CURRENT APPROACH)

Keep images on root (for speed) but move build cache to external drive:

```bash
# Configure buildx to use external drive
docker buildx create --use --name external-builder \
  --driver-opt env.BUILDKIT_CACHE_MOUNT_NS=/mnt/my_external_drive/buildx-cache
```

### Option 3: Limit Build Cache Size

Add to `/etc/docker/daemon.json`:
```json
{
  "builder": {
    "gc": {
      "enabled": true,
      "defaultKeepStorage": "10GB"
    }
  }
}
```

## Emergency Disk Space Recovery

If root filesystem reaches 100%:

```bash
# 1. Immediate cleanup - build cache (fastest)
docker builder prune -af
docker buildx prune -af

# 2. Remove stopped containers
docker container prune -f

# 3. Remove dangling images
docker image prune -f

# 4. Clean system logs (requires sudo)
sudo journalctl --vacuum-time=7d

# 5. Clean apt cache
sudo apt-get clean
sudo apt-get autoclean

# 6. Find and remove large log files
sudo find /var/log -type f -name "*.log" -size +100M -delete
```

## Ollama-Specific Management

### Current Configuration

Ollama models are stored on the external drive via bind mount in `docker-compose.yml`:

```yaml
volumes:
  ollama_data:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: ./data/ollama  # Resolves to /mnt/my_external_drive/programming/songnodes/data/ollama
```

### Managing Ollama Models

```bash
# List installed models
docker exec ollama-ai ollama list

# Remove unused models
docker exec ollama-ai ollama rm <model-name>

# Check Ollama storage usage
docker exec ollama-ai du -sh /root/.ollama

# View model details
docker exec ollama-ai ollama show <model-name>
```

### Common Large Models

| Model | Typical Size | Use Case |
|-------|-------------|----------|
| `llama2:7b` | ~3.8GB | General text generation |
| `mistral:7b` | ~4.1GB | Fast inference |
| `codellama:13b` | ~7.4GB | Code generation |
| `llama2:13b` | ~7.4GB | Better quality text |
| `nomad-embed-text` | ~270MB | Text embeddings |

## Automated Cleanup Script

Create `/usr/local/bin/docker-cleanup.sh`:

```bash
#!/bin/bash
# Weekly Docker cleanup script

echo "Starting Docker cleanup..."
echo "Before cleanup:"
df -h / | grep -v Filesystem

# Clean build cache
docker builder prune -af --filter "until=24h"

# Remove unused images
docker image prune -af --filter "until=72h"

# Remove stopped containers
docker container prune -f --filter "until=72h"

echo "After cleanup:"
df -h / | grep -v Filesystem

echo "Docker storage:"
docker system df
```

Add to crontab:
```bash
# Run every Sunday at 2 AM
0 2 * * 0 /usr/local/bin/docker-cleanup.sh >> /var/log/docker-cleanup.log 2>&1
```

## Monitoring Alerts

Consider setting up alerts when disk usage exceeds thresholds:

```bash
#!/bin/bash
# /usr/local/bin/disk-space-alert.sh

THRESHOLD=80
USAGE=$(df / | tail -1 | awk '{print $5}' | sed 's/%//')

if [ $USAGE -gt $THRESHOLD ]; then
    echo "WARNING: Root filesystem at ${USAGE}% capacity" | \
    mail -s "Disk Space Alert" your-email@example.com
fi
```

## Best Practices

1. **Build Cache:** Clean weekly or after major rebuild sessions
2. **Images:** Remove unused images monthly
3. **Containers:** Always use `docker compose down` instead of `docker compose stop` when done with a service
4. **Volumes:** Verify bind mounts point to external drive for large data
5. **Logs:** Implement log rotation for Docker containers
6. **Monitoring:** Set up disk space alerts at 80% threshold

## Troubleshooting

### Build Cache Won't Clean

If `docker builder prune` returns 0B:

```bash
# List builders
docker buildx ls

# Remove and recreate default builder
docker buildx rm default
docker buildx create --use --name default

# Try cleanup again
docker buildx prune -af
```

### Volume Shows Wrong Location

Recreate volume with proper bind mount:

```bash
# 1. Stop container
docker compose stop ollama

# 2. Remove volume
docker volume rm songnodes_ollama_data

# 3. Ensure bind mount directory exists
mkdir -p /mnt/my_external_drive/programming/songnodes/data/ollama

# 4. Restart container (volume recreates automatically)
docker compose up -d ollama

# 5. Verify location
docker volume inspect songnodes_ollama_data
```

## References

- [Docker disk space management](https://docs.docker.com/config/pruning/)
- [Docker daemon configuration](https://docs.docker.com/engine/reference/commandline/dockerd/#daemon-configuration-file)
- [Ollama documentation](https://ollama.ai/docs)
