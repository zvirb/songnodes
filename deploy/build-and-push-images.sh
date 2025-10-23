#!/bin/bash
# Build and push all SongNodes images to local registry for K8s deployment
set -e

# Configuration
REGISTRY="${REGISTRY:-localhost:5000}"
VERSION="${VERSION:-latest}"
PUSH="${PUSH:-true}"

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to build and push an image
build_and_push() {
    local service_name=$1
    local dockerfile_path=$2
    local context_path=$3
    local image_name="${REGISTRY}/songnodes_${service_name}:${VERSION}"

    log_info "Building ${service_name}..."

    if docker build -t "${image_name}" -f "${dockerfile_path}" "${context_path}"; then
        log_success "Built ${service_name}"

        if [ "$PUSH" = "true" ]; then
            log_info "Pushing ${image_name}..."
            if docker push "${image_name}"; then
                log_success "Pushed ${image_name}"
            else
                log_error "Failed to push ${image_name}"
                return 1
            fi
        fi
    else
        log_error "Failed to build ${service_name}"
        return 1
    fi
}

# Change to project root
cd "$(dirname "$0")/.."

log_info "Starting image build process for SongNodes Kubernetes deployment"
log_info "Registry: ${REGISTRY}"
log_info "Version: ${VERSION}"
log_info "Push enabled: ${PUSH}"

# Core Infrastructure Services
log_info "=== Building Core Services ==="

build_and_push "rest-api" "services/rest-api/Dockerfile" "services" || true
build_and_push "graphql-api" "services/graphql-api/Dockerfile" "services" || true
build_and_push "websocket-api" "services/websocket-api/Dockerfile" "services" || true
build_and_push "graph-visualization-api" "services/graph-visualization-api/Dockerfile" "services/graph-visualization-api" || true
build_and_push "enhanced-visualization-service" "services/enhanced-visualization-service/Dockerfile" "services/enhanced-visualization-service" || true

# Data Processing Services
log_info "=== Building Data Processing Services ==="

build_and_push "metadata-enrichment" "services/metadata-enrichment/Dockerfile" "." || true
build_and_push "nlp-processor" "services/nlp-processor/Dockerfile" "services/nlp-processor" || true
build_and_push "data-transformer" "services/data-transformer/Dockerfile" "services" || true
build_and_push "data-validator" "services/data-validator/Dockerfile" "services" || true
build_and_push "audio-analysis" "services/audio-analysis/Dockerfile" "services/audio-analysis" || true

# Scraper Services
log_info "=== Building Scraper Services ==="

build_and_push "scraper-orchestrator" "services/scraper-orchestrator/Dockerfile" "services/scraper-orchestrator" || true
build_and_push "scraper-1001tracklists" "scrapers/Dockerfile.1001tracklists" "scrapers" || true
build_and_push "scraper-mixesdb" "scrapers/Dockerfile.mixesdb" "scrapers" || true
build_and_push "scraper-setlistfm" "scrapers/Dockerfile.setlistfm" "scrapers" || true
build_and_push "scraper-reddit" "scrapers/Dockerfile.reddit" "scrapers" || true
build_and_push "scraper-mixcloud" "scrapers/Dockerfile.mixcloud" "scrapers" || true
build_and_push "scraper-youtube" "scrapers/Dockerfile.youtube" "scrapers" || true
build_and_push "scraper-livetracklist" "scrapers/Dockerfile.livetracklist" "scrapers" || true
build_and_push "scraper-residentadvisor" "scrapers/Dockerfile.residentadvisor" "scrapers" || true
build_and_push "scraper-bbc-sounds" "scrapers/Dockerfile.bbc_sounds" "scrapers" || true

# Utility Services
log_info "=== Building Utility Services ==="

build_and_push "api-gateway" "services/api-gateway/Dockerfile" "services/api-gateway" || true
build_and_push "api-gateway-internal" "services/api-gateway-internal/Dockerfile" "." || true
build_and_push "browser-collector" "services/browser-collector/Dockerfile" "services/browser-collector" || true
build_and_push "dlq-manager" "services/dlq-manager/Dockerfile" "services" || true
build_and_push "db-connection-pool" "services/db-connection-pool/Dockerfile" "services" || true

# Raw Data Processor
build_and_push "raw-data-processor" "scrapers/Dockerfile.raw_data_processor" "." || true

# Frontend
log_info "=== Building Frontend ==="

build_and_push "frontend" "frontend/Dockerfile" "frontend" || true

log_success "Image build process completed!"
log_info "To verify images in registry, run:"
log_info "  curl http://localhost:5000/v2/_catalog"
log_info ""
log_info "To apply the Kubernetes deployment:"
log_info "  kubectl apply -k deploy/flux/"
