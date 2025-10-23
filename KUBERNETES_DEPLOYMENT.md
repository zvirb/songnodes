# Kubernetes Deployment Guide

This guide covers deploying SongNodes with the Serato and Tidal integrations using FluxCD and Kubernetes.

## Overview

SongNodes uses a GitOps approach with FluxCD for Kubernetes deployments:

- **Helm Charts**: Service definitions in `deploy/helm/songnodes/`
- **FluxCD**: GitOps configuration in `deploy/flux/`
- **Skaffold**: Local development and CI/CD builds

## Prerequisites

### Required Tools

- **kubectl** (v1.28+)
- **Helm** (v3.14+)
- **Skaffold** (v2.10+) - for local development
- **FluxCD CLI** (v2.2+) - for production GitOps

### Cluster Requirements

- Kubernetes cluster (v1.28+)
- Ingress controller (nginx recommended)
- Persistent storage provisioner
- Minimum 16GB RAM, 8 CPU cores

## Architecture

### New Services

Two new services have been added:

1. **metadata-enrichment** (Port 8020)
   - Handles all metadata enrichment (Spotify, Tidal, MusicBrainz, Last.fm, Serato)
   - Runs as Step 0.05 for Serato, Step 1.5 for Tidal
   - Includes circuit breaker, Redis caching, DLQ for failed enrichments
   - Exposed via ingress at `/enrich`

2. **serato-integration** (Port 8021)
   - Batch import tool for Serato-analyzed music libraries
   - Extracts BPM, key, cue points, loops from ID3 tags
   - Requires PersistentVolume mount for music library access
   - Disabled by default (enable for batch import)

### Service Dependencies

```
metadata-enrichment → PostgreSQL, Redis
                   ← rest-api, scraper-orchestrator

serato-integration → PostgreSQL
                  → PersistentVolume (music library)
```

## Configuration

### 1. Update Secrets

Create or update the `songnodes-secrets` secret with Tidal credentials:

```bash
kubectl create secret generic songnodes-secrets \
  --from-literal=POSTGRES_PASSWORD='your_postgres_password' \
  --from-literal=REDIS_PASSWORD='your_redis_password' \
  --from-literal=RABBITMQ_PASS='your_rabbitmq_password' \
  --from-literal=SPOTIFY_CLIENT_ID='your_spotify_client_id' \
  --from-literal=SPOTIFY_CLIENT_SECRET='your_spotify_client_secret' \
  --from-literal=TIDAL_CLIENT_ID='your_tidal_client_id' \
  --from-literal=TIDAL_CLIENT_SECRET='your_tidal_client_secret' \
  --from-literal=LASTFM_API_KEY='your_lastfm_api_key' \
  --from-literal=DISCOGS_API_TOKEN='your_discogs_token' \
  --from-literal=ANTHROPIC_API_KEY='your_anthropic_key' \
  --namespace songnodes \
  --dry-run=client -o yaml | kubectl apply -f -
```

**Important**: Get Tidal API credentials from:
- Tidal Developer Portal: https://developer.tidal.com/
- Register your application
- Copy Client ID and Client Secret

### 2. Configure PersistentVolume for Serato (Optional)

If using Serato batch import, create a PersistentVolume for your music library:

**Option A: NFS Mount**

```yaml
# serato-music-pv.yaml
apiVersion: v1
kind: PersistentVolume
metadata:
  name: serato-music-library
spec:
  capacity:
    storage: 100Gi
  accessModes:
    - ReadWriteMany
  persistentVolumeReclaimPolicy: Retain
  nfs:
    server: your-nfs-server.local
    path: /path/to/music/library
```

**Option B: Local Path (Development)**

```yaml
# serato-music-pv.yaml
apiVersion: v1
kind: PersistentVolume
metadata:
  name: serato-music-library
spec:
  capacity:
    storage: 100Gi
  accessModes:
    - ReadWriteOnce
  persistentVolumeReclaimPolicy: Retain
  hostPath:
    path: /mnt/music
    type: Directory
  nodeAffinity:
    required:
      nodeSelectorTerms:
        - matchExpressions:
            - key: kubernetes.io/hostname
              operator: In
              values:
                - your-node-name
```

Apply the PersistentVolume:

```bash
kubectl apply -f serato-music-pv.yaml
```

### 3. Enable Services in values.yaml

Update `deploy/helm/songnodes/values.yaml` or create an override file:

```yaml
# values-override.yaml
services:
  metadataEnrichment:
    enabled: true  # Already enabled by default

  seratoIntegration:
    enabled: true  # Enable for batch import
    persistence:
      enabled: true
      size: 100Gi
      # Optional: specify storageClassName
      # storageClassName: nfs-client
```

## Deployment Methods

### Method 1: Local Development (Skaffold)

For rapid iteration during development:

