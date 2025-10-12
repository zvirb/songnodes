# Phoenix Messaging 502 Error Troubleshooting

## Current Issue

When accessing `https://api.aiwfe.com/messaging/health/ready`, we're getting:

```
error code: 502
```

## What This Means

A **502 Bad Gateway** error indicates that:
- ✅ Domain is resolving correctly (DNS working)
- ✅ SSL/TLS handshake is successful (HTTPS working)
- ✅ Ingress controller is receiving requests
- ❌ Backend service (Phoenix Messaging pods) is not responding

## Diagnostic Steps

### Step 1: Check Phoenix Messaging Pods

```bash
kubectl get pods -n phoenix -l app=phoenix-messaging

# Expected output:
# NAME                                 READY   STATUS    RESTARTS   AGE
# phoenix-messaging-75d449849c-xxxxx   1/1     Running   0          Xm
```

**If pods are not Running:**
```bash
# Check pod status
kubectl describe pods -n phoenix -l app=phoenix-messaging

# Check pod logs
kubectl logs -n phoenix -l app=phoenix-messaging --tail=100
```

### Step 2: Check Service Configuration

```bash
# Check if service exists and has endpoints
kubectl get svc phoenix-messaging -n phoenix -o wide
kubectl get endpoints phoenix-messaging -n phoenix

# Expected: Should show ClusterIP and endpoint IPs
```

**If no endpoints:**
This means the service selector doesn't match the pods. Check:
```bash
# Compare service selector to pod labels
kubectl get svc phoenix-messaging -n phoenix -o jsonpath='{.spec.selector}'
kubectl get pods -n phoenix -l app=phoenix-messaging -o jsonpath='{.items[0].metadata.labels}'
```

### Step 3: Check Ingress Configuration

```bash
# Check ingress resource
kubectl get ingress -n phoenix phoenix-messaging-ingress -o yaml

# Check ingress backend
kubectl describe ingress -n phoenix phoenix-messaging-ingress
```

**Look for:**
- Backend service name: `phoenix-messaging`
- Backend port: `8034`
- Host: `api.aiwfe.com`
- Path: `/messaging/`

### Step 4: Check Certificate Status

```bash
# Check if SSL certificate is ready
kubectl get certificate -n phoenix phoenix-messaging-tls

# Should show: READY=True
```

**If not ready:**
```bash
kubectl describe certificate -n phoenix phoenix-messaging-tls
kubectl logs -n cert-manager deploy/cert-manager
```

### Step 5: Test from Inside Cluster

```bash
# Test service directly from within cluster
kubectl run test-curl --rm -i --tty --image=curlimages/curl -- \
  curl -v http://phoenix-messaging.phoenix.svc.cluster.local:8034/health/ready

# Should return: {"status":"ok",...}
```

**If this works:** The issue is with the ingress configuration.
**If this fails:** The issue is with Phoenix Messaging service itself.

## Common Fixes

### Fix 1: Restart Phoenix Messaging Pods

```bash
# Force pod restart
kubectl rollout restart deployment phoenix-messaging -n phoenix

# Wait for pods to be ready
kubectl rollout status deployment phoenix-messaging -n phoenix
```

### Fix 2: Fix Service Selector Mismatch

If you previously fixed a label mismatch, ensure the service was updated:

```bash
# Check current service definition
kubectl get svc phoenix-messaging -n phoenix -o yaml > /tmp/svc.yaml

# Edit if needed
kubectl edit svc phoenix-messaging -n phoenix

# Ensure spec.selector matches pod labels:
# spec:
#   selector:
#     app: phoenix-messaging
#     app.kubernetes.io/name: phoenix-messaging
```

### Fix 3: Check Ingress Backend Configuration

```bash
# Verify ingress backend
kubectl get ingress phoenix-messaging-ingress -n phoenix -o jsonpath='{.spec.rules[0].http.paths[0].backend}'

# Should show:
# {"service":{"name":"phoenix-messaging","port":{"number":8034}}}
```

If wrong, update the ingress:
```bash
kubectl edit ingress phoenix-messaging-ingress -n phoenix
```

### Fix 4: DNS Propagation (If Just Set Up)

If you just configured DNS:
```bash
# Check if DNS has propagated
dig api.aiwfe.com +short

# Should return your server's public IP
```

**Wait time:** DNS propagation can take 5-60 minutes.

### Fix 5: Check Nginx Ingress Controller Logs

```bash
# Find ingress controller pod
kubectl get pods -n ingress-nginx

# Check logs for errors
kubectl logs -n ingress-nginx <ingress-controller-pod-name> --tail=100
```

Look for errors related to:
- Backend service connection failures
- SSL/TLS errors
- Upstream errors

## Quick Fix Script

Run this comprehensive diagnostic:

```bash
#!/bin/bash
echo "=== Phoenix Messaging 502 Diagnostic ==="
echo ""

echo "1. Checking pods..."
kubectl get pods -n phoenix -l app=phoenix-messaging

echo ""
echo "2. Checking service..."
kubectl get svc phoenix-messaging -n phoenix -o wide

echo ""
echo "3. Checking endpoints..."
kubectl get endpoints phoenix-messaging -n phoenix

echo ""
echo "4. Checking ingress..."
kubectl get ingress -n phoenix phoenix-messaging-ingress

echo ""
echo "5. Checking certificate..."
kubectl get certificate -n phoenix phoenix-messaging-tls

echo ""
echo "6. Testing internal connectivity..."
kubectl run test-curl-$(date +%s) --rm -i --timeout=30s --image=curlimages/curl -- \
  curl -s http://phoenix-messaging.phoenix.svc.cluster.local:8034/health/ready || echo "Internal test failed"

echo ""
echo "7. Checking ingress controller logs..."
kubectl logs -n ingress-nginx -l app.kubernetes.io/name=ingress-nginx --tail=20

echo ""
echo "=== Diagnostic Complete ==="
```

## Resolution Checklist

- [ ] Phoenix Messaging pods are Running (1/1 Ready)
- [ ] Service has endpoints (not \<none\>)
- [ ] Service selector matches pod labels
- [ ] Ingress backend points to correct service:port
- [ ] Certificate is READY
- [ ] DNS resolves to correct IP
- [ ] Internal connectivity test passes

## After Resolution

Once the 502 error is resolved, test:

```bash
# Test health endpoint
curl https://api.aiwfe.com/messaging/health/ready

# Should return:
# {"status":"ok","service":"Phoenix-Messaging"}

# Test from Alertmanager Bridge
curl http://localhost:8035/health

# Should show phoenix_messaging.reachable = true
```

## Need Help?

If still stuck after these steps:

1. Collect diagnostic output:
   ```bash
   kubectl get all -n phoenix > /tmp/phoenix-status.txt
   kubectl logs -n phoenix -l app=phoenix-messaging --tail=200 > /tmp/phoenix-logs.txt
   kubectl describe ingress -n phoenix phoenix-messaging-ingress > /tmp/ingress-details.txt
   ```

2. Check Phoenix Messaging documentation at:
   `/home/marku/phoenix-digital-homestead/docs/MESSAGING_INTERNET_ACCESS_GUIDE.md`

3. Review the setup that was just completed - it may need a pod restart or DNS propagation time.
