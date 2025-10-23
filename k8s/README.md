# SongNodes Kubernetes Deployment

> **Heads-up:** the manifests in `k8s/` are now considered reference material. The
> live configuration is rendered from the Helm chart under
> `deploy/helm/songnodes` and reconciled by Flux CD. Use Skaffold for local
> development builds so that image tags and Helm values stay in sync.

## ✳️ Current Workflow Overview

| Scenario | Tooling | What Happens |
| --- | --- | --- |
| Local Iteration | `skaffold dev` | Builds all SongNodes service images locally and deploys the Helm chart with development overrides (single replicas, no HPAs, no ingress). |
| CI/Release Build | `skaffold build -p flux --default-repo <registry>` | Builds & pushes images, updates Helm values on the fly (no deploy). Flux picks up new commits and rolls the cluster. |
| Cluster Sync | `kubectl apply -k deploy/flux` | Installs/updates the GitRepository + HelmRelease so Flux tracks the chart. |

### Local Development with Skaffold

1. **Prerequisites**: Docker, kubectl, helm, skaffold, and a running cluster
   (Kind/Minikube/K3d). Ensure your kube-context points at that cluster.
2. **Bootstrap dependencies** (Postgres, Redis, RabbitMQ storage is ephemeral in
   dev):
   ```bash
   skaffold dev
   ```
   Skaffold watches the codebase, rebuilds images, and performs rolling updates
   via Helm. To exit, press `Ctrl+C`.
3. **Debug tips**: use `skaffold dev --no-prune=false --cache-artifacts=true`
   for faster rebuilds, and `skaffold status` to see the active deployment loop.

### Building Images for Flux-controlled environments

1. Authenticate to the container registry that Flux pulls from.
2. Build & push versioned images while updating the HelmRelease values:
   ```bash
   skaffold build -p flux --default-repo <registry.example.com/songnodes>
   ```
   The profile disables namespace/secret creation and leaves deployment to Flux.
3. Commit the resulting Git changes (if any) and push; Flux will reconcile using
   the Helm chart.

### Installing/Updating the Flux Stack

```bash
kubectl apply -k deploy/flux
```

This seeds the `GitRepository` and `HelmRelease`. Flux continuously pulls the
chart and applies it to the `songnodes` namespace. To force a sync, run:

```bash
flux reconcile helmrelease songnodes --namespace flux-system
```

### Rendering manifests locally (optional)

```bash
helm template songnodes deploy/helm/songnodes \
  --values deploy/helm/songnodes/values-dev.yaml
```

## 📁 Directory Structure (Legacy Reference)

The original raw manifests are kept for historical context:

## 📁 Directory Structure

```
k8s/
├── base/                           # Base configuration
│   ├── namespace.yaml              # Namespace definition
│   ├── configmap.yaml              # Application configuration
│   ├── secret.yaml                 # Secrets template (CHANGE_ME values)
│   ├── hpa.yaml                    # HorizontalPodAutoscalers
│   └── networkpolicy.yaml          # Network security policies
├── core/                           # Stateful services
│   ├── postgres-statefulset.yaml   # PostgreSQL database
│   ├── redis-deployment.yaml       # Redis cache
│   └── rabbitmq-statefulset.yaml   # RabbitMQ message queue
├── services/                       # Application services
│   ├── rest-api-deployment.yaml
│   ├── graph-visualization-deployment.yaml
│   ├── websocket-api-deployment.yaml
│   ├── nlp-processor-deployment.yaml
│   ├── scraper-orchestrator-deployment.yaml
│   └── frontend-deployment.yaml
├── ingress/                        # Ingress configuration
│   └── ingress.yaml
└── overlays/                       # Environment-specific overrides
    ├── development/
    └── production/
```

## 🚀 Quick Start

### Prerequisites

1. **Kubernetes Cluster** (v1.25+)
   - Local: Minikube, Kind, Docker Desktop
   - Cloud: GKE, EKS, AKS, DigitalOcean

2. **kubectl** installed and configured
   ```bash
   kubectl version --client
   ```

3. **NGINX Ingress Controller** (if using Ingress)
   ```bash
   kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.8.1/deploy/static/provider/cloud/deploy.yaml
   ```

4. **Metrics Server** (for HPA)
   ```bash
   kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml
   ```

### Deployment Steps

#### 1. Create Namespace

```bash
kubectl apply -f k8s/base/namespace.yaml
```

#### 2. Configure Secrets

**IMPORTANT**: Update secrets with actual values before deployment.

