#!/bin/bash

# MusicDB Development Quick Start Script
# This script starts the essential services for testing the data pipeline

set -e

echo "🎵 MusicDB Development Environment Startup"
echo "=========================================="

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker first."
    exit 1
fi

# Check if .env file exists
if [ ! -f .env ]; then
    echo "⚠️  .env file not found. Creating from example..."
    cp .env.example .env
    echo "✅ Created .env file. Please update with your API keys."
fi

echo ""
echo "📦 Starting core services..."
echo "----------------------------"

# Start database and message broker first
echo "1️⃣  Starting PostgreSQL (port 5433)..."
docker compose up -d postgres

echo "⏳ Waiting for PostgreSQL to be ready..."
sleep 10
docker compose exec -T postgres pg_isready -U musicdb_user || echo "⚠️  PostgreSQL may need more time to start"

echo "2️⃣  Starting Redis (port 6380)..."
docker compose up -d redis

echo "3️⃣  Starting RabbitMQ (port 5673)..."
docker compose up -d rabbitmq

echo ""
echo "🕷️  Building and starting scraping services..."
echo "---------------------------------------------"

# Build scraper images
echo "4️⃣  Building scraper orchestrator..."
docker compose build scraper-orchestrator

echo "5️⃣  Building 1001tracklists scraper..."
docker compose build scraper-1001tracklists || echo "⚠️  Build failed - missing dependencies"

echo "6️⃣  Building MixesDB scraper..."
docker compose build scraper-mixesdb || echo "⚠️  Build failed - missing dependencies"

# Start scraping services
echo "7️⃣  Starting scraper orchestrator (port 8001)..."
docker compose up -d scraper-orchestrator

echo ""
echo "✅ Core services started!"
echo ""
echo "📊 Service Status:"
echo "-----------------"
docker compose ps

echo ""
echo "🔗 Access Points:"
echo "----------------"
echo "• Scraper Orchestrator: http://localhost:8001"
echo "• Orchestrator Health:  http://localhost:8001/health"
echo "• Scraper Status:       http://localhost:8001/scrapers/status"
echo "• Queue Status:         http://localhost:8001/queue/status"
echo "• PostgreSQL:           localhost:5433 (user: musicdb_user)"
echo "• Redis:                localhost:6380"
echo "• RabbitMQ Management:  http://localhost:15673"

echo ""
echo "📝 Quick Test Commands:"
echo "----------------------"
echo "# Check orchestrator health:"
echo "curl http://localhost:8001/health"
echo ""
echo "# Submit a test scraping task:"
echo 'curl -X POST http://localhost:8001/tasks/submit \
  -H "Content-Type: application/json" \
  -d "{\"scraper\": \"1001tracklists\", \"priority\": \"high\"}"'
echo ""
echo "# Check database connection:"
echo "docker compose exec postgres psql -U musicdb_user -d musicdb -c '\\dt'"

echo ""
echo "📚 Next Steps:"
echo "-------------"
echo "1. Add your API keys to .env file"
echo "2. Test scraper endpoints"
echo "3. Monitor logs: docker compose logs -f"
echo "4. Stop services: docker compose down"

echo ""
echo "🎉 Development environment is ready!"