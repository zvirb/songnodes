# Quick Start: Phoenix Messaging Integration

## ✅ What's Been Completed

1. ✅ Created Phoenix Alertmanager Bridge service
2. ✅ Configured Alertmanager to route alerts to Phoenix
3. ✅ Built Docker image for bridge service
4. ✅ Added environment configuration to .env
5. ✅ Created comprehensive documentation

## 🚀 Next Steps (2 minutes)

### Step 1: Expose Phoenix Messaging via NodePort

From your phoenix-digital-homestead directory (or wherever you have kubectl access):

```bash
# Navigate to where you have kubectl access
cd /home/marku/phoenix-digital-homestead

# Expose Phoenix Messaging on NodePort 30834
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

# Verify it's exposed
kubectl get svc phoenix-messaging -n phoenix
# Should show: 8034:30834/TCP
```

### Step 2: Test Phoenix Messaging Connectivity

```bash
# Test from host
curl http://localhost:30834/api/v1/health

# Should return: {"status": "healthy", ...}
```

### Step 3: Start the Bridge Service

```bash
# Navigate back to songnodes project
cd /mnt/my_external_drive/programming/songnodes

# Start the Phoenix Alertmanager Bridge
docker compose up -d phoenix-alertmanager-bridge

# Check status
docker compose ps phoenix-alertmanager-bridge

# View logs
docker compose logs -f phoenix-alertmanager-bridge
```

### Step 4: Verify Bridge Connectivity

```bash
# Check bridge health (includes Phoenix connectivity check)
curl http://localhost:8035/health

# Should return:
# {
#   "status": "healthy",
#   "service": "phoenix-alertmanager-bridge",
#   "phoenix_messaging": {
#     "url": "http://localhost:30834/api/v1",
#     "reachable": true
#   }
# }
```

### Step 5: Send Test Alert

```bash
# Send a test warning alert
curl -X POST "http://localhost:8035/test?severity=warning&alertname=PhoenixIntegrationTest&scraper=setup-test"

# Send a test critical alert (triggers WebSocket + Email + SMS)
curl -X POST "http://localhost:8035/test?severity=critical&alertname=CriticalAlertTest&scraper=setup-test"

# Check the response:
# {
#   "status": "sent",
#   "notification": {...},
#   "channels": ["websocket", "email", "sms"],  # for critical
#   "phoenix_messaging_url": "http://localhost:30834/api/v1"
# }
```

### Step 6: Restart Alertmanager

```bash
# Restart Alertmanager to pick up the new Phoenix webhook configuration
docker compose restart alertmanager

# Verify it's running
docker compose ps alertmanager
```

## 🎉 Done!

Your monitoring stack now routes alerts through Phoenix Messaging with intelligent channel selection:

- **CRITICAL** alerts → WebSocket + Email + SMS
- **ERROR** alerts → WebSocket + Email
- **WARNING** alerts → WebSocket only
- **INFO** alerts → Logged only (no notifications)

## 📊 Monitoring & Verification

### View Bridge Logs
```bash
docker compose logs -f phoenix-alertmanager-bridge
```

### Check Alertmanager Status
```bash
curl http://localhost:9093/api/v2/status
```

### View Active Alerts
```bash
curl http://localhost:9093/api/v2/alerts
```

### Check Phoenix Messaging Pods
```bash
kubectl get pods -n phoenix -l app=phoenix-messaging
kubectl logs -n phoenix -l app=phoenix-messaging --tail=50
```

## 🐛 Troubleshooting

### Issue: "Connection refused" from bridge

**Check 1: Is Phoenix Messaging running?**
```bash
kubectl get pods -n phoenix -l app=phoenix-messaging
# Should show: 2/2 Running
```

**Check 2: Is NodePort configured?**
```bash
kubectl get svc phoenix-messaging -n phoenix
# Should show: ClusterIP → NodePort and 8034:30834/TCP
```

**Check 3: Can you reach Phoenix Messaging from host?**
```bash
curl http://localhost:30834/api/v1/health
```

**Check 4: Are bridge and Phoenix using same port?**
```bash
# Check .env file
grep PHOENIX_MESSAGING_URL .env
# Should show: PHOENIX_MESSAGING_URL=http://localhost:30834/api/v1
```

### Issue: Bridge health check shows "degraded"

This means the bridge can't reach Phoenix Messaging. Check:

```bash
# Test from inside bridge container
docker compose exec phoenix-alertmanager-bridge \
  python -c "import urllib.request; print(urllib.request.urlopen('http://localhost:30834/api/v1/health').read())"

# If this fails, check:
# 1. NodePort is configured (kubectl get svc phoenix-messaging -n phoenix)
# 2. Phoenix Messaging pods are running (kubectl get pods -n phoenix)
# 3. Port 30834 is not blocked by firewall
```

### Issue: Test alert sent but not received

**Check Phoenix Messaging logs:**
```bash
kubectl logs -n phoenix -l app=phoenix-messaging --tail=100 | grep -i error
```

**Check bridge logs:**
```bash
docker compose logs phoenix-alertmanager-bridge | grep -i error
```

**Verify notification was sent:**
```bash
# Check bridge response from test endpoint
curl -v -X POST "http://localhost:8035/test?severity=warning&alertname=DebugTest"
# Should show 200 OK and "status": "sent"
```

## 📚 Additional Documentation

- **Full Integration Guide**: `docs/PHOENIX_MESSAGING_INTEGRATION.md`
- **Bridge Source Code**: `monitoring/phoenix-alertmanager-bridge/app.py`
- **Alertmanager Config**: `monitoring/alertmanager/alertmanager.yml`
- **Automated Setup Script**: `./setup-phoenix-integration.sh` (requires kubectl access)

## 🔗 Service URLs

| Service | URL | Description |
|:--------|:----|:------------|
| **Phoenix Messaging** | http://localhost:30834 | Main Phoenix API (via NodePort) |
| **Bridge Service** | http://localhost:8035 | Alertmanager webhook receiver |
| **Bridge Health** | http://localhost:8035/health | Health check with Phoenix connectivity |
| **Bridge Test** | http://localhost:8035/test | Send test notification |
| **Alertmanager** | http://localhost:9093 | Prometheus Alertmanager UI |
| **Prometheus** | http://localhost:9091 | Prometheus metrics UI |
| **Grafana** | http://localhost:3001 | Monitoring dashboards |

## 🎯 Next Steps (Optional)

1. **Configure Alert Routing Rules**: Edit `monitoring/alertmanager/alertmanager.yml` to add custom routing
2. **Create Grafana Dashboards**: Monitor alert delivery rates and Phoenix Messaging health
3. **Set Up Alert Silencing**: Use Alertmanager UI to silence non-critical alerts during maintenance
4. **Production Deployment**: Move bridge service into Kubernetes for better scalability (see `docs/PHOENIX_MESSAGING_INTEGRATION.md` Method 4)

## 💡 Pro Tips

- Use **severity labels** in Prometheus alerts to control notification channels
- **Critical** alerts wake people up (SMS) - use sparingly!
- **Warnings** are for monitoring only - good for tracking trends
- Check Phoenix Messaging UI regularly to ensure notifications are being delivered

---

Need help? Check the full documentation or create an issue on GitHub.