```bash
# Copy secret template
cp k8s/base/secret.yaml k8s/base/secret-actual.yaml

# Edit with actual credentials
vim k8s/base/secret-actual.yaml
# Replace all "CHANGE_ME" values

# Apply secrets
kubectl apply -f k8s/base/secret-actual.yaml

# Add to .gitignore
echo "k8s/base/secret-actual.yaml" >> .gitignore
```

**Alternative: Create from .env file**:
```bash
kubectl create secret generic songnodes-secrets \
  --from-env-file=.env \
  -n songnodes
```

#### 3. Apply ConfigMap

```bash
kubectl apply -f k8s/base/configmap.yaml
```

#### 4. Deploy Core Services (Databases)

```bash
# PostgreSQL
kubectl apply -f k8s/core/postgres-statefulset.yaml

# Redis
kubectl apply -f k8s/core/redis-deployment.yaml

# RabbitMQ
kubectl apply -f k8s/core/rabbitmq-statefulset.yaml

# Wait for databases to be ready
kubectl wait --for=condition=ready pod -l app.kubernetes.io/name=postgres -n songnodes --timeout=300s
kubectl wait --for=condition=ready pod -l app.kubernetes.io/name=redis -n songnodes --timeout=300s
kubectl wait --for=condition=ready pod -l app.kubernetes.io/name=rabbitmq -n songnodes --timeout=300s
```

#### 5. Initialize Database Schema

```bash
# Create ConfigMap with SQL init scripts
kubectl create configmap postgres-init-scripts \
  --from-file=sql/init/ \
  -n songnodes

# Restart PostgreSQL to run init scripts (if StatefulSet was already running)
kubectl rollout restart statefulset postgres -n songnodes
```

#### 6. Deploy Backend Services

```bash
# REST API
kubectl apply -f k8s/services/rest-api-deployment.yaml

# Graph Visualization API
kubectl apply -f k8s/services/graph-visualization-deployment.yaml

# WebSocket API
kubectl apply -f k8s/services/websocket-api-deployment.yaml

# NLP Processor
kubectl apply -f k8s/services/nlp-processor-deployment.yaml

# Scraper Orchestrator
kubectl apply -f k8s/services/scraper-orchestrator-deployment.yaml

# Wait for services to be ready
kubectl wait --for=condition=available deployment --all -n songnodes --timeout=300s
```

#### 7. Deploy Frontend

```bash
kubectl apply -f k8s/services/frontend-deployment.yaml
```


```bash

```

#### 9. Configure Ingress

```bash
# Update domain names in ingress.yaml
vim k8s/ingress/ingress.yaml
# Replace songnodes.example.com with your actual domain

# Apply ingress
kubectl apply -f k8s/ingress/ingress.yaml
```

#### 10. Apply HPA and Network Policies

```bash
# HorizontalPodAutoscalers
kubectl apply -f k8s/base/hpa.yaml

# NetworkPolicies (security)
kubectl apply -f k8s/base/networkpolicy.yaml
```

## 🔍 Verification

### Check All Pods

```bash
kubectl get pods -n songnodes
```

Expected output:
```
NAME                                  READY   STATUS    RESTARTS   AGE
postgres-0                            1/1     Running   0          5m
redis-xxx                             1/1     Running   0          5m
rabbitmq-0                            1/1     Running   0          5m
rest-api-xxx                          1/1     Running   0          3m
graph-visualization-xxx               1/1     Running   0          3m
websocket-api-xxx                     1/1     Running   0          3m
nlp-processor-xxx                     1/1     Running   0          3m
scraper-orchestrator-xxx              1/1     Running   0          3m
frontend-xxx                          1/1     Running   0          2m
```

### Check Services

```bash
kubectl get svc -n songnodes
```

### Check Ingress

```bash
kubectl get ingress -n songnodes
kubectl describe ingress songnodes-ingress -n songnodes
```

### View Logs

```bash
# Specific service
kubectl logs -f deployment/rest-api -n songnodes

# All services
kubectl logs -f -l app.kubernetes.io/component=backend -n songnodes
```

### Test Health Endpoints

```bash
# Port-forward to test locally
kubectl port-forward svc/rest-api-service 8082:8082 -n songnodes
curl http://localhost:8082/health

kubectl port-forward svc/frontend-service 8080:80 -n songnodes
curl http://localhost:8080/health
```

## 📊 Accessing Services

### Via Port-Forward (Development)