```bash
# Build and deploy to local/dev cluster
skaffold dev

# Or use the dev-push profile (pushes images to registry)
skaffold dev --profile=dev-push

# Build specific services only
skaffold dev --module=metadata-enrichment
```

**What Skaffold does:**
1. Builds Docker images for all services
2. Pushes to registry (if using dev-push profile)
3. Deploys Helm chart with values-dev.yaml
4. Watches for file changes and auto-redeploys

### Method 2: Manual Helm Deployment

For testing or staging environments:

```bash
# Install the chart
helm install songnodes deploy/helm/songnodes \
  --namespace songnodes \
  --create-namespace \
  --values deploy/helm/songnodes/values.yaml \
  --values values-override.yaml

# Upgrade existing deployment
helm upgrade songnodes deploy/helm/songnodes \
  --namespace songnodes \
  --values deploy/helm/songnodes/values.yaml \
  --values values-override.yaml

# Check status
helm status songnodes -n songnodes
```

### Method 3: GitOps with FluxCD (Production)

For production deployments with GitOps:

#### Initial Setup

1. **Install FluxCD** (if not already installed):

```bash
flux install --namespace=flux-system
```

2. **Bootstrap FluxCD with your Git repository**:

```bash
flux bootstrap github \
  --owner=your-org \
  --repository=songnodes \
  --branch=main \
  --path=clusters/managed \
  --personal
```

3. **Apply FluxCD resources**:

```bash
kubectl apply -k deploy/flux/
```

#### Continuous Deployment

FluxCD will automatically:
1. Watch the Git repository for changes
2. Pull latest Helm chart definitions
3. Apply changes to the cluster
4. Rollback on failure

**Check FluxCD status:**

```bash
# Check HelmRelease status
flux get helmreleases -n flux-system

# Check GitRepository sync status
flux get sources git -n flux-system

# View logs
flux logs --all-namespaces
```

## Post-Deployment Tasks

### 1. Apply Database Migration

The Serato integration requires database migration 009:

```bash
# Port-forward to PostgreSQL
kubectl port-forward -n songnodes svc/postgres-service 5432:5432

# Apply migration from another terminal
cat sql/migrations/009_serato_metadata_fields_up.sql | \
  psql -h localhost -p 5432 -U musicdb_user -d musicdb

# Or exec into postgres pod
kubectl exec -it -n songnodes postgres-0 -- \
  psql -U musicdb_user -d musicdb < /path/to/009_serato_metadata_fields_up.sql
```

**Migration adds:**
- 8 new columns to `tracks` table (serato_bpm, serato_key, etc.)
- 6 indexes for query performance
- 5 constraints for data validation
- Helper functions (compare_bpm_sources, find_tracks_needing_serato_analysis)
- Coverage view (serato_enrichment_coverage)

### 2. Verify Metadata Enrichment Service

Test the metadata enrichment endpoint:

```bash
# Port-forward to metadata-enrichment
kubectl port-forward -n songnodes svc/metadata-enrichment-service 8020:8020

# Test Tidal enrichment
curl -X POST http://localhost:8020/enrich \
  -H "Content-Type: application/json" \
  -d '{
    "track_id": "550e8400-e29b-41d4-a716-446655440001",
    "artist_name": "Deadmau5",
    "track_title": "Strobe",
    "existing_isrc": "GBTDG0900141"
  }'

# Check health
curl http://localhost:8020/health

# Check stats
curl http://localhost:8020/stats | jq
```

### 3. Run Serato Batch Import (Optional)

If you enabled serato-integration and mounted your music library:

```bash
# Dry run (test without database changes)
kubectl exec -n songnodes deployment/serato-integration -- \
  python batch_import.py \
    --music-dir /music \
    --limit 100 \
    --dry-run

# Full import
kubectl exec -n songnodes deployment/serato-integration -- \
  python batch_import.py \
    --music-dir /music

# Check progress
kubectl logs -n songnodes deployment/serato-integration -f
```

### 4. Verify Ingress

Check that the ingress routes are working:

```bash
# Get ingress URL
kubectl get ingress -n songnodes

# Test metadata enrichment via ingress
curl -X POST https://api.songnodes.example.com/enrich \
  -H "Content-Type: application/json" \
  -d '{"track_id": "...", "artist_name": "...", "track_title": "..."}'
```

## Monitoring

### Prometheus Metrics

metadata-enrichment exposes Prometheus metrics on port 9090:

```
# Enrichment metrics
enrichment_requests_total
enrichment_duration_seconds
enrichment_cache_hit_rate
enrichment_api_errors_total
enrichment_circuit_breaker_state

# Per-source metrics
tidal_requests_total
tidal_errors_total
spotify_requests_total
serato_extractions_total
```

### Grafana Dashboards

Import the SongNodes dashboard (if not already configured):

1. Access Grafana UI
2. Import dashboard from `monitoring/grafana-dashboards/`
3. Select Prometheus datasource
4. View enrichment metrics, cache hit rates, API errors

