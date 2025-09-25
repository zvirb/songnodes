#!/bin/bash

# SongNodes Service Shutdown Script
# This script gracefully shuts down all Docker containers to free system resources

echo "Shutting down SongNodes services..."

# Navigate to the project directory
cd "$(dirname "$0")"

# Shutdown all services
docker compose down

echo "All services have been stopped."
echo "To restart, run: docker compose up -d"