# 🧹 Docker Disk Cleanup - Quick Reference

## ⚡ Emergency Cleanup (Root filesystem >90%)

```bash
# Run ALL these commands in order:
docker builder prune -af           # Clean build cache
docker buildx prune -af            # Clean buildx cache
docker image prune -af             # Remove unused images
docker container prune -f          # Remove stopped containers
docker volume prune -f             # Remove unused volumes (CAREFUL!)
```

## 📊 Check Disk Usage

```bash
df -h /                           # Root filesystem usage
docker system df                   # Docker storage summary
docker system df -v                # Detailed breakdown
```

## 🔄 Weekly Maintenance (Run every Sunday)

```bash
# Build cache (safest to clean)
docker builder prune -af --filter "until=24h"

# Old images (older than 3 days)
docker image prune -af --filter "until=72h"

# Stopped containers
docker container prune -f
```

## 📍 Storage Locations

- **Ollama:** `/mnt/my_external_drive/programming/songnodes/data/ollama` ✅ External drive
- **Docker:** `/var/lib/docker` ⚠️ Root filesystem
- **Project:** `/mnt/my_external_drive/programming/songnodes` ✅ External drive

## 🎯 Current Status

**Root Filesystem:**
- Total: 466G
- Used: 307G
- Free: **136G** (70% usage)
- Status: ✅ HEALTHY (was 100% full before cleanup!)

**Build Cache Cleaned:** ✅ 116.7GB freed

## 🔧 Ollama Model Management

```bash
# List models
docker exec ollama-ai ollama list

# Remove model
docker exec ollama-ai ollama rm <model-name>

# Check Ollama size
docker exec ollama-ai du -sh /root/.ollama
```

## ⚠️ Warning Signs

| Usage | Action |
|-------|--------|
| <70% | ✅ Normal - no action needed |
| 70-85% | ⚠️ Plan cleanup - review weekly |
| 85-95% | 🔴 Clean now - run emergency cleanup |
| >95% | 🚨 CRITICAL - immediate action required |

## 📝 See Full Documentation

For detailed information, see `DISK_SPACE_MANAGEMENT.md`
