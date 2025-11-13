# SongNodes: Resilience & Recovery Guide

## System Resilience Features

### 1. K3s Auto-Start on Boot
**Status:** ✅ Enabled

K3s is configured to start automatically on system boot via systemd:
```bash
# Check status
systemctl is-enabled k3s  # Should return: enabled
systemctl status k3s

# Manual restart if needed
sudo systemctl restart k3s
```

**Recovery Time:** 30-60 seconds for K3s to fully initialize after boot.

### 2. Data Persistence

All critical data persists across restarts using Persistent Volume Claims (PVCs):

| Service | PVC | Capacity | Data Retained |
|---------|-----|----------|---------------|
| PostgreSQL | `postgres-storage-postgres-0` | 20Gi | All track/playlist/artist data |
| RabbitMQ | `rabbitmq-data-rabbitmq-0` | 10Gi | Message queue state |
| Redis | `redis-pvc` | 5Gi | Cache data (rebuilt on startup) |
| Postgres Backups | `postgres-backup-storage` | 10Gi | Daily database backups |

**Verify persistence:**
```bash
kubectl get pvc -n songnodes
```

### 3. Pod Restart Policies

All deployments use `restartPolicy: Always` to automatically recover from crashes:
- Pods restart automatically on failure
- Init containers ensure dependencies are ready before startup
- Kubernetes reschedules pods if nodes become unavailable

**CronJobs use `restartPolicy: OnFailure`** to retry failed jobs without infinite loops.

### 4. PodDisruptionBudgets (PDB)

PDBs ensure minimum availability during planned disruptions (node drains, upgrades):

| Service | Min Available | Purpose |
|---------|---------------|---------|
| postgres | 1 | Database always available |
| rabbitmq | 1 | Message queue always available |
| redis | 1 | Cache always available |
| rest-api | 1 | API always available |
| graph-visualization | 1 | Graph API always available |
| metadata-enrichment | 1 | Enrichment service available |

**Check PDBs:**
```bash
kubectl get pdb -n songnodes
```

### 5. Health Checks & Probes

All services implement health checks:

**Liveness Probes:** Restart unhealthy containers
**Readiness Probes:** Remove pods from load balancer when not ready
**Startup Probes:** Give slow-starting services extra time (metadata-enrichment: 600s)

### 6. Resource Limits

All pods have resource requests/limits to prevent:
- OOMKiller evictions
- Resource starvation
- Cascading failures

**Single-node cluster optimized:** All services run 1 replica to prevent memory exhaustion.

### 7. Init Containers

Services wait for dependencies before starting:
- **rest-api, metadata-enrichment, unified-scraper:** Wait for PostgreSQL (120s timeout)
- **metadata-enrichment:** Also waits for Redis (60s timeout)

This prevents startup failures and CrashLoopBackOff cycles.

---

## Recovery Procedures

### After Unexpected Reboot

1. **Wait for K3s to start** (~30-60 seconds):
   ```bash
   sudo systemctl status k3s
   kubectl get nodes
   ```

2. **Check pod recovery** (~2-5 minutes):
   ```bash
   kubectl get pods -n songnodes
   ```

   Expected: Most pods `Running` within 5 minutes. Services pulling large images may take 10-15 minutes.

3. **Verify data integrity**:
   ```bash
   kubectl exec -n songnodes postgres-0 -- psql -U musicdb_user -d musicdb -c "SELECT COUNT(*) FROM tracks;"
   ```

4. **Check for orphaned pods**:
   ```bash
   kubectl get pods -n songnodes --field-selector=status.phase=Unknown
   kubectl delete pods -n songnodes --field-selector=status.phase=Unknown
   ```

### If K3s Fails to Start

1. **Check containerd socket**:
   ```bash
   ls -la /run/k3s/containerd/containerd.sock
   ```

   If missing, containerd failed to start.

2. **Check logs**:
   ```bash
   sudo journalctl -u k3s -n 50
   ```

3. **Force restart**:
   ```bash
   sudo systemctl stop k3s
   sudo /usr/local/bin/k3s-killall.sh  # Clean up stale processes
   sudo systemctl start k3s
   ```

### If Pods Stuck in ImagePullBackOff

**Cause:** Local registry not responding or images not present.

