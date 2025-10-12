# Phoenix Messaging Integration Guide

## Architecture Overview

**Current Setup:**
- **Monitoring Stack**: Prometheus, Alertmanager, Phoenix Bridge → Running in **docker-compose**
- **Phoenix Messaging**: Running in **Kubernetes (K3s)** cluster
- **Challenge**: Docker containers need to reach K8s services

```
┌─────────────────────────────────────────────────────────┐
│ Docker Compose (monitoring stack)                       │
│                                                          │
│  ┌──────────────┐      ┌────────────────┐              │
│  │ Alertmanager │─────▶│ Phoenix Bridge │──┐           │
│  └──────────────┘      └────────────────┘  │           │
│                                             │           │
└─────────────────────────────────────────────┼───────────┘
                                              │
                                              │ HTTP
                                              ▼
                        ┌─────────────────────────────────┐
                        │ Kubernetes (K3s) - phoenix ns   │
                        │                                 │
                        │  ┌────────────────────┐         │
                        │  │ Phoenix Messaging  │         │
                        │  │ ClusterIP:         │         │
                        │  │ 10.43.140.92:8034  │         │
                        │  └────────────────────┘         │
                        └─────────────────────────────────┘
```

## Connection Methods

### Method 1: NodePort (RECOMMENDED - Persistent)

Expose Phoenix Messaging on the host network permanently.

```bash
# Create NodePort for Phoenix Messaging
kubectl patch svc phoenix-messaging -n phoenix -p '{
  "spec": {
    "type": "NodePort",
    "ports": [
      {
        "name": "http",
        "port": 8034,
        "targetPort": 8034,
        "nodePort": 30834,
        "protocol": "TCP"
      }
    ]
  }
}'

# Verify the NodePort
kubectl get svc phoenix-messaging -n phoenix
# Should show: 8034:30834/TCP
```

**Update .env file:**
```bash
echo "PHOENIX_MESSAGING_URL=http://localhost:30834/api/v1" >> .env
```

**Test connectivity:**
```bash
curl http://localhost:30834/api/v1/health
```

**Pros:**
- ✅ Persistent (survives restarts)
- ✅ No manual port forwarding needed
- ✅ Simple configuration

**Cons:**
- ⚠️ Exposes service on host network (use firewall if needed)

---

### Method 2: Port Forwarding (SIMPLE - Development)

Forward the K8s service to localhost temporarily.

```bash
# Forward Phoenix Messaging to localhost:8034
kubectl port-forward -n phoenix svc/phoenix-messaging 8034:8034 &

# Keep this running in the background
# Add to systemd or supervisor for persistence
```

**Update .env file:**
```bash
echo "PHOENIX_MESSAGING_URL=http://host.docker.internal:8034/api/v1" >> .env
```

**Make it persistent (optional):**
```bash
# Create systemd service
sudo tee /etc/systemd/system/phoenix-messaging-forward.service > /dev/null <<EOF
[Unit]
Description=Phoenix Messaging Port Forward
After=k3s.service

[Service]
Type=simple
User=$USER
Environment="KUBECONFIG=/etc/rancher/k3s/k3s.yaml"
ExecStart=/usr/local/bin/kubectl port-forward -n phoenix svc/phoenix-messaging 8034:8034
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable phoenix-messaging-forward.service
sudo systemctl start phoenix-messaging-forward.service
```

**Pros:**
- ✅ No changes to K8s services
- ✅ Works through firewalls
- ✅ Secure (localhost only)

**Cons:**
- ⚠️ Requires port-forward to stay running
- ⚠️ Manual setup after restarts (unless systemd service)

---

### Method 3: Host Network Mode (ADVANCED)

Run the bridge container in host network mode to access K8s cluster network directly.

**Update docker-compose.yml:**
```yaml
phoenix-alertmanager-bridge:
  network_mode: "host"
  environment:
    PHOENIX_MESSAGING_URL: http://10.43.140.92:8034/api/v1
```

**Pros:**
- ✅ Direct access to K8s cluster network
- ✅ No port forwarding or NodePort needed

**Cons:**
- ⚠️ Less isolated (container uses host network)
- ⚠️ Port conflicts possible
- ⚠️ May not work depending on K3s network plugin