### Health Checks

All services expose `/health` endpoints:

```bash
# Check all service health
kubectl get pods -n songnodes

# Detailed health check
kubectl exec -n songnodes deployment/metadata-enrichment -- \
  curl http://localhost:8020/health
```

## Troubleshooting

### Metadata Enrichment Issues

**Problem**: Tidal enrichment failing with 401 errors

**Solution**: Check Tidal credentials in secrets:

```bash
kubectl get secret songnodes-secrets -n songnodes -o json | \
  jq -r '.data.TIDAL_CLIENT_ID' | base64 -d

kubectl get secret songnodes-secrets -n songnodes -o json | \
  jq -r '.data.TIDAL_CLIENT_SECRET' | base64 -d
```

**Problem**: High memory usage in metadata-enrichment

**Solution**: Clear Redis cache:

```bash
kubectl exec -n songnodes deployment/redis -- \
  redis-cli -a "$REDIS_PASSWORD" FLUSHDB
```

### Serato Integration Issues

**Problem**: PersistentVolumeClaim stuck in Pending

**Solution**: Check PersistentVolume status and binding:

```bash
kubectl get pv
kubectl get pvc -n songnodes
kubectl describe pvc serato-music-library -n songnodes
```

**Problem**: No Serato data found

**Solution**: Verify music files have Serato tags:

```bash
# Check if files are accessible
kubectl exec -n songnodes deployment/serato-integration -- \
  ls -la /music

# Test parsing a single file
kubectl exec -n songnodes deployment/serato-integration -- \
  python -c "
from serato_parser import SeratoFileParser
from pathlib import Path
parser = SeratoFileParser()
metadata = parser.extract_metadata(Path('/music/path/to/track.mp3'))
print(metadata)
"
```

### FluxCD Issues

**Problem**: HelmRelease not reconciling

**Solution**: Check FluxCD status and logs:

```bash
# Get HelmRelease status
kubectl get helmrelease songnodes -n flux-system

# Describe for events
kubectl describe helmrelease songnodes -n flux-system

# Check Flux logs
kubectl logs -n flux-system deployment/helm-controller
```

**Problem**: Git repository not syncing

**Solution**: Verify GitRepository resource:

```bash
kubectl get gitrepository songnodes -n flux-system
kubectl describe gitrepository songnodes -n flux-system
```

## Scaling

### Horizontal Pod Autoscaling

HPA is configured for metadata-enrichment in production:

```yaml
autoscaling:
  metadataEnrichment:
    minReplicas: 2
    maxReplicas: 6
    metrics:
      - type: Resource
        resource:
          name: cpu
          target:
            type: Utilization
            averageUtilization: 75
      - type: Resource
        resource:
          name: memory
          target:
            type: Utilization
            averageUtilization: 80
```

**Check HPA status:**

```bash
kubectl get hpa -n songnodes
kubectl describe hpa metadata-enrichment -n songnodes
```

### Manual Scaling

Scale services manually if needed:

```bash
# Scale metadata-enrichment to 4 replicas
kubectl scale deployment metadata-enrichment -n songnodes --replicas=4

# Scale down to 1 replica (dev/testing)
kubectl scale deployment metadata-enrichment -n songnodes --replicas=1
```

## Rollback

### Helm Rollback

```bash
# List release history
helm history songnodes -n songnodes

# Rollback to previous release
helm rollback songnodes -n songnodes

# Rollback to specific revision
helm rollback songnodes 3 -n songnodes
```

### FluxCD Rollback

```bash
# Suspend HelmRelease (stops reconciliation)
flux suspend helmrelease songnodes -n flux-system

# Resume HelmRelease
flux resume helmrelease songnodes -n flux-system

# Force reconciliation
flux reconcile helmrelease songnodes -n flux-system
```

## Cleanup

### Remove Serato Integration

```bash
# Disable in values
helm upgrade songnodes deploy/helm/songnodes \
  --set services.seratoIntegration.enabled=false \
  --namespace songnodes

# Or edit values file and redeploy
```

### Uninstall Helm Release

```bash
helm uninstall songnodes -n songnodes
```

### Remove Namespace

```bash
kubectl delete namespace songnodes
```

## Related Documentation

- [Serato Integration README](services/serato-integration/README.md)
- [Tidal + Serato Integration Summary](SERATO_TIDAL_INTEGRATION_SUMMARY.md)
- [Metadata Enrichment Pipeline](services/metadata-enrichment/README.md)
- [Helm Chart Values](deploy/helm/songnodes/values.yaml)
- [FluxCD Configuration](deploy/flux/)

## Support

For issues or questions:

1. Check logs: `kubectl logs -n songnodes deployment/metadata-enrichment`
2. Verify configuration: `helm get values songnodes -n songnodes`
3. Review health: `kubectl get pods -n songnodes`
4. Check FluxCD status: `flux get all -n flux-system`
