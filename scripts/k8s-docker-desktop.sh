#!/usr/bin/env bash
# Deploy SongNodes to a LOCAL Docker Desktop Kubernetes cluster (kubeadm / single-node mode).
#
#   bash scripts/k8s-docker-desktop.sh                 # build images, create secret, helm install/upgrade, wait
#   bash scripts/k8s-docker-desktop.sh --skip-build    # reuse images already in Docker
#   bash scripts/k8s-docker-desktop.sh --skip-scraper  # data layer only (the unified scraper image is large)
#   bash scripts/k8s-docker-desktop.sh --secrets-only  # (re)write provider credentials into the Secret and exit
#   bash scripts/k8s-docker-desktop.sh --render-only   # lint + render the chart; touches no cluster
#   bash scripts/k8s-docker-desktop.sh --down          # helm uninstall (keeps volumes) ; add --purge to delete the namespace too
#
# Provider credentials are read from the environment (never from files in git):
#   TIDAL_CLIENT_ID TIDAL_CLIENT_SECRET LASTFM_API_KEY DISCOGS_API_TOKEN SPOTIFY_CLIENT_ID SPOTIFY_CLIENT_SECRET
#   YOUTUBE_API_KEY ANTHROPIC_API_KEY
# Anything unset stays CHANGE_ME, which the code treats as "not configured". Infrastructure passwords are generated once
# and kept on later runs (regenerating them would lock you out of the persisted database).
#
# This is a LOCAL development path. Production is k3s deployed by Flux from `main` (see docs/DEPLOYMENT_CHECKLIST.md).
set -euo pipefail

NS=songnodes
SECRET=songnodes-secrets
RELEASE=songnodes
CHART=deploy/helm/songnodes
REGISTRY=localhost:5000
cd "$(dirname "${BASH_SOURCE[0]}")/.."

build=1 scraper=1 secrets_only=0 render_only=0 down=0 purge=0
for arg in "$@"; do
  case "$arg" in
    --skip-build) build=0 ;;
    --skip-scraper) scraper=0 ;;
    --secrets-only) secrets_only=1 ;;
    --render-only) render_only=1 ;;
    --down) down=1 ;;
    --purge) purge=1 ;;
    -h|--help) sed -n 2,19p "${BASH_SOURCE[0]}"; exit 0 ;;
    *) echo "unknown option: $arg" >&2; exit 2 ;;
  esac
done

values=(-f "$CHART/values.yaml" -f "$CHART/values-docker-desktop.yaml")
[[ $scraper -eq 0 ]] && values+=(--set services.unifiedScraper.enabled=false)

if [[ $render_only -eq 1 ]]; then
  helm lint "$CHART" "${values[@]}"
  helm template "$RELEASE" "$CHART" -n "$NS" "${values[@]}" >/dev/null && echo "chart renders with the Docker Desktop overlay"
  exit 0
fi

# ---- Safety: only ever touch Docker Desktop's own cluster -------------------------------------------------------------
context="$(kubectl config current-context 2>/dev/null || true)"
case "$context" in
  docker-desktop|desktop-linux) ;;
  *) echo "Refusing to run: current kubectl context is '${context:-<none>}', not Docker Desktop's." >&2
     echo "Enable Kubernetes in Docker Desktop (Settings > Kubernetes, mode 'Kubeadm') and run: kubectl config use-context docker-desktop" >&2
     exit 1 ;;
esac
nodes="$(kubectl get nodes -o name 2>/dev/null || true)"
if [[ -z "$nodes" ]]; then echo "Cluster '$context' is not reachable. Is Kubernetes running in Docker Desktop?" >&2; exit 1; fi
if ! grep -q 'node/docker-desktop' <<<"$nodes"; then
  echo "Node is not 'docker-desktop' (found: $(tr '\n' ' ' <<<"$nodes"))." >&2
  echo "kind mode does not share Docker's image cache, so locally built images would not be found." >&2
  echo "Switch Docker Desktop's Kubernetes mode to 'Kubeadm' (single node), then re-run." >&2
  exit 1
fi

if [[ $down -eq 1 ]]; then
  helm uninstall "$RELEASE" -n "$NS" || true
  if [[ $purge -eq 1 ]]; then kubectl delete namespace "$NS" --ignore-not-found; echo "namespace and volumes deleted"; else echo "released; volumes and the Secret are kept (use --purge to delete them)"; fi
  exit 0
fi

# ---- Secret -----------------------------------------------------------------------------------------------------------
rand() { openssl rand -hex 16 2>/dev/null || python -c 'import secrets; print(secrets.token_hex(16))'; }
existing() { kubectl get secret "$SECRET" -n "$NS" -o "jsonpath={.data.$1}" 2>/dev/null | base64 -d 2>/dev/null || true; }
# value precedence: environment variable, then the value already in the cluster, then the default
pick() { local name=$1 default=${2:-CHANGE_ME}; local env=${!name:-}; if [[ -n "$env" ]]; then printf '%s' "$env"; else local cur; cur="$(existing "$name")"; printf '%s' "${cur:-$default}"; fi; }