---

### Method 4: Deploy Bridge in Kubernetes (PRODUCTION)

Move the Phoenix Alertmanager Bridge into Kubernetes alongside Phoenix Messaging.

**Create Kubernetes manifests:**

```yaml
# monitoring/k8s/phoenix-alertmanager-bridge.yaml
---
apiVersion: v1
kind: ConfigMap
metadata:
  name: phoenix-alertmanager-bridge-config
  namespace: monitoring
data:
  PHOENIX_MESSAGING_URL: "http://phoenix-messaging.phoenix.svc.cluster.local:8034/api/v1"
  SERVICE_NAME: "songnodes-monitoring"
  DEFAULT_RECIPIENT: "admin"

---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: phoenix-alertmanager-bridge
  namespace: monitoring
  labels:
    app: phoenix-alertmanager-bridge
spec:
  replicas: 2
  selector:
    matchLabels:
      app: phoenix-alertmanager-bridge
  template:
    metadata:
      labels:
        app: phoenix-alertmanager-bridge
    spec:
      containers:
      - name: bridge
        image: your-registry/phoenix-alertmanager-bridge:latest
        ports:
        - containerPort: 8035
          name: http
        envFrom:
        - configMapRef:
            name: phoenix-alertmanager-bridge-config
        resources:
          requests:
            memory: "128Mi"
            cpu: "100m"
          limits:
            memory: "256Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 8035
          initialDelaySeconds: 10
          periodSeconds: 30
        readinessProbe:
          httpGet:
            path: /health
            port: 8035
          initialDelaySeconds: 5
          periodSeconds: 10

---
apiVersion: v1
kind: Service
metadata:
  name: phoenix-alertmanager-bridge
  namespace: monitoring
spec:
  selector:
    app: phoenix-alertmanager-bridge
  ports:
  - name: http
    port: 8035
    targetPort: 8035
  type: ClusterIP
```

**Deploy:**
```bash
# Build and push image
docker build -t your-registry/phoenix-alertmanager-bridge:latest \
  ./monitoring/phoenix-alertmanager-bridge
docker push your-registry/phoenix-alertmanager-bridge:latest

# Deploy to K8s
kubectl create namespace monitoring --dry-run=client -o yaml | kubectl apply -f -
kubectl apply -f monitoring/k8s/phoenix-alertmanager-bridge.yaml

# Verify
kubectl get pods -n monitoring -l app=phoenix-alertmanager-bridge
kubectl get svc -n monitoring phoenix-alertmanager-bridge
```

**Update Alertmanager config:**
```yaml
receivers:
  - name: 'phoenix-messaging'
    webhook_configs:
      - url: 'http://phoenix-alertmanager-bridge.monitoring.svc.cluster.local:8035/webhook'
        send_resolved: true
```

**Pros:**
- ✅ Native K8s service discovery
- ✅ Scales with replicas
- ✅ Production-ready
- ✅ No cross-runtime networking issues

**Cons:**
- ⚠️ Requires moving monitoring stack to K8s
- ⚠️ More complex deployment

---

## Recommended Setup Path

### For Development: Use Method 1 (NodePort)

```bash
# Step 1: Expose Phoenix Messaging via NodePort
kubectl patch svc phoenix-messaging -n phoenix -p '{
  "spec": {
    "type": "NodePort",
    "ports": [{
      "name": "http",
      "port": 8034,
      "targetPort": 8034,
      "nodePort": 30834,
      "protocol": "TCP"
    }]
  }
}'

# Step 2: Configure environment
echo "PHOENIX_MESSAGING_URL=http://localhost:30834/api/v1" >> .env

# Step 3: Build and start bridge
docker compose build phoenix-alertmanager-bridge
docker compose up -d phoenix-alertmanager-bridge

# Step 4: Verify connectivity
docker compose logs phoenix-alertmanager-bridge
curl http://localhost:8035/health

# Step 5: Test alert flow
curl -X POST http://localhost:8035/test?severity=warning&alertname=TestAlert
```

### For Production: Use Method 4 (K8s Deployment)

Move the entire monitoring stack into Kubernetes for consistency.

