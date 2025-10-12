# Phoenix Messaging: Cloudflare Tunnel Error (1033) Troubleshooting

**Date**: 2025-10-12
**Error Code**: 1033 (Cloudflare Tunnel Error)
**HTTP Status**: 530
**Previous Error**: 502 Bad Gateway (resolved)

---

## ⚠️ Current Issue: Cloudflare Tunnel Error

**Error Message**:
```
error code: 1033
Cloudflare Tunnel error

You've requested a page on a website (api.aiwfe.com) that is on the Cloudflare network.
The host (api.aiwfe.com) is configured as a Cloudflare Tunnel, and Cloudflare is currently
unable to resolve it.
```

**What This Means**:
- ✅ DNS resolution working (api.aiwfe.com → Cloudflare IPs)
- ✅ SSL/TLS certificate valid (issued by Google Trust Services)
- ✅ Cloudflare receiving requests
- ❌ **Cloudflare Tunnel (Argo Tunnel) to origin server is DOWN**

This is different from the earlier 502 error, which indicated backend pods weren't responding.
Now the issue is that the **Cloudflare Tunnel itself is disconnected**.

---

## 🔍 What is Cloudflare Tunnel?

Cloudflare Tunnel (formerly Argo Tunnel) creates a secure, outbound-only connection from your
origin server to Cloudflare's network WITHOUT exposing your origin IP or opening inbound firewall ports.

**Architecture**:
```
Phoenix Homestead K8s Cluster
  └─ cloudflared daemon (tunnel connector)
       ↓ Outbound HTTPS connection
     Cloudflare Network
       ↓ Public HTTPS
     api.aiwfe.com (your domain)
```

When the tunnel goes down, Cloudflare can't reach your origin, resulting in error 1033.

---

## 🔧 Diagnostic Steps

### Step 1: Check if cloudflared is Running

From your Phoenix homestead server:

```bash
# Check if cloudflared pod/container is running
kubectl get pods -n cloudflare-tunnel
# OR (if using a different namespace)
kubectl get pods -A | grep cloudflared

# Expected: Should show 1/1 Running
# If not present, tunnel was never set up or was removed
```

**Alternative (if using systemd service)**:
```bash
systemctl status cloudflared
# Should show: active (running)
```

### Step 2: Check Cloudflare Tunnel Logs

```bash
# If using Kubernetes
kubectl logs -n cloudflare-tunnel -l app=cloudflared --tail=50

# If using systemd
journalctl -u cloudflared -n 50 --no-pager

# Look for:
# - "connection established" (good)
# - "authentication failed" (bad - credentials issue)
# - "tunnel disconnected" (bad - network/config issue)
```

### Step 3: Verify Tunnel Configuration

Check your Cloudflare Tunnel configuration:

```bash
# If using config file (typical location)
cat /etc/cloudflared/config.yml

# Should contain:
# tunnel: <tunnel-id>
# credentials-file: /etc/cloudflared/<tunnel-id>.json
# ingress:
#   - hostname: api.aiwfe.com
#     service: http://phoenix-messaging.phoenix.svc.cluster.local:8034
#   - service: http_status:404
```

### Step 4: Check Cloudflare Dashboard

1. Log into Cloudflare Dashboard: https://dash.cloudflare.com
2. Select your domain: **aiwfe.com**
3. Navigate to: **Traffic** → **Cloudflare Tunnel**
4. Check tunnel status:
   - **Healthy** (green) → Tunnel connected
   - **Down** (red) → Tunnel disconnected
   - **Inactive** (gray) → Tunnel never connected or removed

### Step 5: Verify DNS Records

Ensure your DNS record points to the tunnel:

```bash
# Check DNS resolution
dig api.aiwfe.com

# Should return Cloudflare IPs like:
# 172.67.184.250
# 104.21.92.18
```

In Cloudflare Dashboard:
1. Go to **DNS** → **Records**
2. Find record for `api.aiwfe.com`
3. Should be **CNAME** pointing to `<tunnel-id>.cfargotunnel.com`

---

## 🛠️ Common Fixes

### Fix 1: Restart cloudflared

**Kubernetes**:
```bash
kubectl rollout restart deployment cloudflared -n cloudflare-tunnel
kubectl rollout status deployment cloudflared -n cloudflare-tunnel
```

**Systemd**:
```bash
sudo systemctl restart cloudflared
sudo systemctl status cloudflared
```

### Fix 2: Check Tunnel Credentials

If authentication is failing:

```bash
# Verify credentials file exists
ls -la /etc/cloudflared/*.json

# Recreate tunnel credentials (if missing)
cloudflared tunnel login
cloudflared tunnel create phoenix-messaging
cloudflared tunnel route dns phoenix-messaging api.aiwfe.com
```