1. **Check local registry**:
   ```bash
   docker ps | grep registry
   curl http://localhost:5000/v2/_catalog
   ```

2. **Restart registry if needed**:
   ```bash
   docker restart registry
   ```

3. **Delete stuck pods** (they'll recreate and retry):
   ```bash
   kubectl delete pods -n songnodes --field-selector=status.phase=Failed
   ```

### If Database Lost Data

**Last Resort:** Restore from daily backup.

1. **Find latest backup**:
   ```bash
   kubectl get cronjob -n songnodes postgres-backup
   kubectl logs -n songnodes job/postgres-backup-<timestamp>
   ```

2. **Restore from backup**:
   ```bash
   # Copy backup from PVC
   kubectl exec -n songnodes postgres-0 -- pg_restore -U musicdb_user -d musicdb --clean < backup.dump
   ```

3. **Verify restoration**:
   ```bash
   kubectl exec -n songnodes postgres-0 -- psql -U musicdb_user -d musicdb -c "SELECT COUNT(*) FROM tracks;"
   ```

---

## Monitoring Commands

### Quick Health Check
```bash
# All-in-one status
kubectl get pods,pvc,pdb -n songnodes
kubectl top nodes
kubectl get events -n songnodes --sort-by='.lastTimestamp' | tail -20
```

### Check Specific Issues
```bash
# Failing pods
kubectl get pods -n songnodes | grep -v "Running\|Completed"

# Pods without resource limits (should be none)
kubectl get pods -n songnodes -o json | jq '.items[] | select(.spec.containers[0].resources.limits == null) | .metadata.name'

# PVC disk usage
kubectl exec -n songnodes postgres-0 -- df -h /var/lib/postgresql/data
```

### Check GitOps Sync
```bash
flux get helmreleases -n flux-system
flux reconcile source git songnodes
flux reconcile helmrelease songnodes -n flux-system
```

---

## Preventative Maintenance

### Daily
- ✅ Automated PostgreSQL backups (2 AM daily)
- ✅ Monitor disk space: `df -h`
- ✅ Check pod status: `kubectl get pods -n songnodes`

### Weekly
- Review failed CronJobs: `kubectl get jobs -n songnodes`
- Check for ImagePullBackOff pods
- Verify backup integrity

### Monthly
- Review resource usage trends
- Update container images to latest
- Test disaster recovery procedure

---

## Known Issues & Workarounds

### Issue: Pods Stuck Terminating
**Symptom:** Pods in `Terminating` state for >5 minutes.

**Workaround:**
```bash
kubectl delete pod <pod-name> -n songnodes --grace-period=0 --force
```

### Issue: Memory Pressure on Single Node
**Symptom:** Pods showing `Insufficient memory` errors.

**Solution:**
- All services already limited to 1 replica
- Autoscaling disabled
- If still occurring, reduce individual pod memory limits in `values.yaml`

### Issue: Slow Image Pulls After Restart
**Symptom:** Pods take 15+ minutes to pull images from `localhost:5000`.

**Root Cause:** Local registry cold start, large image sizes.

**Mitigation:** Images eventually pull successfully. No action needed unless >30 minutes.

---

## Resilience Checklist

Before deploying changes, verify:

- [ ] All changes committed to Git (GitOps)
- [ ] No hardcoded credentials
- [ ] Resource requests/limits defined
- [ ] Health checks (liveness/readiness) configured
- [ ] Init containers wait for dependencies
- [ ] RestartPolicy set to `Always` (or `OnFailure` for jobs)
- [ ] PVCs configured for stateful data
- [ ] Services limited to 1 replica (single-node cluster)
- [ ] Autoscaling disabled
- [ ] `imagePullPolicy: Always` for `:latest` tags

---

## Emergency Contacts / Resources

- **K3s Documentation:** https://docs.k3s.io/
- **Flux Documentation:** https://fluxcd.io/docs/
- **Project CLAUDE.md:** `/home/marku/Documents/programming/songnodes/CLAUDE.md`
- **Helm Charts:** `/home/marku/Documents/programming/songnodes/deploy/helm/songnodes/`

---

**Last Updated:** 2025-11-13
**Status:** Production-ready, optimized for single-node K3s cluster