kubectl get namespace "$NS" >/dev/null 2>&1 || kubectl create namespace "$NS"
pg_pass="$(existing POSTGRES_PASSWORD)"; pg_pass="${pg_pass:-$(rand)}"
redis_pass="$(existing REDIS_PASSWORD)"; redis_pass="${redis_pass:-$(rand)}"
rabbit_pass="$(existing RABBITMQ_PASS)"; rabbit_pass="${rabbit_pass:-$(rand)}"
enc_secret="$(existing API_KEY_ENCRYPTION_SECRET)"; enc_secret="${enc_secret:-$(rand)$(rand)}"
db_url="postgresql+asyncpg://musicdb_user:${pg_pass}@postgres-0.postgres-service.${NS}.svc.cluster.local:5432/musicdb"

kubectl create secret generic "$SECRET" -n "$NS" \
  --from-literal=POSTGRES_PASSWORD="$pg_pass" --from-literal=REDIS_PASSWORD="$redis_pass" --from-literal=RABBITMQ_PASS="$rabbit_pass" \
  --from-literal=DATABASE_URL="$db_url" --from-literal=API_KEY_ENCRYPTION_SECRET="$enc_secret" \
  --from-literal=TIDAL_CLIENT_ID="$(pick TIDAL_CLIENT_ID)" --from-literal=TIDAL_CLIENT_SECRET="$(pick TIDAL_CLIENT_SECRET)" \
  --from-literal=TIDAL_API_TOKEN="$(pick TIDAL_API_TOKEN)" --from-literal=LASTFM_API_KEY="$(pick LASTFM_API_KEY)" \
  --from-literal=DISCOGS_API_TOKEN="$(pick DISCOGS_API_TOKEN)" --from-literal=SPOTIFY_CLIENT_ID="$(pick SPOTIFY_CLIENT_ID)" \
  --from-literal=SPOTIFY_CLIENT_SECRET="$(pick SPOTIFY_CLIENT_SECRET)" --from-literal=YOUTUBE_API_KEY="$(pick YOUTUBE_API_KEY)" \
  --from-literal=ANTHROPIC_API_KEY="$(pick ANTHROPIC_API_KEY)" --from-literal=PROXY_USERNAME="$(pick PROXY_USERNAME '')" \
  --from-literal=PROXY_PASSWORD="$(pick PROXY_PASSWORD '')" --dry-run=client -o yaml | kubectl apply -f -
echo "secret $SECRET written (providers configured: $(for k in TIDAL_CLIENT_ID LASTFM_API_KEY DISCOGS_API_TOKEN; do v="$(existing $k)"; [[ -n "$v" && "$v" != CHANGE_ME* ]] && printf '%s ' "$k"; done)<end>)"
[[ $secrets_only -eq 1 ]] && { echo "restart the worker to pick up new credentials: kubectl rollout restart deployment/worker -n $NS"; exit 0; }

# ---- Images (built into Docker's own cache, which the kubeadm node shares) -----------------------------------------------
if [[ $build -eq 1 ]]; then
  ( cd frontend && npm ci --no-audit --no-fund && npm run build )   # fresh dist/ is required (CLAUDE.md)
  docker build -t "$REGISTRY/songnodes_rest-api:latest" -f services/rest_api/Dockerfile .
  docker build -t "$REGISTRY/songnodes_graph-visualization-api:latest" -f services/graph-visualization-api/Dockerfile .
  docker build -t "$REGISTRY/songnodes_worker:latest" -f services/worker/Dockerfile .
  docker build -t "$REGISTRY/songnodes_frontend:latest" frontend/
  [[ $scraper -eq 1 ]] && docker build -t "$REGISTRY/songnodes_unified-scraper:latest" scrapers/
fi

# ---- Deploy -----------------------------------------------------------------------------------------------------------
helm upgrade --install "$RELEASE" "$CHART" -n "$NS" "${values[@]}" --wait --timeout 12m
kubectl get pods -n "$NS"
cat <<EOF

Deployed to Docker Desktop Kubernetes ($context).
Reach the services (each in its own terminal):
  kubectl port-forward -n $NS svc/rest-api 8082:8082
  kubectl port-forward -n $NS svc/graph-visualization 8084:8084
  kubectl port-forward -n $NS svc/frontend 3006:80
Check the data layer:
  kubectl logs -n $NS job/data-layer-migrate        # if the hook job is still present
  kubectl exec -n $NS deploy/worker -- python migrate.py --check
Add provider credentials later:  TIDAL_CLIENT_ID=... TIDAL_CLIENT_SECRET=... bash scripts/k8s-docker-desktop.sh --secrets-only
EOF