### Fix 3: Reinstall cloudflared (if completely missing)

```bash
# Download latest cloudflared
wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64
chmod +x cloudflared-linux-amd64
sudo mv cloudflared-linux-amd64 /usr/local/bin/cloudflared

# Login to Cloudflare
cloudflared tunnel login

# Create tunnel
cloudflared tunnel create phoenix-messaging

# Configure tunnel
cat > /etc/cloudflared/config.yml <<EOF
tunnel: <your-tunnel-id>
credentials-file: /etc/cloudflared/<tunnel-id>.json

ingress:
  - hostname: api.aiwfe.com
    service: http://phoenix-messaging.phoenix.svc.cluster.local:8034
  - service: http_status:404
EOF

# Run tunnel
cloudflared tunnel run phoenix-messaging
```

### Fix 4: Check Firewall/Network

Cloudflare Tunnel requires **outbound HTTPS (443)** access:

```bash
# Test connectivity to Cloudflare
curl -I https://api.cloudflare.com
# Should return: HTTP/2 200

# Test from inside K8s cluster
kubectl run test-curl --rm -i --tty --image=curlimages/curl -- \
  curl -I https://api.cloudflare.com
```

### Fix 5: Verify Service Selector (if tunnel is up but 530 persists)

If tunnel shows "Healthy" in Cloudflare Dashboard but still getting 530:

```bash
# Test internal Phoenix Messaging service
kubectl run test-curl --rm -i --tty --image=curlimages/curl -- \
  curl http://phoenix-messaging.phoenix.svc.cluster.local:8034/health/ready

# If this fails, Phoenix Messaging service itself has issues
# If this works, tunnel ingress configuration is wrong
```

---

## 📊 Diagnostic Flow Chart

```
┌─────────────────────────────────────┐
│ Error 1033 / HTTP 530               │
└──────────────┬──────────────────────┘
               │
               ↓
┌─────────────────────────────────────┐
│ Is cloudflared pod/service running? │
└──────────────┬──────────────────────┘
               │
        ┌──────┴──────┐
        │             │
       YES           NO
        │             │
        ↓             ↓
┌───────────┐  ┌─────────────────┐
│ Check     │  │ Start/deploy    │
│ tunnel    │  │ cloudflared     │
│ logs      │  └─────────────────┘
└─────┬─────┘           │
      │                 │
      ↓                 ↓
┌─────────────────────────────────────┐
│ Tunnel status in Cloudflare Dashboard│
└──────────────┬──────────────────────┘
               │
        ┌──────┴──────┐
        │             │
     HEALTHY       DOWN
        │             │
        ↓             ↓
┌───────────┐  ┌─────────────────┐
│ Check DNS │  │ Restart tunnel  │
│ CNAME     │  │ Check creds     │
│ record    │  │ Check network   │
└───────────┘  └─────────────────┘
```

---

## ✅ Verification (After Fix)

Once tunnel is restored:

```bash
# 1. Check Cloudflare Dashboard
#    Tunnel status should be: Healthy (green)

# 2. Test Phoenix API
curl https://api.aiwfe.com/messaging/health/ready
# Expected: {"status":"ok","service":"Phoenix-Messaging"}

# 3. Check Phoenix Bridge
curl http://localhost:8035/health
# Expected: "status": "healthy", "reachable": true

# 4. Send test alert
curl -X POST "http://localhost:8035/test?severity=warning&alertname=TunnelTest"
# Expected: "status": "sent", alert delivered
```

---

## 🔑 Key Files & Locations

| Item | Location |
|:-----|:---------|
| **cloudflared config** | `/etc/cloudflared/config.yml` |
| **Tunnel credentials** | `/etc/cloudflared/<tunnel-id>.json` |
| **Systemd service** | `/etc/systemd/system/cloudflared.service` |
| **Cloudflare Dashboard** | https://dash.cloudflare.com |
| **Tunnel Documentation** | https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/ |

---

## 📞 Need More Help?

If tunnel issues persist after these steps:

1. **Check Cloudflare Status**: https://www.cloudflarestatus.com
2. **Cloudflare Community**: https://community.cloudflare.com
3. **Contact Cloudflare Support**: Via dashboard (paid plans)

---

## 🆚 Difference from 502 Error

| Error | Meaning | Location of Issue |
|:------|:--------|:------------------|
| **502 Bad Gateway** | Backend pods not responding | Phoenix Messaging pods in K8s |
| **1033 Tunnel Error** | Cloudflare tunnel disconnected | cloudflared daemon/connection |

The **502 error** means Phoenix Messaging pods exist but aren't healthy.
The **1033 error** means Cloudflare can't even reach your origin server via the tunnel.

---

**Next**: Once tunnel is restored, proceed to end-to-end testing (see `CURRENT_STATUS.md`)
