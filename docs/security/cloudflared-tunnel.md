# Cloudflare Tunnel Setup (`cloudflared`)

This document describes the configuration, deployment, and troubleshooting of Cloudflare Tunnel (`cloudflared`) for securely exposing the SongNodes application at `song.aiwfe.com`.

---

## 1. Overview

Cloudflare Tunnel creates an encrypted outbound-only connection between the SongNodes local/development Docker environment and Cloudflare's edge network. This eliminates the need to expose open inbound ports, configure NAT port forwarding, or manage public TLS certificates locally.

- **Target Domain / Hostname**: `song.aiwfe.com`
- **Origin Service**: SongNodes frontend container (`frontend:8080`)
- **Connector Service**: `cloudflared` running as a Docker Compose service in `compose.dev.yaml`

---

## 2. Docker Compose Configuration

The connector is declared in `compose.dev.yaml`:

```yaml
  cloudflared:
    image: cloudflare/cloudflared:latest
    container_name: songnodes-cloudflared
    restart: unless-stopped
    command: tunnel run
    environment:
      - TUNNEL_TOKEN=${CLOUDFLARE_TUNNEL_TOKEN:-}
    depends_on:
      frontend: { condition: service_healthy }
```

### Key Design Aspects:
- **Zero Inbound Ports**: `cloudflared` operates solely via outbound HTTPS/QUIC connections to Cloudflare Edge.
- **Internal Network Resolution**: Because `cloudflared` shares the Compose default network (`songnodes-dev_default`), it can route traffic directly to the internal container DNS hostname `frontend` on port `8080`.
- **Dependency Guard**: The `depends_on` condition ensures `frontend` is healthy before the tunnel connector process runs, avoiding initial ingress 502 errors during container boot.

---

## 3. Environment Variables

| Variable | Description | Default | Required |
|---|---|---|---|
| `CLOUDFLARE_TUNNEL_TOKEN` | Base64-encoded tunnel credential token generated in Cloudflare Zero Trust dashboard. | `""` (empty) | Yes (for active tunnel operation) |

### Setting the Token
Store your token in an untracked `.env` file at the repository root or export it directly in your shell:

```bash
# In .env (untracked):
CLOUDFLARE_TUNNEL_TOKEN=eyJhIjoi...

# Or export in shell:
export CLOUDFLARE_TUNNEL_TOKEN="eyJhIjoi..."
```

> **Security Note**: Never commit `.env` or raw Cloudflare tunnel tokens to version control.

---

## 4. Cloudflare Zero Trust Dashboard Configuration

To route `song.aiwfe.com` through the tunnel to SongNodes:

1. Navigate to **Cloudflare Zero Trust Dashboard** > **Networks** > **Tunnels**.
2. Select your tunnel (or click **Create a tunnel**, choose `cloudflared`, and name it e.g. `songnodes-dev`).
3. Under the **Public Hostname** tab, add a route:
   - **Public Hostname**: `song.aiwfe.com`
     - Subdomain: `song`
     - Domain: `aiwfe.com`
   - **Service**:
     - Type: `HTTP`
     - URL: `frontend:8080` (when using Docker Compose) or `localhost:3006` (when running `cloudflared` standalone on host)
4. (Optional) Under **Additional application settings** > **HTTP Settings**:
   - Enable **HTTP2 Support** if desired.
   - Set **HTTP Host Header** if backend hostname rewriting is needed (default is usually sufficient).
5. Save the hostname configuration.

---

## 5. Running the Connector

### A. Via Docker Compose (Recommended)

To start the tunnel alongside the full development stack:

```bash
# Start all services including cloudflared
docker compose -f compose.dev.yaml up -d

# Or start cloudflared specifically once the stack is running
docker compose -f compose.dev.yaml up -d cloudflared
```

To view connector logs:

```bash
docker compose -f compose.dev.yaml logs -f cloudflared
```

### B. Via Standalone Local Binary (Alternative)

If testing without the Dockerized connector:

1. Install `cloudflared` locally (e.g. `brew install cloudflared` or `winget install Cloudflare.cloudflared`).
2. Run the tunnel with your token:
   ```bash
   cloudflared tunnel run --token "$CLOUDFLARE_TUNNEL_TOKEN"
   ```
3. Ensure your Cloudflare Public Hostname points to `http://localhost:3006` (the published host port for `frontend`).

---

## 6. Troubleshooting Ingress to `song.aiwfe.com`

### 1. Tunnel Container Keeps Restarting or Exits
- **Check Token**: Verify that `CLOUDFLARE_TUNNEL_TOKEN` is populated:
  ```bash
  docker compose -f compose.dev.yaml exec cloudflared env | grep TUNNEL_TOKEN
  ```
  If empty, `cloudflared tunnel run` will exit immediately with an error indicating missing tunnel credentials.
- **Check Container Logs**:
  ```bash
  docker compose -f compose.dev.yaml logs cloudflared
  ```
  Look for `Cannot determine default configuration path` or authentication token decoding errors.

### 2. 502 Bad Gateway at `song.aiwfe.com`
- **Cause**: Cloudflare edge reached the tunnel connector, but `cloudflared` could not connect to `frontend:8080`.
- **Resolution**:
  1. Verify frontend container is running and healthy:
     ```bash
     docker compose -f compose.dev.yaml ps frontend
     ```
  2. Verify internal network reachability from within the Compose network:
     ```bash
     docker compose -f compose.dev.yaml exec cloudflared wget -q -O - http://frontend:8080/
     ```
  3. Ensure the service URL in the Cloudflare Zero Trust dashboard matches `http://frontend:8080` (not `localhost` or `127.0.0.1`, which would refer to the `cloudflared` container itself).

### 3. Frontend Service Not Starting / Dependency Blocked
- Cloudflared has `depends_on: frontend: { condition: service_healthy }`.
- If `frontend` fails healthchecks, `cloudflared` will not start.
- Check frontend healthcheck logs:
  ```bash
  docker compose -f compose.dev.yaml logs frontend
  ```
- Ensure upstream dependencies (`rest-api` on port 8082, `graph-api` on port 8084) are healthy or started.

### 4. 530 / DNS Resolution Errors
- Verify DNS record in Cloudflare Dashboard: Cloudflare Tunnel automatically creates a `CNAME` record pointing `song.aiwfe.com` to `<tunnel-uuid>.cfargotunnel.com`.
- Verify the domain `aiwfe.com` is active on Cloudflare and nameservers are verified.
