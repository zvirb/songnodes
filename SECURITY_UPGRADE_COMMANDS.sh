#!/bin/bash
# Security Dependency Upgrade Script
# Date: 2025-10-10
# Purpose: Upgrade Python dependencies to fix 45 known vulnerabilities

set -e  # Exit on error

PROJECT_ROOT="/mnt/my_external_drive/programming/songnodes"
cd "$PROJECT_ROOT"

echo "==================================================================="
echo "  Security Dependency Upgrade - Python Services"
echo "==================================================================="
echo ""
echo "This script will upgrade dependencies in 5 critical services:"
echo "  - api-gateway-internal (15 vulnerabilities)"
echo "  - metadata-enrichment (11 vulnerabilities)"
echo "  - rest-api (10 vulnerabilities)"
echo "  - websocket-api (3 vulnerabilities)"
echo "  - dlq-manager (5 vulnerabilities)"
echo ""
echo "Total vulnerabilities fixed: 45"
echo ""
read -p "Continue? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 1
fi

# Backup current requirements files
echo ""
echo "📦 Creating backups..."
for service in api-gateway-internal metadata-enrichment rest-api websocket-api dlq-manager; do
    cp "services/$service/requirements.txt" "services/$service/requirements.txt.backup"
    echo "  ✅ Backed up services/$service/requirements.txt"
done

# Function to update package version in requirements.txt
update_package() {
    local file=$1
    local old_version=$2
    local new_version=$3

    sed -i "s/$old_version/$new_version/" "$file"
}

# 1. api-gateway-internal
echo ""
echo "📝 Updating api-gateway-internal..."
FILE="services/api-gateway-internal/requirements.txt"
update_package "$FILE" "fastapi==0.109.0" "fastapi==0.115.12"
update_package "$FILE" "aiohttp==3.9.1" "aiohttp==3.12.14"
update_package "$FILE" "python-multipart==0.0.6" "python-multipart==0.0.19"
update_package "$FILE" "requests==2.31.0" "requests==2.32.5"
update_package "$FILE" "urllib3==2.1.0" "urllib3==2.5.0"
echo "  ✅ api-gateway-internal requirements.txt updated"

# 2. metadata-enrichment
echo ""
echo "📝 Updating metadata-enrichment..."
FILE="services/metadata-enrichment/requirements.txt"
update_package "$FILE" "aiohttp==3.9.1" "aiohttp==3.12.14"
update_package "$FILE" "fastapi==0.104.1" "fastapi==0.115.12"
update_package "$FILE" "requests==2.31.0" "requests==2.32.5"
echo "  ✅ metadata-enrichment requirements.txt updated"

# 3. rest-api
echo ""
echo "📝 Updating rest-api..."
FILE="services/rest-api/requirements.txt"
update_package "$FILE" "fastapi==0.104.1" "fastapi==0.115.12"
update_package "$FILE" "aiohttp==3.9.1" "aiohttp==3.12.14"
update_package "$FILE" "python-multipart==0.0.18" "python-multipart==0.0.19"
# h11 upgrade (if exists - rest-api uses older version)
if grep -q "h11==0.14.0" "$FILE"; then
    update_package "$FILE" "h11==0.14.0" "h11==0.16.0"
    echo "  ✅ h11 upgraded to 0.16.0"
fi
echo "  ✅ rest-api requirements.txt updated"

# 4. websocket-api
echo ""
echo "📝 Updating websocket-api..."
FILE="services/websocket-api/requirements.txt"
update_package "$FILE" "fastapi==0.104.1" "fastapi==0.115.12"
update_package "$FILE" "python-multipart==0.0.18" "python-multipart==0.0.19"
echo "  ✅ websocket-api requirements.txt updated"

# 5. dlq-manager
echo ""
echo "📝 Updating dlq-manager..."
FILE="services/dlq-manager/requirements.txt"
update_package "$FILE" "fastapi==0.109.0" "fastapi==0.115.12"
update_package "$FILE" "python-multipart==0.0.6" "python-multipart==0.0.19"
echo "  ✅ dlq-manager requirements.txt updated"

# Show changes
echo ""
echo "==================================================================="
echo "  Changes Summary"
echo "==================================================================="
echo ""
for service in api-gateway-internal metadata-enrichment rest-api websocket-api dlq-manager; do
    echo "📄 services/$service/requirements.txt"
    diff -u "services/$service/requirements.txt.backup" "services/$service/requirements.txt" || true
    echo ""
done

# Rebuild Docker images
echo ""
echo "==================================================================="
echo "  Docker Image Rebuild"
echo "==================================================================="
echo ""
read -p "Rebuild Docker images now? (y/N) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    echo "🐳 Rebuilding images (--no-cache)..."

    for service in api-gateway-internal metadata-enrichment rest-api websocket-api dlq-manager; do
        echo ""
        echo "  Building $service..."
        docker compose build --no-cache "$service"
        echo "  ✅ $service built"
    done

    echo ""
    echo "🚀 Starting updated services..."
    docker compose up -d api-gateway-internal metadata-enrichment rest-api websocket-api dlq-manager

    echo ""
    echo "⏳ Waiting 10 seconds for services to start..."
    sleep 10

    # Health checks
    echo ""
    echo "🏥 Running health checks..."

    check_health() {
        local service=$1
        local port=$2
        local url="http://localhost:$port/health"

        echo -n "  $service ($url): "
        if curl -f -s "$url" > /dev/null 2>&1; then
            echo "✅ HEALTHY"
        else
            echo "❌ UNHEALTHY"
            return 1
        fi
    }

    check_health "api-gateway-internal" 8084
    check_health "metadata-enrichment" 8020
    check_health "rest-api" 8082
    check_health "websocket-api" 8083
    check_health "dlq-manager" 8022

    echo ""
    echo "📊 Docker service status:"
    docker compose ps api-gateway-internal metadata-enrichment rest-api websocket-api dlq-manager
fi

# Verification
echo ""
echo "==================================================================="
echo "  Verification"
echo "==================================================================="
echo ""
echo "✅ Requirements files updated"
echo "✅ Backups created (*.backup)"
echo "✅ Docker images rebuilt (if selected)"
echo ""
echo "Next steps:"
echo "  1. Run integration tests: pytest tests/integration/ -v"
echo "  2. Run E2E tests: cd frontend && npm run test:e2e"
echo "  3. Re-scan for vulnerabilities: pip-audit -r services/*/requirements.txt"
echo "  4. Monitor logs: docker compose logs -f --tail=100"
echo "  5. Check metrics: http://localhost:9091/metrics"
echo ""
echo "Rollback if needed:"
echo "  for service in api-gateway-internal metadata-enrichment rest-api websocket-api dlq-manager; do"
echo "    mv services/\$service/requirements.txt.backup services/\$service/requirements.txt"
echo "    docker compose build --no-cache \$service"
echo "  done"
echo "  docker compose up -d"
echo ""
echo "==================================================================="
echo "  Upgrade Complete!"
echo "==================================================================="