```bash
# Frontend
kubectl port-forward svc/frontend-service 3006:80 -n songnodes
# Open http://localhost:3006

# REST API
kubectl port-forward svc/rest-api-service 8082:8082 -n songnodes

# Open http://localhost:3000
# Default credentials: admin / (from secret)

# Open http://localhost:9090
```

### Via Ingress (Production)

After configuring DNS:
```
https://songnodes.example.com          → Frontend
https://api.songnodes.example.com/api  → REST API
https://api.songnodes.example.com/ws   → WebSocket API
```

## 🔧 Configuration

### Environment Variables

Edit `k8s/base/configmap.yaml` for non-sensitive configuration:
- Database connection settings
- API endpoints
- Feature flags
- Logging configuration

Edit `k8s/base/secret.yaml` for sensitive data:
- Database passwords
- API keys
- OAuth credentials

### Resource Limits

Default resource allocations:

| Service | Request (CPU/Memory) | Limit (CPU/Memory) |
|---------|---------------------|-------------------|
| PostgreSQL | 500m / 1Gi | 1000m / 2Gi |
| Redis | 100m / 256Mi | 500m / 512Mi |
| RabbitMQ | 250m / 512Mi | 1000m / 1Gi |
| REST API | 100m / 256Mi | 500m / 512Mi |
| Graph API | 250m / 512Mi | 1000m / 1Gi |
| WebSocket | 100m / 256Mi | 500m / 512Mi |
| NLP Processor | 500m / 1Gi | 2000m / 2Gi |
| Frontend | 50m / 128Mi | 200m / 256Mi |

Adjust in respective deployment files based on your cluster capacity.

### Storage Classes

Update `storageClassName` in PVC manifests:
```yaml
# For cloud providers
storageClassName: standard      # GKE
storageClassName: gp2           # EKS
storageClassName: managed-premium  # AKS

# For local development
storageClassName: hostpath      # Minikube, Kind
```

### Autoscaling Thresholds

Edit `k8s/base/hpa.yaml` to adjust:
- Min/max replicas
- CPU/memory thresholds
- Scale-up/down behavior

## 🔐 Security

### TLS/SSL Configuration

#### Option 1: cert-manager (Recommended)

```bash
# Install cert-manager
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.0/cert-manager.yaml

# Create ClusterIssuer
kubectl apply -f - <<EOF
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: your-email@example.com
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
      - http01:
          ingress:
            class: nginx
EOF

# Update ingress with TLS annotations (already in ingress.yaml)
```

#### Option 2: Manual Certificates

```bash
# Create TLS secret
kubectl create secret tls songnodes-tls \
  --cert=path/to/tls.crt \
  --key=path/to/tls.key \
  -n songnodes

# Uncomment TLS section in ingress.yaml
```

### Secrets Management

For production, use external secrets management:

**Sealed Secrets**:
```bash
# Install sealed-secrets controller
kubectl apply -f https://github.com/bitnami-labs/sealed-secrets/releases/download/v0.24.0/controller.yaml

# Seal secrets
kubeseal --format=yaml < k8s/base/secret.yaml > k8s/base/sealed-secret.yaml
```

**External Secrets Operator**:
```bash
# Install ESO
helm repo add external-secrets https://charts.external-secrets.io
helm install external-secrets external-secrets/external-secrets -n external-secrets-system --create-namespace

# Connect to AWS Secrets Manager, GCP Secret Manager, Azure Key Vault, etc.
```

### Network Policies

Network policies are enabled by default (k8s/base/networkpolicy.yaml):
- Default deny all ingress/egress
- Explicit allow rules for required communication
- DNS resolution allowed
- Ingress controller access configured

To disable (not recommended):
```bash
kubectl delete -f k8s/base/networkpolicy.yaml
```

## 🔄 Updates and Rollbacks

### Rolling Update

```bash
# Update image tag
kubectl set image deployment/rest-api rest-api=songnodes/rest-api:v2.0.0 -n songnodes

# Check rollout status
kubectl rollout status deployment/rest-api -n songnodes

# View rollout history
kubectl rollout history deployment/rest-api -n songnodes
```

### Rollback

```bash
# Rollback to previous version
kubectl rollout undo deployment/rest-api -n songnodes

# Rollback to specific revision
kubectl rollout undo deployment/rest-api --to-revision=2 -n songnodes
```

### Blue-Green Deployment

```bash
# Deploy new version alongside current
kubectl apply -f k8s/services/rest-api-deployment-v2.yaml

# Switch traffic via service selector update
kubectl patch service rest-api-service -p '{"spec":{"selector":{"version":"v2"}}}'

# Remove old deployment after validation
kubectl delete deployment rest-api-v1
```