---

## Troubleshooting

### Issue: "Connection refused" from bridge

**Check 1: Verify Phoenix Messaging is running**
```bash
kubectl get pods -n phoenix -l app=phoenix-messaging
kubectl logs -n phoenix -l app=phoenix-messaging --tail=50
```

**Check 2: Test connectivity from another pod**
```bash
kubectl run test-curl --rm -i --tty --image=curlimages/curl -- \
  curl http://phoenix-messaging.phoenix.svc.cluster.local:8034/api/v1/health
```

**Check 3: Verify NodePort (if using Method 1)**
```bash
kubectl get svc phoenix-messaging -n phoenix
# Should show: 8034:30834/TCP

# Test from host
curl http://localhost:30834/api/v1/health
```

**Check 4: Test from bridge container**
```bash
docker compose exec phoenix-alertmanager-bridge \
  python -c "import urllib.request; print(urllib.request.urlopen('${PHOENIX_MESSAGING_URL:-http://localhost:30834/api/v1}/health').read())"
```

### Issue: "Name resolution failed"

**Check DNS resolution in bridge container:**
```bash
docker compose exec phoenix-alertmanager-bridge ping phoenix-messaging-k3s
docker compose exec phoenix-alertmanager-bridge cat /etc/hosts
```

**Solution:** Use IP address directly or localhost with NodePort/port-forward.

### Issue: "Health check failing"

**Check bridge logs:**
```bash
docker compose logs -f phoenix-alertmanager-bridge
```

**Common causes:**
- Phoenix Messaging not reachable
- Wrong URL in environment variable
- Authentication required (JWT token missing)

---

## API Examples

### Send Test Notification

```bash
# Via bridge test endpoint
curl -X POST "http://localhost:8035/test?severity=critical&alertname=TestCriticalAlert&scraper=test-scraper"

# Direct to Phoenix Messaging (if NodePort enabled)
curl -X POST http://localhost:30834/api/v1/notifications/send \
  -H "Content-Type: application/json" \
  -d '{
    "template_name": "system_alert",
    "recipient_user_id": "admin",
    "channels": ["websocket", "email"],
    "priority": "urgent",
    "variables": {
      "alert_message": "Test alert from monitoring",
      "service": "songnodes-monitoring",
      "alertname": "TestAlert",
      "severity": "critical"
    }
  }'
```

### Verify Alert Delivery

```bash
# Check bridge metrics
curl http://localhost:8035/health

# Check Phoenix Messaging metrics
curl http://localhost:30834/api/v1/health/metrics

# Check Alertmanager status
curl http://localhost:9093/api/v2/status
```

---

## Configuration Reference

### Environment Variables

| Variable | Description | Default | Example |
|:---------|:------------|:--------|:--------|
| `PHOENIX_MESSAGING_URL` | Phoenix Messaging API URL | N/A | `http://localhost:30834/api/v1` |
| `SERVICE_NAME` | Service identifier in alerts | `songnodes-monitoring` | `production-monitoring` |
| `DEFAULT_RECIPIENT` | Default notification recipient | `admin` | `ops-team` |

### Severity Mapping

| Prometheus Severity | Phoenix ErrorSeverity | Notification Channels |
|:-------------------|:---------------------|:---------------------|
| `critical` | `CRITICAL` | WebSocket + Email + SMS |
| `error` | `ERROR` | WebSocket + Email |
| `warning` | `WARNING` | WebSocket only |
| `info` | `INFO` | Log only (no notifications) |

---

## Next Steps

1. ✅ Choose connection method (NodePort recommended)
2. ✅ Configure environment variables
3. ✅ Build and deploy bridge service
4. ✅ Test alert flow end-to-end
5. ✅ Configure alert routing rules in Alertmanager
6. ✅ Set up Grafana dashboards for alert monitoring

---

## Support

- **Phoenix Messaging Docs**: `/home/marku/phoenix-digital-homestead/services-python/phoenix-messaging/README.md`
- **Bridge Service Code**: `./monitoring/phoenix-alertmanager-bridge/app.py`
- **Alertmanager Config**: `./monitoring/alertmanager/alertmanager.yml`
