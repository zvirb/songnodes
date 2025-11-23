# RabbitMQ musicdb Vhost Permanent Fix

## Problem
The websocket-api service was failing to connect to RabbitMQ with error:
```
NOT_FOUND - vhost musicdb not found
```

This occurred because:
1. RabbitMQ StatefulSet only created the default "/" vhost
2. Services (websocket-api, metadata-enrichment, scrapers) expected "musicdb" vhost
3. The musicdb vhost had to be manually created after each RabbitMQ restart

## Solution
Added a lifecycle postStart hook to the RabbitMQ StatefulSet that automatically creates the musicdb vhost and grants permissions on pod startup.

## Changes Made

### 1. Updated RabbitMQ StatefulSet Template
**File:** `deploy/helm/songnodes/templates/rabbitmq.yaml`

**Added lifecycle hook:**
```yaml
lifecycle:
  postStart:
    exec:
      command:
        - /bin/bash
        - -c
        - |
          sleep 10
          rabbitmqctl add_vhost musicdb || true
          rabbitmqctl set_permissions -p musicdb songnodesuser ".*" ".*" ".*" || true
```

**Location:** Added after `volumeMounts` section in the rabbitmq container spec (line 87)

**Why it works:**
- `sleep 10`: Gives RabbitMQ time to fully start before creating vhost
- `add_vhost musicdb || true`: Creates vhost idempotently (won't fail if exists)
- `set_permissions`: Grants full permissions (configure, write, read) to songnodesuser
- Hook executes every time pod starts, ensuring vhost always exists

### 2. Updated StatefulSet UpdateStrategy
**File:** `deploy/helm/songnodes/templates/rabbitmq.yaml`

**Changed:**
```yaml
updateStrategy:
  type: RollingUpdate  # Changed from OnDelete
```

**Why:** Allows automatic pod updates when StatefulSet spec changes. OnDelete would require manual pod deletion.

## Verification Steps

### 1. Verify Hook in StatefulSet
```bash
kubectl get statefulset rabbitmq -n songnodes -o yaml | grep -A 15 "lifecycle:"
```

Expected output:
```yaml
lifecycle:
  postStart:
    exec:
      command:
      - /bin/bash
      - -c
      - |
        sleep 10
        rabbitmqctl add_vhost musicdb || true
        rabbitmqctl set_permissions -p musicdb songnodesuser ".*" ".*" ".*" || true
```

### 2. Verify Vhost Exists
Once RabbitMQ pod is running:
```bash
kubectl exec -n songnodes rabbitmq-0 -- rabbitmqctl list_vhosts
```

Expected output:
```
Listing vhosts ...
name
/
musicdb
```

### 3. Verify Permissions
```bash
kubectl exec -n songnodes rabbitmq-0 -- rabbitmqctl list_permissions -p musicdb
```

Expected output:
```
Listing permissions for vhost "musicdb" ...
user            configure       write   read
songnodesuser   .*              .*      .*
```

### 4. Test WebSocket API Connection
```bash
kubectl logs -n songnodes deployment/websocket-api --tail=50 | grep -i rabbitmq
```

Should NOT see errors like:
```
NOT_FOUND - vhost musicdb not found
```

Should see successful connection messages:
```
Connected to RabbitMQ on musicdb vhost
```

## Current Status

### Commits
- `1e66941`: Added lifecycle postStart hook for vhost creation
- `2529a65`: Changed updateStrategy to RollingUpdate

### Applied Changes
The lifecycle hook has been applied to the running StatefulSet via `kubectl patch`:
```bash
kubectl get statefulset rabbitmq -n songnodes -o jsonpath='{.spec.template.spec.containers[0].lifecycle}'
```

### Pending
RabbitMQ pod restart is needed to trigger the postStart hook. The pod is currently stuck in `ContainerCreating` state due to a containerd issue (orphaned container sandbox). This requires one of:

1. **System-level fix (preferred):**
   ```bash
   sudo systemctl restart k3s
   ```

2. **Manual cleanup:**
   ```bash
   sudo crictl ps -a | grep rabbitmq
   sudo crictl rm <container_id>
   sudo crictl rmp <sandbox_id>
   kubectl delete pod rabbitmq-0 -n songnodes
   ```

3. **Wait for automatic resolution:**
   Kubernetes will eventually garbage collect the stuck container and recreate the pod.

## Post-Restart Verification

After RabbitMQ pod successfully starts, run:
```bash
# 1. Check pod is running
kubectl get pods -n songnodes -l app.kubernetes.io/name=rabbitmq

# 2. Check vhost was auto-created
kubectl exec -n songnodes rabbitmq-0 -- rabbitmqctl list_vhosts

# 3. Check permissions
kubectl exec -n songnodes rabbitmq-0 -- rabbitmqctl list_permissions -p musicdb

# 4. Test with actual pod restart
kubectl delete pod rabbitmq-0 -n songnodes
sleep 30
kubectl exec -n songnodes rabbitmq-0 -- rabbitmqctl list_vhosts
```

Expected: musicdb vhost and permissions should exist after each restart.

## Benefits
- **No manual intervention:** Vhost created automatically on every pod start
- **Idempotent:** Hook can run multiple times without errors
- **Resilient:** Survives pod restarts, crashes, and cluster reboots
- **GitOps compliant:** Changes tracked in Git, managed by Flux

## Related Files
- `/home/marku/Documents/programming/songnodes/deploy/helm/songnodes/templates/rabbitmq.yaml`
- `/home/marku/Documents/programming/songnodes/services/websocket-api/main.py` (uses musicdb vhost)
- `/home/marku/Documents/programming/songnodes/services/metadata-enrichment/queue_init.py` (uses musicdb vhost)
- `/home/marku/Documents/programming/songnodes/scrapers/pipelines/enrichment_queue_publisher.py` (uses musicdb vhost)

## References
- Investigation report: websocket-api RabbitMQ connection failure
- Kubernetes lifecycle hooks: https://kubernetes.io/docs/concepts/containers/container-lifecycle-hooks/
- RabbitMQ vhost management: https://www.rabbitmq.com/vhosts.html