## 🧹 Cleanup

### Delete Application

```bash
# Delete all resources in namespace
kubectl delete namespace songnodes
```

### Delete Individual Components

```bash
# Delete services
kubectl delete -f k8s/services/

# Delete core infrastructure
kubectl delete -f k8s/core/


# Delete ingress
kubectl delete -f k8s/ingress/

# Delete base configuration
kubectl delete -f k8s/base/
```

### Preserve Data

To keep persistent volumes:
```bash
# Change reclaim policy to Retain before deletion
kubectl patch pv <pv-name> -p '{"spec":{"persistentVolumeReclaimPolicy":"Retain"}}'

# Delete namespace (PVs will remain)
kubectl delete namespace songnodes

# Manually delete PVs later
kubectl delete pv <pv-name>
```



```bash
# Open http://localhost:9090
```

**Useful Queries**:
```promql
# Request rate
rate(http_requests_total[5m])

# Error rate
rate(http_requests_total{status=~"5.."}[5m])

# CPU usage
container_cpu_usage_seconds_total{namespace="songnodes"}

# Memory usage
container_memory_usage_bytes{namespace="songnodes"}

# Pod restart count
kube_pod_container_status_restarts_total{namespace="songnodes"}
```


```bash
# Open http://localhost:3000
```

**Default credentials**: admin / (set in secrets)

**Import Dashboards**:
2. Node Exporter Full: ID 1860
3. PostgreSQL Database: ID 9628
4. Redis Dashboard: ID 11835
5. RabbitMQ Overview: ID 10991

## 🐛 Troubleshooting

### Pods Not Starting

```bash
# Check pod status
kubectl describe pod <pod-name> -n songnodes

# View events
kubectl get events -n songnodes --sort-by='.lastTimestamp'

# Check logs
kubectl logs <pod-name> -n songnodes

# Check previous container logs (if crashed)
kubectl logs <pod-name> -n songnodes --previous
```

### Database Connection Issues

```bash
# Test PostgreSQL connectivity
kubectl exec -it postgres-0 -n songnodes -- psql -U musicdb_user -d musicdb -c "SELECT 1;"

# Test Redis connectivity
kubectl exec -it deployment/redis -n songnodes -- redis-cli -a $(kubectl get secret songnodes-secrets -n songnodes -o jsonpath='{.data.REDIS_PASSWORD}' | base64 -d) PING

# Check service DNS resolution
kubectl run -it --rm debug --image=busybox --restart=Never -n songnodes -- nslookup postgres-service
```

### Ingress Not Working

```bash
# Check ingress controller is running
kubectl get pods -n ingress-nginx

# Check ingress resource
kubectl describe ingress songnodes-ingress -n songnodes

# View ingress controller logs
kubectl logs -f deployment/ingress-nginx-controller -n ingress-nginx

# Test internal service connectivity
kubectl run -it --rm debug --image=curlimages/curl --restart=Never -n songnodes -- curl http://frontend-service
```

### HPA Not Scaling

```bash
# Check metrics-server is running
kubectl get deployment metrics-server -n kube-system

# Check HPA status
kubectl get hpa -n songnodes
kubectl describe hpa rest-api-hpa -n songnodes

# Manually test metrics
kubectl top nodes
kubectl top pods -n songnodes
```

### Resource Quota Issues

```bash
# Check resource usage
kubectl top nodes
kubectl describe node <node-name>

# Check pod resource requests/limits
kubectl describe pod <pod-name> -n songnodes

# View resource quotas (if set)
kubectl get resourcequota -n songnodes
```

## 🔗 Related Documentation

- [Docker Compose Deployment](../docker-compose.yml)
- [Development Guide](../docs/DEVELOPER_GUIDE.md)
- [API Documentation](../docs/API_DOCUMENTATION.md)
- [Secrets Management](../SECRETS_MANAGEMENT_IMPLEMENTATION.md)
- [Proxy Configuration](../docs/PROXY_CONFIGURATION.md)

## 📚 External Resources

- [Kubernetes Official Documentation](https://kubernetes.io/docs/)
- [NGINX Ingress Controller](https://kubernetes.github.io/ingress-nginx/)
- [cert-manager Documentation](https://cert-manager.io/docs/)
- [Sealed Secrets](https://github.com/bitnami-labs/sealed-secrets)

---

**Last Updated**: 2025-09-30
**Maintained by**: SongNodes Development Team
